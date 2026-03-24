import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getDb, saveDatabase } from "../database.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";
import { RegisterBody, LoginBody } from "../types.js";

const router = Router();

function normalizeCelular(raw: string): string {
    return String(raw).replace(/\D/g, "");
}

/**
 * Gera as duas variantes de um celular (com e sem o 9° dígito).
 * Ex: "35998740954" → ["3598740954", "35998740954"]
 *     "3598740954"  → ["3598740954", "35998740954"]
 */
function celularVariants(celularClean: string): string[] {
    if (celularClean.length < 10) return [celularClean];
    const ddd = celularClean.slice(0, 2);
    const rest = celularClean.slice(2);

    if (rest.length === 9 && rest.startsWith("9")) {
        // 11 dígitos: gera variante sem o 9
        return [ddd + rest.slice(1), celularClean];
    } else if (rest.length === 8) {
        // 10 dígitos: gera variante com o 9
        return [celularClean, ddd + "9" + rest];
    }
    return [celularClean];
}

/**
 * POST /api/auth/register
 * Cadastro de novo usuário. Valida celular contra lista autorizada.
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
    try {
        const { nome, matricula, celular, senha, device_fingerprint } = req.body as RegisterBody;

        if (!nome || !matricula || !celular || !senha) {
            res.status(400).json({ error: "Todos os campos são obrigatórios" });
            return;
        }

        if (senha.length < 6) {
            res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
            return;
        }

        if (!/(?=.*[0-9])/.test(senha)) {
            res.status(400).json({ error: "A senha deve conter pelo menos um número" });
            return;
        }

        if (!/(?=.*[!@#$%^&*])/.test(senha)) {
            res.status(400).json({ error: "A senha deve conter pelo menos um caractere especial (!@#$%^&*)" });
            return;
        }

        const db = getDb();
        const celularClean = normalizeCelular(celular);

        // Verificar se celular é autorizado (busca com e sem o 9° dígito)
        const variants = celularVariants(celularClean);
        const placeholders = variants.map(() => "?").join(", ");
        const autorizado = db.exec(
            `SELECT id, cargo FROM celulares_autorizados WHERE numero IN (${placeholders}) AND ativo = 1`,
            variants
        );
        if (autorizado.length === 0 || autorizado[0].values.length === 0) {
            res.status(403).json({ error: "Celular não autorizado. Utilize seu celular corporativo." });
            return;
        }

        const roleFromDb = autorizado[0].values[0][1] as string | null;
        const userCargo = roleFromDb?.trim() || "consultor";

        // Verificar se já existe usuário com esse celular (busca ambas variantes)
        const existente = db.exec(
            `SELECT id FROM users WHERE celular IN (${placeholders})`,
            variants
        );
        if (existente.length > 0 && existente[0].values.length > 0) {
            res.status(409).json({ error: "Já existe um cadastro com este celular" });
            return;
        }

        // Hash da senha
        const senha_hash = await bcrypt.hash(senha, 10);

        // Inserir usuário
        db.run(
            "INSERT INTO users (nome, matricula, celular, senha_hash, device_fingerprint, role) VALUES (?, ?, ?, ?, ?, ?)",
            [nome, matricula, celularClean, senha_hash, device_fingerprint || null, userCargo]
        );

        saveDatabase();

        res.status(201).json({ message: "Cadastro realizado com sucesso" });
    } catch (error) {
        console.error("Erro no registro:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * POST /api/auth/login
 * Login do usuário. Retorna JWT.
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
    try {
        const { celular, senha, device_fingerprint } = req.body as LoginBody;

        if (!celular || !senha) {
            res.status(400).json({ error: "Celular e senha são obrigatórios" });
            return;
        }

        const db = getDb();
        const celularClean = normalizeCelular(celular);
        const variants = celularVariants(celularClean);
        const placeholders = variants.map(() => "?").join(", ");

        const result = db.exec(
            `SELECT id, nome, matricula, celular, senha_hash, role FROM users WHERE celular IN (${placeholders})`,
            variants
        );

        if (result.length === 0 || result[0].values.length === 0) {
            res.status(401).json({ error: "Celular ou senha incorretos" });
            return;
        }

        const row = result[0].values[0];
        let user = {
            id: row[0] as number,
            nome: row[1] as string,
            matricula: row[2] as string,
            celular: row[3] as string,
            senha_hash: row[4] as string,
            role: (row[5] as string) || "consultor",
        };

        // Verificar senha
        const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);
        if (!senhaCorreta) {
            res.status(401).json({ error: "Celular ou senha incorretos" });
            return;
        }

        // Sincronizar cargo com a planilha a cada login
        try {
            const autorizado = db.exec(
                `SELECT cargo FROM celulares_autorizados WHERE numero IN (${placeholders}) AND ativo = 1`,
                variants
            );
            if (autorizado.length > 0 && autorizado[0].values.length > 0) {
                const cargoPlanilha = (autorizado[0].values[0][0] as string | null)?.trim() || "consultor";
                if (cargoPlanilha !== user.role) {
                    db.run("UPDATE users SET role = ? WHERE id = ?", [cargoPlanilha, user.id]);
                    saveDatabase();
                    user = { ...user, role: cargoPlanilha };
                }
            }
        } catch (e) {
            console.error("Erro ao sincronizar cargo no login:", e);
        }

        // Atualizar fingerprint se fornecido
        if (device_fingerprint) {
            db.run("UPDATE users SET device_fingerprint = ? WHERE id = ?", [device_fingerprint, user.id]);
            saveDatabase();
        }

        // Gerar token
        const token = generateToken({ userId: user.id, celular: user.celular });

        res.json({
            token,
            user: {
                id: user.id,
                nome: user.nome,
                matricula: user.matricula,
                celular: user.celular,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado.
 */
router.get("/me", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const result = db.exec(
            "SELECT id, nome, matricula, celular, role, created_at FROM users WHERE id = ?",
            [req.userId!]
        );

        if (result.length === 0 || result[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }

        const row = result[0].values[0];
        res.json({
            id: row[0],
            nome: row[1],
            matricula: row[2],
            celular: row[3],
            role: row[4],
            created_at: row[5],
        });
    } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
/**
 * POST /api/auth/generate-reset-code
 * Apenas admins. Gera um PIN de 6 dígitos para recuperar a senha de um usuário.
 */
router.post("/generate-reset-code", authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.body;
        
        const db = getDb();
        const requestor = db.exec("SELECT role FROM users WHERE id = ?", [req.userId!]);
        const role = requestor?.[0]?.values?.[0]?.[0] as string;
        
        if (role !== "Administrador") {
            res.status(403).json({ error: "Apenas administradores podem gerar códigos de redefinição." });
            return;
        }

        const userToReset = db.exec("SELECT id FROM users WHERE id = ?", [userId]);
        if (userToReset.length === 0 || userToReset[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado." });
            return;
        }

        const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
        // Expirar em 15 minutos
        const expires = new Date(Date.now() + 15 * 60000).toISOString();

        db.run("UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?", [pin, expires, userId]);
        saveDatabase();

        res.json({ message: "Código gerado com sucesso", code: pin });
    } catch (error) {
        console.error("Erro ao gerar PIN:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * POST /api/auth/validate-reset-code
 * Verifica se o PIN informado para o celular é válido e não expirou.
 */
router.post("/validate-reset-code", async (req: Request, res: Response): Promise<void> => {
    try {
        const { celular, code } = req.body;
        if (!celular || !code) {
           res.status(400).json({ error: "Celular e código são obrigatórios." });
           return;
        }
        
        const celularClean = normalizeCelular(celular);
        const variants = celularVariants(celularClean);
        const placeholders = variants.map(() => "?").join(", ");

        const db = getDb();
        const result = db.exec(`SELECT reset_code, reset_expires FROM users WHERE celular IN (${placeholders})`, variants);

        if (result.length === 0 || result[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado." });
            return;
        }

        const row = result[0].values[0];
        const dbCode = row[0] as string;
        const dbExpires = row[1] as string;

        if (!dbCode || dbCode !== code) {
            res.status(400).json({ error: "Código inválido." });
            return;
        }

        if (new Date() > new Date(dbExpires)) {
            res.status(400).json({ error: "Código expirado. Solicite um novo ao administrador." });
            return;
        }

        res.json({ message: "Código válido." });
    } catch (error) {
        console.error("Erro na validação do PIN:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * POST /api/auth/reset-password
 * Define a nova senha usando o PIN validado.
 */
router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
    try {
        const { celular, code, novaSenha } = req.body;
        const celularClean = normalizeCelular(celular);
        const variants = celularVariants(celularClean);
        const placeholders = variants.map(() => "?").join(", ");

        if (!novaSenha || novaSenha.length < 6 || !/(?=.*[0-9])/.test(novaSenha) || !/(?=.*[!@#$%^&*])/.test(novaSenha)) {
            res.status(400).json({ error: "A senha não cumpre os requisitos mínimos de segurança." });
            return;
        }

        const db = getDb();
        const result = db.exec(`SELECT id, reset_code, reset_expires FROM users WHERE celular IN (${placeholders})`, variants);

        if (result.length === 0 || result[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado." });
            return;
        }

        const row = result[0].values[0];
        const id = row[0] as number;
        const dbCode = row[1] as string;
        const dbExpires = row[2] as string;

        if (!dbCode || dbCode !== code) {
            res.status(400).json({ error: "Código inválido." });
            return;
        }

        if (new Date() > new Date(dbExpires)) {
            res.status(400).json({ error: "Código expirado. Solicite um novo ao administrador." });
            return;
        }

        const senha_hash = await bcrypt.hash(novaSenha, 10);

        db.run("UPDATE users SET senha_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?", [senha_hash, id]);
        saveDatabase();

        res.json({ message: "Senha redefinida com sucesso." });
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});
/**
 * GET /api/auth/users
 * Retorna todos os usuários (Apenas Administradores).
 */
router.get("/users", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const requestor = db.exec("SELECT role FROM users WHERE id = ?", [req.userId!]);
        const role = requestor?.[0]?.values?.[0]?.[0] as string;
        
        if (role !== "Administrador") {
            res.status(403).json({ error: "Acesso negado. Apenas administradores." });
            return;
        }

        const result = db.exec("SELECT id, nome, celular, matricula, role, reset_code, reset_expires FROM users ORDER BY nome ASC");
        
        if (result.length === 0 || result[0].values.length === 0) {
            res.json([]);
            return;
        }

        const columns = result[0].columns;
        const now = new Date();
        const users = result[0].values.map(val => {
           let obj: any = {};
           columns.forEach((col, i) => {
               obj[col] = val[i];
           });
           // Esconder PINs que já passaram do tempo de validade (15 min)
           if (obj.reset_expires && new Date(obj.reset_expires) < now) {
               obj.reset_code = null;
           }
           delete obj.reset_expires; // não enviar pro frontend
           return obj;
        });

        res.json(users);
    } catch (error) {
        console.error("Erro ao listar usuários:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

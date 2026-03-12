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

        // Verificar se celular é autorizado (sempre usando o formato normalizado)
        const autorizado = db.exec(
            "SELECT id, cargo FROM celulares_autorizados WHERE numero = ? AND ativo = 1",
            [celularClean]
        );
        if (autorizado.length === 0 || autorizado[0].values.length === 0) {
            res.status(403).json({ error: "Celular não autorizado. Utilize seu celular corporativo." });
            return;
        }

        const roleFromDb = autorizado[0].values[0][1] as string | null;
        const userCargo = roleFromDb?.trim() || "consultor";

        // Verificar se já existe usuário com esse celular
        const existente = db.exec("SELECT id FROM users WHERE celular = ?", [celularClean]);
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

        const result = db.exec(
            "SELECT id, nome, matricula, celular, senha_hash, role FROM users WHERE celular = ?",
            [celularClean]
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
                "SELECT cargo FROM celulares_autorizados WHERE numero = ? AND ativo = 1",
                [celularClean]
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

export default router;

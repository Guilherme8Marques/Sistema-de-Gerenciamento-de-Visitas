import { Router, Request, Response, NextFunction } from "express";
import { getDb, saveDatabase } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Middleware para verificar se é o Master (3597786623)
export const masterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    try {
        if (!req.userId) {
            res.status(401).json({ error: "Não autenticado" });
            return;
        }
        const db = getDb();
        const result = db.exec("SELECT celular FROM users WHERE id = ?", [req.userId]);
        if (result.length === 0 || result[0].values.length === 0) {
            res.status(401).json({ error: "Usuário não encontrado" });
            return;
        }

        const celular = result[0].values[0][0] as string;
        if (celular !== "3597786623") {
            res.status(403).json({ error: "Acesso negado. Apenas o Master pode executar esta ação." });
            return;
        }
        
        next();
    } catch (e) {
        res.status(500).json({ error: "Erro de autorização" });
    }
};

router.use(authMiddleware);
router.use(masterMiddleware);

/**
 * GET /api/admin/user/:id
 * Retorna dados detalhados de um usuário, planejamentos e visitas.
 */
router.get("/user/:id", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        const db = getDb();

        const userRes = db.exec("SELECT id, nome, celular, matricula, role FROM users WHERE id = ?", [id]);
        if (userRes.length === 0 || userRes[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        const u = userRes[0].values[0];
        const user = { id: u[0], nome: u[1], celular: u[2], matricula: u[3], role: u[4] };

        // Planejamentos (Joined with cooperados to get name)
        const planRes = db.exec(`
            SELECT p.id, p.data_planejada, p.tipo, p.evento_nome, p.semana, c.nome as cooperado_nome
            FROM planejamento p
            LEFT JOIN cooperados c ON p.cooperado_id = c.id
            WHERE p.user_id = ?
            ORDER BY p.data_planejada DESC
        `, [id]);
        
        const planejamentos = planRes.length > 0 ? planRes[0].values.map(val => ({
            id: val[0],
            data_planejada: val[1],
            tipo: val[2],
            evento_nome: val[3],
            semana: val[4],
            cooperado_nome: val[5]
        })) : [];

        // Visitas (Joined with cooperados to get name)
        const visRes = db.exec(`
            SELECT v.id, v.data_visita, v.resultado, c.nome as cooperado_nome
            FROM visitas v
            LEFT JOIN cooperados c ON v.cooperado_id = c.id
            WHERE v.user_id = ?
            ORDER BY v.data_visita DESC
        `, [id]);

        const visitas = visRes.length > 0 ? visRes[0].values.map(val => ({
            id: val[0],
            data_visita: val[1],
            resultado: val[2],
            cooperado_nome: val[3]
        })) : [];

        res.json({ ...user, planejamentos, visitas });
    } catch (error) {
        console.error("Erro ao carregar usuário master:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/admin/planejamento/:id
 */
router.delete("/planejamento/:id", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        getDb().run("DELETE FROM planejamento WHERE id = ?", [id]);
        saveDatabase();
        res.json({ message: "Planejamento excluído." });
    } catch (error) {
        console.error("Erro deletar plano:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/admin/visita/:id
 */
router.delete("/visita/:id", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        getDb().run("DELETE FROM visitas WHERE id = ?", [id]);
        saveDatabase();
        res.json({ message: "Visita excluída." });
    } catch (error) {
        console.error("Erro deletar visita:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/admin/user/:id/planejamentos
 */
router.delete("/user/:id/planejamentos", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        getDb().run("DELETE FROM planejamento WHERE user_id = ?", [id]);
        saveDatabase();
        res.json({ message: "Todos os planejamentos excluídos." });
    } catch (error) {
        console.error("Erro deletar todos planos:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/admin/user/:id/visitas
 */
router.delete("/user/:id/visitas", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        getDb().run("DELETE FROM visitas WHERE user_id = ?", [id]);
        saveDatabase();
        res.json({ message: "Todas as visitas excluídas." });
    } catch (error) {
        console.error("Erro deletar todas visitas:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/admin/user/:id
 */
router.delete("/user/:id", (req: Request, res: Response): void => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query;
        const db = getDb();

        const userRes = db.exec("SELECT celular FROM users WHERE id = ?", [id]);
        if (userRes.length === 0 || userRes[0].values.length === 0) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }

        const celular = userRes[0].values[0][0] as string;

        // Remover de autorizados e colocar na blacklist
        db.run("DELETE FROM celulares_autorizados WHERE numero = ?", [celular]);
        try {
            db.run("INSERT INTO blacklist (celular, motivo) VALUES (?, ?)", [celular, hardDelete === "true" ? "hard_delete" : "soft_delete"]);
        } catch(e) {} // Ignorar conflito de unique se já tiver

        if (hardDelete === "true") {
            db.run("DELETE FROM visitas WHERE user_id = ?", [id]);
            db.run("DELETE FROM planejamento WHERE user_id = ?", [id]);
            db.run("DELETE FROM users WHERE id = ?", [id]);
        } else {
            // Soft Delete: Scramble password out, change role to prevent login access just in case
            db.run("UPDATE users SET senha_hash = 'BLOCKED', role = 'bloqueado', reset_code = NULL, device_fingerprint = NULL WHERE id = ?", [id]);
        }

        saveDatabase();
        res.json({ message: "Usuário processado." });
    } catch (error) {
        console.error("Erro deletar usuario:", error);
        res.status(500).json({ error: "Erro ao processar usuário no DB" });
    }
});

export default router;

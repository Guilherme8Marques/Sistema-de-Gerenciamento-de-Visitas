import { Router, Request, Response } from "express";
import { getDb, saveDatabase } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import { PlanejamentoBody } from "../types.js";

const router = Router();

/**
 * GET /api/planejamento?semana=atual&data=2026-02-24
 * Lista atividades planejadas do usuário filtrando por semana ou data.
 */
router.get("/", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const semana = req.query.semana as string;
        const data = req.query.data as string;

        let query: string;
        let params: (string | number)[];

        if (data) {
            query = `
        SELECT p.id, p.data_planejada, p.tipo, p.cooperado_id, p.evento_nome, p.semana,
               c.nome as cooperado_nome, c.matricula as cooperado_matricula, f.id as filial_id, f.nome as filial_nome
        FROM planejamento p
        LEFT JOIN cooperados c ON p.cooperado_id = c.id
        LEFT JOIN filiais f ON c.filial_id = f.id
        WHERE p.user_id = ? AND p.data_planejada = ?
        ORDER BY p.created_at
      `;
            params = [userId, data];
        } else if (semana) {
            query = `
        SELECT p.id, p.data_planejada, p.tipo, p.cooperado_id, p.evento_nome, p.semana,
               c.nome as cooperado_nome, c.matricula as cooperado_matricula, f.id as filial_id, f.nome as filial_nome
        FROM planejamento p
        LEFT JOIN cooperados c ON p.cooperado_id = c.id
        LEFT JOIN filiais f ON c.filial_id = f.id
        WHERE p.user_id = ? AND p.semana = ?
        ORDER BY p.data_planejada, p.created_at
      `;
            params = [userId, semana];
        } else {
            query = `
        SELECT p.id, p.data_planejada, p.tipo, p.cooperado_id, p.evento_nome, p.semana,
               c.nome as cooperado_nome, c.matricula as cooperado_matricula, f.id as filial_id, f.nome as filial_nome
        FROM planejamento p
        LEFT JOIN cooperados c ON p.cooperado_id = c.id
        LEFT JOIN filiais f ON c.filial_id = f.id
        WHERE p.user_id = ?
        ORDER BY p.data_planejada DESC, p.created_at
        LIMIT 50
      `;
            params = [userId];
        }

        const result = db.exec(query, params);

        if (result.length === 0) {
            res.json([]);
            return;
        }

        const atividades = result[0].values.map((row) => ({
            id: row[0],
            data_planejada: row[1],
            tipo: row[2],
            cooperado_id: row[3],
            evento_nome: row[4],
            semana: row[5],
            cooperado_nome: row[6],
            cooperado_matricula: row[7],
            filial_id: row[8],
            filial_nome: row[9],
        }));

        res.json(atividades);
    } catch (error) {
        console.error("Erro ao buscar planejamento:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * POST /api/planejamento
 * Salva uma atividade planejada individual.
 */
router.post("/", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const { data_planejada, tipo, cooperado_id, evento_nome, semana } = req.body as PlanejamentoBody;

        if (!data_planejada || !tipo || !semana) {
            res.status(400).json({ error: "Campos obrigatórios: data_planejada, tipo, semana" });
            return;
        }

        if (tipo === "visita" && !cooperado_id) {
            res.status(400).json({ error: "Cooperado é obrigatório para visitas" });
            return;
        }

        if (tipo === "evento" && !evento_nome) {
            res.status(400).json({ error: "Nome do evento é obrigatório" });
            return;
        }

        db.run(
            `INSERT INTO planejamento (user_id, data_planejada, tipo, cooperado_id, evento_nome, semana)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, data_planejada, tipo, cooperado_id || null, evento_nome || null, semana]
        );

        saveDatabase();

        // Retornar o item criado
        const result = db.exec("SELECT last_insert_rowid()");
        const id = result[0].values[0][0];

        res.status(201).json({
            id,
            data_planejada,
            tipo,
            cooperado_id: cooperado_id || null,
            evento_nome: evento_nome || null,
            semana,
        });
    } catch (error) {
        console.error("Erro ao salvar planejamento:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * DELETE /api/planejamento/:id
 * Remove uma atividade planejada.
 */
router.delete("/:id", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const id = parseInt(req.params.id);

        // Verificar se pertence ao usuário
        const existing = db.exec(
            "SELECT id FROM planejamento WHERE id = ? AND user_id = ?",
            [id, userId]
        );

        if (existing.length === 0 || existing[0].values.length === 0) {
            res.status(404).json({ error: "Atividade não encontrada" });
            return;
        }

        db.run("DELETE FROM planejamento WHERE id = ?", [id]);
        saveDatabase();

        res.json({ message: "Atividade removida com sucesso" });
    } catch (error) {
        console.error("Erro ao remover planejamento:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

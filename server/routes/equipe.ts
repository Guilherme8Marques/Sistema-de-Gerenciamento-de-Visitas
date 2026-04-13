import { Router, Request, Response } from "express";
import { getDb } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/equipe?busca=João
 * Busca colaboradores da equipe de vendas por nome ou matrícula.
 * Retorna até 20 resultados para o campo "Acompanhado por".
 */
router.get("/", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const busca = (req.query.busca as string) || "";

        let result;

        if (busca.trim()) {
            const buscaNormalizada = busca.trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, " ")
                .toLowerCase();
            const buscaParam = `%${buscaNormalizada}%`;

            const safeNomeCol = `
                LOWER(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(nome,
                    'Á','A'), 'À','A'), 'Â','A'), 'Ã','A'),
                    'É','E'), 'Ê','E'), 'Í','I'),
                    'Ó','O'), 'Ô','O'), 'Õ','O'),
                    'Ú','U'), 'Ç','C'),
                    'á','a'), 'à','a'), 'â','a'), 'ã','a'),
                    'é','e'), 'ê','e'), 'í','i'),
                    'ó','o'), 'ô','o'), 'õ','o'),
                    'ú','u'), 'ç','c')
                )
            `;

            // Busca Tokenizada (múltiplas palavras)
            const tokens = buscaNormalizada.split(" ").filter(t => t.length > 0);
            const nomeConditions = tokens.map(() => `${safeNomeCol} LIKE ?`).join(" AND ");
            const nomeBindings = tokens.map(t => `%${t}%`);
            
            const matriculaParam = `%${buscaNormalizada}%`;
            const orderMatriculaExata = busca.trim();
            const orderMatriculaLike = `${busca.trim()}%`;
            const orderNomeLike = `${buscaNormalizada}%`;

            const queryBindings = [
                ...nomeBindings,
                matriculaParam,
                orderMatriculaExata,
                orderMatriculaLike,
                orderNomeLike
            ];

            result = db.exec(`
                SELECT id, nome, matricula, cargo, fornecedor
                FROM equipe_vendas
                WHERE ativo = 1
                  AND ((${nomeConditions}) OR matricula LIKE ?)
                ORDER BY 
                    CASE 
                        WHEN matricula = ? THEN 0
                        WHEN matricula LIKE ? THEN 1
                        WHEN ${safeNomeCol} LIKE ? THEN 2
                        ELSE 3
                    END,
                    nome ASC
                LIMIT 20
            `, queryBindings);

            if (result.length === 0 || result[0].values.length === 0) {
                res.json([]);
                return;
            }
        } else {
            result = db.exec(`
                SELECT id, nome, matricula, cargo, fornecedor
                FROM equipe_vendas
                WHERE ativo = 1
                ORDER BY nome
                LIMIT 20
            `);
        }

        if (result.length === 0 || result[0].values.length === 0) {
            res.json([]);
            return;
        }

        const equipe = result[0].values.map((row) => ({
            id: row[0],
            nome: row[1],
            matricula: row[2],
            cargo: row[3],
            fornecedor: row[4],
        }));

        res.json(equipe);
    } catch (error) {
        console.error("Erro ao buscar equipe:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

import { Router, Request, Response } from "express";
import { getDb } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/cooperados?busca=João
 * Busca cooperados por nome (com LIKE para autocomplete).
 * Retorna até 20 resultados com dados da filial.
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
                    REPLACE(REPLACE(REPLACE(REPLACE(c.nome,
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

            // Busca performática via SQL com limit fixo (usando REPLACE em vez de normalize_str)
            result = db.exec(`
                SELECT c.id, c.nome, c.matricula, f.id as filial_id, f.nome as filial_nome, f.cidade
                FROM cooperados c
                JOIN filiais f ON c.filial_id = f.id
                WHERE ${safeNomeCol} LIKE ? OR c.matricula LIKE ?
                ORDER BY 
                    CASE 
                        WHEN c.matricula = ? THEN 0
                        WHEN c.matricula LIKE ? THEN 1
                        WHEN ${safeNomeCol} LIKE ? THEN 2
                        ELSE 3
                    END,
                    c.nome ASC
                LIMIT 20
            `, [buscaParam, buscaParam, busca.trim(), `${busca.trim()}%`, `${buscaNormalizada}%`]);

            if (result.length === 0 || result[0].values.length === 0) {
                console.log(`🔍 [BUSCA] Nenhum resultado para "${busca}"`);
                res.json([]);
                return;
            }
        } else {
            result = db.exec(`
                SELECT c.id, c.nome, c.matricula, f.id as filial_id, f.nome as filial_nome, f.cidade
                FROM cooperados c
                JOIN filiais f ON c.filial_id = f.id
                ORDER BY c.nome
                LIMIT 20
            `);
        }

        if (result.length === 0 || result[0].values.length === 0) {
            res.json([]);
            return;
        }

        const cooperados = result[0].values.map((row: any) => ({
            id: row[0],
            nome: row[1],
            matricula: row[2],
            filial: {
                id: row[3],
                nome: row[4],
                cidade: row[5],
            },
        }));

        res.json(cooperados);
    } catch (error) {
        console.error("Erro ao buscar cooperados:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * GET /api/cooperados/:id/propriedades
 * Lista propriedades de um cooperado específico (para uso futuro).
 */
router.get("/:id/propriedades", authMiddleware, (req: Request, res: Response): void => {
    try {
        const cooperadoId = parseInt(req.params.id as string);
        const db = getDb();

        const result = db.exec(
            "SELECT id, nome, endereco FROM propriedades WHERE cooperado_id = ? ORDER BY nome",
            [cooperadoId]
        );

        if (result.length === 0) {
            res.json([]);
            return;
        }

        const propriedades = result[0].values.map((row) => ({
            id: row[0],
            nome: row[1],
            endereco: row[2],
        }));

        res.json(propriedades);
    } catch (error) {
        console.error("Erro ao buscar propriedades:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

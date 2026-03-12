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
        const busca = req.query.busca as string || "";
        const db = getDb();

        let result;
        if (busca.trim()) {
            // A busca do usuário, sem acentos e em minúsculo
            const buscaNorm = busca.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Buscamos um número maior de cooperados cru (sem WHERE no nome, pois Node JS lida melhor com acentos UTF8).
            const rawExec = db.exec(`
                SELECT c.id, c.nome, c.matricula, f.id as filial_id, f.nome as filial_nome, f.cidade
                FROM cooperados c
                JOIN filiais f ON c.filial_id = f.id
            `);

            if (rawExec.length === 0) {
                res.json([]);
                return;
            }

            // Mapeando e filtrando no Node JS nativo
            const todos = rawExec[0].values.map((row) => ({
                id: row[0],
                nome: row[1] as string,
                matricula: row[2] as string,
                filial: {
                    id: row[3],
                    nome: row[4],
                    cidade: row[5],
                },
            }));

            // Filtra manualmente
            const filtrados = todos.filter((coop) => {
                const nomeNorm = String(coop.nome).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return nomeNorm.includes(buscaNorm) || String(coop.matricula).includes(buscaNorm);
            });

            // Ordena os resultados para dar prioridade à matrícula exata > matrícula parcial > nome
            filtrados.sort((a, b) => {
                const aNomeNorm = String(a.nome).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const bNomeNorm = String(b.nome).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                let scoreA = 3;
                if (String(a.matricula) === buscaNorm) scoreA = 0;
                else if (String(a.matricula).startsWith(buscaNorm)) scoreA = 1;
                else if (aNomeNorm.startsWith(buscaNorm)) scoreA = 2;

                let scoreB = 3;
                if (String(b.matricula) === buscaNorm) scoreB = 0;
                else if (String(b.matricula).startsWith(buscaNorm)) scoreB = 1;
                else if (bNomeNorm.startsWith(buscaNorm)) scoreB = 2;

                if (scoreA !== scoreB) return scoreA - scoreB;
                return aNomeNorm.localeCompare(bNomeNorm);
            });

            // Retorna o resultado já paginado para a interface nao travar
            res.json(filtrados.slice(0, 20));
            return;

        } else {
            result = db.exec(`
                SELECT c.id, c.nome, c.matricula, f.id as filial_id, f.nome as filial_nome, f.cidade
                FROM cooperados c
                JOIN filiais f ON c.filial_id = f.id
                ORDER BY c.nome
                LIMIT 20
            `);
        }

        if (result.length === 0) {
            res.json([]);
            return;
        }

        const cooperados = result[0].values.map((row) => ({
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
        const cooperadoId = parseInt(req.params.id);
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

import { Router, Request, Response } from "express";
import { getDb } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/relatorios/visitas?mes=2026-02&user_id=1
 * GET /api/relatorios/visitas?semana=2026-02-17&user_id=1
 *
 * Relatório completo de visitas com dados do TDM, cooperado e filial.
 * Se user_id não fornecido, usa o usuário logado.
 */
router.get("/visitas", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const mes = req.query.mes as string;
        const semana = req.query.semana as string;
        const userId = req.query.user_id
            ? parseInt(req.query.user_id as string)
            : req.userId!;

        let dateFilter: string;
        let dateParam: string;

        if (mes) {
            // Filtro por mês: "2026-02" → LIKE "2026-02%"
            dateFilter = "v.data_visita LIKE ?";
            dateParam = `${mes}%`;
        } else if (semana) {
            // Filtro por semana: data inicial da semana
            dateFilter = "v.data_visita BETWEEN ? AND date(?, '+6 days')";
            dateParam = semana;
        } else {
            res.status(400).json({ error: "Informe 'mes' (ex: 2026-02) ou 'semana' (ex: 2026-02-17)" });
            return;
        }

        let query: string;
        let params: (string | number)[];

        if (semana) {
            query = `
        SELECT
          v.id,
          v.data_visita,
          v.resultado,
          v.doencas_pragas,
          v.negociacao_dados,
          v.extra,
          v.created_at,
          u.id as tdm_id,
          u.nome as tdm_nome,
          u.matricula as tdm_matricula,
          u.celular as tdm_celular,
          c.id as cooperado_id,
          c.nome as cooperado_nome,
          c.matricula as cooperado_matricula,
          f.id as filial_id,
          f.nome as filial_nome,
          f.cidade as filial_cidade
        FROM visitas v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN cooperados c ON v.cooperado_id = c.id
        LEFT JOIN filiais f ON c.filial_id = f.id
        WHERE v.user_id = ? AND v.data_visita BETWEEN ? AND date(?, '+6 days')
        ORDER BY v.data_visita, v.created_at
      `;
            params = [userId, dateParam, dateParam];
        } else {
            query = `
        SELECT
          v.id,
          v.data_visita,
          v.resultado,
          v.doencas_pragas,
          v.negociacao_dados,
          v.extra,
          v.created_at,
          u.id as tdm_id,
          u.nome as tdm_nome,
          u.matricula as tdm_matricula,
          u.celular as tdm_celular,
          c.id as cooperado_id,
          c.nome as cooperado_nome,
          c.matricula as cooperado_matricula,
          f.id as filial_id,
          f.nome as filial_nome,
          f.cidade as filial_cidade
        FROM visitas v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN cooperados c ON v.cooperado_id = c.id
        LEFT JOIN filiais f ON c.filial_id = f.id
        WHERE v.user_id = ? AND ${dateFilter}
        ORDER BY v.data_visita, v.created_at
      `;
            params = [userId, dateParam];
        }

        const result = db.exec(query, params);

        if (result.length === 0) {
            res.json({ visitas: [], resumo: { total: 0 } });
            return;
        }

        const visitas = result[0].values.map((row) => ({
            id: row[0],
            data_visita: row[1],
            resultado: row[2],
            doencas_pragas: JSON.parse(row[3] as string || "[]"),
            negociacao_dados: row[4] ? JSON.parse(row[4] as string) : null,
            extra: row[5] === 1,
            created_at: row[6],
            tdm: {
                id: row[7],
                nome: row[8],
                matricula: row[9],
                celular: row[10],
            },
            cooperado: row[11]
                ? {
                    id: row[11],
                    nome: row[12],
                    matricula: row[13],
                }
                : null,
            filial: row[14]
                ? {
                    id: row[14],
                    nome: row[15],
                    cidade: row[16],
                }
                : null,
        }));

        // Resumo
        const total = visitas.length;
        const realizadas = visitas.filter((v) => v.resultado !== "Visita Não Executada").length;
        const naoExecutadas = total - realizadas;
        const negociacoes = visitas.filter((v) => v.resultado === "Negociação").length;
        const avaliacoes = visitas.filter((v) => v.resultado === "Avaliação do Campo Experimental").length;
        const cooperadosUnicos = new Set(visitas.filter((v) => v.cooperado).map((v) => v.cooperado!.id)).size;

        res.json({
            visitas,
            resumo: {
                total,
                realizadas,
                nao_executadas: naoExecutadas,
                negociacoes,
                avaliacoes,
                cooperados_visitados: cooperadosUnicos,
            },
        });
    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * GET /api/relatorios/resumo-mensal?mes=2026-02
 * Resumo rápido do mês: contadores por dia (para calendário).
 */
router.get("/resumo-mensal", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const mes = req.query.mes as string;

        if (!mes) {
            res.status(400).json({ error: "Parâmetro 'mes' é obrigatório (ex: 2026-02)" });
            return;
        }

        const resultVisitas = db.exec(
            `SELECT data_visita, COUNT(*) as total,
              COUNT(*) as realizadas
       FROM visitas
       WHERE user_id = ? AND data_visita LIKE ?
       GROUP BY data_visita`,
            [userId, `${mes}%`]
        );

        const resultPlanejamento = db.exec(
            `SELECT p.data_planejada, COUNT(p.id) as total_planejadas
       FROM planejamento p
       LEFT JOIN visitas v ON p.id = v.planejamento_id
       WHERE p.user_id = ? AND p.data_planejada LIKE ? AND v.id IS NULL
       GROUP BY p.data_planejada`,
            [userId, `${mes}%`]
        );

        const diasMap: Record<string, { total: number; realizadas: number }> = {};

        if (resultVisitas.length > 0) {
            resultVisitas[0].values.forEach((row) => {
                diasMap[row[0] as string] = {
                    total: row[1] as number,
                    realizadas: row[2] as number,
                };
            });
        }

        if (resultPlanejamento.length > 0) {
            resultPlanejamento[0].values.forEach((row) => {
                const data = row[0] as string;
                if (!diasMap[data]) {
                    diasMap[data] = { total: 0, realizadas: 0 };
                }
                diasMap[data].total += row[1] as number;
            });
        }

        res.json(diasMap);
    } catch (error) {
        console.error("Erro ao gerar resumo mensal:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

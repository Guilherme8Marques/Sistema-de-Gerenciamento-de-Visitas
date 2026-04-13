import { Router, Request, Response } from "express";
import { getDb } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/dashboard/equipes?inicio=2026-02-23&fim=2026-02-27
 * Lista as equipes (fornecedores) com dados no período.
 */
router.get(
    "/equipes",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            const result = db.exec(
                `SELECT DISTINCT fornecedor
                 FROM users
                 WHERE fornecedor IS NOT NULL AND fornecedor != ''
                 ORDER BY fornecedor`
            );

            if (result.length === 0) {
                res.json([]);
                return;
            }

            const equipes = result[0].values.map((row) => row[0]);
            res.json(equipes);
        } catch (error) {
            console.error("Erro ao listar equipes:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

/**
 * GET /api/dashboard/colaboradores?inicio=2026-02-23&fim=2026-02-27
 * Lista colaboradores ativos no período (com visitas ou planejamento).
 */
router.get(
    "/colaboradores",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;
            const equipe = req.query.equipe as string | undefined;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            const equipeFilter = equipe ? " AND u.fornecedor = ?" : "";
            const paramEq = equipe ? [equipe] : [];

            const result = db.exec(
                `SELECT DISTINCT u.id, u.nome, u.matricula
                 FROM users u
                 WHERE u.id IN (
                     SELECT user_id FROM visitas WHERE data_visita >= ? AND data_visita <= ?
                     UNION
                     SELECT user_id FROM planejamento WHERE data_planejada >= ? AND data_planejada <= ?
                 )${equipeFilter}
                 ORDER BY u.nome`,
                [inicio, fim, inicio, fim, ...paramEq]
            );

            if (result.length === 0) {
                res.json([]);
                return;
            }

            const colaboradores = result[0].values.map((row) => ({
                id: row[0],
                nome: row[1],
                matricula: row[2],
            }));

            res.json(colaboradores);
        } catch (error) {
            console.error("Erro ao listar colaboradores:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

/**
 * GET /api/dashboard/resumo?inicio=2026-02-23&fim=2026-02-27&colaborador_id=1
 * KPIs agregados de toda a equipe num período (semana).
 * colaborador_id é opcional — se informado, filtra por colaborador.
 */
router.get(
    "/resumo",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;
            const colaboradorId = req.query.colaborador_id as string | undefined;
            const equipe = req.query.equipe as string | undefined;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            let userFilter = colaboradorId ? " AND user_id = ?" : "";
            let userParam: any[] = colaboradorId ? [parseInt(colaboradorId, 10)] : [];

            if (equipe) {
                userFilter += " AND user_id IN (SELECT id FROM users WHERE fornecedor = ?)";
                userParam.push(equipe);
            }

            // Total de visitas planejadas no período
            const planejResult = db.exec(
                `SELECT COUNT(*) FROM planejamento WHERE data_planejada >= ? AND data_planejada <= ?${userFilter}`,
                [inicio, fim, ...userParam]
            );
            const totalPlanejadas = planejResult.length > 0 ? (planejResult[0].values[0][0] as number) : 0;

            // Total de visitas registradas no período
            const visitasResult = db.exec(
                `SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN resultado != 'Visita Não Executada' THEN 1 ELSE 0 END) as realizadas,
                    SUM(CASE WHEN resultado = 'Negociação' THEN 1 ELSE 0 END) as negociacoes,
                    SUM(CASE WHEN resultado = 'Avaliação do Campo Experimental' THEN 1 ELSE 0 END) as avaliacoes,
                    SUM(CASE WHEN resultado = 'Atendimento' THEN 1 ELSE 0 END) as atendimentos
                FROM visitas WHERE data_visita >= ? AND data_visita <= ?${userFilter}`,
                [inicio, fim, ...userParam]
            );

            let total = 0, realizadas = 0, negociacoes = 0, avaliacoes = 0, atendimentos = 0;
            if (visitasResult.length > 0 && visitasResult[0].values.length > 0) {
                const row = visitasResult[0].values[0];
                total = (row[0] as number) || 0;
                realizadas = (row[1] as number) || 0;
                negociacoes = (row[2] as number) || 0;
                avaliacoes = (row[3] as number) || 0;
                atendimentos = (row[4] as number) || 0;
            }

            // Consultores ativos no período (com visitas OU planejamento)
            const consultoresResult = db.exec(
                `SELECT COUNT(*) FROM (
                    SELECT user_id FROM visitas WHERE data_visita >= ? AND data_visita <= ?${userFilter}
                    UNION
                    SELECT user_id FROM planejamento WHERE data_planejada >= ? AND data_planejada <= ?${userFilter}
                )`,
                [inicio, fim, ...userParam, inicio, fim, ...userParam]
            );
            const consultoresAtivos = consultoresResult.length > 0
                ? (consultoresResult[0].values[0][0] as number) : 0;

            const pctConclusao = totalPlanejadas > 0
                ? Math.round((realizadas / totalPlanejadas) * 100) : 0;

            res.json({
                total_planejadas: totalPlanejadas,
                total_registradas: total,
                total_realizadas: realizadas,
                pct_conclusao: pctConclusao,
                negociacoes,
                avaliacoes,
                atendimentos,
                consultores_ativos: consultoresAtivos,
            });
        } catch (error) {
            console.error("Erro ao gerar resumo do dashboard:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

/**
 * GET /api/dashboard/ranking?inicio=2026-02-23&fim=2026-02-27&colaborador_id=1
 * Top consultores por visitas realizadas no período.
 * colaborador_id é opcional — se informado, filtra por colaborador.
 */
router.get(
    "/ranking",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;
            const colaboradorId = req.query.colaborador_id as string | undefined;
            const equipe = req.query.equipe as string | undefined;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            const userFilterV = colaboradorId ? " AND v.user_id = ?" : "";
            const userFilterP = colaboradorId ? " AND user_id = ?" : "";
            let userFilterU = colaboradorId ? " AND u.id = ?" : "";
            let userParam: any[] = colaboradorId ? [parseInt(colaboradorId, 10)] : [];

            if (equipe) {
                userFilterU += " AND u.fornecedor = ?";
                userParam.push(equipe);
            }

            // Ranking: consultores com visitas OU apenas planejamento
            const result = db.exec(
                `SELECT
                    u.id,
                    u.nome,
                    u.matricula,
                    COALESCE(v_stats.total_visitas, 0) as total_visitas,
                    COALESCE(v_stats.realizadas, 0) as realizadas,
                    COALESCE(v_stats.negociacoes, 0) as negociacoes,
                    COALESCE(p_stats.planejadas, 0) as planejadas,
                    u.fornecedor
                FROM users u
                LEFT JOIN (
                    SELECT
                        user_id,
                        COUNT(*) as total_visitas,
                        SUM(CASE WHEN resultado != 'Visita Não Executada' THEN 1 ELSE 0 END) as realizadas,
                        SUM(CASE WHEN resultado = 'Negociação' THEN 1 ELSE 0 END) as negociacoes
                    FROM visitas
                    WHERE data_visita >= ? AND data_visita <= ?
                    GROUP BY user_id
                ) v_stats ON u.id = v_stats.user_id
                LEFT JOIN (
                    SELECT
                        user_id,
                        COUNT(*) as planejadas
                    FROM planejamento
                    WHERE data_planejada >= ? AND data_planejada <= ?
                    GROUP BY user_id
                ) p_stats ON u.id = p_stats.user_id
                WHERE (v_stats.user_id IS NOT NULL OR p_stats.user_id IS NOT NULL)${userFilterU}
                ORDER BY realizadas DESC, planejadas DESC
                LIMIT 20`,
                [inicio, fim, inicio, fim, ...userParam]
            );

            if (result.length === 0) {
                res.json([]);
                return;
            }

            const ranking = result[0].values.map((row, index) => {
                const planejadas = (row[6] as number) || 0;
                const realizadas = (row[4] as number) || 0;
                return {
                    posicao: index + 1,
                    id: row[0],
                    nome: row[1],
                    matricula: row[2],
                    total_visitas: row[3],
                    realizadas,
                    negociacoes: row[5],
                    planejadas,
                    pct_conclusao: planejadas > 0
                        ? Math.round((realizadas / planejadas) * 100) : 0,
                    fornecedor: row[7] || "-",
                };
            });

            res.json(ranking);
        } catch (error) {
            console.error("Erro ao gerar ranking:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

/**
 * GET /api/dashboard/historico?inicio=2026-02-23&fim=2026-02-27&colaborador_id=1
 * Lista detalhada de visitas no período com valores de negociação.
 * colaborador_id é opcional — se informado, filtra por colaborador.
 */
router.get(
    "/historico",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;
            const colaboradorId = req.query.colaborador_id as string | undefined;
            const equipe = req.query.equipe as string | undefined;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            let userFilter = colaboradorId ? " AND v.user_id = ?" : "";
            let userParam: any[] = colaboradorId ? [parseInt(colaboradorId, 10)] : [];

            if (equipe) {
                userFilter += " AND u.fornecedor = ?";
                userParam.push(equipe);
            }

            const result = db.exec(
                `SELECT 
                    v.id,
                    v.data_visita,
                    v.resultado,
                    u.nome as nome_consultor,
                    c.nome as nome_cooperado,
                    v.negociacao_dados,
                    p.evento_nome,
                    p.tipo as plan_tipo,
                    u.matricula as tdm_matricula,
                    u.fornecedor
                 FROM visitas v
                 JOIN users u ON v.user_id = u.id
                 LEFT JOIN cooperados c ON v.cooperado_id = c.id
                 LEFT JOIN planejamento p ON v.planejamento_id = p.id
                 WHERE v.data_visita >= ? AND v.data_visita <= ?
                 AND v.resultado != 'Visita Não Executada'${userFilter}
                 ORDER BY v.data_visita DESC, v.id DESC`,
                [inicio, fim, ...userParam]
            );

            if (result.length === 0) {
                res.json([]);
                return;
            }

            const historico = result[0].values.map((row) => {
                const negociacao = row[5] ? JSON.parse(row[5] as string) : null;
                const cooperadoNome = row[4] as string | null;
                const eventoNome = row[6] as string | null;
                const planTipo = row[7] as string | null;

                // If no cooperado but has an event, show event name
                let nomeCooperado = cooperadoNome || 'N/A';
                if (!cooperadoNome && planTipo === 'evento' && eventoNome) {
                    nomeCooperado = `📅 ${eventoNome}`;
                }

                return {
                    id: row[0],
                    data_visita: row[1],
                    resultado: row[2],
                    nome_consultor: row[3],
                    nome_cooperado: nomeCooperado,
                    tipo_moeda: negociacao?.tipoMoeda || '-',
                    valor: negociacao?.valor || '-',
                    canal: negociacao?.canal || '-',
                    tdm_matricula: row[8] || '-',
                    fornecedor: row[9] || '-'
                };
            });

            res.json(historico);
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

/**
 * GET /api/dashboard/planejamento-semanal?inicio=2026-02-23&fim=2026-02-27&colaborador_id=1
 * Retorna todo o planejamento do período agrupado por consultor e dia.
 * colaborador_id é opcional — se informado, filtra por colaborador.
 * Formato: array de consultores, cada um com array de planejamentos por data.
 */
router.get(
    "/planejamento-semanal",
    authMiddleware,
    (req: Request, res: Response): void => {
        try {
            const db = getDb();
            const inicio = req.query.inicio as string;
            const fim = req.query.fim as string;
            const colaboradorId = req.query.colaborador_id as string | undefined;
            const equipe = req.query.equipe as string | undefined;

            if (!inicio || !fim) {
                res.status(400).json({ error: "Parâmetros 'inicio' e 'fim' são obrigatórios" });
                return;
            }

            let userFilter = colaboradorId ? " AND p.user_id = ?" : "";
            let userParam: any[] = colaboradorId ? [parseInt(colaboradorId, 10)] : [];

            if (equipe) {
                userFilter += " AND u.fornecedor = ?";
                userParam.push(equipe);
            }

            // Buscar todos os planejamentos do período com dados do consultor e cooperado
            const result = db.exec(
                `SELECT
                    p.id,
                    p.data_planejada,
                    p.tipo,
                    p.evento_nome,
                    u.id as user_id,
                    u.nome as user_nome,
                    u.matricula as user_matricula,
                    c.nome as cooperado_nome,
                    c.matricula as cooperado_matricula,
                    f.nome as filial_nome,
                    u.fornecedor
                FROM planejamento p
                JOIN users u ON p.user_id = u.id
                LEFT JOIN cooperados c ON p.cooperado_id = c.id
                LEFT JOIN filiais f ON c.filial_id = f.id
                WHERE p.data_planejada >= ? AND p.data_planejada <= ?${userFilter}
                ORDER BY u.nome, p.data_planejada`,
                [inicio, fim, ...userParam]
            );

            if (result.length === 0) {
                res.json([]);
                return;
            }

            // Agrupar por consultor
            const consultoresMap = new Map<number, {
                id: number;
                nome: string;
                matricula: string;
                fornecedor: string;
                planejamentos: {
                    date: string;
                    empresas: string[];
                }[];
            }>();

            for (const row of result[0].values) {
                const userId = row[4] as number;
                const dataPlanejada = row[1] as string;
                const tipo = row[2] as string;
                const eventoNome = row[3] as string | null;
                const cooperadoNome = row[7] as string | null;
                const cooperadoMat = row[8] as string | null;
                const filialNome = row[9] as string | null;

                let descricao = "";
                if (tipo === "visita" && cooperadoNome) {
                    descricao = `${cooperadoMat} - ${cooperadoNome}`;
                    if (filialNome) descricao += ` (${filialNome})`;
                } else if (tipo === "evento" && eventoNome) {
                    descricao = `📅 ${eventoNome}`;
                } else {
                    descricao = tipo === "visita" ? "Visita" : "Evento";
                }

                if (!consultoresMap.has(userId)) {
                    consultoresMap.set(userId, {
                        id: userId,
                        nome: row[5] as string,
                        matricula: row[6] as string,
                        fornecedor: (row[10] as string) || "-",
                        planejamentos: [],
                    });
                }

                const consultor = consultoresMap.get(userId)!;
                let diaSet = consultor.planejamentos.find(p => p.date === dataPlanejada);
                if (!diaSet) {
                    diaSet = { date: dataPlanejada, empresas: [] };
                    consultor.planejamentos.push(diaSet);
                }
                diaSet.empresas.push(descricao);
            }

            res.json(Array.from(consultoresMap.values()));
        } catch (error) {
            console.error("Erro ao gerar planejamento semanal:", error);
            res.status(500).json({ error: "Erro interno do servidor" });
        }
    }
);

export default router;

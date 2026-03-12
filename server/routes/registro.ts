import { Router, Request, Response } from "express";
import { getDb, saveDatabase } from "../database.js";
import { authMiddleware } from "../middleware/auth.js";
import { RegistroBody } from "../types.js";

const router = Router();

/**
 * GET /api/registro?data=2026-02-24
 * Lista visitas registradas do usuário para uma data específica.
 * Se não houver visitas, retorna as atividades planejadas para o dia.
 */
router.get("/", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const data = req.query.data as string;

        if (!data) {
            res.status(400).json({ error: "Parâmetro 'data' é obrigatório" });
            return;
        }

        // Buscar visitas já registradas
        const visitasResult = db.exec(
            `SELECT v.id, v.planejamento_id, v.cooperado_id, v.data_visita,
              v.resultado, v.doencas_pragas, v.negociacao_dados, v.extra,
              c.nome as cooperado_nome, c.matricula as cooperado_matricula,
              f.id as filial_id, f.nome as filial_nome
       FROM visitas v
       LEFT JOIN cooperados c ON v.cooperado_id = c.id
       LEFT JOIN filiais f ON c.filial_id = f.id
       WHERE v.user_id = ? AND v.data_visita = ?
       ORDER BY v.created_at`,
            [userId, data]
        );

        // Buscar planejamento do dia (para saber quais ainda não foram registradas)
        const planejamento = db.exec(
            `SELECT p.id, p.tipo, p.cooperado_id, p.evento_nome,
              c.nome as cooperado_nome, c.matricula as cooperado_matricula,
              f.id as filial_id, f.nome as filial_nome
       FROM planejamento p
       LEFT JOIN cooperados c ON p.cooperado_id = c.id
       LEFT JOIN filiais f ON c.filial_id = f.id
       WHERE p.user_id = ? AND p.data_planejada = ?
       ORDER BY p.created_at`,
            [userId, data]
        );

        const visitas = visitasResult.length > 0
            ? visitasResult[0].values.map((row) => ({
                id: row[0],
                planejamento_id: row[1],
                cooperado_id: row[2],
                data_visita: row[3],
                resultado: row[4],
                doencas_pragas: JSON.parse(row[5] as string || "[]"),
                negociacao_dados: row[6] ? JSON.parse(row[6] as string) : null,
                extra: row[7] === 1,
                cooperado_nome: row[8],
                cooperado_matricula: row[9],
                filial_id: row[10],
                filial_nome: row[11],
                registrado: true,
            }))
            : [];

        const planejadas = planejamento.length > 0
            ? planejamento[0].values.map((row) => ({
                planejamento_id: row[0],
                tipo: row[1],
                cooperado_id: row[2],
                evento_nome: row[3],
                cooperado_nome: row[4],
                cooperado_matricula: row[5],
                filial_id: row[6],
                filial_nome: row[7],
            }))
            : [];

        res.json({ visitas, planejadas });
    } catch (error) {
        console.error("Erro ao buscar registros:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

/**
 * POST /api/registro
 * Registra uma visita individual.
 */
router.post("/", authMiddleware, (req: Request, res: Response): void => {
    try {
        const db = getDb();
        const userId = req.userId!;
        const body = req.body as RegistroBody;

        if (!body.data_visita || !body.resultado) {
            res.status(400).json({ error: "data_visita e resultado são obrigatórios" });
            return;
        }

        const doencasPragas = JSON.stringify(body.doencas_pragas || []);
        const negociacaoDados = body.negociacao_dados ? JSON.stringify(body.negociacao_dados) : null;

        db.run(
            `INSERT INTO visitas (user_id, planejamento_id, cooperado_id, data_visita,
              resultado, doencas_pragas, negociacao_dados, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                body.planejamento_id || null,
                body.cooperado_id || null,
                body.data_visita,
                body.resultado,
                doencasPragas,
                negociacaoDados,
                body.extra ? 1 : 0,
            ]
        );

        saveDatabase();

        const result = db.exec("SELECT last_insert_rowid()");
        const id = result[0].values[0][0];

        res.status(201).json({ id, message: "Visita registrada com sucesso" });
    } catch (error) {
        console.error("Erro ao registrar visita:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

export default router;

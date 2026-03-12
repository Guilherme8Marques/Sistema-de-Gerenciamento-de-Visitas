import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JwtPayload } from "../types.js";
import { getDb } from "../database.js";

const JWT_SECRET = process.env.JWT_SECRET || "cooxupe-tdm-secret-2026";

/**
 * Estende o Request do Express para incluir o userId autenticado.
 */
declare global {
    namespace Express {
        interface Request {
            userId?: number;
            userCelular?: string;
        }
    }
}

/**
 * Middleware de autenticação JWT para proteger as rotas.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token não fornecido" });
        return;
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        // Ensure the user actually still exists in the database
        const db = getDb();
        const userExists = db.exec("SELECT id FROM users WHERE id = ?", [decoded.userId]);

        if (userExists.length === 0 || userExists[0].values.length === 0) {
            res.status(401).json({ error: "Usuário não encontrado na base de dados. Faça login novamente." });
            return;
        }

        req.userId = decoded.userId;
        req.userCelular = decoded.celular;
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido ou expirado" });
    }
}

/**
 * Gera um JWT para o usuário autenticado.
 */
export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

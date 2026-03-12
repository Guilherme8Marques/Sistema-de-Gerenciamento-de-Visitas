import { getDb, saveDatabase, initDatabase } from './server/database.js';
import bcrypt from 'bcryptjs';

async function run() {
    await initDatabase();
    const db = getDb();

    const senhaHash = await bcrypt.hash("2025", 10);
    const celular = "19999420794";
    const nome = "Admin Master";
    const matricula = "admin-master";

    // Verificar se o usuário já existe
    const existing = db.prepare("SELECT id FROM users WHERE celular = ?").get([celular]);
    if (existing) {
        db.run("UPDATE users SET senha_hash = ?, role = 'admin' WHERE celular = ?", [senhaHash, celular]);
    } else {
        db.run(
            `INSERT INTO users (celular, senha_hash, nome, matricula, role, created_at) 
             VALUES (?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP)`,
            [celular, senhaHash, nome, matricula]
        );
    }

    // Garantir que está na lista de autorizados
    db.run(
        "INSERT OR IGNORE INTO celulares_autorizados (numero, ativo, nome, matricula) VALUES (?, 1, ?, ?)",
        [celular, nome, matricula]
    );

    saveDatabase();
    console.log("🔓 Usuario 'ADMIN' (Cel: 19999420794 / Senha: 2025) restaurado com sucesso no DB local!");
}

run().catch(console.error);

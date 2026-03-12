import { initDatabase, getDb, saveDatabase } from './server/database.js';
import bcrypt from 'bcryptjs';

async function run() {
    await initDatabase();
    const db = getDb();

    const celular = '3597786623';
    const senha_hash = await bcrypt.hash('Gui82534', 10);

    // Clean up if exists
    db.run("DELETE FROM users WHERE celular = '3597786623'");

    db.run(
        "INSERT INTO users (nome, matricula, celular, senha_hash, role) VALUES (?, ?, ?, ?, ?)",
        ['Guilherme Marques', 'Mestre', celular, senha_hash, 'gerente']
    );

    saveDatabase();
    console.log('User created');
}
run();

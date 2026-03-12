import { initDatabase, getDb, saveDatabase } from '../server/database.js';

async function run() {
    console.log("🧹 Iniciando limpeza geral do banco de dados...");
    await initDatabase();
    const db = getDb();

    db.run("DELETE FROM users");
    db.run("DELETE FROM celulares_autorizados");
    db.run("DELETE FROM visitas");
    db.run("DELETE FROM planejamento");
    db.run("DELETE FROM propriedades");
    db.run("DELETE FROM cooperados");
    db.run("DELETE FROM filiais");

    saveDatabase();
    console.log("✅ Banco de dados completamente limpo!");
}

run().catch(console.error);

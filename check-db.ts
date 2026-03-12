import { initDatabase, getDb } from './server/database.js';

async function check() {
    await initDatabase();
    const db = getDb();
    const users = db.exec("SELECT id, celular, nome, matricula, role FROM users");
    const autho = db.exec("SELECT * FROM celulares_autorizados");
    console.log("USERS:", JSON.stringify(users, null, 2));
    console.log("AUTHO:", JSON.stringify(autho, null, 2));
}

check().catch(console.error);

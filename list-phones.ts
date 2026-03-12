import { initDatabase, getDb } from './server/database.js';
async function run() {
    await initDatabase();
    const db = getDb();
    const res = db.exec("SELECT numero FROM celulares_autorizados LIMIT 5");
    console.log(JSON.stringify(res, null, 2));
}
run();

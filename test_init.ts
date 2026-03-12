import { initDatabase, getDb, saveDatabase } from "./server/database.js";
import { sincronizarUsuariosExcel } from "./server/sync-excel.js";
import initSqlJs from "sql.js";
import fs from "fs";

async function run() {
    let data = fs.readFileSync('server/database.db');
    let SQL = await initSqlJs();
    let oldDb = new SQL.Database(data);

    console.log("== BEFORE INIT ==");
    console.log(JSON.stringify(oldDb.exec("SELECT count(*) FROM users"), null, 2));

    console.log("== RUNNING INIT ==");
    await initDatabase();

    console.log("== DB AFTER INIT ==");
    const db = getDb();
    console.log(JSON.stringify(db.exec("SELECT count(*) FROM users"), null, 2));

    console.log("== RUNNING SYNC EXCEL ==");
    sincronizarUsuariosExcel();

    console.log("== DB AFTER SYNC EXCEL ==");
    console.log(JSON.stringify(db.exec("SELECT count(*) FROM users"), null, 2));
}

run().catch(console.error);

import fs from 'fs';
import initSqlJs from 'sql.js';
import path from 'path';

async function check() {
    const SQL = await initSqlJs();
    const dbPath = './server/database.db';
    if (!fs.existsSync(dbPath)) {
        console.log("Banco não encontrado em " + dbPath);
        return;
    }
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    console.log("--- VISITAS ---");
    const v = db.exec("SELECT COUNT(*) FROM visitas");
    console.log("Total: " + JSON.stringify(v[0].values[0]));

    console.log("\n--- ÚLTIMAS 5 VISITAS ---");
    const v5 = db.exec("SELECT id, data_visita, user_id FROM visitas ORDER BY data_visita DESC LIMIT 5");
    if (v5.length > 0) console.log(JSON.stringify(v5[0].values, null, 2));

    console.log("\n--- ÚLTIMOS 5 PLANEJAMENTOS ---");
    const p5 = db.exec("SELECT id, data_planejada, user_id FROM planejamento ORDER BY data_planejada DESC LIMIT 5");
    if (p5.length > 0) console.log(JSON.stringify(p5[0].values, null, 2));
}

check();

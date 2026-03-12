import { getDb, initDatabase } from "./server/database.js";

async function checkData() {
    try {
        const db = await initDatabase();

        console.log("--- ÚLTIMAS 5 VISITAS ---");
        const v = db.exec("SELECT id, data_visita, user_id FROM visitas ORDER BY data_visita DESC LIMIT 5");
        console.log(JSON.stringify(v, null, 2));

        console.log("\n--- ÚLTIMOS 5 PLANEJAMENTOS ---");
        const p = db.exec("SELECT id, data_planejada, user_id FROM planejamento ORDER BY data_planejada DESC LIMIT 5");
        console.log(JSON.stringify(p, null, 2));

        console.log("\n--- TOTAL DE REGISTROS ---");
        const t = db.exec("SELECT (SELECT COUNT(*) FROM visitas) as v, (SELECT COUNT(*) FROM planejamento) as p");
        console.log(JSON.stringify(t, null, 2));

    } catch (e) {
        console.error(e);
    }
}

checkData();

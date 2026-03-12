import { getDb, initDatabase } from "./server/database.js";

async function testApi() {
    try {
        const db = await initDatabase();
        const inicio = "2026-03-01";
        const fim = "2026-03-31";

        console.log("--- TESTE RANKING ---");
        const ranking = db.exec(`
            SELECT u.id, u.nome, COALESCE(v.c, 0) as v 
            FROM users u 
            LEFT JOIN (SELECT user_id, COUNT(*) as c FROM visitas WHERE data_visita >= '${inicio}' AND data_visita <= '${fim}' GROUP BY user_id) v ON u.id = v.user_id
        `);
        console.log(JSON.stringify(ranking[0]?.values.slice(0, 3), null, 2));

        console.log("\n--- TESTE HISTORICO (JSON EXTRACTION) ---");
        const hist = db.exec(`
            SELECT id, data_visita, negociacao_dados FROM visitas WHERE data_visita >= '${inicio}' AND data_visita <= '${fim}' LIMIT 1
        `);
        if (hist.length > 0) {
            const row = hist[0].values[0];
            console.log("ID:", row[0], "Data:", row[1]);
            console.log("JSON Bruto:", row[2]);
            const parsed = JSON.parse(row[2]);
            console.log("Valor Extraído:", parsed.valor);
        } else {
            console.log("Nenhuma visita encontrada para o teste.");
        }

    } catch (e) {
        console.error(e);
    }
}

testApi();

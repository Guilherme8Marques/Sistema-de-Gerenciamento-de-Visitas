import fs from "fs";
import initSqlJs from "sql.js";

const LOG_FILE = "test_definitive_result.txt";
const DB_PATH = "server/database.db";

function log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line);
    console.log(msg);
}

function readDbUsers(): string {
    const data = fs.readFileSync(DB_PATH);
    const SQL = (globalThis as any).__SQL;
    const db = new SQL.Database(data);
    const users = db.exec("SELECT id, nome, celular FROM users");
    const planej = db.exec("SELECT count(*) as cnt FROM planejamento");
    const visitas = db.exec("SELECT count(*) as cnt FROM visitas");
    const result = JSON.stringify({ users, planej, visitas });
    db.close();
    return result;
}

async function main() {
    // Clear log
    fs.writeFileSync(LOG_FILE, "");

    const SQL = await initSqlJs();
    (globalThis as any).__SQL = SQL;

    log("====== TESTE DEFINITIVO DE PERSISTENCIA ======");

    // Step 1: Read disk state BEFORE anything
    log("STEP 1: Estado do disco ANTES de qualquer acao:");
    log(readDbUsers());

    // Step 2: Register a user via the LIVE API
    log("\nSTEP 2: Registrando usuario AGENTE_TESTE via API (localhost:5000)...");
    try {
        const res = await fetch("http://localhost:5000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nome: "AGENTE TESTE DEFINITIVO",
                matricula: "AGDEF999",
                celular: "1122334455",
                senha: "teste123"
            })
        });
        const body = await res.text();
        log(`API Response: status=${res.status} body=${body}`);
    } catch (e: any) {
        log(`API Error: ${e.message}`);
    }

    // Step 3: Read disk state IMMEDIATELY after API call
    log("\nSTEP 3: Estado do disco IMEDIATAMENTE apos a API:");
    log(readDbUsers());

    // Step 4: Wait 5 seconds (let setInterval fire if needed)
    log("\nSTEP 4: Aguardando 5 segundos...");
    await new Promise(r => setTimeout(r, 5000));

    // Step 5: Read disk state after waiting
    log("\nSTEP 5: Estado do disco APOS 5 segundos:");
    log(readDbUsers());

    // Step 6: Wait 35 seconds (should see the 30s setInterval fire)
    log("\nSTEP 6: Aguardando mais 35 segundos (para o setInterval de 30s disparar)...");
    await new Promise(r => setTimeout(r, 35000));

    // Step 7: Read disk state after full cycle
    log("\nSTEP 7: Estado do disco APOS 40 segundos totais:");
    log(readDbUsers());

    log("\n====== TESTE CONCLUIDO ======");
    log("Se AGENTE TESTE DEFINITIVO aparece em STEP 3, saveDatabase() funciona.");
    log("Se desaparece em STEP 5 ou 7, o setInterval do servidor NSSM esta sobrescrevendo o arquivo.");
}

main().catch(e => {
    log(`FATAL ERROR: ${e.message}`);
    console.error(e);
});

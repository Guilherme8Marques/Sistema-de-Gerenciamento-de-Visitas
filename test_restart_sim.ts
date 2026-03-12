import fs from "fs";
import initSqlJs from "sql.js";
import { execSync } from "child_process";

const LOG_FILE = "test_restart_result.txt";
const DB_PATH = "server/database.db";

function log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line);
    console.log(msg);
}

async function readDbState(): Promise<string> {
    const data = fs.readFileSync(DB_PATH);
    const SQL = await initSqlJs();
    const db = new SQL.Database(data);
    const users = db.exec("SELECT id, nome, celular FROM users");
    const planej = db.exec("SELECT count(*) as cnt FROM planejamento");
    const visitas = db.exec("SELECT count(*) as cnt FROM visitas");
    const stat = fs.statSync(DB_PATH);
    const result = `size=${stat.size} mtime=${stat.mtime.toISOString()} users=${JSON.stringify(users)} planej=${JSON.stringify(planej)} visitas=${JSON.stringify(visitas)}`;
    db.close();
    return result;
}

async function main() {
    fs.writeFileSync(LOG_FILE, "");

    log("====== SIMULAÇÃO DO 04_Reiniciar_Servico.bat ======");

    log("\nSTEP 1: Estado ANTES de tudo:");
    log(await readDbState());

    log("\nSTEP 2: Executando 'npm run build' (exatamente como o .bat faz)...");
    try {
        execSync("npm run build", { cwd: process.cwd(), stdio: "pipe" });
        log("Build concluido com sucesso.");
    } catch (e: any) {
        log(`Build FALHOU: ${e.message}`);
    }

    log("\nSTEP 3: Estado DEPOIS do build:");
    log(await readDbState());

    log("\n====== CONCLUSAO ======");
    log("Compare STEP 1 e STEP 3.");
    log("Se o numero de users/planej/visitas DIMINUIU apos o build, o build esta apagando dados!");
}

main().catch(e => {
    log(`FATAL: ${e.message}`);
});

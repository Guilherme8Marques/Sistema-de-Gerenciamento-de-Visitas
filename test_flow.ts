import fs from "fs";
import { execSync } from "child_process";
import initSqlJs from "sql.js";

async function main() {
    console.log("== 1. Criando novo usuario na API Live ==");
    const rawRes = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            nome: "AGENTE TESTE",
            matricula: "AG999",
            celular: "9988776655",
            senha: "senhateste"
        })
    });
    console.log("API Regisrter Status:", rawRes.status);

    console.log("== 2. Lendo disco Imediatamente ==");
    let data = fs.readFileSync('server/database.db');
    let SQL = await initSqlJs();
    let db = new SQL.Database(data);
    let users = db.exec("SELECT id, nome, celular FROM users");
    console.log("Current Disk state:", JSON.stringify(users, null, 2));

    console.log("== 3. Simulando o Reinicio Violento do Luiz ==");
    try { execSync('"Atalhos_Servidor\\nssm\\nssm.exe" stop VisitasServer'); } catch { }
    try { execSync('taskkill /F /IM node.exe /T'); } catch { }
    execSync('timeout /t 3 >nul');

    console.log("== 4. Lendo o disco APÓS O ABATE ==");
    data = fs.readFileSync('server/database.db');
    db = new SQL.Database(data);
    users = db.exec("SELECT id, nome, celular FROM users");
    console.log("Disk state AFTER KILL:", JSON.stringify(users, null, 2));

    console.log("== 5. Reactivating Server ==");
    try { execSync('"Atalhos_Servidor\\nssm\\nssm.exe" start VisitasServer'); } catch (e) { }
    execSync('timeout /t 3 >nul');

    console.log("== 6. Lendo o disco APÓS O RESPAWN ==");
    data = fs.readFileSync('server/database.db');
    db = new SQL.Database(data);
    users = db.exec("SELECT id, nome, celular FROM users");
    console.log("Disk state AFTER BOOT:", JSON.stringify(users, null, 2));

}
main().catch(console.error);

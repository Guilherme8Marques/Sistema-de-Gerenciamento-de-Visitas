import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        console.log("Iniciando DB memory mode...");
        const SQL = await initSqlJs();
        const buffer = fs.readFileSync(path.join(__dirname, "database.db"));
        const db = new SQL.Database(buffer);
        
        console.log("--- ESTATÍSTICAS DO BANCO ---");
        
        const countCoops = db.exec("SELECT COUNT(*) FROM cooperados")[0].values[0][0];
        console.log("Total Cooperados:", countCoops);

        const countFiliais = db.exec("SELECT COUNT(*) FROM filiais")[0].values[0][0];
        console.log("Total Filiais:", countFiliais);

        const countJoin = db.exec(`
            SELECT COUNT(*) 
            FROM cooperados c
            JOIN filiais f ON c.filial_id = f.id
        `)[0].values[0][0];
        console.log("Total Cooperados com Filial válida (JOIN):", countJoin);

        if (countCoops > 0 && countJoin === 0) {
            console.error("🚨 ERRO CRÍTICO: Existem cooperados, mas nenhum possui uma filial válida vinculada!");
        }

        const nullNames = db.exec("SELECT COUNT(*) FROM cooperados WHERE nome IS NULL")[0].values[0][0];
        console.log("Cooperados com Nome NULL:", nullNames);

        const nullMatriculas = db.exec("SELECT COUNT(*) FROM cooperados WHERE matricula IS NULL")[0].values[0][0];
        console.log("Cooperados com Matrícula NULL:", nullMatriculas);

        console.log("----------------------------");
        
        process.exit(0);
    } catch(e) {
        console.error("ERRO:", e);
        process.exit(1);
    }
}
run();

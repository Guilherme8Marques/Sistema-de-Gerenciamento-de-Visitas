import fs from 'fs';
import initSqlJs from 'sql.js';

async function main() {
    const data = fs.readFileSync('server/database.db');
    const SQL = await initSqlJs();
    const db = new SQL.Database(data);

    let result = "=== USERS ===\n";
    result += JSON.stringify(db.exec("SELECT id, nome, celular FROM users"), null, 2);

    result += "\n\n=== PLANEJAMENTO ===\n";
    result += JSON.stringify(db.exec("SELECT id, user_id, tipo, data_planejada FROM planejamento"), null, 2);

    result += "\n\n=== VISITAS ===\n";
    result += JSON.stringify(db.exec("SELECT id, user_id, resultado, cooperado_id FROM visitas"), null, 2);

    fs.writeFileSync('db_dump.txt', result, 'utf-8');
    console.log("Dump saved to db_dump.txt");
}

main().catch(console.error);

import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

async function checkUser() {
    const SQL = await initSqlJs();
    const dbPath = path.resolve("server/database.db");
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    const query = "SELECT * FROM celulares_autorizados WHERE nome LIKE '%Graziele%'";
    const result = db.exec(query);
    console.log("GRAZIELE AUTHORIZATION:", JSON.stringify(result, null, 2));

    const users = db.exec("SELECT * FROM users WHERE nome LIKE '%Graziele%'");
    console.log("GRAZIELE REGISTERED USER:", JSON.stringify(users, null, 2));
}

checkUser().catch(console.error);

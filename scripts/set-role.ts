import { initDatabase, getDb, saveDatabase } from "../server/database.js";

async function setRole() {
    await initDatabase();
    const db = getDb();
    db.run("UPDATE users SET role = 'gerente' WHERE celular = '35999005566'");
    saveDatabase();
    const r = db.exec("SELECT id, nome, role FROM users");
    if (r.length > 0) {
        console.log("Users:");
        r[0].values.forEach((row) => {
            console.log(`  id=${row[0]}, nome=${row[1]}, role=${row[2]}`);
        });
    }
    console.log("Done!");
}

setRole().catch(console.error);

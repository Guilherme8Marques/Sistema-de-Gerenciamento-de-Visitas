import { initDatabase, getDb, saveDatabase } from "./server/database.js";
import fs from "fs";

async function testWrite() {
    try {
        console.log("Initialize DB...");
        await initDatabase();

        const db = getDb();
        console.log("DB Intialized.");

        console.log("Inserting dummy user...");
        db.run(
            "INSERT INTO users (nome, matricula, celular, senha_hash, device_fingerprint, role) VALUES (?, ?, ?, ?, ?, ?)",
            ["DEBUG LUIZ", "DEBUG123", "9999999999", "hashtest", null, "consultor"]
        );

        console.log("Saving Database...");
        saveDatabase();
        console.log("DB Saved Synchronously.");

        console.log("Wait to see if DB saved onto Disk...");
        const stat = fs.statSync("server/database.db");
        console.log(`Database Size on disk: ${stat.size} bytes`);
        console.log(`Last Modified: ${new Date(stat.mtimeMs).toISOString()}`);
    } catch (e) {
        console.error("FAILED WRITING:", e);
    }
}

testWrite();

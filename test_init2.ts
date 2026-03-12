import { initDatabase, getDb, saveDatabase } from "./server/database.js";
import fs from "fs";

async function run() {
    console.log("== 1. FIRST BOOT ==");
    await initDatabase();
    let db = getDb();

    console.log("== 2. INJECTING USER ==");
    db.run("INSERT INTO users (nome, matricula, celular, senha_hash, device_fingerprint, role) VALUES (?, ?, ?, ?, ?, ?)", ["DEBUG LUIZ", "DEBUG123", "0000000000", "hashtest", null, "consultor"]);
    saveDatabase();

    const users1 = db.exec("SELECT id, nome, celular FROM users");
    console.log("Memory BEFORE reboot:", JSON.stringify(users1, null, 2));

    console.log("== 3. SIMULATING REBOOT ==");
    // Delete the instance to force a fresh parse
    await initDatabase();
    db = getDb();

    console.log("== 4. MEMORY AFTER REBOOT ==");
    const users2 = db.exec("SELECT id, nome, celular FROM users");
    console.log("Memory AFTER reboot:", JSON.stringify(users2, null, 2));
}

run().catch(console.error);

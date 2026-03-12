import { initDatabase, getDb } from "./server/database.js";

async function main() {
    await initDatabase();
    const db = getDb();
    const users = db.exec("SELECT id, nome, matricula FROM users");
    if (users.length > 0) {
        console.log(users[0].values);
    } else {
        console.log("No users found");
    }
}
main();

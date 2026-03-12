import initSqlJs from "sql.js";

async function run() {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, msg TEXT)");

    // Test with WAL
    db.run("PRAGMA journal_mode=WAL;");

    db.run("INSERT INTO test (msg) VALUES ('HELLO WAL')");

    const exported1 = db.export();

    const db2 = new SQL.Database(exported1);
    const result1 = db2.exec("SELECT * FROM test");
    console.log("With WAL -> Exported rows:", JSON.stringify(result1));
}
run();

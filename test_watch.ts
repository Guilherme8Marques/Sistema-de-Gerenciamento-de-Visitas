import fs from "fs";
import { execSync } from "child_process";

const DB_PATH = "server/database.db";

console.log("Initial file size:", fs.statSync(DB_PATH).size);

// Inject DEBUG
console.log("Injecting DEBUG LUIZ via test_write.ts...");
execSync("npx tsx test_write.ts");

console.log("File size after inject:", fs.statSync(DB_PATH).size);

console.log("Watching for 10 seconds...");
let lastSize = fs.statSync(DB_PATH).size;
const interval = setInterval(() => {
    const currentSize = fs.statSync(DB_PATH).size;
    if (currentSize !== lastSize) {
        console.log(`[ALERT] File size changed! ${lastSize} -> ${currentSize} at ${new Date().toISOString()}`);
        lastSize = currentSize;
    }
}, 500);

setTimeout(() => {
    clearInterval(interval);
    console.log("Done watching. Final size:", fs.statSync(DB_PATH).size);
}, 10000);

import { getDb } from './server/database.js'; const db = getDb(); console.log(db.exec('SELECT * FROM users LIMIT 5'));

import initSqlJs, { Database } from "sql.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o banco sempre seja lido da pasta original "server/"
// Função de Auditoria para rastrear por que dados somem
function auditLog(action: string) {
  try {
    const projectRoot = path.resolve(__dirname, __dirname.includes("dist") ? ".." : "..");
    const logPath = path.join(projectRoot, "server", "db_audit.log");
    const dbPath = path.join(projectRoot, "server", "database.db");
    const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : { size: 0 };
    const now = new Date().toLocaleString("pt-BR");
    const message = `[${now}] PID: ${process.pid} - Ação: ${action} - Tamanho do arquivo: ${stats.size} bytes\n`;
    fs.appendFileSync(logPath, message);
  } catch (e) {
    console.error("Erro ao escrever log de auditoria:", e);
  }
}

const projectRoot = path.resolve(__dirname, __dirname.includes("dist") ? ".." : "..");
const DB_PATH = path.join(projectRoot, "server", "database.db");
const LOCK_PATH = path.join(projectRoot, "server", "database.pid");

let db: Database;

import { execSync } from "child_process";

/**
 * Sistema de Travamento (Lock) para impedir múltiplos servidores simultâneos.
 * Se dois processos tentarem rodar, o segundo tentará "evacuar" o primeiro ou abortará.
 */
function claimDatabaseOwnership() {
  const isWindows = process.platform === "win32";

  if (fs.existsSync(LOCK_PATH)) {
    const existingPid = parseInt(fs.readFileSync(LOCK_PATH, "utf-8"));
    try {
      // Verifica se o processo ainda está vivo
      process.kill(existingPid, 0);

      // Se for o mesmo PID do processo atual, não há conflito
      if (existingPid === process.pid) return;

      auditLog(`⚠️ CONFLITO DETECTADO: Processo ${existingPid} ainda ativo em ${process.platform}.`);
      console.log(`\n[AVISO] Detectado processo antigo (PID ${existingPid}) ainda rodando.`);

      if (isWindows) {
        console.log("Tentando encerrá-lo automaticamente...");
        try {
          execSync(`taskkill /F /PID ${existingPid} /T`, { stdio: 'ignore' });
          auditLog(`✅ AUTO-EVICÇÃO SUCEDIDA: Processo ${existingPid} encerrado.`);
          console.log("Processo antigo encerrado com sucesso.\n");
          execSync("timeout /t 2", { stdio: 'ignore' });
        } catch (killError) {
          auditLog(`❌ AUTO-EVICÇÃO FALHOU: Sem permissão para matar o PID ${existingPid}.`);
          console.error(`\n[ERRO] Não foi possível encerrar o processo antigo (Acesso Negado).`);
          process.exit(1);
        }
      } else {
        // No Linux/Docker, os PIDs são frequentemente reciclados (ex: PID 1).
        // Se chegamos aqui, o PID existe mas pode ser outro processo no container.
        // Como o Docker garante isolamento, vamos apenas avisar e sobrescrever o lock.
        console.log(`[AVISO] Ignorando trava do PID ${existingPid} (Ambiente Linux/Docker).`);
        auditLog(`♻️ Sobrescrevendo lock do PID ${existingPid} (Linux)`);
      }
    } catch (e) {
      // Processo dono do lock morreu, podemos assumir
      auditLog(`♻️ Resetando lock órfão do PID ${existingPid}`);
    }
  }
  fs.writeFileSync(LOCK_PATH, process.pid.toString());
  auditLog(`🔒 Lock adquirido pelo PID ${process.pid}`);
}

export function releaseDatabaseOwnership() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      const pid = parseInt(fs.readFileSync(LOCK_PATH, "utf-8"));
      if (pid === process.pid) {
        fs.unlinkSync(LOCK_PATH);
        auditLog("🔓 Lock liberado corretamente");
      }
    }
  } catch (e) { }
}

/**
 * Salva o banco de dados no disco imediatamente.
 * Chamado automaticamente após cada operação de escrita (INSERT/UPDATE/DELETE).
 */
function flushToDisk(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    auditLog("ESCREVEU NO DISCO (flushToDisk)");
  } catch (err) {
    console.error("❌ Erro ao salvar banco no disco:", err);
    auditLog(`ERRO NO DISCO: ${err}`);
  }
}

/**
 * Inicializa a conexão com o SQLite via sql.js.
 * Se o arquivo database.db existir, carrega-o. Caso contrário, cria um novo.
 */
export async function initDatabase(): Promise<Database> {
  auditLog("INÍCIO DO BOOT (initDatabase)");
  claimDatabaseOwnership();
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log("📂 Banco de dados carregado de:", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("🆕 Novo banco de dados criado");
  }

  db.run("PRAGMA foreign_keys=ON;");

  createTables();
  auditLog("FIM DO BOOT (initDatabase)");

  // Salvar o estado inicial no disco (garante que o arquivo existe)
  flushToDisk();

  return db;
}

/**
 * Retorna a instância do banco.
 */
export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

/**
 * Salva o banco de dados no disco.
 * Mantido para compatibilidade com código existente, mas agora é
 * um alias simples para flushToDisk().
 * 
 * IMPORTANTE: Com a nova arquitetura, cada chamada a saveDatabase()
 * nas rotas garante persistência IMEDIATA. Não dependemos mais de
 * setInterval ou de processos fantasma.
 */
export function saveDatabase(): void {
  auditLog("CHAMOU saveDatabase (Router)");
  flushToDisk();
}

/**
 * Cria as tabelas do sistema.
 */
function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS celulares_autorizados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      matricula TEXT,
      nome TEXT,
      cargo TEXT,
      fornecedor TEXT,
      ativo INTEGER DEFAULT 1
    );
  `);

  try { db.run("ALTER TABLE celulares_autorizados ADD COLUMN matricula TEXT"); } catch { }
  try { db.run("ALTER TABLE celulares_autorizados ADD COLUMN nome TEXT"); } catch { }
  try { db.run("ALTER TABLE celulares_autorizados ADD COLUMN cargo TEXT"); } catch { }
  try { db.run("ALTER TABLE celulares_autorizados ADD COLUMN fornecedor TEXT"); } catch { }

  db.run(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      celular TEXT UNIQUE NOT NULL,
      motivo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      matricula TEXT NOT NULL,
      celular TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      role TEXT DEFAULT 'consultor',
      device_fingerprint TEXT,
      reset_code TEXT,
      reset_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'consultor'");
  } catch {
    // Coluna já existe, ignorar
  }
  
  try { db.run("ALTER TABLE users ADD COLUMN reset_code TEXT"); } catch { }
  try { db.run("ALTER TABLE users ADD COLUMN reset_expires DATETIME"); } catch { }

  db.run(`
    CREATE TABLE IF NOT EXISTS filiais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cidade TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cooperados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      filial_id INTEGER NOT NULL,
      matricula TEXT NOT NULL,
      FOREIGN KEY (filial_id) REFERENCES filiais(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS propriedades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cooperado_id INTEGER NOT NULL,
      endereco TEXT DEFAULT '',
      FOREIGN KEY (cooperado_id) REFERENCES cooperados(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS planejamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      data_planejada TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('visita', 'evento')),
      cooperado_id INTEGER,
      evento_nome TEXT,
      semana TEXT NOT NULL CHECK(semana IN ('atual', 'proxima')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (cooperado_id) REFERENCES cooperados(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS visitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      planejamento_id INTEGER,
      cooperado_id INTEGER,
      data_visita TEXT NOT NULL,
      resultado TEXT NOT NULL,
      doencas_pragas TEXT DEFAULT '[]',
      negociacao_dados TEXT,
      extra INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (planejamento_id) REFERENCES planejamento(id),
      FOREIGN KEY (cooperado_id) REFERENCES cooperados(id)
    );
  `);

  // Índices para performance
  db.run("CREATE INDEX IF NOT EXISTS idx_cooperados_nome ON cooperados(nome);");
  db.run("CREATE INDEX IF NOT EXISTS idx_cooperados_filial ON cooperados(filial_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_planejamento_user ON planejamento(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_planejamento_data ON planejamento(data_planejada);");
  db.run("CREATE INDEX IF NOT EXISTS idx_visitas_user ON visitas(user_id);");
  db.run("CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas(data_visita);");
  db.run("CREATE INDEX IF NOT EXISTS idx_visitas_cooperado ON visitas(cooperado_id);");

  console.log("✅ Tabelas e índices criados");
}

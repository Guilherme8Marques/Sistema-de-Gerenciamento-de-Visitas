/**
 * Script de importação — lê o CSV de cooperados da Cooxupé e popula o SQLite.
 *
 * O CSV tem formato:
 *   "Matricula";"Nome da conta";"Data da última modificação";"Propriedade: Nome da propriedade";"Filial";"Tipo de registro da conta";"Classificação"
 *
 * Cooperados com múltiplas propriedades aparecem como linhas duplicadas (mesma matrícula, propriedade diferente).
 *
 * ⚠️  IMPORTANTE: Pare o servidor (npm run server:dev) ANTES de rodar este script!
 *     O auto-save do servidor sobrescreve o banco com dados antigos da memória.
 *
 * Uso: npx tsx server/import-dados.ts
 */
import fs from "fs";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import xlsx from "xlsx";
import { initDatabase, getDb, saveDatabase } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pasta de dados
const DADOS_DIR = path.join(__dirname, "..", "dados");

const SERVER_PORT = 5000;

interface CsvRow {
    Matricula: string;
    "Nome da conta": string;
    "Data da última modificação": string;
    "Propriedade: Nome da propriedade": string;
    Filial: string;
    "Tipo de registro da conta": string;
    "Classificação": string;
}

/**
 * Verifica se a porta do servidor está em uso.
 * Se estiver, aborta para evitar que o auto-save sobrescreva os dados importados.
 */
function checkServerRunning(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
        });
        socket.once("error", () => {
            resolve(false);
        });
        socket.connect(port, "127.0.0.1");
    });
}

function findFile(directory: string, pattern: RegExp): string | null {
    if (!fs.existsSync(directory)) return null;
    const files = fs.readdirSync(directory);
    const found = files.find(f => pattern.test(f));
    return found ? path.join(directory, found) : null;
}

async function importar() {
    // Verificar se o servidor está rodando
    const serverRunning = await checkServerRunning(SERVER_PORT);
    if (serverRunning) {
        console.error("❌ ERRO: O servidor está rodando na porta " + SERVER_PORT + "!");
        console.error("");
        console.error("   O auto-save do servidor (a cada 30s) vai sobrescrever os dados importados.");
        console.error("   Pare o servidor primeiro e então rode este script novamente.");
        console.error("");
        console.error("   Passo a passo:");
        console.error("   1. Pare o servidor (Ctrl+C ou feche o terminal)");
        console.error("   2. Rode: npm run import-dados");
        console.error("   3. Depois inicie o servidor: npm run server:dev");
        console.error("");
        console.error("   Ou use o script combinado: npm run setup");
        process.exit(1);
    }

    console.log("📥 Iniciando importação de dados reais...\n");

    // Tentar encontrar o CSV (padrão report*.csv ou qualquer .csv)
    let csvPath = findFile(DADOS_DIR, /^report.*\.csv$/i) || findFile(DADOS_DIR, /\.csv$/i);

    if (!csvPath) {
        console.error("❌ ERRO: Nenhum arquivo .csv encontrado na pasta 'dados/'");
        console.error("   Certifique-se de que você fez o upload do CSV exportado para a pasta 'dados/'.");
        process.exit(1);
    }

    console.log(`📄 Usando CSV: ${path.basename(csvPath)}`);

    // Ler CSV com encoding UTF-8
    const csvText = fs.readFileSync(csvPath, "utf-8");

    // Parse CSV (separador ;)
    const records: CsvRow[] = parse(csvText, {
        delimiter: ";",
        columns: true,
        skip_empty_lines: true,
        trim: true,
        quote: '"',
    });

    console.log(`📊 ${records.length} linhas lidas do CSV\n`);

    // Tentar encontrar o XLSX de usuários
    let usuariosPath = findFile(DADOS_DIR, /RELAÇÃO.*\.xlsx$/i) || findFile(DADOS_DIR, /\.xlsx$/i);
    
    let usuariosRecords: any[] = [];
    if (usuariosPath && fs.existsSync(usuariosPath)) {
        const wb = xlsx.readFile(usuariosPath);
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        usuariosRecords = xlsx.utils.sheet_to_json(ws);
        console.log(`📄 Usando Planilha: ${path.basename(usuariosPath)}`);
        console.log(`📊 ${usuariosRecords.length} colaboradores lidos da planilha\n`);
    } else {
        console.warn(`⚠️ Arquivo de colaboradores (.xlsx) não encontrado na pasta 'dados/'.\n`);
    }

    // Inicializar banco
    await initDatabase();
    const db = getDb();

    // Limpar dados antigos (seed)
    db.run("DELETE FROM visitas;");
    db.run("DELETE FROM planejamento;");
    db.run("DELETE FROM propriedades;");
    db.run("DELETE FROM cooperados;");
    db.run("DELETE FROM filiais;");
    // Não vamos deletar os users, eles serão atualizados ou mantidos
    console.log("🗑️  Dados antigos removidos (seed)\n");

    // --- Passo 0: Importar Celulares Autorizados ---
    let celularesCount = 0;
    for (const row of usuariosRecords) {
        // As colunas: 'CÓDIGO', 'COLABORADOR(A)', 'CARGO.', 'FORNECEDOR', 'CELULAR CXP'
        const celularRaw = row["CELULAR CXP"];
        const matriculaRaw = row["CÓDIGO"]?.toString()?.trim();
        const nomeRaw = row["COLABORADOR(A)"]?.toString()?.trim();
        const cargoRaw = row["CARGO."]?.toString()?.trim();
        const fornecedorRaw = row["FORNECEDOR"]?.toString()?.trim();

        if (!celularRaw) continue;

        // Limpar o número (manter apenas dígitos)
        const celularClean = String(celularRaw).replace(/\D/g, "");
        if (celularClean.length < 10) continue; // Tem que ter DDD no mínimo

        // Salvar na tabela celulares_autorizados com os dados extras
        try {
            db.run(
                "INSERT OR REPLACE INTO celulares_autorizados (numero, matricula, nome, cargo, fornecedor, ativo) VALUES (?, ?, ?, ?, ?, 1)",
                [celularClean, matriculaRaw || null, nomeRaw || null, cargoRaw || null, fornecedorRaw || null]
            );
            celularesCount++;
            if (nomeRaw && nomeRaw.toLowerCase().includes('guilherme')) {
                console.log(`✅ [DEBUG] INSERIDO COM SUCESSO: ${nomeRaw} - ${celularClean}`);
            }
        } catch (e) {
            console.error("Erro inserindo celular", celularClean, e);
        }
    }

    // GARANTIA: Se o Guilherme não estiver na primeira folha (Sheet 0) ou algo deu errado
    try {
        db.run(
            "INSERT OR REPLACE INTO celulares_autorizados (numero, matricula, nome, cargo, ativo) VALUES (?, ?, ?, ?, 1)",
            ["3597786623", "82534", "Guilherme Marques", "Administrador"]
        );
        celularesCount++;
        console.log(`🛡️  [GARANTIA ATIVADA] Forçado a autorização do Guilherme: 3597786623`);
    } catch (e) { }

    console.log(`✅ ${celularesCount} celulares autorizados inseridos`);

    // --- Passo 1: Extrair filiais únicas ---
    const filiaisSet = new Map<string, { codigo: string; nome: string }>();

    for (const row of records) {
        const filialRaw = row.Filial?.trim();
        if (!filialRaw) continue;

        // Formato: "L07:Loja Nova Resende" ou "306:Unidade Avançada Campos Altos"
        const parts = filialRaw.split(":");
        const codigo = parts[0]?.trim() || "";
        const nome = parts.slice(1).join(":").trim() || filialRaw;

        if (!filiaisSet.has(codigo)) {
            filiaisSet.set(codigo, { codigo, nome });
        }
    }

    // Inserir filiais
    const filialIdMap = new Map<string, number>();
    let filialCount = 0;

    for (const [codigo, filial] of filiaisSet) {
        db.run(
            "INSERT INTO filiais (nome, cidade) VALUES (?, ?)",
            [filial.nome, filial.nome] // cidade = nome da filial por enquanto
        );
        const result = db.exec("SELECT last_insert_rowid()");
        const id = result[0].values[0][0] as number;
        filialIdMap.set(codigo, id);
        filialCount++;
    }
    console.log(`✅ ${filialCount} filiais inseridas`);

    // --- Passo 2: Extrair cooperados únicos (por matrícula) ---
    const cooperadosMap = new Map<string, { nome: string; filialCodigo: string }>();

    for (const row of records) {
        const matricula = row.Matricula?.trim();
        const nome = row["Nome da conta"]?.trim();
        const filialRaw = row.Filial?.trim();
        if (!matricula || !nome || !filialRaw) continue;

        const filialCodigo = filialRaw.split(":")[0]?.trim() || "";

        if (!cooperadosMap.has(matricula)) {
            cooperadosMap.set(matricula, { nome, filialCodigo });
        }
    }

    // Inserir cooperados
    const cooperadoIdMap = new Map<string, number>();
    let cooperadoCount = 0;

    for (const [matricula, coop] of cooperadosMap) {
        const filialId = filialIdMap.get(coop.filialCodigo);
        if (!filialId) {
            console.warn(`⚠️  Filial não encontrada para cooperado ${matricula}: ${coop.filialCodigo}`);
            continue;
        }

        db.run(
            "INSERT INTO cooperados (nome, filial_id, matricula) VALUES (?, ?, ?)",
            [coop.nome, filialId, matricula]
        );
        const result = db.exec("SELECT last_insert_rowid()");
        const id = result[0].values[0][0] as number;
        cooperadoIdMap.set(matricula, id);
        cooperadoCount++;
    }
    console.log(`✅ ${cooperadoCount} cooperados inseridos`);

    // --- Passo 3: Inserir propriedades (cada linha = 1 propriedade) ---
    let propCount = 0;

    for (const row of records) {
        const matricula = row.Matricula?.trim();
        const propriedade = row["Propriedade: Nome da propriedade"]?.trim();
        if (!matricula || !propriedade) continue;

        const cooperadoId = cooperadoIdMap.get(matricula);
        if (!cooperadoId) continue;

        db.run(
            "INSERT INTO propriedades (nome, cooperado_id, endereco) VALUES (?, ?, ?)",
            [propriedade, cooperadoId, ""]
        );
        propCount++;
    }
    console.log(`✅ ${propCount} propriedades inseridas`);

    // Salvar
    saveDatabase();

    // Resumo
    console.log("\n📊 Resumo da importação:");
    console.log(`   Filiais:       ${filialCount}`);
    console.log(`   Cooperados:    ${cooperadoCount}`);
    console.log(`   Propriedades:  ${propCount}`);

    // Verificação rápida
    const topCoops = db.exec(
        `SELECT c.matricula, c.nome, f.nome as filial, COUNT(p.id) as props
     FROM cooperados c
     JOIN filiais f ON c.filial_id = f.id
     LEFT JOIN propriedades p ON p.cooperado_id = c.id
     GROUP BY c.id
     HAVING props > 1
     ORDER BY props DESC
     LIMIT 5`
    );

    if (topCoops.length > 0 && topCoops[0].values.length > 0) {
        console.log("\n🏠 Top 5 cooperados com mais propriedades:");
        for (const row of topCoops[0].values) {
            console.log(`   ${row[0]} - ${row[1]} (${row[2]}) → ${row[3]} propriedades`);
        }
    }

    console.log("\n🎉 Importação concluída com sucesso!");
}

importar().catch(console.error);

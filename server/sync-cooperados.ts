/**
 * Sincronização automática de Cooperados via CSV.
 *
 * Monitora a pasta dados/ para arquivos report*.csv ou cooperados.csv.
 * Quando detecta mudança, importa Filiais → Cooperados → Propriedades.
 *
 * IMPORTANTE: Não apaga visitas nem planejamentos — apenas atualiza
 * as tabelas de referência (filiais, cooperados, propriedades).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { getDb, saveDatabase } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DADOS_DIR = path.join(__dirname, "..", "dados");

interface CsvRow {
    Matricula: string;
    "Nome da conta": string;
    "Data da última modificação": string;
    "Propriedade: Nome da propriedade": string;
    Filial: string;
    "Tipo de registro da conta": string;
    "Classificação": string;
    "Tipo de cliente"?: string;
}

/**
 * Encontra o primeiro arquivo CSV na pasta dados/ que combine com o padrão.
 */
function findCsvFile(): string | null {
    if (!fs.existsSync(DADOS_DIR)) return null;
    const files = fs.readdirSync(DADOS_DIR);

    const cooperadosFile = files.find(f => /^cooperados\.csv$/i.test(f));
    if (cooperadosFile) return path.join(DADOS_DIR, cooperadosFile);

    const reportFile = files.find(f => /^report.*\.csv$/i.test(f));
    if (reportFile) return path.join(DADOS_DIR, reportFile);

    const anyCSV = files.find(f => /\.csv$/i.test(f));
    if (anyCSV) return path.join(DADOS_DIR, anyCSV);

    return null;
}

/**
 * Importa cooperados do CSV para o banco de dados.
 * Substitui filiais, cooperados e propriedades sem tocar em visitas/planejamentos.
 */
export function sincronizarCooperadosCSV(): void {
    const csvPath = findCsvFile();

    if (!csvPath) {
        console.warn("⚠️  [AUTO-SYNC COOPERADOS] Nenhum arquivo CSV encontrado na pasta dados/");
        return;
    }

    const startTime = Date.now();
    console.log(`\n🔄 [AUTO-SYNC COOPERADOS] Iniciando sincronização com: ${path.basename(csvPath)}`);

    try {
        const csvText = fs.readFileSync(csvPath, "utf-8");

        const records: CsvRow[] = parse(csvText, {
            delimiter: ";",
            columns: true,
            skip_empty_lines: true,
            trim: true,
            quote: '"',
        });

        console.log(`   📊 ${records.length} linhas lidas do CSV`);

        if (records.length === 0) {
            console.warn("   ⚠️ CSV vazio. Sincronização abortada para preservar dados.");
            return;
        }

        const db = getDb();

        // ── Passo 1: Extrair filiais únicas ──
        const filiaisSet = new Map<string, { codigo: string; nome: string }>();

        for (const row of records) {
            const filialRaw = row.Filial?.trim();
            if (!filialRaw) continue;

            const parts = filialRaw.split(":");
            const codigo = parts[0]?.trim() || "";
            const nome = parts.slice(1).join(":").trim() || filialRaw;

            if (!filiaisSet.has(codigo)) {
                filiaisSet.set(codigo, { codigo, nome });
            }
        }

        // ── Passo 2: Extrair cooperados únicos (por matrícula) ──
        const cooperadosMap = new Map<string, { nome: string; filialCodigo: string; tipo: string }>();

        for (const row of records) {
            const matricula = row.Matricula?.trim();
            const nome = row["Nome da conta"]?.trim();
            const filialRaw = row.Filial?.trim();
            const tipo = row["Tipo de cliente"]?.trim() || "Cooperado";
            if (!matricula || !nome || !filialRaw) continue;

            const filialCodigo = filialRaw.split(":")[0]?.trim() || "";

            if (!cooperadosMap.has(matricula)) {
                cooperadosMap.set(matricula, { nome, filialCodigo, tipo });
            }
        }

        // ── Passo 3: Extrair propriedades ──
        const propriedadesList: { matricula: string; nome: string }[] = [];

        for (const row of records) {
            const matricula = row.Matricula?.trim();
            const propriedade = row["Propriedade: Nome da propriedade"]?.trim();
            if (!matricula || !propriedade) continue;
            propriedadesList.push({ matricula, nome: propriedade });
        }

        // ── Passo 4: Aplicar no banco (FULL SYNC com inativação) ──
        // 1. Marca todos como ativo=0
        // 2. Upsert do CSV → marca ativo=1
        // 3. Hard delete quem ficou ativo=0 E não tem visitas/planejamento
        // 4. Quem tem referências históricas permanece inativo (invisível na busca)
        
        const cooperadoIdMap = new Map<string, number>();
        let cooperadoCount = 0;

        db.run("BEGIN TRANSACTION");

        try {
            // --- 4.0 Inativar todos os cooperados antes do sync ---
            db.run("UPDATE cooperados SET ativo = 0");

            // --- 4.1 Filiais ---
            const fDbMap = new Map<string, number>();
            const resFiliais = db.exec("SELECT id, nome FROM filiais");
            if (resFiliais.length > 0) {
                for (const row of resFiliais[0].values) fDbMap.set(row[1] as string, row[0] as number);
            }

            const filialIdMap = new Map<string, number>();
            let filialCount = fDbMap.size; // manter contador com as que já existem

            for (const [codigo, filial] of filiaisSet) {
                let id = fDbMap.get(filial.nome);
                if (!id) {
                    db.run("INSERT INTO filiais (nome, cidade) VALUES (?, ?)", [filial.nome, filial.nome]);
                    const result = db.exec("SELECT last_insert_rowid()");
                    id = result[0].values[0][0] as number;
                    fDbMap.set(filial.nome, id);
                    filialCount++;
                }
                filialIdMap.set(codigo, id);
            }

            // --- 4.2 Cooperados (Upsert + ativo=1) ---
            const cDbMap = new Map<string, number>();
            const resCoop = db.exec("SELECT id, matricula FROM cooperados");
            if (resCoop.length > 0) {
                for (const row of resCoop[0].values) cDbMap.set(row[1] as string, row[0] as number);
            }

            for (const [matricula, coop] of cooperadosMap) {
            const filialId = filialIdMap.get(coop.filialCodigo);
            if (!filialId) continue;

            let id = cDbMap.get(matricula);
            if (id) {
                db.run(
                    "UPDATE cooperados SET nome = ?, filial_id = ?, tipo = ?, ativo = 1 WHERE id = ?",
                    [coop.nome, filialId, coop.tipo, id]
                );
            } else {
                db.run(
                    "INSERT INTO cooperados (nome, filial_id, matricula, tipo, ativo) VALUES (?, ?, ?, ?, 1)",
                    [coop.nome, filialId, matricula, coop.tipo]
                );
                const result = db.exec("SELECT last_insert_rowid()");
                id = result[0].values[0][0] as number;
                cDbMap.set(matricula, id);
            }
            cooperadoIdMap.set(matricula, id);
            
            cooperadoCount++;
        }

        // --- 4.3 Propriedades ---
        // Propriedades não são usadas como FK crítica, então podemos limpar para atualizar do CSV original de forma mais simples
            db.run("DELETE FROM propriedades;");
            let propCount = 0;
            for (const prop of propriedadesList) {
                const cooperadoId = cooperadoIdMap.get(prop.matricula);
                if (!cooperadoId) continue;

                db.run(
                    "INSERT INTO propriedades (nome, cooperado_id, endereco) VALUES (?, ?, ?)",
                    [prop.nome, cooperadoId, ""]
                );
                propCount++;
            }

            // --- 4.4 Hard Delete: remover cooperados inativos SEM referências ---
            const deleteResult = db.exec(`
                SELECT COUNT(*) FROM cooperados 
                WHERE ativo = 0 
                AND id NOT IN (SELECT DISTINCT cooperado_id FROM visitas WHERE cooperado_id IS NOT NULL)
                AND id NOT IN (SELECT DISTINCT cooperado_id FROM planejamento WHERE cooperado_id IS NOT NULL)
            `);
            const orphanCount = deleteResult.length > 0 ? deleteResult[0].values[0][0] as number : 0;

            db.run(`
                DELETE FROM cooperados 
                WHERE ativo = 0 
                AND id NOT IN (SELECT DISTINCT cooperado_id FROM visitas WHERE cooperado_id IS NOT NULL)
                AND id NOT IN (SELECT DISTINCT cooperado_id FROM planejamento WHERE cooperado_id IS NOT NULL)
            `);

            // Contar quantos ficaram inativos (têm referências históricas)
            const inativoResult = db.exec("SELECT COUNT(*) FROM cooperados WHERE ativo = 0");
            const inativoCount = inativoResult.length > 0 ? inativoResult[0].values[0][0] as number : 0;

            db.run("COMMIT");

            saveDatabase();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`   ✅ Filiais: ${filialCount} | Cooperados ativos: ${cooperadoCount} | Propriedades: ${propCount}`);
            if (orphanCount > 0) console.log(`   🗑️  ${orphanCount} cooperados órfãos removidos (sem visitas/planejamento)`);
            if (inativoCount > 0) console.log(`   ⚠️  ${inativoCount} cooperados inativos preservados (com histórico de visitas)`);
            console.log(`   ⏱️  Concluído em ${elapsed}s\n`);

        } catch (txError) {
            db.run("ROLLBACK");
            throw txError;
        }

    } catch (error) {
        console.error("❌ [AUTO-SYNC COOPERADOS] Erro na sincronização:", error);
    }
}

// ── File Watcher ──

let coopTimeoutId: NodeJS.Timeout | null = null;
let watchedCsvPath: string | null = null;

export function iniciarObservadorCooperados(): void {
    const csvPath = findCsvFile();

    if (!csvPath) {
        console.warn("⚠️  [FILE WATCHER] Nenhum CSV de cooperados encontrado para monitorar.");
        return;
    }

    watchedCsvPath = csvPath;

    console.log(`👀 [FILE WATCHER] Monitorando CSV de cooperados: ${path.basename(csvPath)}`);
    console.log(`   (Qualquer salvamento no CSV atualizará a base automaticamente)`);

    fs.watchFile(csvPath, { interval: 2000 }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) {
            if (coopTimeoutId) clearTimeout(coopTimeoutId);

            coopTimeoutId = setTimeout(() => {
                console.log(`\n📄 [FILE WATCHER] CSV de cooperados modificado! Detectada mudança às ${new Date().toLocaleTimeString('pt-BR')}`);
                sincronizarCooperadosCSV();
            }, 2000); // 2s debounce para aguardar o salvamento completo
        }
    });

    // Também monitorar por novos arquivos CSV na pasta
    try {
        fs.watch(DADOS_DIR, (eventType, filename) => {
            if (!filename || !filename.toLowerCase().endsWith('.csv')) return;
            
            const fullPath = path.join(DADOS_DIR, filename);
            
            // Se um novo CSV apareceu e é diferente do que estamos monitorando
            if (fullPath !== watchedCsvPath && fs.existsSync(fullPath)) {
                if (coopTimeoutId) clearTimeout(coopTimeoutId);

                coopTimeoutId = setTimeout(() => {
                    console.log(`\n📄 [FILE WATCHER] Novo CSV detectado: ${filename}`);
                    
                    // Parar de monitorar o antigo
                    if (watchedCsvPath) {
                        fs.unwatchFile(watchedCsvPath);
                    }

                    // Monitorar o novo
                    watchedCsvPath = fullPath;
                    fs.watchFile(fullPath, { interval: 2000 }, (curr, prev) => {
                        if (curr.mtimeMs !== prev.mtimeMs) {
                            if (coopTimeoutId) clearTimeout(coopTimeoutId);
                            coopTimeoutId = setTimeout(() => {
                                console.log(`\n📄 [FILE WATCHER] CSV de cooperados modificado!`);
                                sincronizarCooperadosCSV();
                            }, 2000);
                        }
                    });

                    sincronizarCooperadosCSV();
                }, 3000); // 3s para dar tempo do arquivo ser copiado por completo
            }
        });
    } catch (e) {
        // fs.watch pode falhar em alguns sistemas — fallback é o watchFile acima
        console.warn("   ⚠️ fs.watch não disponível, usando apenas fs.watchFile");
    }
}

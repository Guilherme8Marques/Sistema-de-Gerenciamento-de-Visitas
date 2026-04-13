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

    // Prioridade máxima para cooperados_terceiros.csv
    const cooperadosTerceirosFile = files.find(f => /^cooperados_terceiros\.csv$/i.test(f));
    if (cooperadosTerceirosFile) return path.join(DADOS_DIR, cooperadosTerceirosFile);

    const reportFile = files.find(f => /^report.*\.csv$/i.test(f));
    if (reportFile) return path.join(DADOS_DIR, reportFile);

    const cooperadosFile = files.find(f => /^cooperados\.csv$/i.test(f));
    if (cooperadosFile) return path.join(DADOS_DIR, cooperadosFile);

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

        // ── Passo 4: Aplicar no banco (MÉTODO SEGURO SEM DELETE DE COOPERADO) ──
        // Isso preserva os IDs para o relacionamento histórico em planejamento e visitas
        
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

        // --- 4.2 Cooperados ---
        const cDbMap = new Map<string, number>();
        const resCoop = db.exec("SELECT id, matricula FROM cooperados");
        if (resCoop.length > 0) {
            for (const row of resCoop[0].values) cDbMap.set(row[1] as string, row[0] as number);
        }

        const cooperadoIdMap = new Map<string, number>();
        let cooperadoCount = 0;
        let terceirosCount = 0;

        for (const [matricula, coop] of cooperadosMap) {
            const filialId = filialIdMap.get(coop.filialCodigo);
            if (!filialId) continue;

            let id = cDbMap.get(matricula);
            if (id) {
                db.run(
                    "UPDATE cooperados SET nome = ?, filial_id = ?, tipo = ? WHERE id = ?",
                    [coop.nome, filialId, coop.tipo, id]
                );
            } else {
                db.run(
                    "INSERT INTO cooperados (nome, filial_id, matricula, tipo) VALUES (?, ?, ?, ?)",
                    [coop.nome, filialId, matricula, coop.tipo]
                );
                const result = db.exec("SELECT last_insert_rowid()");
                id = result[0].values[0][0] as number;
                cDbMap.set(matricula, id);
            }
            cooperadoIdMap.set(matricula, id);
            
            if (coop.tipo === "Terceiro") terceirosCount++;
            else cooperadoCount++;
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

        saveDatabase();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ Filiais: ${filialCount} | Cooperados: ${cooperadoCount} | Terceiros: ${terceirosCount} | Propriedades: ${propCount}`);
        console.log(`   ⏱️  Concluído em ${elapsed}s\n`);

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

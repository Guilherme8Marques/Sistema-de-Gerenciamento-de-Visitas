import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { getDb, saveDatabase } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANTIGO_CSV = path.join(__dirname, "..", "dados", "antigo.csv");

interface CsvRow {
    Matricula: string;
    "Nome da conta": string;
    Filial: string;
}

export function executarResgateIds() {
    console.log("==========================================");
    console.log("🚀 INICIANDO SCRIPT DE RESGATE DE IDs 🚀");
    console.log("==========================================\n");

    if (!fs.existsSync(ANTIGO_CSV)) {
        console.error("❌ ERRO: Arquivo 'antigo.csv' não encontrado na pasta 'dados/'.");
        console.error("Coloque a planilha original de cooperados na pasta dados e a renomeie para 'antigo.csv'.");
        return;
    }

    try {
        const csvText = fs.readFileSync(ANTIGO_CSV, "utf-8");
        const records: CsvRow[] = parse(csvText, {
            delimiter: ";",
            columns: true,
            skip_empty_lines: true,
            trim: true,
            quote: '"',
        });

        console.log(`📊 ${records.length} linhas lidas do antigo.csv`);

        // Recriar a lógica exata de iteração que gerou os IDs originais (1 a N)
        const oldIdsMap = new Map<number, string>(); // old_id -> matricula
        const matriculasVistas = new Set<string>();
        let currentOldId = 1;

        for (const row of records) {
            const matricula = row.Matricula?.trim();
            const nome = row["Nome da conta"]?.trim();
            const filialRaw = row.Filial?.trim();
            if (!matricula || !nome || !filialRaw) continue;

            if (!matriculasVistas.has(matricula)) {
                matriculasVistas.add(matricula);
                oldIdsMap.set(currentOldId, matricula);
                currentOldId++;
            }
        }

        console.log(`   🔸 ${oldIdsMap.size} IDs originais simulados mapeados.`);

        const db = getDb();

        // Pegar todos os cooperados ATUAIS do banco gerados hoje
        const queryCooperados = db.exec("SELECT id, matricula FROM cooperados");
        const newIdsMap = new Map<string, number>(); // matricula -> new_id
        if (queryCooperados.length > 0) {
            for (const row of queryCooperados[0].values) {
                newIdsMap.set(row[1] as string, row[0] as number);
            }
        }

        console.log(`   🔸 ${newIdsMap.size} cooperados encontrados no Banco Atual.`);

        // Criar o DE/PARA final
        const deParaMap = new Map<number, number>(); // old_id -> new_id
        let mappedCount = 0;
        let missingCount = 0;

        for (const [oldId, matricula] of oldIdsMap) {
            const newId = newIdsMap.get(matricula);
            if (newId) {
                deParaMap.set(oldId, newId);
                mappedCount++;
            } else {
                missingCount++;
            }
        }

        console.log(`   🔸 De/Para montado: ${mappedCount} equivalências encontradas! (Faltaram: ${missingCount})\n`);

        // INICIAR RESGATE
        console.log("🔄 Atualizando tabela PLANEJAMENTO...");
        const queryPlan = db.exec("SELECT id, cooperado_id FROM planejamento WHERE cooperado_id IS NOT NULL");
        let planAtualizados = 0;

        if (queryPlan.length > 0) {
            db.run("BEGIN TRANSACTION;");
            for (const row of queryPlan[0].values) {
                const idPlanejamento = row[0] as number;
                const oldCooperadoId = row[1] as number;

                const newCooperadoId = deParaMap.get(oldCooperadoId);
                if (newCooperadoId && newCooperadoId !== oldCooperadoId) {
                    db.run("UPDATE planejamento SET cooperado_id = ? WHERE id = ?", [newCooperadoId, idPlanejamento]);
                    planAtualizados++;
                }
            }
            db.run("COMMIT;");
        }

        console.log("🔄 Atualizando tabela VISITAS (Histórico)...");
        const queryVis = db.exec("SELECT id, cooperado_id FROM visitas WHERE cooperado_id IS NOT NULL");
        let visAtualizadas = 0;

        if (queryVis.length > 0) {
            db.run("BEGIN TRANSACTION;");
            for (const row of queryVis[0].values) {
                const idVisita = row[0] as number;
                const oldCooperadoId = row[1] as number;

                const newCooperadoId = deParaMap.get(oldCooperadoId);
                if (newCooperadoId && newCooperadoId !== oldCooperadoId) {
                    db.run("UPDATE visitas SET cooperado_id = ? WHERE id = ?", [newCooperadoId, idVisita]);
                    visAtualizadas++;
                }
            }
            db.run("COMMIT;");
        }

        saveDatabase();

        console.log("\n==========================================");
        console.log("✅ RESGATE CONCLUÍDO COM SUCESSO! ✅");
        console.log(`🗓️  Planejamentos corrigidos: ${planAtualizados}`);
        console.log(`🤝 Visitas corrigidas: ${visAtualizadas}`);
        console.log("==========================================\n");

    } catch (err) {
        console.error("❌ ERRO GRAVE DURANTE O RESGATE: ", err);
    }
}

// Executa caso rodado diretamente
executarResgateIds();

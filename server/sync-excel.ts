import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";
import { getDb, saveDatabase } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function sincronizarUsuariosExcel() {
    const usuariosPath = path.join(__dirname, "..", "dados", "RELAÇÃO COMPLETA TDMs e ADMs.xlsx");
    if (!fs.existsSync(usuariosPath)) {
        console.warn(`⚠️ Arquivo de colaboradores não encontrado para auto-sync: ${usuariosPath}`);
        return;
    }

    try {
        const wb = xlsx.readFile(usuariosPath);
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const usuariosRecords = xlsx.utils.sheet_to_json(ws);

        console.log(`\n🔄 [AUTO-SYNC] Lendo ${usuariosRecords.length} colaboradores da planilha para autorização/cargos...`);
        const db = getDb();
        let celularesCount = 0;

        for (const row of usuariosRecords as any[]) {
            // Mapeamento dinâmico considerando diferentes nomes de colunas que podem ser alterados pelo usuário
            const celularRaw = row["CELULAR CXP"] || row["Celular CXP"] || row["Celular"] || row["celular"];
            const matriculaRaw = row["CÓDIGO"] || row["Código"] || row["Matricula"] || row["matricula"];
            const nomeRaw = row["COLABORADOR(A)"] || row["Colaborador(a)"] || row["Nome"] || row["nome"];
            const cargoRaw = row["CARGO."] || row["CARGO"] || row["Cargo"] || row["cargo"];
            const fornecedorRaw = row["FORNECEDOR"] || row["Fornecedor"];

            if (!celularRaw) continue;

            const celularClean = String(celularRaw).replace(/\D/g, "");
            if (celularClean.length < 10) continue; // Precisa do DDD no mínimo

            try {
                db.run(
                    "INSERT OR REPLACE INTO celulares_autorizados (numero, matricula, nome, cargo, fornecedor, ativo) VALUES (?, ?, ?, ?, ?, 1)",
                    [
                        celularClean,
                        matriculaRaw?.toString().trim() || null,
                        nomeRaw?.toString().trim() || null,
                        cargoRaw?.toString().trim() || null,
                        fornecedorRaw?.toString().trim() || null
                    ]
                );
                celularesCount++;
            } catch (e) {
                console.error("Erro no auto-sync do celular", celularClean, e);
            }
        }

        // Mantém a garantia do número Master/Guilherme caso algo dê errado
        try {
            db.run(
                "INSERT OR REPLACE INTO celulares_autorizados (numero, matricula, nome, cargo, ativo) VALUES (?, ?, ?, ?, 1)",
                ["3597786623", "82534", "Guilherme Marques", "Administrador"]
            );
            celularesCount++;
            console.log(`🛡️  [GARANTIA ATIVADA] Forçado a autorização do Guilherme: 3597786623`);
        } catch (e) { }

        console.log(`✅ [AUTO-SYNC] ${celularesCount} celulares autorizados atualizados no SQLite com sucesso.\n`);
        saveDatabase();
    } catch (error) {
        console.error("❌ Erro no Auto-Sync de usuários do Excel:", error);
    }
}

let timeoutId: NodeJS.Timeout | null = null;

export function iniciarObservadorExcel() {
    const usuariosPath = path.join(__dirname, "..", "dados", "RELAÇÃO COMPLETA TDMs e ADMs.xlsx");

    if (!fs.existsSync(usuariosPath)) {
        console.warn(`⚠️ Arquivo de colaboradores não encontrado para o File Watcher: ${usuariosPath}`);
        return;
    }

    console.log(`\n👀 [FILE WATCHER] Monitorando a planilha em tempo real...`);
    console.log(`   (Qualquer salvamento no Excel atualizará a base automaticamente)`);

    // fs.watchFile has better compatibility for overwrite saves than fs.watch
    fs.watchFile(usuariosPath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) {
            if (timeoutId) clearTimeout(timeoutId);

            timeoutId = setTimeout(() => {
                console.log(`\n📄 [FILE WATCHER] Planilha Excel salva! Detectada mudança às ${new Date().toLocaleTimeString('pt-BR')}`);
                sincronizarUsuariosExcel();
            }, 1000);
        }
    });
}

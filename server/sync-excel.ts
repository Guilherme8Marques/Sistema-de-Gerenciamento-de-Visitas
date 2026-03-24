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
                // Proteção Blacklist
                const blacklistCheck = db.exec("SELECT id FROM blacklist WHERE celular = ?", [celularClean]);
                if (blacklistCheck.length > 0 && blacklistCheck[0].values.length > 0) {
                    console.log(`🚫 [AUTO-SYNC] Ignorando ${nomeRaw} (${celularClean}) pois está na Blacklist.`);
                    continue;
                }

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

        console.log(`✅ [AUTO-SYNC] ${celularesCount} celulares autorizados atualizados no SQLite com sucesso.`);

        // ── Segunda passagem: Sincronizar dados dos USUÁRIOS existentes ──
        // Se o nome ou cargo mudou na planilha, atualizar na tabela `users` também.
        let usersAtualizados = 0;
        for (const row of usuariosRecords as any[]) {
            const celularRaw = row["CELULAR CXP"] || row["Celular CXP"] || row["Celular"] || row["celular"];
            const nomeRaw = row["COLABORADOR(A)"] || row["Colaborador(a)"] || row["Nome"] || row["nome"];
            const cargoRaw = row["CARGO."] || row["CARGO"] || row["Cargo"] || row["cargo"];

            if (!celularRaw) continue;

            const celularClean = String(celularRaw).replace(/\D/g, "");
            if (celularClean.length < 10) continue;

            const nomeLimpo = nomeRaw?.toString().trim() || null;
            const cargoLimpo = cargoRaw?.toString().trim() || "consultor";

            // Gerar variantes com e sem o 9° dígito
            const ddd = celularClean.slice(0, 2);
            const rest = celularClean.slice(2);
            const variants: string[] = [];
            if (rest.length === 9 && rest.startsWith("9")) {
                variants.push(ddd + rest.slice(1), celularClean);
            } else if (rest.length === 8) {
                variants.push(celularClean, ddd + "9" + rest);
            } else {
                variants.push(celularClean);
            }

            try {
                const placeholders = variants.map(() => "?").join(", ");
                const userResult = db.exec(
                    `SELECT id, nome, role FROM users WHERE celular IN (${placeholders})`,
                    variants
                );

                if (userResult.length > 0 && userResult[0].values.length > 0) {
                    const userId = userResult[0].values[0][0] as number;
                    const nomeAtual = userResult[0].values[0][1] as string;
                    const roleAtual = userResult[0].values[0][2] as string;

                    const mudouNome = nomeLimpo && nomeLimpo !== nomeAtual;
                    const mudouCargo = cargoLimpo !== roleAtual;

                    if (mudouNome || mudouCargo) {
                        db.run(
                            "UPDATE users SET nome = COALESCE(?, nome), role = ? WHERE id = ?",
                            [nomeLimpo, cargoLimpo, userId]
                        );
                        usersAtualizados++;
                    }
                }
            } catch (e) {
                // Silencioso — não interromper sync por causa de um user
            }
        }

        if (usersAtualizados > 0) {
            console.log(`🔄 [AUTO-SYNC] ${usersAtualizados} usuário(s) atualizados com dados da planilha (nome/cargo).`);
        }

        console.log(`\n`);
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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";
import { getDb, saveDatabase } from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Remove zeros à esquerda e espaços. "05585" -> "5585", " 123 " -> "123" */
export function normalizeMatricula(raw: string | number | null | undefined): string {
    if (raw == null) return "";
    return String(raw).trim().replace(/^0+/, "") || "0";
}

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
            const matriculaRaw = row["Cadastro"] || row["CÓDIGO"] || row["Matrícula"] || row["cadastro"] || row["Código"] || row["matricula"];
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
        // Busca por MATRÍCULA primeiro (âncora estável), depois por celular como fallback.
        // Se o celular mudou no Excel, atualiza o cadastro do usuário automaticamente.
        let usersAtualizados = 0;
        for (const row of usuariosRecords as any[]) {
            const celularRaw = row["CELULAR CXP"] || row["Celular CXP"] || row["Celular"] || row["celular"];
            const nomeRaw = row["COLABORADOR(A)"] || row["Colaborador(a)"] || row["Nome"] || row["nome"];
            const cargoRaw = row["CARGO."] || row["CARGO"] || row["Cargo"] || row["cargo"];
            const fornecedorRaw = row["FORNECEDOR"] || row["Fornecedor"];
            const matriculaRaw = row["Cadastro"] || row["CÓDIGO"] || row["Matrícula"] || row["cadastro"] || row["Código"] || row["matricula"];

            if (!celularRaw) continue;

            const celularClean = String(celularRaw).replace(/\D/g, "");
            if (celularClean.length < 10) continue;

            const nomeLimpo = nomeRaw?.toString().trim() || null;
            const cargoLimpo = cargoRaw?.toString().trim() || "consultor";
            const fornecedorLimpo = fornecedorRaw?.toString().trim() || null;
            const matNorm = normalizeMatricula(matriculaRaw);

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
                // 1) Buscar primeiro pela MATRÍCULA (âncora estável)
                let userId: number | null = null;
                let nomeAtual = "";
                let roleAtual = "";
                let fornecedorAtual = "";
                let celularAtual = "";

                if (matNorm) {
                    const byMat = db.exec(
                        "SELECT id, nome, role, fornecedor, celular, matricula FROM users WHERE LTRIM(matricula, '0') = ? OR matricula = ?",
                        [matNorm, matriculaRaw]
                    );
                    if (byMat.length > 0 && byMat[0].values.length > 0) {
                        userId = byMat[0].values[0][0] as number;
                        nomeAtual = byMat[0].values[0][1] as string;
                        roleAtual = byMat[0].values[0][2] as string;
                        fornecedorAtual = byMat[0].values[0][3] as string;
                        celularAtual = byMat[0].values[0][4] as string;
                        const matriculaDB = byMat[0].values[0][5] as string || "";
                        // Fallback: se a matrícula no banco for diferente (mesmo normalizada), forçamos o update
                        if (normalizeMatricula(matriculaDB) !== matNorm) {
                             // Isso garante a cura automática se o ID for o mesmo mas a matrícula mudou
                        }
                    }
                }

                // 2) Fallback 1: buscar pelo celular (para usuários antigos sem matrícula normalizada)
                if (!userId) {
                    const placeholders = variants.map(() => "?").join(", ");
                    const byTel = db.exec(
                        `SELECT id, nome, role, fornecedor, celular, matricula FROM users WHERE celular IN (${placeholders})`,
                        variants
                    );
                    if (byTel.length > 0 && byTel[0].values.length > 0) {
                        userId = byTel[0].values[0][0] as number;
                        nomeAtual = byTel[0].values[0][1] as string;
                        roleAtual = byTel[0].values[0][2] as string;
                        fornecedorAtual = byTel[0].values[0][3] as string;
                        celularAtual = byTel[0].values[0][4] as string;
                    }
                }

                if (userId) {
                    // Buscar a matrícula atual novamente para garantir a detecção correta de mudança
                    const userCheck = db.exec("SELECT matricula FROM users WHERE id = ?", [userId]);
                    const matriculaAtual = userCheck.length > 0 ? (userCheck[0].values[0][0] as string || "") : "";

                    const mudouNome = (nomeLimpo || "") !== (nomeAtual || "");
                    const mudouCargo = (cargoLimpo || "consultor") !== (roleAtual || "consultor");
                    const mudouFornecedor = (fornecedorLimpo || "") !== (fornecedorAtual || "");
                    const mudouMatricula = matNorm !== normalizeMatricula(matriculaAtual);
                    // Verificar se o celular mudou (compara variantes)
                    const mudouCelular = !variants.includes(celularAtual);

                    if (mudouNome || mudouCargo || mudouFornecedor || mudouCelular || mudouMatricula) {
                        const updates: string[] = [];
                        const params: any[] = [];

                        if (mudouNome && nomeLimpo) { updates.push("nome = ?"); params.push(nomeLimpo); }
                        updates.push("role = ?"); params.push(cargoLimpo);
                        updates.push("fornecedor = ?"); params.push(fornecedorLimpo);
                        if (mudouCelular) {
                            updates.push("celular = ?"); params.push(celularClean);
                            console.log(`📱 [MIGRAÇÃO] Celular do usuário ${nomeAtual} (ID: ${userId}) atualizado: ${celularAtual} → ${celularClean}`);
                        }
                        if (matNorm) { updates.push("matricula = ?"); params.push(matNorm); }
                        params.push(userId);

                        db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
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

        // ── Terceira passagem: Sincronizar RELAÇÃO COMPLETA (Acompanhantes) ──
        // Lemos o arquivo "colaboradores.xlsx" para popular a equipe_vendas 
        // e permitir que o campo de "Acompanhado por" busque todos os ~300 funcionários.
        const compPath = path.join(__dirname, "..", "dados", "colaboradores.xlsx");
        if (fs.existsSync(compPath)) {
            try {
                const compWb = xlsx.readFile(compPath);
                const compWs = compWb.Sheets[compWb.SheetNames[0]];
                // A planilha tem 5 linhas de cabeçalho de relatório inúteis. Usamos range: 5
                const compRecords = xlsx.utils.sheet_to_json(compWs, { range: 5 });
                // Desativar todos para garantir que apenas os do Excel atual fiquem ativos
                db.run("UPDATE equipe_vendas SET ativo = 0");

                let countEquipeVendas = 0;

                for (const row of compRecords as any[]) {
                    // Coluna A (Cadastro = Matrícula), Coluna B (Nome), Coluna D (__EMPTY = Dept/Cargo)
                    const matRaw = row["Cadastro"] || row["cadastro"] || row["CADASTRO"];
                    const nomeRaw = row["Nome"] || row["nome"] || row["NOME"];
                    const cargoRaw = row["__EMPTY"] || row["Dept"] || row["dept"];

                    if (!matRaw || !nomeRaw) continue;

                    const matStr = String(matRaw).trim();
                    const nomeStr = String(nomeRaw).trim();
                    const cargoStr = cargoRaw ? String(cargoRaw).trim() : "Colaborador";

                    // Upsert into equipe_vendas
                    const checkExist = db.exec("SELECT id FROM equipe_vendas WHERE matricula = ?", [matStr]);
                    if (checkExist.length > 0 && checkExist[0].values.length > 0) {
                        db.run(
                            "UPDATE equipe_vendas SET nome = ?, cargo = ?, ativo = 1 WHERE matricula = ?",
                            [nomeStr, cargoStr, matStr]
                        );
                    } else {
                        // Se não tiver fornecedor definido no ADM/TDM, deixamos como nulo
                        db.run(
                            "INSERT INTO equipe_vendas (nome, matricula, cargo, ativo) VALUES (?, ?, ?, 1)",
                            [nomeStr, matStr, cargoStr]
                        );
                    }
                    countEquipeVendas++;
                }
                console.log(`✅ [AUTO-SYNC] ${countEquipeVendas} funcionários globais listados e disponíveis para "Acompanhado por".`);
            } catch (e) {
                console.error("Erro ao processar colaboradores.xlsx:", e);
            }
        } else {
            console.log("⚠️ [AUTO-SYNC] Arquivo colaboradores.xlsx não encontrado na pasta 'dados'.");
        }

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
                console.log(`\n📄 [FILE WATCHER] Planilha Excel (TDMs e ADMs) salva! Detectada mudança às ${new Date().toLocaleTimeString('pt-BR')}`);
                sincronizarUsuariosExcel();
            }, 1000);
        }
    });

    // Assistir também o colaboradores.xlsx
    const compPath = path.join(__dirname, "..", "dados", "colaboradores.xlsx");
    if (fs.existsSync(compPath)) {
        console.log(`👀 [FILE WATCHER] Monitorando lista global de colaboradores (colaboradores.xlsx)...`);
        fs.watchFile(compPath, { interval: 1000 }, (curr, prev) => {
            if (curr.mtimeMs !== prev.mtimeMs) {
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    console.log(`\n📄 [FILE WATCHER] Planilha Excel (Globais) salva! Detectada mudança às ${new Date().toLocaleTimeString('pt-BR')}`);
                    sincronizarUsuariosExcel();
                }, 1000);
            }
        });
    }
}

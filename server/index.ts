import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase, getDb, saveDatabase, releaseDatabaseOwnership } from "./database.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import xlsx from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routes
import authRoutes from "./routes/auth.js";
import cooperadosRoutes from "./routes/cooperados.js";
import planejamentoRoutes from "./routes/planejamento.js";
import registroRoutes from "./routes/registro.js";
import relatoriosRoutes from "./routes/relatorios.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import equipeRoutes from "./routes/equipe.js";
import { sincronizarUsuariosExcel, iniciarObservadorExcel } from "./sync-excel.js";
import { sincronizarCooperadosCSV, iniciarObservadorCooperados } from "./sync-cooperados.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Evitar cache no navegador para as requisicoes da API
app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../dist")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cooperados", cooperadosRoutes);
app.use("/api/planejamento", planejamentoRoutes);
app.use("/api/registro", registroRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/equipe", equipeRoutes);

// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, "../dist/index.html"));
    } else {
        res.status(404).json({ error: "API endpoint not found" });
    }
});

// ============================================================
// REMOVIDO: setInterval de auto-save a cada 30 segundos.
//
// MOTIVO: Este era o CAUSADOR da perda de dados.
// Processos fantasma (de restarts anteriores que nao morreram)
// tinham seu proprio setInterval rodando com um banco VAZIO na
// memoria, sobrescrevendo o arquivo database.db a cada 30s.
//
// SOLUCAO: Cada rota (auth, planejamento, registro) ja chama
// saveDatabase() apos cada INSERT/UPDATE/DELETE. Nao ha mais
// necessidade de saves periodicos.
// ============================================================

// Graceful shutdown - salvar banco antes de fechar
process.on("SIGINT", () => {
    console.log("\n💾 Salvando banco de dados...");
    saveDatabase();
    releaseDatabaseOwnership();
    console.log("👋 Servidor encerrado.");
    process.exit(0);
});

process.on("SIGTERM", () => {
    saveDatabase();
    releaseDatabaseOwnership();
    process.exit(0);
});

// Start
async function start() {
    await initDatabase();

    // Sincronizar dados do Excel e CSV na inicializacao
    sincronizarUsuariosExcel();
    sincronizarCooperadosCSV();

    // Diagnostico de dados
    const db = getDb();
    try {
        const coops = db.exec("SELECT COUNT(*) FROM cooperados")[0].values[0][0];
        const filiais = db.exec("SELECT COUNT(*) FROM filiais")[0].values[0][0];
        console.log(`📊 [BANCO] Cooperados: ${coops} | Filiais: ${filiais}`);
        if (coops === 0) {
            console.warn("⚠️  [AVISO] A tabela de cooperados esta VAZIA!");
        }
    } catch (e) {
        console.warn("⚠️  [AVISO] Nao foi possivel ler estatisticas do banco na inicializacao.");
    }

    // ── MIGRACAO AUTOMATICA: corrigir cooperado_id orfaos em planejamento/visitas ──
    // Isso corrige o estrago causado pelo antigo sync-cooperados que fazia DELETE FROM.
    // Roda a cada startup e e idempotente (nao faz nada se nao houver orfaos).
    try {
        const matResult = db.exec("SELECT id, matricula FROM cooperados ORDER BY id");
        const matToId = new Map<string, number>();
        if (matResult.length > 0) {
            for (const row of matResult[0].values) matToId.set(row[1] as string, row[0] as number);
        }

        const totalCoops = matToId.size;
        if (totalCoops > 0) {
            // Mapa posicao (1-based) -> matricula (reproduz a ordem de insercao original)
            const posToMat = new Map<number, string>();
            let pos = 1;
            for (const [mat] of matToId) {
                posToMat.set(pos, mat);
                pos++;
            }

            // Corrigir planejamento orfao (cooperado_id aponta para ID inexistente)
            const planOrfaos = db.exec(
                `SELECT p.id, p.cooperado_id FROM planejamento p 
                 LEFT JOIN cooperados c ON p.cooperado_id = c.id 
                 WHERE p.cooperado_id IS NOT NULL AND c.id IS NULL`
            );
            let planFixed = 0;
            if (planOrfaos.length > 0 && planOrfaos[0].values.length > 0) {
                console.log(`🔧 [MIGRACAO] ${planOrfaos[0].values.length} planejamentos orfaos detectados.`);
                for (const row of planOrfaos[0].values) {
                    const planId = row[0] as number;
                    const oldCoopId = row[1] as number;
                    // Calculo ciclico: o ID antigo pertence a uma "geracao" de INSERT.
                    // Usando modulo para voltar a posicao original.
                    const originalPos = ((oldCoopId - 1) % totalCoops) + 1;
                    const mat = posToMat.get(originalPos);
                    if (mat) {
                        const newId = matToId.get(mat);
                        if (newId) {
                            db.run("UPDATE planejamento SET cooperado_id = ? WHERE id = ?", [newId, planId]);
                            planFixed++;
                        }
                    }
                }
                console.log(`   ✅ Planejamentos corrigidos: ${planFixed}`);
            }

            // Corrigir visitas orfas
            const visOrfaos = db.exec(
                `SELECT v.id, v.cooperado_id FROM visitas v 
                 LEFT JOIN cooperados c ON v.cooperado_id = c.id 
                 WHERE v.cooperado_id IS NOT NULL AND c.id IS NULL`
            );
            let visFixed = 0;
            if (visOrfaos.length > 0 && visOrfaos[0].values.length > 0) {
                console.log(`🔧 [MIGRACAO] ${visOrfaos[0].values.length} visitas orfas detectadas.`);
                for (const row of visOrfaos[0].values) {
                    const visId = row[0] as number;
                    const oldCoopId = row[1] as number;
                    const originalPos = ((oldCoopId - 1) % totalCoops) + 1;
                    const mat = posToMat.get(originalPos);
                    if (mat) {
                        const newId = matToId.get(mat);
                        if (newId) {
                            db.run("UPDATE visitas SET cooperado_id = ? WHERE id = ?", [newId, visId]);
                            visFixed++;
                        }
                    }
                }
                console.log(`   ✅ Visitas corrigidas: ${visFixed}`);
            }

            if (planFixed === 0 && visFixed === 0) {
                console.log("✅ [MIGRACAO] Nenhum cooperado_id orfao. Tudo saudavel!");
            }
        }
    } catch (migErr) {
        console.error("⚠️  [MIGRACAO] Erro ao corrigir IDs orfaos:", migErr);
    }

    // Salvar o estado do banco apos sync + migracao
    saveDatabase();

    // Inicia os file watchers para sincronizacao em tempo real
    iniciarObservadorExcel();
    iniciarObservadorCooperados();

    app.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
        console.log(`🌍 Acesso na rede local em http://0.0.0.0:${PORT}`);
        console.log(`📡 API disponivel em http://localhost:${PORT}/api`);
        console.log(`💚 Health check: http://localhost:${PORT}/api/health\n`);
    });
}

start().catch(console.error);

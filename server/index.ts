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

    // ── DIAGNÓSTICO: contar cooperado_ids órfãos (READ-ONLY, sem alterar nada) ──
    // A antiga migração automática por módulo (%) foi REMOVIDA pois comprovou-se
    // que ligava visitas aos cooperados ERRADOS. O sync-cooperados atual já usa
    // UPSERT e preserva IDs, então órfãos não devem mais aparecer.
    try {
        const planOrfaos = db.exec(
            `SELECT COUNT(*) FROM planejamento p
             LEFT JOIN cooperados c ON p.cooperado_id = c.id
             WHERE p.cooperado_id IS NOT NULL AND c.id IS NULL`
        );
        const visOrfaos = db.exec(
            `SELECT COUNT(*) FROM visitas v
             LEFT JOIN cooperados c ON v.cooperado_id = c.id
             WHERE v.cooperado_id IS NOT NULL AND c.id IS NULL`
        );
        const planCount = planOrfaos.length > 0 ? planOrfaos[0].values[0][0] as number : 0;
        const visCount = visOrfaos.length > 0 ? visOrfaos[0].values[0][0] as number : 0;

        if (planCount === 0 && visCount === 0) {
            console.log("✅ [MIGRACAO] Nenhum cooperado_id orfao. Tudo saudavel!");
        } else {
            if (planCount > 0) console.warn(`⚠️  [DIAGNOSTICO] ${planCount} planejamentos com cooperado_id orfao (sem correcao automatica).`);
            if (visCount > 0) console.warn(`⚠️  [DIAGNOSTICO] ${visCount} visitas com cooperado_id orfao (sem correcao automatica).`);
        }
    } catch (migErr) {
        console.error("⚠️  [DIAGNOSTICO] Erro ao verificar IDs orfaos:", migErr);
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

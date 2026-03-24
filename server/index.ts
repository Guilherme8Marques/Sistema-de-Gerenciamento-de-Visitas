import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase, saveDatabase, releaseDatabaseOwnership } from "./database.js";
import path from "path";
import { fileURLToPath } from "url";

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
import { sincronizarUsuariosExcel, iniciarObservadorExcel } from "./sync-excel.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Evitar cache no navegador para as requisições da API
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
// Processos fantasma (de restarts anteriores que não morreram)
// tinham seu próprio setInterval rodando com um banco VAZIO na
// memória, sobrescrevendo o arquivo database.db a cada 30s.
//
// SOLUÇÃO: Cada rota (auth, planejamento, registro) já chama
// saveDatabase() após cada INSERT/UPDATE/DELETE. Não há mais
// necessidade de saves periódicos.
// ============================================================

// Graceful shutdown — salvar banco antes de fechar
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

    // Auto-sync silenciosamente usuários da planilha pro banco SQLite no boot
    sincronizarUsuariosExcel();
    // Salvar o estado do banco após sync (garante que o sync é persistido)
    saveDatabase();

    // Inicia o file watcher para sincronização em tempo real (on-save do Excel)
    iniciarObservadorExcel();

    app.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
        console.log(`🌍 Acesso na rede local em http://0.0.0.0:${PORT}`);
        console.log(`📡 API disponível em http://localhost:${PORT}/api`);
        console.log(`💚 Health check: http://localhost:${PORT}/api/health\n`);
    });
}

start().catch(console.error);

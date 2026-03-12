/**
 * Script para gerar carga de dados de demonstração.
 * Cria vários "consultores" com planejamentos e visitas
 * para popular o Dashboard para apresentações.
 * Gera dados para o mês ATUAL e o próximo mês.
 *
 * USO: npx tsx scripts/seed-demo-data.ts
 * ATENÇÃO: Pare o servidor antes de rodar!
 */
import bcrypt from "bcryptjs";
import { initDatabase, getDb, saveDatabase } from "../server/database.js";

// Nomes fictícios de consultores
const CONSULTORES = [
    { nome: "Lívia Gonçalves", matricula: "C001", celular: "35900000001" },
    { nome: "Elisabeth Rocha", matricula: "C002", celular: "35900000002" },
    { nome: "Alexandre Silva", matricula: "C003", celular: "35900000003" },
    { nome: "Djair Filho", matricula: "C004", celular: "35900000004" },
    { nome: "Esdras Ribeiro", matricula: "C005", celular: "35900000005" },
    { nome: "Jefferson dos Santos Batista", matricula: "C006", celular: "35900000006" },
    { nome: "Lucas Madeira", matricula: "C007", celular: "35900000007" },
    { nome: "Hiago Santos", matricula: "C008", celular: "35900000008" },
    { nome: "Evaldo Pereira", matricula: "C009", celular: "35900000009" },
    { nome: "Bruno Campos", matricula: "C010", celular: "35900000010" },
];

// Resultados possíveis
const RESULTADOS = [
    "Atendimento",
    "Negociação",
    "Avaliação do Campo Experimental",
    "Atendimento",
    "Atendimento", // Peso maior para atendimento
];

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Gera planejamentos + visitas para um mês específico.
 * Se somentePlanejamento=true, gera apenas planejamentos (mês futuro).
 */
function gerarDadosMes(
    db: ReturnType<typeof getDb>,
    consultorIds: number[],
    cooperadoIds: number[],
    year: number,
    month: number,             // 0-indexed
    maxDay: number,            // até que dia gerar (inclusive)
    somentePlanejamento: boolean
): { planejamentos: number; visitas: number } {
    let totalPlanejado = 0;
    let totalVisitas = 0;
    const mesStr = String(month + 1).padStart(2, "0");

    for (const userId of consultorIds) {
        for (let day = 1; day <= maxDay; day++) {
            const date = new Date(year, month, day);
            const dow = date.getDay();
            if (dow === 0 || dow === 6) continue;

            const dateStr = `${year}-${mesStr}-${String(day).padStart(2, "0")}`;
            const numPlanejado = randomInt(3, 5);

            for (let i = 0; i < numPlanejado; i++) {
                const cooperadoId = randomItem(cooperadoIds);
                try {
                    db.run(
                        "INSERT INTO planejamento (user_id, data_planejada, tipo, cooperado_id, semana) VALUES (?, ?, 'visita', ?, 'atual')",
                        [userId, dateStr, cooperadoId]
                    );
                    totalPlanejado++;
                } catch { /* ignore */ }
            }

            // Gerar visitas somente para o mês atual (passado)
            if (!somentePlanejamento) {
                const taxaRealizacao = Math.random() * 0.3 + 0.6;
                const numVisitas = Math.round(numPlanejado * taxaRealizacao);

                for (let i = 0; i < numVisitas; i++) {
                    const cooperadoId = randomItem(cooperadoIds);
                    const resultado = randomItem(RESULTADOS);
                    const doencas = resultado === "Avaliação do Campo Experimental"
                        ? JSON.stringify(["Ferrugem", "Bicho-Mineiro"])
                        : "[]";

                    try {
                        db.run(
                            `INSERT INTO visitas (user_id, cooperado_id, data_visita, resultado, doencas_pragas, extra)
                             VALUES (?, ?, ?, ?, ?, 0)`,
                            [userId, cooperadoId, dateStr, resultado, doencas]
                        );
                        totalVisitas++;
                    } catch { /* ignore */ }
                }
            }
        }
    }

    return { planejamentos: totalPlanejado, visitas: totalVisitas };
}

async function seedDemoData() {
    await initDatabase();
    const db = getDb();

    const senhaHash = await bcrypt.hash("demo123", 10);

    // Pegar cooperados existentes
    const cooperadosResult = db.exec("SELECT id FROM cooperados LIMIT 200");
    const cooperadoIds: number[] = cooperadosResult.length > 0
        ? cooperadosResult[0].values.map((r) => r[0] as number)
        : [];

    if (cooperadoIds.length === 0) {
        console.error("❌ Nenhum cooperado encontrado. Rode o import-dados primeiro.");
        return;
    }

    // Autorizar celulares demo
    for (const c of CONSULTORES) {
        try {
            db.run(
                "INSERT OR IGNORE INTO celulares_autorizados (numero, ativo) VALUES (?, 1)",
                [c.celular]
            );
        } catch { /* já existe */ }
    }

    // Criar consultores
    const consultorIds: number[] = [];
    for (const c of CONSULTORES) {
        try {
            db.run(
                "INSERT OR IGNORE INTO users (nome, matricula, celular, senha_hash, role) VALUES (?, ?, ?, ?, 'consultor')",
                [c.nome, c.matricula, c.celular, senhaHash]
            );
        } catch { /* já existe */ }

        const result = db.exec("SELECT id FROM users WHERE celular = ?", [c.celular]);
        if (result.length > 0 && result[0].values.length > 0) {
            consultorIds.push(result[0].values[0][0] as number);
        }
    }

    console.log(`👥 ${consultorIds.length} consultores prontos`);

    // ── Mês ATUAL: planejamentos + visitas ──
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const mesAtual = gerarDadosMes(db, consultorIds, cooperadoIds, year, month, Math.min(today, daysInMonth), false);
    const mesAtualLabel = `${String(month + 1).padStart(2, "0")}/${year}`;

    // ── Próximo MÊS: somente planejamentos ──
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const nextMonthAdj = nextMonth > 11 ? 0 : nextMonth;
    const daysInNextMonth = new Date(nextYear, nextMonthAdj + 1, 0).getDate();

    const proxMes = gerarDadosMes(db, consultorIds, cooperadoIds, nextYear, nextMonthAdj, daysInNextMonth, true);
    const proxMesLabel = `${String(nextMonthAdj + 1).padStart(2, "0")}/${nextYear}`;

    saveDatabase();
    console.log(`\n📊 Dados de demonstração gerados:`);
    console.log(`\n   📅 Mês atual (${mesAtualLabel}):`);
    console.log(`      Planejamentos: ${mesAtual.planejamentos}`);
    console.log(`      Visitas:       ${mesAtual.visitas}`);
    console.log(`\n   📅 Próximo mês (${proxMesLabel}):`);
    console.log(`      Planejamentos: ${proxMes.planejamentos}`);
    console.log(`      Visitas:       ${proxMes.visitas} (somente planejamento)`);
    console.log(`\n   Consultores: ${consultorIds.length}`);
    console.log(`\n✅ Pronto! Reinicie o servidor.`);
}

seedDemoData().catch(console.error);


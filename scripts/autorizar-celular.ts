import { initDatabase, getDb, saveDatabase } from "../server/database.js";

const celular = process.argv[2];

if (!celular) {
    console.log("❌ Erro: Você esqueceu de passar o número.");
    console.log("Uso correto: npx tsx scripts/autorizar-celular.ts 35900000000");
    process.exit(1);
}

async function authorize() {
    console.log("🔄 Inicializando banco de dados...");
    await initDatabase();
    const db = getDb();
    
    // Limpar o número (manter apenas dígitos)
    const celularClean = celular.replace(/\D/g, "");
    
    if (celularClean.length < 10) {
        console.error("❌ Erro: O número parece ser inválido (inclua o DDD).");
        process.exit(1);
    }
    
    db.run(
        "INSERT OR REPLACE INTO celulares_autorizados (numero, nome, cargo, ativo) VALUES (?, ?, ?, 1)",
        [celularClean, "Administrador Manual", "Administrador"]
    );
    
    saveDatabase();
    console.log(`\n✅ SUCESSO!`);
    console.log(`📱 Celular ${celularClean} foi autorizado como Administrador.`);
    console.log("🚀 Agora você pode ir na tela de 'Cadastro' no site e criar sua conta.");
    process.exit(0);
}

authorize().catch((err) => {
    console.error("❌ Erro ao autorizar celular:", err);
    process.exit(1);
});

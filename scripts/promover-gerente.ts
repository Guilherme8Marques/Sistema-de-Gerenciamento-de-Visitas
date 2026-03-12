import { initDatabase, getDb, saveDatabase } from '../server/database.js';

async function run() {
    const celular = process.argv[2];
    if (!celular) {
        console.error("❌ ERRO: Informe o número do celular. Exemplo: npx tsx scripts/promover-gerente.ts 3597786623");
        process.exit(1);
    }

    const celularClean = celular.replace(/\D/g, "");

    await initDatabase();
    const db = getDb();

    // Verifica se usuário existe
    const userResult = db.exec("SELECT id, nome FROM users WHERE celular = ?", [celularClean]);

    if (userResult.length === 0 || userResult[0].values.length === 0) {
        console.log(`⚠️ Usuário com celular ${celularClean} não encontrado no sistema.`);
        console.log(`Para promovê-lo, ele precisa primeiro clicar em "Cadastrar" na tela de Login do sistema.`);

        // Vamos apenas autorizá-lo para que ele consiga se cadastrar
        db.run(
            "INSERT OR IGNORE INTO celulares_autorizados (numero, cargo, ativo) VALUES (?, 'gerente', 1)",
            [celularClean]
        );
        console.log(`✅ O celular foi adicionado à lista de autorizados como Gerente. Peça para ele se cadastrar no app.`);
    } else {
        const userId = userResult[0].values[0][0];
        const nome = userResult[0].values[0][1];

        // Promove no banco
        db.run("UPDATE users SET role = 'gerente' WHERE id = ?", [userId]);

        // Garante na lista de autorizados
        db.run(
            "INSERT OR REPLACE INTO celulares_autorizados (numero, nome, cargo, ativo) VALUES (?, ?, 'gerente', 1)",
            [celularClean, nome]
        );

        console.log(`👑 SUCESSO! O usuário ${nome} (Cel: ${celularClean}) agora é GERENTE e tem acesso aos Relatórios.`);
    }

    saveDatabase();
}

run().catch(console.error);

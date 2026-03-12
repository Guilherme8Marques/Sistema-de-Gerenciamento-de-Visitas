import { initDatabase, getDb, saveDatabase } from './server/database.js';
import bcrypt from 'bcryptjs';

async function resetAndSetupMaster() {
    console.log("🧹 Limpando dados (Resetando banco de dados inteiro)...");
    await initDatabase();
    const db = getDb();

    // Remove users, visitas, etc.
    db.run("DELETE FROM users");
    db.run("DELETE FROM celulares_autorizados");
    db.run("DELETE FROM visitas");
    db.run("DELETE FROM planejamento");

    console.log("👑 Criando usuário MASTER requisitado pelo cliente...");
    const masterPhone = "3597786623";
    const masterNome = "Guilherme Marques";
    const masterMatricula = "Mestre";
    const masterSenha = "Gui82534";
    const senhaHash = await bcrypt.hash(masterSenha, 10);

    // 1. Authorize Master Phone
    db.run(
        "INSERT INTO celulares_autorizados (numero, matricula, nome, cargo, ativo) VALUES (?, ?, ?, 'gerente', 1)",
        [masterPhone, masterMatricula, masterNome]
    );

    // 2. Insert Master User
    db.run(
        "INSERT INTO users (celular, senha_hash, nome, matricula, role, created_at) VALUES (?, ?, ?, ?, 'gerente', CURRENT_TIMESTAMP)",
        [masterPhone, senhaHash, masterNome, masterMatricula]
    );

    saveDatabase();
    console.log(`✅ Usuário Chave (Master) criado com sucesso! Celular: ${masterPhone} / Senha: ${masterSenha}`);
}

resetAndSetupMaster().catch(console.error);

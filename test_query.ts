import { initDatabase, getDb } from "./server/database.js";

async function run() {
  await initDatabase();
  const db = getDb();
  
  const buscaNormalizada = "lucio de araujo";
  const tokens = buscaNormalizada.split(" ").filter(t => t.length > 0);
  
            const safeNomeCol = `
                LOWER(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    REPLACE(REPLACE(REPLACE(REPLACE(c.nome,
                    'Á','A'), 'À','A'), 'Â','A'), 'Ã','A'),
                    'É','E'), 'Ê','E'), 'Í','I'),
                    'Ó','O'), 'Ô','O'), 'Õ','O'),
                    'Ú','U'), 'Ç','C'),
                    'á','a'), 'à','a'), 'â','a'), 'ã','a'),
                    'é','e'), 'ê','e'), 'í','i'),
                    'ó','o'), 'ô','o'), 'õ','o'),
                    'ú','u'), 'ç','c')
                )
            `;

            const nomeConditions = tokens.map(() => `${safeNomeCol} LIKE ?`).join(" AND ");
            const nomeBindings = tokens.map(t => `%${t}%`);
            
            const matriculaParam = `%${buscaNormalizada}%`;
            const orderMatriculaExata = buscaNormalizada;
            const orderMatriculaLike = `${buscaNormalizada}%`;
            const orderNomeLike = `${buscaNormalizada}%`;

            const queryBindings = [
                ...nomeBindings,
                matriculaParam,
                orderMatriculaExata,
                orderMatriculaLike,
                orderNomeLike
            ];

            const sql = `
                SELECT c.id, c.nome, c.matricula, f.id as filial_id, f.nome as filial_nome, f.cidade
                FROM cooperados c
                JOIN filiais f ON c.filial_id = f.id
                WHERE (${nomeConditions}) OR c.matricula LIKE ?
                ORDER BY 
                    CASE 
                        WHEN c.matricula = ? THEN 0
                        WHEN c.matricula LIKE ? THEN 1
                        WHEN ${safeNomeCol} LIKE ? THEN 2
                        ELSE 3
                    END,
                    c.nome ASC
                LIMIT 20
            `;

            try {
                console.time("QueryExec");
                const res = db.exec(sql, queryBindings);
                console.timeEnd("QueryExec");
            } catch (e) {
                console.error("DB ERR:", e);
            }
}
run();

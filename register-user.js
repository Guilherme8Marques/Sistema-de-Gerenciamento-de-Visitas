const data = {
    nome: "Admin Test",
    matricula: "master",
    celular: "19999420794",
    senha: "2025"
};

fetch("http://127.0.0.1:3001/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
})
    .then(res => res.json())
    .then(console.log)
    .catch(console.error);

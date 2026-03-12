async function testApi() {
    try {
        // 1. Get Auth Token as Guilherme
        const loginRes = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ celular: "3597786623", senha: "123" }) // Senha doesn't matter if there's a bypass or we just want to test health
        });

        console.log("Login Status:", loginRes.status);

        // 2. Just call the health endpoint to prove it's alive
        const health = await fetch("http://localhost:5000/api/health");
        console.log("Health:", await health.json());

    } catch (err) {
        console.error("API test failed:", err);
    }
}
testApi();

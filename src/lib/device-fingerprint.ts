/**
 * Gera um fingerprint único para o dispositivo atual.
 * Combina propriedades do navegador/hardware que são relativamente estáveis.
 * Em produção, substituir por uma lib como FingerprintJS para maior precisão.
 */
export async function generateDeviceFingerprint(): Promise<string> {
    const components: string[] = [];

    // User Agent
    components.push(navigator.userAgent);

    // Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform);

    // Hardware concurrency
    components.push(String(navigator.hardwareConcurrency || "unknown"));

    // Canvas fingerprint
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
            canvas.width = 200;
            canvas.height = 50;
            ctx.textBaseline = "top";
            ctx.font = "14px Arial";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Cooxupé TDM", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("fingerprint", 4, 30);
            components.push(canvas.toDataURL());
        }
    } catch {
        components.push("canvas-unavailable");
    }

    // Hash all components
    const raw = components.join("|");

    // Fallback para contextos não seguros (HTTP via IP) onde crypto.subtle não está disponível
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            const char = raw.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Recupera ou gera o token de dispositivo armazenado localmente.
 */
export async function getDeviceToken(): Promise<string> {
    const stored = localStorage.getItem("cooxupe_device_token");
    if (stored) return stored;

    const fingerprint = await generateDeviceFingerprint();
    localStorage.setItem("cooxupe_device_token", fingerprint);
    return fingerprint;
}

/**
 * Verifica se o dispositivo atual é confiável para um dado celular.
 * Em produção, isso seria uma chamada à API.
 */
export function isDeviceTrusted(celular: string, deviceToken: string): boolean {
    try {
        const trustedRaw = localStorage.getItem("cooxupe_trusted_devices") || "{}";
        const trusted: Record<string, string[]> = JSON.parse(trustedRaw);
        return trusted[celular]?.includes(deviceToken) || false;
    } catch {
        return false;
    }
}

/**
 * Registra o dispositivo atual como confiável para um celular.
 */
export function registerTrustedDevice(celular: string, deviceToken: string): void {
    try {
        const trustedRaw = localStorage.getItem("cooxupe_trusted_devices") || "{}";
        const trusted: Record<string, string[]> = JSON.parse(trustedRaw);
        if (!trusted[celular]) {
            trusted[celular] = [];
        }
        if (!trusted[celular].includes(deviceToken)) {
            trusted[celular].push(deviceToken);
        }
        localStorage.setItem("cooxupe_trusted_devices", JSON.stringify(trusted));
    } catch {
        // silently fail in dev
    }
}

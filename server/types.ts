/**
 * Tipos compartilhados entre server e (futuramente) frontend.
 */

export interface User {
    id: number;
    nome: string;
    matricula: string;
    celular: string;
    senha_hash: string;
    device_fingerprint: string | null;
    created_at: string;
}

export interface Filial {
    id: number;
    nome: string;
    cidade: string;
}

export interface Cooperado {
    id: number;
    nome: string;
    filial_id: number;
    matricula: string;
}

export interface Propriedade {
    id: number;
    nome: string;
    cooperado_id: number;
    endereco: string;
}

export interface Planejamento {
    id: number;
    user_id: number;
    data_planejada: string;
    tipo: "visita" | "evento";
    cooperado_id: number | null;
    evento_nome: string | null;
    semana: "atual" | "proxima";
    created_at: string;
}

export interface Visita {
    id: number;
    user_id: number;
    planejamento_id: number | null;
    cooperado_id: number | null;
    data_visita: string;
    resultado: string;
    doencas_pragas: string; // JSON array
    negociacao_dados: string | null; // JSON
    extra: number; // 0 or 1 (sqlite boolean)
    created_at: string;
}

export interface CelularAutorizado {
    id: number;
    numero: string;
    ativo: number;
}

// --- Request/Response types ---

export interface RegisterBody {
    nome: string;
    matricula: string;
    celular: string;
    senha: string;
    device_fingerprint?: string;
}

export interface LoginBody {
    celular: string;
    senha: string;
    device_fingerprint?: string;
}

export interface JwtPayload {
    userId: number;
    celular: string;
}

export interface PlanejamentoBody {
    data_planejada: string;
    tipo: "visita" | "evento";
    cooperado_id?: number;
    evento_nome?: string;
    semana: "atual" | "proxima";
}

export interface RegistroBody {
    planejamento_id?: number;
    cooperado_id?: number;
    cooperado_nome?: string;
    data_visita: string;
    resultado: string;
    doencas_pragas?: string[];
    negociacao_dados?: {
        viaRosa: string;
        valor: string;
        canal: string;
        matricula: string;
    };
    extra?: boolean;
}

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type CooperadoOption = {
    id: number;
    nome: string;
    matricula: string;
    filial: {
        id: number;
        nome: string;
        cidade: string;
    };
};

type CooperadoSearchProps = {
    value: CooperadoOption | null;
    onChange: (cooperado: CooperadoOption | null) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
};

/**
 * Componente de busca de cooperado com autocomplete.
 * Busca por nome ou matrícula via API.
 * Força seleção: o valor só é aceito quando o usuário seleciona uma opção da lista.
 */
const CooperadoSearch = ({
    value,
    onChange,
    placeholder = "Informe o nome ou a matrícula do Cooperado",
    disabled = false,
    className = "",
}: CooperadoSearchProps) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CooperadoOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Buscar cooperados na API
    const searchCooperados = useCallback(async (busca: string) => {
        if (busca.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(
                `/api/cooperados?busca=${encodeURIComponent(busca)}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!response.ok) throw new Error("Erro na busca");

            const data: CooperadoOption[] = await response.json();
            setResults(data);
            setIsOpen(data.length > 0);
            setHighlightIndex(-1);
        } catch (error) {
            console.error("Erro ao buscar cooperados:", error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Debounce da busca
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            searchCooperados(val);
        }, 300);
    };

    // Selecionar cooperado
    const handleSelect = (cooperado: CooperadoOption) => {
        onChange(cooperado);
        setQuery("");
        setResults([]);
        setIsOpen(false);
    };

    // Limpar seleção
    const handleClear = () => {
        onChange(null);
        setQuery("");
        setResults([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    // Teclado: navegar e selecionar
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && highlightIndex >= 0) {
            e.preventDefault();
            handleSelect(results[highlightIndex]);
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Cleanup debounce
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    // Se já tem valor selecionado, mostrar o chip
    if (value && !disabled) {
        return (
            <div className={`flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 h-[52px] backdrop-blur-md shadow-sm transition-colors hover:bg-white/20 ${className}`}>
                <User className="h-5 w-5 text-white/80 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white truncate block">
                        {value.matricula} — {value.nome}
                    </span>
                    <span className="text-xs text-white/70 truncate block font-medium">
                        {value.filial.nome}
                    </span>
                </div>
                <button
                    onClick={handleClear}
                    className="flex-shrink-0 rounded-full p-1.5 hover:bg-white/20 transition-colors"
                    type="button"
                >
                    <X className="h-4 w-4 text-white/80 hover:text-white" />
                </button>
            </div>
        );
    }

    // Se selecionado e desabilitado (registrado)
    if (value && disabled) {
        return (
            <div className={`flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 h-[52px] opacity-60 backdrop-blur-md ${className}`}>
                <User className="h-5 w-5 text-white/80 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-white truncate block">
                        {value.matricula} — {value.nome}
                    </span>
                    <span className="text-xs text-white/70 truncate block font-medium">
                        {value.filial.nome}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder={placeholder}
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                    className="h-12 text-base pl-9 pr-8"
                    disabled={disabled}
                    autoComplete="off"
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
            </div>

            {/* Dropdown de resultados */}
            {isOpen && results.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-2xl border border-primary/20 bg-primary/95 backdrop-blur-xl shadow-xl max-h-60 overflow-y-auto">
                    {results.map((coop, index) => (
                        <button
                            key={coop.id}
                            type="button"
                            onClick={() => handleSelect(coop)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b border-white/10 last:border-b-0
                ${index === highlightIndex
                                    ? "bg-white/20 text-white"
                                    : "hover:bg-white/10 text-white/90"
                                }`}
                        >
                            <User className="h-4 w-4 mt-0.5 flex-shrink-0 text-white/60" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 flex-shrink-0 border-white/30 text-white bg-white/10">
                                        {coop.matricula}
                                    </Badge>
                                    <span className="text-sm font-medium truncate text-white">{coop.nome}</span>
                                </div>
                                <span className="text-xs text-white/70">{coop.filial.nome}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Sem resultados */}
            {isOpen && query.trim().length >= 2 && results.length === 0 && !isLoading && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg px-4 py-3 text-sm text-muted-foreground text-center">
                    Nenhum cooperado encontrado.
                </div>
            )}
        </div>
    );
};

export default CooperadoSearch;

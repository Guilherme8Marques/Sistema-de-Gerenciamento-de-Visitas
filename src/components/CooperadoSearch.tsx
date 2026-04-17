import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, User, Loader2, ArrowLeft } from "lucide-react";
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

/** Hook para detectar mobile (<768px) */
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return isMobile;
}

/**
 * Componente de busca de cooperado com autocomplete.
 * Em mobile: abre um overlay fullscreen para facilitar a busca.
 * Em desktop: dropdown inline tradicional.
 */
const CooperadoSearch = ({
    value,
    onChange,
    placeholder = "Informe o nome ou a matrícula...",
    disabled = false,
    className = "",
}: CooperadoSearchProps) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CooperadoOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const drawerInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMobile = useIsMobile();

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
            const queryInsensitive = val
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
            searchCooperados(queryInsensitive);
        }, 300);
    };

    // Selecionar cooperado
    const handleSelect = (cooperado: CooperadoOption) => {
        onChange(cooperado);
        setQuery("");
        setResults([]);
        setIsOpen(false);
        setDrawerOpen(false);
    };

    // Limpar seleção
    const handleClear = () => {
        onChange(null);
        setQuery("");
        setResults([]);
        if (isMobile) {
            setDrawerOpen(true);
            setTimeout(() => drawerInputRef.current?.focus(), 100);
        } else {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    // Abrir drawer no mobile
    const handleMobileFocus = () => {
        if (isMobile && !disabled) {
            setDrawerOpen(true);
            setTimeout(() => drawerInputRef.current?.focus(), 150);
        }
    };

    // Fechar drawer
    const closeDrawer = () => {
        setDrawerOpen(false);
        setQuery("");
        setResults([]);
        setIsOpen(false);
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
            setDrawerOpen(false);
        }
    };

    // Fechar dropdown ao clicar fora (desktop only)
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

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (drawerOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [drawerOpen]);

    // Renderizar a lista de resultados (compartilhado entre drawer e dropdown)
    const renderResults = () => (
        <>
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
        </>
    );

    // --- CHIP: valor selecionado ---
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

    // --- CHIP: valor selecionado e desabilitado ---
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
        <>
            {/* --- INPUT PRINCIPAL --- */}
            <div ref={containerRef} className={`relative ${className}`}>

                <div className="relative" onClick={isMobile ? handleMobileFocus : undefined}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        placeholder={placeholder}
                        value={isMobile ? "" : query}
                        onChange={isMobile ? undefined : handleInputChange}
                        onKeyDown={isMobile ? undefined : handleKeyDown}
                        onFocus={isMobile ? handleMobileFocus : () => { if (results.length > 0) setIsOpen(true); }}
                        className="h-12 text-base pl-9 pr-8"
                        disabled={disabled}
                        autoComplete="off"
                        readOnly={isMobile}
                    />
                    {isLoading && !isMobile && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                    )}
                </div>

                {/* Desktop dropdown */}
                {!isMobile && isOpen && results.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-2xl border border-primary/20 bg-primary/95 backdrop-blur-xl shadow-xl max-h-60 overflow-y-auto">
                        {renderResults()}
                    </div>
                )}

                {/* Desktop: sem resultados */}
                {!isMobile && isOpen && query.trim().length >= 2 && results.length === 0 && !isLoading && (
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg px-4 py-3 text-sm text-muted-foreground text-center">
                        Nenhum cooperado encontrado.
                    </div>
                )}
            </div>

            {/* --- MOBILE FULLSCREEN DRAWER --- */}
            {isMobile && drawerOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col animate-fade-in" style={{ background: 'hsl(152, 40%, 12%)' }}>
                    {/* Header do drawer */}
                    <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                        <button
                            onClick={closeDrawer}
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(255,255,255,0.08)' }}
                            type="button"
                        >
                            <ArrowLeft className="h-5 w-5 text-white" />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                            <input
                                ref={drawerInputRef}
                                placeholder={placeholder}
                                value={query}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="w-full h-12 rounded-xl pl-9 pr-10 text-base text-white outline-none transition-all"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                                autoComplete="off"
                                autoFocus
                            />
                            {isLoading && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 animate-spin" />
                            )}
                        </div>
                    </div>

                    {/* Resultados */}
                    <div className="flex-1 overflow-y-auto">
                        {results.length > 0 && renderResults()}

                        {query.trim().length >= 2 && results.length === 0 && !isLoading && (
                            <div className="px-6 py-12 text-center text-white/60 text-sm">
                                Nenhum cooperado encontrado.
                            </div>
                        )}

                        {query.trim().length < 2 && (
                            <div className="px-6 py-12 text-center text-white/50 text-sm">
                                <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
                                Digite ao menos 2 caracteres para buscar.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default CooperadoSearch;

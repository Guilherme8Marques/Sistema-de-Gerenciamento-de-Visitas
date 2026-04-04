import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, startOfWeek, endOfMonth, endOfWeek, eachDayOfInterval, eachWeekOfInterval, getWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Target,
    Handshake,
    Users,
    Loader2,
    Trophy,
    Medal,
    Download,
    ClipboardList,
    ListFilter,
    Filter,
    Eye,
    Search,
    X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import iconRelatorios from "@/assets/Relatórios Gerenciais.png";

// ShadCN UI Components
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/* ==============================================================================
   INTERFACES E TIPOS
   ============================================================================== */
interface Resumo {
    total_planejadas: number;
    total_realizadas: number;
    pct_conclusao: number;
    negociacoes: number;
    consultores_ativos: number;
}

interface RankingItem {
    posicao: number;
    id: number;
    nome: string;
    matricula: string;
    total_visitas: number;
    realizadas: number;
    negociacoes: number;
    planejadas: number;
    pct_conclusao: number;
    fornecedor: string;
}

interface PlanejamentoDia {
    date: string;
    empresas: string[];
}

interface Consultor {
    id: number;
    nome: string;
    matricula: string;
    fornecedor: string;
    planejamentos: PlanejamentoDia[];
}

interface HistoricoItem {
    id: number;
    data_visita: string;
    resultado: string;
    nome_consultor: string;
    nome_cooperado: string;
    fornecedor: string;
    tdm_matricula: string;
    tipo_moeda: string | null;
    valor: string | null;
    canal: string | null;
}

interface ColaboradorOption {
    id: number;
    nome: string;
    matricula: string;
}

interface PeriodoInfo {
    inicio: string;
    fim: string;
    labelMes: string;
    labelPeriodo: string;
    diasProcessados: {
        dateKey: string;
        dayNum: number;
        weekday: string;
        dayOfWeek: number; // 0=dom, 1=seg, ..., 6=sab
    }[];
    semanasNoMes: { index: number; label: string }[];
}

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/* ==============================================================================
   COMPONENTE PRINCIPAL
   ============================================================================== */
export default function Relatorios() {
    const navigate = useNavigate();

    // Filtros selecionados na UI
    const [mesSelecionado, setMesSelecionado] = useState<number>(new Date().getMonth());
    const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
    const [semanaSelecionada, setSemanaSelecionada] = useState<string>("todas");
    const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string>("todos");
    const [equipeSelecionada, setEquipeSelecionada] = useState<string>("todas");

    // Autocomplete de colaborador
    const [colabSearch, setColabSearch] = useState("");
    const [colabDropdownOpen, setColabDropdownOpen] = useState(false);
    const colabRef = useRef<HTMLDivElement>(null);

    // Lista de colaboradores para o filtro
    const [colaboradoresLista, setColaboradoresLista] = useState<ColaboradorOption[]>([]);
    const [equipesLista, setEquipesLista] = useState<string[]>([]);

    // Dados derivados do período
    const [periodo, setPeriodo] = useState<PeriodoInfo>({
        inicio: "", fim: "", labelMes: "", labelPeriodo: "", diasProcessados: [], semanasNoMes: []
    });

    // Dashboard data
    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [ranking, setRanking] = useState<RankingItem[]>([]);
    const [historico, setHistorico] = useState<HistoricoItem[]>([]);

    // Planning data
    const [consultoresPlan, setConsultoresPlan] = useState<Consultor[]>([]);
    const [carregando, setCarregando] = useState(false);

    // UI state: 3 abas
    const [abaAtiva, setAbaAtiva] = useState<"executiva" | "planejamento" | "resultados">("executiva");

    /* ────────────────────────────────────────────
       Colaborador Autocomplete: Click-outside
       ──────────────────────────────────────────── */
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (colabRef.current && !colabRef.current.contains(e.target as Node)) {
                setColabDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizeLocal = (str: string) =>
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    const searchNormalized = normalizeLocal(colabSearch);

    const colaboradoresFiltrados = colabSearch.trim()
        ? colaboradoresLista.filter(c =>
            normalizeLocal(c.nome).includes(searchNormalized) ||
            normalizeLocal(c.matricula).includes(searchNormalized)
        )
        : colaboradoresLista;

    const colaboradorNomeSelecionado = colaboradorSelecionado === "todos"
        ? ""
        : colaboradoresLista.find(c => String(c.id) === colaboradorSelecionado)?.nome || "";

    /* ────────────────────────────────────────────
       1. Helpers de Data — Semanas do MÊS (1, 2, 3...)
       ──────────────────────────────────────────── */
    const recalcularDatas = useCallback(() => {
        let baseDate: Date;
        let dataInicialFiltro: Date;
        let dataFinalFiltro: Date;
        let labelPeriodoAux = "";
        let semanasDoMes: any[] = [];

        if (mesSelecionado === -1) {
            // "Todos os Meses" do Ano
            baseDate = new Date(anoSelecionado, 0, 1);
            dataInicialFiltro = baseDate;
            dataFinalFiltro = new Date(anoSelecionado, 11, 31, 23, 59, 59);
            labelPeriodoAux = `Ano Inteiro`;
            
            if (semanaSelecionada !== "todas") {
                setSemanaSelecionada("todas");
                return;
            }
        } else {
            baseDate = new Date(anoSelecionado, mesSelecionado, 1);
            const inicioMesBase = startOfMonth(baseDate);
            const fimMesBase = endOfMonth(baseDate);

            // Compute weeks of the month (1-based index)
            const semanas = eachWeekOfInterval(
                { start: inicioMesBase, end: fimMesBase },
                { weekStartsOn: 1 }
            );

            // Map to month-relative index: "Semana 1", "Semana 2", etc.
            semanasDoMes = semanas.map((d, idx) => {
                const startStr = format(startOfWeek(d, { weekStartsOn: 1 }), "dd/MM");
                const endStr = format(endOfWeek(d, { weekStartsOn: 1 }), "dd/MM");
                return {
                    index: idx + 1,
                    label: `Semana ${idx + 1} (${startStr} a ${endStr})`,
                    startDate: d,
                };
            });

            labelPeriodoAux = `${MONTH_NAMES[mesSelecionado]} ${anoSelecionado}`;

            if (semanaSelecionada !== "todas") {
                const numSem = parseInt(semanaSelecionada, 10);
                const semanaObj = semanasDoMes.find(s => s.index === numSem);

                if (semanaObj) {
                    dataInicialFiltro = startOfWeek(semanaObj.startDate, { weekStartsOn: 1 });
                    dataFinalFiltro = endOfWeek(semanaObj.startDate, { weekStartsOn: 1 });
                    labelPeriodoAux = `Semana ${numSem} - ${MONTH_NAMES[mesSelecionado]}`;
                } else {
                    dataInicialFiltro = inicioMesBase;
                    dataFinalFiltro = fimMesBase;
                }
            } else {
                dataInicialFiltro = inicioMesBase;
                dataFinalFiltro = fimMesBase;
            }
        }

        const diasDoIntervalo = eachDayOfInterval({ start: dataInicialFiltro, end: dataFinalFiltro });

        let diasProcessados = diasDoIntervalo.map(date => ({
            dateKey: format(date, "yyyy-MM-dd"),
            dayNum: date.getDate(),
            weekday: format(date, "EEE", { locale: ptBR }),
            dayOfWeek: date.getDay(), // 0=dom, 1=seg, ..., 6=sab
        }));

        // Optimize: Se aba="Todos os Meses", não renderizamos dias
        if (mesSelecionado === -1) {
            diasProcessados = [];
        }

        // Auto-select current week on first load
        if (mesSelecionado !== -1) {
            const agora = new Date();
            if (isSameMonth(agora, baseDate) && semanaSelecionada !== "todas") {
                const numSemSelecionada = parseInt(semanaSelecionada, 10);
                if (!semanasDoMes.find(s => s.index === numSemSelecionada)) {
                    // Find current week
                    const agoraWeekISO = getWeek(agora, { weekStartsOn: 1 });
                    const currentSemana = semanasDoMes.find(s =>
                        getWeek(s.startDate, { weekStartsOn: 1 }) === agoraWeekISO
                    );
                    if (currentSemana) {
                        setSemanaSelecionada(String(currentSemana.index));
                    } else {
                        setSemanaSelecionada("todas");
                    }
                    return;
                }
            }
        }

        setPeriodo({
            inicio: format(dataInicialFiltro, "yyyy-MM-dd"),
            fim: format(dataFinalFiltro, "yyyy-MM-dd"),
            labelMes: mesSelecionado === -1 ? `Todos os Meses` : MONTH_NAMES[mesSelecionado],
            labelPeriodo: labelPeriodoAux,
            diasProcessados,
            semanasNoMes: semanasDoMes.map(s => ({ index: s.index, label: s.label }))
        });

    }, [mesSelecionado, anoSelecionado, semanaSelecionada]);

    useEffect(() => {
        recalcularDatas();
    }, [recalcularDatas]);

    // Set initial to current month week on mount
    useEffect(() => {
        // Find which week of the month current date is in
        const agora = new Date();
        const inicioMes = startOfMonth(agora);
        const fimMes = endOfMonth(agora);
        const semanas = eachWeekOfInterval({ start: inicioMes, end: fimMes }, { weekStartsOn: 1 });
        const agoraWeekISO = getWeek(agora, { weekStartsOn: 1 });
        const currentIdx = semanas.findIndex(s => getWeek(s, { weekStartsOn: 1 }) === agoraWeekISO);
        setSemanaSelecionada(currentIdx >= 0 ? String(currentIdx + 1) : "todas");
    }, []);

    /* ────────────────────────────────────────────
       2. Data Fetching
       ──────────────────────────────────────────── */
    const carregarDados = useCallback(async () => {
        if (!periodo.inicio || !periodo.fim) return;

        try {
            setCarregando(true);
            const token = localStorage.getItem("auth_token");
            if (!token) {
                navigate("/");
                return;
            }

            const headers = { Authorization: `Bearer ${token}` };
            const { inicio, fim } = periodo;
            const colabParam = colaboradorSelecionado !== "todos" ? `&colaborador_id=${colaboradorSelecionado}` : "";
            const equipeParam = equipeSelecionada !== "todas" ? `&equipe=${equipeSelecionada}` : "";
            const queryParams = `?inicio=${inicio}&fim=${fim}${colabParam}${equipeParam}`;

            const [resumoResp, rankingResp, historicoResp, planResp, colabResp, equipesResp] = await Promise.all([
                fetch(`/api/dashboard/resumo${queryParams}`, { headers }),
                fetch(`/api/dashboard/ranking${queryParams}`, { headers }),
                fetch(`/api/dashboard/historico${queryParams}`, { headers }),
                fetch(`/api/dashboard/planejamento-semanal${queryParams}`, { headers }),
                fetch(`/api/dashboard/colaboradores?inicio=${inicio}&fim=${fim}${equipeParam}`, { headers }),
                fetch(`/api/dashboard/equipes?inicio=${inicio}&fim=${fim}`, { headers }),
            ]);

            const [resumoData, rankingData, historicoData, planData, colabData, equipesData] = await Promise.all([
                resumoResp.ok ? resumoResp.json() : null,
                rankingResp.ok ? rankingResp.json() : [],
                historicoResp.ok ? historicoResp.json() : [],
                planResp.ok ? planResp.json() : [],
                colabResp.ok ? colabResp.json() : [],
                equipesResp.ok ? equipesResp.json() : [],
            ]);

            setResumo(resumoData);
            setRanking(rankingData);
            setHistorico(historicoData);
            setConsultoresPlan(planData);
            setColaboradoresLista(colabData);
            setEquipesLista(equipesData);

        } catch (error) {
            console.error("Erro ao carregar dados dos relatórios", error);
            toast.error("Erro ao comunicar com o servidor");
        } finally {
            setCarregando(false);
        }
    }, [periodo, colaboradorSelecionado, equipeSelecionada, navigate]);

    useEffect(() => {
        carregarDados();
        const interval = setInterval(carregarDados, 120000);
        return () => clearInterval(interval);
    }, [carregarDados]);


    /* ────────────────────────────────────────────
       3. Funções Auxiliares
       ──────────────────────────────────────────── */
    const getVisitasDia = (consultor: Consultor, dataStrKey: string): string[] => {
        if (!consultor || !Array.isArray(consultor.planejamentos)) return [];
        const p = consultor.planejamentos.find((plan) => plan.date === dataStrKey);
        if (!p || !Array.isArray(p.empresas)) return [];
        return p.empresas;
    };

    const renderPosicao = (pos: number) => {
        switch (pos) {
            case 1: return <Trophy className="h-5 w-5 text-yellow-400 drop-shadow-md" />;
            case 2: return <Medal className="h-5 w-5 text-gray-300 drop-shadow-md" />;
            case 3: return <Medal className="h-5 w-5 text-amber-600 drop-shadow-md" />;
            default: return <span className="text-xs font-extrabold text-white/40">{pos}º</span>;
        }
    };

    const exportDashboard = () => {
        if (!ranking || ranking.length === 0) return;
        const mapped = ranking.map(r => ({
            Posição: r.posicao,
            Nome: r.nome,
            Matrícula: r.matricula,
            'Vol. Total': r.total_visitas,
            Planejadas: r.planejadas,
            Realizadas: r.realizadas,
            Negociações: r.negociacoes,
            'Taxa Conclusão (%)': r.pct_conclusao
        }));
        const ws = XLSX.utils.json_to_sheet(mapped);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ranking");
        XLSX.writeFile(wb, `Ranking_Visitas_${periodo.labelMes}.xlsx`);
        toast.success("Ranking exportado!");
    };

    // Filter only Mon-Fri for planning display
    const diasUteis = periodo.diasProcessados.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);

    const exportPlanejamento = () => {
        if (!consultoresPlan || consultoresPlan.length === 0) return;

        const dataRows: any[] = [];
        const headers = ["Colaborador", "Matrícula", "Data", "Dia da Semana", "Cooperado"];

        consultoresPlan
            .filter(c => c.planejamentos.length > 0)
            .forEach(c => {
                diasUteis.forEach((d) => {
                    const empresas = getVisitasDia(c, d.dateKey);
                    empresas.forEach(empresa => {
                        dataRows.push({
                            "Colaborador": c.nome,
                            "Matrícula": c.matricula,
                            "Data": d.dateKey.split('-').reverse().join('/'),
                            "Dia da Semana": d.weekday,
                            "Cooperado": empresa
                        });
                    });
                });
            });

        const ws = XLSX.utils.json_to_sheet(dataRows, { header: headers });
        const wb = XLSX.utils.book_new();
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];
        
        XLSX.utils.book_append_sheet(wb, ws, "Planejamento Bruto");

        const nomeArquivo = semanaSelecionada === "todas"
            ? `Planejamento_Mes_${periodo.labelMes.replace(" ", "_")}.xlsx`
            : `Planejamento_Semana${semanaSelecionada}_${periodo.labelMes.replace(" ", "_")}.xlsx`;

        XLSX.writeFile(wb, nomeArquivo);
        toast.success("Planejamento exportado!");
    };

    const exportHistorico = () => {
        if (!historico || historico.length === 0) return;
        const mapped = historico.map(item => ({
            Data: item.data_visita ? item.data_visita.split('-').reverse().join('/') : 'N/A',
            Colaborador: item.nome_consultor,
            Cooperado: item.nome_cooperado,
            Resultado: item.resultado,
            Canal: item.canal || '-',
            'Tipo Moeda': item.tipo_moeda || '-',
            Valor: item.valor || '-',
        }));
        const ws = XLSX.utils.json_to_sheet(mapped);
        const wb = XLSX.utils.book_new();
        ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws, "Resultados");
        XLSX.writeFile(wb, `Resultados_${periodo.labelMes.replace(" ", "_")}.xlsx`);
        toast.success("Resultados exportados!");
    };

    /* ────────────────────────────────────────────
       Filtros Inline da Tabela
       ──────────────────────────────────────────── */
    const renderFiltrosTabela = () => (
        <div className="flex items-center gap-2 sm:gap-3">
            {/* Filtro de Equipe */}
            <div className="flex items-center gap-1 sm:gap-2">
                <Users className="h-4 w-4 text-primary-foreground/50 hidden md:block" />
                <Select value={equipeSelecionada} onValueChange={(val) => { setEquipeSelecionada(val); setColaboradorSelecionado("todos"); }}>
                    <SelectTrigger className="w-[110px] sm:w-[140px] h-8 text-xs bg-black/20 text-white font-bold border-white/10 shadow-sm rounded-full">
                        <SelectValue placeholder="Equipe" />
                    </SelectTrigger>
                    <SelectContent className="glass-card-strong border-white/10">
                        <SelectItem value="todas" className="text-primary-foreground text-xs">Todas as Equipes</SelectItem>
                        {equipesLista.map(e => (
                            <SelectItem key={e} value={e} className="text-primary-foreground text-xs">{e}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro de Colaborador */}
            <div className="relative z-50 flex items-center" ref={colabRef}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary-foreground/50 pointer-events-none hidden sm:block" />
                    <Input
                        placeholder="Colaborador..."
                        className="w-[130px] sm:w-[160px] h-8 text-xs sm:pl-8 pr-8 bg-black/20 text-white font-bold border-white/10 shadow-sm rounded-full placeholder:text-white/40"
                        value={colaboradorSelecionado === "todos" ? colabSearch : colaboradorNomeSelecionado}
                        onChange={(e) => {
                            setColabSearch(e.target.value);
                            setColaboradorSelecionado("todos");
                            setColabDropdownOpen(true);
                        }}
                        onFocus={() => setColabDropdownOpen(true)}
                    />
                    {colaboradorSelecionado !== "todos" && (
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                            onClick={() => {
                                setColaboradorSelecionado("todos");
                                setColabSearch("");
                            }}
                        >
                            <X className="h-3.5 w-3.5 text-primary-foreground/60" />
                        </button>
                    )}
                </div>
                {colabDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-[220px] sm:w-[250px] max-h-[250px] overflow-y-auto glass-card-strong border border-white/10 rounded-lg shadow-xl">
                        <button
                            className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/10 transition-colors text-primary-foreground ${colaboradorSelecionado === "todos" ? "bg-white/10" : ""}`}
                            onClick={() => {
                                setColaboradorSelecionado("todos");
                                setColabSearch("");
                                setColabDropdownOpen(false);
                            }}
                        >
                            Todos os Colaboradores
                        </button>
                        {colaboradoresFiltrados.map(c => (
                            <button
                                key={c.id}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors text-primary-foreground flex flex-col items-start ${colaboradorSelecionado === String(c.id) ? "bg-white/10 font-bold" : ""}`}
                                onClick={() => {
                                    setColaboradorSelecionado(String(c.id));
                                    setColabSearch("");
                                    setColabDropdownOpen(false);
                                }}
                            >
                                <span className="font-semibold">{c.nome}</span>
                                <span className="text-white/40 text-[10px] truncate w-full">Mat: {c.matricula}</span>
                            </button>
                        ))}
                        {colaboradoresFiltrados.length === 0 && (
                            <div className="px-3 py-2 text-xs text-white/40">Nenhum encontrado</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    /* ────────────────────────────────────────────
       Render
       ──────────────────────────────────────────── */

    const abas = [
        { key: "executiva" as const, label: "Visão Executiva", icon: Eye },
        { key: "planejamento" as const, label: "Planejamento da Semana", icon: ClipboardList },
        { key: "resultados" as const, label: "Resultados e Registros", icon: ListFilter },
    ];

    return (
        <div className="flex-1 flex flex-col">

            {/* ═══════════════════════════════════════════════
                HEADER — Padrão das outras telas (sem glass-header)
               ═══════════════════════════════════════════════ */}
            <header className="relative z-10 flex items-center gap-3 px-5 pt-6 pb-4">
                <button
                    onClick={() => navigate("/menu")}
                    className="bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95"
                >
                    <ArrowLeft className="w-5 h-5 text-primary-foreground" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                        <img src={iconRelatorios} alt="Ícone Relatórios" className="w-full h-full object-contain drop-shadow-2xl" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
                            AgroMapa
                        </span>
                        <h1 className="text-3xl font-display font-bold text-primary-foreground leading-tight">
                            Relatórios
                        </h1>
                        <p className="text-[9px] text-primary-foreground/40 font-medium uppercase tracking-wider mt-0.5">
                            {periodo.labelMes} • {periodo.labelPeriodo}
                        </p>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════
                CONTEUDO PRINCIPAL
               ═══════════════════════════════════════════════ */}
            <main className="flex-1 w-full max-w-[1500px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 relative z-10">

                {/* Abas + Filtros na mesma linha */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Abas de Navegação (esquerda) */}
                    <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md shadow-lg">
                        {abas.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setAbaAtiva(key)}
                                className={`min-w-[140px] py-2.5 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${abaAtiva === key ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Filtros Globais (direita) */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filtro de Mês */}
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary-foreground/60" />
                            <Select value={String(mesSelecionado)} onValueChange={(val) => setMesSelecionado(parseInt(val, 10))}>
                                <SelectTrigger className="w-[150px] h-9 text-xs glass-card text-foreground font-bold border-white/20 shadow-sm">
                                    <SelectValue placeholder="Mês" />
                                </SelectTrigger>
                                <SelectContent className="glass-card-strong border-white/10">
                                    <SelectItem value="-1" className="text-primary-foreground font-bold">Todos os Meses</SelectItem>
                                    {MONTH_NAMES.map((m, idx) => (
                                        <SelectItem key={m} value={String(idx)} className="text-primary-foreground">
                                            {m}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-px h-6 bg-white/20 hidden sm:block" />

                        {/* Filtro de Semana */}
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-primary-foreground/40" />
                            <Select value={semanaSelecionada} onValueChange={(val) => setSemanaSelecionada(val)} disabled={mesSelecionado === -1}>
                                <SelectTrigger className="w-[150px] sm:w-[220px] h-9 text-xs glass-card text-foreground font-bold border-white/20 shadow-sm disabled:opacity-50">
                                    <SelectValue placeholder="Semana" />
                                </SelectTrigger>
                                <SelectContent className="glass-card-strong border-white/10">
                                    <SelectItem value="todas" className="text-primary-foreground">Todas as Semanas</SelectItem>
                                    {periodo.semanasNoMes.map(s => (
                                        <SelectItem key={s.index} value={String(s.index)} className="text-primary-foreground">
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {!resumo ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    </div>
                ) : (
                    <>
                        {/* ═══════════════════════════════════════
                            ABA 1: VISÃO EXECUTIVA
                           ═══════════════════════════════════════ */}
                        {abaAtiva === "executiva" && (
                            <div className="flex flex-col gap-6 animate-fade-in">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                    {[
                                        { icon: CalendarDays, label: "Planejadas", value: resumo.total_planejadas, color: "text-primary-foreground" },
                                        { icon: CheckCircle2, label: "Realizadas", value: resumo.total_realizadas, color: "text-green-400" },
                                        { icon: Target, label: "Conclusão", value: `${resumo.pct_conclusao}%`, color: "text-blue-400" },
                                        { icon: Handshake, label: "Negociações", value: resumo.negociacoes, color: "text-gold" },
                                        { icon: Users, label: "Colab. Ativos", value: resumo.consultores_ativos, color: "text-primary-foreground" },
                                    ].map(({ icon: Icon, label, value, color }) => (
                                        <div key={label} className="glass-card-strong rounded-xl p-5 shadow-lg hover:scale-[1.02] transition-transform">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="bg-white/10 p-1.5 rounded-md">
                                                    <Icon className="h-4 w-4 text-primary-foreground/60" />
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/40">{label}</span>
                                            </div>
                                            <p className={`text-3xl font-display font-extrabold ${color}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Tabela Ranking Full-Width */}
                                <div className="glass-card-strong rounded-xl shadow-lg overflow-hidden border border-white/10">
                                    <div className="flex items-center justify-between px-5 py-4 bg-primary border-b border-white/10">
                                        <h2 className="text-base font-bold text-primary-foreground flex items-center gap-2 font-display">
                                            <Trophy className="hidden md:block h-5 w-5 text-yellow-400" />
                                            <span className="hidden sm:inline">Ranking de Colaboradores</span>
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            {renderFiltrosTabela()}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={exportDashboard}
                                                disabled={ranking.length === 0}
                                                className="h-8 text-xs font-bold border-white/20 text-white bg-white/5 hover:bg-white/10 hidden md:flex"
                                            >
                                                <Download className="h-3.5 w-3.5 mr-2" />
                                                Exportar
                                            </Button>
                                        </div>
                                    </div>

                                    {ranking.length === 0 ? (
                                        <div className="px-5 py-12 text-center text-primary-foreground/50 text-sm">
                                            Sem dados para este período.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-[900px]">
                                                <thead>
                                                    <tr className="bg-black/30 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                                                        <th className="px-3 py-3 text-center border-b border-white/10 w-12">#</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-24">Matrícula</th>
                                                        <th className="px-4 py-3 border-b border-white/10 w-64">Colaborador</th>
                                                        <th className="px-4 py-3 border-b border-white/10 w-32">Equipe</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-28">Planejadas</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-28">Realizadas</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-32">Negociações</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-28">Vol. Total</th>
                                                        <th className="px-3 py-3 border-b border-white/10 text-center w-28">% Conclusão</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ranking.map((item) => (
                                                        <tr key={item.id} className={`group hover:bg-white/8 transition-colors ${item.posicao % 2 === 0 ? 'bg-white/[0.04]' : 'bg-white/[0.08]'}`}>
                                                            <td className="px-4 py-3 text-center">
                                                                {renderPosicao(item.posicao)}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-xs text-white/50">{item.matricula}</td>
                                                            <td className="px-4 py-3 min-w-[180px]">
                                                                <p className="text-sm font-bold text-primary-foreground">{item.nome}</p>
                                                            </td>
                                                            <td className="px-4 py-3 min-w-[150px]">
                                                                <span className="text-xs font-semibold px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white/80">{item.fornecedor}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm text-white/80">{item.planejadas}</td>
                                                            <td className="px-3 py-3 text-center text-sm font-bold text-green-400">{item.realizadas}</td>
                                                            <td className="px-3 py-3 text-center text-sm text-gold font-semibold">{item.negociacoes}</td>
                                                            <td className="px-3 py-3 text-center text-sm text-white/70">{item.total_visitas}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${item.pct_conclusao >= 80 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                                                                    item.pct_conclusao >= 50 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                                                                        "bg-red-500/20 text-red-400 border-red-500/30"
                                                                    }`}>
                                                                    {item.pct_conclusao}%
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════
                            ABA 2: PLANEJAMENTO DA SEMANA (Seg–Sex)
                           ═══════════════════════════════════════ */}
                        {abaAtiva === "planejamento" && (
                            <div className="glass-card-strong rounded-xl shadow-lg overflow-hidden mt-2 animate-fade-in border border-white/10">
                                <div className="flex items-center justify-between p-4 bg-primary border-b border-white/10">
                                    <h2 className="text-base font-bold text-primary-foreground flex items-center gap-2 font-display">
                                        <ClipboardList className="h-5 w-5 text-primary-foreground hidden md:block" />
                                        <span className="hidden lg:inline">Planejamento Detalhado</span>
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        {renderFiltrosTabela()}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs font-bold border-white/20 text-white bg-white/5 hover:bg-white/10 hidden md:flex"
                                            onClick={exportPlanejamento}
                                        >
                                            <Download className="h-3.5 w-3.5 md:mr-2" />
                                            <span className="hidden lg:inline">Exportar Planilha</span>
                                        </Button>
                                    </div>
                                </div>

                                {mesSelecionado === -1 ? (
                                    <div className="px-5 py-16 flex flex-col items-center justify-center text-center glass-card mx-5 my-6 rounded-xl border border-white/10 shadow-lg">
                                        <CalendarDays className="h-12 w-12 text-white/20 mb-4" />
                                        <h3 className="text-lg font-bold text-primary-foreground">Visão Anual não suporta detalhamento Diário</h3>
                                        <p className="text-sm text-primary-foreground/60 mt-2 max-w-md">Para visualizar a planilha de detalhamento do planejamento dia a dia, por favor, selecione um Mês e uma Semana específicos no filtro acima.</p>
                                    </div>
                                ) : consultoresPlan.length === 0 ? (
                                    <div className="px-5 py-12 text-center text-primary-foreground/60 glass-card mx-5 my-6 rounded-xl border-white/10">
                                        Nenhum planejamento registrado em {periodo.labelMes} ({periodo.labelPeriodo}).
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto custom-scrollbar w-full">
                                        <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-[1000px]">
                                            <thead>
                                                <tr className="bg-black/30 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                                                    <th className="px-4 py-3 text-center border-b border-white/10 w-28">
                                                        Matrícula
                                                    </th>
                                                    <th className="px-4 py-3 border-b border-white/10 w-64">
                                                        Colaborador
                                                    </th>
                                                    <th className="px-4 py-3 border-b border-white/10 w-32">
                                                        Equipe
                                                    </th>
                                                    {diasUteis.map((d) => (
                                                        <th key={d.dateKey} className="px-4 py-3 text-center border-b border-white/10 w-44">
                                                            <div className="text-primary-foreground font-extrabold text-xs">{d.dayNum}</div>
                                                            <div className="text-[9px] text-white/50 capitalize font-medium">{d.weekday}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-4 py-3 text-center border-b border-white/10 w-24">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Array.isArray(consultoresPlan) && consultoresPlan
                                                    .filter((c) => c && Array.isArray(c.planejamentos) && c.planejamentos.length > 0)
                                                    .map((consultor, idx) => {
                                                        let totalConsultor = 0;

                                                        return (
                                                            <tr key={consultor.id} className={`group hover:bg-white/[0.12] transition-colors border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.04]' : 'bg-white/[0.08]'}`}>
                                                                <td className="px-4 py-3 align-top text-xs text-white/50 text-center">
                                                                    {consultor.matricula}
                                                                </td>
                                                                <td className="px-4 py-3 align-top font-semibold text-sm text-primary-foreground" style={{ minWidth: 160 }}>
                                                                    {consultor.nome}
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <span className="text-xs font-semibold px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white/80">{consultor.fornecedor}</span>
                                                                </td>
                                                                    {diasUteis.map((d) => {
                                                                    const visitas = getVisitasDia(consultor, d.dateKey);
                                                                    totalConsultor += visitas.length;
                                                                    return (
                                                                        <td key={d.dateKey} className="px-4 py-3 align-top min-w-[120px]">
                                                                            {visitas.length > 0 ? (
                                                                                <div className="space-y-1">
                                                                                    {visitas.map((v, i) => (
                                                                                        <div key={i} className="text-[10px] leading-tight text-white/90 bg-white/5 border border-white/10 p-2 rounded shadow-sm whitespace-normal break-words font-medium hover:bg-white/10 transition-all">
                                                                                            {v}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-4 py-3 text-center align-middle">
                                                                    <span className="text-xs font-extrabold text-gold bg-gold/10 px-2 py-1 rounded border border-gold/20">
                                                                        {totalConsultor}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════
                            ABA 3: RESULTADOS E REGISTROS
                           ═══════════════════════════════════════ */}
                        {abaAtiva === "resultados" && (
                            <div className="glass-card-strong rounded-xl overflow-hidden animate-fade-in flex flex-col items-stretch mt-2 shadow-lg border border-white/10">
                                <div className="bg-primary px-5 py-4 flex items-center justify-between border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <ListFilter className="h-5 w-5 text-primary-foreground hidden md:block" />
                                        <span className="text-base font-bold text-primary-foreground font-display hidden sm:inline">Resultados</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {renderFiltrosTabela()}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs font-bold border-white/20 text-white bg-white/5 hover:bg-white/10 hidden md:flex"
                                            onClick={exportHistorico}
                                            disabled={historico.length === 0}
                                        >
                                            <Download className="h-3.5 w-3.5 mr-2" />
                                            Exportar
                                        </Button>
                                    </div>
                                </div>

                                {historico.length === 0 ? (
                                    <div className="px-5 py-12 text-center text-white/50 text-sm">
                                        Nenhuma visita registrada com detalhes neste período.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto w-full">
                                        <table className="w-full text-left border-separate border-spacing-0 table-fixed min-w-[1100px]">
                                            <thead>
                                                <tr className="bg-black/30 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                                                    <th className="px-4 py-3 border-b border-white/10 w-32">Data</th>
                                                    <th className="px-4 py-3 border-b border-white/10 text-center w-28">Matrícula</th>
                                                    <th className="px-4 py-3 border-b border-white/10 w-64">Colaborador</th>
                                                    <th className="px-4 py-3 border-b border-white/10 w-32">Equipe</th>
                                                    <th className="px-4 py-3 border-b border-white/10 w-56">Cooperado</th>
                                                    <th className="px-4 py-3 border-b border-white/10 text-center w-40">Resultado</th>
                                                    <th className="px-4 py-3 border-b border-white/10 text-center w-32">Canal</th>
                                                    <th className="px-4 py-3 border-b border-white/10 text-right w-32">Negociação</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historico.map((item, idx) => (
                                                    <tr key={item.id} className={`group hover:bg-white/8 transition-colors border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.04]' : 'bg-white/[0.08]'}`}>
                                                        <td className="px-4 py-3 text-sm font-medium text-white/80 whitespace-nowrap">
                                                            {item.data_visita ? item.data_visita.split('-').reverse().join('/') : 'N/A'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-xs text-white/50">
                                                            {item.tdm_matricula}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-primary-foreground">
                                                            {item.nome_consultor}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[10px] font-semibold px-2 py-1 bg-white/5 border border-white/10 rounded-md text-white/80">{item.fornecedor}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-white/70">
                                                            {item.nome_cooperado}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${item.resultado === 'Negociação' ? "bg-gold/20 text-gold border-gold/30" :
                                                                item.resultado === 'Atendimento' ? "bg-blue-400/20 text-blue-400 border-blue-400/30" :
                                                                    item.resultado === 'Avaliação do Campo Experimental' ? "bg-purple-400/20 text-purple-400 border-purple-400/30" :
                                                                        "bg-green-400/20 text-green-400 border-green-400/30"
                                                                }`}>
                                                                {item.resultado}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-xs text-white/60">
                                                            {item.canal && item.canal !== '-' ? item.canal : <span className="text-white/20">—</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-gold text-sm">
                                                            {item.resultado === 'Negociação' && item.valor && item.valor !== '-' ? (
                                                                `${item.tipo_moeda === 'R$' ? 'R$ ' : ''}${item.valor}${item.tipo_moeda === 'Sacas' ? ' sc' : ''}`
                                                            ) : (
                                                                <span className="text-white/20">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

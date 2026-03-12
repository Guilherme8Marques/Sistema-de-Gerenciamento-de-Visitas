import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    CheckCircle2,
    XCircle,
    MapPin,
    Clock,
    Loader2,
    Check,
} from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg";
import iconCalendario from "@/assets/Calendário de Visitas.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function getToken(): string {
    return localStorage.getItem("auth_token") || "";
}

type VisitaHistorico = {
    id: number;
    cooperado: string;
    resultado: string;
    created_at: string;
};

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const resultadoConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    "Atendimento": { label: "Realizada - Atendimento", color: "text-green-600", icon: CheckCircle2 },
    "Negociação": { label: "Realizada - Negociação", color: "text-blue-600", icon: MapPin },
    "Avaliação do Campo Experimental": { label: "Realizada - Aval. Campo", color: "text-orange-600", icon: Clock },
    "Visita Não Executada": { label: "Não Executada", color: "text-red-500", icon: XCircle },
    "Agendado": { label: "Agendado / Pendente", color: "text-amber-500", icon: Clock },
};

const defaultConfig = { label: "Realizada", color: "text-green-600", icon: CheckCircle2 };

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMonthKey(year: number, month: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
}

const Calendario = () => {
    const navigate = useNavigate();
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [calendarMinimized, setCalendarMinimized] = useState(false);

    // Dados do backend
    const [resumoMensal, setResumoMensal] = useState<Record<string, { total: number; realizadas: number }>>({});
    const [visitasDia, setVisitasDia] = useState<VisitaHistorico[]>([]);
    const [carregandoMes, setCarregandoMes] = useState(false);
    const [carregandoDia, setCarregandoDia] = useState(false);

    const daysInMonth = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);
    const firstDay = useMemo(() => getFirstDayOfMonth(currentYear, currentMonth), [currentYear, currentMonth]);

    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    // Carregar resumo mensal do backend
    const carregarResumoMensal = useCallback(async (year: number, month: number) => {
        setCarregandoMes(true);
        try {
            const mes = formatMonthKey(year, month);
            const resp = await fetch(`/api/relatorios/resumo-mensal?mes=${mes}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (resp.status === 401) {
                localStorage.removeItem("auth_token");
                navigate("/");
                return;
            }
            if (!resp.ok) throw new Error("Erro");
            const data = await resp.json();
            setResumoMensal(data);
        } catch {
            setResumoMensal({});
        } finally {
            setCarregandoMes(false);
        }
    }, []);

    // Carregar visitas do dia
    const carregarVisitasDia = useCallback(async (dateKey: string) => {
        setCarregandoDia(true);
        try {
            const resp = await fetch(`/api/registro?data=${dateKey}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (resp.status === 401) {
                localStorage.removeItem("auth_token");
                navigate("/");
                return;
            }
            if (!resp.ok) throw new Error("Erro");
            const data = await resp.json();

            const planejamentoIdsRegistrados = new Set(
                (data.visitas || [])
                    .filter((v: any) => v.planejamento_id)
                    .map((v: any) => v.planejamento_id)
            );

            const registradas = (data.visitas || []).map((v: any) => ({
                id: v.id,
                cooperado: v.cooperado_nome
                    ? `${v.cooperado_matricula} — ${v.cooperado_nome} (${v.filial_nome || ""})`
                    : "Visita extra sem cooperado",
                resultado: v.resultado,
                created_at: v.created_at || "",
            }));

            const pendentes = (data.planejadas || [])
                .filter((p: any) => !planejamentoIdsRegistrados.has(p.planejamento_id))
                .map((p: any) => ({
                    id: p.planejamento_id + 1000000, // Evitar id duplicado
                    cooperado: p.tipo === "evento" ? `⭐ Evento: ${p.evento_nome}` : `${p.cooperado_matricula} — ${p.cooperado_nome} (${p.filial_nome || ""})`,
                    resultado: "Agendado",
                    created_at: "",
                }));

            setVisitasDia([...registradas, ...pendentes]);
        } catch {
            setVisitasDia([]);
        } finally {
            setCarregandoDia(false);
        }
    }, []);

    // Carregar ao mudar de mês
    useEffect(() => {
        carregarResumoMensal(currentYear, currentMonth);
    }, [currentYear, currentMonth, carregarResumoMensal]);

    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
        setSelectedDay(null);
        setCalendarMinimized(false);
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
        setSelectedDay(null);
        setCalendarMinimized(false);
    };

    const handleDayClick = (day: number) => {
        setSelectedDay(day);
        setCalendarMinimized(true);
        const dateKey = formatDateKey(currentYear, currentMonth, day);
        carregarVisitasDia(dateKey);
    };

    const handleOpenCalendar = () => {
        setCalendarMinimized(false);
        setSelectedDay(null);
        setVisitasDia([]); // Clear visits when returning to calendar
    };

    // Build calendar grid
    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarCells.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
    while (calendarCells.length % 7 !== 0) calendarCells.push(null);

    return (
        <div className="flex-1 flex flex-col">

            {/* Header */}
            <header className="relative z-10 flex items-center gap-3 px-5 pt-6 pb-4">
                <button
                    onClick={() => navigate("/menu")}
                    className="glass-card w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95"
                >
                    <ArrowLeft className="w-5 h-5 text-primary-foreground" />
                </button>
                <div className="flex items-center gap-4">
                    <img src={iconCalendario} alt="Icone Calendario" className="w-20 h-20 object-contain drop-shadow-2xl" />
                    <h1 className="text-2xl font-display font-bold text-primary-foreground">Calendário de Visitas</h1>
                </div>

            </header>

            <main className="relative z-10 flex-1 px-4 py-4 space-y-4">
                {/* Calendar section */}
                {!calendarMinimized ? (
                    <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                        {/* Calendar glass card */}
                        <div className="glass-panel w-full max-w-md p-5 pb-6">
                            {/* Month navigation */}
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={prevMonth} className="p-1 rounded-full hover:bg-white/10 transition-colors pointer-cursor" style={{ color: "hsl(0, 0%, 96%)" }}>
                                    <ChevronLeft size={20} />
                                </button>
                                <h2 className="text-lg font-semibold" style={{ color: "hsl(0, 0%, 96%)" }}>
                                    {MONTH_NAMES[currentMonth]} {currentYear}
                                </h2>
                                <button onClick={nextMonth} className="p-1 rounded-full hover:bg-white/10 transition-colors pointer-cursor" style={{ color: "hsl(0, 0%, 96%)" }}>
                                    <ChevronRight size={20} />
                                </button>
                            </div>

                            {/* Loading */}
                            {carregandoMes && (
                                <div className="flex items-center justify-center py-8 gap-2 text-white/70">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    <span className="text-sm">Carregando...</span>
                                </div>
                            )}

                            {!carregandoMes && (
                                <>
                                    {/* Weekday headers */}
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {WEEKDAY_HEADERS.map((wh) => (
                                            <div key={wh} className="text-center text-xs font-medium" style={{ color: "hsl(0, 0%, 70%)" }}>
                                                {wh}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Day cells */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {calendarCells.map((day, idx) => {
                                            if (day === null) return <div key={`empty-${idx}`} />;

                                            const dateKey = formatDateKey(currentYear, currentMonth, day);
                                            const dayData = resumoMensal[dateKey];
                                            const visitCount = dayData?.total || 0;
                                            const realizadas = dayData?.realizadas || 0;
                                            const pendentes = visitCount - realizadas;
                                            const hasVisitas = !!dayData && dayData.total > 0;
                                            const isToday = dateKey === todayKey;

                                            // Determine visual status
                                            let vStatus: "pending" | "done" | null = null;
                                            if (hasVisitas) {
                                                if (pendentes > 0) vStatus = "pending";
                                                else vStatus = "done";
                                            }

                                            return (
                                                <div key={day} className="group flex flex-col items-center py-1">
                                                    <button
                                                        onClick={() => handleDayClick(day)}
                                                        className={`
                                                            w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80
                                                            ${vStatus === "pending" ? "ring-2" : ""}
                                                            ${vStatus === "done" ? "ring-2" : ""}
                                                            ${isToday && !vStatus ? "ring-2" : ""}
                                                        `}
                                                        style={{
                                                            color: "hsl(0, 0%, 96%)",
                                                            ...(vStatus === "pending" ? {
                                                                ringColor: "hsl(var(--day-pending))",
                                                                boxShadow: "inset 0 0 0 2px hsl(var(--day-pending))",
                                                                backgroundColor: "hsla(var(--day-pending) / 0.15)",
                                                            } : {}),
                                                            ...(vStatus === "done" ? {
                                                                boxShadow: "inset 0 0 0 2px hsl(var(--day-done))",
                                                                backgroundColor: "hsla(var(--day-done) / 0.15)",
                                                            } : {}),
                                                            ...(isToday && !vStatus ? {
                                                                boxShadow: "inset 0 0 0 2px hsl(var(--day-today-ring))",
                                                            } : {}),
                                                        }}
                                                    >
                                                        {day}
                                                    </button>
                                                    {/* Item count capsule */}
                                                    {hasVisitas && (
                                                        <span
                                                            className={`status-capsule mt-1 cursor-default ${vStatus === "pending" ? "status-capsule--pending" : "status-capsule--done"
                                                                }`}
                                                            style={{ fontSize: "0.55rem", padding: "1px 6px" }}
                                                        >
                                                            {vStatus === "done" && <Check size={8} className="status-check" />}
                                                            {visitCount} {visitCount === 1 ? "item" : "itens"}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Legend - improved with capsules */}
                                    <div className="glass-panel mt-5 p-4 space-y-2.5">
                                        <div className="flex items-center gap-3">
                                            <span className="status-capsule status-capsule--pending" style={{ fontSize: "0.65rem" }}>
                                                ●
                                            </span>
                                            <span className="text-sm" style={{ color: "hsl(0, 0%, 96%)" }}>
                                                Pendente / Agendado
                                            </span>
                                        </div>
                                        <div className="group flex items-center gap-3">
                                            <span className="status-capsule status-capsule--done" style={{ fontSize: "0.65rem" }}>
                                                <Check size={10} className="status-check" />
                                                ●
                                            </span>
                                            <span className="text-sm" style={{ color: "hsl(0, 0%, 96%)" }}>
                                                Tudo Concluído
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                                                style={{ borderColor: "hsl(var(--day-today-ring))" }}
                                            />
                                            <span className="text-sm" style={{ color: "hsl(0, 0%, 96%)" }}>
                                                Dia Atual
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Minimized calendar header when day is selected */
                    <div className="animate-fade-in rounded-xl glass-card p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-bold text-white/60">
                                    {MONTH_NAMES[currentMonth]} {currentYear}
                                </span>
                                <h2 className="text-2xl font-extrabold text-white">
                                    Dia {selectedDay}
                                    <span className="ml-2 text-sm font-medium text-white/60">
                                        {selectedDay && new Date(currentYear, currentMonth, selectedDay)
                                            .toLocaleDateString("pt-BR", { weekday: "long" }).split('-')[0]}
                                    </span>
                                </h2>
                            </div>
                            <Badge variant="secondary" className="text-sm font-bold">
                                {visitasDia.length} visita{visitasDia.length !== 1 ? "s" : ""}
                            </Badge>
                        </div>
                    </div>
                )}

                {/* Selected day visits */}
                {calendarMinimized && selectedDay && (
                    <div className="space-y-3 animate-fade-in">
                        {carregandoDia ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm">Carregando visitas...</span>
                            </div>
                        ) : visitasDia.length === 0 ? (
                            <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
                                Nenhuma visita registrada neste dia.
                            </div>
                        ) : (
                            visitasDia.map((visita) => {
                                const config = resultadoConfig[visita.resultado] || defaultConfig;
                                const StatusIcon = config.icon;
                                const isPendente = visita.resultado === "Agendado";

                                const handleBaixaRedirect = () => {
                                    if (!selectedDay) return;
                                    const dateObj = new Date(currentYear, currentMonth, selectedDay);
                                    let weekdayName = dateObj.toLocaleDateString("pt-BR", { weekday: "long" }).split('-')[0];
                                    // Capitalize first letter (ex: "segunda" -> "Segunda")
                                    weekdayName = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

                                    navigate(`/registro?dia=${weekdayName}`);
                                };

                                return (
                                    <div
                                        key={visita.id}
                                        onClick={isPendente ? handleBaixaRedirect : undefined}
                                        className={`rounded-xl glass-card p-4 space-y-2 transition-all ${isPendente ? "cursor-pointer hover:border-emerald-400 hover:shadow-md active:scale-[0.98]" : ""}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-base font-bold text-white flex-1">{visita.cooperado}</p>
                                            <div className={`flex flex-col items-end gap-1 shrink-0 ${config.color}`}>
                                                <div className="flex items-center gap-1.5">
                                                    <StatusIcon className="h-4 w-4" />
                                                    <span className="text-xs font-bold">{config.label}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </main>

            {/* Floating calendar button (FAB) */}
            {calendarMinimized && (
                <button
                    onClick={handleOpenCalendar}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 h-14 px-5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/50 transition-all active:scale-90 animate-fade-in border border-emerald-400/30"
                >
                    <CalendarDays className="h-5 w-5" />
                    <span className="text-sm font-bold">Calendário</span>
                </button>
            )}
        </div>
    );
};

export default Calendario;

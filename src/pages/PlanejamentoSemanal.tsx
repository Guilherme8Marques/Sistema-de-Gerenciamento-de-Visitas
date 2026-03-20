import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Loader2, Save, Calendar, Users } from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg"; // Added import
import principalLogo from "@/assets/Principal.png";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function getToken(): string {
    return localStorage.getItem("auth_token") || "";
}

const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const WEEKDAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

function getMonthOptions(): { value: string; label: string }[] {
    const options = [];
    const now = new Date();
    for (let i = -1; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        options.push({
            value: `${y}-${m}`,
            label: `${MONTH_NAMES[d.getMonth()]} ${y}`,
        });
    }
    return options;
}

/**
 * Gera as semanas do mês: cada semana é um array de datas (seg-sex).
 * Uma semana está no mês se pelo menos 1 dia da semana pertence ao mês.
 */
function getWeeksOfMonth(mes: string): { label: string; dates: string[] }[] {
    const [yearStr, monthStr] = mes.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-indexed

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: { label: string; dates: string[] }[] = [];
    const seenWeeks = new Set<string>();

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue; // pular sábado/domingo

        // Encontrar a segunda-feira da semana desse dia
        const monday = new Date(date);
        monday.setDate(date.getDate() - (dow - 1));
        const mondayKey = monday.toISOString().slice(0, 10);

        if (seenWeeks.has(mondayKey)) continue;
        seenWeeks.add(mondayKey);

        // Gerar seg-sex dessa semana
        const dates: string[] = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d.toISOString().slice(0, 10));
        }

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const formatShort = (d: Date) =>
            `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

        weeks.push({
            label: `Semana ${formatShort(monday)} a ${formatShort(friday)}`,
            dates,
        });
    }

    return weeks;
}

interface Planejamento {
    data: string;
    tipo: string;
    descricao: string;
}

interface Consultor {
    id: number;
    nome: string;
    matricula: string;
    planejamentos: Planejamento[];
}

const PlanejamentoSemanal = () => {
    const navigate = useNavigate();
    const monthOptions = getMonthOptions();
    const [mesSelecionado, setMesSelecionado] = useState(monthOptions[0].value);
    const [consultores, setConsultores] = useState<Consultor[]>([]);
    const [carregando, setCarregando] = useState(false);

    const weeks = useMemo(() => getWeeksOfMonth(mesSelecionado), [mesSelecionado]);

    const carregarDados = useCallback(async (mes: string) => {
        setCarregando(true);
        try {
            const resp = await fetch(`/api/dashboard/planejamento-semanal?mes=${mes}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });

            if (resp.status === 401) {
                toast.error("Sessão expirada.");
                navigate("/");
                return;
            }
            if (resp.status === 403) {
                toast.error("Acesso negado.");
                navigate("/menu");
                return;
            }
            if (!resp.ok) throw new Error("Erro");

            const data = await resp.json();
            setConsultores(data);
        } catch {
            toast.error("Erro ao carregar planejamento.");
        } finally {
            setCarregando(false);
        }
    }, [navigate]);

    useEffect(() => {
        carregarDados(mesSelecionado);
    }, [mesSelecionado, carregarDados]);

    // Pegar visitas do consultor para um dia específico
    const getVisitasDia = (consultor: Consultor, dateKey: string): string[] => {
        return consultor.planejamentos
            .filter((p) => p.data === dateKey)
            .map((p) => p.descricao);
    };

    // Formatar data curta (dd/mm)
    const formatShortDate = (dateStr: string): string => {
        const [, m, d] = dateStr.split("-");
        return `${d}/${m}`;
    };

    // Dia da semana de uma data
    const getWeekdayName = (dateStr: string): string => {
        const [y, m, d] = dateStr.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        const dow = date.getDay();
        return WEEKDAY_NAMES[dow - 1] || "";
    };

    // Total de planejamentos do consultor no mês
    const getTotalConsultor = (consultor: Consultor): number => {
        return consultor.planejamentos.length;
    };

    /**
     * Exportar para XLSX — uma aba por semana.
     */
    const handleExportXLSX = () => {
        if (consultores.length === 0) {
            toast.error("Nenhum dado para exportar.");
            return;
        }

        const mesLabel = monthOptions.find((o) => o.value === mesSelecionado)?.label || mesSelecionado;
        const wb = XLSX.utils.book_new();

        const dataRows: any[] = [];
        const headers = ["Colaborador", "Matrícula", "Data", "Dia da Semana", "Cooperado"];

        consultores.forEach(c => {
            weeks.forEach(week => {
                week.dates.forEach(dateKey => {
                    const visits = getVisitasDia(c, dateKey);
                    visits.forEach(v => {
                        dataRows.push({
                            "Colaborador": c.nome,
                            "Matrícula": c.matricula,
                            "Data": dateKey.split('-').reverse().join('/'),
                            "Dia da Semana": getWeekdayName(dateKey),
                            "Cooperado": v
                        });
                    });
                });
            });
        });

        if (dataRows.length === 0) {
            toast.error("Nenhum planejamento registrado neste período.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(dataRows, { header: headers });
        ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, "Planejamento Bruto");

        const fileName = `Planejamento_${mesLabel.replace(" ", "_")}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success(`Relatório exportado: ${fileName}`, { duration: 2000 });
    };

    return (
        <div className="relative flex min-h-screen flex-col overflow-hidden">
            {/* Background */}
            <img
                src={coffeeBg}
                alt="Plantação de café"
                className="absolute inset-0 w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 gradient-bg" />

            {/* Header */}
            <header className="relative z-10 glass-header flex items-center gap-3 px-4 py-4 sticky top-0">
                <Button variant="ghost" size="icon" onClick={() => navigate("/menu")} className="text-primary-foreground hover:bg-white/10">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div className="flex items-center gap-3">
                    <img src={principalLogo} alt="AgroMapa" className="w-10 h-10 object-contain drop-shadow-2xl" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
                            AgroMapa
                        </span>
                        <h1 className="text-2xl font-display font-bold text-primary-foreground leading-tight">
                            Mapa Semanal
                        </h1>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportXLSX}
                    disabled={carregando || consultores.length === 0}
                    className="gap-1.5 font-semibold ml-auto text-primary-foreground hover:bg-white/10 hover:text-primary-foreground border-white/20"
                >
                    <Save className="h-4 w-4" />
                    <span className="hidden sm:inline">Exportar</span>
                </Button>
            </header>

            <main className="relative z-10 flex-1 px-4 py-6 space-y-6">
                {/* Month selector */}
                <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <label className="text-sm font-semibold text-primary-foreground ml-1">Mês de Referência</label>
                    <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o mês" />
                        </SelectTrigger>
                        <SelectContent>
                            {monthOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Loading */}
                {carregando && (
                    <div className="flex items-center justify-center py-12 gap-2 text-primary-foreground/70 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Carregando planejamento...</span>
                    </div>
                )}

                {/* Empty state */}
                {!carregando && consultores.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-white/30 p-8 text-center text-primary-foreground/70 glass-card-strong animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        Nenhum planejamento registrado neste mês.
                    </div>
                )}

                {/* Resumo rápido */}
                {!carregando && consultores.length > 0 && (
                    <div className="glass-card-strong rounded-xl p-4 flex items-center justify-between shadow-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary-foreground" />
                            <span className="text-sm font-semibold text-primary-foreground">
                                {consultores.length} consultor{consultores.length !== 1 ? "es" : ""}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-bold text-blue-600">
                                {consultores.reduce((a, c) => a + c.planejamentos.length, 0)} visitas planejadas
                            </span>
                        </div>
                    </div>
                )}

                {/* Semanas */}
                {!carregando && consultores.length > 0 && weeks.map((week, weekIdx) => {
                    // Filtrar consultores que têm planejamento nessa semana
                    const consultoresComDados = consultores.filter((c) =>
                        week.dates.some((d) => getVisitasDia(c, d).length > 0)
                    );

                    if (consultoresComDados.length === 0) return null;

                    return (
                        <div key={weekIdx} className="space-y-2">
                            {/* Week header */}
                            <h2 className="text-sm font-bold text-primary uppercase tracking-wide px-1">
                                {week.label}
                            </h2>

                            {/* Table */}
                            <div className="glass-card rounded-xl overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[140px_repeat(5,1fr)_50px] bg-primary text-primary-foreground text-xs font-bold">
                                    <div className="px-3 py-2.5">Consultor</div>
                                    {week.dates.map((dateKey) => (
                                        <div key={dateKey} className="px-2 py-2.5 text-center border-l border-primary-foreground/20">
                                            <div>{getWeekdayName(dateKey)}</div>
                                            <div className="text-[10px] opacity-80">{formatShortDate(dateKey)}</div>
                                        </div>
                                    ))}
                                    <div className="px-2 py-2.5 text-center border-l border-primary-foreground/20">
                                        Qtd
                                    </div>
                                </div>

                                {/* Table rows */}
                                <div className="divide-y divide-border">
                                    {consultoresComDados.map((consultor) => {
                                        const totalSemana = week.dates.reduce(
                                            (acc, d) => acc + getVisitasDia(consultor, d).length, 0
                                        );

                                        return (
                                            <div
                                                key={consultor.id}
                                                className="grid grid-cols-[140px_repeat(5,1fr)_50px] hover:bg-muted/30 transition-colors"
                                            >
                                                {/* Nome */}
                                                <div className="px-3 py-2.5 border-r border-border">
                                                    <p className="text-xs font-bold text-foreground truncate">{consultor.nome}</p>
                                                    <p className="text-[10px] text-muted-foreground">Mat. {consultor.matricula}</p>
                                                </div>

                                                {/* Dias da semana */}
                                                {week.dates.map((dateKey) => {
                                                    const visitas = getVisitasDia(consultor, dateKey);
                                                    return (
                                                        <div
                                                            key={dateKey}
                                                            className="px-1.5 py-2 border-r border-border last:border-r-0 min-h-[44px]"
                                                        >
                                                            {visitas.length > 0 ? (
                                                                <div className="space-y-0.5">
                                                                    {visitas.map((v, i) => (
                                                                        <p key={i} className="text-[10px] leading-tight text-foreground truncate" title={v}>
                                                                            {v}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground/40">—</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* Total semana */}
                                                <div className="px-2 py-2.5 text-center border-l border-border">
                                                    <span className="text-xs font-extrabold text-primary">{totalSemana}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </main>
        </div>
    );
};

export default PlanejamentoSemanal;

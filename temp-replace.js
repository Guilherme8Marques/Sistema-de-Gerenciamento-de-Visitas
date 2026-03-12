import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const relatoriosPath = path.join(__dirname, 'src', 'pages', 'Relatorios.tsx');
let content = fs.readFileSync(relatoriosPath, 'utf8');

// ==== 1. Imports ====
content = content.replace(
    /import \{\n    ArrowLeft,\n    CalendarDays,\n    CheckCircle2,\n    Target,\n    Handshake,\n    Users,\n    Loader2,\n    Trophy,\n    Medal,\n    Download,\n    ClipboardList,\n    BarChart3,\n    Filter,\n\} from "lucide-react";/g,
    `import {\n    ArrowLeft,\n    CalendarDays,\n    CheckCircle2,\n    Target,\n    Handshake,\n    Users,\n    Loader2,\n    Trophy,\n    Medal,\n    Download,\n    ClipboardList,\n    BarChart3,\n    Filter,\n    ListFilter,\n} from "lucide-react";`
);

// ==== 2. Interfaces ====
const interfaceText = `interface RankingItem {
    posicao: number;
    id: number;
    nome: string;
    matricula: string;
    total_visitas: number;
    realizadas: number;
    negociacoes: number;
    planejadas: number;
    pct_conclusao: number;
}`;
const historicoInterface = `

interface HistoricoItem {
    id: number;
    data_visita: string;
    resultado: string;
    nome_consultor: string;
    nome_cooperado: string;
    tipo_moeda: string | null;
    valor: string | null;
    canal: string | null;
}`;
if (!content.includes('HistoricoItem')) {
    content = content.replace(interfaceText, interfaceText + historicoInterface);
}

// ==== 3. Estados ====
const stateText = `    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [ranking, setRanking] = useState<RankingItem[]>([]);

    // Planning data
    const [consultores, setConsultores] = useState<Consultor[]>([]);
    const [carregando, setCarregando] = useState(false);`;
const newStateText = `    const [resumo, setResumo] = useState<Resumo | null>(null);
    const [ranking, setRanking] = useState<RankingItem[]>([]);
    const [historico, setHistorico] = useState<HistoricoItem[]>([]);

    // Planning data
    const [consultores, setConsultores] = useState<Consultor[]>([]);
    const [carregando, setCarregando] = useState(false);
    
    // UI state
    const [abaAtiva, setAbaAtiva] = useState<"resumo" | "planejamento" | "historico">("resumo");`;
if (!content.includes('abaAtiva')) {
    content = content.replace(stateText, newStateText);
}

// ==== 4. Fetch e Promessas ====
const fetchText = `            const [resumoResp, rankingResp, planResp] = await Promise.all([
                fetch(\`/api/dashboard/resumo?inicio=\${inicio}&fim=\${fim}\`, { headers }),
                fetch(\`/api/dashboard/ranking?inicio=\${inicio}&fim=\${fim}\`, { headers }),
                fetch(\`/api/dashboard/planejamento-semanal?inicio=\${inicio}&fim=\${fim}\`, { headers }),
            ]);

            setResumo(resumoResp.ok ? await resumoResp.json() : null);
            setRanking(rankingResp.ok ? await rankingResp.json() : []);
            setConsultores(planResp.ok ? await planResp.json() : []);`;
const newFetchText = `            const [resumoResp, rankingResp, historicoResp, planResp] = await Promise.all([
                fetch(\`/api/dashboard/resumo?inicio=\${inicio}&fim=\${fim}\`, { headers }),
                fetch(\`/api/dashboard/ranking?inicio=\${inicio}&fim=\${fim}\`, { headers }),
                fetch(\`/api/dashboard/historico?inicio=\${inicio}&fim=\${fim}\`, { headers }),
                fetch(\`/api/dashboard/planejamento-semanal?inicio=\${inicio}&fim=\${fim}\`, { headers }),
            ]);

            setResumo(resumoResp.ok ? await resumoResp.json() : null);
            setRanking(rankingResp.ok ? await rankingResp.json() : []);
            setHistorico(historicoResp.ok ? await historicoResp.json() : []);
            setConsultores(planResp.ok ? await planResp.json() : []);`;
if (!content.includes('historicoResp')) {
    content = content.replace(fetchText, newFetchText);
}

// ==== 5. Inserir a <main> inteira e limpa ====
// Como a <main> quebrou seguidas vezes, vamos substituir do "<main " até "</main>"
// para garantir a estrutura do React!

const mainRegex = /<main[\s\S]*?<\/main>/;

const newMainContent = \`
            <main className="flex-1 w-full max-w-[1500px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 relative z-10">
                {/* Abas Superiores */}
                <div className="flex bg-white/10 p-1 rounded-xl backdrop-blur-md self-start w-full md:w-auto mt-2 shadow-lg mb-2">
                    <button
                        onClick={() => setAbaAtiva("resumo")}
                        className={\\\`flex-1 min-w-[120px] py-2 px-4 text-sm font-semibold rounded-lg transition-all \${abaAtiva === "resumo" ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white"
                            }\\\`}
                    >
                        Resumo Gerencial
                    </button>
                    <button
                        onClick={() => setAbaAtiva("planejamento")}
                        className={\\\`flex-1 min-w-[120px] py-2 px-4 text-sm font-semibold rounded-lg transition-all \${abaAtiva === "planejamento" ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white"
                            }\\\`}
                    >
                        Plan. Equipe
                    </button>
                    <button
                        onClick={() => setAbaAtiva("historico")}
                        className={\\\`flex-1 min-w-[120px] py-2 px-4 text-sm font-semibold rounded-lg transition-all \${abaAtiva === "historico" ? "bg-primary text-primary-foreground shadow-sm" : "text-white/70 hover:text-white"
                            }\\\`}
                    >
                        Histórico de Visitas
                    </button>
                </div>

                {!resumo ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    </div>
                ) : (
                    <>
                        {/* ABA: RESUMO GERENCIAL */}
                        {abaAtiva === "resumo" && (
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                <div className="xl:col-span-3 flex flex-col gap-6">
                                    {/* ═══════════════════════════════════════
                               SEÇÃO 1 — RESUMO GERENCIAL (INDICADORES)
                               ═══════════════════════════════════════ */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up">
                                        {[
                                            { icon: CalendarDays, label: "Planejadas", value: resumo.total_planejadas, color: "text-primary-foreground" },
                                            { icon: CheckCircle2, label: "Realizadas", value: resumo.total_realizadas, color: "text-green-light" },
                                            { icon: Target, label: "Conclusão", value: \\\`\${resumo.pct_conclusao}%\`\\\, color: "text-blue-400" },
                                            { icon: Handshake, label: "Negociações", value: resumo.negociacoes, color: "text-gold" },
                                        ].map(({ icon: Icon, label, value, color }) => (
                                            <div key={label} className="glass-card-strong rounded-xl p-5 shadow-lg">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="bg-white/10 p-1.5 rounded-md">
                                                        <Icon className="h-4 w-4 text-primary-foreground/60" />
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/40">{label}</span>
                                                </div>
                                                <p className={\\\`text-3xl font-display font-extrabold \${color}\\\`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="glass-card rounded-xl px-5 py-4 flex items-center justify-between shadow-md animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary-foreground/60" />
                                            <span className="text-sm font-semibold text-primary-foreground">
                                                Consultores Ativos no Período Selecionado
                                            </span>
                                        </div>
                                        <span className="text-lg font-display font-bold text-primary-foreground bg-white/10 px-3 py-1 rounded-md">{resumo.consultores_ativos}</span>
                                    </div>
                                </div>

                                <div className="xl:col-span-1">
                                    {/* ── TOP 10 RANKING ── */}
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                🏆 Ranking (Top 10)
                                            </h2>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={exportDashboard}
                                                disabled={ranking.length === 0}
                                                className="h-7 text-[10px] px-2"
                                            >
                                                <Download className="h-3 w-3 mr-1" />
                                                Exportar
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-[36px_1fr_48px_48px_48px_50px] bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                            <span className="px-2 py-2 text-center">#</span>
                                            <span className="px-2 py-2">Consultor</span>
                                            <span className="px-1 py-2 text-center" title="Planejadas">Pln</span>
                                            <span className="px-1 py-2 text-center" title="Realizadas">Rea</span>
                                            <span className="px-1 py-2 text-center" title="Negociações">Neg</span>
                                            <span className="px-1 py-2 text-center" title="Conclusão">%</span>
                                        </div>

                                        {ranking.length === 0 ? (
                                            <div className="px-5 py-8 text-center text-gray-400 text-sm flex-1">
                                                Sem dados para este período.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
                                                {ranking.map((item, idx) => (
                                                    <div key={item.id} className="grid grid-cols-[36px_1fr_48px_48px_48px_50px] items-center hover:bg-gray-50">
                                                        <div className="px-1 py-2 flex justify-center">{renderPosicao(item.posicao)}</div>
                                                        <div className="px-2 py-2 min-w-0">
                                                            <p className="text-[11px] font-bold text-gray-800 truncate">{item.nome}</p>
                                                            <p className="text-[9px] text-gray-400">Mat: {item.matricula}</p>
                                                        </div>
                                                        <div className="text-center text-[11px] text-gray-600">{item.planejadas}</div>
                                                        <div className="text-center text-[11px] font-bold text-green-600">{item.realizadas}</div>
                                                        <div className="text-center text-[11px] text-amber-600">{item.negociacoes}</div>
                                                        <div className="text-center px-1">
                                                            <span className={\\\`text-[9px] font-bold px-1.5 py-0.5 rounded \${item.pct_conclusao >= 80 ? "bg-green-100 text-green-700" : item.pct_conclusao >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}\\\`}>
                                                                {item.pct_conclusao}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ABA: PLANEJAMENTO DA EQUIPE */}
                        {abaAtiva === "planejamento" && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-2 animate-fade-in-up">
                                <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
                                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                        <ClipboardList className="h-5 w-5 text-gray-500" />
                                        Planejamento Detalhado
                                    </h2>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs font-medium"
                                        onClick={exportPlanejamento}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-2 text-gray-500" />
                                        Exportar Planilha Completa
                                    </Button>
                                </div>

                                {consultores.length === 0 ? (
                                    <div className="px-5 py-12 text-center text-primary-foreground/60 glass-card mx-5 my-6 rounded-xl border-white/10">
                                        Nenhum planejamento registrado em {periodo.labelMes} ({periodo.labelPeriodo}).
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="text-left w-full" style={{ borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr className="bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-wider">
                                                    <th className="px-3 py-3 sticky left-0 z-10 bg-gray-100 border-b border-r border-gray-200" style={{ minWidth: 160 }}>
                                                        Consultor
                                                    </th>
                                                    <th className="px-2 py-3 text-center border-b border-r border-gray-200 bg-gray-100" style={{ minWidth: 70 }}>
                                                        Matrícula
                                                    </th>
                                                    {periodo.diasProcessados.map((d) => (
                                                        <th key={d.dateKey} className="px-2 py-3 text-center border-b border-r border-gray-200 bg-gray-100" style={{ minWidth: 200 }}>
                                                            <div className="text-gray-800 font-extrabold text-xs">{d.dayNum}</div>
                                                            <div className="text-[9px] text-gray-500 capitalize">{d.weekday}</div>
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-3 text-center border-b border-l-2 border-l-gray-300 bg-gray-100" style={{ minWidth: 55 }}>
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {consultores
                                                    .filter((c) => c.planejamentos.length > 0)
                                                    .map((consultor, idx) => {
                                                        let totalConsultor = 0;
                                                        const bgRowClass = idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                                                        return (
                                                            <tr key={consultor.id} className={bgRowClass}>
                                                                {/* Nome — sticky */}
                                                                <td className={\\\`px-3 py-3 sticky left-0 z-10 border-r border-gray-200 align-top font-bold text-[11px] text-gray-800 \${bgRowClass}\\\`} style={{ minWidth: 160 }}>
                                                                    {consultor.nome}
                                                                </td>
                                                                {/* Matrícula */}
                                                                <td className="px-2 py-3 border-r border-gray-200 align-top text-[10px] text-gray-500 text-center">
                                                                    {consultor.matricula}
                                                                </td>
                                                                {/* Dias */}
                                                                {periodo.diasProcessados.map((d) => {
                                                                    const visitas = getVisitasDia(consultor, d.dateKey);
                                                                    totalConsultor += visitas.length;
                                                                    return (
                                                                        <td key={d.dateKey} className="px-2 py-3 border-r border-gray-200 align-top" style={{ minWidth: 200 }}>
                                                                            {visitas.length > 0 ? (
                                                                                <div className="space-y-1">
                                                                                    {visitas.map((v, i) => (
                                                                                        <div key={i} className="text-[10px] leading-tight text-gray-700 bg-white border border-gray-100 p-1.5 rounded shadow-sm whitespace-normal break-words">
                                                                                            {v}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null}
                                                                        </td>
                                                                    );
                                                                })}
                                                                {/* Total */}
                                                                <td className="px-3 py-3 text-center border-l-2 border-l-gray-300 align-middle">
                                                                    <span className="text-[11px] font-extrabold text-green-700 bg-green-50 px-2 py-1 rounded">
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
                        
                        {/* ABA: HISTÓRICO DAS VISITAS */}
                        {abaAtiva === "historico" && (
                            <div className="glass-card-strong rounded-xl overflow-hidden animate-fade-in-up flex flex-col items-stretch mt-2 shadow-lg">
                                <div className="bg-primary px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ListFilter className="h-4 w-4 text-primary-foreground" />
                                        <span className="text-sm font-bold text-primary-foreground font-display">Desempenho e Histórico Oficial</span>
                                    </div>
                                </div>

                                {historico.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-white/50 text-sm">
                                        Nenhuma visita registrada com detalhes neste período.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/10 overflow-x-auto">
                                        <div className="grid grid-cols-[80px_1fr_1fr_120px_120px] px-4 py-2 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-primary-foreground min-w-[600px]">
                                            <span>Data</span>
                                            <span>Consultor</span>
                                            <span>Cooperado</span>
                                            <span>Atendimento</span>
                                            <span className="text-right">Negociação</span>
                                        </div>
                                        {historico.map((item) => (
                                            <div key={item.id} className="grid grid-cols-[80px_1fr_1fr_120px_120px] items-center px-4 py-3 hover:bg-white/5 transition-colors min-w-[600px] text-xs">
                                                <div className="font-medium text-white/80">
                                                    {item.data_visita.split('-').reverse().join('/')}
                                                </div>
                                                <div className="font-semibold text-primary-foreground truncate pr-2">
                                                    {item.nome_consultor}
                                                </div>
                                                <div className="text-white/70 truncate pr-2">
                                                    {item.nome_cooperado}
                                                </div>
                                                <div>
                                                    <span className={\\\`px-2 py-0.5 rounded-full text-[10px] font-bold border \${item.resultado === 'Negociação' ? "bg-gold/20 text-gold border-gold/30" :
                                                        item.resultado === 'Atendimento' ? "bg-blue-400/20 text-blue-400 border-blue-400/30" :
                                                            "bg-green-light/20 text-green-light border-green-light/30"
                                                        }\\\`}>
                                                        {item.resultado}
                                                    </span>
                                                </div>
                                                <div className="text-right font-bold text-gold">
                                                    {item.resultado === 'Negociação' && item.valor ? (
                                                        \\\`\${item.tipo_moeda === 'R$' ? 'R$ ' : ''}\${item.valor}\${item.tipo_moeda === 'Sacas' ? ' sc' : ''}\\\`
                                                    ) : (
                                                        <span className="text-white/20">-</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
\`;

content = content.replace(mainRegex, newMainContent.trim());

fs.writeFileSync(relatoriosPath, content);
console.log('Update HTML Complete.');

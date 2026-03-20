import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, CheckCircle2, ChevronDown, ChevronUp, Check, Bug, Loader2, X, Pencil } from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg";
import iconRegistro from "@/assets/Registro de Visitas.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DoencasPragasModal from "@/components/DoencasPragasModal";
import CooperadoSearch, { type CooperadoOption } from "@/components/CooperadoSearch";

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

const RESULTADOS = [
  "Avaliação do Campo Experimental",
  "Atendimento",
  "Visita Não Executada",
  "Negociação",
] as const;

const CANAIS_NEGOCIACAO = ["Campo", "Loja", "Evento", "Ligação"] as const;

/**
 * Calcula a data real (YYYY-MM-DD) para um dia da semana na semana atual.
 */
function calcularDataHoje(diaSemana: string): string {
  const dayIndex = WEEKDAYS.indexOf(diaSemana as typeof WEEKDAYS[number]);
  if (dayIndex === -1) return "";

  const hoje = new Date();
  const diaSemanaHoje = hoje.getDay(); // 0=Dom, 1=Seg ... 6=Sab
  const diffToMonday = diaSemanaHoje === 0 ? -6 : 1 - diaSemanaHoje;
  const monday = new Date(hoje);
  monday.setDate(hoje.getDate() + diffToMonday);

  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Visita = {
  id: number;
  dbId?: number;
  planejamento_id?: number;
  cooperado_id?: number;
  nome: string;
  cooperado?: CooperadoOption | null;
  resultado: string;
  doencasPragas: string[];
  negociacao?: {
    viaRosa: string;
    tipoMoeda: "R$" | "Sacas";
    valor: string;
    canal: string;
    matricula: string;
  };
  extra?: boolean;
  registrado: boolean;
  registrando?: boolean;
};

function getToken(): string {
  return localStorage.getItem("auth_token") || "";
}

const Registro = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [diaSelecionado, setDiaSelecionado] = useState<string>("");
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalVisitaId, setModalVisitaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [newVisitaId, setNewVisitaId] = useState<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /**
   * Carrega visitas do backend (planejadas + já registradas) para o dia selecionado.
   */
  const carregarVisitas = useCallback(async (dia: string) => {
    const dataVisita = calcularDataHoje(dia);
    if (!dataVisita) return;

    setCarregando(true);
    try {
      const resp = await fetch(`/api/registro?data=${dataVisita}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
          navigate("/");
          return;
        }
        throw new Error("Erro ao carregar");
      }

      const data = await resp.json();
      const todasVisitas: Visita[] = [];

      // IDs das visitas já registradas (para não duplicar planejadas)
      const planejamentoIdsRegistrados = new Set(
        data.visitas
          ?.filter((v: any) => v.planejamento_id)
          .map((v: any) => v.planejamento_id) || []
      );

      // Adicionar planejadas que ainda não foram registradas
      if (data.planejadas) {
        for (const p of data.planejadas) {
          if (planejamentoIdsRegistrados.has(p.planejamento_id)) continue;
          // Substituindo as linhas 113 a 121
          todasVisitas.push({
            id: Date.now() + Math.random(),
            planejamento_id: p.planejamento_id,
            cooperado_id: p.cooperado_id,
            nome: p.tipo === "evento"
              ? `⭐ Evento: ${p.evento_nome}`
              : p.cooperado_nome
                ? `${p.cooperado_matricula} — ${p.cooperado_nome} (${p.filial_nome})`
                : "",
            cooperado: p.cooperado_id ? {
              id: p.cooperado_id,
              nome: p.cooperado_nome || "",
              matricula: p.cooperado_matricula || "",
              filial: { id: p.filial_id || 0, nome: p.filial_nome || "", cidade: "" },
            } : null,
            resultado: "",
            doencasPragas: [],
            registrado: false,
          });
        }
      }

      // Adicionar visitas já registradas
      if (data.visitas) {
        for (const v of data.visitas) {
          todasVisitas.push({
            id: Date.now() + Math.random(),
            dbId: v.id,
            planejamento_id: v.planejamento_id,
            cooperado_id: v.cooperado_id,
            nome: v.cooperado_nome
              ? `${v.cooperado_matricula} — ${v.cooperado_nome} (${v.filial_nome})`
              : "",
            cooperado: v.cooperado_id ? {
              id: v.cooperado_id,
              nome: v.cooperado_nome || "",
              matricula: v.cooperado_matricula || "",
              filial: { id: v.filial_id || 0, nome: v.filial_nome || "", cidade: "" },
            } : null,
            resultado: v.resultado || "",
            doencasPragas: v.doencas_pragas || [],
            negociacao: v.negociacao_dados || undefined,
            extra: v.extra,
            registrado: true,
          });
        }
      }

      setVisitas(todasVisitas);
    } catch (err) {
      console.error("Erro ao carregar visitas:", err);
      toast.error("Erro ao carregar visitas.");
      setVisitas([]);
    } finally {
      setCarregando(false);
    }
  }, [navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const diaParam = params.get("dia");
    if (diaParam && WEEKDAYS.includes(diaParam as any)) {
      setDiaSelecionado(diaParam);
      carregarVisitas(diaParam);

      // Clean up URL silently so a refresh doesn't hold it forever
      window.history.replaceState(null, "", "/registro");
    }
  }, [location.search, carregarVisitas]);

  // Efeito para rolar para a nova visita (âncora)
  useEffect(() => {
    if (newVisitaId !== null) {
      const element = itemRefs.current.get(newVisitaId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setNewVisitaId(null);
      }
    }
  }, [newVisitaId]);

  const handleDiaChange = (dia: string) => {
    setDiaSelecionado(dia);
    setExpandedId(null);
    carregarVisitas(dia);
  };

  const addVisitaExtra = () => {
    const id = Date.now();
    const nova: Visita = {
      id,
      nome: "",
      cooperado: null,
      resultado: "",
      doencasPragas: [],
      extra: true,
      registrado: false,
    };
    setVisitas([...visitas, nova]);
    setNewVisitaId(id);
  };

  const updateVisita = (id: number, field: string, value: string) => {
    setVisitas(
      visitas.map((v) => {
        if (v.id !== id) return v;
        if (field === "resultado") {
          const updated = { ...v, resultado: value, registrado: false };
          if (value === "Negociação") {
            updated.negociacao = { viaRosa: "", tipoMoeda: "R$", valor: "", canal: "", matricula: "" };
            updated.doencasPragas = [];
            setExpandedId(id);
          } else if (value === "Avaliação do Campo Experimental") {
            updated.negociacao = undefined;
            if (expandedId === id) setExpandedId(null);
            setTimeout(() => setModalVisitaId(id), 100);
          } else {
            updated.negociacao = undefined;
            updated.doencasPragas = [];
            if (expandedId === id) setExpandedId(null);
          }
          return updated;
        }
        if (field === "nome") return { ...v, nome: value, registrado: false };
        return v;
      })
    );
  };

  const updateCooperadoExtra = (id: number, cooperado: CooperadoOption | null) => {
    setVisitas(
      visitas.map((v) =>
        v.id === id
          ? {
            ...v,
            cooperado,
            cooperado_id: cooperado?.id,
            nome: cooperado ? `${cooperado.matricula} — ${cooperado.nome} (${cooperado.filial.nome})` : "",
            registrado: false,
          }
          : v
      )
    );
  };

  const updateNegociacao = (id: number, field: string, value: string) => {
    setVisitas((prev) =>
      prev.map((v) => {
        if (v.id !== id || !v.negociacao) return v;

        let novoValor = value;

        // Máscara Condicional: se campo "valor" e moeda "R$" formata em Real Brasileiro.
        if (field === "valor" && v.negociacao.tipoMoeda === "R$") {
          let numeros = value.replace(/\D/g, "");
          if (numeros === "") {
            novoValor = "";
          } else {
            // divide por 100 pra pegar vírgulas
            const fmt = (Number(numeros) / 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            novoValor = fmt;
          }
        }
        // Se mudou o tipo da moeda de Sacas para R$ ou R$ para Sacas, limpa o campo pra evitar crash
        else if (field === "tipoMoeda") {
          return { ...v, negociacao: { ...v.negociacao, tipoMoeda: value as "R$" | "Sacas", valor: "" }, registrado: false };
        }

        return { ...v, negociacao: { ...v.negociacao, [field]: novoValor }, registrado: false };
      })
    );
  };

  const handleDoencasPragasConfirm = (selected: string[]) => {
    if (modalVisitaId === null) return;
    setVisitas(
      visitas.map((v) =>
        v.id === modalVisitaId ? { ...v, doencasPragas: selected, registrado: false } : v
      )
    );
    setModalVisitaId(null);
  };

  const handleRegistrar = async (id: number) => {
    const visita = visitas.find((v) => v.id === id);
    if (!visita) return;

    if (visita.extra && !visita.cooperado) {
      toast.error("Selecione um cooperado da lista.");
      return;
    }
    if (!visita.resultado) {
      toast.error("Selecione a ação realizada.");
      return;
    }
    if (visita.resultado === "Avaliação do Campo Experimental" && visita.doencasPragas.length === 0) {
      toast.error("Selecione ao menos uma doença ou praga.");
      return;
    }
    if (visita.resultado === "Negociação" && visita.negociacao) {
      const n = visita.negociacao;
      if (!n.viaRosa || !n.valor || !n.canal || !n.matricula) {
        toast.error("Preencha todos os dados da negociação.");
        return;
      }
    }

    const dataVisita = calcularDataHoje(diaSelecionado);
    if (!dataVisita) {
      toast.error("Erro ao calcular a data.");
      return;
    }

    // Marcar como registrando
    setVisitas((prev) => prev.map((v) => v.id === id ? { ...v, registrando: true } : v));

    try {
      const body = {
        data_visita: dataVisita,
        cooperado_id: visita.cooperado_id || visita.cooperado?.id || null,
        resultado: visita.resultado,
        doencas_pragas: visita.doencasPragas,
        negociacao_dados: visita.negociacao || null,
        extra: visita.extra || false,
        planejamento_id: visita.planejamento_id || null,
      };

      const resp = await fetch("/api/registro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao registrar");
      }

      const saved = await resp.json();

      setVisitas((prev) =>
        prev.map((v) => v.id === id ? { ...v, registrado: true, registrando: false, dbId: saved.id } : v)
      );
      toast.success("Visita registrada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar visita.");
      setVisitas((prev) => prev.map((v) => v.id === id ? { ...v, registrando: false } : v));
    }
  };

  const currentModalVisita = visitas.find((v) => v.id === modalVisitaId);

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
        <div className="flex items-center gap-3">
          <img src={iconRegistro} alt="Icone Registro" className="w-12 h-12 object-contain drop-shadow-2xl" />
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
              AgroMapa
            </span>
            <h1 className="text-2xl font-display font-bold text-primary-foreground leading-tight">
              Registro
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-6 space-y-5">
        {/* Weekday selector */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <Select value={diaSelecionado} onValueChange={handleDiaChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o dia" />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((day) => (
                <SelectItem key={day} value={day}>
                  {day}-feira
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {carregando && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando visitas...</span>
          </div>
        )}

        {!carregando && diaSelecionado && (
          <>


            {/* Visits list */}
            {visitas.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center text-muted-foreground">
                Nenhuma visita planejada para este dia.
                <br />
                <span className="text-sm">Adicione uma visita extra ou planeje no menu "Planejar Visitas".</span>
              </div>
            ) : (
              <div className="space-y-4">
                {visitas.map((visita) => (
                  <div
                    key={visita.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(visita.id, el);
                      else itemRefs.current.delete(visita.id);
                    }}
                    className={`animate-fade-in-up rounded-xl overflow-hidden transition-all shadow-lg ${visita.registrado ? "border-2 border-green-light/50 glass-card-strong" : "glass-card-strong"
                      }`}
                  >
                    <div className="p-4 space-y-3">
                      {/* Visit name — autocomplete for extra, plain text for scheduled */}
                      {visita.extra && !visita.registrado ? (
                        <CooperadoSearch
                          value={visita.cooperado || null}
                          onChange={(coop) => updateCooperadoExtra(visita.id, coop)}
                          disabled={visita.registrado}
                        />
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white">
                            {visita.nome.split(' (')[0]}
                          </p>
                          {visita.nome.includes('(') && (
                            <p className="text-xs text-white/70 font-medium tracking-wide">
                              ({visita.nome.split('(')[1]}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Result dropdown with clear button */}
                      <div className="relative">
                        <Select
                          value={visita.resultado}
                          onValueChange={(v) => updateVisita(visita.id, "resultado", v)}
                          disabled={visita.registrado}
                        >
                          <SelectTrigger className={`${visita.registrado ? "opacity-60" : ""} ${visita.resultado && !visita.registrado ? "pr-16" : ""}`}>
                            <SelectValue placeholder="Ação Realizada" />
                          </SelectTrigger>
                          <SelectContent>
                            {RESULTADOS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {visita.resultado && !visita.registrado && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateVisita(visita.id, "resultado", "");
                            }}
                            className="absolute right-9 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full hover:bg-destructive/10 transition-colors"
                            title="Limpar seleção"
                          >
                            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </button>
                        )}
                      </div>

                      {/* Disease/Pest badges */}
                      {visita.resultado === "Avaliação do Campo Experimental" && visita.doencasPragas.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground">Doenças/Pragas selecionadas:</span>
                            {!visita.registrado && (
                              <button
                                onClick={() => setModalVisitaId(visita.id)}
                                className="text-xs font-bold text-primary underline underline-offset-2"
                              >
                                Editar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {visita.doencasPragas.map((dp) => (
                              <Badge key={dp} variant="secondary" className="text-xs font-medium">
                                <Bug className="h-3 w-3 mr-1" />
                                {dp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Show button to open modal if no diseases selected yet */}
                      {visita.resultado === "Avaliação do Campo Experimental" && visita.doencasPragas.length === 0 && !visita.registrado && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setModalVisitaId(visita.id)}
                          className="w-full gap-2 border-white/30 text-white bg-white/10 hover:bg-white/20 text-sm"
                        >
                          <Bug className="h-4 w-4" /> Selecionar Doenças e Pragas
                        </Button>
                      )}
                    </div>

                    {/* Negociação expanded form */}
                    {visita.resultado === "Negociação" && visita.negociacao && (
                      <div className="border-t border-white/10 bg-white/5 backdrop-blur-sm p-4 space-y-3">
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === visita.id ? null : visita.id)
                          }
                          className="flex w-full items-center justify-between text-sm font-bold text-white/90"
                        >
                          Dados da Negociação
                          {expandedId === visita.id ? (
                            <ChevronUp className="h-4 w-4 text-white/70" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-white/70" />
                          )}
                        </button>

                        {expandedId === visita.id && (
                          <div className="space-y-3 animate-fade-in">
                            <Input
                              placeholder="Nº da Via Rosa Ou Nº do Pedido"
                              value={visita.negociacao.viaRosa}
                              onChange={(e) =>
                                updateNegociacao(visita.id, "viaRosa", e.target.value)
                              }
                              inputMode="numeric"
                              className="text-base"
                              disabled={visita.registrado}
                            />
                            <div className="flex items-center gap-2">
                              <Select
                                value={visita.negociacao.tipoMoeda}
                                onValueChange={(v) => updateNegociacao(visita.id, "tipoMoeda", v)}
                                disabled={visita.registrado}
                              >
                                <SelectTrigger className="w-[110px] flex-shrink-0">
                                  <SelectValue placeholder="Moeda" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="R$">R$</SelectItem>
                                  <SelectItem value="Sacas">Sacas</SelectItem>
                                </SelectContent>
                              </Select>

                              <div className="relative flex-1">
                                {visita.negociacao.tipoMoeda === "R$" && (
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-semibold pointer-events-none text-base">R$</span>
                                )}
                                <Input
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder={visita.negociacao.tipoMoeda === "R$" ? "0,00" : "Quantidade (Sacas)"}
                                  value={visita.negociacao.valor}
                                  onChange={(e) =>
                                    updateNegociacao(visita.id, "valor", e.target.value)
                                  }
                                  className={`text-base bg-white/5 focus:ring-1 focus:ring-accent focus:border-accent transition-all ${visita.negociacao.tipoMoeda === "R$" ? "pl-11" : ""}`}
                                  disabled={visita.registrado}
                                />
                              </div>
                            </div>
                            <Select
                              value={visita.negociacao.canal}
                              onValueChange={(v) => updateNegociacao(visita.id, "canal", v)}
                              disabled={visita.registrado}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Canal de Negociação" />
                              </SelectTrigger>
                              <SelectContent>
                                {CANAIS_NEGOCIACAO.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Matrícula de quem acompanhou"
                              value={visita.negociacao.matricula}
                              onChange={(e) =>
                                updateNegociacao(visita.id, "matricula", e.target.value)
                              }
                              className="text-base"
                              disabled={visita.registrado}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Register button per card */}
                    {!visita.registrado ? (
                      <div className="border-t border-border/10 px-4 py-3">
                        <button
                          onClick={() => handleRegistrar(visita.id)}
                          className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md"
                          disabled={visita.registrando}
                        >
                          {visita.registrando ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> Finalizando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> Finalizar
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="border-t border-white/20 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-b-xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-green-400">
                          <Check className="h-4 w-4" /> Finalizado!
                        </div>
                        <button
                          onClick={() => setVisitas(visitas.map(v => v.id === visita.id ? { ...v, registrado: false } : v))}
                          className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add extra visit at the bottom (Ancora) */}
            <button
              onClick={addVisitaExtra}
              className="w-full h-14 glass-card rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-foreground border-2 border-dashed border-white/30 hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" /> Adicionar Atividade Extra
            </button>
          </>
        )}
      </main>

      {/* Disease/Pest Modal */}
      <DoencasPragasModal
        open={modalVisitaId !== null}
        onOpenChange={(open) => {
          if (!open) setModalVisitaId(null);
        }}
        selected={currentModalVisita?.doencasPragas || []}
        onConfirm={handleDoencasPragasConfirm}
      />
    </div>
  );
};

export default Registro;

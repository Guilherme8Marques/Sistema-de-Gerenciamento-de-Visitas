import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Check, Loader2, ChevronDown } from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg";
import iconPlanejar from "@/assets/Planejar Visitas.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import CooperadoSearch, { type CooperadoOption } from "@/components/CooperadoSearch";

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

/**
 * Calcula a data real (YYYY-MM-DD) para um dia da semana na semana atual ou próxima.
 * Segunda = 0 … Sexta = 4
 */
function calcularData(semana: "atual" | "proxima", diaSemana: string): string {
  const dayIndex = WEEKDAYS.indexOf(diaSemana as typeof WEEKDAYS[number]);
  if (dayIndex === -1) return "";

  const hoje = new Date();
  const diaSemanaHoje = hoje.getDay(); // 0=Dom, 1=Seg ... 6=Sab

  // Calcular segunda-feira desta semana
  const diffToMonday = diaSemanaHoje === 0 ? -6 : 1 - diaSemanaHoje;
  const monday = new Date(hoje);
  monday.setDate(hoje.getDate() + diffToMonday);

  if (semana === "proxima") {
    monday.setDate(monday.getDate() + 7);
  }

  const target = new Date(monday);
  target.setDate(monday.getDate() + dayIndex);

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Atividade = {
  id: number;
  dbId?: number; // ID no servidor (quando salva no banco)
  acao: "visita" | "evento" | "";
  detalhe: string;
  cooperado?: CooperadoOption | null;
  salvo: boolean;
  salvando?: boolean;
};

function getToken(): string {
  return localStorage.getItem("auth_token") || "";
}

const Planejamento = () => {
  const navigate = useNavigate();
  const [semana, setSemana] = useState<"atual" | "proxima">("atual");
  const [diaSelecionado, setDiaSelecionado] = useState<string>("");
  const [atividades, setAtividades] = useState<Atividade[]>([
    { id: 1, acao: "", detalhe: "", cooperado: null, salvo: false },
  ]);
  const [carregando, setCarregando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Carrega atividades salvas do backend quando semana ou dia muda.
   */
  const carregarAtividades = useCallback(async (sem: string, dia: string) => {
    if (!dia) return;

    const data = calcularData(sem as "atual" | "proxima", dia);
    if (!data) return;

    setCarregando(true);
    try {
      const resp = await fetch(`/api/planejamento?data=${data}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!resp.ok) {
        // Se 401, redirecionar para login
        if (resp.status === 401) {
          toast.error("Sessão expirada. Faça login novamente.");
          navigate("/");
          return;
        }
        throw new Error("Erro ao carregar planejamento");
      }

      const savedItems = await resp.json();

      // Converter itens do backend em Atividade[]
      const loaded: Atividade[] = savedItems.map((item: any) => ({
        id: Date.now() + Math.random(),
        dbId: item.id,
        acao: item.tipo as "visita" | "evento",
        detalhe: item.tipo === "evento"
          ? item.evento_nome || ""
          : item.cooperado_nome
            ? `${item.cooperado_matricula} — ${item.cooperado_nome} (${item.filial_nome})`
            : "",
        cooperado: item.cooperado_id
          ? {
            id: item.cooperado_id,
            nome: item.cooperado_nome || "",
            matricula: item.cooperado_matricula || "",
            filial: { id: item.filial_id || 0, nome: item.filial_nome || "", cidade: "" },
          }
          : null,
        salvo: true,
      }));

      if (loaded.length === 0) {
        // Nenhuma atividade salva, iniciar com um card vazio
        setAtividades([{ id: Date.now(), acao: "", detalhe: "", cooperado: null, salvo: false }]);
      } else {
        setAtividades(loaded);
      }
    } catch (err) {
      console.error("Erro ao carregar:", err);
      toast.error("Erro ao carregar atividades.");
      setAtividades([{ id: Date.now(), acao: "", detalhe: "", cooperado: null, salvo: false }]);
    } finally {
      setCarregando(false);
    }
  }, [navigate]);

  // Carregar ao mudar dia ou semana
  useEffect(() => {
    if (diaSelecionado) {
      carregarAtividades(semana, diaSelecionado);
    }
  }, [semana, diaSelecionado, carregarAtividades]);

  const addAtividade = () => {
    if (atividades.length >= 5) return;
    setAtividades([...atividades, { id: Date.now(), acao: "", detalhe: "", cooperado: null, salvo: false }]);
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const removeAtividade = async (id: number) => {
    const atv = atividades.find((a) => a.id === id);
    if (!atv) return;
    if (atividades.length <= 1 && !atv.dbId) return;

    // Se tem dbId, deletar do backend
    if (atv.dbId) {
      try {
        const resp = await fetch(`/api/planejamento/${atv.dbId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!resp.ok) throw new Error("Erro ao remover");
        toast.success("Atividade removida.");
      } catch {
        toast.error("Erro ao remover atividade.");
        return;
      }
    }

    const novas = atividades.filter((a) => a.id !== id);
    if (novas.length === 0) {
      setAtividades([{ id: Date.now(), acao: "", detalhe: "", cooperado: null, salvo: false }]);
    } else {
      setAtividades(novas);
    }
  };

  const updateAtividade = (id: number, field: keyof Atividade, value: string) => {
    setAtividades(
      atividades.map((a) =>
        a.id === id ? { ...a, [field]: value, salvo: false, ...(field === "acao" ? { detalhe: "", cooperado: null } : {}) } : a
      )
    );
  };

  const updateCooperado = (id: number, cooperado: CooperadoOption | null) => {
    setAtividades(
      atividades.map((a) =>
        a.id === id
          ? {
            ...a,
            cooperado,
            detalhe: cooperado ? `${cooperado.matricula} — ${cooperado.nome} (${cooperado.filial.nome})` : "",
            salvo: false,
          }
          : a
      )
    );
  };

  const handleSalvarAtividade = async (id: number) => {
    const atv = atividades.find((a) => a.id === id);
    if (!atv) return;

    if (!diaSelecionado) {
      toast.error("Selecione um dia da semana.");
      return;
    }
    if (!atv.acao) {
      toast.error("Selecione o tipo de ação.");
      return;
    }
    if (atv.acao === "visita" && !atv.cooperado) {
      toast.error("Selecione um cooperado da lista.");
      return;
    }
    if (atv.acao === "evento" && !atv.detalhe.trim()) {
      toast.error("Preencha o nome do evento.");
      return;
    }

    const dataPlanejada = calcularData(semana, diaSelecionado);
    if (!dataPlanejada) {
      toast.error("Erro ao calcular a data.");
      return;
    }

    // Marcar como salvando
    setAtividades((prev) => prev.map((a) => a.id === id ? { ...a, salvando: true } : a));

    try {
      const body = {
        data_planejada: dataPlanejada,
        tipo: atv.acao,
        cooperado_id: atv.acao === "visita" ? atv.cooperado?.id : undefined,
        evento_nome: atv.acao === "evento" ? atv.detalhe.trim() : undefined,
        semana,
      };

      const resp = await fetch("/api/planejamento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      const saved = await resp.json();

      setAtividades((prev) =>
        prev.map((a) => a.id === id ? { ...a, salvo: true, salvando: false, dbId: saved.id } : a)
      );
      toast.success("Atividade salva!", { duration: 2000 });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar atividade.");
      setAtividades((prev) => prev.map((a) => a.id === id ? { ...a, salvando: false } : a));
    }
  };

  const handleSemanaChange = (value: "atual" | "proxima") => {
    setSemana(value);
    setDiaSelecionado("");
    setAtividades([{ id: Date.now(), acao: "", detalhe: "", cooperado: null, salvo: false }]);
  };

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
          <img src={iconPlanejar} alt="Icone Planejar" className="w-20 h-20 object-contain drop-shadow-2xl" />
          <h1 className="text-2xl font-display font-bold text-primary-foreground">Planejar Visitas</h1>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-6 space-y-6">
        {/* Week toggle */}
        <div className="glass-card-strong rounded-full p-1 flex">
          <button
            onClick={() => handleSemanaChange("atual")}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${semana === "atual"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-primary-foreground/60 hover:text-primary-foreground/80"
              }`}
          >
            Semana Atual
          </button>
          <button
            onClick={() => handleSemanaChange("proxima")}
            className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${semana === "proxima"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-primary-foreground/60 hover:text-primary-foreground/80"
              }`}
          >
            Próxima Semana
          </button>
        </div>

        {/* Weekday selector */}
        <div className="space-y-2 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <label className="text-sm font-semibold text-primary-foreground ml-1">Dia da Semana</label>
          <div className="relative">
            <Select value={diaSelecionado} onValueChange={setDiaSelecionado}>
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
        </div>

        {/* Loading state */}
        {carregando && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando atividades...</span>
          </div>
        )}

        {/* Activities */}
        {!carregando && diaSelecionado && (
          <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <label className="text-sm font-bold text-primary-foreground/70 uppercase tracking-wider ml-1">
              Atividades ({atividades.length}/5)
            </label>

            <div className="space-y-4">
              {atividades.map((atv, index) => (
                <div
                  key={atv.id}
                  className={`rounded-xl overflow-hidden transition-all shadow-lg ${atv.salvo ? "border-2 border-green-light/50 glass-card-strong" : "glass-card-strong"
                    }`}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                        Atividade {index + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        {atv.salvo && (
                          <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                            <Check className="h-3.5 w-3.5" /> Salvo
                          </span>
                        )}
                        {(atividades.length > 1 || atv.dbId) && !atv.salvando && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAtividade(atv.id)}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Ação */}
                    <Select
                      value={atv.acao}
                      onValueChange={(v) => updateAtividade(atv.id, "acao", v as any)}
                      disabled={atv.salvo}
                    >
                      <SelectTrigger className={atv.salvo ? "opacity-60" : ""}>
                        <SelectValue placeholder="Tipo de Ação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visita">Visita</SelectItem>
                        <SelectItem value="evento">Evento</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Detalhe — Cooperado autocomplete */}
                    {atv.acao === "visita" && (
                      <CooperadoSearch
                        value={atv.cooperado || null}
                        onChange={(coop) => updateCooperado(atv.id, coop)}
                        disabled={atv.salvo}
                      />
                    )}
                    {atv.acao === "evento" && (
                      <Input
                        placeholder="Nome do Evento"
                        value={atv.detalhe}
                        onChange={(e) => updateAtividade(atv.id, "detalhe", e.target.value)}
                        className="h-12 text-base"
                        disabled={atv.salvo}
                      />
                    )}
                  </div>

                  {/* Save button per card */}
                  {!atv.salvo && (
                    <div className="border-t border-white/10 px-4 py-3 bg-white/5 backdrop-blur-sm">
                      <button
                        onClick={() => handleSalvarAtividade(atv.id)}
                        className="w-full h-12 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md"
                        disabled={atv.salvando}
                      >
                        {atv.salvando ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" /> Salvar Atividade
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar — abaixo de todas as atividades para evitar scroll */}
            {atividades.length < 5 && (
              <button
                onClick={addAtividade}
                className="w-full h-14 glass-card rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-foreground border-2 border-dashed border-white/30 hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                <Plus className="h-5 w-5" /> Adicionar Atividade
              </button>
            )}

            <div ref={scrollRef} className="h-4" />
          </div>
        )}
      </main>
    </div>
  );
};

export default Planejamento;

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, ShieldAlert, Loader2, Calendar, CheckSquare } from "lucide-react";
import { toast } from "sonner";

type Planejamento = {
  id: number;
  data_planejada: string;
  tipo: string;
  cooperado_nome?: string;
  evento_nome?: string;
  semana: string;
};

type Visita = {
  id: number;
  data_visita: string;
  resultado: string;
  cooperado_nome?: string;
};

type UserDetails = {
  id: number;
  nome: string;
  celular: string;
  matricula: string;
  role: string;
  planejamentos: Planejamento[];
  visitas: Visita[];
};

const formatDateBr = (dateString: string) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

const ManageUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [hardDelete, setHardDelete] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  const getToken = () => localStorage.getItem("auth_token") || "";

  useEffect(() => {
    // Check if master
    const userStr = localStorage.getItem("user");
    const loggedUser = userStr ? JSON.parse(userStr) : null;
    if (loggedUser?.celular !== "3597786623") {
      toast.error("Acesso restrito perfil Master.");
      navigate("/configuracoes");
      return;
    }
    loadUserDetails();
  }, [id]);

  const loadUserDetails = async () => {
    try {
      const resp = await fetch(`/api/admin/user/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) {
        let errMessage = "Erro ao carregar detalhes do usuário";
        try {
          const errData = await resp.json();
          errMessage = errData.error || errMessage;
        } catch(e) {}
        throw new Error(errMessage);
      }
      const data = await resp.json();
      setUser(data);
    } catch (error: any) {
      toast.error(error.message);
      navigate("/configuracoes");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (type: "planejamento" | "visita", itemId: number) => {
    if (!confirm(`Tem certeza que deseja apagar este registro? Esta ação é irreversível.`)) return;
    
    setDeletingId(`${type}-${itemId}`);
    try {
      const resp = await fetch(`/api/admin/${type}/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) throw new Error(`Erro ao deletar registro`);
      
      toast.success(`Registro deletado com sucesso`);
      loadUserDetails();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async (type: "planejamentos" | "visitas") => {
    if (!confirm(`Tem certeza que deseja EXCLUIR TODOS os ${type} desse usuário? Esta ação é permanente.`)) return;

    setDeletingId(`all-${type}`);
    try {
      const resp = await fetch(`/api/admin/user/${id}/${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) throw new Error(`Erro ao deletar ${type}`);
      
      toast.success(`${type} excluídos com sucesso`);
      loadUserDetails();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteUser = async () => {
    const msg = hardDelete 
      ? "🔴 ATENÇÃO: Você selecionou APAGAR O HISTÓRICO. Todos os registros e acessos desse usuário serão removidos para sempre. Confirmar?"
      : "Confirmar bloqueio do usuário? O acesso será removido e ele será bloqueado na planilha, mas os registros nas métricas serão mantidos.";
      
    if (!confirm(msg)) return;

    setDeletingId("user");
    try {
      const resp = await fetch(`/api/admin/user/${id}?hardDelete=${hardDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) {
        let errMessage = "Erro ao excluir usuário";
        try {
          const errData = await resp.json();
          errMessage = errData.error || errMessage;
        } catch(e) {}
        throw new Error(errMessage);
      }
      
      toast.success("Usuário processado com sucesso");
      navigate("/configuracoes");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <header className="relative z-10 flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => navigate("/configuracoes")}
          className="bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-red-500/20 rounded-2xl border border-red-500/30">
            <ShieldAlert className="w-7 h-7 text-red-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
              Modo Master
            </span>
            <h1 className="text-3xl font-display font-bold text-primary-foreground leading-tight">
              Gerenciar Usuário
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-4 space-y-6">
        {/* User Info */}
        <div className="glass-card-strong rounded-2xl p-5 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-2">{user.nome}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-white/70">
            <div><span className="text-white/40 block text-xs">Celular</span>{user.celular}</div>
            <div><span className="text-white/40 block text-xs">Matrícula</span>{user.matricula}</div>
            <div><span className="text-white/40 block text-xs">Cargo</span>{user.role}</div>
          </div>
        </div>

        {/* Planejamentos */}
        <div className="glass-card-strong rounded-2xl overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Calendar className="w-5 h-5 text-accent" />
               <h3 className="font-bold text-white">Planejamentos</h3>
            </div>
            {user.planejamentos.length > 0 && (
              <button
                onClick={() => handleDeleteAll("planejamentos")}
                disabled={deletingId === `all-planejamentos`}
                className="text-xs text-red-400 hover:text-white hover:bg-red-500 transition-colors flex items-center gap-1 bg-red-500/10 px-2 py-1.5 rounded-lg disabled:opacity-50"
              >
                {deletingId === `all-planejamentos` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Excluir Todos
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {user.planejamentos.length === 0 ? (
              <p className="text-sm text-center text-white/40 py-4">Nenhum planejamento encontrado.</p>
            ) : (
              user.planejamentos.map(plan => (
                <div key={plan.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group transition-all">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{formatDateBr(plan.data_planejada)}</span>
                    <span className="text-xs text-white/50 truncate w-48">
                      {plan.tipo === "evento" ? plan.evento_nome : plan.cooperado_nome}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem("planejamento", plan.id)}
                    disabled={deletingId === `planejamento-${plan.id}`}
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/30 border border-red-500/20 flex items-center justify-center transition-all group-hover:opacity-100 opacity-50 disabled:opacity-30"
                  >
                    {deletingId === `planejamento-${plan.id}` ? <Loader2 className="w-4 h-4 text-red-400 font-bold animate-spin" /> : <Trash2 className="w-4 h-4 text-red-400" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visitas */}
        <div className="glass-card-strong rounded-2xl overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-green-400" />
                <h3 className="font-bold text-white">Registros</h3>
            </div>
            {user.visitas.length > 0 && (
              <button
                onClick={() => handleDeleteAll("visitas")}
                disabled={deletingId === `all-visitas`}
                className="text-xs text-red-400 hover:text-white hover:bg-red-500 transition-colors flex items-center gap-1 bg-red-500/10 px-2 py-1.5 rounded-lg disabled:opacity-50"
              >
                {deletingId === `all-visitas` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Excluir Todos
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {user.visitas.length === 0 ? (
              <p className="text-sm text-center text-white/40 py-4">Nenhum registro encontrado.</p>
            ) : (
              user.visitas.map(visita => (
                <div key={visita.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group transition-all">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{formatDateBr(visita.data_visita)}</span>
                    <span className="text-xs text-white/50 truncate w-48">{visita.cooperado_nome}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem("visita", visita.id)}
                    disabled={deletingId === `visita-${visita.id}`}
                    className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/30 border border-red-500/20 flex items-center justify-center transition-all group-hover:opacity-100 opacity-50 disabled:opacity-30"
                  >
                    {deletingId === `visita-${visita.id}` ? <Loader2 className="w-4 h-4 text-red-400 font-bold animate-spin" /> : <Trash2 className="w-4 h-4 text-red-400" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 pb-4">
          {!showDeleteOptions ? (
             <button
               onClick={() => setShowDeleteOptions(true)}
               className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-bold rounded-xl flex items-center justify-center transition-colors"
             >
               <ShieldAlert className="w-5 h-5 mr-3" /> Excluir e Bloquear Usuário
             </button>
          ) : (
             <div className="glass-card-strong rounded-2xl overflow-hidden border border-red-500/30 p-5 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xs text-white/70">
                  Bloquear este usuário removerá seu acesso e ele não será re-adicionado automaticamente caso a planilha do Excel seja salva. 
                </p>
                
                <label className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={hardDelete} 
                    onChange={(e) => setHardDelete(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-black/50 text-red-500 focus:ring-red-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Apagar Histórico de Dados</span>
                    <span className="text-xs text-red-300/80">CUIDADO: Marque para apagar também todos os registros e métricas deste usuário permanentemente.</span>
                  </div>
                </label>

                <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowDeleteOptions(false)}
                      className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold text-sm"
                    >
                       Cancelar
                    </button>
                    <button
                      onClick={handleDeleteUser}
                      disabled={deletingId === "user"}
                      className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-red-500/20 text-sm"
                    >
                      {deletingId === "user" ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Exclusão"}
                    </button>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManageUser;

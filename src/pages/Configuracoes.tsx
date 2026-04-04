import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeySquare, Loader2, Search, Copy, Settings } from "lucide-react";
import { toast } from "sonner";


type User = {
  id: number;
  nome: string;
  celular: string;
  matricula: string;
  role: string;
  reset_code?: string;
  fornecedor?: string;
};

const Configuracoes = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const userStr = localStorage.getItem("user");
  const loggedUser = userStr ? JSON.parse(userStr) : null;
  const isMaster = loggedUser?.celular === "3597786623";

  useEffect(() => {
    loadUsers();
  }, []);

  const getToken = () => localStorage.getItem("auth_token") || "";

  const loadUsers = async () => {
    try {
      const resp = await fetch("/api/auth/users", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          toast.error("Acesso negado.");
          navigate("/menu");
          return;
        }
        throw new Error("Erro ao listar usuários");
      }
      const data = await resp.json();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.message || "Falha de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePIN = async (userId: number, userName: string) => {
    if (!confirm(`Gerar novo PIN de redefinição de senha para ${userName}?`)) return;

    setGenerating(userId);
    try {
      const resp = await fetch("/api/auth/generate-reset-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao gerar código.");
      }

      const data = await resp.json();
      
      // Update local state to show the active PIN (optional)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, reset_code: data.code } : u));
      
      // Copy to clipboard fallback logic
      try {
        await navigator.clipboard.writeText(data.code);
        toast.success(`PIN ${data.code} copiado! Envie para o usuário.`);
      } catch (e) {
        toast.success(`Código gerado: ${data.code}. Envie para o usuário!`);
      }
      
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setGenerating(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`PIN ${text} copiado!`);
    } catch (e) {
      toast.error("Erro ao copiar.");
    }
  };

  const normalizeLocal = (str: string) =>
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const searchNormalized = normalizeLocal(searchQuery);

  const filteredUsers = users.filter((user) => {
    return (
      normalizeLocal(user.nome).includes(searchNormalized) ||
      normalizeLocal(user.celular).includes(searchNormalized) ||
      normalizeLocal(user.matricula).includes(searchNormalized) ||
      (user.fornecedor && normalizeLocal(user.fornecedor).includes(searchNormalized))
    );
  });

  return (
    <div className="flex-1 flex flex-col">
      <header className="relative z-10 flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => navigate("/menu")}
          className="bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center transition-transform active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-white/10 rounded-2xl">
            <KeySquare className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
              AgroMapa
            </span>
            <h1 className="text-3xl font-display font-bold text-primary-foreground leading-tight">
              Configurações
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-6">
        <div className="glass-card-strong rounded-2xl overflow-hidden shadow-xl border border-white/10 animate-fade-in-up">
          <div className="p-4 sm:p-5 border-b border-white/10 bg-black/20 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Usuários do Sistema</h2>
              <p className="text-xs text-white/60 mt-1">Gere PINs de redefinição de senha clicando na chave.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar por nome, celular ou matrícula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
              />
            </div>
          </div>

          {isMaster && (
            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Sincronização Manual</span>
                <span className="text-[10px] text-white/50">Forçar leitura do Excel e CSV da pasta dados/</span>
              </div>
              <button
                onClick={async () => {
                  const btn = document.getElementById('sync-btn');
                  if (btn) btn.classList.add('animate-spin');
                  try {
                    const r = await fetch('/api/admin/sync', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${getToken()}` }
                    });
                    if (r.ok) {
                      toast.success("Sincronização concluída!");
                      loadUsers();
                    } else {
                      throw new Error();
                    }
                  } catch (e) {
                    toast.error("Erro ao sincronizar. Verifique os arquivos.");
                  } finally {
                     if (btn) btn.classList.remove('animate-spin');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent-light border border-accent/30 rounded-xl text-xs font-bold transition-all"
              >
                <Loader2 id="sync-btn" className="w-4 h-4" />
                Sincronizar Agora
              </button>
            </div>
          )}
          
          <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 flex justify-center text-white/50">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-white/50 text-sm">Nenhum usuário encontrado na busca.</div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group gap-3 border border-transparent hover:border-white/5">
                  <div className="flex flex-col overflow-hidden text-ellipsis whitespace-nowrap">
                    <span className="text-sm font-bold text-white pr-2 truncate" title={user.nome}>{user.nome}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/50">{user.celular} • {user.matricula}</span>
                      {user.fornecedor && (
                        <span className="text-[10px] bg-accent/20 text-accent-light px-1.5 py-0.5 rounded border border-accent/20 font-bold uppercase tracking-wider">
                          {user.fornecedor}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {user.reset_code && (
                      <div className="flex items-center bg-black/40 border border-accent/30 rounded-lg overflow-hidden shrink-0">
                        <span className="text-sm font-mono text-white px-3 py-1.5 tracking-widest font-bold">
                          {user.reset_code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(user.reset_code!)}
                          className="px-2.5 py-1.5 bg-accent/20 hover:bg-accent/40 transition-colors border-l border-accent/30 flex items-center justify-center"
                          title="Copiar PIN"
                        >
                          <Copy className="w-4 h-4 text-accent-light" />
                        </button>
                      </div>
                    )}
                    
                    {!user.reset_code && (
                      <button
                        onClick={() => handleGeneratePIN(user.id, user.nome)}
                        disabled={generating === user.id}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
                        title="Gerar PIN de Redefinição"
                      >
                        {generating === user.id ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <KeySquare className="w-4 h-4 text-white" />
                        )}
                      </button>
                    )}

                    {isMaster && (
                      <button
                        onClick={() => navigate(`/gerenciar-usuario/${user.id}`)}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/20 flex items-center justify-center transition-all shrink-0 border border-white/10 group-hover:border-white/20"
                        title="Gerenciar Usuário"
                      >
                        <Settings className="w-4 h-4 text-white/70 group-hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Configuracoes;

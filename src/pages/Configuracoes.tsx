import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeySquare, Loader2 } from "lucide-react";
import { toast } from "sonner";


type User = {
  id: number;
  nome: string;
  celular: string;
  matricula: string;
  role: string;
  reset_code?: string;
};

const Configuracoes = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<number | null>(null);

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
          <div className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl">
            <KeySquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-extrabold text-primary-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
              AgroMapa
            </span>
            <h1 className="text-2xl font-display font-bold text-primary-foreground leading-tight">
              Configurações
            </h1>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-6">
        <div className="glass-card-strong rounded-2xl overflow-hidden shadow-xl border border-white/10 animate-fade-in-up">
          <div className="p-5 border-b border-white/10 bg-black/20">
            <h2 className="text-base font-bold text-white">Usuários do Sistema</h2>
            <p className="text-xs text-white/60 mt-1">Gere PINs de redefinição de senha clicando na chave.</p>
          </div>
          
          <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 flex justify-center text-white/50">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-white/50 text-sm">Nenhum usuário encontrado.</div>
            ) : (
              users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group">
                  <div className="flex flex-col overflow-hidden text-ellipsis whitespace-nowrap">
                    <span className="text-sm font-bold text-white pr-2 truncate" title={user.nome}>{user.nome}</span>
                    <span className="text-xs text-white/50">{user.celular} • {user.matricula}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 pl-2">
                    {user.reset_code && (
                      <span className="text-[10px] font-mono bg-accent/20 text-accent px-2 py-1 rounded-md border border-accent/20 hidden sm:block">
                        PIN ATIVO
                      </span>
                    )}
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

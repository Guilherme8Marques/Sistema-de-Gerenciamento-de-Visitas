import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Smartphone, Coffee, Leaf, Loader2, X, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import coffeeBg from "@/assets/coffee-bg.jpg";
import principalLogo from "@/assets/Principal.png";

const Login = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  // Esqueci minha senha state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetCelular, setResetCelular] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const savedCelular = localStorage.getItem("saved_celular");
    const savedSenha = localStorage.getItem("saved_senha");
    if (savedCelular) {
      setCelular(savedCelular);
      setKeepConnected(true);
    }
    if (savedSenha) setSenha(savedSenha);
  }, []);

  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, "");

    if (digits.startsWith("0")) digits = digits.substring(1);
    if (digits.startsWith("55") && digits.length > 11) digits = digits.substring(2);

    digits = digits.slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length < 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");

    const rawCelular = celular.replace(/\D/g, "");
    if (!rawCelular || rawCelular.length < 10) {
      setErro("Informe o número do celular corporativo.");
      return;
    }
    if (!senha) {
      setErro("Informe sua senha.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celular: rawCelular, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || "Erro ao realizar login.");
        return;
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      if (keepConnected) {
        localStorage.setItem("saved_celular", formatPhone(rawCelular));
        localStorage.setItem("saved_senha", senha);
      } else {
        localStorage.removeItem("saved_celular");
        localStorage.removeItem("saved_senha");
      }

      navigate("/menu");
    } catch {
      setErro("Erro interno de rota ou servidor offline.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidateResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    const rawCelular = resetCelular.replace(/\D/g, "");

    if (rawCelular.length < 10) return setResetError("Celular inválido.");
    if (resetCode.length !== 6) return setResetError("O código deve ter 6 dígitos.");

    setResetLoading(true);
    try {
      const resp = await fetch("/api/auth/validate-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celular: rawCelular, code: resetCode }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao validar código.");
      }
      setResetStep(2);
      setResetError("");
    } catch (error: any) {
      setResetError(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (newPassword !== confirmPassword) {
      return setResetError("As senhas não coincidem.");
    }

    setResetLoading(true);
    try {
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celular: resetCelular.replace(/\D/g, ""), code: resetCode, novaSenha: newPassword }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Erro ao redefinir senha.");
      }

      toast.success("Senha atualizada com sucesso! Faça o login.");
      setIsResetModalOpen(false);
      setResetStep(1);
      setResetCelular("");
      setResetCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setResetError(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">

      {/* Register button */}
      <div className="relative z-10 w-full max-w-sm px-6 mb-6 flex justify-end">
        <button
          className="glass-card rounded-full px-5 py-2 text-sm font-semibold text-primary-foreground tracking-wide hover:scale-105 transition-transform"
          onClick={() => navigate("/cadastro")}
        >
          Cadastrar
        </button>
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-10 animate-fade-in-up">
        <div className="w-32 h-32 flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-500">
          <img
            src={principalLogo}
            alt="Logo Principal"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          />
        </div>
        <h1 className="text-3xl font-display font-bold text-white text-center leading-tight">
          Gerenciador de Visitas
        </h1>
        <p className="text-sm text-white/60 mt-2 font-medium tracking-wide">
          SISTEMA DE VISITAS DE CAMPO
        </p>
      </div>

      {/* Login Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-6 glass-card-strong rounded-3xl p-6 animate-fade-in-up"
        style={{ animationDelay: "0.15s" }}
      >
        {/* Info banner */}
        <div className="glass-card rounded-xl p-3 flex items-center gap-3 mb-6">
          <Smartphone className="w-5 h-5 text-primary-foreground flex-shrink-0" />
          <p className="text-xs text-primary-foreground/90">
            Acesse com o número do seu <strong>celular corporativo</strong>.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-2">
              Celular Corporativo
            </label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={celular}
              onChange={(e) => {
                setCelular(formatPhone(e.target.value));
                setErro("");
              }}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro("");
                }}
                className="w-full glass-input rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Keep connected */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setKeepConnected(!keepConnected)}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${keepConnected
                ? "bg-primary border-primary"
                : "border-primary-foreground/40 bg-transparent"
                }`}
            >
              {keepConnected && (
                <Leaf className="w-3 h-3 text-primary-foreground" />
              )}
            </div>
            <span className="text-sm text-primary-foreground/80">Manter conectado</span>
          </label>

          {/* Mensagem de erro */}
          {erro && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-xs font-medium text-destructive">
              {erro}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full gradient-primary rounded-xl py-3.5 text-primary-foreground font-semibold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Entrar"}
          </button>
        </form>

        {/* Forgot password */}
        <div className="text-center mt-4">
          <button 
            type="button" 
            onClick={() => setIsResetModalOpen(true)}
            className="text-sm text-gold font-semibold hover:underline transition-colors"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>

      {/* Footer leaf decoration */}
      <div className="relative z-10 mt-10 flex flex-col items-center gap-3 animate-fade-in opacity-80">
        <div className="flex items-center gap-2 text-white/20">
          <Leaf className="w-4 h-4" />
          <div className="h-px w-12 bg-white/10" />
          <Leaf className="w-4 h-4 scale-x-[-1]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
            Desenvolvido por
          </p>
          <p className="text-xs text-white/60 font-medium">
            Inteligência de Mercado / Comercial Insumos
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card-strong w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/20 animate-scale-in">
            <button
              onClick={() => {
                setIsResetModalOpen(false);
                setResetStep(1);
                setResetError("");
              }}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mb-3">
                {resetStep === 1 ? <KeyRound className="w-6 h-6 text-accent" /> : <ShieldCheck className="w-6 h-6 text-green-400" />}
              </div>
              <h2 className="text-xl font-bold text-white">Recuperação de Senha</h2>
              {resetStep === 1 ? (
                <p className="text-xs text-white/70 mt-2">
                  Solicite o <strong className="text-accent underline">Código de 6 dígitos</strong> para o seu Administrador e insira abaixo.
                </p>
              ) : (
                <p className="text-xs text-white/70 mt-2">
                  Código validado! Crie sua nova senha de acesso.
                </p>
              )}
            </div>

            {resetStep === 1 ? (
              <form onSubmit={handleValidateResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">Seu Celular</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={resetCelular}
                    onChange={(e) => {
                      setResetCelular(formatPhone(e.target.value));
                      setResetError("");
                    }}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">Código PIN (6 dígitos)</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={resetCode}
                    onChange={(e) => {
                      setResetCode(e.target.value.replace(/\D/g, ''));
                      setResetError("");
                    }}
                    className="w-full glass-input rounded-xl px-4 py-3 text-center tracking-[0.5em] font-mono text-lg font-bold text-white placeholder:text-white/20"
                  />
                </div>
                
                {resetError && <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg text-center font-medium">{resetError}</div>}
                
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full gradient-primary rounded-xl py-3 text-primary-foreground font-bold text-sm hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Validar Código"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">Nova Senha</label>
                  <input
                    type="password"
                    placeholder="Digite a nova senha"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setResetError("");
                    }}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">Confirme a Nova Senha</label>
                  <input
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setResetError("");
                    }}
                    className="w-full glass-input rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                {resetError && <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg text-center font-medium">{resetError}</div>}
                <div className="text-[10px] text-white/50 text-center px-2">
                  A senha deve ter pelo menos 6 caracteres, 1 número e 1 caractere especial (!@#$%^&*).
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-green-500 hover:bg-green-600 rounded-xl py-3 text-white font-bold text-sm hover:scale-[1.02] transition-all disabled:opacity-50"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Redefinir Senha"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

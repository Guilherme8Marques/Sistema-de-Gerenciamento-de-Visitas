import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone, Eye, EyeOff, Shield, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getDeviceToken } from "@/lib/device-fingerprint";
import coffeeBg from "@/assets/coffee-bg.jpg";
import principalLogo from "@/assets/Principal.png";

type PasswordStrength = "empty" | "weak" | "medium" | "strong";

const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return "empty";
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasUpper = /[A-Z]/.test(password);

  if (password.length >= 8 && hasNumber && hasSpecial && hasUpper) return "strong";
  if (password.length >= 8 && hasNumber) return "medium";
  return "weak";
};

const strengthConfig: Record<Exclude<PasswordStrength, "empty">, { label: string; color: string; width: string }> = {
  weak: { label: "Fraca", color: "bg-red-500", width: "w-1/3" },
  medium: { label: "Média", color: "bg-yellow-500", width: "w-2/3" },
  strong: { label: "Forte", color: "bg-green-500", width: "w-full" },
};

const Cadastro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [celular, setCelular] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(senha), [senha]);

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

  const handleCelularChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCelular(formatPhone(e.target.value));
  };

  const handleMatriculaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setMatricula(digits);
  };

  const getRawDigits = () => celular.replace(/\D/g, "");

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = getRawDigits();

    if (!nome.trim()) {
      toast({ title: "Preencha seu nome completo", variant: "destructive" });
      return;
    }
    if (!matricula.trim()) {
      toast({ title: "Preencha sua matrícula", variant: "destructive" });
      return;
    }
    if (digits.length < 10) {
      toast({ title: "Celular deve ter 10 ou 11 dígitos (DDD + número)", variant: "destructive" });
      return;
    }
    if (senha.length < 6) {
      toast({ title: "Senha deve ter no mínimo 6 caracteres", variant: "destructive" });
      return;
    }

    // Validar força da senha (1 número, 1 caractere especial mínimo)
    if (!/(?=.*[0-9])/.test(senha)) {
      toast({ title: "A senha deve conter pelo menos um número", variant: "destructive" });
      return;
    }
    if (!/(?=.*[!@#$%^&*])/.test(senha)) {
      toast({ title: "A senha deve conter pelo menos um caractere especial (!@#$%^&*)", variant: "destructive" });
      return;
    }

    if (senha !== confirmarSenha) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    try {
      const deviceToken = await getDeviceToken();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          matricula: matricula.trim(),
          celular: digits,
          senha,
          device_fingerprint: deviceToken,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({ title: data.error || "Erro ao cadastrar.", variant: "destructive" });
        return;
      }

      toast({ title: "Cadastro realizado com sucesso!" });
      navigate("/");
    } catch {
      toast({ title: "Erro de conexão com o servidor.", variant: "destructive" });
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center overflow-x-hidden py-12 min-h-screen">
      {/* Background Image - bleeds vertically for mobile scroll handling */}
      <img
        src={coffeeBg}
        alt="Plantação de café"
        className="fixed -inset-y-20 inset-x-0 w-full h-[120vh] object-cover pointer-events-none"
      />
      {/* Overlay */}
      <div className="fixed -inset-y-20 inset-x-0 w-full h-[120vh] gradient-bg pointer-events-none" />

      {/* Back button */}
      <div className="relative z-10 w-full max-w-sm px-6 mb-6 flex justify-start">
        <button
          onClick={() => navigate("/")}
          className="glass-card w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-8 animate-fade-in-up">
        <div className="w-20 h-20 flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-500">
          <img
            src={principalLogo}
            alt="Logo Principal"
            className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          />
        </div>
        <h1 className="text-2xl font-display font-bold text-primary-foreground">
          Criar Conta
        </h1>
        <p className="text-sm text-primary-foreground/70 mt-1">
          Preencha seus dados para acessar o sistema
        </p>
      </div>

      {/* Register Card */}
      <div
        className="relative z-10 w-full max-w-sm mx-6 glass-card-strong rounded-3xl p-6 animate-fade-in-up"
        style={{ animationDelay: "0.15s" }}
      >
        {/* Info banner */}
        <div className="glass-card rounded-xl p-3 flex items-center gap-3 mb-6">
          <Smartphone className="w-5 h-5 text-primary-foreground flex-shrink-0" />
          <p className="text-xs text-primary-foreground/90">
            O número do seu <strong>celular corporativo</strong> será seu login.
          </p>
        </div>

        <form onSubmit={handleCadastro} className="space-y-4" autoComplete="off">
          {/* Nome */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-1.5">
              Nome Completo
            </label>
            <input
              type="text"
              placeholder="Digite seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          {/* Matrícula */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-1.5">
              Matrícula
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Digite sua matrícula"
              value={matricula}
              onChange={handleMatriculaChange}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-1.5">
              Celular Corporativo
            </label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={celular}
              onChange={handleCelularChange}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {/* Strength indicator */}
            {passwordStrength !== "empty" && (
              <div className="mt-2 space-y-1.5 animate-fade-in">
                <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthConfig[passwordStrength].color} ${strengthConfig[passwordStrength].width}`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-primary-foreground/60" />
                  <span className="text-[10px] text-primary-foreground/60">
                    Segurança: <strong>{strengthConfig[passwordStrength].label}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-primary-foreground/90 mb-1.5">
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full glass-input rounded-xl px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full gradient-primary rounded-xl py-3.5 mt-2 text-primary-foreground font-semibold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Finalizar Cadastro
          </button>
        </form>
      </div>

      {/* Footer decoration */}
      <div className="relative z-10 mt-8 flex items-center gap-1 text-primary-foreground/40">
        <Leaf className="w-4 h-4" />
        <span className="text-xs">Unidos pela excelência</span>
        <Leaf className="w-4 h-4 scale-x-[-1]" />
      </div>
    </div>
  );
};

export default Cadastro;

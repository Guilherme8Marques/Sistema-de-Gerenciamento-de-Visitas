import { useNavigate } from "react-router-dom";
import { LogOut, Leaf, Settings } from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg";
import principalLogo from "@/assets/Principal.png";



const ADMIN_ROLE = "Administrador";

const menuItems = [
  {
    id: "planejamento",
    iconSrc: principalLogo,
    title: "Planejamento",
    description: "Organize sua agenda semanal",
    color: "from-primary to-green-light",
    path: "/planejamento",
  },
  {
    id: "registro",
    iconSrc: principalLogo,
    title: "Registro",
    description: "Registre as visitas realizadas",
    color: "from-secondary to-brown-light",
    path: "/registro",
  },
  {
    id: "calendario",
    iconSrc: principalLogo,
    title: "Calendário",
    description: "Consulte seu histórico mensal",
    color: "from-green-light to-primary",
    path: "/calendario",
  },
  {
    id: "relatorios",
    iconSrc: principalLogo,
    title: "Relatórios Gerenciais",
    description: "Desempenho, métricas e histórico da equipe",
    color: "from-accent to-gold-light",
    path: "/relatorios",
    adminOnly: true,
  },
];

const Menu = () => {
  const navigate = useNavigate();

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const userRole = user?.role || "";
  const showDashboard = userRole === ADMIN_ROLE;

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="flex-1 flex flex-col">

      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5 bg-white/5">
        <button
          onClick={handleLogout}
          className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-transform shrink-0"
          title="Sair"
        >
          <LogOut className="w-5 h-5 text-primary-foreground transform rotate-180" />
        </button>

        <div className="flex flex-col items-center justify-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center">
              <img src={principalLogo} alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-white to-emerald-300 bg-clip-text text-transparent">
                AgroMapa
              </span>
            </div>
          </div>
        </div>

        {showDashboard ? (
          <button
            onClick={() => navigate("/configuracoes")}
            className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-transform shrink-0"
            title="Configurações e Acessos"
          >
            <Settings className="w-5 h-5 text-primary-foreground" />
          </button>
        ) : (
          <div className="w-10 h-10 shrink-0" />
        )}
      </header>

      {/* Welcome */}
      <div className="relative z-10 px-6 pt-8 pb-6 animate-fade-in-up">
        <h1 className="text-3xl font-display font-bold text-primary-foreground">
          Olá, {user?.nome?.split(" ")[0] || "bem-vindo"}!
        </h1>
        <p className="text-primary-foreground/60 mt-1 text-sm">
          O que deseja fazer hoje?
        </p>
      </div>

      {/* Menu Cards */}
      <div className="relative z-10 flex-1 px-5 pb-8 space-y-4">
        {menuItems
          .filter(item => !item.adminOnly || showDashboard)
          .map((item, index) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="group w-full glass-card-strong rounded-2xl p-5 flex items-center gap-4 text-left shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all animate-fade-in-up"
              style={{ animationDelay: `${0.1 + index * 0.1}s` }}
            >
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-xl">
                <img
                  src={item.iconSrc}
                  alt={item.title}
                  className="w-14 h-14 object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <div>
                <h3 className="font-display font-semibold text-primary-foreground text-base">
                  {item.title}
                </h3>
                <p className="text-xs text-primary-foreground/60 mt-0.5">
                  {item.description}
                </p>
              </div>
            </button>
          ))}
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-white/20">
          <Leaf className="w-3 h-3" />
          <div className="h-px w-8 bg-white/10" />
          <Leaf className="w-3 h-3 scale-x-[-1]" />
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.15em] text-white/30 font-semibold">
            Desenvolvido por
          </p>
          <p className="text-[11px] text-white/50 font-medium">
            Inteligência de Mercado / Comercial Insumos
          </p>
        </div>
      </div>
    </div>
  );
};

export default Menu;

import { useNavigate } from "react-router-dom";
import { LogOut, Leaf } from "lucide-react";
import coffeeBg from "@/assets/coffee-bg.jpg";
import principalLogo from "@/assets/Principal.png";

import iconPlanejar from "@/assets/Planejar Visitas.png";
import iconRegistro from "@/assets/Registro de Visitas.png";
import iconCalendario from "@/assets/Calendário de Visitas.png";
import iconRelatorios from "@/assets/Relatórios Gerenciais.png";

const ADMIN_ROLE = "Administrador";

const menuItems = [
  {
    id: "planejamento",
    iconSrc: iconPlanejar,
    title: "Planejar Visitas",
    description: "Organize sua agenda semanal",
    color: "from-primary to-green-light",
    path: "/planejamento",
  },
  {
    id: "registro",
    iconSrc: iconRegistro,
    title: "Registro de Visitas",
    description: "Registre as visitas realizadas",
    color: "from-secondary to-brown-light",
    path: "/registro",
  },
  {
    id: "calendario",
    iconSrc: iconCalendario,
    title: "Calendário de Visitas",
    description: "Consulte seu histórico mensal",
    color: "from-green-light to-primary",
    path: "/calendario",
  },
  {
    id: "relatorios",
    iconSrc: iconRelatorios,
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

      <header className="relative z-10 flex items-center justify-between px-5 pt-6 pb-4 border-b border-white/5 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center">
            <img src={principalLogo} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest leading-none">
              Sistema
            </span>
            <span className="text-sm font-bold text-white tracking-tight">
              Gerenciador de Visitas
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="glass-card w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <LogOut className="w-5 h-5 text-primary-foreground" />
        </button>
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
              <img
                src={item.iconSrc}
                alt={item.title}
                className="w-20 h-20 object-contain drop-shadow-xl flex-shrink-0 ml-[-8px] transition-transform duration-300 group-hover:scale-110"
              />
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

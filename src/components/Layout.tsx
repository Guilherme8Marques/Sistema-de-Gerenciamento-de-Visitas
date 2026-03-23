import { Outlet } from "react-router-dom";
import coffeeBg from "@/assets/coffee-bg.jpg";

const Layout = () => {
    return (
        <div className="relative min-h-[100dvh] flex flex-col">
            {/* Stable Background - Moved here to prevent flickering */}
            <img
                src={coffeeBg}
                alt="Plantação de café"
                className="fixed inset-0 w-full h-full object-cover opacity-85 z-0 pointer-events-none"
            />
            <div className="fixed inset-0 gradient-bg z-0 pointer-events-none" />

            {/* Content Area */}
            <div className="relative z-10 flex flex-col flex-1 pb-10">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;

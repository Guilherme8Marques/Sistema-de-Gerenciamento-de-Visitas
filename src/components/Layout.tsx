import { Outlet } from "react-router-dom";
import coffeeBg from "@/assets/coffee-bg.jpg";

const Layout = () => {
    return (
        <div className="relative min-h-screen flex flex-col overflow-hidden">
            {/* Stable Background - Moved here to prevent flickering */}
            <img
                src={coffeeBg}
                alt="Plantação de café"
                className="fixed inset-0 w-full h-full object-cover opacity-85 z-0"
            />
            <div className="fixed inset-0 gradient-bg z-0" />

            {/* Content Area */}
            <div className="relative z-10 flex flex-col min-h-screen">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;

import { Outlet } from "react-router-dom";
import coffeeBg from "@/assets/coffee-bg.jpg";

const Layout = () => {
    return (
        <div className="relative flex flex-col" style={{ minHeight: '100dvh' }}>
            {/* Stable Background - bleeds vertically to handle mobile URL bar hiding */}
            <img
                src={coffeeBg}
                alt="Plantação de café"
                className="fixed -inset-y-20 inset-x-0 w-full h-[120vh] object-cover opacity-85 z-0 pointer-events-none"
            />
            <div className="fixed -inset-y-20 inset-x-0 w-full h-[120vh] gradient-bg z-0 pointer-events-none" />

            {/* Content Area - grows to fill and scrolls naturally */}
            <div className="relative z-10 flex flex-col flex-1 pb-10">
                <Outlet />
            </div>
        </div>
    );
};

export default Layout;

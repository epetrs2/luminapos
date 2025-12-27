
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { CashRegister } from './pages/CashRegister';
import { Reports } from './pages/Reports';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { SalesHistory } from './pages/SalesHistory';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders'; 
import { NotificationSystem } from './components/NotificationSystem';
import { StoreProvider, useStore } from './components/StoreContext';
import { AppView } from './types';
import { Store, Zap } from 'lucide-react';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white animate-[fadeOut_0.5s_ease-in_forwards_2.5s]">
            <div className="relative animate-[zoomIn_0.8s_ease-out_forwards]">
                <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/20">
                    <Store className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 bg-indigo-500 rounded-full p-2 animate-[bounce_2s_infinite]">
                    <Zap className="w-4 h-4 text-white" />
                </div>
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2 animate-[slideUp_0.8s_ease-out_forwards_0.2s] opacity-0">LuminaPOS</h1>
            <p className="text-slate-400 text-sm animate-[slideUp_0.8s_ease-out_forwards_0.4s] opacity-0">Sistema de Venta Inteligente</p>
        </div>
    );
};

// Wrapper component to handle auth state consumption
const MainApp: React.FC = () => {
    const { currentUser, isLoggingOut } = useStore();
    const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        // Splash screen timer
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3000); // 2.5s fade out start + buffer
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (currentUser) {
            setCurrentView(AppView.DASHBOARD);
        }
    }, [currentUser?.id]);

    const renderView = () => {
        const role = currentUser?.role || 'CASHIER';
        const isAdmin = role === 'ADMIN';
        const isManager = role === 'MANAGER' || isAdmin;

        switch (currentView) {
        case AppView.DASHBOARD: return <Dashboard setView={setCurrentView} />;
        case AppView.POS: return <POS />;
        case AppView.ORDERS: return <Orders setView={setCurrentView} />; 
        case AppView.INVENTORY: return isManager ? <Inventory /> : <Dashboard setView={setCurrentView} />;
        case AppView.HISTORY: return isManager ? <SalesHistory /> : <Dashboard setView={setCurrentView} />;
        case AppView.CUSTOMERS: return <Customers />;
        case AppView.SUPPLIERS: return isManager ? <Suppliers /> : <Dashboard setView={setCurrentView} />;
        case AppView.CASH: return <CashRegister />;
        case AppView.REPORTS: return isManager ? <Reports /> : <Dashboard setView={setCurrentView} />;
        case AppView.SETTINGS: return isAdmin ? <Settings /> : <Dashboard setView={setCurrentView} />;
        case AppView.USERS: return isAdmin ? <Users /> : <Dashboard setView={setCurrentView} />;
        default: return <Dashboard setView={setCurrentView} />;
        }
    };

    if (showSplash) {
        return <SplashScreen />;
    }

    if (!currentUser) {
        return (
            <div className="animate-[fadeIn_0.5s_ease-out]">
                <Login />
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 ${isLoggingOut ? 'animate-[fadeOut_0.3s_ease-in_forwards]' : 'animate-[fadeIn_0.5s_ease-out]'}`}>
            <Sidebar currentView={currentView} setView={setCurrentView} />
            <main className="min-h-screen">
                {renderView()}
            </main>
            <NotificationSystem />
        </div>
    );
};

function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}

export default App;

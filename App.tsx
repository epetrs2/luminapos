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

// Wrapper component to handle auth state consumption
const MainApp: React.FC = () => {
    const { currentUser } = useStore();
    const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);

    useEffect(() => {
        if (currentUser) {
            setCurrentView(AppView.DASHBOARD);
        }
    }, [currentUser?.id]);

    if (!currentUser) {
        return <Login />;
    }

    const renderView = () => {
        const role = currentUser.role;
        const isAdmin = role === 'ADMIN';
        const isManager = role === 'MANAGER' || isAdmin;

        switch (currentView) {
        case AppView.DASHBOARD: return <Dashboard setView={setCurrentView} />;
        case AppView.POS: return <POS />;
        case AppView.ORDERS: return <Orders />; 
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
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

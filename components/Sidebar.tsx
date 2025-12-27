
import React, { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, DollarSign, PieChart, Store, Users, Truck, History, Settings, LogOut, Shield, Menu, X, ClipboardList, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { AppView } from '../types';
import { useStore } from './StoreContext';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const { products, settings, currentUser, logout, isSyncing, hasPendingChanges, pullFromCloud, notify } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // IGNORE INACTIVE PRODUCTS IN LOW STOCK COUNT
  const lowStockCount = products.filter(p => p.isActive !== false && p.stock < 5).length;
  
  const role = currentUser?.role || 'CASHIER';
  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER' || role === 'ADMIN';

  let menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard, allowed: true },
    { id: AppView.POS, label: 'Punto de Venta', icon: ShoppingCart, allowed: true },
    { id: AppView.ORDERS, label: 'Pedidos / Prod.', icon: ClipboardList, allowed: true },
    { id: AppView.INVENTORY, label: 'Inventario', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined, allowed: isManager },
    { id: AppView.HISTORY, label: 'Historial', icon: History, allowed: isManager },
    { id: AppView.CUSTOMERS, label: 'Clientes', icon: Users, allowed: true },
    { id: AppView.SUPPLIERS, label: 'Proveedores', icon: Truck, allowed: isManager },
    { id: AppView.CASH, label: 'Caja Chica', icon: DollarSign, allowed: true },
    { id: AppView.REPORTS, label: 'Reportes', icon: PieChart, allowed: isManager },
    { id: AppView.USERS, label: 'Usuarios', icon: Shield, allowed: isAdmin },
  ];

  const filteredMenu = menuItems.filter(item => item.allowed);

  const handleNavClick = (view: AppView) => {
    setView(view);
    setIsMobileMenuOpen(false);
  };

  const handleForceSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSyncing) return;
      notify("Sincronizando", "Conectando con la nube...", "info");
      await pullFromCloud();
  };

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 z-50 flex items-center justify-between px-4 shadow-md">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center overflow-hidden">
                {settings.logo ? <img src={settings.logo} alt="Logo" className="w-full h-full object-contain rounded" /> : <Store className="w-5 h-5 text-white" />}
            </div>
            <span className="font-bold text-white truncate">{settings.name}</span>
         </div>
         <div className="flex items-center gap-2">
             {settings.enableCloudSync && (
                 <button onClick={handleForceSync} disabled={isSyncing} className={`p-3 text-indigo-300 hover:text-white hover:bg-white/10 rounded-lg active:scale-95 transition-transform ${isSyncing ? 'opacity-50' : ''}`}>
                     <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : ''}`} />
                 </button>
             )}
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-3 text-white hover:bg-white/10 rounded-lg active:scale-95 transition-transform">
                {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
             </button>
         </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className={`fixed top-0 left-0 h-screen bg-slate-900 text-white flex flex-col shadow-xl z-50 transition-transform duration-300 ease-in-out w-72 md:w-64 ${isMobileMenuOpen ? 'translate-x-0 pt-16' : '-translate-x-full pt-0'} md:translate-x-0 md:pt-0`}>
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-slate-700">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
            {settings.logo ? <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" /> : <Store className="w-6 h-6 text-white" />}
            </div>
            <div className="overflow-hidden flex-1">
            <h1 className="text-lg font-bold tracking-tight truncate">{settings.name || 'LuminaPOS'}</h1>
            <div className="flex items-center gap-1">
                {settings.enableCloudSync ? (
                    isSyncing ? (
                        <div title="Sincronizando..." className="flex items-center gap-1 text-[10px] text-orange-400 font-bold uppercase animate-pulse">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Guardando...
                        </div>
                    ) : hasPendingChanges ? (
                        <div title="Cambios sin guardar en la nube" className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold uppercase">
                            <AlertCircle className="w-2.5 h-2.5" /> Sin Guardar
                        </div>
                    ) : (
                        <div title="Todo sincronizado" className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase">
                            <Cloud className="w-2.5 h-2.5" /> Nube OK
                        </div>
                    )
                ) : (
                    <div title="Sólo memoria local" className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                        <CloudOff className="w-2.5 h-2.5" /> Local
                    </div>
                )}
                {settings.enableCloudSync && (
                    <button 
                        onClick={handleForceSync} 
                        disabled={isSyncing}
                        className={`ml-auto p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-all active:scale-95 border border-slate-700 ${isSyncing ? 'cursor-not-allowed opacity-50' : 'hover:text-white text-indigo-400 hover:border-indigo-500'}`} 
                        title="Forzar Sincronización"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-white' : ''}`} />
                    </button>
                )}
            </div>
            </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto custom-scrollbar">
            {filteredMenu.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
                <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-4 md:py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 translate-x-1' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                <div className="flex items-center gap-3">
                    <Icon className={`w-6 h-6 md:w-5 md:h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className="font-medium text-base md:text-sm">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                    <span className={`flex items-center justify-center min-w-[24px] h-6 md:min-w-[20px] md:h-5 px-1.5 rounded-full text-xs font-bold ${isActive ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'}`}>{item.badge}</span>
                )}
                </button>
            );
            })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
            {isAdmin && (
                <button onClick={() => handleNavClick(AppView.SETTINGS)} className={`w-full flex items-center gap-3 px-4 py-4 md:py-3 rounded-xl transition-all duration-200 group ${currentView === AppView.SETTINGS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Settings className={`w-6 h-6 md:w-5 md:h-5 ${currentView === AppView.SETTINGS ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span className="font-medium text-base md:text-sm">Configuración</span>
                </button>
            )}
            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-4 md:py-3 rounded-xl transition-all duration-200 text-red-400 hover:bg-red-900/20 hover:text-red-300">
                <LogOut className="w-6 h-6 md:w-5 md:h-5" />
                <span className="font-medium text-base md:text-sm">Cerrar Sesión</span>
            </button>
        </div>
      </div>
    </>
  );
};

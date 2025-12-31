import React, { useState } from 'react';
import { 
    LayoutDashboard, ShoppingCart, Package, Users, Truck, 
    History, Settings, LogOut, Menu, X, RefreshCw, 
    FileText, DollarSign, ListOrdered, Shield
} from 'lucide-react';
import { AppView } from '../types';
import { useStore } from './StoreContext';

interface SidebarProps {
    currentView: AppView;
    setView: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const { currentUser, logout, isSyncing, hasPendingChanges, notify, useStore: _ } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (view: AppView) => {
    setView(view);
    setIsMobileMenuOpen(false);
  };

  const handleForceSync = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const store = useStore(); // Access store here directly to call methods if needed
      if (isSyncing) return;

      // SMART SYNC LOGIC
      if (hasPendingChanges) {
          notify("Subiendo Cambios", "Detectamos cambios locales. Guardando en la nube...", "info");
          await store.pushToCloud();
      } else {
          notify("Sincronizando", "Buscando datos nuevos en la nube...", "info");
          await store.pullFromCloud();
      }
  };

  const menuItems = [
      { id: AppView.DASHBOARD, label: 'Panel', icon: LayoutDashboard },
      { id: AppView.POS, label: 'Punto de Venta', icon: ShoppingCart },
      { id: AppView.ORDERS, label: 'Pedidos', icon: ListOrdered },
      { id: AppView.INVENTORY, label: 'Inventario', icon: Package },
      { id: AppView.CUSTOMERS, label: 'Clientes', icon: Users },
      { id: AppView.SUPPLIERS, label: 'Proveedores', icon: Truck },
      { id: AppView.HISTORY, label: 'Historial', icon: History },
      { id: AppView.CASH, label: 'Caja Chica', icon: DollarSign },
      { id: AppView.REPORTS, label: 'Reportes', icon: FileText },
  ];

  if (currentUser?.role === 'ADMIN') {
      menuItems.push({ id: AppView.USERS, label: 'Usuarios', icon: Shield });
      menuItems.push({ id: AppView.SETTINGS, label: 'Configuración', icon: Settings });
  }

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 z-50 flex items-center justify-between px-4 shadow-md">
          <span className="text-white font-bold text-lg">LuminaPOS</span>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-2">
              {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
      </div>

      <div className={`fixed inset-y-0 left-0 bg-slate-900 w-64 transform transition-transform duration-300 ease-in-out z-50 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col h-full text-white">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <div>
                      <h1 className="text-2xl font-bold tracking-tight">Lumina</h1>
                      <p className="text-xs text-slate-400">Sistema Inteligente</p>
                  </div>
                  <button 
                    onClick={handleForceSync}
                    className={`p-2 rounded-full hover:bg-slate-800 transition-colors ${isSyncing ? 'animate-spin text-indigo-400' : hasPendingChanges ? 'text-orange-400' : 'text-slate-400'}`}
                    title={hasPendingChanges ? "Cambios pendientes de subir" : "Sincronizar"}
                  >
                      <RefreshCw className="w-5 h-5" />
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                  <nav className="space-y-1 px-3">
                      {menuItems.map(item => (
                          <button
                              key={item.id}
                              onClick={() => handleNavClick(item.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                          >
                              <item.icon className="w-5 h-5" />
                              <span className="font-medium text-sm">{item.label}</span>
                          </button>
                      ))}
                  </nav>
              </div>

              <div className="p-4 border-t border-slate-800">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 mb-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs">
                          {currentUser?.username.substring(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{currentUser?.fullName}</p>
                          <p className="text-xs text-slate-400 truncate capitalize">{currentUser?.role.toLowerCase()}</p>
                      </div>
                  </div>
                  <button 
                      onClick={logout}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors text-sm font-bold"
                  >
                      <LogOut className="w-4 h-4" /> Cerrar Sesión
                  </button>
              </div>
          </div>
      </div>
      
      {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
    </>
  );
};


import React, { useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { DollarSign, ShoppingCart, Package, Users, TrendingUp, AlertTriangle, ArrowRight, Clock, Box, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC<{ setView: (view: any) => void }> = ({ setView }) => {
  const { transactions, products, customers, currentUser, cashMovements } = useStore();

  // Metrics (Filtered: Exclude cancelled)
  const today = new Date().toDateString();
  const todaysTransactions = transactions.filter(t => t.status !== 'cancelled' && new Date(t.date).toDateString() === today);
  const todaysSales = todaysTransactions.reduce((acc, t) => acc + t.total, 0);
  
  // IGNORE INACTIVE PRODUCTS IN DASHBOARD LOW STOCK INDICATOR
  const lowStockProducts = products.filter(p => p.isActive !== false && p.stock < 5);
  
  const totalProducts = products.length;
  const totalCustomers = customers.length;
  
  // --- FIX: Calculate Balance based on Current Session (Like CashRegister.tsx) ---
  const currentBalance = useMemo(() => {
      const sortedMovements = [...cashMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastCloseIndex = sortedMovements.findIndex(m => m.type === 'CLOSE');
      
      // If we found a close, take only movements AFTER that close (slice 0 to index)
      // If no close found (-1), take all movements
      const activeMovements = lastCloseIndex === -1 
          ? sortedMovements 
          : sortedMovements.slice(0, lastCloseIndex);

      return activeMovements.reduce((acc, curr) => {
          if (curr.type === 'OPEN' || curr.type === 'DEPOSIT') return acc + curr.amount;
          if (curr.type === 'EXPENSE' || curr.type === 'WITHDRAWAL') return acc - curr.amount;
          return acc;
      }, 0);
  }, [cashMovements]);

  // Chart Data (Last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
  });

  const chartData = last7Days.map(date => {
      const dateStr = date.toDateString();
      const daySales = transactions
        .filter(t => t.status !== 'cancelled' && new Date(t.date).toDateString() === dateStr)
        .reduce((acc, t) => acc + t.total, 0);
      return {
          name: date.toLocaleDateString('es-ES', { weekday: 'short' }),
          sales: daySales
      };
  });

  // Recent Transactions (Filtered)
  const recentTransactions = [...transactions]
    .filter(t => t.status !== 'cancelled')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
       <div className="max-w-7xl mx-auto">
          {/* Welcome Header */}
          <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                  <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                      Hola, {currentUser?.fullName?.split(' ')[0] || 'Usuario'} 👋
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Resumen de actividad en tiempo real.</p>
              </div>
              <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300 capitalize">
                      {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
              </div>
          </div>

          {/* Featured Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Sales Card */}
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
                  <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <DollarSign className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                      <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                          <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-indigo-100 font-medium mb-1">Ventas Hoy</p>
                      <h3 className="text-4xl font-black tracking-tight">${todaysSales.toFixed(2)}</h3>
                      <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium backdrop-blur-md">
                          <ShoppingCart className="w-3 h-3" /> {todaysTransactions.length} tickets
                      </div>
                  </div>
              </div>

              {/* Cash Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col relative group hover:border-indigo-100 dark:hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                          <Wallet className="w-6 h-6" />
                      </div>
                      <button onClick={() => setView('CASH')} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                          <ArrowRight className="w-5 h-5" />
                      </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Caja Chica</p>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">${currentBalance.toFixed(2)}</h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-auto font-medium">Disponible para gastos</p>
              </div>

              {/* Inventory Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col relative group hover:border-indigo-100 dark:hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                          <Package className="w-6 h-6" />
                      </div>
                      <button onClick={() => setView('INVENTORY')} className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                          <ArrowRight className="w-5 h-5" />
                      </button>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Inventario</p>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{totalProducts}</h3>
                  <p className="text-xs text-slate-400 mt-auto flex items-center gap-1">
                      <Box className="w-3 h-3" /> Productos únicos
                  </p>
              </div>

              {/* Alerts Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col relative group hover:border-orange-100 dark:hover:border-orange-900/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl">
                          <AlertTriangle className="w-6 h-6" />
                      </div>
                      <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-bold px-2 py-1 rounded-lg">
                          Atención
                      </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Stock Bajo</p>
                  <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{lowStockProducts.length}</h3>
                  <button onClick={() => setView('INVENTORY')} className="text-xs text-orange-600 dark:text-orange-400 mt-auto font-medium hover:underline text-left">
                      Ver productos afectados
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Sales Chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 min-w-0">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Tendencia Semanal</h3>
                      <div className="flex gap-2">
                          <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                          <span className="text-xs text-slate-500">Ventas</span>
                      </div>
                  </div>
                  <div className="h-80 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `$${val}`} width={40} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                            cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5'}}
                        />
                        <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                  </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Recientes</h3>
                      <button onClick={() => setView('HISTORY')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                          Ver todo
                      </button>
                  </div>
                  
                  <div className="space-y-4 flex-1 overflow-auto custom-scrollbar">
                      {recentTransactions.length > 0 ? recentTransactions.map(t => (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                      <ShoppingCart className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800 dark:text-white truncate">${t.total.toFixed(2)}</p>
                                      <p className="text-xs text-slate-400 flex items-center gap-1">
                                        #{t.id.slice(-6)} • {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </p>
                                  </div>
                              </div>
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold shrink-0">
                                  {t.paymentStatus === 'paid' ? 'Pagado' : 'Pend.'}
                              </span>
                          </div>
                      )) : (
                          <div className="text-center py-12 text-slate-400">
                              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                              <p className="text-sm">Sin ventas recientes</p>
                          </div>
                      )}
                  </div>
                  
                  <button 
                    onClick={() => setView('POS')}
                    className="w-full mt-6 py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-all shadow-lg shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2"
                  >
                      <ShoppingCart className="w-4 h-4" /> Ir a Punto de Venta
                  </button>
              </div>
          </div>
       </div>
    </div>
  );
};

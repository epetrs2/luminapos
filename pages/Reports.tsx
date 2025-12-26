
import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { generateBusinessInsight } from '../services/geminiService';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Sparkles, TrendingUp, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, Package, PieChart as PieIcon, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- COLORS FOR CHARTS ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export const Reports: React.FC = () => {
  const { transactions, products, cashMovements, settings } = useStore();
  const [timeRange, setTimeRange] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // --- 1. DATA PREPARATION & FILTERING (CRITICAL: EXCLUDE CANCELLED) ---
  const { 
      filteredTransactions, 
      filteredMovements, 
      dateLabels, 
      chartData,
      summaryMetrics,
      topProducts,
      categoryData
  } = useMemo(() => {
      const now = new Date();
      // Set start date based on range (start of day)
      const startDate = new Date();
      startDate.setDate(now.getDate() - (timeRange === 'WEEK' ? 6 : 29)); // 7 or 30 days inclusive
      startDate.setHours(0, 0, 0, 0);

      // Filter Transactions (BUG FIX: Exclude cancelled)
      const validTx = transactions.filter(t => {
          const tDate = new Date(t.date);
          return t.status !== 'cancelled' && tDate >= startDate && tDate <= now;
      });

      // Filter Cash Movements (For Expenses/CashFlow)
      const validMovs = cashMovements.filter(m => {
          const mDate = new Date(m.date);
          return mDate >= startDate && mDate <= now;
      });

      // --- AGGREGATION ---
      
      // 1. Sales Trend Data (Group by Day)
      const daysMap = new Map<string, { date: string, sales: number, expenses: number }>();
      
      // Initialize map with all dates in range to avoid gaps in charts
      for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
          const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
          const key = d.toDateString(); // Unique key
          daysMap.set(key, { date: label, sales: 0, expenses: 0 });
      }

      // Fill Sales
      validTx.forEach(t => {
          const key = new Date(t.date).toDateString();
          if (daysMap.has(key)) {
              const entry = daysMap.get(key)!;
              entry.sales += t.total;
          }
      });

      // Fill Expenses (Only type EXPENSE)
      validMovs.filter(m => m.type === 'EXPENSE').forEach(m => {
          const key = new Date(m.date).toDateString();
          if (daysMap.has(key)) {
              const entry = daysMap.get(key)!;
              entry.expenses += m.amount;
          }
      });

      const chartDataArray = Array.from(daysMap.values());

      // 2. Metrics
      const totalSales = validTx.reduce((sum, t) => sum + t.total, 0);
      const totalExpenses = validMovs.filter(m => m.type === 'EXPENSE').reduce((sum, m) => sum + m.amount, 0);
      const transactionCount = validTx.length;
      const avgTicket = transactionCount > 0 ? totalSales / transactionCount : 0;
      // Approximate profit (Sales - Recorded Expenses) - Simple view
      const netEstimate = totalSales - totalExpenses; 

      // 3. Top Products
      const productMap = new Map<string, { name: string, qty: number, total: number }>();
      validTx.forEach(t => {
          t.items.forEach(item => {
              const key = item.id; // Group by Product ID
              const current = productMap.get(key) || { name: item.name, qty: 0, total: 0 };
              current.qty += item.quantity;
              current.total += (item.price * item.quantity);
              productMap.set(key, current);
          });
      });
      const topProductsArray = Array.from(productMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

      // 4. Category Distribution
      const catMap = new Map<string, number>();
      validTx.forEach(t => {
          t.items.forEach(item => {
              const cat = item.category || 'General';
              catMap.set(cat, (catMap.get(cat) || 0) + (item.price * item.quantity));
          });
      });
      const categoryArray = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

      return {
          filteredTransactions: validTx,
          filteredMovements: validMovs,
          dateLabels: Array.from(daysMap.values()).map(d => d.date),
          chartData: chartDataArray,
          summaryMetrics: { totalSales, totalExpenses, avgTicket, transactionCount, netEstimate },
          topProducts: topProductsArray,
          categoryData: categoryArray
      };

  }, [transactions, cashMovements, timeRange]);

  // --- AI HANDLER ---
  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    // We pass the filtered (valid) data to the AI for accurate analysis
    const result = await generateBusinessInsight(products, filteredTransactions, filteredMovements);
    setInsight(result.text);
    setLoadingAi(false);
  };

  const isDark = settings.theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & CONTROLS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Activity className="w-8 h-8 text-indigo-500" /> Reportes y Análisis
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
                Visualiza el rendimiento de tu negocio. (Ventas anuladas excluidas).
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
             <button 
                onClick={() => setTimeRange('WEEK')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === 'WEEK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
             >
                7 Días
             </button>
             <button 
                onClick={() => setTimeRange('MONTH')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${timeRange === 'MONTH' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
             >
                30 Días
             </button>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Sales */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-20 h-20 text-indigo-600" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Ventas Netas</p>
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                    ${summaryMetrics.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-xs text-slate-400">{summaryMetrics.transactionCount} transacciones válidas</p>
            </div>

            {/* Expenses */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                        <ArrowDownRight className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Gastos Operativos</p>
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                    ${summaryMetrics.totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-xs text-slate-400">Registrados en Caja Chica</p>
            </div>

            {/* Net Estimate */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Flujo Neto (Aprox)</p>
                </div>
                <h3 className={`text-3xl font-black mb-1 ${summaryMetrics.netEstimate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    ${summaryMetrics.netEstimate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-xs text-slate-400">Ventas - Gastos</p>
            </div>

            {/* Avg Ticket */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Package className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Ticket Promedio</p>
                </div>
                <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                    ${summaryMetrics.avgTicket.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h3>
                <p className="text-xs text-slate-400">Por venta realizada</p>
            </div>
        </div>

        {/* AI INSIGHT SECTION */}
        <div className="mb-8">
            {!insight ? (
                <button 
                    onClick={handleGenerateInsight}
                    disabled={loadingAi}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3"
                >
                    {loadingAi ? <Activity className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {loadingAi ? 'Analizando datos...' : 'Generar Análisis Inteligente con IA'}
                </button>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900 overflow-hidden animate-[fadeIn_0.5s]">
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            <h3 className="font-bold">Análisis de Negocio IA</h3>
                        </div>
                        <button onClick={() => setInsight(null)} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Cerrar</button>
                    </div>
                    <div className="p-6 prose prose-sm prose-indigo dark:prose-invert max-w-none">
                        <ReactMarkdown>{insight}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>

        {/* CHARTS ROW 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 animate-[slideUp_0.4s_ease-out]">
            {/* Sales Trend Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" /> Tendencia de Ventas
                </h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} tickFormatter={(val) => `$${val}`} width={40} />
                            <Tooltip 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'}}
                                cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5'}}
                                formatter={(val: number) => [`$${val.toFixed(2)}`, 'Ventas']}
                            />
                            <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Products List */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
                <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-500" /> Top Productos
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    {topProducts.length > 0 ? topProducts.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {idx + 1}
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{p.name}</p>
                                    <p className="text-xs text-slate-500">{p.qty} vendidas</p>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                ${p.total.toFixed(0)}
                            </span>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-slate-400">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">Sin datos de venta</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* CHARTS ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-[slideUp_0.5s_ease-out]">
            {/* Cash Flow Comparison */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-indigo-500" /> Flujo de Caja (Ventas vs Gastos)
                </h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} tickFormatter={(val) => `$${val}`} width={40} />
                            <Tooltip 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'}}
                                cursor={{fill: isDark ? '#334155' : '#f1f5f9'}}
                            />
                            <Legend verticalAlign="top" height={36} iconType="circle"/>
                            <Bar name="Ventas" dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar name="Gastos" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Category Distribution */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-pink-500" /> Ventas por Categoría
                </h3>
                <div className="h-64 w-full flex items-center justify-center">
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} contentStyle={{borderRadius: '8px', border:'none'}} />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', color: textColor}} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center text-slate-400">
                            <PieIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Sin datos suficientes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

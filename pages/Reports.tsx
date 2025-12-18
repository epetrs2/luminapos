import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { generateBusinessInsight, generateBudgetAdvice } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, TrendingUp, DollarSign, Activity, PieChart, AlertCircle, CheckCircle, Info, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const Reports: React.FC = () => {
  const { transactions, products, cashMovements, settings, currentUser } = useStore();
  const [insight, setInsight] = useState<string | null>(null);
  const [budgetAdvice, setBudgetAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLANNING'>('OVERVIEW');

  const isAdmin = currentUser?.role === 'ADMIN';

  // --- OVERVIEW DATA ---
  const salesByDay = transactions.reduce((acc: any, t) => {
    const date = new Date(t.date).toLocaleDateString('es-ES', { weekday: 'short' });
    acc[date] = (acc[date] || 0) + t.total;
    return acc;
  }, {});
  
  const chartData = Object.keys(salesByDay).map(day => ({ name: day, ventas: salesByDay[day] }));
  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  const avgTicket = transactions.length > 0 ? totalSales / transactions.length : 0;

  // --- BUDGET DATA (Weekly Calculation) ---
  const { weeklyIncome, actualExpenses, actualInvestment, actualProfitWithdrawal } = useMemo(() => {
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      startOfWeek.setHours(0,0,0,0);

      // 1. Calculate Income from Sales (All methods: Cash, Card, Transfer)
      // We use 'amountPaid' to only count money actually received (important for credit sales)
      const weeklyTransactions = transactions.filter(t => 
          new Date(t.date) >= startOfWeek && 
          t.status !== 'cancelled'
      );
      const salesIncome = weeklyTransactions.reduce((acc, t) => acc + (t.amountPaid || 0), 0);

      // 2. Calculate Other Manual Deposits (Capital injection, etc.)
      // We exclude movements starting with 'mv_' because those are auto-generated from sales
      // and we already counted them in 'salesIncome' above.
      const weeklyMovements = cashMovements.filter(m => new Date(m.date) >= startOfWeek);
      const otherDeposits = weeklyMovements
          .filter(m => m.type === 'DEPOSIT' && !m.id.startsWith('mv_'))
          .reduce((acc, m) => acc + m.amount, 0);

      const weeklyIncome = salesIncome + otherDeposits;

      // 3. Expenses (From Cash Register movements)
      // Expenses specifically categorized as OPERATIONAL (fallback to general EXPENSE if no category for old data)
      const actualExpenses = weeklyMovements
        .filter(m => m.category === 'OPERATIONAL' || (m.type === 'EXPENSE' && !m.category))
        .reduce((acc, m) => acc + m.amount, 0);

      // Expenses specifically categorized as INVESTMENT
      const actualInvestment = weeklyMovements
        .filter(m => m.category === 'INVESTMENT')
        .reduce((acc, m) => acc + m.amount, 0);

      // Withdrawals specifically categorized as PROFIT/SALARY (fallback to general WITHDRAWAL)
      const actualProfitWithdrawal = weeklyMovements
        .filter(m => m.category === 'PROFIT' || (m.type === 'WITHDRAWAL' && !m.category))
        .reduce((acc, m) => acc + m.amount, 0);

      return { weeklyIncome, actualExpenses, actualInvestment, actualProfitWithdrawal };
  }, [transactions, cashMovements]);

  // Budget Allocations (Dynamic based on REAL Income)
  const budgetConfig = settings.budgetConfig || { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 };
  
  const allocatedExpenses = weeklyIncome * (budgetConfig.expensesPercentage / 100);
  const allocatedInvestment = weeklyIncome * (budgetConfig.investmentPercentage / 100);
  const allocatedProfit = weeklyIncome * (budgetConfig.profitPercentage / 100);

  // --- HANDLERS ---

  const handleGenerateInsight = async () => {
    setLoading(true);
    const result = await generateBusinessInsight(products, transactions, cashMovements);
    setInsight(result.text);
    setLoading(false);
  };

  const handleGenerateBudgetAdvice = async () => {
      setLoadingBudget(true);
      const advice = await generateBudgetAdvice(weeklyIncome, actualExpenses, actualProfitWithdrawal, budgetConfig);
      setBudgetAdvice(advice);
      setLoadingBudget(false);
  };

  const isDark = settings.theme === 'dark';
  const chartTextColor = isDark ? '#94a3b8' : '#64748b';
  const chartGridColor = isDark ? '#334155' : '#e2e8f0';

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Reportes</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Análisis financiero y operativo</p>
          </div>
          
          <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
             <button 
                onClick={() => setActiveTab('OVERVIEW')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'OVERVIEW' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
             >
                General
             </button>
             {isAdmin && (
                <button 
                    onClick={() => setActiveTab('PLANNING')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'PLANNING' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Planificación
                </button>
             )}
          </div>
        </div>

        {activeTab === 'OVERVIEW' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl">
                        <DollarSign className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Ventas Totales</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">${totalSales.toFixed(2)}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Ticket Promedio</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">${avgTicket.toFixed(2)}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Transacciones</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 dark:text-white">{transactions.length}</p>
                </div>
                </div>
                
                 <div className="mb-6 flex justify-end">
                    <button
                        onClick={handleGenerateInsight}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 transition-transform disabled:opacity-70 disabled:scale-100"
                    >
                        {loading ? <Activity className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {loading ? 'Analizando...' : 'Consultar Asistente IA'}
                    </button>
                 </div>

                {/* AI Insight Section */}
                {insight && (
                <div className="mb-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none border border-indigo-50 dark:border-indigo-900/50 overflow-hidden animate-[fadeIn_0.5s_ease-out]">
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex items-center gap-3">
                    <Sparkles className="text-white w-5 h-5" />
                    <h3 className="font-bold text-white">Análisis de Inteligencia Artificial</h3>
                    </div>
                    <div className="p-8 prose prose-indigo dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                    <ReactMarkdown>{insight}</ReactMarkdown>
                    </div>
                </div>
                )}

                {/* Chart Section */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col min-w-0">
                <h3 className="font-bold text-slate-800 dark:text-white mb-6">Tendencia de Ventas</h3>
                <div className="flex-1 min-h-0 w-full h-96">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: chartTextColor, fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: chartTextColor, fontSize: 12}} tickFormatter={(value) => `$${value}`} width={40} />
                        <Tooltip 
                        cursor={{fill: isDark ? '#1e293b' : '#f1f5f9'}}
                        contentStyle={{
                            borderRadius: '12px', 
                            border: 'none', 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            backgroundColor: isDark ? '#1e293b' : '#fff',
                            color: isDark ? '#fff' : '#000'
                        }}
                        />
                        <Bar dataKey="ventas" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>
        )}

        {activeTab === 'PLANNING' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
                {isAdmin ? (
                    <>
                        <div className="bg-indigo-600 rounded-2xl p-6 md:p-8 text-white mb-8 shadow-xl shadow-indigo-200 dark:shadow-none">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-2xl font-bold mb-1">Flujo de Caja Semanal</h3>
                                    <p className="text-indigo-200 text-sm">Ventas Totales (Efectivo/Tarjeta/Transferencia) + Otros Ingresos</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-indigo-200 font-bold uppercase tracking-wider">Ingreso Total Real</p>
                                    <p className="text-4xl font-black">${weeklyIncome.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* GASTOS CARD */}
                            <BudgetCard 
                                title="Gastos Operativos"
                                percent={budgetConfig.expensesPercentage}
                                allocated={allocatedExpenses}
                                actual={actualExpenses}
                                color="indigo"
                                icon={<Activity className="w-5 h-5"/>}
                                alertThreshold={true}
                                description="Luz, Renta, Insumos, Stock"
                            />

                            {/* INVERSION CARD */}
                            <BudgetCard 
                                title="Inversión / Ahorro"
                                percent={budgetConfig.investmentPercentage}
                                allocated={allocatedInvestment}
                                actual={actualInvestment} // Now tracks explicit investments
                                color="emerald"
                                icon={<TrendingUp className="w-5 h-5"/>}
                                isTarget={true}
                                description="Equipo, Marketing, Mejoras"
                            />

                            {/* PROFIT CARD */}
                            <BudgetCard 
                                title="Sueldos / Retiros"
                                percent={budgetConfig.profitPercentage}
                                allocated={allocatedProfit}
                                actual={actualProfitWithdrawal}
                                color="pink"
                                icon={<PieChart className="w-5 h-5"/>}
                                alertThreshold={true}
                                description="Sueldos, Gustos, Retiros Personales"
                            />
                        </div>
                        
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 mb-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-indigo-500"/> Asesor Financiero IA
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Analiza si tu distribución actual es saludable.</p>
                                </div>
                                <button
                                    onClick={handleGenerateBudgetAdvice}
                                    disabled={loadingBudget}
                                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                >
                                    {loadingBudget ? 'Pensando...' : 'Analizar Distribución'}
                                </button>
                            </div>
                            
                            {budgetAdvice && (
                                <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl prose prose-sm prose-indigo dark:prose-invert max-w-none animate-[fadeIn_0.5s]">
                                    <ReactMarkdown>{budgetAdvice}</ReactMarkdown>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                            <Info className="w-4 h-4" />
                            <p>Los datos incluyen todas las ventas (cobradas) y movimientos de caja registrados esta semana.</p>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <Lock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Acceso Restringido</h3>
                        <p className="text-slate-500">Solo administradores pueden ver la planificación financiera.</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

const BudgetCard: React.FC<{
    title: string;
    percent: number;
    allocated: number;
    actual: number;
    color: 'indigo' | 'emerald' | 'pink';
    icon: React.ReactNode;
    alertThreshold?: boolean;
    isTarget?: boolean;
    description?: string;
}> = ({ title, percent, allocated, actual, color, icon, alertThreshold, isTarget, description }) => {
    
    // Determine status colors
    const isOverBudget = alertThreshold && actual > allocated;
    
    let barColor = `bg-${color}-500`;
    let textColor = `text-${color}-600 dark:text-${color}-400`;
    let bgColor = `bg-${color}-100 dark:bg-${color}-900/20`;

    if (isOverBudget) {
        barColor = 'bg-red-500';
        textColor = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-100 dark:bg-red-900/20';
    }

    const progress = allocated > 0 ? Math.min((actual / allocated) * 100, 100) : 0;

    return (
        <div className={`p-6 rounded-2xl border transition-all ${bgColor} border-transparent`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-white dark:bg-slate-900/50 ${textColor}`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className={`text-xs font-bold uppercase tracking-wider ${textColor}`}>{percent}% asignado</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">${allocated.toFixed(2)}</p>
                </div>
            </div>
            
            <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-600 dark:text-slate-300">{title}</span>
                    <span className={`font-bold ${textColor}`}>${actual.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full bg-white dark:bg-slate-900 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${barColor} transition-all duration-500`} 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
            
            {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 border-t border-slate-200 dark:border-slate-700/50 pt-2">
                    {description}
                </p>
            )}
        </div>
    );
};

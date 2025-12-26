
import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { generateBusinessInsight } from '../services/geminiService';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine } from 'recharts';
import { Sparkles, TrendingUp, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, Package, PieChart as PieIcon, AlertCircle, Filter, X, Handshake, Tag, PieChart as SplitIcon, RefreshCw, Printer, FileText, Lock, Target, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { printFinancialReport, printZCutTicket } from '../utils/printService';

// --- COLORS FOR CHARTS ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316'];

type DateRangeOption = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type ReportTab = 'GENERAL' | 'Z_HISTORY' | 'DISTRIBUTION';

export const Reports: React.FC = () => {
  const { transactions, products, cashMovements, settings } = useStore();
  
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<ReportTab>('GENERAL');

  // --- FILTER STATE ---
  const [dateRange, setDateRange] = useState<DateRangeOption>('TODAY');
  const [showFilters, setShowFilters] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');

  // --- DISTRIBUTION ANALYSIS STATE ---
  const [distPeriod, setDistPeriod] = useState<'WEEK' | 'MONTH'>('MONTH');
  const [analysisResult, setAnalysisResult] = useState<{status: 'ok'|'warning'|'critical', messages: {title: string, desc: string, type: 'good'|'bad'|'info'}[]} | null>(null);

  // --- AI STATE ---
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // --- DATA PREPARATION & FILTERING ---
  const { 
      filteredTransactions, 
      filteredMovements, 
      chartData,
      summaryMetrics,
      topProducts,
      categoryData,
      expenseCategoryData,
      thirdPartyMetrics,
      zReportHistory
  } = useMemo(() => {
      const now = new Date();
      // Normalize "now" to end of day for comparisons
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0); // Default to start of today local time
      
      let endDate = endOfToday;

      // 1. Calculate Date Range (Robust Local Time Logic)
      if (dateRange === 'TODAY') {
          // Start date is already set to 00:00 today
          // End date is already set to 23:59 today
      } else if (dateRange === 'WEEK') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === 'MONTH') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 29);
          startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === 'CUSTOM') {
          if (customStart) {
              // Create date from string YYYY-MM-DD and set to local 00:00
              const [y, m, d] = customStart.split('-').map(Number);
              startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
          } else {
              startDate = new Date(0); // Beginning of time
          }
          
          if (customEnd) {
              const [y, m, d] = customEnd.split('-').map(Number);
              endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
          }
      }

      // Helper to check date range safely
      const isInRange = (dateStr: string) => {
          const d = new Date(dateStr);
          return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
      };

      // 2. Filter Transactions
      const validTx = transactions.filter(t => {
          const isDateInRange = isInRange(t.date);
          const isNotCancelled = t.status !== 'cancelled';
          const matchesPayment = paymentMethodFilter === 'ALL' || t.paymentMethod === paymentMethodFilter;
          return isDateInRange && isNotCancelled && matchesPayment;
      });

      // 3. Filter Cash Movements
      const validMovs = cashMovements.filter(m => {
          return isInRange(m.date);
      });

      // 4. Filter Z History (Cortes) - Independent of Date Range Filter unless specific needed
      const zHistory = cashMovements
          .filter(m => m.isZCut)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // --- AGGREGATION ---
      
      // A. Sales & Expenses Trend Data (Group by Day)
      const daysMap = new Map<string, { date: string, rawDate: number, sales: number, expenses: number }>();
      
      // Initialize map for continuity only if range is reasonable
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 60) {
          const iterDate = new Date(startDate);
          while (iterDate <= endDate) {
              const label = iterDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
              // Use simplified date string key to avoid timezone offset issues during lookup
              const key = `${iterDate.getFullYear()}-${iterDate.getMonth()}-${iterDate.getDate()}`; 
              daysMap.set(key, { date: label, rawDate: iterDate.getTime(), sales: 0, expenses: 0 });
              iterDate.setDate(iterDate.getDate() + 1);
          }
      }

      // Fill Sales
      validTx.forEach(t => {
          const d = new Date(t.date);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
          
          if (!daysMap.has(key)) {
              daysMap.set(key, { date: label, rawDate: d.getTime(), sales: 0, expenses: 0 });
          }
          
          const entry = daysMap.get(key)!;
          entry.sales += t.total;
      });

      // Fill Expenses
      validMovs.forEach(m => {
          if (m.type === 'EXPENSE' || (m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY')) {
              const d = new Date(m.date);
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const label = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });

              if (!daysMap.has(key)) {
                  daysMap.set(key, { date: label, rawDate: d.getTime(), sales: 0, expenses: 0 });
              }

              const entry = daysMap.get(key)!;
              entry.expenses += m.amount;
          }
      });

      const chartDataArray = Array.from(daysMap.values()).sort((a, b) => a.rawDate - b.rawDate);

      // B. Third Party Sales Calculation
      let thirdPartySales = 0;
      let ownSales = 0;

      validTx.forEach(t => {
          // If transaction has items, loop through them
          if (t.items && t.items.length > 0) {
              t.items.forEach(item => {
                  // Explicit check for true
                  if (item.isConsignment === true) {
                      thirdPartySales += (item.price * item.quantity);
                  } else {
                      ownSales += (item.price * item.quantity);
                  }
              });
          } else {
              // Fallback for very old data structure without items (unlikely)
              ownSales += t.total;
          }
      });

      const totalSales = validTx.reduce((sum, t) => sum + t.total, 0);
      
      // Total Money Out (Operational + Third Party Payouts)
      const totalMoneyOut = validMovs
        .filter(m => m.type === 'EXPENSE' || (m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY'))
        .reduce((sum, m) => sum + m.amount, 0);

      const transactionCount = validTx.length;
      const avgTicket = transactionCount > 0 ? totalSales / transactionCount : 0;
      
      // Operational Expenses Only (for Net Profit)
      const operationalExpenses = validMovs.filter(m => m.type === 'EXPENSE').reduce((sum, m) => sum + m.amount, 0);
      
      const netEstimate = ownSales - operationalExpenses; 

      // C. Top Products
      const productMap = new Map<string, { name: string, qty: number, total: number }>();
      validTx.forEach(t => {
          t.items.forEach(item => {
              const key = item.id;
              const current = productMap.get(key) || { name: item.name, qty: 0, total: 0 };
              current.qty += item.quantity;
              current.total += (item.price * item.quantity);
              productMap.set(key, current);
          });
      });
      const topProductsArray = Array.from(productMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

      // D. Product Categories
      const catMap = new Map<string, number>();
      validTx.forEach(t => {
          t.items.forEach(item => {
              const cat = item.category || 'General';
              catMap.set(cat, (catMap.get(cat) || 0) + (item.price * item.quantity));
          });
      });
      const categoryArray = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

      // E. Expenses Breakdown
      const expMap = new Map<string, number>();
      validMovs.filter(m => m.type === 'EXPENSE').forEach(m => {
          const cat = m.subCategory || 'Gastos Generales';
          expMap.set(cat, (expMap.get(cat) || 0) + m.amount);
      });
      // Add payouts as a distinct slice if relevant
      const payouts = validMovs.filter(m => m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY').reduce((s, m) => s + m.amount, 0);
      if (payouts > 0) expMap.set('Pagos a Terceros', payouts);

      const expenseCategoryArray = Array.from(expMap.entries()).map(([name, value]) => ({ name, value }));

      return {
          filteredTransactions: validTx,
          filteredMovements: validMovs,
          chartData: chartDataArray,
          summaryMetrics: { totalSales, totalMoneyOut, avgTicket, transactionCount, netEstimate },
          thirdPartyMetrics: { total: thirdPartySales, own: ownSales },
          topProducts: topProductsArray,
          categoryData: categoryArray,
          expenseCategoryData: expenseCategoryArray,
          zReportHistory: zHistory
      };

  }, [transactions, cashMovements, dateRange, customStart, customEnd, paymentMethodFilter]);

  // --- DISTRIBUTION METRICS MEMO ---
  // Calculates data specifically for the "Budget & Distribution" tab
  const distMetrics = useMemo(() => {
      const now = new Date();
      const start = new Date();
      if (distPeriod === 'WEEK') start.setDate(now.getDate() - 7);
      else start.setDate(now.getDate() - 30);
      
      // Filter relevant data for this period
      const relevantTx = transactions.filter(t => t.status !== 'cancelled' && new Date(t.date) >= start);
      const relevantMovs = cashMovements.filter(m => new Date(m.date) >= start);

      // 1. Total Income (Own Sales)
      let income = 0;
      relevantTx.forEach(t => {
          t.items.forEach(i => {
              if (!i.isConsignment) income += (i.price * i.quantity);
          });
      });
      
      // 2. Actual Expenses
      const actualOpEx = relevantMovs.filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0);
      const actualProfitTaken = relevantMovs.filter(m => m.type === 'WITHDRAWAL' && m.category === 'PROFIT').reduce((s, m) => s + m.amount, 0);
      
      // 3. Derived Investment (Retained Earnings)
      // Math: Income - (OpEx + ProfitTaken). This is what's left in the business to grow.
      const actualInvestment = Math.max(0, income - (actualOpEx + actualProfitTaken));

      // 4. Targets based on Settings
      const config = settings.budgetConfig;
      const targetOpEx = income * (config.expensesPercentage / 100);
      const targetProfit = income * (config.profitPercentage / 100);
      const targetInvestment = income * (config.investmentPercentage / 100);

      return {
          income,
          actual: { opEx: actualOpEx, profit: actualProfitTaken, investment: actualInvestment },
          target: { opEx: targetOpEx, profit: targetProfit, investment: targetInvestment },
          config // % values
      };
  }, [distPeriod, transactions, cashMovements, settings.budgetConfig]);

  // --- AI HANDLER ---
  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    const result = await generateBusinessInsight(products, filteredTransactions, filteredMovements);
    setInsight(result.text);
    setLoadingAi(false);
  };

  // --- ALGORITHMIC ANALYSIS HANDLER (NON-AI) ---
  const handleSmartAnalysis = () => {
      const { income, actual, target, config } = distMetrics;
      const msgs: {title: string, desc: string, type: 'good'|'bad'|'info'}[] = [];
      let status: 'ok' | 'warning' | 'critical' = 'ok';

      if (income === 0) {
          setAnalysisResult({
              status: 'warning',
              messages: [{ title: 'Sin Datos Suficientes', desc: 'No hay ventas registradas en este periodo para analizar.', type: 'info' }]
          });
          return;
      }

      // 1. Analyze OpEx
      const opExRatio = (actual.opEx / income) * 100;
      const opExDiff = opExRatio - config.expensesPercentage;

      if (opExDiff > 10) {
          status = 'critical';
          msgs.push({
              title: 'Gastos Críticos',
              desc: `Tus gastos operativos (${opExRatio.toFixed(1)}%) superan por mucho el objetivo (${config.expensesPercentage}%). Revisa fugas o renegocia con proveedores.`,
              type: 'bad'
          });
      } else if (opExDiff > 0) {
          status = status === 'ok' ? 'warning' : status;
          msgs.push({
              title: 'Gastos Elevados',
              desc: `Estás gastando un ${opExDiff.toFixed(1)}% más de lo planeado. Intenta optimizar consumo de insumos.`,
              type: 'bad'
          });
      } else if (opExDiff < -15) {
          msgs.push({
              title: 'Alta Eficiencia Operativa',
              desc: `Tus gastos son muy bajos. Considera aumentar el % de Inversión en la configuración para crecer más rápido.`,
              type: 'good'
          });
      }

      // 2. Analyze Profit Withdrawals
      const profitRatio = (actual.profit / income) * 100;
      if (profitRatio > config.profitPercentage) {
          status = status === 'ok' ? 'warning' : status;
          msgs.push({
              title: 'Exceso de Retiros',
              desc: `Has retirado más ganancias (${profitRatio.toFixed(1)}%) de las estipuladas. Esto puede descapitalizar el negocio.`,
              type: 'bad'
          });
      } else {
          msgs.push({
              title: 'Retiros Saludables',
              desc: 'Tus retiros personales están dentro del presupuesto. ¡Excelente disciplina!',
              type: 'good'
          });
      }

      // 3. Analyze Investment (Retained)
      const investRatio = (actual.investment / income) * 100;
      if (investRatio < 5 && config.investmentPercentage > 10) {
          msgs.push({
              title: 'Poca Reinversión',
              desc: 'Casi no está quedando dinero para invertir. Revisa si los gastos o retiros están consumiendo el flujo.',
              type: 'info'
          });
      } else if (investRatio > config.investmentPercentage + 5) {
          msgs.push({
              title: 'Excedente de Flujo',
              desc: 'Tienes más dinero disponible para invertir del planeado. Considera comprar nuevo inventario o mejorar el local.',
              type: 'good'
          });
      }

      setAnalysisResult({ status, messages: msgs });
  };

  // --- PRINT HANDLER ---
  const handlePrintFinancialReport = () => {
      // Prepare data for printing
      const financialCategories = [
          { name: 'Ventas', value: summaryMetrics.totalSales },
          ...expenseCategoryData // Includes Expenses and Third Party Payouts
      ];
      
      // Calculate true operational expenses for the report summary
      const opExp = filteredMovements.filter(m => m.type === 'EXPENSE').reduce((s,m) => s + m.amount, 0);
      const tpPayouts = filteredMovements.filter(m => m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY').reduce((s,m) => s + m.amount, 0);

      const startDateObj = dateRange === 'CUSTOM' && customStart ? new Date(customStart) : new Date();
      if(dateRange !== 'CUSTOM') startDateObj.setDate(startDateObj.getDate() - (dateRange === 'WEEK' ? 7 : dateRange === 'MONTH' ? 30 : 0));

      printFinancialReport(
          startDateObj,
          new Date(),
          financialCategories,
          {
              totalSales: summaryMetrics.totalSales,
              totalExpenses: opExp + tpPayouts,
              netProfit: summaryMetrics.netEstimate,
              thirdParty: thirdPartyMetrics.total
          },
          settings
      );
  };

  const isDark = settings.theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER & NAVIGATION */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Activity className="w-8 h-8 text-indigo-500" /> Reportes
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Análisis detallado y registros financieros.
                </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                {/* Print Report Button */}
                {activeTab === 'GENERAL' && (
                    <button 
                        onClick={handlePrintFinancialReport}
                        className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all mr-2"
                        title="Imprimir Estado Financiero del periodo actual"
                    >
                        <FileText className="w-4 h-4" /> Estado Financiero
                    </button>
                )}

                <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                    <button 
                        onClick={() => setActiveTab('GENERAL')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'GENERAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        General
                    </button>
                    <button 
                        onClick={() => setActiveTab('DISTRIBUTION')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'DISTRIBUTION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        Distribución y Presupuesto
                    </button>
                    <button 
                        onClick={() => setActiveTab('Z_HISTORY')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'Z_HISTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        Historial de Cortes
                    </button>
                </div>
            </div>
          </div>

          {/* FILTERS (Only for General Tab) */}
          {activeTab === 'GENERAL' && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => { setDateRange('TODAY'); setShowFilters(false); }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'TODAY' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        Hoy
                    </button>
                    <button 
                        onClick={() => { setDateRange('WEEK'); setShowFilters(false); }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'WEEK' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        7 Días
                    </button>
                    <button 
                        onClick={() => { setDateRange('MONTH'); setShowFilters(false); }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'MONTH' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                    >
                        Mes
                    </button>
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-full transition-all border ${showFilters || dateRange === 'CUSTOM' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                </div>

                {/* ADVANCED FILTERS DRAWER */}
                {(showFilters || dateRange === 'CUSTOM') && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-[slideUp_0.2s_ease-out]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filtros Avanzados
                            </h3>
                            {dateRange === 'CUSTOM' && (
                                <button onClick={() => { setDateRange('WEEK'); setShowFilters(false); setPaymentMethodFilter('ALL'); }} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                                    <X className="w-3 h-3" /> Limpiar Filtros
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Date Inputs */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label>
                                <input 
                                    type="date" 
                                    value={customStart} 
                                    onChange={(e) => { setCustomStart(e.target.value); setDateRange('CUSTOM'); }}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label>
                                <input 
                                    type="date" 
                                    value={customEnd} 
                                    onChange={(e) => { setCustomEnd(e.target.value); setDateRange('CUSTOM'); }}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de Pago</label>
                                <select 
                                    value={paymentMethodFilter}
                                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"
                                >
                                    <option value="ALL">Todos</option>
                                    <option value="cash">Efectivo</option>
                                    <option value="card">Tarjeta</option>
                                    <option value="transfer">Transferencia</option>
                                    <option value="credit">Crédito</option>
                                    <option value="split">Pago Dividido</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
              </>
          )}
        </div>

        {/* --- MAIN CONTENT SWITCH --- */}
        {activeTab === 'GENERAL' ? (
            <>
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
                            <div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Ventas Totales</p>
                                <p className="text-[10px] text-slate-400">Propias + Terceros</p>
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                            ${summaryMetrics.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </h3>
                        <p className="text-xs text-slate-400">{summaryMetrics.transactionCount} transacciones</p>
                    </div>

                    {/* Expenses (Including Third Party Payouts) */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                                <ArrowDownRight className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Salidas Totales</p>
                                <p className="text-[10px] text-slate-400">Gastos + Liq. Terceros</p>
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                            ${summaryMetrics.totalMoneyOut.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </h3>
                        <p className="text-xs text-slate-400">Flujo Saliente</p>
                    </div>

                    {/* Net Estimate */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                <ArrowUpRight className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Utilidad Real</p>
                                <p className="text-[10px] text-slate-400">Ventas Propias - Gastos Op.</p>
                            </div>
                        </div>
                        <h3 className={`text-3xl font-black mb-1 ${summaryMetrics.netEstimate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            ${summaryMetrics.netEstimate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </h3>
                        <p className="text-xs text-slate-400">Estimado contable</p>
                    </div>

                    {/* Third Party Metrics */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                                <Handshake className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Venta Terceros</p>
                                <p className="text-[10px] text-slate-400">Dinero por Consignación</p>
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">
                            ${thirdPartyMetrics.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </h3>
                        <p className="text-xs text-orange-500 font-medium">No es ganancia propia</p>
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
                    {/* Cash Flow Comparison (Sales vs Money Out) */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5 text-indigo-500" /> Flujo de Caja (Ventas vs Salidas)
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
                                    <Bar name="Salidas" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Expense Categories */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <Tag className="w-5 h-5 text-red-500" /> Desglose de Salidas
                        </h3>
                        <div className="h-64 w-full flex items-center justify-center">
                            {expenseCategoryData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={expenseCategoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {expenseCategoryData.map((entry, index) => (
                                                <Cell key={`cell-exp-${index}`} fill={COLORS[(index + 3) % COLORS.length]} stroke={isDark ? '#0f172a' : '#fff'} strokeWidth={2} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} contentStyle={{borderRadius: '8px', border:'none'}} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', color: textColor}} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <ArrowDownRight className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Sin egresos registrados</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        ) : activeTab === 'DISTRIBUTION' ? (
            // --- BUDGET & DISTRIBUTION TAB ---
            <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Target className="w-6 h-6 text-indigo-500" /> Control de Presupuesto
                        </h3>
                        <p className="text-sm text-slate-500">Compara tus ingresos reales vs tu plan financiero.</p>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setDistPeriod('WEEK')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${distPeriod === 'WEEK' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Semana</button>
                        <button onClick={() => setDistPeriod('MONTH')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${distPeriod === 'MONTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Mes</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Visual Comparison Cards */}
                    <div className="space-y-6">
                        {/* OpEx Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Gastos Operativos</h4>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">{distMetrics.config.expensesPercentage}% Objetivo</span>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-2xl font-black ${distMetrics.actual.opEx > distMetrics.target.opEx ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>${distMetrics.actual.opEx.toFixed(0)}</span>
                                <span className="text-sm text-slate-400 mb-1">/ ${distMetrics.target.opEx.toFixed(0)} permitidos</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${distMetrics.actual.opEx > distMetrics.target.opEx ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (distMetrics.actual.opEx / (distMetrics.income || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            {distMetrics.actual.opEx > distMetrics.target.opEx && (
                                <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Excedido por ${(distMetrics.actual.opEx - distMetrics.target.opEx).toFixed(0)}</p>
                            )}
                        </div>

                        {/* Profit Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Retiro de Ganancias</h4>
                                <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded font-bold">{distMetrics.config.profitPercentage}% Objetivo</span>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-2xl font-black ${distMetrics.actual.profit > distMetrics.target.profit ? 'text-orange-500' : 'text-slate-800 dark:text-white'}`}>${distMetrics.actual.profit.toFixed(0)}</span>
                                <span className="text-sm text-slate-400 mb-1">/ ${distMetrics.target.profit.toFixed(0)} disponibles</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${distMetrics.actual.profit > distMetrics.target.profit ? 'bg-orange-500' : 'bg-pink-500'}`}
                                    style={{ width: `${Math.min(100, (distMetrics.actual.profit / (distMetrics.income || 1)) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Investment/Retained Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Inversión / Ahorro (Remanente)</h4>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">{distMetrics.config.investmentPercentage}% Objetivo</span>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">${distMetrics.actual.investment.toFixed(0)}</span>
                                <span className="text-sm text-slate-400 mb-1">/ ${distMetrics.target.investment.toFixed(0)} ideal</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-500 bg-blue-500"
                                    style={{ width: `${Math.min(100, (distMetrics.actual.investment / (distMetrics.income || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Calculado como: Ingresos - (Gastos + Retiros). Es el dinero que queda para crecer.</p>
                        </div>
                    </div>

                    {/* Analysis Section */}
                    <div className="flex flex-col h-full">
                        <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden flex-1">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <Target className="w-32 h-32" />
                            </div>
                            <h3 className="text-xl font-bold mb-4 relative z-10">Analista Financiero</h3>
                            <p className="text-indigo-200 text-sm mb-6 relative z-10">
                                Genera un diagnóstico lógico basado en tus porcentajes configurados y la realidad operativa de este periodo.
                            </p>
                            
                            {!analysisResult ? (
                                <button 
                                    onClick={handleSmartAnalysis}
                                    className="w-full py-4 bg-white text-indigo-900 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-colors relative z-10 flex items-center justify-center gap-2"
                                >
                                    <Lightbulb className="w-5 h-5" /> Analizar Distribución
                                </button>
                            ) : (
                                <div className="space-y-4 relative z-10 animate-[fadeIn_0.3s]">
                                    <div className={`p-3 rounded-lg border flex items-center gap-3 ${analysisResult.status === 'critical' ? 'bg-red-500/20 border-red-500/50' : analysisResult.status === 'warning' ? 'bg-orange-500/20 border-orange-500/50' : 'bg-emerald-500/20 border-emerald-500/50'}`}>
                                        {analysisResult.status === 'critical' ? <AlertTriangle className="w-6 h-6 text-red-300"/> : analysisResult.status === 'warning' ? <AlertCircle className="w-6 h-6 text-orange-300"/> : <CheckCircle2 className="w-6 h-6 text-emerald-300"/>}
                                        <div>
                                            <p className="font-bold text-sm uppercase">{analysisResult.status === 'critical' ? 'Atención Crítica' : analysisResult.status === 'warning' ? 'Precaución' : 'Todo en Orden'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {analysisResult.messages.map((msg, i) => (
                                            <div key={i} className="bg-white/10 p-3 rounded-lg border border-white/10">
                                                <p className={`text-xs font-bold mb-1 ${msg.type === 'bad' ? 'text-red-300' : msg.type === 'good' ? 'text-emerald-300' : 'text-blue-300'}`}>{msg.title}</p>
                                                <p className="text-xs text-indigo-100 leading-relaxed">{msg.desc}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={() => setAnalysisResult(null)} className="text-xs text-indigo-300 hover:text-white underline mt-2">Re-analizar</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            // --- Z HISTORY TAB ---
            <div className="animate-[fadeIn_0.3s_ease-out]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Lock className="w-6 h-6 text-indigo-500" /> Historial de Cierres de Caja
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {zReportHistory.length > 0 ? zReportHistory.map((report) => (
                        <div key={report.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col group hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Fecha de Corte</p>
                                    <p className="font-bold text-slate-800 dark:text-white text-lg">{new Date(report.date).toLocaleDateString()}</p>
                                    <p className="text-xs text-slate-500">{new Date(report.date).toLocaleTimeString()}</p>
                                </div>
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                    <Lock className="w-5 h-5" />
                                </div>
                            </div>
                            
                            <div className="space-y-2 mb-6 border-t border-b border-slate-100 dark:border-slate-800 py-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Declarado en Caja:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">${report.zReportData?.declaredCash.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Ventas Totales:</span>
                                    <span className="font-bold text-slate-800 dark:text-white">${report.zReportData?.grossSales.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Diferencia:</span>
                                    <span className={`font-bold ${(report.zReportData?.difference || 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        ${report.zReportData?.difference.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <button 
                                onClick={() => printZCutTicket(report, settings)}
                                className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                                <Printer className="w-4 h-4" /> Reimprimir Reporte
                            </button>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-16 text-slate-400">
                            <Lock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium">No hay historial de cortes.</p>
                            <p className="text-sm">Realiza un "Cierre Z" en la Caja Chica para ver registros aquí.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

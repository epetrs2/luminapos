
import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Legend
} from 'recharts';
import { 
    DollarSign, Printer, ArrowLeft, ArrowRight, BrainCircuit, Wallet
} from 'lucide-react';
import { generateBudgetAdvice } from '../services/geminiService';
import { printFinancialReport } from '../utils/printService';

export const Reports: React.FC = () => {
    const { transactions, cashMovements, settings } = useStore();
    const [selectedPeriodOffset, setSelectedPeriodOffset] = useState(0);
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [loadingAi, setLoadingAi] = useState(false);

    const getPeriodDates = (offset: number) => {
        const config = settings.budgetConfig;
        const now = new Date();
        
        // If fiscalStartDate is present, logic could be more complex, but for now defaulting to Monthly blocks
        // aligned with calendar months or fiscal start.
        const isMonthly = config.cycleType === 'MONTHLY';
        
        if (isMonthly) {
            // Logic for monthly offset
            const year = now.getFullYear();
            const month = now.getMonth() + offset;
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
            return { start, end };
        } else {
            // Default to Monthly even if cycle is different for visualization simplicity in this view
            // Could be adapted to 'FIXED_DAYS' later
            const start = new Date();
            start.setDate(1); 
            start.setMonth(start.getMonth() + offset);
            start.setHours(0,0,0,0);
            
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0); 
            end.setHours(23,59,59,999);
            
            return { start, end };
        }
    };

    const distMetrics = useMemo(() => {
      const { start, end } = getPeriodDates(selectedPeriodOffset);
      
      // Filter strictly by date range AND ONLY LIQUIDATED SALES (Fully Paid)
      const relevantTx = transactions.filter(t => {
          const d = new Date(t.date);
          return t.status !== 'cancelled' && 
                 t.paymentStatus === 'paid' && // ONLY COUNT FULLY PAID SALES
                 d >= start && d <= end;
      });
      
      const relevantMovs = cashMovements.filter(m => {
          const d = new Date(m.date);
          return d >= start && d <= end;
      });

      let income = 0;
      relevantTx.forEach(t => {
          t.items.forEach(i => {
              // Only count income from own products (exclude consignment/third-party items)
              if (i.isConsignment !== true) income += (i.price * i.quantity);
          });
      });
      
      const actualOpEx = relevantMovs.filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0);
      const actualProfitTaken = relevantMovs.filter(m => m.type === 'WITHDRAWAL' && m.category === 'PROFIT').reduce((s, m) => s + m.amount, 0);
      
      // Surplus Logic: If expenses are lower than budget, add difference to Investment (virtual)
      const config = settings.budgetConfig;
      const targetOpEx = income * (config.expensesPercentage / 100);
      
      // Actual Investment is what remains after expenses and profit taken
      // PLUS any savings from operational expenses if actual < target (automagic logic)
      let actualInvestment = Math.max(0, income - (actualOpEx + actualProfitTaken));
      
      // If actual expenses were LESS than target, we explicitly flag that surplus
      const expenseSurplus = Math.max(0, targetOpEx - actualOpEx);

      const targetProfit = income * (config.profitPercentage / 100);
      const targetInvestment = income * (config.investmentPercentage / 100);
      
      // Days remaining in period
      const now = new Date();
      const timeDiff = end.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      const isCurrentPeriod = selectedPeriodOffset === 0;

      return {
          income,
          actual: { opEx: actualOpEx, profit: actualProfitTaken, investment: actualInvestment },
          target: { opEx: targetOpEx, profit: targetProfit, investment: targetInvestment },
          expenseSurplus,
          config, 
          periodStart: start,
          periodEnd: end,
          daysRemaining: isCurrentPeriod ? daysRemaining : 0,
          isCurrentPeriod
      };
  }, [selectedPeriodOffset, transactions, cashMovements, settings.budgetConfig]);

  const handleGetAiAdvice = async () => {
      setLoadingAi(true);
      const advice = await generateBudgetAdvice(
          distMetrics.income, 
          distMetrics.actual.opEx, 
          distMetrics.actual.profit, 
          distMetrics.config
      );
      setAiAdvice(advice);
      setLoadingAi(false);
  };

  const handlePrintReport = () => {
      const { periodStart, periodEnd, actual, income } = distMetrics;
      const categories = [
          { name: 'Gastos Operativos', value: actual.opEx },
          { name: 'Retiros Ganancia', value: actual.profit },
          { name: 'Fondo Inversión', value: actual.investment }
      ];
      const metrics = {
          totalSales: income,
          totalExpenses: actual.opEx,
          netProfit: actual.profit + actual.investment, 
          thirdParty: 0 
      };
      
      printFinancialReport(periodStart, periodEnd, categories, metrics, settings);
  };

  const barData = [
      { name: 'Gastos', Real: distMetrics.actual.opEx, Meta: distMetrics.target.opEx },
      { name: 'Retiros', Real: distMetrics.actual.profit, Meta: distMetrics.target.profit },
      { name: 'Inversión', Real: distMetrics.actual.investment, Meta: distMetrics.target.investment },
  ];

  return (
      <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
          <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                      <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Reporte Financiero</h2>
                      <p className="text-slate-500 dark:text-slate-400 mt-1">Análisis de presupuesto y distribución.</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handlePrintReport} className="bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg hover:bg-slate-700 transition-all">
                          <Printer className="w-4 h-4" /> Imprimir
                      </button>
                      <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                          <button onClick={() => setSelectedPeriodOffset(p => p - 1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                          <span className="px-4 text-sm font-bold text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
                              {distMetrics.periodStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                          </span>
                          <button onClick={() => setSelectedPeriodOffset(p => p + 1)} disabled={selectedPeriodOffset >= 0} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 disabled:opacity-30"><ArrowRight className="w-5 h-5" /></button>
                      </div>
                  </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                      <p className="text-emerald-100 font-bold mb-1 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Ingresos Propios</p>
                      <h3 className="text-3xl font-black">${distMetrics.income.toFixed(2)}</h3>
                      <p className="text-xs text-emerald-200 mt-2">Ventas liquidadas (Sin consignación)</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-slate-500 dark:text-slate-400 font-bold mb-1">Gastos Operativos</p>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">${distMetrics.actual.opEx.toFixed(2)}</h3>
                      <div className="flex justify-between items-center mt-2 text-xs">
                          <span className="text-slate-400">Meta: ${distMetrics.target.opEx.toFixed(0)}</span>
                          <span className={`${distMetrics.actual.opEx > distMetrics.target.opEx ? 'text-red-500' : 'text-emerald-500'} font-bold`}>
                              {((distMetrics.actual.opEx / (distMetrics.income || 1)) * 100).toFixed(1)}%
                          </span>
                      </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-slate-500 dark:text-slate-400 font-bold mb-1">Retiros / Sueldos</p>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white">${distMetrics.actual.profit.toFixed(2)}</h3>
                      <div className="flex justify-between items-center mt-2 text-xs">
                          <span className="text-slate-400">Meta: ${distMetrics.target.profit.toFixed(0)}</span>
                          <span className="text-pink-500 font-bold">
                              {((distMetrics.actual.profit / (distMetrics.income || 1)) * 100).toFixed(1)}%
                          </span>
                      </div>
                  </div>
                  <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 dark:shadow-none">
                      <p className="text-blue-100 font-bold mb-1 flex items-center gap-2"><Wallet className="w-4 h-4"/> Fondo Inversión</p>
                      <h3 className="text-3xl font-black">${distMetrics.actual.investment.toFixed(2)}</h3>
                      <p className="text-xs text-blue-200 mt-2">Disponible para reinvertir</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Chart Section */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Comparativa Presupuesto</h3>
                      <div className="h-80 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={barData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                  <Legend />
                                  <Bar dataKey="Meta" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="Real" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* AI Advice Section */}
                  <div className="bg-indigo-50 dark:bg-slate-800 p-6 rounded-3xl border border-indigo-100 dark:border-slate-700 flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-indigo-600 dark:text-indigo-400"><BrainCircuit className="w-6 h-6" /></div>
                          <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Asistente Financiero</h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
                          {aiAdvice ? (
                              <div className="prose prose-sm prose-indigo dark:prose-invert">
                                  <p className="whitespace-pre-line text-slate-600 dark:text-slate-300 text-sm">{aiAdvice}</p>
                              </div>
                          ) : (
                              <div className="text-center py-10 text-indigo-400 dark:text-slate-500">
                                  <p className="text-sm">Solicita un análisis de tu desempeño financiero basado en tus metas.</p>
                              </div>
                          )}
                      </div>

                      <button 
                          onClick={handleGetAiAdvice} 
                          disabled={loadingAi}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                          {loadingAi ? <span className="animate-spin">Wait...</span> : <><BrainCircuit className="w-4 h-4" /> Analizar con IA</>}
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { generateBusinessInsight } from '../services/geminiService';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, ReferenceLine, ComposedChart, Line } from 'recharts';
import { Sparkles, TrendingUp, DollarSign, Activity, Calendar, ArrowUpRight, ArrowDownRight, Package, PieChart as PieIcon, AlertCircle, Filter, X, Handshake, Tag, PieChart as SplitIcon, RefreshCw, Printer, FileText, Lock, Target, AlertTriangle, CheckCircle2, Lightbulb, Box, Layers, TrendingDown, ClipboardList, Factory, ArrowLeft, ArrowRight, Wallet, Clock, Archive, Check, CreditCard, Banknote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { printFinancialReport, printZCutTicket, printMonthEndTicket, printMonthEndReportPDF } from '../utils/printService';
import { Transaction, CashMovement, PeriodClosure } from '../types';

// --- COLORS FOR CHARTS ---
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316'];
const PAY_COLORS = { cash: '#10b981', card: '#3b82f6', transfer: '#8b5cf6', credit: '#f43f5e', split: '#f59e0b' };

type DateRangeOption = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type ReportTab = 'GENERAL' | 'Z_HISTORY' | 'DISTRIBUTION' | 'INVENTORY';

export const Reports: React.FC = () => {
  const { transactions, products, cashMovements, settings, btDevice, sendBtData, customers, periodClosures, addPeriodClosure, currentUser } = useStore();
  
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<ReportTab>('GENERAL');

  // --- FILTER STATE ---
  const [dateRange, setDateRange] = useState<DateRangeOption>('TODAY');
  const [showFilters, setShowFilters] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');

  // --- DISTRIBUTION ANALYSIS STATE (PERIODS) ---
  const [selectedPeriodOffset, setSelectedPeriodOffset] = useState(0); 
  const [analysisResult, setAnalysisResult] = useState<{status: 'ok'|'warning'|'critical', messages: {title: string, desc: string, type: 'good'|'bad'|'info'}[]} | null>(null);

  // --- MONTH END MODAL STATE ---
  const [isMonthEndModalOpen, setIsMonthEndModalOpen] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false); // New: View historical report
  const [monthEndChecks, setMonthEndChecks] = useState({
      profitDistributed: false,
      savingsSetAside: false
  });
  const [generatingReport, setGeneratingReport] = useState(false);

  // --- AI STATE ---
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // --- INVENTORY ANALYSIS STATE ---
  const [invSort, setInvSort] = useState<'URGENT' | 'VALUE' | 'SLOW'>('URGENT');

  // ... (DATA PREPARATION & FILTERING MEMO - Identical to before) ...
  const { 
      filteredTransactions, 
      filteredMovements, 
      chartData,
      summaryMetrics,
      topProducts,
      categoryData,
      expenseCategoryData,
      thirdPartyMetrics,
      zReportHistory,
      paymentChartData
  } = useMemo(() => {
      // ... (Same logic as existing code)
      const now = new Date();
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0); 
      let endDate = endOfToday;

      if (dateRange === 'WEEK') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === 'MONTH') {
          startDate = new Date();
          startDate.setDate(now.getDate() - 29);
          startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === 'CUSTOM') {
          if (customStart) {
              const [y, m, d] = customStart.split('-').map(Number);
              startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
          } else { startDate = new Date(0); }
          if (customEnd) {
              const [y, m, d] = customEnd.split('-').map(Number);
              endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
          }
      }

      const isInRange = (dateStr: string) => {
          const d = new Date(dateStr);
          return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
      };

      const validTx = transactions.filter((t: Transaction) => {
          const isDateInRange = isInRange(t.date);
          const isNotCancelled = t.status !== 'cancelled';
          const matchesPayment = paymentMethodFilter === 'ALL' || t.paymentMethod === paymentMethodFilter;
          return isDateInRange && isNotCancelled && matchesPayment;
      });

      const validMovs = cashMovements.filter((m: CashMovement) => isInRange(m.date));
      const zHistory = cashMovements.filter((m: CashMovement) => m.isZCut).sort((a: CashMovement, b: CashMovement) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const daysMap = new Map<string, { date: string, rawDate: number, sales: number, expenses: number, profit: number }>();
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 60) {
          const iterDate = new Date(startDate);
          while (iterDate <= endDate) {
              const label = iterDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
              const key = `${iterDate.getFullYear()}-${iterDate.getMonth()}-${iterDate.getDate()}`; 
              daysMap.set(key, { date: label, rawDate: iterDate.getTime(), sales: 0, expenses: 0, profit: 0 });
              iterDate.setDate(iterDate.getDate() + 1);
          }
      }

      validTx.forEach((t: Transaction) => {
          const d = new Date(t.date);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          if (daysMap.has(key)) {
              const entry = daysMap.get(key)!;
              entry.sales += t.total;
              entry.profit += t.total; // Start with sales
          }
      });

      validMovs.forEach((m: CashMovement) => {
          if (m.type === 'EXPENSE' || (m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY')) {
              const d = new Date(m.date);
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              if (daysMap.has(key)) {
                  const entry = daysMap.get(key)!;
                  entry.expenses += m.amount;
                  entry.profit -= m.amount; // Subtract expenses
              }
          }
      });

      const chartDataArray = Array.from(daysMap.values()).sort((a, b) => a.rawDate - b.rawDate);
      
      let thirdPartySales = 0;
      let ownSales = 0;
      validTx.forEach((t: Transaction) => {
          t.items.forEach((item: any) => {
              if (item.isConsignment === true) thirdPartySales += (item.price * item.quantity);
              else ownSales += (item.price * item.quantity);
          });
      });

      const totalSales = validTx.reduce((sum: number, t: Transaction) => sum + t.total, 0);
      const totalMoneyOut = validMovs.filter((m: CashMovement) => m.type === 'EXPENSE' || (m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY')).reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
      const transactionCount = validTx.length;
      const avgTicket = transactionCount > 0 ? totalSales / transactionCount : 0;
      const operationalExpenses = validMovs.filter((m: CashMovement) => m.type === 'EXPENSE').reduce((sum: number, m: CashMovement) => sum + m.amount, 0);
      const netEstimate = ownSales - operationalExpenses; 

      const productMap = new Map<string, { name: string, qty: number, total: number }>();
      validTx.forEach((t: Transaction) => {
          t.items.forEach((item: any) => {
              const key = item.id;
              const current = productMap.get(key) || { name: item.name, qty: 0, total: 0 };
              current.qty += item.quantity;
              current.total += (item.price * item.quantity);
              productMap.set(key, current);
          });
      });
      const topProductsArray = Array.from(productMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

      const catMap = new Map<string, number>();
      validTx.forEach((t: Transaction) => {
          t.items.forEach((item: any) => {
              const cat = item.category || 'General';
              catMap.set(cat, (catMap.get(cat) || 0) + (item.price * item.quantity));
          });
      });
      const categoryArray = Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 7);

      const expMap = new Map<string, number>();
      validMovs.filter((m: CashMovement) => m.type === 'EXPENSE').forEach((m: CashMovement) => {
          const cat = m.subCategory || 'Gastos Generales';
          expMap.set(cat, (expMap.get(cat) || 0) + m.amount);
      });
      const payouts = validMovs.filter((m: CashMovement) => m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY').reduce((s: number, m: CashMovement) => s + m.amount, 0);
      if (payouts > 0) expMap.set('Pagos a Terceros', payouts);
      const expenseCategoryArray = Array.from(expMap.entries()).map(([name, value]) => ({ name, value }));

      // --- Payment Methods Data ---
      const payMap = new Map<string, number>();
      validTx.forEach(t => {
          let label = 'Otros';
          if (t.paymentMethod === 'cash') label = 'Efectivo';
          else if (t.paymentMethod === 'card') label = 'Tarjeta';
          else if (t.paymentMethod === 'transfer') label = 'Transferencia';
          else if (t.paymentMethod === 'credit') label = 'Crédito';
          else if (t.paymentMethod === 'split') label = 'Dividido';
          
          payMap.set(label, (payMap.get(label) || 0) + t.total);
      });
      const paymentChartData = Array.from(payMap.entries()).map(([name, value]) => ({ name, value }));

      return { filteredTransactions: validTx, filteredMovements: validMovs, chartData: chartDataArray, summaryMetrics: { totalSales, totalMoneyOut, avgTicket, transactionCount, netEstimate }, thirdPartyMetrics: { total: thirdPartySales, own: ownSales }, topProducts: topProductsArray, categoryData: categoryArray, expenseCategoryData: expenseCategoryArray, zReportHistory: zHistory, paymentChartData };
  }, [transactions, cashMovements, dateRange, customStart, customEnd, paymentMethodFilter]);

  // 1. DETERMINE DATE RANGE
  const periodDates = useMemo(() => {
      const config = settings.budgetConfig;
      const startDateStr = config.fiscalStartDate || new Date().toISOString().split('T')[0];
      const cycleType = config.cycleType || 'MONTHLY';
      const fiscalStart = new Date(startDateStr);
      fiscalStart.setHours(0,0,0,0);
      const now = new Date();
      now.setHours(0,0,0,0);

      let start: Date;
      let end: Date;

      if (cycleType === 'FIXED_DAYS') {
          const daysPerCycle = config.cycleLength || 30;
          const msPerDay = 1000 * 60 * 60 * 24;
          const cycleDurationMs = daysPerCycle * msPerDay;
          const timeSinceStart = now.getTime() - fiscalStart.getTime();
          let currentCycleIndex = Math.floor(timeSinceStart / cycleDurationMs);
          if (timeSinceStart < 0) currentCycleIndex = Math.floor(timeSinceStart / cycleDurationMs);
          const targetIndex = currentCycleIndex - selectedPeriodOffset;
          start = new Date(fiscalStart.getTime() + (targetIndex * cycleDurationMs));
          end = new Date(start.getTime() + cycleDurationMs - 1); 
      } else {
          const startDay = fiscalStart.getDate(); 
          let anchorMonth = new Date(now.getFullYear(), now.getMonth(), startDay);
          if (now.getDate() < startDay) {
              anchorMonth.setMonth(anchorMonth.getMonth() - 1);
          }
          anchorMonth.setMonth(anchorMonth.getMonth() - selectedPeriodOffset);
          start = new Date(anchorMonth);
          start.setHours(0,0,0,0);
          end = new Date(start);
          end.setMonth(end.getMonth() + 1);
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
      }
      return { start, end };
  }, [selectedPeriodOffset, settings.budgetConfig]);

  // 2. CHECK IF CLOSED (SNAPSHOT EXISTS)
  const currentPeriodClosure = useMemo(() => {
      const pStart = periodDates.start.toISOString().split('T')[0];
      const pEnd = periodDates.end.toISOString().split('T')[0];
      return periodClosures.find(c => {
          const cStart = new Date(c.periodStart).toISOString().split('T')[0];
          const cEnd = new Date(c.periodEnd).toISOString().split('T')[0];
          return cStart === pStart && cEnd === pEnd;
      });
  }, [periodClosures, periodDates]);

  // 3. CALCULATE OR RETRIEVE METRICS
  const distMetrics = useMemo(() => {
      // SCENARIO A: PERIOD IS CLOSED (USE SNAPSHOT DATA ONLY)
      if (currentPeriodClosure) {
          const savedData = currentPeriodClosure.reportData;
          const savedConfig = savedData.config || settings.budgetConfig;
          
          // Reconstruct calculations from saved totals to ensure UI consistency
          // (Even if we saved raw numbers, we recalculate derived percentages to match the UI bars)
          const income = savedData.income;
          const targetOpEx = income * (savedConfig.expensesPercentage / 100);
          const targetProfit = income * (savedConfig.profitPercentage / 100);
          const targetInvestment = income * (savedConfig.investmentPercentage / 100);
          const expenseSurplus = Math.max(0, targetOpEx - savedData.actualOpEx);

          return {
              income: income,
              actual: { 
                  opEx: savedData.actualOpEx, 
                  profit: savedData.actualProfit, 
                  investment: savedData.actualInvestment 
              },
              target: { 
                  opEx: targetOpEx, 
                  profit: targetProfit, 
                  investment: targetInvestment 
              },
              expenseSurplus: expenseSurplus,
              config: savedConfig, 
              periodStart: periodDates.start,
              periodEnd: periodDates.end,
              daysRemaining: 0,
              isCurrentPeriod: false,
              topPeriodProducts: savedData.topPeriodProducts || [], // Fallback if missing in old snapshots
              topPeriodCustomers: savedData.topPeriodCustomers || [] // Fallback if missing
          };
      }

      // SCENARIO B: PERIOD IS OPEN (CALCULATE LIVE)
      const { start, end } = periodDates;
      
      const relevantIncomeMovs = cashMovements.filter((m: CashMovement) => {
          const d = new Date(m.date);
          return m.type === 'DEPOSIT' && m.category === 'SALES' && d >= start && d <= end;
      });

      const income = relevantIncomeMovs.reduce((sum, m) => sum + m.amount, 0);

      const relevantMovs = cashMovements.filter((m: CashMovement) => {
          const d = new Date(m.date);
          return d >= start && d <= end;
      });

      const actualOpEx = relevantMovs.filter((m: CashMovement) => m.type === 'EXPENSE').reduce((s: number, m: CashMovement) => s + m.amount, 0);
      const actualProfitTaken = relevantMovs.filter((m: CashMovement) => m.type === 'WITHDRAWAL' && m.category === 'PROFIT').reduce((s: number, m: CashMovement) => s + m.amount, 0);
      
      const config = settings.budgetConfig;
      const targetOpEx = income * (config.expensesPercentage / 100);
      let actualInvestment = Math.max(0, income - (actualOpEx + actualProfitTaken));
      const expenseSurplus = Math.max(0, targetOpEx - actualOpEx);
      const targetProfit = income * (config.profitPercentage / 100);
      const targetInvestment = income * (config.investmentPercentage / 100);
      
      const now = new Date();
      const timeDiff = end.getTime() - now.getTime();
      const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
      const isCurrentPeriod = selectedPeriodOffset === 0;

      const relevantTx = transactions.filter((t: Transaction) => {
          const d = new Date(t.date);
          return t.status !== 'cancelled' && d >= start && d <= end;
      });

      const periodProducts = new Map<string, {name:string, qty:number, total:number}>();
      relevantTx.forEach((t: Transaction) => t.items.forEach((i: any) => {
          const curr = periodProducts.get(i.id) || {name:i.name, qty:0, total:0};
          curr.qty += i.quantity; curr.total += i.price * i.quantity;
          periodProducts.set(i.id, curr);
      }));
      const topPeriodProducts = Array.from(periodProducts.values()).sort((a,b) => b.total - a.total).slice(0, 10);

      const periodCustomers = new Map<string, {name:string, total:number}>();
      relevantTx.forEach((t: Transaction) => {
          if(!t.customerId) return;
          const curr = periodCustomers.get(t.customerId) || {name: customers.find(c=>c.id===t.customerId)?.name || 'Desc.', total:0};
          curr.total += t.total;
          periodCustomers.set(t.customerId, curr);
      });
      const topPeriodCustomers = Array.from(periodCustomers.values()).sort((a,b) => b.total - a.total).slice(0, 5);

      return {
          income,
          actual: { opEx: actualOpEx, profit: actualProfitTaken, investment: actualInvestment },
          target: { opEx: targetOpEx, profit: targetProfit, investment: targetInvestment },
          expenseSurplus,
          config, 
          periodStart: start,
          periodEnd: end,
          daysRemaining: isCurrentPeriod ? daysRemaining : 0,
          isCurrentPeriod,
          topPeriodProducts,
          topPeriodCustomers
      };
  }, [currentPeriodClosure, periodDates, transactions, cashMovements, settings.budgetConfig, customers, selectedPeriodOffset]);

  // ... (REST OF THE COMPONENT REMAINS EXACTLY THE SAME) ...
  const inventoryMetrics = useMemo(() => {
    let totalStockValue = 0;
    let totalPotentialRevenue = 0;
    let criticalCount = 0;
    let deadStockCount = 0;
    const sortedItems: any[] = [];
    const messages: {title: string, desc: string, type: 'good'|'bad'|'info'}[] = [];

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    products.forEach((p: any) => {
        if (!p.isActive) return;

        let stock = p.stock;
        let value = p.cost ? p.cost * stock : 0;
        let revenue = p.price * stock;

        if (p.hasVariants && p.variants) {
            stock = p.variants.reduce((acc: number, v: any) => acc + v.stock, 0);
            value = (p.cost || 0) * stock;
            revenue = 0;
            p.variants.forEach((v: any) => {
                revenue += v.price * v.stock;
            });
        }

        totalStockValue += value;
        totalPotentialRevenue += revenue;

        let sold30Days = 0;
        transactions.forEach((t: Transaction) => {
            if (t.status === 'cancelled') return;
            const txDate = new Date(t.date);
            if (txDate >= thirtyDaysAgo) {
                t.items.forEach((i: any) => {
                    if (i.id === p.id) sold30Days += i.quantity;
                });
            }
        });

        let daysRemaining = sold30Days > 0 ? (stock / (sold30Days / 30)) : 999;
        
        if (stock <= 0) { } else if (daysRemaining < 7) { criticalCount++; }
        if (stock > 0 && sold30Days === 0) { deadStockCount++; }

        sortedItems.push({
            id: p.id,
            name: p.name,
            category: p.category,
            stock,
            sold30Days,
            daysRemaining,
            stockPotential: revenue
        });
    });

    if (invSort === 'URGENT') { sortedItems.sort((a, b) => a.daysRemaining - b.daysRemaining); } 
    else if (invSort === 'VALUE') { sortedItems.sort((a, b) => b.stockPotential - a.stockPotential); } 
    else { sortedItems.sort((a, b) => a.sold30Days - b.sold30Days); }

    if (criticalCount > 5) messages.push({title: 'Riesgo de Abastecimiento', desc: `${criticalCount} productos están por agotarse en menos de una semana.`, type: 'bad'});
    if (deadStockCount > 10) messages.push({title: 'Capital Estancado', desc: `${deadStockCount} productos no han tenido ventas en 30 días. Considera ofertas.`, type: 'info'});
    
    return { totalStockValue, totalPotentialRevenue, criticalCount, deadStockCount, sortedItems, messages };
  }, [products, transactions, invSort]);

  const handleSmartAnalysis = () => {
      const { income, actual, config } = distMetrics;
      const msgs: {title: string, desc: string, type: 'good'|'bad'|'info'}[] = [];
      let status: 'ok' | 'warning' | 'critical' = 'ok';

      if (income === 0) {
          setAnalysisResult({ status: 'warning', messages: [{ title: 'Sin Datos Suficientes', desc: 'No hay ventas registradas en este periodo para analizar.', type: 'info' }] });
          return;
      }
      
      const opExRatio = (actual.opEx / income) * 100;
      const opExDiff = opExRatio - config.expensesPercentage;

      if (opExDiff > 10) {
          status = 'critical';
          msgs.push({title: 'Gastos Críticos', desc: `Tus gastos operativos (${opExRatio.toFixed(1)}%) superan por mucho el objetivo (${config.expensesPercentage}%). Revisa fugas o renegocia con proveedores.`, type: 'bad'});
      } else if (opExDiff > 0) {
          status = status === 'ok' ? 'warning' : status;
          msgs.push({title: 'Gastos Elevados', desc: `Estás gastando un ${opExDiff.toFixed(1)}% más de lo planeado. Intenta optimizar consumo de insumos.`, type: 'bad'});
      } else if (opExDiff < -15) {
          msgs.push({title: 'Alta Eficiencia Operativa', desc: `Tus gastos son muy bajos. Considera aumentar el % de Inversión en la configuración para crecer más rápido.`, type: 'good'});
      }

      const profitRatio = (actual.profit / income) * 100;
      if (profitRatio > config.profitPercentage) {
          status = status === 'ok' ? 'warning' : status;
          msgs.push({title: 'Exceso de Retiros', desc: `Has retirado más ganancias (${profitRatio.toFixed(1)}%) de las estipuladas. Esto puede descapitalizar el negocio.`, type: 'bad'});
      } else {
          msgs.push({title: 'Retiros Saludables', desc: 'Tus retiros personales están dentro del presupuesto. ¡Excelente disciplina!', type: 'good'});
      }

      setAnalysisResult({ status, messages: msgs });
  };

  const handlePrintFinancialReport = () => {
      const opExp = filteredMovements.filter((m: CashMovement) => m.type === 'EXPENSE').reduce((s: number, m: CashMovement) => s + m.amount, 0);
      const tpPayouts = filteredMovements.filter((m: CashMovement) => m.type === 'WITHDRAWAL' && m.category === 'THIRD_PARTY').reduce((s: number, m: CashMovement) => s + m.amount, 0);
      const startDateObj = dateRange === 'CUSTOM' && customStart ? new Date(customStart) : new Date();
      if(dateRange !== 'CUSTOM') startDateObj.setDate(startDateObj.getDate() - (dateRange === 'WEEK' ? 7 : dateRange === 'MONTH' ? 30 : 0));

      printFinancialReport(
          startDateObj,
          new Date(),
          [{ name: 'Ventas', value: summaryMetrics.totalSales }, ...expenseCategoryData],
          {
              totalSales: summaryMetrics.totalSales,
              totalExpenses: opExp + tpPayouts,
              netProfit: summaryMetrics.netEstimate,
              thirdParty: thirdPartyMetrics.total
          },
          settings
      );
  };

  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    const result = await generateBusinessInsight(products, filteredTransactions, filteredMovements);
    setInsight(result.text);
    setLoadingAi(false);
  };

  // --- NEW MONTH END LOGIC (LOCAL & FAST) ---
  const handleGenerateMonthReport = async (mode: 'THERMAL' | 'PDF') => {
      setGeneratingReport(true);
      
      const reportData = currentPeriodClosure?.reportData || {
          periodStart: distMetrics.periodStart.toLocaleDateString(),
          periodEnd: distMetrics.periodEnd.toLocaleDateString(),
          income: distMetrics.income,
          actualOpEx: distMetrics.actual.opEx,
          actualProfit: distMetrics.actual.profit,
          actualInvestment: distMetrics.actual.investment,
          config: distMetrics.config,
          checks: monthEndChecks,
          net: distMetrics.income - distMetrics.actual.opEx // Simple Net
      };

      if (mode === 'THERMAL') {
          if (!btDevice) { alert("Conecta impresora Bluetooth."); setGeneratingReport(false); return; }
          await printMonthEndTicket(reportData, settings, sendBtData);
      } else {
          // GENERATE PDF WITH LOCAL ANALYSIS (NO AI - FAST & RELIABLE)
          const income = reportData.income || 1; // Avoid div by zero
          const opExPct = (reportData.actualOpEx / income) * 100;
          const targetOpEx = reportData.config.expensesPercentage;
          
          let financialSummary = `El periodo cerró con un ingreso total de **$${reportData.income.toLocaleString()}**. `;
          if (opExPct > targetOpEx) {
              financialSummary += `Los gastos operativos (${opExPct.toFixed(1)}%) superaron el presupuesto del ${targetOpEx}%. Se recomienda revisar costos fijos y variables.`;
          } else {
              financialSummary += `Control de gastos óptimo: ${opExPct.toFixed(1)}% (Meta: ${targetOpEx}%). Esto permitió maximizar la utilidad y la inversión.`;
          }

          let salesAnalysis = "";
          const topP = distMetrics.topPeriodProducts;
          if (topP.length > 0) {
              const top = topP[0];
              const topPct = (top.total / income) * 100;
              salesAnalysis = `El producto líder en ventas fue **${top.name}**, generando $${top.total.toLocaleString()} (${topPct.toFixed(1)}% del ingreso total). `;
              if (topP.length >= 3) {
                  salesAnalysis += `Junto con ${topP[1].name} y ${topP[2].name}, forman la base principal de ingresos del negocio.`;
              }
          } else {
              salesAnalysis = "No hay datos de ventas suficientes en este periodo para determinar productos estrella.";
          }

          let recommendations = "";
          const investPct = (reportData.actualInvestment / income) * 100;
          if (investPct < reportData.config.investmentPercentage) {
              recommendations = `La inversión retenida (${investPct.toFixed(1)}%) estuvo por debajo del objetivo (${reportData.config.investmentPercentage}%). Para el próximo mes, intente reducir los retiros personales si es posible.`;
          } else {
              recommendations = `Excelente nivel de capitalización (${investPct.toFixed(1)}%). El negocio está creciendo saludablemente y cumple con sus metas de ahorro.`;
          }

          const analysisText = `# Resumen Financiero\n${financialSummary}\n\n# Ventas Destacadas\n${salesAnalysis}\n\n# Conclusión y Metas\n${recommendations}`;
          
          printMonthEndReportPDF(reportData, analysisText, distMetrics.topPeriodProducts, settings);
      }
      setGeneratingReport(false);
  };

  // --- FINAL CLOSE HANDLER ---
  const handleConfirmClose = () => {
      if (!monthEndChecks.profitDistributed || !monthEndChecks.savingsSetAside) {
          alert("Debes confirmar las casillas de verificación primero.");
          return;
      }
      
      if (confirm("¿Estás seguro de cerrar este periodo? Una vez cerrado, no se podrán realizar cambios y el reporte será definitivo.")) {
          const reportData = {
              periodStart: distMetrics.periodStart.toLocaleDateString(),
              periodEnd: distMetrics.periodEnd.toLocaleDateString(),
              income: distMetrics.income,
              actualOpEx: distMetrics.actual.opEx,
              actualProfit: distMetrics.actual.profit,
              actualInvestment: distMetrics.actual.investment,
              config: distMetrics.config,
              checks: monthEndChecks,
              net: distMetrics.income - distMetrics.actual.opEx,
              topPeriodProducts: distMetrics.topPeriodProducts, // Added to snapshot
              topPeriodCustomers: distMetrics.topPeriodCustomers // Added to snapshot
          };

          const newClosure: PeriodClosure = {
              id: crypto.randomUUID(),
              periodStart: distMetrics.periodStart.toISOString(),
              periodEnd: distMetrics.periodEnd.toISOString(),
              closedAt: new Date().toISOString(),
              reportData: reportData,
              closedBy: currentUser?.username
          };

          addPeriodClosure(newClosure);
          setIsMonthEndModalOpen(false);
      }
  };

  const isDark = settings.theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      
      {/* MONTH END MODAL (Same as existing) */}
      {isMonthEndModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className={`p-6 border-b border-slate-100 dark:border-slate-800 text-white flex justify-between items-center ${viewOnlyMode ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                      <div className="flex items-center gap-3">
                          {viewOnlyMode ? <Lock className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
                          <div>
                              <h3 className="text-xl font-bold">{viewOnlyMode ? 'Reporte Histórico' : 'Cierre de Mes'}</h3>
                              <p className="text-xs opacity-80">
                                  {distMetrics.periodStart.toLocaleDateString()} - {distMetrics.periodEnd.toLocaleDateString()}
                              </p>
                          </div>
                      </div>
                      <button onClick={() => setIsMonthEndModalOpen(false)} className="text-white/70 hover:text-white"><X className="w-6 h-6"/></button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {/* Read-Only Summary if Closed */}
                      {viewOnlyMode && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-800 dark:text-yellow-200 font-medium text-center">
                              Este periodo está cerrado. Solo lectura.
                          </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                              <p className="text-xs text-slate-500 uppercase font-bold">Utilidad Bruta</p>
                              <p className="text-xl font-black text-slate-800 dark:text-white">
                                  ${(viewOnlyMode ? currentPeriodClosure?.reportData.net : (distMetrics.income - distMetrics.actual.opEx)).toLocaleString()}
                              </p>
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center border border-blue-100 dark:border-blue-900">
                              <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold">Inversión Final</p>
                              <p className="text-xl font-black text-blue-700 dark:text-blue-300">
                                  ${(viewOnlyMode ? currentPeriodClosure?.reportData.actualInvestment : distMetrics.actual.investment).toLocaleString()}
                              </p>
                          </div>
                      </div>

                      <div className="space-y-3">
                          <div 
                            onClick={() => !viewOnlyMode && setMonthEndChecks(p => ({...p, profitDistributed: !p.profitDistributed}))} 
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${viewOnlyMode ? 'cursor-default opacity-80' : 'cursor-pointer'} ${monthEndChecks.profitDistributed || viewOnlyMode ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                          >
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${monthEndChecks.profitDistributed || viewOnlyMode ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-400'}`}>
                                  {(monthEndChecks.profitDistributed || viewOnlyMode) && <Check className="w-3.5 h-3.5"/>}
                              </div>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Confirmo que las Ganancias fueron repartidas</span>
                          </div>
                          <div 
                            onClick={() => !viewOnlyMode && setMonthEndChecks(p => ({...p, savingsSetAside: !p.savingsSetAside}))} 
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${viewOnlyMode ? 'cursor-default opacity-80' : 'cursor-pointer'} ${monthEndChecks.savingsSetAside || viewOnlyMode ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                          >
                              <div className={`w-5 h-5 rounded border flex items-center justify-center ${monthEndChecks.savingsSetAside || viewOnlyMode ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-400'}`}>
                                  {(monthEndChecks.savingsSetAside || viewOnlyMode) && <Check className="w-3.5 h-3.5"/>}
                              </div>
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Confirmo que el Ahorro/Inversión está apartado</span>
                          </div>
                      </div>

                      <div className="flex gap-3">
                          <button 
                            onClick={() => handleGenerateMonthReport('THERMAL')} 
                            disabled={generatingReport}
                            className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                              <Printer className="w-4 h-4"/> Ticket Resumen
                          </button>
                          <button 
                            onClick={() => handleGenerateMonthReport('PDF')}
                            disabled={generatingReport}
                            className="flex-[1.5] py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50"
                          >
                              {generatingReport ? <RefreshCw className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                              {generatingReport ? 'Generando...' : 'Informe PDF'}
                          </button>
                      </div>

                      {!viewOnlyMode && (
                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                              <button 
                                onClick={handleConfirmClose}
                                className="w-full py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                              >
                                  <Lock className="w-4 h-4" /> Finalizar y Bloquear Periodo
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* HEADER & NAVIGATION */}
        <div className="flex flex-col gap-6 mb-8">
          {/* ... Header and Tab Buttons ... */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Activity className="w-8 h-8 text-indigo-500" /> Reportes
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Análisis detallado y registros financieros.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {activeTab === 'GENERAL' && (
                    <button onClick={handlePrintFinancialReport} className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all mr-2">
                        <FileText className="w-4 h-4" /> Estado Financiero
                    </button>
                )}
                {activeTab === 'DISTRIBUTION' && (
                    currentPeriodClosure ? (
                        <button 
                            onClick={() => { setViewOnlyMode(true); setIsMonthEndModalOpen(true); }} 
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all mr-2"
                        >
                            <Lock className="w-4 h-4" /> Ver Reporte Histórico
                        </button>
                    ) : (
                        <button 
                            onClick={() => { setViewOnlyMode(false); setIsMonthEndModalOpen(true); }} 
                            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all mr-2 animate-[pulse_3s_infinite]"
                        >
                            <Archive className="w-4 h-4" /> Realizar Cierre de Mes
                        </button>
                    )
                )}
                <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 flex-wrap">
                    <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'GENERAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>General</button>
                    <button onClick={() => setActiveTab('INVENTORY')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'INVENTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Inventario Detallado</button>
                    <button onClick={() => setActiveTab('DISTRIBUTION')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'DISTRIBUTION' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Distribución y Presupuesto</button>
                    <button onClick={() => setActiveTab('Z_HISTORY')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'Z_HISTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Historial de Cortes</button>
                </div>
            </div>
          </div>

          {/* FILTERS (Only for General Tab) */}
          {activeTab === 'GENERAL' && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => { setDateRange('TODAY'); setShowFilters(false); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'TODAY' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>Hoy</button>
                    <button onClick={() => { setDateRange('WEEK'); setShowFilters(false); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'WEEK' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>7 Días</button>
                    <button onClick={() => { setDateRange('MONTH'); setShowFilters(false); }} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${dateRange === 'MONTH' ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}>Mes</button>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-full transition-all border ${showFilters || dateRange === 'CUSTOM' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}><Filter className="w-4 h-4" /></button>
                </div>
                {/* Advanced Filters Drawer */}
                {(showFilters || dateRange === 'CUSTOM') && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 animate-[slideUp_0.2s_ease-out]">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Filter className="w-4 h-4" /> Filtros Avanzados</h3>{dateRange === 'CUSTOM' && (<button onClick={() => { setDateRange('WEEK'); setShowFilters(false); setPaymentMethodFilter('ALL'); }} className="text-xs text-red-500 hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Limpiar Filtros</button>)}</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label><input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setDateRange('CUSTOM'); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label><input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setDateRange('CUSTOM'); }} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"/></div>
                            <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de Pago</label><select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white appearance-none"><option value="ALL">Todos</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="transfer">Transferencia</option><option value="credit">Crédito</option><option value="split">Pago Dividido</option></select></div>
                        </div>
                    </div>
                )}
              </>
          )}
        </div>

        {/* ... (GENERAL TAB CONTENT - UPDATED WITH NEW CHARTS) ... */}
        {activeTab === 'GENERAL' && (
            <div className="animate-[fadeIn_0.3s_ease-out]">
                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp className="w-20 h-20 text-indigo-600" /></div>
                        <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl"><DollarSign className="w-6 h-6" /></div><div><p className="text-sm font-bold text-slate-500 dark:text-slate-400">Ventas Totales</p><p className="text-[10px] text-slate-400">Propias + Terceros</p></div></div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">${summaryMetrics.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                        <p className="text-xs text-slate-400">{summaryMetrics.transactionCount} transacciones</p>
                    </div>
                    {/* ... other cards ... */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl"><ArrowDownRight className="w-6 h-6" /></div><div><p className="text-sm font-bold text-slate-500 dark:text-slate-400">Salidas Totales</p><p className="text-[10px] text-slate-400">Gastos + Liq. Terceros</p></div></div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">${summaryMetrics.totalMoneyOut.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                        <p className="text-xs text-slate-400">Flujo Saliente</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl"><ArrowUpRight className="w-6 h-6" /></div><div><p className="text-sm font-bold text-slate-500 dark:text-slate-400">Utilidad Real</p><p className="text-[10px] text-slate-400">Ventas Propias - Gastos Op.</p></div></div>
                        <h3 className={`text-3xl font-black mb-1 ${summaryMetrics.netEstimate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>${summaryMetrics.netEstimate.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                        <p className="text-xs text-slate-400">Estimado contable</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4"><div className="p-3 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl"><Handshake className="w-6 h-6" /></div><div><p className="text-sm font-bold text-slate-500 dark:text-slate-400">Venta Terceros</p><p className="text-[10px] text-slate-400">Dinero por Consignación</p></div></div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-1">${thirdPartyMetrics.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
                        <p className="text-xs text-orange-500 font-medium">No es ganancia propia</p>
                    </div>
                </div>

                <div className="mb-8">
                    {!insight ? (
                        <button onClick={handleGenerateInsight} disabled={loadingAi} className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3">
                            {loadingAi ? <Activity className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} {loadingAi ? 'Analizando datos...' : 'Generar Análisis Inteligente con IA'}
                        </button>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900 overflow-hidden animate-[fadeIn_0.5s]">
                            <div className="bg-indigo-600 p-4 flex justify-between items-center text-white"><div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><h3 className="font-bold">Análisis de Negocio IA</h3></div><button onClick={() => setInsight(null)} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">Cerrar</button></div>
                            <div className="p-6 prose prose-sm prose-indigo dark:prose-invert max-w-none"><ReactMarkdown>{insight}</ReactMarkdown></div>
                        </div>
                    )}
                </div>

                {/* --- NEW: MAIN CHARTS ROW (Area & Bar) --- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-indigo-500" /> Tendencia de Ventas</h3>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} tickFormatter={(val) => `$${val}`} width={40} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'}} cursor={{stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5'}} formatter={(val: number) => [`$${val.toFixed(2)}`, 'Ventas']} />
                                    <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><ArrowDownRight className="w-5 h-5 text-emerald-500" /> Ingresos vs Egresos</h3>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: textColor, fontSize: 11}} width={40} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'}} />
                                    <Legend />
                                    <Bar dataKey="sales" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* --- NEW: SECONDARY CHARTS ROW (Pie & Categories & List) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Payment Methods */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-500" /> Métodos de Pago</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {paymentChartData.map((entry, index) => {
                                            // Map labels to specific colors
                                            let color = COLORS[index % COLORS.length];
                                            if (entry.name === 'Efectivo') color = PAY_COLORS.cash;
                                            if (entry.name === 'Tarjeta') color = PAY_COLORS.card;
                                            if (entry.name === 'Transferencia') color = PAY_COLORS.transfer;
                                            if (entry.name === 'Crédito') color = PAY_COLORS.credit;
                                            if (entry.name === 'Dividido') color = PAY_COLORS.split;
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{borderRadius:'8px', border:'none'}} />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Sales by Category */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Tag className="w-5 h-5 text-orange-500" /> Ventas por Categoría</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryData} layout="vertical" margin={{left: 10, right: 10}}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={80} tick={{fill: textColor, fontSize: 10}} interval={0}/>
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000'}} />
                                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Products (Existing List - Adjusted Height) */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[360px]">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Package className="w-5 h-5 text-purple-500" /> Top Productos</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                            {topProducts.length > 0 ? topProducts.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                        <div><p className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{p.name}</p><p className="text-xs text-slate-500">{p.qty} vendidas</p></div>
                                    </div>
                                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">${p.total.toFixed(0)}</span>
                                </div>
                            )) : <div className="text-center py-10 text-slate-400"><AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" /><p className="text-xs">Sin datos de venta</p></div>}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'INVENTORY' && (
            // ... (Inventory logic remains same) ...
            <div className="animate-[fadeIn_0.3s_ease-out]">
                {/* ... existing inventory rendering ... */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Layers className="w-6 h-6 text-indigo-500" /> Auditoría de Inventario
                        </h3>
                        <p className="text-sm text-slate-500">Optimización de stock basada en rotación y valor.</p>
                    </div>
                    
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setInvSort('URGENT')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${invSort === 'URGENT' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Urgentes</button>
                        <button onClick={() => setInvSort('VALUE')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${invSort === 'VALUE' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>Valor $$</button>
                        <button onClick={() => setInvSort('SLOW')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${invSort === 'SLOW' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>Sin Mov.</button>
                    </div>
                </div>
                {/* ... stats cards ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg"><DollarSign className="w-5 h-5"/></div><p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor en Costo</p></div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">${inventoryMetrics.totalStockValue.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg"><TrendingUp className="w-5 h-5"/></div><p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Potencial Venta</p></div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">${inventoryMetrics.totalPotentialRevenue.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"><AlertTriangle className="w-5 h-5"/></div><p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Riesgo Quiebre</p></div>
                        <h3 className="text-2xl font-black text-red-600 dark:text-red-400">{inventoryMetrics.criticalCount}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg"><TrendingDown className="w-5 h-5"/></div><p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stock Muerto</p></div>
                        <h3 className="text-2xl font-black text-orange-600 dark:text-orange-400">{inventoryMetrics.deadStockCount}</h3>
                    </div>
                </div>
                {/* ... messages and table ... */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden h-full">
                            <h3 className="text-xl font-bold mb-4 relative z-10 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-300" /> Analista de Producción</h3>
                            <div className="space-y-4 relative z-10 custom-scrollbar max-h-[500px] overflow-y-auto">
                                {inventoryMetrics.messages.map((msg, i) => (
                                    <div key={i} className={`p-4 rounded-xl border ${msg.type === 'bad' ? 'bg-red-500/20 border-red-500/50' : msg.type === 'good' ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-white/10 border-white/20'}`}>
                                        <p className={`text-xs font-bold mb-1 uppercase tracking-wide ${msg.type === 'bad' ? 'text-red-300' : msg.type === 'good' ? 'text-emerald-300' : 'text-blue-300'}`}>{msg.title}</p>
                                        <p className="text-sm text-indigo-100 leading-relaxed">{msg.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4"/> Detalle de Productos</h4>
                        </div>
                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                    <tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3 text-center">Stock</th><th className="px-4 py-3 text-center">Ventas (30d)</th><th className="px-4 py-3 text-center">Días Rest.</th><th className="px-4 py-3 text-right">Valor Venta</th><th className="px-4 py-3 text-center">Estado</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {inventoryMetrics.sortedItems.slice(0, 50).map((item: any) => {
                                        let badgeColor = 'bg-slate-100 text-slate-500';
                                        let label = 'Normal';
                                        if (item.daysRemaining < 7 && item.sold30Days > 0) { badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'; label = 'Urgente'; } 
                                        else if (item.sold30Days === 0) { badgeColor = 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'; label = 'Sin Mov.'; } 
                                        else if (item.daysRemaining > 180) { badgeColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'; label = 'Exceso'; } 
                                        else { badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'; label = 'Saludable'; }
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-white"><div className="line-clamp-1">{item.name}</div><div className="text-[10px] text-slate-400">{item.category}</div></td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-300">{item.stock}</td>
                                                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{item.sold30Days}</td>
                                                <td className="px-4 py-3 text-center font-mono text-xs">{item.daysRemaining > 900 ? '∞' : item.daysRemaining.toFixed(0)} días</td>
                                                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">${item.stockPotential.toFixed(0)}</td>
                                                <td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold px-2 py-1 rounded ${badgeColor}`}>{label}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'DISTRIBUTION' && (
            // --- UPDATED BUDGET & DISTRIBUTION TAB WITH PERIODS ---
            <div className="animate-[fadeIn_0.3s_ease-out]">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Target className="w-6 h-6 text-indigo-500" /> Control de Presupuesto
                        </h3>
                        <p className="text-sm text-slate-500">
                            Ciclo {distMetrics.config.cycleType === 'FIXED_DAYS' ? `de ${distMetrics.config.cycleLength} Días` : 'Mensual'}.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <button 
                            onClick={() => setSelectedPeriodOffset(prev => prev + 1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                            title="Periodo Anterior"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="text-center min-w-[140px]">
                            <p className="text-xs font-bold text-slate-400 uppercase">Periodo</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                {distMetrics.periodStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {distMetrics.periodEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                            </p>
                        </div>
                        <button 
                            onClick={() => setSelectedPeriodOffset(prev => Math.max(0, prev - 1))}
                            disabled={selectedPeriodOffset === 0}
                            className={`p-2 rounded-lg transition-colors ${selectedPeriodOffset === 0 ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'}`}
                            title="Periodo Siguiente"
                        >
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Period Alerts Banner */}
                {currentPeriodClosure ? (
                    <div className="mb-6 p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 shrink-0">
                            <Lock className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-lg">Periodo Cerrado</h4>
                            <p className="text-sm text-slate-500">
                                Este ciclo fiscal fue cerrado el {new Date(currentPeriodClosure.closedAt).toLocaleDateString()}.
                            </p>
                        </div>
                    </div>
                ) : (
                    distMetrics.isCurrentPeriod && distMetrics.daysRemaining <= 3 && (
                        <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl flex flex-col md:flex-row gap-4 items-center animate-[pulse_3s_infinite]">
                            <div className="p-3 bg-orange-100 dark:bg-orange-800 rounded-full text-orange-600 dark:text-orange-200 shrink-0">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h4 className="font-bold text-orange-800 dark:text-orange-200 text-lg">¡Cierre de Periodo Próximo!</h4>
                                <p className="text-sm text-orange-700 dark:text-orange-300">
                                    Quedan solo <strong>{distMetrics.daysRemaining} días</strong> para terminar el ciclo. 
                                    Asegúrate de distribuir las ganancias y registrar gastos pendientes.
                                </p>
                            </div>
                            {distMetrics.expenseSurplus > 0 && (
                                <div className="px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-xl font-bold text-sm text-center">
                                    Sobrante Gastos:<br/>${distMetrics.expenseSurplus.toFixed(0)} ➔ Ahorro
                                </div>
                            )}
                        </div>
                    )
                )}

                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${currentPeriodClosure ? 'opacity-75 grayscale-[0.5] pointer-events-none' : ''}`}>
                    {/* Visual Comparison Cards */}
                    <div className="space-y-6">
                        {/* OpEx Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Gastos Operativos</h4>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">{distMetrics.config.expensesPercentage}% Presupuesto</span>
                            </div>
                            <div className="flex items-end gap-2 mb-2">
                                <span className={`text-2xl font-black ${distMetrics.actual.opEx > distMetrics.target.opEx ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>${distMetrics.actual.opEx.toFixed(0)}</span>
                                <span className="text-sm text-slate-400 mb-1">/ ${distMetrics.target.opEx.toFixed(0)} límite</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${distMetrics.actual.opEx > distMetrics.target.opEx ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (distMetrics.actual.opEx / (distMetrics.income || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            {distMetrics.expenseSurplus > 0 && (
                                <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3"/> Ahorro operativo: ${distMetrics.expenseSurplus.toFixed(0)} (Se suma a inversión)
                                </p>
                            )}
                        </div>

                        {/* Profit Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Retiro de Ganancias</h4>
                                <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded font-bold">{distMetrics.config.profitPercentage}% Asignado</span>
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
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Wallet className="w-24 h-24 text-blue-500"/>
                            </div>
                            <div className="flex justify-between items-center mb-4 relative z-10">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Inversión / Ahorro Real</h4>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">{distMetrics.config.investmentPercentage}% Base</span>
                            </div>
                            <div className="flex items-end gap-2 mb-2 relative z-10">
                                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">${distMetrics.actual.investment.toFixed(0)}</span>
                                <span className="text-sm text-slate-400 mb-1">acumulado</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden relative z-10">
                                <div 
                                    className="h-full rounded-full transition-all duration-500 bg-blue-500"
                                    style={{ width: `${Math.min(100, (distMetrics.actual.investment / (distMetrics.income || 1)) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 relative z-10">
                                Incluye el % base de inversión MÁS cualquier sobrante de gastos no utilizados.
                            </p>
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
                                Diagnóstico del periodo actual ({distMetrics.periodStart.toLocaleDateString()} - {distMetrics.periodEnd.toLocaleDateString()}).
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
        )}

        {activeTab === 'Z_HISTORY' && (
            // ... (Z HISTORY logic remains same) ...
            <div className="animate-[fadeIn_0.3s_ease-out]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <Lock className="w-6 h-6 text-indigo-500" /> Historial de Cierres de Caja
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {zReportHistory.length > 0 ? zReportHistory.map((report: CashMovement) => (
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

                            <button onClick={() => printZCutTicket(report, settings, btDevice ? sendBtData : undefined)} className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
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

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { 
    Calendar, TrendingUp, DollarSign, Package, AlertTriangle, 
    Download, Filter, Target, ArrowLeft, ArrowRight, Lock, 
    FileText, Printer, Clock, CheckCircle2, Wallet, Lightbulb, 
    AlertCircle, Search, LayoutDashboard
} from 'lucide-react';
import { printFinancialReport, printMonthEndTicket, printMonthEndReportPDF } from '../utils/printService';
import { generateBusinessInsight, generateMonthEndAnalysis } from '../services/geminiService';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const Reports: React.FC = () => {
    const { transactions, products, customers, suppliers, cashMovements, settings, periodClosures, addPeriodClosure, btDevice, sendBtData, notify } = useStore();
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'SALES' | 'DISTRIBUTION'>('GENERAL');
    
    // --- GENERAL & SALES REPORT STATE ---
    const [dateRange, setDateRange] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const filteredTransactions = useMemo(() => {
        let start = new Date();
        let end = new Date();
        
        if (dateRange === 'TODAY') {
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
        } else if (dateRange === 'WEEK') {
            start.setDate(start.getDate() - 7);
        } else if (dateRange === 'MONTH') {
            start.setMonth(start.getMonth() - 1);
        } else if (dateRange === 'YEAR') {
            start.setFullYear(start.getFullYear() - 1);
        }

        return transactions.filter(t => {
            const d = new Date(t.date);
            return t.status !== 'cancelled' && d >= start && d <= end;
        });
    }, [transactions, dateRange]);

    const salesData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredTransactions.forEach(t => {
            const dateStr = new Date(t.date).toLocaleDateString();
            data[dateStr] = (data[dateStr] || 0) + t.total;
        });
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [filteredTransactions]);

    const categoryData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredTransactions.forEach(t => {
            t.items.forEach(item => {
                const cat = item.category || 'Otros';
                data[cat] = (data[cat] || 0) + (item.price * item.quantity);
            });
        });
        return Object.entries(data)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredTransactions]);

    // --- DISTRIBUTION TAB STATE ---
    const [selectedPeriodOffset, setSelectedPeriodOffset] = useState(0);
    const [analysisResult, setAnalysisResult] = useState<{status: string, messages: {title: string, desc: string, type: string}[]} | null>(null);
    const [isAnalysing, setIsAnalysing] = useState(false);

    // Helper to get period dates
    const getPeriodDates = (offset: number) => {
        const config = settings.budgetConfig || { fiscalStartDate: new Date().toISOString(), cycleType: 'MONTHLY' };
        const startDate = new Date(config.fiscalStartDate || new Date().toISOString());
        // Normalizar start date a medianoche UTC o Local para evitar problemas de zona horaria
        startDate.setHours(0,0,0,0);
        
        let start = new Date(startDate);
        let end = new Date(startDate);

        if (config.cycleType === 'FIXED_DAYS') {
            const length = config.cycleLength || 28;
            const now = new Date();
            now.setHours(0,0,0,0);
            
            // Dias desde el inicio
            const diffTime = now.getTime() - startDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Ciclo actual (si diffDays < 0, es 0)
            const currentCycleIndex = Math.max(0, Math.floor(diffDays / length));
            const targetIndex = currentCycleIndex - offset;
            
            start = new Date(startDate);
            start.setDate(startDate.getDate() + (targetIndex * length));
            
            end = new Date(start);
            end.setDate(start.getDate() + length - 1);
        } else {
            // MONTHLY LOGIC
            const today = new Date();
            const fiscalDay = startDate.getDate();
            
            // Encontrar el inicio del ciclo actual
            let currentCycleStart = new Date(today.getFullYear(), today.getMonth(), fiscalDay);
            // Si hoy es antes del día fiscal, estamos en el ciclo que empezó el mes pasado
            if (today.getDate() < fiscalDay) {
                currentCycleStart.setMonth(currentCycleStart.getMonth() - 1);
            }
            
            // Aplicar offset
            start = new Date(currentCycleStart);
            start.setMonth(start.getMonth() - offset);
            
            // Final es un mes después menos un día (o hasta el día anterior al fiscal)
            end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            end.setDate(end.getDate() - 1);
        }
        
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);
        
        return { start, end };
    };

    const periodDates = useMemo(() => getPeriodDates(selectedPeriodOffset), [selectedPeriodOffset, settings.budgetConfig]);
    
    // Metrics Calculation for Distribution
    const distMetrics = useMemo(() => {
        const { start, end } = periodDates;
        const now = new Date();
        const isCurrentPeriod = now >= start && now <= end;
        const daysRemaining = isCurrentPeriod ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        const periodMovements = cashMovements.filter(m => {
            const d = new Date(m.date);
            return d >= start && d <= end;
        });

        const income = periodMovements
            .filter(m => m.type === 'DEPOSIT' && (m.category === 'SALES' || m.category === 'EQUITY'))
            .reduce((sum, m) => sum + m.amount, 0);

        const actualOpEx = periodMovements
            .filter(m => (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') && m.category === 'OPERATIONAL')
            .reduce((sum, m) => sum + m.amount, 0);

        const actualProfit = periodMovements
            .filter(m => (m.type === 'WITHDRAWAL' || m.type === 'EXPENSE') && m.category === 'PROFIT')
            .reduce((sum, m) => sum + m.amount, 0);
            
        // Calculated investment: Base allocation + Savings from OpEx
        const config = settings.budgetConfig || { expensesPercentage: 50, profitPercentage: 20, investmentPercentage: 30 };
        const targetOpEx = income * (config.expensesPercentage / 100);
        const targetProfit = income * (config.profitPercentage / 100);
        const targetInvestment = income * (config.investmentPercentage / 100);

        const expenseSurplus = Math.max(0, targetOpEx - actualOpEx);
        const actualInvestment = targetInvestment + expenseSurplus;

        return {
            periodStart: start,
            periodEnd: end,
            isCurrentPeriod,
            daysRemaining,
            income,
            actual: { opEx: actualOpEx, profit: actualProfit, investment: actualInvestment },
            target: { opEx: targetOpEx, profit: targetProfit, investment: targetInvestment },
            expenseSurplus,
            config
        };
    }, [periodDates, cashMovements, settings.budgetConfig]);

    const currentPeriodClosure = useMemo(() => {
        // Simple check if a closure exists for this start date
        return periodClosures.find(pc => new Date(pc.periodStart).toDateString() === periodDates.start.toDateString());
    }, [periodClosures, periodDates]);

    const topProductsForPeriod = useMemo(() => {
        const { start, end } = periodDates;
        const periodTx = transactions.filter(t => {
            const d = new Date(t.date);
            return t.status !== 'cancelled' && d >= start && d <= end;
        });
        
        const prodStats: Record<string, {name: string, qty: number, total: number}> = {};
        periodTx.forEach(t => t.items.forEach(i => {
            if (!prodStats[i.name]) prodStats[i.name] = { name: i.name, qty: 0, total: 0 };
            prodStats[i.name].qty += i.quantity;
            prodStats[i.name].total += (i.price * i.quantity);
        }));
        
        return Object.values(prodStats).sort((a,b) => b.total - a.total).slice(0, 5);
    }, [transactions, periodDates]);

    const topCustomersForPeriod = useMemo(() => {
        const { start, end } = periodDates;
        const periodTx = transactions.filter(t => {
            const d = new Date(t.date);
            return t.status !== 'cancelled' && d >= start && d <= end;
        });
        
        const custStats: Record<string, {name: string, total: number}> = {};
        periodTx.forEach(t => {
            const name = t.customerId ? (customers.find(c => c.id === t.customerId)?.name || 'Cliente') : 'Mostrador';
            if (!custStats[name]) custStats[name] = { name, total: 0 };
            custStats[name].total += t.total;
        });
        return Object.values(custStats).sort((a,b) => b.total - a.total).slice(0, 5);
    }, [transactions, periodDates, customers]);

    const handleGenerateMonthReport = async (type: 'PDF' | 'THERMAL') => {
        if (type === 'THERMAL') {
            await printMonthEndTicket(distMetrics, settings, btDevice ? sendBtData : undefined);
        } else {
            let analysis = "Análisis generado automáticamente.";
            // Try to get AI analysis if we don't have one stored or active
            if (!analysisResult) {
                notify("Generando Reporte", "Consultando análisis inteligente...", "info");
                try {
                    analysis = await generateMonthEndAnalysis(distMetrics, topProductsForPeriod, topCustomersForPeriod);
                } catch(e) {
                    analysis = "No se pudo conectar con el asistente IA.";
                }
            } else if (analysisResult.messages.length > 0) {
                analysis = analysisResult.messages.map(m => `## ${m.title}\n${m.desc}`).join('\n\n');
            }
            printMonthEndReportPDF(distMetrics, analysis, topProductsForPeriod, settings);
        }
    };

    const handleSmartAnalysis = async () => {
        setIsAnalysing(true);
        try {
            const analysisText = await generateMonthEndAnalysis(distMetrics, topProductsForPeriod, topCustomersForPeriod);
            
            // Simple parsing of markdown sections to messages
            const sections = analysisText.split('#').filter(s => s.trim().length > 0);
            const messages = sections.map(s => {
                const [title, ...rest] = s.split('\n');
                return {
                    title: title.trim(),
                    desc: rest.join('\n').trim(),
                    type: title.toLowerCase().includes('alerta') || title.toLowerCase().includes('atención') ? 'bad' : 'info'
                };
            });

            if (messages.length === 0) {
                 // Fallback if formatting failed
                 setAnalysisResult({
                    status: 'info',
                    messages: [{ title: 'Resumen General', desc: analysisText, type: 'info' }]
                });
            } else {
                setAnalysisResult({
                    status: 'info',
                    messages
                });
            }
        } catch (e) {
            notify("Error", "No se pudo generar análisis", "error");
        } finally {
            setIsAnalysing(false);
        }
    };

    const handleClosePeriod = () => {
        if (confirm("¿Cerrar este periodo fiscal? Esto guardará una instantánea de los reportes y no podrá modificarse.")) {
            addPeriodClosure({
                id: crypto.randomUUID(),
                periodStart: distMetrics.periodStart.toISOString(),
                periodEnd: distMetrics.periodEnd.toISOString(),
                closedAt: new Date().toISOString(),
                reportData: distMetrics
            });
            notify("Periodo Cerrado", "El ciclo se ha archivado correctamente.", "success");
        }
    };

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Reportes y Finanzas</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Análisis de ventas y distribución de capital.</p>
                    </div>
                    
                    <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                        <button onClick={() => setActiveTab('GENERAL')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'GENERAL' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>General</button>
                        <button onClick={() => setActiveTab('SALES')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'SALES' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Ventas</button>
                        <button onClick={() => setActiveTab('DISTRIBUTION')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'DISTRIBUTION' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Presupuesto</button>
                    </div>
                </div>

                {activeTab === 'GENERAL' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Ventas Recientes</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={salesData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false}/>
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`}/>
                                        <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                                        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><PieChart className="w-5 h-5"/> Top Categorías</h3>
                            <div className="h-64 flex">
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={categoryData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {categoryData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col justify-center gap-2 text-sm">
                                    {categoryData.map((entry, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">{entry.name}</span>
                                            <span className="text-slate-400 text-xs">${entry.value.toFixed(0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'DISTRIBUTION' && (
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
                            <div className="mb-6 p-8 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center text-center animate-[fadeIn_0.5s]">
                                <div className="p-4 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-500 mb-4">
                                    <Lock className="w-10 h-10" />
                                </div>
                                <h4 className="font-black text-slate-800 dark:text-white text-2xl mb-2">Periodo Cerrado</h4>
                                <p className="text-slate-500 max-w-md mb-8">
                                    Este ciclo fiscal fue cerrado el {new Date(currentPeriodClosure.closedAt).toLocaleDateString()}. 
                                    El presupuesto y la distribución de ganancias ya no pueden ser modificados.
                                </p>
                                
                                <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
                                     <button 
                                        onClick={() => handleGenerateMonthReport('PDF')}
                                        className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-200 dark:shadow-none"
                                    >
                                        <FileText className="w-5 h-5"/> Descargar Reporte PDF
                                    </button>
                                    <button 
                                        onClick={() => handleGenerateMonthReport('THERMAL')} 
                                        className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Printer className="w-5 h-5"/> Reimprimir Ticket
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {distMetrics.isCurrentPeriod && distMetrics.daysRemaining <= 3 && (
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
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                                    disabled={isAnalysing}
                                                    className="w-full py-4 bg-white text-indigo-900 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-colors relative z-10 flex items-center justify-center gap-2 disabled:opacity-70"
                                                >
                                                    {isAnalysing ? <span className="animate-spin">⏳</span> : <Lightbulb className="w-5 h-5" />}
                                                    {isAnalysing ? "Analizando..." : "Analizar Distribución"}
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
                                        
                                        {/* Action buttons for open period */}
                                        <div className="mt-4 flex gap-3">
                                            <button 
                                                onClick={handleClosePeriod}
                                                className="flex-1 py-3 bg-white dark:bg-slate-800 text-red-500 border border-red-200 dark:border-red-900 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 text-xs flex items-center justify-center gap-2"
                                            >
                                                <Lock className="w-4 h-4"/> Cerrar Periodo
                                            </button>
                                            <button 
                                                onClick={() => handleGenerateMonthReport('PDF')}
                                                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 text-xs flex items-center justify-center gap-2 shadow-lg"
                                            >
                                                <FileText className="w-4 h-4"/> Generar PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

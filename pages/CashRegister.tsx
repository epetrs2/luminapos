
import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { ArrowUpCircle, ArrowDownCircle, Lock, PieChart as PieChartIcon, Trash2, Loader2, DollarSign, Activity, CheckCircle2, TrendingUp, Briefcase, User, Calculator, Save, KeyRound, Printer, RefreshCw, AlertTriangle, Tag, List } from 'lucide-react';
import { CashMovement, BudgetCategory, ZReportData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { printZCutTicket } from '../utils/printService';

// Consistent colors for financial categories
const CAT_COLORS: Record<string, string> = {
    'SALES': '#10b981', // Emerald
    'OPERATIONAL': '#ef4444', // Red
    'EQUITY': '#3b82f6', // Blue
    'PROFIT': '#ec4899', // Pink
    'THIRD_PARTY': '#f97316', // Orange
    'OTHER': '#64748b' // Slate
};

const CAT_LABELS: Record<string, string> = {
    'SALES': 'Ventas',
    'OPERATIONAL': 'Gastos Op.',
    'EQUITY': 'Aporte Dueño',
    'PROFIT': 'Retiro Ganancia',
    'THIRD_PARTY': 'Liq. Terceros',
    'OTHER': 'Otros'
};

export const CashRegister: React.FC = () => {
  const { cashMovements, addCashMovement, deleteCashMovement, settings, transactions, btDevice, sendBtData } = useStore();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [subCategory, setSubCategory] = useState(''); // New: Specific category input
  const [type, setType] = useState<CashMovement['type']>('EXPENSE');
  const [category, setCategory] = useState<BudgetCategory>('OPERATIONAL'); 
  
  // Open Register State
  const [openRegisterModalOpen, setOpenRegisterModalOpen] = useState(false);
  const [initialFund, setInitialFund] = useState('');

  // Z-Cut State
  const [zCutModalOpen, setZCutModalOpen] = useState(false);
  const [declaredCash, setDeclaredCash] = useState('');
  const [savingZCut, setSavingZCut] = useState(false);

  // Delete Confirmation State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Get unique used subcategories for suggestions
  const suggestedSubCategories = useMemo(() => {
      const unique = new Set<string>();
      cashMovements.forEach(m => {
          if (m.subCategory) unique.add(m.subCategory);
      });
      return Array.from(unique);
  }, [cashMovements]);

  // --- LOGIC TO FIND CURRENT SHIFT BALANCE ---
  const sortedMovements = [...cashMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCloseIndex = sortedMovements.findIndex(m => m.type === 'CLOSE');
  
  let currentSessionMovements: CashMovement[] = [];
  let isRegisterOpen = false;

  if (lastCloseIndex === -1) {
      currentSessionMovements = sortedMovements;
      isRegisterOpen = sortedMovements.some(m => m.type === 'OPEN');
  } else {
      currentSessionMovements = sortedMovements.slice(0, lastCloseIndex);
      isRegisterOpen = currentSessionMovements.some(m => m.type === 'OPEN');
  }

  // Calculate Balance
  const balance = currentSessionMovements.reduce((acc, curr) => {
    if (curr.type === 'OPEN' || curr.type === 'DEPOSIT') return acc + curr.amount;
    if (curr.type === 'EXPENSE' || curr.type === 'WITHDRAWAL') return acc - curr.amount;
    return acc;
  }, 0);

  // Filter movements for today
  const today = new Date().toDateString();
  const todaysMovements = cashMovements.filter(m => new Date(m.date).toDateString() === today && !m.isZCut);

  // Totals for today (Cash Flow)
  const incomeToday = todaysMovements.filter(m => m.type === 'OPEN' || m.type === 'DEPOSIT').reduce((a, b) => a + b.amount, 0);
  const expenseToday = todaysMovements.filter(m => m.type === 'EXPENSE' || m.type === 'WITHDRAWAL').reduce((a, b) => a + b.amount, 0);

  // --- DETAILED CHART DATA (By Category) ---
  const categoryData = useMemo(() => {
      const grouped: Record<string, number> = {};
      
      todaysMovements.forEach(m => {
          // Skip opening fund to see pure movement distribution
          if (m.type === 'OPEN') return;
          
          const catKey = m.category || 'OTHER';
          grouped[catKey] = (grouped[catKey] || 0) + m.amount;
      });

      return Object.keys(grouped).map(key => ({
          name: CAT_LABELS[key] || key,
          value: grouped[key],
          color: CAT_COLORS[key] || '#94a3b8'
      }));
  }, [todaysMovements]);

  const handleTypeChange = (newType: CashMovement['type'], specificCategory?: BudgetCategory) => {
      setType(newType);
      if (specificCategory) {
          setCategory(specificCategory);
      } else {
          if (newType === 'EXPENSE') setCategory('OPERATIONAL');
          else if (newType === 'WITHDRAWAL') setCategory('PROFIT');
          else if (newType === 'DEPOSIT') setCategory('SALES');
          else setCategory('OTHER');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    
    if (type === 'OPEN' && isRegisterOpen) {
        alert("La caja ya está abierta.");
        return;
    }

    addCashMovement({
      id: crypto.randomUUID(),
      type,
      amount: parseFloat(amount),
      description,
      date: new Date().toISOString(),
      category,
      subCategory: subCategory.trim() || undefined
    });
    setAmount('');
    setDescription('');
    setSubCategory('');
  };

  const handleOpenRegister = () => {
      const fund = parseFloat(initialFund) || 0;
      addCashMovement({
          id: crypto.randomUUID(),
          type: 'OPEN',
          amount: fund,
          description: 'Apertura de Caja (Fondo Inicial)',
          date: new Date().toISOString(),
          category: 'OPERATIONAL'
      });
      setOpenRegisterModalOpen(false);
      setInitialFund('');
  };

  const handlePerformZCut = () => {
      const systemExpected = balance;
      const counted = parseFloat(declaredCash) || 0;
      const diff = counted - systemExpected;

      setSavingZCut(true);
      
      const lastOpen = currentSessionMovements.find(m => m.type === 'OPEN');
      const sessionStartDate = lastOpen ? new Date(lastOpen.date) : new Date(new Date().setHours(0,0,0,0));
      const sessionTx = transactions.filter(t => new Date(t.date) >= sessionStartDate && t.status !== 'cancelled');
      
      const zData: ZReportData = {
          openingFund: lastOpen?.amount || 0,
          grossSales: sessionTx.reduce((sum, t) => sum + t.total, 0),
          cashSales: sessionTx.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.amountPaid, 0) + 
                     (sessionTx.filter(t => t.paymentMethod === 'split').reduce((sum, t) => sum + (t.splitDetails?.cash || 0), 0)),
          cardSales: sessionTx.filter(t => t.paymentMethod === 'card').reduce((sum, t) => sum + t.amountPaid, 0),
          transferSales: sessionTx.filter(t => t.paymentMethod === 'transfer').reduce((sum, t) => sum + t.amountPaid, 0),
          creditSales: sessionTx.filter(t => t.paymentMethod === 'credit').reduce((sum, t) => sum + t.total, 0), 
          expenses: currentSessionMovements.filter(m => m.type === 'EXPENSE').reduce((sum, m) => sum + m.amount, 0),
          withdrawals: currentSessionMovements.filter(m => m.type === 'WITHDRAWAL').reduce((sum, m) => sum + m.amount, 0),
          expectedCash: systemExpected,
          declaredCash: counted,
          difference: diff,
          timestamp: new Date().toISOString()
      };

      const zCutMovement: CashMovement = {
          id: crypto.randomUUID(),
          type: 'CLOSE',
          amount: 0, 
          description: `Cierre Z - Declarado: $${counted.toFixed(2)} | Dif: $${diff.toFixed(2)}`,
          date: new Date().toISOString(),
          category: 'OTHER',
          isZCut: true,
          zReportData: zData
      };

      addCashMovement(zCutMovement);

      setTimeout(() => {
          setSavingZCut(false);
          setZCutModalOpen(false);
          setDeclaredCash('');
          printZCutTicket(zCutMovement, settings, btDevice ? sendBtData : undefined);
      }, 1000);
  };

  const confirmDelete = () => {
      if (deleteId) {
          deleteCashMovement(deleteId);
          setDeleteId(null);
      }
  };

  const reprintZReport = (movement: CashMovement) => {
      printZCutTicket(movement, settings, btDevice ? sendBtData : undefined);
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-2">Caja Chica</h2>
                <div className="flex items-center gap-2">
                    <p className="text-slate-500 dark:text-slate-400">Control financiero diario</p>
                    {isRegisterOpen ? (
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">CAJA ABIERTA</span>
                    ) : (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">CAJA CERRADA</span>
                    )}
                </div>
            </div>
            
            <div className="flex gap-3">
                {!isRegisterOpen && (
                    <button 
                        onClick={() => setOpenRegisterModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 animate-[pulse_2s_infinite]"
                    >
                        <KeyRound className="w-5 h-5" /> Abrir Caja
                    </button>
                )}
                {isRegisterOpen && (
                    <button 
                        onClick={() => setZCutModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                    >
                        <Lock className="w-5 h-5" /> Realizar Cierre Z
                    </button>
                )}
            </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={`rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transition-colors ${isRegisterOpen ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-slate-700'}`}>
                <div className="absolute right-0 top-0 p-6 opacity-10">
                    <DollarSign className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                    <p className="text-indigo-100 font-medium mb-1">Balance Actual (Caja)</p>
                    <h3 className="text-4xl font-bold tracking-tight">${balance.toFixed(2)}</h3>
                    {!isRegisterOpen && <p className="text-xs text-orange-300 mt-1">Caja cerrada. Balance reiniciado.</p>}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Ingresos Hoy</p>
                    <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">+${incomeToday.toFixed(2)}</h3>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <ArrowUpCircle className="w-8 h-8" />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Egresos Hoy</p>
                    <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">-${expenseToday.toFixed(2)}</h3>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                    <ArrowDownCircle className="w-8 h-8" />
                </div>
            </div>
        </div>

        {/* Improved Visualizations & Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 min-w-0 flex flex-col">
                 <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-indigo-500" />
                    Distribución de Movimientos (Hoy)
                 </h3>
                 <div className="flex-1 flex flex-col md:flex-row items-center gap-8 justify-center">
                     {categoryData.length > 0 ? (
                         <>
                            <div className="w-full md:w-1/2 h-64 relative">
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
                                            stroke="none"
                                        >
                                            {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{borderRadius:'8px', border:'none'}} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Text */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xs text-slate-400 font-medium">Movimiento</span>
                                    <span className="text-lg font-bold text-slate-800 dark:text-white">${(incomeToday + expenseToday).toFixed(0)}</span>
                                </div>
                            </div>
                            
                            <div className="w-full md:w-1/2 grid grid-cols-1 gap-3">
                                {categoryData.map((cat, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: cat.color}}></div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                                        </div>
                                        <span className="text-sm font-bold dark:text-white">${cat.value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                         </>
                     ) : (
                         <div className="text-center py-12 text-slate-400">
                             <PieChartIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                             <p>Sin movimientos hoy.</p>
                         </div>
                     )}
                 </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                 <h3 className="font-bold text-slate-800 dark:text-white mb-4">Registrar Movimiento</h3>
                 {!isRegisterOpen && (
                     <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-800 dark:text-orange-300 flex items-start gap-2">
                         <KeyRound className="w-4 h-4 mt-0.5 shrink-0" />
                         <p>La caja está cerrada. Debes hacer una "Apertura" primero.</p>
                     </div>
                 )}
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                         {/* BASIC INCOME */}
                         <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'SALES')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'SALES' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Ingreso Venta</button>
                         {/* BASIC EXPENSE */}
                         <button type="button" onClick={() => handleTypeChange('EXPENSE', 'OPERATIONAL')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'EXPENSE' ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Gasto Op.</button>
                         {/* OWNER EQUITY (NEW) */}
                         <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'EQUITY')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'EQUITY' ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Aporte Dueño</button>
                         {/* PROFIT WITHDRAWAL */}
                         <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'PROFIT')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'PROFIT' ? 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Retiro Ganancia</button>
                         {/* THIRD PARTY PAYOUT (NEW) */}
                         <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'THIRD_PARTY')} className={`col-span-2 py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'THIRD_PARTY' ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Liquidación Tercero / Consignación</button>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none" disabled={!isRegisterOpen} />
                    </div>
                    
                    {/* Category Input (Autocomplete) */}
                    {(type === 'EXPENSE' || category === 'THIRD_PARTY') && (
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                list="categories-list"
                                type="text"
                                value={subCategory}
                                onChange={(e) => setSubCategory(e.target.value)}
                                placeholder={category === 'THIRD_PARTY' ? "Nombre del Proveedor / Dueño..." : "Categoría (Luz, Renta, Limpieza...)"}
                                className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none font-medium"
                                disabled={!isRegisterOpen}
                            />
                            <datalist id="categories-list">
                                {suggestedSubCategories.map((sc, idx) => (
                                    <option key={idx} value={sc} />
                                ))}
                            </datalist>
                        </div>
                    )}

                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción detallada..." className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none" disabled={!isRegisterOpen} />
                    
                    <button type="submit" className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isRegisterOpen}>Guardar Movimiento</button>
                 </form>
            </div>
        </div>

        {/* History Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3 text-left">Fecha</th>
                  <th className="px-6 py-3 text-left">Tipo</th>
                  <th className="px-6 py-3 text-left">Categoría</th>
                  <th className="px-6 py-3 text-left">Descripción</th>
                  <th className="px-6 py-3 text-right">Monto</th>
                  <th className="px-6 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cashMovements.map((movement) => {
                    const isEquity = movement.category === 'EQUITY';
                    const isThirdParty = movement.category === 'THIRD_PARTY';
                    const isExpense = movement.type === 'EXPENSE';
                    
                    return (
                      <tr key={movement.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(movement.date).toLocaleDateString()} {new Date(movement.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${movement.isZCut ? 'bg-indigo-100 text-indigo-700' : isExpense ? 'bg-red-100 text-red-700' : isThirdParty ? 'bg-orange-100 text-orange-700' : isEquity ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {movement.isZCut ? 'CORTE Z' : isEquity ? 'APORTE' : isThirdParty ? 'LIQ. 3RO' : movement.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">
                            {movement.subCategory || (movement.category === 'OPERATIONAL' ? 'General' : '-')}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">{movement.description}</td>
                        <td className={`px-6 py-4 text-right font-bold text-sm ${movement.isZCut ? 'text-indigo-600' : (isExpense || movement.type === 'WITHDRAWAL' ? 'text-red-600' : 'text-emerald-600')}`}>
                            {movement.isZCut ? '---' : `$${movement.amount.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {movement.isZCut ? (
                                <button onClick={() => reprintZReport(movement)} className="text-indigo-500 hover:text-indigo-700 transition-colors" title="Reimprimir Reporte"><Printer className="w-4 h-4" /></button>
                            ) : (
                                <button onClick={() => setDeleteId(movement.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            )}
                        </td>
                      </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal (Same as before) */}
      {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">¿Eliminar Movimiento?</h3>
                      <p className="text-sm text-slate-500 mt-2">
                          Si eliminas una venta, también se anulará en el historial y el inventario será devuelto.
                      </p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={() => setDeleteId(null)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium">Cancelar</button>
                      <button onClick={confirmDelete} className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg">Sí, Eliminar</button>
                  </div>
              </div>
          </div>
      )}

      {/* Open Register Modal (Same as before) */}
      {openRegisterModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <KeyRound className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Apertura de Caja</h3>
                      <p className="text-sm text-slate-500">Inicia el turno ingresando el fondo inicial.</p>
                  </div>
                  
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fondo / Base en Efectivo</label>
                      <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                          <input 
                            type="number" 
                            autoFocus
                            value={initialFund} 
                            onChange={(e) => setInitialFund(e.target.value)} 
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-bold outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                            placeholder="0.00"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setOpenRegisterModalOpen(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium">Cancelar</button>
                      <button 
                        onClick={handleOpenRegister}
                        className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg"
                      >
                          Iniciar Turno
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Z-Cut Modal (Same as before) */}
      {zCutModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800">
                  <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Lock className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Cierre de Caja (Corte Z)</h3>
                      <p className="text-sm text-slate-500">Genera reporte detallado y concilia el efectivo.</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-6">
                      <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-500">Saldo Esperado (Sistema):</span>
                          <span className="font-bold dark:text-white">${balance.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Efectivo Declarado:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">${(parseFloat(declaredCash)||0).toFixed(2)}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold">
                          <span>Diferencia:</span>
                          <span className={`${((parseFloat(declaredCash)||0) - balance) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              ${((parseFloat(declaredCash)||0) - balance).toFixed(2)}
                          </span>
                      </div>
                  </div>

                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dinero en Caja (Contado)</label>
                      <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                          <input 
                            type="number" 
                            autoFocus
                            value={declaredCash} 
                            onChange={(e) => setDeclaredCash(e.target.value)} 
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setZCutModalOpen(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium">Cancelar</button>
                      <button 
                        onClick={handlePerformZCut}
                        disabled={!declaredCash || savingZCut}
                        className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                      >
                          {savingZCut ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          {savingZCut ? 'Guardando...' : 'Finalizar Cierre'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

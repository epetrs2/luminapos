
import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { CashMovement, BudgetCategory } from '../types';
import { Plus, Search, Filter, Trash2, Printer, DollarSign, CreditCard, Wallet, ArrowRight, X, Save, AlertTriangle, Archive, TrendingUp, TrendingDown } from 'lucide-react';
import { printZCutTicket } from '../utils/printService';

export const CashRegister: React.FC = () => {
  const { cashMovements, addCashMovement, deleteCashMovement, settings, btDevice, sendBtData, notify, transactions } = useStore();
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  // Movement Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE'>('EXPENSE');
  const [category, setCategory] = useState<BudgetCategory>('OPERATIONAL');
  const [channel, setChannel] = useState<'CASH' | 'VIRTUAL'>('CASH');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Z-Cut State
  const [isZModalOpen, setIsZModalOpen] = useState(false);
  const [declaredCash, setDeclaredCash] = useState('');

  // Calculations
  const sortedMovements = useMemo(() => {
    return [...cashMovements]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(m => 
        m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (filterType !== 'ALL' && m.type === filterType)
      );
  }, [cashMovements, searchTerm, filterType]);

  const { currentBalance, sessionStart } = useMemo(() => {
      const sorted = [...cashMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastZIndex = sorted.findIndex(m => m.isZCut);
      
      const activeMovements = lastZIndex === -1 ? sorted : sorted.slice(0, lastZIndex);
      const sessionStart = lastZIndex === -1 ? null : sorted[lastZIndex].date;

      const balance = activeMovements.reduce((acc, m) => {
          if (m.channel !== 'CASH') return acc;
          if (m.type === 'DEPOSIT' || m.type === 'OPEN') return acc + m.amount;
          if (m.type === 'WITHDRAWAL' || m.type === 'EXPENSE') return acc - m.amount;
          return acc;
      }, 0);

      return { currentBalance: balance, sessionStart };
  }, [cashMovements]);

  const handleSave = () => {
    if (!amount || !description) return;
    
    const movement: CashMovement = {
        id: crypto.randomUUID(),
        type,
        amount: parseFloat(amount),
        description,
        date: new Date().toISOString(),
        category,
        channel,
        isZCut: false
    };
    
    addCashMovement(movement);
    setIsModalOpen(false);
    setAmount('');
    setDescription('');
    setType('EXPENSE');
    notify("Movimiento Agregado", "Registro guardado correctamente.", "success");
  };

  const handleDelete = () => {
      if (deleteId) {
          deleteCashMovement(deleteId);
          setDeleteId(null);
          notify("Eliminado", "Movimiento eliminado.", "info");
      }
  };

  const handlePerformZCut = () => {
      const declared = parseFloat(declaredCash) || 0;
      const expected = currentBalance;
      const difference = declared - expected;
      
      // Calculate Session Metrics for Z Report
      const sessionDateStart = sessionStart ? new Date(sessionStart) : new Date(0);
      const sessionTx = transactions.filter(t => new Date(t.date) > sessionDateStart && t.status !== 'cancelled');
      
      const cashSales = sessionTx.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + (t.amountPaid || 0), 0);
      const cardSales = sessionTx.filter(t => t.paymentMethod === 'card').reduce((s, t) => s + (t.amountPaid || 0), 0);
      const transferSales = sessionTx.filter(t => t.paymentMethod === 'transfer').reduce((s, t) => s + (t.amountPaid || 0), 0);
      const creditSales = sessionTx.filter(t => t.paymentMethod === 'credit').reduce((s, t) => s + t.total, 0); // Total booked as credit
      
      // Expenses in Cash
      const sessionExpenses = cashMovements
        .filter(m => new Date(m.date) > sessionDateStart && m.channel === 'CASH' && m.type === 'EXPENSE')
        .reduce((s, m) => s + m.amount, 0);
      
      const sessionWithdrawals = cashMovements
        .filter(m => new Date(m.date) > sessionDateStart && m.channel === 'CASH' && m.type === 'WITHDRAWAL')
        .reduce((s, m) => s + m.amount, 0);

      const zReportData = {
          openingFund: 0, // TODO: Track opening fund separately
          grossSales: sessionTx.reduce((s, t) => s + t.total, 0),
          cashSales,
          cardSales,
          transferSales,
          creditSales,
          expenses: sessionExpenses,
          withdrawals: sessionWithdrawals,
          expectedCash: expected,
          declaredCash: declared,
          difference: difference,
          timestamp: new Date().toISOString()
      };

      const movement: CashMovement = {
          id: crypto.randomUUID(),
          type: 'CLOSE',
          amount: expected, // Reset cash drawer logic usually implies taking money out or verifying it
          description: `Corte de Caja Z #${cashMovements.filter(m=>m.isZCut).length + 1}`,
          date: new Date().toISOString(),
          category: 'OPERATIONAL',
          channel: 'CASH',
          isZCut: true,
          zReportData
      };

      addCashMovement(movement);
      setIsZModalOpen(false);
      setDeclaredCash('');
      notify("Corte Z Realizado", "La caja se ha cerrado.", "success");
      
      // Auto Print
      printZCutTicket(movement, settings, btDevice ? sendBtData : undefined);
  };

  const reprintZReport = (movement: CashMovement) => {
      printZCutTicket(movement, settings, btDevice ? sendBtData : undefined);
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Caja Chica</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Control de flujo de efectivo y cortes.</p>
          </div>
          <div className="flex gap-3">
              <button 
                onClick={() => setIsZModalOpen(true)}
                className="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-all active:scale-95"
              >
                <Printer className="w-5 h-5" /> Corte Z
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" /> Movimiento
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">En Caja (Efectivo)</p>
                    <h3 className={`text-3xl font-black ${currentBalance >= 0 ? 'text-slate-800 dark:text-white' : 'text-red-500'}`}>${currentBalance.toFixed(2)}</h3>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg w-fit">
                    <Wallet className="w-4 h-4"/> Disponible
                </div>
            </div>
            {/* Add more stats if needed */}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Buscar movimiento..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                    {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'EXPENSE', 'CLOSE'].map(t => (
                        <button 
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}`}
                        >
                            {t === 'ALL' ? 'Todos' : t === 'CLOSE' ? 'Cortes Z' : t === 'DEPOSIT' ? 'Ingresos' : 'Egresos'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                        <tr>
                            <th className="px-6 py-4 text-left">Fecha</th>
                            <th className="px-6 py-4 text-left">Tipo</th>
                            <th className="px-6 py-4 text-left">Canal</th>
                            <th className="px-6 py-4 text-left">Categoría</th>
                            <th className="px-6 py-4 text-left">Descripción</th>
                            <th className="px-6 py-4 text-right">Monto</th>
                            <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedMovements.map((movement) => {
                            const isEquity = movement.category === 'EQUITY';
                            const isThirdParty = movement.category === 'THIRD_PARTY';
                            const isLoan = movement.category === 'LOAN';
                            const isExpense = movement.type === 'EXPENSE';
                            
                            return (
                            <tr key={movement.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{new Date(movement.date).toLocaleDateString()} {new Date(movement.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${movement.isZCut ? 'bg-indigo-100 text-indigo-700' : isExpense ? 'bg-red-100 text-red-700' : isLoan ? 'bg-violet-100 text-violet-700' : isThirdParty ? 'bg-orange-100 text-orange-700' : isEquity ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {movement.isZCut ? 'CORTE Z' : isEquity ? 'APORTE' : isLoan ? 'REEMBOLSO' : isThirdParty ? 'LIQ. 3RO' : movement.type === 'DEPOSIT' ? 'INGRESO' : 'RETIRO'}
                                </span>
                                </td>
                                <td className="px-6 py-4">
                                    {movement.channel === 'VIRTUAL' ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100"><CreditCard className="w-3 h-3"/> Virtual</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"><DollarSign className="w-3 h-3"/> Caja</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-500">
                                    {movement.subCategory || (movement.category === 'OPERATIONAL' ? 'General' : movement.category)}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">{movement.description}</td>
                                <td className={`px-6 py-4 text-right font-bold text-sm ${movement.isZCut ? 'text-indigo-600' : (isExpense || movement.type === 'WITHDRAWAL' ? 'text-red-600' : 'text-emerald-600')}`}>
                                    {movement.isZCut ? '---' : `$${movement.amount.toFixed(2)}`}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {movement.isZCut ? (
                                        <button onClick={() => reprintZReport(movement)} className="text-indigo-500 hover:text-indigo-700 transition-colors p-2" title="Reimprimir Reporte"><Printer className="w-4 h-4" /></button>
                                    ) : (
                                        <button onClick={() => setDeleteId(movement.id)} className="text-slate-400 hover:text-red-600 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </td>
                            </tr>
                            );
                        })}
                        {sortedMovements.length === 0 && (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400"><Archive className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No hay movimientos registrados.</p></td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* New Movement Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">Nuevo Movimiento</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                          <button onClick={() => setType('DEPOSIT')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${type === 'DEPOSIT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'}`}>INGRESO</button>
                          <button onClick={() => setType('EXPENSE')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${type === 'EXPENSE' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'}`}>GASTO</button>
                          <button onClick={() => setType('WITHDRAWAL')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${type === 'WITHDRAWAL' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500'}`}>RETIRO</button>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                          <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <input type="number" autoFocus className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
                          <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Descripción breve..." value={description} onChange={e => setDescription(e.target.value)} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                              <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none">
                                  <option value="OPERATIONAL">Operativo</option>
                                  <option value="SALES">Ventas</option>
                                  <option value="EQUITY">Capital</option>
                                  <option value="PROFIT">Ganancia</option>
                                  <option value="THIRD_PARTY">Terceros</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origen</label>
                              <select value={channel} onChange={e => setChannel(e.target.value as any)} className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none">
                                  <option value="CASH">Caja Física</option>
                                  <option value="VIRTUAL">Virtual / Banco</option>
                              </select>
                          </div>
                      </div>

                      <button onClick={handleSave} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg mt-2">Guardar Movimiento</button>
                  </div>
              </div>
          </div>
      )}

      {/* Z Cut Modal */}
      {isZModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-6">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Printer className="w-8 h-8 text-slate-600 dark:text-slate-300"/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Realizar Corte Z</h3>
                      <p className="text-sm text-slate-500 mb-6">Esto cerrará el turno actual y reiniciará la caja.</p>
                      
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 text-left">
                          <p className="text-xs text-slate-500 uppercase font-bold mb-1">Esperado en Sistema</p>
                          <p className="text-2xl font-black text-slate-800 dark:text-white">${currentBalance.toFixed(2)}</p>
                      </div>

                      <div className="text-left mb-6">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Efectivo Declarado (Contado)</label>
                          <input type="number" autoFocus className="w-full px-4 py-3 rounded-xl border-2 border-indigo-100 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 text-lg font-bold" placeholder="0.00" value={declaredCash} onChange={e => setDeclaredCash(e.target.value)} />
                      </div>

                      <div className="flex gap-3">
                          <button onClick={() => setIsZModalOpen(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold">Cancelar</button>
                          <button onClick={handlePerformZCut} className="flex-[1.5] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg">Confirmar Corte</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
          <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center border border-slate-100 dark:border-slate-800">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600"><AlertTriangle className="w-6 h-6"/></div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">¿Eliminar Movimiento?</h3>
                  <p className="text-sm text-slate-500 mb-6">Esta acción afectará el balance de caja y no se puede deshacer.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold">Cancelar</button>
                      <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none">Eliminar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

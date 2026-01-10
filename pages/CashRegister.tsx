import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { CashMovement, BudgetCategory, ZReportData } from '../types';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Archive, Printer, Trash2, Calendar, AlertCircle, CreditCard, Banknote, History, Wallet, Lock, Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { printZCutTicket } from '../utils/printService';

export const CashRegister: React.FC = () => {
  const { cashMovements, addCashMovement, deleteCashMovement, settings, btDevice, sendBtData, notify } = useStore();
  
  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CashMovement['type']>('DEPOSIT');
  const [category, setCategory] = useState<BudgetCategory>('SALES');
  const [subCategory, setSubCategory] = useState('');
  
  // Z-Report State
  const [isZModalOpen, setIsZModalOpen] = useState(false);
  const [declaredCash, setDeclaredCash] = useState('');

  // Calculate Balance since last CLOSE
  const activeMovements = useMemo(() => {
      const sorted = [...cashMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastCloseIndex = sorted.findIndex(m => m.type === 'CLOSE');
      return lastCloseIndex === -1 ? sorted : sorted.slice(0, lastCloseIndex);
  }, [cashMovements]);

  const balance = useMemo(() => {
      return activeMovements.reduce((acc, m) => {
          // Only count CASH movements for the drawer balance
          if (m.channel === 'VIRTUAL') return acc;
          
          if (m.type === 'OPEN' || m.type === 'DEPOSIT') return acc + m.amount;
          if (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') return acc - m.amount;
          return acc;
      }, 0);
  }, [activeMovements]);

  const handleTransaction = (txType: CashMovement['type'], txCategory: BudgetCategory, subCat: string = '') => {
      if (!amount || parseFloat(amount) <= 0) {
          notify("Error", "Ingresa un monto válido", "error");
          return;
      }
      if (!description) {
          notify("Error", "Ingresa una descripción", "error");
          return;
      }

      const movement: CashMovement = {
          id: crypto.randomUUID(),
          type: txType,
          amount: parseFloat(amount),
          description,
          date: new Date().toISOString(),
          category: txCategory,
          subCategory: subCat || subCategory,
          channel: 'CASH' // Default to CASH for manual register movements
      };

      addCashMovement(movement);
      setAmount('');
      setDescription('');
      setSubCategory('');
      notify("Registrado", "Movimiento guardado en caja", "success");
  };

  const handleZCut = () => {
      if (balance < 0) {
          notify("Error", "El balance no puede ser negativo.", "error");
          return;
      }
      setDeclaredCash('');
      setIsZModalOpen(true);
  };

  const confirmZCut = async () => {
      const declared = parseFloat(declaredCash) || 0;
      const systemCash = balance;
      const diff = declared - systemCash;

      const cashSales = activeMovements.filter(m => m.type === 'DEPOSIT' && m.category === 'SALES' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const expenses = activeMovements.filter(m => m.type === 'EXPENSE' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const withdrawals = activeMovements.filter(m => m.type === 'WITHDRAWAL' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const opening = activeMovements.find(m => m.type === 'OPEN')?.amount || 0;

      const zData: ZReportData = {
          openingFund: opening,
          grossSales: cashSales,
          cashSales: cashSales,
          cardSales: 0,
          transferSales: 0,
          creditSales: 0,
          expenses,
          withdrawals,
          expectedCash: systemCash,
          declaredCash: declared,
          difference: diff,
          timestamp: new Date().toISOString()
      };

      const closeMovement: CashMovement = {
          id: crypto.randomUUID(),
          type: 'CLOSE',
          amount: declared,
          description: `Corte Z - ${new Date().toLocaleDateString()}`,
          date: new Date().toISOString(),
          category: 'OPERATIONAL',
          isZCut: true,
          zReportData: zData,
          channel: 'CASH'
      };

      addCashMovement(closeMovement);
      
      if (btDevice) {
          await printZCutTicket(closeMovement, settings, sendBtData);
      } else {
          printZCutTicket(closeMovement, settings);
      }

      setIsZModalOpen(false);
      notify("Corte Realizado", "La caja se ha reiniciado correctamente.", "success");
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Caja Chica</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Control de efectivo diario.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-end">
             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Efectivo en Caja</span>
             <span className="text-3xl font-black text-slate-800 dark:text-white">${balance.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: CONTROLS */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-indigo-500" /> Nuevo Movimiento
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
                            <input 
                                type="text" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                                placeholder="Descripción del movimiento..."
                            />
                        </div>

                        <div className="pt-2 grid grid-cols-1 gap-3">
                             <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handleTransaction('DEPOSIT', 'SALES')} className="flex flex-col items-center justify-center p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors">
                                    <ArrowUpCircle className="w-6 h-6 mb-1"/>
                                    <span className="text-xs font-bold">Ingreso Venta</span>
                                </button>
                                <button onClick={() => handleTransaction('EXPENSE', 'OPERATIONAL')} className="flex flex-col items-center justify-center p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-xl hover:bg-red-100 transition-colors">
                                    <ArrowDownCircle className="w-6 h-6 mb-1"/>
                                    <span className="text-xs font-bold">Gasto Operativo</span>
                                </button>
                             </div>
                             
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mt-2">Otros Movimientos</p>
                             
                             <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleTransaction('WITHDRAWAL', 'PROFIT')} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-500 transition-colors">
                                    Retiro Ganancia
                                </button>
                                <button onClick={() => handleTransaction('WITHDRAWAL', 'OTHER', 'Inversión/Ahorro')} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-500 transition-colors">
                                    Retiro Inversión
                                </button>
                                <button onClick={() => handleTransaction('DEPOSIT', 'EQUITY')} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                                    Ingreso Capital
                                </button>
                                <button onClick={() => handleTransaction('WITHDRAWAL', 'THIRD_PARTY')} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-orange-500 hover:text-orange-500 transition-colors">
                                    Pago Tercero
                                </button>
                             </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleZCut}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                    <Lock className="w-5 h-5"/> Realizar Corte Z (Cierre)
                </button>
            </div>

            {/* RIGHT: HISTORY LIST */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-[600px] lg:h-auto">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" /> Historial (Sesión Actual)
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 text-left">Hora</th>
                                <th className="px-6 py-3 text-left">Descripción</th>
                                <th className="px-6 py-3 text-right">Monto</th>
                                <th className="px-4 py-3 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activeMovements.map(m => {
                                const isPositive = m.type === 'OPEN' || m.type === 'DEPOSIT';
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 text-slate-500 font-mono text-xs whitespace-nowrap">
                                            {new Date(m.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-700 dark:text-slate-200">{m.description}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {m.category === 'OTHER' && m.subCategory ? m.subCategory : m.category}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-bold text-base ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isPositive ? '+' : '-'}${m.amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button onClick={() => deleteCashMovement(m.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeMovements.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-slate-400">
                                        <Coins className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No hay movimientos en esta sesión.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* Z CUT MODAL */}
      {isZModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-center">
                      <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-slate-200 dark:shadow-none">
                          <Lock className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Corte de Caja Z</h3>
                      <p className="text-sm text-slate-500">Cuenta el dinero físico y confirma.</p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-900">
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Sistema Espera</p>
                          <p className="text-3xl font-black text-slate-800 dark:text-white">${balance.toFixed(2)}</p>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 text-center">Efectivo Real (Contado)</label>
                          <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  autoFocus
                                  value={declaredCash}
                                  onChange={(e) => setDeclaredCash(e.target.value)}
                                  className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-indigo-100 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-bold text-xl outline-none focus:border-indigo-500 dark:text-white transition-all"
                                  placeholder="0.00"
                              />
                          </div>
                      </div>

                      {declaredCash && (
                          <div className={`text-center text-sm font-bold p-2 rounded-lg ${Math.abs(parseFloat(declaredCash) - balance) < 0.5 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              Diferencia: ${(parseFloat(declaredCash) - balance).toFixed(2)}
                          </div>
                      )}

                      <div className="flex gap-3 pt-2">
                          <button onClick={() => setIsZModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                          <button onClick={confirmZCut} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors">Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

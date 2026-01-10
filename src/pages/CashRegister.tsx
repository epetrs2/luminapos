import React, { useState, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { CashMovement, BudgetCategory, ZReportData } from '../types';
import { DollarSign, ArrowUpCircle, ArrowDownCircle, Archive, Printer, Trash2, Calendar, AlertCircle, CreditCard, Banknote, History, Wallet, Lock, Coins } from 'lucide-react';
import { printZCutTicket } from '../utils/printService';

export const CashRegister: React.FC = () => {
  const { cashMovements, addCashMovement, deleteCashMovement, settings, btDevice, sendBtData, notify, currentUser } = useStore();
  
  // Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CashMovement['type']>('DEPOSIT');
  const [category, setCategory] = useState<BudgetCategory>('SALES');
  const [subCategory, setSubCategory] = useState('');
  const [channel, setChannel] = useState<'CASH' | 'VIRTUAL'>('CASH');

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
          // Calculate Cash Balance (Main Drawer)
          if (m.channel === 'VIRTUAL') return acc;
          
          if (m.type === 'OPEN' || m.type === 'DEPOSIT') return acc + m.amount;
          if (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') return acc - m.amount;
          return acc;
      }, 0);
  }, [activeMovements]);

  const virtualBalance = useMemo(() => {
      return activeMovements.reduce((acc, m) => {
          if (m.channel !== 'VIRTUAL') return acc;
          if (m.type === 'DEPOSIT') return acc + m.amount;
          if (m.type === 'EXPENSE' || m.type === 'WITHDRAWAL') return acc - m.amount;
          return acc;
      }, 0);
  }, [activeMovements]);

  const handleTypeChange = (newType: CashMovement['type'], newCategory: BudgetCategory) => {
      setType(newType);
      setCategory(newCategory);
      setSubCategory(''); // Reset subcategory
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!amount || parseFloat(amount) <= 0) {
          notify("Error", "Monto inválido", "error");
          return;
      }
      if (!description) {
          notify("Error", "Agrega una descripción", "error");
          return;
      }

      const movement: CashMovement = {
          id: crypto.randomUUID(),
          type,
          amount: parseFloat(amount),
          description,
          date: new Date().toISOString(),
          category,
          subCategory,
          channel
      };

      addCashMovement(movement);
      setAmount('');
      setDescription('');
      notify("Registrado", "Movimiento guardado exitosamente", "success");
  };

  const handleZCut = () => {
      if (balance < 0) {
          notify("Error", "El balance de efectivo es negativo, revisa los movimientos.", "error");
          return;
      }
      setDeclaredCash('');
      setIsZModalOpen(true);
  };

  const confirmZCut = async () => {
      const declared = parseFloat(declaredCash) || 0;
      const systemCash = balance;
      const diff = declared - systemCash;

      // Calculate totals for report
      const cashSales = activeMovements.filter(m => m.type === 'DEPOSIT' && m.category === 'SALES' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const expenses = activeMovements.filter(m => m.type === 'EXPENSE' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const withdrawals = activeMovements.filter(m => m.type === 'WITHDRAWAL' && m.channel !== 'VIRTUAL').reduce((sum, m) => sum + m.amount, 0);
      const opening = activeMovements.find(m => m.type === 'OPEN')?.amount || 0;

      const zData: ZReportData = {
          openingFund: opening,
          grossSales: cashSales, // Cash Sales In
          cashSales: cashSales,
          cardSales: 0, // Not tracked here directly, would require Transaction integration
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
      
      // Print Ticket
      if (btDevice) {
          await printZCutTicket(closeMovement, settings, sendBtData);
      } else {
          printZCutTicket(closeMovement, settings);
      }

      setIsZModalOpen(false);
      notify("Corte Z", "Caja cerrada correctamente. Se ha reiniciado el balance.", "success");
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Caja Chica</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Control de flujo de efectivo y gastos.</p>
          </div>
          <div className="flex gap-3">
             <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-end">
                 <span className="text-[10px] font-bold text-slate-400 uppercase">En Caja (Efectivo)</span>
                 <span className="text-xl font-black text-slate-800 dark:text-white">${balance.toFixed(2)}</span>
             </div>
             <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col items-end">
                 <span className="text-[10px] font-bold text-indigo-400 uppercase">Virtual (Bancos)</span>
                 <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">${virtualBalance.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: FORM */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-indigo-500" /> Nuevo Movimiento
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        
                        {/* Channel Selector */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button type="button" onClick={() => setChannel('CASH')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${channel === 'CASH' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                💵 Efectivo
                            </button>
                            <button type="button" onClick={() => setChannel('VIRTUAL')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${channel === 'VIRTUAL' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                                💳 Virtual / Banco
                            </button>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción</label>
                            <input 
                                type="text" 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Ej. Compra de insumos, Pago de luz..."
                            />
                        </div>

                        {/* Type Grid */}
                        <div className="grid grid-cols-2 gap-2">
                             {/* BASIC INCOME */}
                             <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'SALES')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'SALES' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Ingreso Venta</button>
                             {/* BASIC EXPENSE */}
                             <button type="button" onClick={() => handleTypeChange('EXPENSE', 'OPERATIONAL')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'EXPENSE' ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Gasto Op.</button>
                             {/* OWNER EQUITY */}
                             <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'EQUITY')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'EQUITY' ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Aporte Dueño</button>
                             {/* PROFIT WITHDRAWAL */}
                             <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'PROFIT')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'PROFIT' ? 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Retiro Ganancia</button>
                             {/* INVESTMENT WITHDRAWAL */}
                             <button type="button" onClick={() => { handleTypeChange('WITHDRAWAL', 'OTHER'); setSubCategory('Inversión/Ahorro'); }} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'OTHER' && subCategory === 'Inversión/Ahorro' ? 'bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Retiro Inversión</button>
                             {/* REEMBOLSO */}
                             <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'LOAN')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'LOAN' ? 'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Reembolso Dueño</button>
                             {/* THIRD PARTY PAYOUT */}
                             <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'THIRD_PARTY')} className={`col-span-2 py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'THIRD_PARTY' ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-300'}`}>Liq. Tercero</button>
                        </div>

                        {/* Optional Subcategory Input if needed */}
                        {(type === 'EXPENSE' || (type === 'WITHDRAWAL' && category !== 'THIRD_PARTY')) && (
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalle / Subcategoría</label>
                                <input 
                                    type="text" 
                                    value={subCategory} 
                                    onChange={e => setSubCategory(e.target.value)} 
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none text-xs"
                                    placeholder="Ej. Luz, Agua, Comida..."
                                />
                            </div>
                        )}

                        <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95">
                            Registrar Movimiento
                        </button>
                    </form>
                </div>

                <div className="bg-slate-800 dark:bg-slate-900 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10"><Archive className="w-24 h-24" /></div>
                    <h4 className="font-bold text-lg mb-2 relative z-10">Cierre de Caja</h4>
                    <p className="text-sm text-slate-300 mb-6 relative z-10">Realiza el corte del día para cuadrar efectivo y reiniciar el contador.</p>
                    <button 
                        onClick={handleZCut}
                        className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors relative z-10 flex items-center justify-center gap-2"
                    >
                        <Lock className="w-4 h-4"/> Realizar Corte Z
                    </button>
                </div>
            </div>

            {/* RIGHT: HISTORY */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-[600px] lg:h-auto">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-slate-400" /> Historial de Movimientos
                    </h3>
                    <div className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                        Sesión Actual
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-left">Hora</th>
                                <th className="px-4 py-3 text-left">Descripción</th>
                                <th className="px-4 py-3 text-center">Tipo</th>
                                <th className="px-4 py-3 text-right">Monto</th>
                                <th className="px-4 py-3 text-center">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {activeMovements.map(m => {
                                const isPositive = m.type === 'OPEN' || m.type === 'DEPOSIT';
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                                            {new Date(m.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{m.description}</p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                                {m.channel === 'VIRTUAL' ? <CreditCard className="w-3 h-3"/> : <Banknote className="w-3 h-3"/>}
                                                {m.category} {m.subCategory && `• ${m.subCategory}`}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${isPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {m.type}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isPositive ? '+' : '-'}${m.amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => deleteCashMovement(m.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeMovements.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400">
                                        <Coins className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Caja recién abierta o sin movimientos.</p>
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
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-center">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Corte de Caja Z</h3>
                      <p className="text-sm text-slate-500">Verificación de efectivo físico.</p>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-center border border-blue-100 dark:border-blue-900">
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Esperado en Caja (Sistema)</p>
                          <p className="text-3xl font-black text-slate-800 dark:text-white">${balance.toFixed(2)}</p>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 text-center">¿Cuánto efectivo hay físicamente?</label>
                          <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  autoFocus
                                  value={declaredCash}
                                  onChange={(e) => setDeclaredCash(e.target.value)}
                                  className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-indigo-100 dark:border-slate-700 bg-white dark:bg-slate-950 text-center font-bold text-xl outline-none focus:border-indigo-500 dark:text-white"
                                  placeholder="0.00"
                              />
                          </div>
                      </div>

                      {declaredCash && (
                          <div className={`text-center text-sm font-bold ${Math.abs(parseFloat(declaredCash) - balance) < 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                              Diferencia: ${(parseFloat(declaredCash) - balance).toFixed(2)}
                          </div>
                      )}

                      <div className="flex gap-3 pt-2">
                          <button onClick={() => setIsZModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                          <button onClick={confirmZCut} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors">Confirmar Corte</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Mail, Phone, DollarSign, Wallet, Infinity, Building2, User, Clock, FileText, ArrowRight, X, Hash, ShoppingBag, CheckCircle, ChevronRight, Filter, ArrowDownAZ, ArrowUpNarrowWide, AlertCircle, Package, Calendar, TrendingUp } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Customer } from '../types';
import { roundCurrency, getCartItemKey } from '../utils/financeHelpers';

export const Customers: React.FC = () => {
  const { customers, transactions, cashMovements, orders, settings, currentUser, addCustomer, updateCustomer, deleteCustomer, processCustomerPayment, resetCustomerCredit, toggleTransactionExcludeFromReports } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtering & Sorting State
  const [filterType, setFilterType] = useState<'ALL' | 'INDIVIDUAL' | 'BUSINESS' | 'DEBTORS'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'DEBT'>('NAME');

  // Debt Payment Modal (derived by ID to avoid stale state)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payCustomerId, setPayCustomerId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payChannel, setPayChannel] = useState<'CASH' | 'VIRTUAL'>('CASH');
  const payCustomer = useMemo(() => customers.find(c => c.id === payCustomerId) || null, [customers, payCustomerId]);

  // Selective Credit Reconciliation Modal
  const [isCreditResetOpen, setIsCreditResetOpen] = useState(false);
  const [creditResetAmount, setCreditResetAmount] = useState<string>('');
  const [creditResetReason, setCreditResetReason] = useState<string>('Cuadre / corte inicial de cuentas');

  // History Modal (derived by ID so debt & tickets refresh immediately after payment)
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'TIMELINE' | 'ORDERS' | 'PRODUCTS'>('TIMELINE');
  const historyCustomer = useMemo(() => customers.find(c => c.id === historyCustomerId) || null, [customers, historyCustomerId]);
  const isManagerOrAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  // Counts for tabs
  const counts = useMemo(() => {
      return {
          all: customers.length,
          individual: customers.filter(c => c.clientType !== 'BUSINESS').length,
          business: customers.filter(c => c.clientType === 'BUSINESS').length,
          debtors: customers.filter(c => (c.currentDebt || 0) > 0.01).length
      };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
      const q = searchTerm.trim().toLowerCase();
      let result = customers.filter(c => 
        !q ||
        c.name.toLowerCase().includes(q) || 
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );

      if (filterType === 'INDIVIDUAL') {
          result = result.filter(c => c.clientType !== 'BUSINESS');
      } else if (filterType === 'BUSINESS') {
          result = result.filter(c => c.clientType === 'BUSINESS');
      } else if (filterType === 'DEBTORS') {
          result = result.filter(c => (c.currentDebt || 0) > 0.01);
      }

      result.sort((a, b) => {
          if (sortBy === 'DEBT') {
              return (b.currentDebt || 0) - (a.currentDebt || 0);
          }
          return a.name.localeCompare(b.name);
      });

      return result;
  }, [customers, searchTerm, filterType, sortBy]);

  // --- Calculate Product Consumption Stats (excludes cancelled & returned, respects variants) ---
  const customerProductStats = useMemo(() => {
      if (!historyCustomer) return { products: [], totalSpent: 0, monthlySpent: 0 };

      const stats: Record<string, { id: string, name: string, qty: number, total: number, lastDate: string, category: string }> = {};
      let totalSpent = 0;
      let monthlySpent = 0;
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      transactions
          .filter(t => t.customerId === historyCustomer.id && t.status !== 'cancelled' && t.status !== 'returned')
          .forEach(t => {
              const tDate = new Date(t.date);
              const isThisMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
              
              if (isThisMonth) monthlySpent = roundCurrency(monthlySpent + t.total);
              totalSpent = roundCurrency(totalSpent + t.total);

              t.items.forEach(i => {
                  const key = getCartItemKey(i);
                  if (!stats[key]) {
                      stats[key] = { 
                          id: key, 
                          name: i.variantName ? `${i.name} (${i.variantName})` : i.name, 
                          qty: 0, 
                          total: 0, 
                          lastDate: t.date,
                          category: i.category 
                      };
                  }
                  stats[key].qty += i.quantity;
                  stats[key].total = roundCurrency(stats[key].total + (i.price * i.quantity));
                  if (new Date(t.date) > new Date(stats[key].lastDate)) {
                      stats[key].lastDate = t.date;
                  }
              });
          });

      return {
          products: Object.values(stats).sort((a, b) => b.qty - a.qty),
          totalSpent,
          monthlySpent
      };
  }, [historyCustomer, transactions]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', email: '', phone: '', address: '', notes: '', creditLimit: 0, currentDebt: 0, hasUnlimitedCredit: false, clientType: 'INDIVIDUAL' });
    }
    setIsModalOpen(true);
  };

  const handleOpenPayModal = (customer: Customer) => {
      setPayCustomerId(customer.id);
      setPayAmount('');
      setPayChannel('CASH');
      setIsPayModalOpen(true);
  };

  const handleOpenHistory = (customer: Customer) => {
      setHistoryCustomerId(customer.id);
      setHistoryTab('TIMELINE');
  };

  const handleSendReminder = (customer: Customer) => {
      if (!customer.email) {
          alert('Este cliente no tiene un correo electrónico registrado.');
          return;
      }

      const businessName = settings.name || 'LuminaPOS';
      const subject = `Recordatorio de Pago - ${businessName}`;
      const body = `Estimado/a ${customer.name},
      
Le saludamos cordialmente de ${businessName}.
      
Este es un recordatorio amigable sobre su saldo pendiente de $${(customer.currentDebt || 0).toFixed(2)}.
      
Le agradeceríamos que regularice su situación lo antes posible.
      
Atentamente,
El equipo de ${businessName}`;

      window.open(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleSave = () => {
    if (!formData.name || !formData.name.trim()) {
      alert('El nombre del cliente es obligatorio.');
      return;
    }
    const cleanLimit = Number.isFinite(formData.creditLimit) && (formData.creditLimit || 0) >= 0 ? roundCurrency(formData.creditLimit || 0) : 0;
    const cleanedData = { ...formData, name: formData.name.trim(), creditLimit: cleanLimit };

    if (editingCustomer) {
      updateCustomer({ ...editingCustomer, ...cleanedData } as Customer);
    } else {
      addCustomer({ ...cleanedData, id: '', currentDebt: 0 } as Customer);
    }
    setIsModalOpen(false);
  };

  const handleProcessPayment = () => {
      if (payCustomer && payAmount) {
          const amount = roundCurrency(parseFloat(payAmount));
          if (!Number.isFinite(amount) || amount <= 0 || amount > roundCurrency((payCustomer.currentDebt || 0) + 0.01)) {
              alert("Monto inválido. Debe ser mayor a 0 y no mayor a la deuda.");
              return;
          }
          const cappedAmount = Math.min(amount, roundCurrency(payCustomer.currentDebt || 0));
          processCustomerPayment(payCustomer.id, cappedAmount, payChannel);
          setIsPayModalOpen(false);
      }
  };

  return (
    <div className="p-4 md:p-8 md:pl-72 pt-20 md:pt-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Clientes</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Base de datos y cuentas por cobrar</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {(() => {
              const totalPortfolio = roundCurrency(customers.reduce((s, c) => s + (c.currentDebt || 0), 0));
              return totalPortfolio > 0 ? (
                <button
                  onClick={() => setFilterType('DEBTORS')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-100 transition-colors"
                  title="Ver clientes con deuda pendiente"
                >
                  <AlertCircle className="w-4 h-4" />
                  Por Cobrar: ${totalPortfolio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </button>
              ) : null;
            })()}
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex-1 md:flex-none justify-center active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nuevo Cliente
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
            {/* Filter Tabs */}
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto w-full lg:w-auto custom-scrollbar">
                <button onClick={() => setFilterType('ALL')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'ALL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Todos <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.all}</span>
                </button>
                <button onClick={() => setFilterType('INDIVIDUAL')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'INDIVIDUAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <User className="w-3 h-3"/> Particulares <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.individual}</span>
                </button>
                <button onClick={() => setFilterType('BUSINESS')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'BUSINESS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Building2 className="w-3 h-3"/> Empresas <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.business}</span>
                </button>
                <button onClick={() => setFilterType('DEBTORS')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'DEBTORS' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 hover:text-red-500 dark:hover:text-red-400'}`}>
                    <AlertCircle className="w-3 h-3"/> Con Deuda <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md text-[10px]">{counts.debtors}</span>
                </button>
            </div>

            <div className="flex gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
                    />
                </div>
                <button 
                    onClick={() => setSortBy(prev => prev === 'NAME' ? 'DEBT' : 'NAME')}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                    title={sortBy === 'NAME' ? 'Ordenar por Deuda' : 'Ordenar Alfabéticamente'}
                >
                    {sortBy === 'NAME' ? <ArrowDownAZ className="w-4 h-4"/> : <ArrowUpNarrowWide className="w-4 h-4 text-red-500"/>}
                    <span className="hidden md:inline">{sortBy === 'NAME' ? 'Alfabético' : 'Mayor Deuda'}</span>
                </button>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map(customer => (
                  <div key={customer.id} onClick={() => handleOpenHistory(customer)} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${customer.clientType === 'BUSINESS' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                  {customer.clientType === 'BUSINESS' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1">{customer.name}</h3>
                                  <p className="text-xs text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3"/> {customer.id}</p>
                              </div>
                          </div>
                          {customer.currentDebt > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                  -${customer.currentDebt.toFixed(2)}
                              </span>
                          )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3 pl-[52px]">
                          {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {customer.phone}</span>}
                          {customer.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3"/> {customer.email}</span>}
                      </div>

                      <div className="flex justify-end gap-2 pl-[52px]" onClick={e => e.stopPropagation()}>
                          {customer.currentDebt > 0 && (
                              <button onClick={() => handleOpenPayModal(customer)} className="flex-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                  <DollarSign className="w-3.5 h-3.5"/> Abonar
                              </button>
                          )}
                          <button onClick={() => handleOpenModal(customer)} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-lg">
                              <Edit2 className="w-4 h-4"/>
                          </button>
                          <button onClick={() => deleteCustomer(customer.id)} className="bg-slate-100 dark:bg-slate-800 text-red-500 p-2 rounded-lg">
                              <Trash2 className="w-4 h-4"/>
                          </button>
                      </div>
                  </div>
              ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left">Clave</th>
                  <th className="px-6 py-4 text-left">Nombre</th>
                  <th className="px-6 py-4 text-left">Contacto</th>
                  <th className="px-6 py-4 text-right">Crédito Disp.</th>
                  <th className="px-6 py-4 text-right">Deuda</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group" onClick={() => handleOpenHistory(customer)}>
                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3" /> {customer.id}
                        </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-sm ${customer.clientType === 'BUSINESS' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                {customer.clientType === 'BUSINESS' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{customer.name}</p>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{customer.clientType === 'BUSINESS' ? 'Tienda' : 'Particular'}</span>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-xs">
                            {customer.email && (
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Mail className="w-3 h-3" /> {customer.email}
                                </div>
                            )}
                            {customer.phone && (
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Phone className="w-3 h-3" /> {customer.phone}
                                </div>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        {customer.hasUnlimitedCredit ? (
                            <div className="flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                <Infinity className="w-4 h-4" /> Ilimitado
                            </div>
                        ) : (
                            <>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                    ${(customer.creditLimit - customer.currentDebt).toFixed(2)}
                                </span>
                                <p className="text-[10px] text-slate-400">Límite: ${customer.creditLimit.toFixed(2)}</p>
                            </>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        {customer.currentDebt > 0.01 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                -${customer.currentDebt.toFixed(2)}
                            </span>
                        ) : (
                             <span className="text-xs text-slate-400 flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3"/> Al día</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                         {customer.currentDebt > 0 && (
                             <>
                                 <button 
                                    onClick={() => handleSendReminder(customer)}
                                    title="Enviar Recordatorio de Pago"
                                    className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                                 >
                                     <Mail className="w-4 h-4" />
                                 </button>
                                 <button 
                                    onClick={() => handleOpenPayModal(customer)}
                                    title="Registrar Abono"
                                    className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
                                 >
                                     <DollarSign className="w-4 h-4" />
                                 </button>
                             </>
                         )}
                        <button onClick={() => handleOpenModal(customer)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCustomer(customer.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredCustomers.length === 0 && (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se encontraron clientes con este filtro.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit/Create Modal - Responsive */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full md:hidden">
                    <X className="w-5 h-5"/>
                </button>
            </div>
            
            <div className="space-y-4">
              {/* Type Selection */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, clientType: 'INDIVIDUAL'})}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${formData.clientType === 'INDIVIDUAL' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                      <User className="w-6 h-6 mb-2" />
                      <span className="font-bold text-sm">Particular</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, clientType: 'BUSINESS'})}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${formData.clientType === 'BUSINESS' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                      <Building2 className="w-6 h-6 mb-2" />
                      <span className="font-bold text-sm">Tienda / Empresa</span>
                  </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo / Razón Social *</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Configuración de Crédito</label>
                      <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            id="unlimited"
                            checked={formData.hasUnlimitedCredit || false}
                            onChange={(e) => setFormData({...formData, hasUnlimitedCredit: e.target.checked})}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                          />
                          <label htmlFor="unlimited" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">Crédito Ilimitado</label>
                      </div>
                  </div>
                  
                  {!formData.hasUnlimitedCredit && (
                      <div className="animate-[fadeIn_0.2s]">
                        <input
                            type="number"
                            min="0"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                            value={formData.creditLimit || 0}
                            onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-slate-400 mt-1">Monto máximo que el cliente puede deber.</p>
                      </div>
                  )}
                  {formData.hasUnlimitedCredit && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 italic">
                          El cliente podrá comprar a crédito sin restricciones.
                      </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsModalOpen(false)}
                className="hidden md:block px-6 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Guardar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Payment Modal - Responsive */}
      {isPayModalOpen && payCustomer && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-[slideUp_0.3s_ease-out] border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                    <Wallet className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Abonar a Deuda</h3>
                <p className="text-slate-500 mb-6 text-sm">Registrar pago del cliente <strong>{payCustomer.name}</strong></p>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-6 text-left">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Deuda Actual:</span>
                        <span className="font-bold text-red-500">${payCustomer.currentDebt.toFixed(2)}</span>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Canal de Pago</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button type="button" onClick={() => setPayChannel('CASH')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${payChannel === 'CASH' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500'}`}>Efectivo (Caja)</button>
                        <button type="button" onClick={() => setPayChannel('VIRTUAL')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${payChannel === 'VIRTUAL' ? 'bg-blue-600 text-white shadow' : 'text-slate-500'}`}>Banco / Transf.</button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Monto del Abono</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            autoFocus
                            max={payCustomer.currentDebt}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsPayModalOpen(false)}
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleProcessPayment}
                        className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* History Modal - "Expediente del Cliente" */}
      {historyCustomer && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
              <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-4xl h-[95vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                      <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${historyCustomer.clientType === 'BUSINESS' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                              {historyCustomer.clientType === 'BUSINESS' ? <Building2 className="w-7 h-7" /> : <User className="w-7 h-7" />}
                          </div>
                          <div>
                              <h2 className="text-2xl font-bold text-slate-800 dark:text-white line-clamp-1">{historyCustomer.name}</h2>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                  <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 rounded text-xs">ID: {historyCustomer.id}</span>
                                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-medium">
                                      {historyCustomer.clientType === 'BUSINESS' ? 'Tienda / Empresa' : 'Particular'}
                                  </span>
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setHistoryCustomerId(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="p-4 md:p-6 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda</p>
                          <p className={`text-2xl md:text-3xl font-black ${historyCustomer.currentDebt > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                              ${historyCustomer.currentDebt.toFixed(2)}
                          </p>
                      </div>
                      <div className="p-4 md:p-6 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Disponible</p>
                          <p className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                              {historyCustomer.hasUnlimitedCredit ? <Infinity className="w-8 h-8 mx-auto" /> : `$${(historyCustomer.creditLimit - historyCustomer.currentDebt).toFixed(2)}`}
                          </p>
                      </div>
                      <div className="p-4 md:p-6 flex flex-wrap items-center justify-center gap-2 col-span-2 md:col-span-1 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                          {historyCustomer.currentDebt > 0 ? (
                              <button 
                                onClick={() => handleOpenPayModal(historyCustomer)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-2 transition-all"
                              >
                                  <DollarSign className="w-4 h-4" />
                                  Abonar
                              </button>
                          ) : (
                              <div className="flex items-center gap-2 text-emerald-500 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl text-sm">
                                  <CheckCircle className="w-4 h-4" /> Al Corriente
                              </div>
                          )}
                          {isManagerOrAdmin && (
                              <button
                                  onClick={() => {
                                      setCreditResetAmount(String(historyCustomer.currentDebt || 0));
                                      setCreditResetReason('Cuadre / corte inicial de cuentas');
                                      setIsCreditResetOpen(true);
                                  }}
                                  className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                                  title="Reiniciar o ajustar selectivamente el historial crediticio sin afectar caja física"
                              >
                                  Cuadrar Crédito
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <button 
                        onClick={() => setHistoryTab('TIMELINE')}
                        className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${historyTab === 'TIMELINE' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                          <Clock className="w-4 h-4" /> Historial Crediticio
                      </button>
                      <button 
                        onClick={() => setHistoryTab('ORDERS')}
                        className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${historyTab === 'ORDERS' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                          <ShoppingBag className="w-4 h-4" /> Pedidos ({orders.filter(o => o.customerId === historyCustomer.id).length})
                      </button>
                      <button 
                        onClick={() => setHistoryTab('PRODUCTS')}
                        className={`flex-1 py-3 text-xs md:text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${historyTab === 'PRODUCTS' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                          <Package className="w-4 h-4" /> Productos
                      </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-6">
                      
                      {historyTab === 'TIMELINE' && (
                          (() => {
                              const customerTransactions = transactions
                                  .filter(t => t.customerId === historyCustomer.id && t.status !== 'cancelled' && t.status !== 'returned')
                                  .map(t => {
                                      const pendingAmount = roundCurrency(Math.max(0, t.total - (t.amountPaid || 0)));
                                      const isDebt = (t.paymentStatus === 'pending' || t.paymentStatus === 'partial') && pendingAmount > 0.01;
                                      const isManual = t.id.includes('manual');
                                      
                                      return {
                                          id: t.id,
                                          date: t.date,
                                          type: isDebt ? 'DEBT' : 'SALE',
                                          amount: t.total,
                                          pendingAmount,
                                          details: `${isManual ? 'Nota' : 'Ticket'} #${t.id} • ${t.items.length} items`,
                                          raw: t
                                      };
                                  });

                              // Only include actual debt payments (never duplicate cash sales!)
                              const payments = cashMovements
                                  .filter(m =>
                                      m.customerId === historyCustomer.id &&
                                      m.type === 'DEPOSIT' &&
                                      (m.subCategory === 'DEBT_PAYMENT' || (m.subCategory !== 'SALE' && (m.description || '').toLowerCase().includes('abono')))
                                  )
                                  .map(m => ({
                                      id: m.id,
                                      date: m.date,
                                      type: 'PAYMENT',
                                      amount: m.amount,
                                      details: m.description,
                                      raw: m
                                  }));

                              const timeline = [...customerTransactions, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                              if (timeline.length === 0) {
                                  return (
                                      <div className="text-center py-12 text-slate-400">
                                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                          <p>No hay historial de movimientos.</p>
                                      </div>
                                  );
                              }

                              return (
                                  <div className="space-y-3">
                                      {timeline.map((item) => {
                                          const isDebt = item.type === 'DEBT';
                                          const isPayment = item.type === 'PAYMENT';
                                          
                                          let icon = <ShoppingBag className="w-5 h-5" />;
                                          let bgColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                                          let title = 'Compra Contado';
                                          let amountColor = 'text-slate-800 dark:text-white';
                                          let sign = '';

                                          if (isDebt) {
                                              bgColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                                              title = 'Nota Pendiente';
                                              amountColor = 'text-red-500';
                                              sign = '+'; 
                                          } else if (isPayment) {
                                              icon = <DollarSign className="w-5 h-5" />;
                                              bgColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
                                              title = 'Abono / Pago';
                                              amountColor = 'text-emerald-500';
                                              sign = '-'; 
                                          }

                                          return (
                                              <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-[fadeIn_0.2s]">
                                                  <div className="flex items-start gap-3">
                                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
                                                          {icon}
                                                      </div>
                                                      <div>
                                                          <p className="font-bold text-slate-800 dark:text-white text-sm">{title}</p>
                                                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.details}</p>
                                                          <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.date).toLocaleString()}</p>
                                                      </div>
                                                  </div>
                                                  <div className="flex justify-between items-center md:block text-right pl-14 md:pl-0">
                                                      <span className="md:hidden text-xs font-bold text-slate-400">Monto:</span>
                                                      <div>
                                                        <p className={`text-base font-black ${amountColor}`}>
                                                            {sign}${item.amount.toFixed(2)}
                                                        </p>
                                                        {isDebt && (item as any).pendingAmount > 0 && (
                                                            <span className="text-[10px] font-bold text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                                                Debiendo: ${(item as any).pendingAmount.toFixed(2)}
                                                            </span>
                                                        )}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              );
                          })()
                      )}

                      {historyTab === 'ORDERS' && (
                          (() => {
                              const customerOrders = orders
                                  .filter(o => o.customerId === historyCustomer.id)
                                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                              if (customerOrders.length === 0) {
                                  return (
                                      <div className="text-center py-12 text-slate-400">
                                          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                          <p>Este cliente aún no tiene pedidos registrados.</p>
                                      </div>
                                  );
                              }

                              return (
                                  <div className="space-y-3">
                                      {customerOrders.map(ord => (
                                          <div key={ord.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                              <div>
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">#{ord.id}</span>
                                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ord.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : ord.status === 'READY' ? 'bg-blue-100 text-blue-700' : ord.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                          {ord.status === 'COMPLETED' ? 'Entregado' : ord.status === 'READY' ? 'Listo' : ord.status === 'IN_PROGRESS' ? 'En Producción' : 'Pendiente'}
                                                      </span>
                                                  </div>
                                                  <p className="text-xs text-slate-500 mt-1">
                                                      Creado: {new Date(ord.date).toLocaleDateString('es-MX')} {ord.deliveryDate ? `• Entrega: ${ord.deliveryDate}` : ''}
                                                  </p>
                                                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                                      {ord.items.map(i => `${i.quantity}x ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ')}
                                                  </p>
                                              </div>
                                              <div className="text-right">
                                                  <p className="font-black text-slate-800 dark:text-white">${ord.total.toFixed(2)}</p>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              );
                          })()
                      )}

                      {historyTab === 'PRODUCTS' && (
                          <div className="space-y-6">
                              {/* Stats Summary */}
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Total Histórico</p>
                                      <p className="text-2xl font-black text-slate-800 dark:text-white">${customerProductStats.totalSpent.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                      <p className="text-xs font-bold text-slate-500 uppercase mb-1">Consumo Este Mes</p>
                                      <p className="text-2xl font-black text-slate-800 dark:text-white">${customerProductStats.monthlySpent.toFixed(2)}</p>
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  {customerProductStats.products.length > 0 ? (
                                      customerProductStats.products.map((p, idx) => {
                                          const maxQty = customerProductStats.products[0]?.qty || 1;
                                          const percent = maxQty > 0 ? Math.min(100, (p.qty / maxQty) * 100) : 0;
                                          
                                          return (
                                              <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm animate-[slideInRight_0.3s_ease-out]" style={{animationDelay: `${idx * 0.05}s`}}>
                                                  <div className="flex justify-between items-start mb-2">
                                                      <div>
                                                          <p className="font-bold text-sm text-slate-800 dark:text-white">{p.name}</p>
                                                          <p className="text-[10px] text-slate-400 font-bold uppercase">{p.category}</p>
                                                      </div>
                                                      <div className="text-right">
                                                          <p className="font-black text-sm text-indigo-600 dark:text-indigo-400">${p.total.toFixed(2)}</p>
                                                          <p className="text-[10px] text-slate-400">Total gastado</p>
                                                      </div>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-3">
                                                      <div className="flex-1 bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                          <div className="h-full bg-indigo-500 rounded-full" style={{width: `${percent}%`}}></div>
                                                      </div>
                                                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 min-w-[60px] text-right">{p.qty} un.</span>
                                                  </div>
                                                  
                                                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-[10px] text-slate-400">
                                                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> Última compra:</span>
                                                      <span>{new Date(p.lastDate).toLocaleDateString()}</span>
                                                  </div>
                                              </div>
                                          );
                                      })
                                  ) : (
                                      <div className="text-center py-12 text-slate-400">
                                          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                          <p>El cliente aún no ha comprado productos.</p>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      {/* Selective Credit Reset / Reconciliation Modal */}
      {isCreditResetOpen && historyCustomer && (
          <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 p-6">
                  <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Cuadre Selectivo de Crédito</h3>
                      <button onClick={() => setIsCreditResetOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Ajusta o reinicia la deuda de <strong>{historyCustomer.name}</strong> sin mover dinero de tu caja física. Ideal para cuadrar cuentas viejas.
                  </p>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo (Bitácora)</label>
                          <input
                              type="text"
                              value={creditResetReason}
                              onChange={e => setCreditResetReason(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Fijar Saldo Exacto ($)</label>
                          <div className="flex gap-2">
                              <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={creditResetAmount}
                                  onChange={e => setCreditResetAmount(e.target.value)}
                                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <button
                                  onClick={() => {
                                      resetCustomerCredit(historyCustomer.id, {
                                          mode: 'SET_AMOUNT',
                                          targetAmount: parseFloat(creditResetAmount) || 0,
                                          reason: creditResetReason,
                                      });
                                      setIsCreditResetOpen(false);
                                  }}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                              >
                                  Aplicar Saldo
                              </button>
                          </div>
                      </div>

                      {/* Selective Pending Tickets List */}
                      {transactions.some(t => t.customerId === historyCustomer.id && t.status !== 'cancelled' && t.status !== 'returned' && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial')) && (
                          <div>
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Saldar / Excluir Nota Específica</p>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                  {transactions
                                      .filter(t => t.customerId === historyCustomer.id && t.status !== 'cancelled' && t.status !== 'returned' && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial'))
                                      .map(t => {
                                          const rem = roundCurrency(Math.max(0, t.total - (t.amountPaid || 0)));
                                          return (
                                              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50/60 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-xs">
                                                  <div>
                                                      <span className="font-bold text-slate-700 dark:text-slate-200">Nota #{t.id}</span>
                                                      <span className="text-slate-400 ml-2">{new Date(t.date).toLocaleDateString('es-MX')}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                      <span className="font-bold text-red-600">${rem.toFixed(2)}</span>
                                                      <button
                                                          onClick={() => {
                                                              resetCustomerCredit(historyCustomer.id, {
                                                                  mode: 'SETTLE_TICKET',
                                                                  ticketId: t.id,
                                                                  reason: creditResetReason,
                                                              });
                                                          }}
                                                          className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px]"
                                                      >
                                                          Saldar y Excluir
                                                      </button>
                                                  </div>
                                              </div>
                                          );
                                      })}
                              </div>
                          </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                          <button
                              onClick={() => setIsCreditResetOpen(false)}
                              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs"
                          >
                              Cerrar
                          </button>
                          <button
                              onClick={() => {
                                  if (confirm(`¿Reiniciar la deuda de ${historyCustomer.name} a $0.00 y marcar sus notas pendientes como saldadas (sin afectar caja)?`)) {
                                      resetCustomerCredit(historyCustomer.id, { mode: 'ZERO', reason: creditResetReason });
                                      setIsCreditResetOpen(false);
                                  }
                              }}
                              className="flex-[2] py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs"
                          >
                              Reiniciar Deuda a $0.00
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
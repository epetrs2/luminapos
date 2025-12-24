
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Mail, Phone, DollarSign, Wallet, Infinity, Building2, User, Clock, FileText, ArrowRight, X, Hash, ShoppingBag, CheckCircle } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Customer } from '../types';

export const Customers: React.FC = () => {
  const { customers, transactions, cashMovements, addCustomer, updateCustomer, deleteCustomer, processCustomerPayment } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debt Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  // History Modal
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

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
      setPayCustomer(customer);
      setPayAmount('');
      setIsPayModalOpen(true);
  };

  const handleOpenHistory = (customer: Customer) => {
      setHistoryCustomer(customer);
  };

  const handleSendReminder = (customer: Customer) => {
      if (!customer.email) {
          alert('Este cliente no tiene un correo electrónico registrado.');
          return;
      }

      const subject = `Recordatorio de Pago - LuminaPOS`;
      const body = `Estimado/a ${customer.name},
      
Le saludamos cordialmente de LuminaPOS.
      
Este es un recordatorio amigable sobre su saldo pendiente de $${customer.currentDebt.toFixed(2)}.
      
Le agradeceríamos que regularice su situación lo antes posible.
      
Atentamente,
El equipo de LuminaPOS`;

      window.open(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleSave = () => {
    if (!formData.name) return;

    if (editingCustomer) {
      updateCustomer({ ...editingCustomer, ...formData } as Customer);
    } else {
      addCustomer({ ...formData, id: '', currentDebt: 0 } as Customer); // ID generated in context
    }
    setIsModalOpen(false);
  };

  const handleProcessPayment = () => {
      if (payCustomer && payAmount) {
          const amount = parseFloat(payAmount);
          if (amount <= 0 || amount > payCustomer.currentDebt) {
              alert("Monto inválido. Debe ser mayor a 0 y no mayor a la deuda.");
              return;
          }
          processCustomerPayment(payCustomer.id, amount);
          setIsPayModalOpen(false);
      }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.includes(searchTerm)
  );

  return (
    <div className="p-4 md:p-8 md:pl-72 pt-20 md:pt-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Clientes</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Base de datos y cuentas por cobrar</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all w-full md:w-auto justify-center"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar cliente (Nombre o Clave)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${customer.clientType === 'BUSINESS' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                {customer.clientType === 'BUSINESS' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{customer.name}</p>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{customer.clientType === 'BUSINESS' ? 'Tienda' : 'Particular'}</span>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 text-sm">
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
                            <div className="flex items-center justify-end gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Infinity className="w-4 h-4" /> Ilimitado
                            </div>
                        ) : (
                            <>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                    ${(customer.creditLimit - customer.currentDebt).toFixed(2)}
                                </span>
                                <p className="text-xs text-slate-400">Límite: ${customer.creditLimit.toFixed(2)}</p>
                            </>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        {customer.currentDebt > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                -${customer.currentDebt.toFixed(2)}
                            </span>
                        ) : (
                             <span className="text-xs text-slate-400">Sin deuda</span>
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
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No se encontraron clientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-lg w-full animate-[fadeIn_0.2s_ease-out] border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                          <label htmlFor="unlimited" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">Crédito Ilimitado / Pago contra Entrega</label>
                      </div>
                  </div>
                  
                  {!formData.hasUnlimitedCredit && (
                      <div className="animate-[fadeIn_0.2s]">
                        <input
                            type="number"
                            min="0"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                            value={formData.creditLimit || 0}
                            onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) })}
                        />
                        <p className="text-xs text-slate-400 mt-1">Monto máximo que el cliente puede deber.</p>
                      </div>
                  )}
                  {formData.hasUnlimitedCredit && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 italic">
                          El cliente podrá comprar a crédito sin restricciones. Ideal para pago contra entrega.
                      </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notas</label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  rows={3}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Payment Modal */}
      {isPayModalOpen && payCustomer && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-[fadeIn_0.2s_ease-out] border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
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

                <div className="mb-6">
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1">Monto del Abono</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                            type="number"
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
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleProcessPayment}
                        className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                        Confirmar Pago
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* History Modal - "Expediente del Cliente" */}
      {historyCustomer && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
              <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
                      <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${historyCustomer.clientType === 'BUSINESS' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              {historyCustomer.clientType === 'BUSINESS' ? <Building2 className="w-7 h-7" /> : <User className="w-7 h-7" />}
                          </div>
                          <div>
                              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{historyCustomer.name}</h2>
                              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                  <span className="font-mono bg-slate-200 dark:bg-slate-700 px-2 rounded text-xs">ID: {historyCustomer.id}</span>
                                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-medium">
                                      {historyCustomer.clientType === 'BUSINESS' ? 'Tienda / Empresa' : 'Particular'}
                                  </span>
                                  {historyCustomer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {historyCustomer.phone}</span>}
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setHistoryCustomer(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
                      <div className="p-6 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Deuda Actual</p>
                          <p className={`text-3xl font-black ${historyCustomer.currentDebt > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                              ${historyCustomer.currentDebt.toFixed(2)}
                          </p>
                      </div>
                      <div className="p-6 text-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Crédito Disponible</p>
                          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                              {historyCustomer.hasUnlimitedCredit ? <Infinity className="w-8 h-8 mx-auto" /> : `$${(historyCustomer.creditLimit - historyCustomer.currentDebt).toFixed(2)}`}
                          </p>
                      </div>
                      <div className="p-6 flex items-center justify-center">
                          {historyCustomer.currentDebt > 0 ? (
                              <button 
                                onClick={() => handleOpenPayModal(historyCustomer)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-2 transition-all w-full justify-center md:w-auto"
                              >
                                  <DollarSign className="w-5 h-5" />
                                  Abonar Ahora
                              </button>
                          ) : (
                              <div className="flex items-center gap-2 text-emerald-500 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">
                                  <CheckCircle className="w-5 h-5" /> Al Corriente
                              </div>
                          )}
                      </div>
                  </div>

                  {/* History Timeline */}
                  <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
                      <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-indigo-500" /> Historial Completo
                      </h3>
                      
                      {(() => {
                          // Updated logic to show ALL transactions for this customer
                          const customerTransactions = transactions
                              .filter(t => t.customerId === historyCustomer.id && t.status !== 'cancelled')
                              .map(t => {
                                  // Determine type based on status, not just method
                                  // If pending or partial, it's a DEBT transaction (Red)
                                  // If paid fully, it's a SALE (Neutral/Green) but still history
                                  const isDebt = t.paymentStatus === 'pending' || t.paymentStatus === 'partial';
                                  const isManual = t.id.includes('manual');
                                  
                                  return {
                                      id: t.id,
                                      date: t.date,
                                      type: isDebt ? 'DEBT' : 'SALE',
                                      amount: t.total,
                                      pendingAmount: t.total - (t.amountPaid || 0),
                                      details: `${isManual ? 'Nota Manual' : 'Ticket'} #${t.id} - ${t.items.length} items`,
                                      raw: t
                                  };
                              });

                          const payments = cashMovements
                              .filter(m => m.customerId === historyCustomer.id && m.type === 'DEPOSIT')
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
                                      <p>No hay historial de movimientos para este cliente.</p>
                                  </div>
                              );
                          }

                          return (
                              <div className="space-y-4">
                                  {timeline.map((item) => {
                                      const isDebt = item.type === 'DEBT';
                                      const isPayment = item.type === 'PAYMENT';
                                      
                                      let icon = <ShoppingBag className="w-5 h-5" />;
                                      let bgColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                                      let title = 'Compra de Contado';
                                      let amountColor = 'text-slate-800 dark:text-white';
                                      let sign = '';

                                      if (isDebt) {
                                          bgColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                                          title = 'Compra / Nota Pendiente';
                                          amountColor = 'text-red-500';
                                          sign = '+'; // Adds to debt logic visually
                                      } else if (isPayment) {
                                          icon = <DollarSign className="w-5 h-5" />;
                                          bgColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
                                          title = 'Abono / Pago';
                                          amountColor = 'text-emerald-500';
                                          sign = '-'; // Reduces debt
                                      }

                                      return (
                                          <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                              <div className="flex items-start gap-4">
                                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bgColor}`}>
                                                      {icon}
                                                  </div>
                                                  <div>
                                                      <p className="font-bold text-slate-800 dark:text-white">{title}</p>
                                                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.details}</p>
                                                      <p className="text-xs text-slate-400 mt-1">{new Date(item.date).toLocaleString()}</p>
                                                  </div>
                                              </div>
                                              <div className="text-right pl-14 md:pl-0">
                                                  <p className={`text-lg font-black ${amountColor}`}>
                                                      {sign}${item.amount.toFixed(2)}
                                                  </p>
                                                  {isDebt && (item as any).pendingAmount > 0 && (
                                                      <span className="text-xs font-bold text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                                                          Pendiente: ${(item as any).pendingAmount.toFixed(2)}
                                                      </span>
                                                  )}
                                                  {!isDebt && !isPayment && (
                                                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pagado</span>
                                                  )}
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          );
                      })()}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

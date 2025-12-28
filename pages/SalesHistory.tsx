import React, { useState, useMemo, useEffect } from 'react';
import { Search, User, CheckCircle, ShoppingCart, X, CreditCard, Banknote, Smartphone, Package, Trash2, Loader2, AlertTriangle, PieChart, Printer, Mail, DollarSign, Wallet, FileText, Undo2, Check, Plus, Archive, Hash, Calendar, ChevronRight, Filter, ArrowDownWideNarrow, ArrowUpNarrowWide, Clock, Ban, ArrowUp, ArrowDown, Edit2, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Transaction, CartItem, Product } from '../types';
import { printInvoice, printThermalTicket } from '../utils/printService';

const PaymentIcon = ({ method }: { method: string }) => {
    switch (method) {
        case 'card': return <CreditCard className="w-4 h-4" />;
        case 'transfer': return <Smartphone className="w-4 h-4" />;
        case 'split': return <PieChart className="w-4 h-4" />;
        case 'credit': return <Wallet className="w-4 h-4" />;
        default: return <Banknote className="w-4 h-4" />;
    }
};

const getPaymentLabel = (method: string) => {
    switch (method) {
        case 'card': return 'Tarjeta';
        case 'transfer': return 'Transferencia';
        case 'split': return 'Pago Dividido';
        case 'credit': return 'Crédito';
        default: return 'Efectivo';
    }
};

// --- Manual Entry Modal ---
const ManualEntryModal: React.FC<{
    onClose: () => void;
    onSave: (transaction: Transaction, deductStock: boolean, affectCash: boolean) => void;
    customers: any[];
    products: Product[];
}> = ({ onClose, onSave, customers, products }) => {
    // Form State
    const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
    const [customerId, setCustomerId] = useState('');
    const [customTicketId, setCustomTicketId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
    const [deductStock, setDeductStock] = useState(false);
    const [affectCash, setAffectCash] = useState(true); // NEW: Affect Cash Toggle
    
    // Debt / Status Logic
    const [paidAmount, setPaidAmount] = useState<string>('');
    
    // Item Logic
    const [items, setItems] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [customItemPrice, setCustomItemPrice] = useState('');

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        return products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
    }, [searchTerm, products]);

    const total = useMemo(() => items.reduce((acc, item) => acc + (item.price * item.quantity), 0), [items]);

    // Update paid amount when total changes (defaults to full payment usually)
    useEffect(() => {
        if (paymentMethod !== 'credit') {
            setPaidAmount(total.toString());
        } else {
            setPaidAmount('0');
        }
    }, [total, paymentMethod]);

    const addItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
        setSearchTerm('');
    };

    const addCustomItem = () => {
        if (!searchTerm) return;
        const price = parseFloat(customItemPrice) || 0;
        const newItem: CartItem = {
            id: `manual-${Date.now()}`,
            name: searchTerm,
            price: price,
            quantity: 1,
            stock: 0,
            category: 'Manual',
            sku: 'MANUAL',
            taxRate: 0,
            hasVariants: false,
            unit: 'PIECE',
            isActive: true
        };
        setItems(prev => [...prev, newItem]);
        setSearchTerm('');
        setCustomItemPrice('');
    };

    const updateItem = (index: number, field: 'quantity' | 'price', value: number) => {
        setItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item));
    };

    const removeItem = (index: number) => {
        setItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleSave = () => {
        if (items.length === 0) {
            alert('Agrega al menos un ítem o concepto.');
            return;
        }

        const paid = parseFloat(paidAmount) || 0;
        let finalStatus: Transaction['paymentStatus'] = 'paid';
        
        if (paid >= total) {
            finalStatus = 'paid';
        } else if (paid <= 0) {
            finalStatus = 'pending';
        } else {
            finalStatus = 'partial';
        }

        if ((finalStatus === 'pending' || finalStatus === 'partial') && !customerId) {
            alert("Para registrar una deuda o pago parcial, debes seleccionar un Cliente registrado.");
            return;
        }

        const transaction: Transaction = {
            id: customTicketId || '', 
            date: new Date(date).toISOString(),
            customerId: customerId || undefined,
            items: items,
            subtotal: total,
            taxAmount: 0, 
            discount: 0,
            shipping: 0,
            total: total,
            paymentMethod: paymentMethod,
            paymentStatus: finalStatus,
            amountPaid: paid,
            status: 'completed'
        };

        onSave(transaction, deductStock, affectCash);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col h-[95vh] md:max-h-[90vh] border border-slate-100 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Archive className="w-5 h-5 text-indigo-500" /> Registro Manual
                        </h3>
                        <p className="text-xs text-slate-500">Agrega ventas pasadas para completar tu contabilidad.</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Top Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha y Hora de Venta</label>
                            <input 
                                type="datetime-local" 
                                value={date} 
                                onChange={(e) => setDate(e.target.value)} 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Folio / ID de Ticket (Opcional)</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Ej. A-100 o Déjalo vacío"
                                    value={customTicketId} 
                                    onChange={(e) => setCustomTicketId(e.target.value)} 
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                                />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente (Opcional)</label>
                            <select 
                                value={customerId} 
                                onChange={(e) => setCustomerId(e.target.value)} 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                                <option value="">Cliente General</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Item Input */}
                    <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Agregar Concepto o Producto</label>
                        <div className="flex gap-2 relative">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar o escribir concepto..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                {filteredProducts.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
                                        {filteredProducts.map(p => (
                                            <button key={p.id} onClick={() => addItem(p)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm flex justify-between">
                                                <span className="text-slate-800 dark:text-white font-medium">{p.name}</span>
                                                <span className="text-slate-500">${p.price}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input 
                                type="number" 
                                placeholder="Precio" 
                                value={customItemPrice}
                                onChange={(e) => setCustomItemPrice(e.target.value)}
                                className="w-20 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-center"
                            />
                            <button 
                                onClick={addCustomItem}
                                disabled={!searchTerm}
                                className="px-4 py-2.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                                <tr>
                                    <th className="px-4 py-2 text-left">Desc</th>
                                    <th className="px-1 py-2 text-center w-14">Cant</th>
                                    <th className="px-1 py-2 text-center w-20">Precio</th>
                                    <th className="px-4 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {items.map((item, idx) => (
                                    <tr key={idx} className="bg-white dark:bg-slate-900">
                                        <td className="px-4 py-2 text-slate-800 dark:text-white font-medium">{item.name}</td>
                                        <td className="px-1 py-2">
                                            <input 
                                                type="number" 
                                                value={item.quantity} 
                                                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                                                className="w-full text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium"
                                            />
                                        </td>
                                        <td className="px-1 py-2">
                                            <input 
                                                type="number" 
                                                value={item.price} 
                                                onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))}
                                                className="w-full text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-medium"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Lista vacía</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Forma de Pago:</label>
                            <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                {['cash', 'card', 'transfer', 'credit'].map((m: any) => (
                                    <button 
                                        key={m} 
                                        onClick={() => setPaymentMethod(m)} 
                                        className={`flex-1 px-2 py-1.5 rounded-md text-[10px] md:text-xs font-bold capitalize transition-colors ${paymentMethod === m ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        {m === 'transfer' ? 'Transf' : m === 'credit' ? 'Crédito' : m === 'card' ? 'Tarjeta' : 'Efec'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">Monto Pagado ($):</label>
                            <input 
                                type="number"
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                value={paidAmount}
                                onChange={(e) => setPaidAmount(e.target.value)}
                                placeholder={total.toFixed(2)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setDeductStock(!deductStock)}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${deductStock ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                    {deductStock && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 select-none">Descontar Stock</span>
                            </div>

                            {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAffectCash(!affectCash)}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${affectCash ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                        {affectCash && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 select-none">Ingresar a Caja Chica</span>
                                </div>
                            )}
                        </div>

                        <div className="text-right flex items-center gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Total</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-white">${total.toFixed(2)}</p>
                            </div>
                            <button 
                                onClick={handleSave}
                                className="px-6 md:px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center gap-2 transition-all active:scale-95"
                            >
                                <Archive className="w-5 h-5" /> Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (Rest of PaymentModal and other components remain the same) ...

const PaymentModal: React.FC<{
    transaction: Transaction;
    onClose: () => void;
    onConfirm: (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => void;
    onConfirmTransfer: (id: string) => void;
    mode: 'PAYMENT' | 'CONFIRM_TRANSFER';
}> = ({ transaction, onClose, onConfirm, onConfirmTransfer, mode }) => {
    // ... (Keep existing implementation) ...
    const remaining = transaction.total - (transaction.amountPaid || 0);
    const [amount, setAmount] = useState(remaining.toString());
    const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash');

    const handleSubmit = () => {
        if (mode === 'CONFIRM_TRANSFER') {
            onConfirmTransfer(transaction.id);
            return;
        }
        const val = parseFloat(amount);
        if (val > 0 && val <= remaining + 0.01) {
            onConfirm(transaction.id, val, method);
        } else {
            alert('Monto inválido. No puede ser mayor al restante.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-[slideUp_0.3s_ease-out]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {mode === 'CONFIRM_TRANSFER' ? 'Confirmar Transferencia' : 'Registrar Cobro'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Nota: #{transaction.id}</p>

                {mode === 'CONFIRM_TRANSFER' ? (
                    <div className="mb-6">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-xl text-sm mb-4 border border-orange-100 dark:border-orange-800">
                            <p><strong>¿El dinero ya está en cuenta?</strong></p>
                            <p className="mt-1 opacity-90">Al confirmar, el monto se sumará a los ingresos del día.</p>
                        </div>
                        <p className="text-center font-bold text-2xl dark:text-white">${transaction.total.toFixed(2)}</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-4">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500 dark:text-slate-400">Total Nota:</span>
                                <span className="font-bold dark:text-white">${transaction.total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Pendiente:</span>
                                <span className="font-bold text-red-500">${remaining.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto a Pagar</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Método de Cobro</label>
                            <div className="flex gap-2">
                                <button onClick={() => setMethod('cash')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${method === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}>Efectivo</button>
                                <button onClick={() => setMethod('transfer')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${method === 'transfer' ? 'bg-violet-50 border-violet-500 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}>Transf.</button>
                                <button onClick={() => setMethod('card')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${method === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}>Tarjeta</button>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
                    <button onClick={handleSubmit} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

const ReturnModal: React.FC<{
    transaction: Transaction;
    onClose: () => void;
    onReturn: (items: CartItem[]) => void;
}> = ({ transaction, onClose, onReturn }) => {
    // ... same content ...
    const [returnSelection, setReturnSelection] = useState<{[key: string]: number}>({});

    const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
        if (val < 0) val = 0;
        if (val > maxQty) val = maxQty;
        setReturnSelection(prev => ({...prev, [itemId]: val}));
    };

    const handleSubmit = () => {
        const itemsToReturn: CartItem[] = [];
        transaction.items.forEach(item => {
            const qty = returnSelection[item.id] || 0;
            if (qty > 0) {
                itemsToReturn.push({ ...item, quantity: qty });
            }
        });

        if (itemsToReturn.length === 0) {
            alert("Selecciona al menos un producto para devolver.");
            return;
        }
        onReturn(itemsToReturn);
    };

    const totalRefund = transaction.items.reduce((acc, item) => {
        const qty = returnSelection[item.id] || 0;
        return acc + (item.price * qty);
    }, 0);

    return (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Devolución de Productos</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Selecciona la cantidad a devolver. El stock se restaurará automáticamente.</p>

                <div className="flex-1 overflow-y-auto space-y-3">
                    {transaction.items.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex-1">
                                <p className="font-bold text-sm text-slate-800 dark:text-white">{item.name}</p>
                                <p className="text-xs text-slate-500">Comprado: {item.quantity} | ${item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Devolver:</span>
                                <input 
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    value={returnSelection[item.id] || 0}
                                    onChange={(e) => handleQtyChange(item.id, item.quantity, parseInt(e.target.value))}
                                    className="w-16 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-700 dark:text-slate-300">Total a Reembolsar:</span>
                        <span className="text-2xl font-black text-red-500">-${totalRefund.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
                        <button onClick={handleSubmit} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 dark:shadow-none">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const TransactionDetailModal: React.FC<{
  transaction: Transaction;
  onClose: () => void;
  onDelete: (id: string, items: any[]) => void;
  onPay: () => void;
  onConfirmTransfer: () => void;
  onReturn: (items: CartItem[]) => void;
  onUpdate: (transaction: Transaction) => void; 
  getCustomerName: (id?: string) => string;
  getCustomer: (id?: string) => any;
}> = ({ transaction, onClose, onDelete, onPay, onConfirmTransfer, onReturn, onUpdate, getCustomerName, getCustomer }) => {
  // ... same as before ...
  const { settings, sendBtData, btDevice, updateTransaction, notify } = useStore();
  const [deleteStep, setDeleteStep] = useState<'initial' | 'confirm' | 'processing' | 'success'>('initial');
  const [showReturnModal, setShowReturnModal] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempId, setTempId] = useState(transaction.id);
  const [tempMethod, setTempMethod] = useState(transaction.paymentMethod);

  useEffect(() => {
      setTempId(transaction.id);
      setTempMethod(transaction.paymentMethod);
  }, [transaction]);

  const handleSaveChanges = () => {
      try {
          updateTransaction(transaction.id, { id: tempId, paymentMethod: tempMethod });
          const updatedTx: Transaction = { 
              ...transaction, 
              id: tempId, 
              paymentMethod: tempMethod 
          };
          onUpdate(updatedTx);
          setIsEditing(false);
          notify("Actualizado", "La venta se ha modificado correctamente.", "success");
      } catch (e: any) {
          alert(e.message || "Error al actualizar");
      }
  };

  const handleCancelEdit = () => {
      setTempId(transaction.id);
      setTempMethod(transaction.paymentMethod);
      setIsEditing(false);
  };
  
  const handleDeleteClick = () => {
    if (deleteStep === 'initial') {
      setDeleteStep('confirm');
    } else if (deleteStep === 'confirm') {
      setDeleteStep('processing');
      setTimeout(() => {
        setDeleteStep('success');
        setTimeout(() => {
          onDelete(transaction.id, transaction.items);
        }, 1500);
      }, 1000);
    }
  };

  const handlePrint = () => {
      printThermalTicket(transaction, getCustomerName(transaction.customerId), settings, btDevice ? sendBtData : undefined);
  };
  
  const handlePrintInvoice = () => {
      const customer = getCustomer(transaction.customerId);
      printInvoice(transaction, customer, settings);
  };

  const handleSendEmail = () => {
      const customer = getCustomer(transaction.customerId);
      const email = customer?.email;
      
      if (!email) {
          alert("El cliente no tiene un correo electrónico registrado.");
          return;
      }
      const itemsList = transaction.items.map(i => `- ${i.quantity}x ${i.name}: $${(i.price * i.quantity).toFixed(2)}`).join('\n');
      const subject = `Recibo de Compra - LuminaPOS #${transaction.id}`;
      const body = `Hola ${customer.name}, Gracias por su compra.\n\nDetalles del Ticket #${transaction.id}\nFecha: ${new Date(transaction.date).toLocaleString()}\n---------------------------\n${itemsList}\n---------------------------\nTotal: $${transaction.total.toFixed(2)}`;
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const isPending = transaction.paymentStatus === 'pending' || transaction.paymentStatus === 'partial';
  const remaining = transaction.total - (transaction.amountPaid || 0);
  const isReturnTx = transaction.status === 'returned';
  const isPendingTransfer = transaction.paymentMethod === 'transfer' && transaction.paymentStatus === 'pending';

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
      
      {showReturnModal && (
          <ReturnModal 
            transaction={transaction}
            onClose={() => setShowReturnModal(false)}
            onReturn={(items) => {
                onReturn(items);
                setShowReturnModal(false);
                onClose(); 
            }}
          />
      )}

      <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col h-[90vh] md:max-h-[90vh] relative border border-slate-100 dark:border-slate-800 animate-[slideUp_0.3s_ease-out]">
        
        {deleteStep === 'success' && (
          <div className="absolute inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 animate-[bounce_0.5s_infinite]">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">¡Venta Eliminada!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">El inventario ha sido restaurado.</p>
          </div>
        )}

        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Detalle de Venta
                </h3>
                {isReturnTx ? (
                    <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-1 rounded-full font-bold border border-red-200 dark:border-red-800">DEVOLUCIÓN</span>
                ) : isPending ? (
                    <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs px-2 py-1 rounded-full font-bold border border-yellow-200 dark:border-yellow-800">PENDIENTE</span>
                ) : (
                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2 py-1 rounded-full font-bold border border-emerald-200 dark:border-emerald-800">PAGADO</span>
                )}
            </div>
            <div className="flex flex-col mt-1">
              {isEditing ? (
                  <div className="flex items-center gap-2 mt-2 animate-[fadeIn_0.2s]">
                      <span className="text-xs font-bold text-slate-500">Folio:</span>
                      <input 
                        type="text" 
                        value={tempId}
                        onChange={(e) => setTempId(e.target.value)}
                        className="px-2 py-1 rounded border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-sm font-mono w-32 outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                  </div>
              ) : (
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-slate-400">ID: {transaction.id}</span>
                      {!isReturnTx && (
                          <button 
                            onClick={() => setIsEditing(true)} 
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors" 
                            title="Editar Folio/Pago"
                          >
                              <Edit2 className="w-3 h-3" />
                              <span className="text-[10px] font-bold">Editar</span>
                          </button>
                      )}
                  </div>
              )}
              <span className="text-sm text-slate-500 dark:text-slate-400 mt-1 block">{new Date(transaction.date).toLocaleString()}</span>
            </div>
          </div>
          
          {isEditing ? (
              <div className="flex gap-2">
                  <button onClick={handleSaveChanges} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"><Save className="w-5 h-5"/></button>
                  <button onClick={handleCancelEdit} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><X className="w-5 h-5"/></button>
              </div>
          ) : (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Action Buttons Bar */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
                <button onClick={handlePrintInvoice} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-900 text-white py-3 px-4 rounded-xl hover:bg-blue-800 font-medium transition-colors shadow-sm whitespace-nowrap"><FileText className="w-4 h-4" /> Nota Venta</button>
               <button onClick={handlePrint} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-3 px-4 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-medium transition-colors border border-indigo-100 dark:border-indigo-800"><Printer className="w-4 h-4" /> Ticket</button>
               <button onClick={handleSendEmail} className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors" title="Enviar por Correo"><Mail className="w-4 h-4" /></button>
          </div>
          
           {isPending && (
               <div className="mb-6">
                   {isPendingTransfer ? (
                        <button onClick={onConfirmTransfer} className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white px-4 py-3 rounded-xl hover:bg-violet-700 font-bold shadow-lg shadow-violet-200 dark:shadow-none transition-colors">
                            <Check className="w-4 h-4" /> Confirmar Transferencia Recibida
                        </button>
                   ) : (
                       <button onClick={onPay} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200 dark:shadow-none transition-colors">
                           <DollarSign className="w-4 h-4" /> Registrar Pago Pendiente
                       </button>
                   )}
               </div>
           )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente
              </h4>
              <p className="font-bold text-slate-800 dark:text-white text-lg">{getCustomerName(transaction.customerId)}</p>
              {transaction.customerId && (
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 space-y-1">
                  <p>{getCustomer(transaction.customerId)?.email}</p>
                  <p>{getCustomer(transaction.customerId)?.phone}</p>
                </div>
              )}
            </div>

            <div className={`p-5 rounded-xl border border-slate-100 dark:border-slate-800 transition-all ${isEditing ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-500/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
              <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PaymentIcon method={isEditing ? tempMethod : transaction.paymentMethod} />
                Estado Financiero
              </h4>
              
              {isEditing ? (
                  <div className="mb-2">
                      <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Método de Pago</label>
                      <select 
                        value={tempMethod}
                        onChange={(e) => setTempMethod(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta</option>
                          <option value="transfer">Transferencia</option>
                          <option value="credit">Crédito</option>
                          <option value="split">Dividido</option>
                      </select>
                  </div>
              ) : (
                  <p className="font-bold text-slate-800 dark:text-white capitalize text-lg mb-2">
                    {getPaymentLabel(transaction.paymentMethod)}
                  </p>
              )}
              
              <div className="space-y-1 text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                  <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Total:</span>
                      <span className={`font-bold ${isReturnTx ? 'text-red-500' : 'dark:text-white'}`}>${transaction.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Pagado:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">${(transaction.amountPaid || 0).toFixed(2)}</span>
                  </div>
                  {remaining > 0 && (
                      <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Restante:</span><span className="font-bold text-red-500">${remaining.toFixed(2)}</span></div>
                  )}
                  {transaction.transferReference && (
                      <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-400">Ref:</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">{transaction.transferReference}</span>
                      </div>
                  )}
              </div>
            </div>
          </div>

          <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            Productos ({transaction.items.length})
          </h4>
          
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-center">Cant.</th>
                  <th className="px-4 py-3 text-right">P. Unit</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transaction.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                        {item.name}
                        {item.variantName && <div className="text-xs text-slate-400">{item.variantName}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">${item.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-slate-800 dark:text-slate-200 font-bold">${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-right font-black text-slate-900 dark:text-white text-lg border-t border-slate-200 dark:border-slate-700 mt-2">Total Final</td>
                  <td className="px-4 py-4 text-right text-lg font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 mt-2">${transaction.total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center gap-4">
          <button onClick={onClose} className="px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cerrar</button>
          
          <div className="flex gap-2">
              {!isReturnTx && (
                  <button 
                    onClick={() => setShowReturnModal(true)}
                    className="relative overflow-hidden px-4 md:px-6 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all"
                  >
                      <Undo2 className="w-5 h-5" /> <span className="hidden md:inline">Devolución</span>
                  </button>
              )}
              
              <button
                onClick={handleDeleteClick}
                disabled={deleteStep === 'processing'}
                className={`
                  relative overflow-hidden px-4 md:px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all duration-200
                  ${deleteStep === 'confirm' ? 'bg-orange-600 hover:bg-orange-700 ring-4 ring-orange-100 dark:ring-orange-900/30' : 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none'}
                  ${deleteStep === 'processing' ? 'cursor-not-allowed opacity-80 pl-10' : ''}
                `}
              >
                {deleteStep === 'processing' && <Loader2 className="absolute left-4 w-5 h-5 animate-spin" />}
                {deleteStep === 'initial' && <><Trash2 className="w-5 h-5" /> <span className="hidden md:inline">Anular Todo</span></>}
                {deleteStep === 'confirm' && <><AlertTriangle className="w-5 h-5" /> ¿Confirmar?</>}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SalesHistory: React.FC = () => {
  const { transactions, customers, deleteTransaction, registerTransactionPayment, addTransaction, updateStockAfterSale, settings, notify, products, sendBtData, btDevice } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [transactionToPay, setTransactionToPay] = useState<Transaction | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PAYMENT' | 'CONFIRM_TRANSFER'>('PAYMENT');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // New Filters
  const [filterType, setFilterType] = useState<'ALL' | 'PAID' | 'PENDING' | 'CANCELLED'>('ALL');
  const [sortBy, setSortBy] = useState<'DATE' | 'AMOUNT' | 'ID'>('ID'); // Default sort by Folio (ID)
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC'); // Default Descending (Newest first)

  // ... (rest of helper functions) ...
  const getCustomerName = (id?: string) => {
      if (!id) return 'Cliente General';
      return customers.find(c => c.id === id)?.name || 'Desconocido';
  };

  const getCustomer = (id?: string) => {
      return customers.find(c => c.id === id);
  };

  const handleOpenDetail = (transaction: Transaction) => {
      setSelectedTransaction(transaction);
  };

  const handleTransactionUpdate = (newTx: Transaction) => {
      setSelectedTransaction(newTx);
  };

  const handleDeleteTransaction = (id: string, items: any[]) => {
      deleteTransaction(id, items);
      setSelectedTransaction(null);
  };

  const handleReturnItems = (itemsToReturn: CartItem[]) => {
      if (!selectedTransaction) return;

      const refundTotal = itemsToReturn.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const taxRefund = itemsToReturn.reduce((sum, item) => sum + (item.finalTax ? (item.finalTax / item.quantity) * item.quantity : 0), 0);

      const refundTx: Transaction = {
          id: '', 
          date: new Date().toISOString(),
          items: itemsToReturn, 
          paymentMethod: selectedTransaction.paymentMethod,
          status: 'returned',
          customerId: selectedTransaction.customerId,
          subtotal: -refundTotal,
          taxAmount: -taxRefund,
          discount: 0,
          shipping: 0,
          total: -refundTotal, 
          paymentStatus: 'paid', 
          amountPaid: -refundTotal,
          originalTransactionId: selectedTransaction.id,
          isReturn: true
      };

      addTransaction(refundTx);

      const itemsToStock = itemsToReturn.map(item => ({
          id: item.id.split('-')[0], 
          quantity: -item.quantity, 
          variantId: item.variantId
      }));
      updateStockAfterSale(itemsToStock);
  };

  const handleOpenPayment = (transaction: Transaction) => {
      setTransactionToPay(transaction);
      setPaymentMode('PAYMENT');
      setIsPaymentModalOpen(true);
  };

  const handleOpenConfirmTransfer = () => {
      if(selectedTransaction) {
          setTransactionToPay(selectedTransaction);
          setPaymentMode('CONFIRM_TRANSFER');
          setIsPaymentModalOpen(true);
      }
  };

  const handlePaymentConfirm = (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => {
      registerTransactionPayment(id, amount, method);
      setIsPaymentModalOpen(false);
      setTransactionToPay(null);
      setSelectedTransaction(null);
  };

  const handleConfirmTransfer = (id: string) => {
      const tx = transactions.find(t => t.id === id);
      if(tx) {
          registerTransactionPayment(id, tx.total - (tx.amountPaid || 0), 'transfer');
          notify("Transferencia Confirmada", `Venta #${id} marcada como pagada.`, 'success');
      }
      setIsPaymentModalOpen(false);
      setTransactionToPay(null);
      setSelectedTransaction(null);
  };

  // UPDATED HANDLER
  const handleManualEntrySave = (transaction: Transaction, deductStock: boolean, affectCash: boolean) => {
      // Pass affectCash as the second argument option
      addTransaction(transaction, { shouldAffectCash: affectCash });
      
      if(deductStock) {
          updateStockAfterSale(transaction.items);
      }
      setIsManualModalOpen(false);
      notify("Registro Exitoso", "Venta manual agregada al historial.", "success");
  };

  // ... (Memoized counts and filteredTransactions) ...
  const counts = useMemo(() => {
        return {
            all: transactions.length,
            paid: transactions.filter(t => t.status === 'completed' && t.paymentStatus === 'paid').length,
            pending: transactions.filter(t => t.status === 'completed' && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial')).length,
            cancelled: transactions.filter(t => t.status === 'cancelled' || t.status === 'returned').length
        };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
        let result = transactions.filter(t => 
            t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            getCustomerName(t.customerId).toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filterType === 'PAID') {
            result = result.filter(t => t.status === 'completed' && t.paymentStatus === 'paid');
        } else if (filterType === 'PENDING') {
            result = result.filter(t => t.status === 'completed' && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial'));
        } else if (filterType === 'CANCELLED') {
            result = result.filter(t => t.status === 'cancelled' || t.status === 'returned');
        }

        result.sort((a, b) => {
            let comparison = 0;
            
            if (sortBy === 'ID') {
                const numA = parseInt(a.id);
                const numB = parseInt(b.id);
                if (!isNaN(numA) && !isNaN(numB)) {
                    comparison = numA - numB;
                } else {
                    comparison = a.id.localeCompare(b.id);
                }
            } else if (sortBy === 'AMOUNT') {
                comparison = a.total - b.total;
            } else {
                comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
            }

            return sortDirection === 'DESC' ? -comparison : comparison;
        });

        return result;
  }, [transactions, searchTerm, filterType, sortBy, sortDirection]);

  const toggleSortBy = () => {
      if (sortBy === 'ID') setSortBy('DATE');
      else if (sortBy === 'DATE') setSortBy('AMOUNT');
      else setSortBy('ID');
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Historial de Ventas</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Consulta y gestiona todas las transacciones pasadas.</p>
          </div>
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Registro Manual
          </button>
        </div>

        {/* ... (Rest of UI remains identical) ... */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
            <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto w-full lg:w-auto custom-scrollbar">
                <button onClick={() => setFilterType('ALL')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'ALL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Todas <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.all}</span>
                </button>
                <button onClick={() => setFilterType('PAID')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'PAID' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <CheckCircle className="w-3 h-3"/> Pagadas <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.paid}</span>
                </button>
                <button onClick={() => setFilterType('PENDING')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'PENDING' ? 'bg-white dark:bg-slate-700 text-yellow-600 dark:text-yellow-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    <Clock className="w-3 h-3"/> Pendientes <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.pending}</span>
                </button>
                <button onClick={() => setFilterType('CANCELLED')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'CANCELLED' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 hover:text-red-500 dark:hover:text-red-400'}`}>
                    <Ban className="w-3 h-3"/> Anuladas <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-md text-[10px]">{counts.cancelled}</span>
                </button>
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Buscar por Folio o Cliente..." 
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <button 
                    onClick={toggleSortBy}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap min-w-[120px]"
                    title="Cambiar criterio de orden"
                >
                    {sortBy === 'ID' && <><Hash className="w-4 h-4 text-indigo-500"/> Folio</>}
                    {sortBy === 'DATE' && <><Calendar className="w-4 h-4 text-indigo-500"/> Fecha</>}
                    {sortBy === 'AMOUNT' && <><DollarSign className="w-4 h-4 text-emerald-500"/> Monto</>}
                </button>

                <button 
                    onClick={() => setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                    className="flex items-center justify-center p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    title={sortDirection === 'ASC' ? 'Orden Ascendente (A-Z, 1-9)' : 'Orden Descendente (Z-A, 9-1)'}
                >
                    {sortDirection === 'ASC' ? <ArrowUp className="w-4 h-4"/> : <ArrowDown className="w-4 h-4"/>}
                </button>
            </div>
          </div>

          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransactions.map(t => (
                  <div key={t.id} onClick={() => handleOpenDetail(t)} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <p className="font-bold text-slate-800 dark:text-white text-sm">#{t.id}</p>
                              <p className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                          <div className="text-right">
                              <p className="font-black text-slate-800 dark:text-white">${t.total.toFixed(2)}</p>
                              <p className="text-[10px] uppercase text-slate-400 font-bold">{getPaymentLabel(t.paymentMethod)}</p>
                          </div>
                      </div>
                      <div className="flex justify-between items-center">
                          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[180px]">{getCustomerName(t.customerId)}</p>
                          {t.status === 'returned' ? (
                              <span className="text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">DEVUELTO</span>
                          ) : t.status === 'cancelled' ? (
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">CANCELADO</span>
                          ) : t.paymentStatus === 'paid' ? (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded">PAGADO</span>
                          ) : (
                              <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded">PENDIENTE</span>
                          )}
                      </div>
                      
                      {(t.paymentStatus === 'pending' || t.paymentStatus === 'partial') && t.status === 'completed' && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end" onClick={e => e.stopPropagation()}>
                              <button 
                                onClick={() => handleOpenPayment(t)}
                                className="text-xs font-bold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-100"
                              >
                                  <DollarSign className="w-3 h-3" /> Registrar Pago
                              </button>
                          </div>
                      )}
                  </div>
              ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => { setSortBy('ID'); setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC'); }}>
                      <div className="flex items-center gap-1">Folio {sortBy === 'ID' && (sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}</div>
                  </th>
                  <th className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => { setSortBy('DATE'); setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC'); }}>
                      <div className="flex items-center gap-1">Fecha {sortBy === 'DATE' && (sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}</div>
                  </th>
                  <th className="px-6 py-4 text-left">Cliente</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => { setSortBy('AMOUNT'); setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC'); }}>
                      <div className="flex items-center justify-end gap-1">Total {sortBy === 'AMOUNT' && (sortDirection === 'ASC' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}</div>
                  </th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map(t => (
                  <tr 
                    key={t.id} 
                    onClick={() => handleOpenDetail(t)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">#{t.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(t.date).toLocaleDateString()}
                      <span className="text-xs text-slate-400 block">{new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">
                      {getCustomerName(t.customerId)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {t.status === 'returned' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            DEVUELTO
                          </span>
                      ) : t.status === 'cancelled' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400">
                            CANCELADO
                          </span>
                      ) : t.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            PAGADO
                          </span>
                      ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            PENDIENTE
                          </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white">
                      ${t.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        {(t.paymentStatus === 'pending' || t.paymentStatus === 'partial') && t.status === 'completed' && (
                            <button 
                                onClick={() => handleOpenPayment(t)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors"
                                title="Registrar Pago"
                            >
                                <DollarSign className="w-4 h-4" />
                            </button>
                        )}
                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <ChevronRight className="w-4 h-4"/>
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredTransactions.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No se encontraron transacciones</p>
            </div>
          )}
        </div>
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onDelete={handleDeleteTransaction}
          onPay={() => handleOpenPayment(selectedTransaction)}
          onConfirmTransfer={handleOpenConfirmTransfer}
          onReturn={handleReturnItems}
          onUpdate={handleTransactionUpdate} 
          getCustomerName={getCustomerName}
          getCustomer={getCustomer}
        />
      )}

      {isPaymentModalOpen && transactionToPay && (
        <PaymentModal 
          transaction={transactionToPay}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirm={handlePaymentConfirm}
          onConfirmTransfer={handleConfirmTransfer}
          mode={paymentMode}
        />
      )}

      {isManualModalOpen && (
          <ManualEntryModal 
            onClose={() => setIsManualModalOpen(false)}
            onSave={handleManualEntrySave}
            customers={customers}
            products={products}
          />
      )}
    </div>
  );
};
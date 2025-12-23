
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Product, CartItem, Transaction } from '../types';
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard, Banknote, Smartphone, LayoutGrid, List, Truck, Percent, ChevronRight, X, ArrowRight, Minus, CheckCircle, Printer, FileText, PieChart, Wallet, AlertCircle, Scale } from 'lucide-react';
import { printThermalTicket, printInvoice } from '../utils/printService';

export const POS: React.FC = () => {
    const { products, customers, categories, addTransaction, updateStockAfterSale, settings, notify } = useStore();
    
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    
    // Calculations State (Discounts, Shipping)
    const [discountValue, setDiscountValue] = useState<string>('0');
    const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
    const [shippingCost, setShippingCost] = useState<string>('');

    // Weight/Decimal Input State
    const [weightModalOpen, setWeightModalOpen] = useState(false);
    const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
    const [decimalQty, setDecimalQty] = useState('');

    // Checkout Modal State
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState<'SELECT' | 'PAYMENT' | 'SUCCESS'>('SELECT');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'split' | 'credit'>('cash');
    const [amountPaid, setAmountPaid] = useState<string>('');
    const [splitCash, setSplitCash] = useState<string>('');
    const [splitOther, setSplitOther] = useState<string>('');
    const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

    // Computed
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const taxAmount = settings.enableTax ? cart.reduce((acc, item) => {
        const rate = item.taxRate !== undefined ? item.taxRate : settings.taxRate;
        return acc + ((item.price * item.quantity) * (rate / 100));
    }, 0) : 0;

    const discountAmount = useMemo(() => {
        const val = parseFloat(discountValue) || 0;
        if (discountType === 'PERCENT') return subtotal * (val / 100);
        return val;
    }, [subtotal, discountValue, discountType]);

    const total = Math.max(0, subtotal + taxAmount + (parseFloat(shippingCost) || 0) - discountAmount);

    const filteredProducts = products.filter(p => {
        if (p.type === 'SUPPLY') return false;
        if (p.isActive === false) return false; // HIDE INACTIVE

        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm);
        const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    useEffect(() => {
        if (showCheckoutModal) {
            setCheckoutStep('SELECT');
            setAmountPaid('');
            setSplitCash('');
            setSplitOther('');
            setLastTransaction(null);
        }
    }, [showCheckoutModal]);

    const addToCart = (product: Product, variantId?: string, forceQty?: number) => {
        // If product is sold by Weight (KG, GRAM, LITER, METER) and we don't have a qty, open decimal modal
        if (product.unit && product.unit !== 'PIECE' && !forceQty) {
            setPendingProduct(product);
            setDecimalQty('');
            setWeightModalOpen(true);
            return;
        }

        setCart(prev => {
            const qtyToAdd = forceQty || 1;
            const existing = prev.find(i => i.id === product.id && i.variantId === variantId);
            const stockAvailable = variantId 
                ? product.variants?.find(v => v.id === variantId)?.stock 
                : product.stock;
            
            if (stockAvailable !== undefined && (existing?.quantity || 0) + qtyToAdd > stockAvailable) {
                notify("Stock Insuficiente", "No hay unidades suficientes.", "warning");
                return prev;
            }

            if (existing) {
                return prev.map(i => i.id === product.id && i.variantId === variantId 
                    ? { ...i, quantity: i.quantity + qtyToAdd } 
                    : i
                );
            }

            const variant = variantId ? product.variants?.find(v => v.id === variantId) : null;
            return [...prev, {
                ...product,
                price: variant ? variant.price : product.price,
                quantity: qtyToAdd,
                variantId: variant?.id,
                variantName: variant?.name
            }];
        });
        setWeightModalOpen(false);
    };

    const updateQty = (itemId: string, variantId: string | undefined, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId && item.variantId === variantId) {
                const newQty = item.unit === 'PIECE' ? Math.max(1, item.quantity + delta) : Math.max(0.001, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeFromCart = (itemId: string, variantId?: string) => {
        setCart(prev => prev.filter(i => !(i.id === itemId && i.variantId === variantId)));
    };

    const initiatePayment = (method: typeof paymentMethod) => {
        setPaymentMethod(method);
        if (method === 'split') {
            const half = (total / 2).toFixed(2);
            setSplitCash(half);
            setSplitOther(half);
        } else if (method === 'credit') {
            if (!selectedCustomerId) {
                alert("Debes seleccionar un cliente para vender a crédito.");
                return;
            }
            const customer = customers.find(c => c.id === selectedCustomerId);
            if (customer && !customer.hasUnlimitedCredit) {
                if ((customer.currentDebt + total) > customer.creditLimit) {
                    alert(`Crédito insuficiente. Disponible: $${(customer.creditLimit - customer.currentDebt).toFixed(2)}`);
                    return;
                }
            }
        }
        setCheckoutStep('PAYMENT');
    };

    const finalizeSale = () => {
        let finalAmountPaid = 0;
        let paymentStatus: Transaction['paymentStatus'] = 'paid';

        if (paymentMethod === 'cash') {
            const received = parseFloat(amountPaid) || 0;
            if (received < total) { alert("El monto recibido es menor al total."); return; }
            finalAmountPaid = total;
        } else if (paymentMethod === 'split') {
            const c = parseFloat(splitCash) || 0;
            const o = parseFloat(splitOther) || 0;
            if (Math.abs((c + o) - total) > 0.1) { alert("La suma de pagos no coincide con el total."); return; }
            finalAmountPaid = total;
        } else if (paymentMethod === 'credit') {
            finalAmountPaid = 0;
            paymentStatus = 'pending';
        } else {
            finalAmountPaid = total;
        }

        const transaction: Transaction = {
            id: '', 
            date: new Date().toISOString(),
            subtotal,
            taxAmount,
            discount: discountAmount,
            shipping: parseFloat(shippingCost) || 0,
            total,
            items: cart,
            paymentMethod,
            paymentStatus,
            amountPaid: finalAmountPaid,
            customerId: selectedCustomerId || undefined,
            status: 'completed',
            splitDetails: paymentMethod === 'split' ? { cash: parseFloat(splitCash)||0, other: parseFloat(splitOther)||0 } : undefined
        };

        addTransaction(transaction);
        updateStockAfterSale(cart);
        setLastTransaction({ ...transaction, id: 'OK' }); 
        setCheckoutStep('SUCCESS');
    };

    const resetSale = () => {
        setCart([]);
        setAmountPaid('');
        setSelectedCustomerId('');
        setShowCheckoutModal(false);
        setCheckoutStep('SELECT');
        setDiscountValue('0');
        setShippingCost('');
    };

    return (
        <div className="flex flex-col md:flex-row h-screen pt-16 md:pt-0 bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Left: Product Catalog */}
            <div className="flex-1 flex flex-col min-w-0 md:pl-64 border-r border-slate-200 dark:border-slate-800">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Buscar productos..." 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shrink-0">
                            <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}><LayoutGrid className="w-5 h-5"/></button>
                            <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-colors ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}><List className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button onClick={() => setSelectedCategory('ALL')} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>Todos</button>
                        {categories.map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>{cat}</button>))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
                    <div className={`grid gap-4 ${viewMode === 'GRID' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                        {filteredProducts.map(product => (
                            <div key={product.id} onClick={() => !product.hasVariants && addToCart(product)} className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-md group ${product.hasVariants ? '' : 'active:scale-95'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{product.category}</span>
                                    <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{product.unit || 'PZ'}</span>
                                </div>
                                <h3 className="font-bold text-slate-800 dark:text-white mb-1 line-clamp-2">
                                    {product.name}
                                    {product.presentationValue && (
                                        <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                            {product.presentationValue}{product.presentationUnit}
                                        </span>
                                    )}
                                </h3>
                                {product.unit && product.unit !== 'PIECE' && <p className="text-[10px] text-indigo-500 font-bold uppercase mb-2">Venta a granel</p>}
                                <div className="flex justify-between items-end mt-2"><p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">${product.price}</p><div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Plus className="w-5 h-5" /></div></div>
                                {product.hasVariants && (<div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">{product.variants?.map(v => (<button key={v.id} onClick={(e) => { e.stopPropagation(); addToCart(product, v.id); }} className="w-full flex justify-between items-center text-xs p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><span className="text-slate-700 dark:text-slate-300">{v.name}</span><span className="font-bold text-indigo-600 dark:text-indigo-400">${v.price}</span></button>))}</div>)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-full md:w-[400px] lg:w-[450px] bg-white dark:bg-slate-900 flex flex-col border-l border-slate-200 dark:border-slate-800 h-[calc(100vh-64px)] md:h-screen fixed md:relative right-0 bottom-0 top-16 md:top-0 shadow-2xl z-20">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                    <div className="flex items-center gap-3 mb-4"><div className="bg-indigo-600 text-white p-2 rounded-lg"><ShoppingCart className="w-5 h-5" /></div><div><h2 className="font-bold text-slate-800 dark:text-white">Ticket de Venta</h2><p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p></div></div>
                    <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><select className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-sm font-medium" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}><option value="">Cliente General</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronRight className="w-4 h-4 text-slate-400 rotate-90" /></div></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {cart.map(item => (
                        <div key={`${item.id}-${item.variantId}`} className="flex items-center gap-3 group">
                            <div className="flex flex-col items-center gap-1">
                                <button onClick={() => updateQty(item.id, item.variantId, item.unit === 'PIECE' ? 1 : 0.1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors"><Plus className="w-3 h-3"/></button>
                                <span className={`text-[10px] font-black w-10 text-center ${item.unit !== 'PIECE' ? 'text-indigo-600' : ''}`}>{item.quantity} {item.unit !== 'PIECE' ? item.unit.slice(0,2).toLowerCase() : ''}</span>
                                <button onClick={() => updateQty(item.id, item.variantId, item.unit === 'PIECE' ? -1 : -0.1)} className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"><Minus className="w-3 h-3"/></button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{item.name}</h4>
                                {item.variantName && <p className="text-xs text-slate-500">{item.variantName}</p>}
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">${item.price.toFixed(2)} / {item.unit || 'pz'}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-slate-800 dark:text-white">${(item.price * item.quantity).toFixed(2)}</p>
                                <button onClick={() => removeFromCart(item.id, item.variantId)} className="text-xs text-red-500 hover:underline mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Eliminar</button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (<div className="text-center py-10 text-slate-400 flex flex-col items-center"><ShoppingCart className="w-12 h-12 mb-3 opacity-20" /><p>Carrito vacío</p><p className="text-xs mt-1">Agrega productos para comenzar</p></div>)}
                </div>

                <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] z-20">
                    <div className="space-y-1 mb-4 px-1 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">${subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center py-1"><div className="flex items-center gap-1"><span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300"><Percent className="w-3.5 h-3.5"/> Desc.</span><select className="bg-transparent border-none text-xs outline-none text-indigo-600 font-bold cursor-pointer" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}><option value="PERCENT">%</option><option value="FIXED">$</option></select></div><input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="w-16 text-right border-b border-slate-200 bg-transparent outline-none focus:border-indigo-500 text-red-500 font-bold"/></div>
                        {settings.enableTax && (<div className="flex justify-between"><span>Impuestos Totales</span><span className="font-medium">${taxAmount.toFixed(2)}</span></div>)}
                        <div className="flex justify-between items-center py-1"><span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300"><Truck className="w-3.5 h-3.5"/> Envío</span><div className="relative w-20"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">$</span><input type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="w-full pl-5 pr-2 py-1 text-right border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-indigo-500 text-slate-800 dark:text-white font-bold" placeholder="0" /></div></div>
                    </div>
                    <div className="flex justify-between items-end mb-4"><div><p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total a Pagar</p><h3 className="text-3xl font-black text-slate-900 dark:text-white leading-none">${total.toFixed(2)}</h3></div><button onClick={() => setShowCheckoutModal(true)} disabled={cart.length === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2">Cobrar <ArrowRight className="w-5 h-5" /></button></div>
                </div>
            </div>

            {/* WEIGHT / DECIMAL INPUT MODAL */}
            {weightModalOpen && pendingProduct && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 text-center">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Scale className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{pendingProduct.name}</h3>
                        <p className="text-sm text-slate-500 mb-6">Ingresa la cantidad en <strong>{pendingProduct.unit?.toLowerCase() || 'unidades'}</strong></p>

                        <div className="relative mb-6">
                            <input 
                                type="number" 
                                step="0.001"
                                autoFocus
                                value={decimalQty}
                                onChange={(e) => setDecimalQty(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addToCart(pendingProduct, undefined, parseFloat(decimalQty))}
                                className="w-full text-center text-4xl font-black py-4 rounded-2xl border-2 border-indigo-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-indigo-500"
                                placeholder="0.000"
                            />
                            <div className="mt-2 flex justify-between text-xs font-bold text-slate-400 px-2">
                                <span>Precio: ${pendingProduct.price} / {pendingProduct.unit}</span>
                                <span className="text-indigo-600">Total: ${((parseFloat(decimalQty) || 0) * pendingProduct.price).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setWeightModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                            <button onClick={() => addToCart(pendingProduct, undefined, parseFloat(decimalQty))} disabled={!decimalQty || parseFloat(decimalQty) <= 0} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL CHECKOUT WIZARD MODAL */}
            {showCheckoutModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.2s_ease-out] flex flex-col max-h-[90vh] overflow-hidden">
                        
                        {checkoutStep === 'SELECT' && (
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Método de Pago</h3>
                                    <button onClick={() => setShowCheckoutModal(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                                </div>
                                <div className="text-center mb-6"><p className="text-sm text-slate-500 mb-1">Total a Cobrar</p><h2 className="text-4xl font-black text-slate-800 dark:text-white">${total.toFixed(2)}</h2></div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <button onClick={() => initiatePayment('cash')} className="p-4 rounded-xl border flex flex-col items-center gap-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-600 dark:text-slate-300 transition-all"><Banknote className="w-8 h-8 text-emerald-500" /><span className="text-sm font-bold">Efectivo</span></button>
                                    <button onClick={() => initiatePayment('card')} className="p-4 rounded-xl border flex flex-col items-center gap-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-300 transition-all"><CreditCard className="w-8 h-8 text-blue-500" /><span className="text-sm font-bold">Tarjeta</span></button>
                                    <button onClick={() => initiatePayment('transfer')} className="p-4 rounded-xl border flex flex-col items-center gap-2 border-slate-200 dark:border-slate-700 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-600 dark:text-slate-300 transition-all"><Smartphone className="w-8 h-8 text-violet-500" /><span className="text-sm font-bold">Transferencia</span></button>
                                    <button onClick={() => initiatePayment('credit')} className="p-4 rounded-xl border flex flex-col items-center gap-2 border-slate-200 dark:border-slate-700 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 text-slate-600 dark:text-slate-300 transition-all"><Wallet className="w-8 h-8 text-pink-500" /><span className="text-sm font-bold">Crédito</span></button>
                                </div>
                                <button onClick={() => initiatePayment('split')} className="w-full py-3 mt-2 text-indigo-600 font-bold text-sm hover:underline flex items-center justify-center gap-2"><PieChart className="w-4 h-4"/> Pago Dividido</button>
                            </div>
                        )}

                        {checkoutStep === 'PAYMENT' && (
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <button onClick={() => setCheckoutStep('SELECT')} className="text-slate-400 hover:text-slate-600"><ArrowRight className="w-6 h-6 rotate-180" /></button>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white capitalize">{paymentMethod === 'split' ? 'Pago Dividido' : paymentMethod === 'credit' ? 'Crédito' : `Pago en ${paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}`}</h3>
                                    <div className="w-6"></div>
                                </div>

                                <div className="text-center mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                                    <p className="text-sm text-slate-500 mb-1">Total</p>
                                    <h2 className="text-3xl font-black text-slate-800 dark:text-white">${total.toFixed(2)}</h2>
                                </div>

                                {paymentMethod === 'cash' && (
                                    <>
                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dinero Recibido</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">$</span>
                                                <input type="number" autoFocus value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full pl-8 pr-4 py-4 rounded-xl border-2 border-indigo-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-2xl font-bold outline-none focus:border-indigo-500 dark:text-white" placeholder={total.toFixed(2)} />
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-xl flex justify-between items-center mb-6 ${parseFloat(amountPaid) >= total ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                            <span className="font-bold">Cambio</span>
                                            <span className="text-xl font-black">${Math.max(0, (parseFloat(amountPaid) || 0) - total).toFixed(2)}</span>
                                        </div>
                                    </>
                                )}

                                {paymentMethod === 'split' && (
                                    <div className="space-y-4 mb-6">
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Efectivo</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span><input type="number" value={splitCash} onChange={(e) => setSplitCash(e.target.value)} className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"/></div></div>
                                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarjeta / Transferencia</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span><input type="number" value={splitOther} onChange={(e) => setSplitOther(e.target.value)} className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"/></div></div>
                                        <div className="flex justify-between text-sm px-1"><span>Suma:</span><span className={`font-bold ${Math.abs(((parseFloat(splitCash)||0) + (parseFloat(splitOther)||0)) - total) < 0.1 ? 'text-emerald-600' : 'text-red-500'}`}>${((parseFloat(splitCash)||0) + (parseFloat(splitOther)||0)).toFixed(2)}</span></div>
                                    </div>
                                )}

                                {paymentMethod === 'credit' && (
                                    <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800 text-sm text-orange-800 dark:text-orange-300 flex gap-3">
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <div>
                                            <p className="font-bold">Venta a Crédito</p>
                                            <p className="mt-1">Se generará una nota pendiente por <strong>${total.toFixed(2)}</strong> al cliente seleccionado.</p>
                                        </div>
                                    </div>
                                )}

                                <button onClick={finalizeSale} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all text-lg">Confirmar Venta</button>
                            </div>
                        )}

                        {checkoutStep === 'SUCCESS' && (
                            <div className="p-8 text-center flex flex-col items-center">
                                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-[bounce_0.5s_infinite]">
                                    <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">¡Venta Exitosa!</h2>
                                <p className="text-slate-500 mb-6">La transacción ha sido registrada.</p>

                                {(paymentMethod === 'cash' || paymentMethod === 'split') && (parseFloat(amountPaid) > total || splitCash) && (
                                    <div className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Cambio a Entregar</p>
                                        <p className="text-3xl font-black text-slate-800 dark:text-white">
                                            ${paymentMethod === 'cash' ? (parseFloat(amountPaid) - total).toFixed(2) : '0.00'}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                                    <button onClick={() => { if(lastTransaction) printThermalTicket(lastTransaction, customers.find(c => c.id === selectedCustomerId)?.name || 'Mostrador', settings) }} className="flex flex-col items-center justify-center p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 transition-colors font-bold text-sm gap-2">
                                        <Printer className="w-6 h-6"/> Ticket (58mm)
                                    </button>
                                    <button onClick={() => { if(lastTransaction) printInvoice(lastTransaction, customers.find(c => c.id === selectedCustomerId), settings) }} className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 transition-colors font-bold text-sm gap-2">
                                        <FileText className="w-6 h-6"/> Nota (Carta)
                                    </button>
                                </div>

                                <button onClick={resetSale} className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl shadow-lg">Nueva Venta</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

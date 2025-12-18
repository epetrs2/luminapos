
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, Calendar, User, Clock, CheckCircle, Package, ArrowRight, X, AlertCircle, ShoppingCart, Trash2, Printer, CreditCard, Banknote, Smartphone, Wallet, Edit2, Check, AlertTriangle, FileText, ChevronRight, MoreHorizontal, Timer, ListChecks, Filter, CheckSquare, Square } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem, Product } from '../types';
import { printOrderInvoice, printProductionSummary } from '../utils/printService';

const OrderCard: React.FC<{
    order: Order;
    statusColor: string;
    onMove?: () => void;
    onPrint: () => void;
    onCancel: () => void;
    prevStatus?: boolean;
    isReady?: boolean;
    onConvert?: () => void;
}> = ({ order, statusColor, onMove, onPrint, onCancel, isReady, onConvert }) => {
    return (
        <div className={`bg-white dark:bg-slate-800 p-4 rounded-xl border-l-4 ${statusColor} shadow-sm group hover:shadow-md transition-all relative`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{order.customerName}</h4>
                    <p className="text-xs text-slate-500 font-mono">#{order.id}</p>
                </div>
                {order.priority === 'HIGH' && (
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">URGENTE</span>
                )}
            </div>
            
            <div className="space-y-1 mb-3">
                {order.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span><span className="font-bold">{item.quantity}</span> x {item.name}</span>
                    </div>
                ))}
                {order.items.length > 3 && (
                    <p className="text-xs text-slate-400 italic">+ {order.items.length - 3} más...</p>
                )}
            </div>

            {order.notes && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg mb-3 border border-yellow-100 dark:border-yellow-900/20">
                    <p className="text-[10px] text-yellow-800 dark:text-yellow-500 italic line-clamp-2">"{order.notes}"</p>
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mb-3">
                <span className="flex items-center gap-1" title="Fecha Creación"><Clock className="w-3 h-3"/> {new Date(order.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                {order.deliveryDate && (
                    <span className={`font-bold flex items-center gap-1 ${new Date(order.deliveryDate) <= new Date() ? 'text-red-500' : 'text-indigo-500'}`} title="Fecha Entrega">
                        <Timer className="w-3 h-3"/> {new Date(order.deliveryDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                    </span>
                )}
            </div>

            <div className="flex justify-between items-center gap-2 mt-auto">
                <div className="flex gap-1">
                    <button onClick={onPrint} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 rounded transition-colors" title="Imprimir"><Printer className="w-4 h-4"/></button>
                    <button onClick={onCancel} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded transition-colors" title="Cancelar"><Trash2 className="w-4 h-4"/></button>
                </div>
                
                {isReady ? (
                    <button onClick={onConvert} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5"/> Entregar
                    </button>
                ) : (
                    <button onClick={onMove} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                        Avanzar <ArrowRight className="w-3.5 h-3.5"/>
                    </button>
                )}
            </div>
        </div>
    );
};

export const Orders: React.FC = () => {
    const { orders, products, customers, addOrder, updateOrderStatus, convertOrderToSale, deleteOrder, settings } = useStore();
    const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
    
    // Create Order State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [notes, setNotes] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [priority, setPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');

    // Edit Price State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Convert Modal State
    const [convertToSaleId, setConvertToSaleId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash');
    const [conversionError, setConversionError] = useState<string | null>(null);

    // Print Modal State
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedOrdersForPrint, setSelectedOrdersForPrint] = useState<Set<string>>(new Set());

    // Delete Confirmation State
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    const activeOrders = orders.filter(o => o.status !== 'COMPLETED').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Get today's date in local ISO string YYYY-MM-DD for the min attribute
    const todayStr = useMemo(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    }, []);

    // Focus input when editing starts
    useEffect(() => {
        if (editingItemId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingItemId]);

    // --- Order Creation Logic ---
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1, originalPrice: product.price }];
        });
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // --- Price Editing Logic ---
    const startEditing = (item: CartItem) => {
        setEditingItemId(item.id);
        setEditPrice(item.price.toString());
    };

    const saveEdit = (id: string) => {
        const newPrice = parseFloat(editPrice);
        if (!isNaN(newPrice) && newPrice >= 0) {
            setCart(prev => prev.map(item => 
                item.id === id ? { ...item, price: newPrice } : item
            ));
        }
        setEditingItemId(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (e.key === 'Enter') saveEdit(id);
        else if (e.key === 'Escape') setEditingItemId(null);
    };

    const handleCreateOrder = () => {
        if (cart.length === 0) return;
        
        const customer = customers.find(c => c.id === selectedCustomerId);
        const orderTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const newOrder: Order = {
            id: '', // Will be generated in StoreContext
            customerId: selectedCustomerId,
            customerName: customer ? customer.name : 'Cliente General',
            date: new Date().toISOString(),
            deliveryDate: deliveryDate, // Ensure this string "YYYY-MM-DD" is passed correctly
            items: [...cart],
            total: orderTotal,
            status: 'PENDING',
            notes,
            priority
        };

        addOrder(newOrder);
        setCart([]);
        setNotes('');
        setDeliveryDate('');
        setSelectedCustomerId('');
        setActiveTab('LIST');
    };

    // --- Delete Logic ---
    const confirmDeleteOrder = () => {
        if (orderToDelete) {
            deleteOrder(orderToDelete);
            setOrderToDelete(null);
        }
    };

    // --- Conversion Logic ---
    const handleConvertClick = (orderId: string) => {
        setConvertToSaleId(orderId);
        setPaymentMethod('cash');
        setConversionError(null);
    };

    const confirmConversion = () => {
        if (!convertToSaleId) return;

        const order = orders.find(o => o.id === convertToSaleId);
        if (!order) return;

        // Credit Validation Logic
        if (paymentMethod === 'credit') {
            const customer = customers.find(c => c.id === order.customerId);
            
            if (!customer) {
                setConversionError("No se puede vender a crédito a Cliente General. Selecciona un cliente registrado.");
                return;
            }

            if (!customer.hasUnlimitedCredit) {
                const availableCredit = customer.creditLimit - customer.currentDebt;
                if (order.total > availableCredit) {
                    setConversionError(`Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)}. Total Pedido: $${order.total.toFixed(2)}`);
                    return;
                }
            }
        }

        convertOrderToSale(convertToSaleId, paymentMethod);
        setConvertToSaleId(null);
    };

    // --- Printing Logic ---
    const handlePrintOrder = (order: Order) => {
        const customer = customers.find(c => c.id === order.customerId);
        printOrderInvoice(order, customer, settings);
    };

    const handleOpenPrintModal = () => {
        if (activeOrders.length === 0) {
            alert("No hay pedidos activos para imprimir.");
            return;
        }
        // Default: Select all active orders initially, or keep logic simple
        const allIds = new Set<string>(activeOrders.map(o => o.id));
        setSelectedOrdersForPrint(allIds);
        setPrintModalOpen(true);
    };

    const togglePrintOrder = (id: string) => {
        const newSet = new Set(selectedOrdersForPrint);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrdersForPrint(newSet);
    };

    const filterPrintSelection = (criteria: 'TODAY_CREATED' | 'TODAY_DELIVERY' | 'TOMORROW_DELIVERY' | 'ALL') => {
        const today = new Date().toDateString();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toDateString();

        const filtered = activeOrders.filter(o => {
            if (criteria === 'ALL') return true;
            if (criteria === 'TODAY_CREATED') return new Date(o.date).toDateString() === today;
            if (criteria === 'TODAY_DELIVERY') return o.deliveryDate && new Date(o.deliveryDate + 'T00:00:00').toDateString() === today;
            if (criteria === 'TOMORROW_DELIVERY') return o.deliveryDate && new Date(o.deliveryDate + 'T00:00:00').toDateString() === tomorrowStr;
            return false;
        });

        setSelectedOrdersForPrint(new Set(filtered.map(o => o.id)));
    };

    const confirmPrintProduction = () => {
        const ordersToPrint = activeOrders.filter(o => selectedOrdersForPrint.has(o.id));
        if (ordersToPrint.length === 0) {
            alert("Selecciona al menos un pedido.");
            return;
        }
        printProductionSummary(ordersToPrint, settings);
        setPrintModalOpen(false);
    };

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
            <div className="max-w-7xl mx-auto h-full flex flex-col">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Pedidos y Producción
                            {activeTab === 'LIST' && <span className="text-sm font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">{activeOrders.length} Activos</span>}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona el flujo de trabajo desde la orden hasta la entrega.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeTab === 'LIST' && (
                            <button
                                onClick={handleOpenPrintModal}
                                className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            >
                                <ListChecks className="w-4 h-4" /> Hoja de Producción
                            </button>
                        )}
                        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-800">
                            <button 
                                onClick={() => setActiveTab('LIST')}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'LIST' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                Tablero Kanban
                            </button>
                            <button 
                                onClick={() => setActiveTab('CREATE')}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'CREATE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <Plus className="w-4 h-4" /> Nuevo Pedido
                            </button>
                        </div>
                    </div>
                </div>

                {activeTab === 'LIST' && (
                    <div className="flex-1 overflow-x-auto pb-6">
                        <div className="flex gap-6 min-w-[1000px] h-full">
                            {/* PENDING COLUMN */}
                            <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800 backdrop-blur-sm">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-900/80 rounded-t-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]"></div>
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Pendientes</h3>
                                    </div>
                                    <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                        {activeOrders.filter(o => o.status === 'PENDING').length}
                                    </span>
                                </div>
                                <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                    {activeOrders.filter(o => o.status === 'PENDING').map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            statusColor="border-yellow-400"
                                            onMove={() => updateOrderStatus(order.id, 'IN_PROGRESS')} 
                                            onPrint={() => handlePrintOrder(order)}
                                            onCancel={() => setOrderToDelete(order.id)}
                                        />
                                    ))}
                                    {activeOrders.filter(o => o.status === 'PENDING').length === 0 && (
                                        <div className="text-center py-10 opacity-40">
                                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 inline-block mb-2">
                                                <Package className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm text-slate-500">Sin pedidos pendientes</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* IN PROGRESS COLUMN */}
                             <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800 backdrop-blur-sm">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-900/80 rounded-t-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">En Producción</h3>
                                    </div>
                                    <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                        {activeOrders.filter(o => o.status === 'IN_PROGRESS').length}
                                    </span>
                                </div>
                                <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                    {activeOrders.filter(o => o.status === 'IN_PROGRESS').map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            statusColor="border-blue-500"
                                            onMove={() => updateOrderStatus(order.id, 'READY')} 
                                            onPrint={() => handlePrintOrder(order)}
                                            onCancel={() => setOrderToDelete(order.id)}
                                            prevStatus 
                                        />
                                    ))}
                                </div>
                            </div>

                             {/* READY COLUMN */}
                             <div className="flex-1 flex flex-col bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200/60 dark:border-slate-800 backdrop-blur-sm">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-900/80 rounded-t-2xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                                        <h3 className="font-bold text-slate-700 dark:text-slate-200">Listos / Por Entregar</h3>
                                    </div>
                                    <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                        {activeOrders.filter(o => o.status === 'READY').length}
                                    </span>
                                </div>
                                <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                    {activeOrders.filter(o => o.status === 'READY').map(order => (
                                        <OrderCard 
                                            key={order.id} 
                                            order={order} 
                                            statusColor="border-emerald-500"
                                            isReady 
                                            onConvert={() => handleConvertClick(order.id)}
                                            onPrint={() => handlePrintOrder(order)}
                                            onCancel={() => setOrderToDelete(order.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Print Selection Modal */}
                {printModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Printer className="w-5 h-5 text-indigo-500" />
                                        Seleccionar Pedidos
                                    </h3>
                                    <p className="text-xs text-slate-500">Evita imprimir lo que ya tienes. Filtra y selecciona.</p>
                                </div>
                                <button onClick={() => setPrintModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Filtros Rápidos</p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    <button onClick={() => filterPrintSelection('TODAY_CREATED')} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap">
                                        Creados Hoy
                                    </button>
                                    <button onClick={() => filterPrintSelection('TODAY_DELIVERY')} className="px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap">
                                        Entrega Hoy
                                    </button>
                                    <button onClick={() => filterPrintSelection('ALL')} className="px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap">
                                        Seleccionar Todo
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2">
                                {activeOrders.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-10">No hay pedidos disponibles.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {activeOrders.map(order => (
                                            <div 
                                                key={order.id} 
                                                onClick={() => togglePrintOrder(order.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedOrdersForPrint.has(order.id) ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-transparent hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800'}`}
                                            >
                                                <div className={`shrink-0 ${selectedOrdersForPrint.has(order.id) ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                    {selectedOrdersForPrint.has(order.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{order.customerName}</p>
                                                        <span className="text-xs font-mono text-slate-400">#{order.id.slice(-4)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-1">
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{order.items.length} items • {order.items[0]?.name}...</p>
                                                        {new Date(order.date).toDateString() === new Date().toDateString() && (
                                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 rounded font-bold">NUEVO</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <button 
                                    onClick={confirmPrintProduction}
                                    disabled={selectedOrdersForPrint.size === 0}
                                    className="w-full py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-lg"
                                >
                                    Imprimir ({selectedOrdersForPrint.size}) Pedidos
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'CREATE' && (
                    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden pb-4">
                        {/* Left: Product Catalog */}
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Buscar producto para agregar..."
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all shadow-sm"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {filteredProducts.map(p => (
                                        <button 
                                            key={p.id}
                                            onClick={() => addToCart(p)}
                                            className="relative group p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left flex flex-col h-32"
                                        >
                                            <div className="flex-1">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">{p.category}</span>
                                                <p className="font-bold text-slate-800 dark:text-white text-sm line-clamp-2 leading-tight">{p.name}</p>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">${p.price}</span>
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-sm">
                                                    <Plus className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Order Summary Ticket */}
                        <div className="w-full lg:w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-full overflow-hidden">
                            <div className="p-5 bg-indigo-600 text-white">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5" /> Nueva Orden
                                </h3>
                                <p className="text-indigo-200 text-xs mt-1">Completa los detalles para producción</p>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <select 
                                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors text-sm"
                                                value={selectedCustomerId}
                                                onChange={e => setSelectedCustomerId(e.target.value)}
                                            >
                                                <option value="">Cliente General</option>
                                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha Entrega</label>
                                            <input 
                                                type="date"
                                                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none text-sm focus:border-indigo-500 transition-colors cursor-pointer"
                                                value={deliveryDate}
                                                min={todayStr} // Fixed local time min date
                                                onChange={e => setDeliveryDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                                            <select 
                                                className={`w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 outline-none text-sm font-medium focus:border-indigo-500 transition-colors ${priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 dark:bg-slate-800 dark:text-white'}`}
                                                value={priority}
                                                onChange={e => setPriority(e.target.value as any)}
                                            >
                                                <option value="NORMAL">Normal</option>
                                                <option value="HIGH">Alta 🔥</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas de Producción</label>
                                        <textarea 
                                            rows={2}
                                            className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none text-sm focus:border-indigo-500 transition-colors resize-none"
                                            placeholder="Detalles especiales..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Items ({cart.length})</label>
                                    {cart.length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                            <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-xs text-slate-400">Carrito vacío</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <span className="bg-white dark:bg-slate-700 w-6 h-6 flex items-center justify-center rounded text-xs font-bold shadow-sm">{item.quantity}</span>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{item.name}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        {editingItemId === item.id ? (
                                                            <div className="flex items-center">
                                                                <input 
                                                                    ref={editInputRef}
                                                                    type="number" 
                                                                    value={editPrice}
                                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                                    onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                                                                    className="w-16 text-right text-sm p-1 rounded border border-indigo-300 outline-none"
                                                                />
                                                                <button onClick={() => saveEdit(item.id)} className="ml-1 text-emerald-600"><Check className="w-4 h-4"/></button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => startEditing(item)} className="text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors">
                                                                ${(item.price * item.quantity).toFixed(2)}
                                                            </button>
                                                        )}
                                                        <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-slate-500 font-medium">Total Estimado</span>
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">${cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}</span>
                                </div>

                                <button 
                                    onClick={handleCreateOrder}
                                    disabled={cart.length === 0}
                                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    Confirmar Pedido <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Convert to Sale Modal */}
            {convertToSaleId && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.2s_ease-out]">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Finalizar y Vender</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Esto generará un ticket de venta y <strong>descontará el inventario</strong> automáticamente.
                            </p>
                        </div>

                        {conversionError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-lg flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{conversionError}</span>
                            </div>
                        )}

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Método de Pago</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => {setPaymentMethod('cash'); setConversionError(null);}} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    <Banknote className="w-5 h-5" />
                                    <span className="text-xs font-bold">Efectivo</span>
                                </button>
                                <button onClick={() => {setPaymentMethod('card'); setConversionError(null);}} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    <CreditCard className="w-5 h-5" />
                                    <span className="text-xs font-bold">Tarjeta</span>
                                </button>
                                <button onClick={() => {setPaymentMethod('transfer'); setConversionError(null);}} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'transfer' ? 'bg-violet-50 border-violet-500 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    <Smartphone className="w-5 h-5" />
                                    <span className="text-xs font-bold">Transf.</span>
                                </button>
                                <button onClick={() => {setPaymentMethod('credit'); setConversionError(null);}} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === 'credit' ? 'bg-pink-50 border-pink-500 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                    <Wallet className="w-5 h-5" />
                                    <span className="text-xs font-bold">Crédito</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setConvertToSaleId(null)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium">Cancelar</button>
                            <button onClick={confirmConversion} className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none">Confirmar Venta</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {orderToDelete && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">¿Cancelar Pedido?</h3>
                        <p className="text-sm text-slate-500 mb-6">Esta acción eliminará el pedido permanentemente. ¿Estás seguro?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setOrderToDelete(null)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium">No, Volver</button>
                            <button onClick={confirmDeleteOrder} className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg">Sí, Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

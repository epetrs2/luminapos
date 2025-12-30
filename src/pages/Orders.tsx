import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Clock, CheckCircle, Package, ArrowRight, X, Printer, Edit2, ListChecks, CheckSquare, Square, FileEdit, Receipt, GripVertical, User, Save, Minus, Scan, Trash2, Layers, PackagePlus, AlertTriangle, Timer, FileText, ArrowUpRight, ChefHat, Factory, Truck, QrCode, AlertCircle } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem, Product, AppView, ProductVariant } from '../types';
import { printOrderInvoice, printProductionSummary, printProductionTicket, printProductionMasterList } from '../utils/printService';

// --- SUB-COMPONENT: ORDER CARD (TICKET STYLE) ---
const OrderCard = React.memo(({ 
    order, 
    statusConfig, 
    onAction, // Generic action handler
    onPrint, 
    onEdit,
    onDelete,
    onDragStart, 
    onTouchStart
}: {
    order: Order;
    statusConfig: { color: string, icon: any };
    onAction: () => void;
    onPrint: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onTouchStart: (e: React.TouchEvent, id: string, name: string, element: HTMLElement | null) => void;
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const isUrgent = order.priority === 'HIGH';
    const isReady = order.status === 'READY';

    return (
        <div 
            ref={cardRef}
            draggable
            onDragStart={(e) => onDragStart(e, order.id)}
            className={`
                group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 
                hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-300
                select-none overflow-hidden flex flex-col
            `}
        >
            {/* Status Stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusConfig.color}`}></div>

            {/* Drag Handle (Mobile) */}
            <div 
                className="absolute top-0 right-0 w-12 h-12 flex items-start justify-end p-2 z-20 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 md:opacity-0 group-hover:opacity-100 transition-opacity touch-none"
                onTouchStart={(e) => onTouchStart(e, order.id, order.customerName, cardRef.current)}
            >
                <GripVertical className="w-5 h-5" />
            </div>

            <div className="p-4 pl-5 flex-1">
                {/* Header */}
                <div className="flex justify-between items-start mb-3 pr-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded">
                                #{order.id.slice(-4)}
                            </span>
                            {isUrgent && (
                                <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> URGENTE
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{order.customerName}</h4>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 mb-4 relative">
                    <div className="absolute left-0 top-1 bottom-1 w-px bg-slate-100 dark:bg-slate-700"></div>
                    {order.items.slice(0, 4).map((item: CartItem, idx: number) => (
                        <div key={idx} className="flex items-baseline gap-2 text-xs pl-3">
                            <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0 self-center"></div>
                            <span className="font-black text-slate-700 dark:text-slate-300">{item.quantity}</span>
                            <span className="text-slate-500 dark:text-slate-400 line-clamp-1">{item.name}</span>
                        </div>
                    ))}
                    {order.items.length > 4 && (
                        <p className="text-[10px] text-slate-400 pl-3 italic">+ {order.items.length - 4} más...</p>
                    )}
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    {order.deliveryDate && (
                        <div className={`flex items-center gap-1 ${new Date(order.deliveryDate) <= new Date() ? 'text-orange-500 font-bold' : 'text-indigo-500'}`}>
                            <Timer className="w-3 h-3" />
                            {new Date(order.deliveryDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-700">
                <div className="flex gap-1" onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                    <button onClick={onPrint} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Printer className="w-4 h-4"/></button>
                    <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>

                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction(); }}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95
                        ${isReady 
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none' 
                            : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 md:hidden'}
                    `}
                >
                    {isReady ? <><CheckCircle className="w-3.5 h-3.5"/> Entregar</> : <><ArrowRight className="w-3.5 h-3.5"/> Mover</>}
                </button>
            </div>
        </div>
    );
});

// --- SUB-COMPONENT: PRODUCTION RESULT MODAL (Unified Delivery/Surplus) ---
const ProductionResultModal = ({ order, onClose, onConfirm }: { order: Order, onClose: () => void, onConfirm: (items: any[]) => void }) => {
    // Initialize with Ordered Quantities
    const [resultItems, setResultItems] = useState<{id: string, variantId?: string, quantity: number}[]>(
        order.items.map((i: CartItem) => ({ id: i.id, variantId: i.variantId, quantity: i.quantity }))
    );

    const handleQtyChange = (itemId: string, variantId: string | undefined, val: number) => {
        setResultItems(prev => prev.map(p => (p.id === itemId && p.variantId === variantId) ? { ...p, quantity: Math.max(0, val) } : p));
    };

    const hasDiff = resultItems.some(res => {
        const original = order.items.find((i: CartItem) => i.id === res.id && i.variantId === res.variantId);
        return original && res.quantity !== original.quantity;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out] backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Factory className="w-6 h-6 text-indigo-500" /> Resultado de Producción
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Confirma las cantidades reales fabricadas.</p>
                    </div>
                    <button onClick={onClose}><X className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-1 mb-6 custom-scrollbar">
                    {order.items.map((item: CartItem, idx: number) => {
                        const current = resultItems.find(r => r.id === item.id && r.variantId === item.variantId)?.quantity || 0;
                        const diff = current - item.quantity;
                        
                        return (
                            <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${diff !== 0 ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{item.name}</p>
                                    <div className="flex gap-2 text-[10px] mt-0.5">
                                        <span className="text-slate-500">Ordenado: <strong>{item.quantity}</strong></span>
                                        {diff > 0 && <span className="text-emerald-600 font-bold bg-emerald-100 px-1.5 rounded">+{diff} Sobrante</span>}
                                        {diff < 0 && <span className="text-red-600 font-bold bg-red-100 px-1.5 rounded">{diff} Faltante</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleQtyChange(item.id, item.variantId, current - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-white"><Minus className="w-4 h-4"/></button>
                                    <input 
                                        type="number" 
                                        className="w-12 text-center font-bold bg-transparent outline-none text-slate-800 dark:text-white"
                                        value={current}
                                        onChange={(e) => handleQtyChange(item.id, item.variantId, parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => handleQtyChange(item.id, item.variantId, current + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-white"><Plus className="w-4 h-4"/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4" /> Acciones Automáticas
                    </h4>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500"/> El stock se actualizará según lo producido.</li>
                        <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500"/> La orden se enviará a Caja para cobrar.</li>
                        {hasDiff && <li className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold"><AlertCircle className="w-3 h-3"/> Se registrarán las diferencias en el inventario.</li>}
                    </ul>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                    <button onClick={() => onConfirm(resultItems)} className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Confirmar y Finalizar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- QR SCANNER MODAL ---
const ScannerModal = ({ onClose, onScan }: { onClose: () => void, onScan: (id: string) => void }) => {
    const ref = useRef<any>(null);
    useEffect(() => {
        const scanner = new (window as any).Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        ref.current = scanner;
        scanner.render((txt: string) => { scanner.clear(); onScan(txt); }, () => {});
        return () => { try { ref.current.clear(); } catch(e) {} };
    }, []);
    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden relative">
                <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full"><X className="w-6 h-6"/></button>
                <div className="p-6 text-center">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Escanear Ticket</h3>
                    <div id="qr-reader" className="rounded-xl overflow-hidden"></div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
export const Orders: React.FC<{ setView?: (view: AppView) => void }> = ({ setView }) => {
    const { orders, products, customers, addOrder, updateOrder, updateOrderStatus, deleteOrder, settings, sendOrderToPOS, btDevice, sendBtData, notify, finalizeProduction } = useStore();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'BOARD' | 'CREATE'>('BOARD');
    const [createStep, setCreateStep] = useState<'CATALOG' | 'DETAILS'>('CATALOG');
    
    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<'ALL'|'HIGH'>('ALL');
    
    // Create Order State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [newOrderMeta, setNewOrderMeta] = useState({ customerId: '', notes: '', deliveryDate: '', priority: 'NORMAL' as 'NORMAL'|'HIGH' });
    const [productSearch, setProductSearch] = useState('');

    // Active Logic State
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [finishingOrder, setFinishingOrder] = useState<Order | null>(null);
    const [printSelectionMode, setPrintSelectionMode] = useState(false);
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Drag & Drop State
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const dragInfoRef = useRef<{ id: string, originalEl: HTMLElement } | null>(null);
    const ghostRef = useRef<HTMLDivElement>(null);

    const todayStr = useMemo(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    }, []);

    // --- DERIVED DATA ---
    const boardOrders = useMemo(() => {
        let list = orders.filter(o => o.status !== 'COMPLETED').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (filterPriority === 'HIGH') list = list.filter(o => o.priority === 'HIGH');
        if (searchTerm) list = list.filter(o => o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm));
        return list;
    }, [orders, filterPriority, searchTerm]);

    const catalogProducts = useMemo(() => {
        if (!productSearch) return products.slice(0, 20); // Show initial batch
        const lower = productSearch.toLowerCase();
        return products.filter((p: Product) => p.isActive && (p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower))).slice(0, 20);
    }, [products, productSearch]);

    // --- ACTIONS ---
    const handleStatusChange = (id: string, nextStatus: string) => {
        if (nextStatus === 'READY') {
            // Check if we are moving TO ready (Production done)
             // Optional: Trigger finish modal here if you want to verify production quantity before moving to Ready
             // For now, simple move
        }
        updateOrderStatus(id, nextStatus);
        if (navigator.vibrate) navigator.vibrate(30);
    };

    const handleFinishOrder = (order: Order) => {
        setFinishingOrder(order);
    };

    const handleConfirmFinish = (items: any[]) => {
        if (finishingOrder) {
            finalizeProduction(finishingOrder.id, items);
            notify("Completado", "Orden enviada a caja y stock actualizado.", "success");
            setFinishingOrder(null);
            if (setView) setView(AppView.POS);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm("¿Eliminar este pedido permanentemente?")) {
            deleteOrder(id);
        }
    };

    const handlePrintSingle = useCallback((order: Order) => {
        const customer = customers.find(c => c.id === order.customerId);
        printOrderInvoice(order, customer, settings);
    }, [customers, settings]);

    // --- CREATE LOGIC ---
    const addToCart = (product: Product, variantId?: string) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === product.id && i.variantId === variantId);
            if (existing) return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
            
            const variant = variantId ? product.variants?.find((v: ProductVariant) => v.id === variantId) : null;
            return [...prev, {
                ...product,
                price: variant ? variant.price : product.price,
                quantity: 1,
                variantId,
                variantName: variant?.name
            }];
        });
    };

    const createOrder = () => {
        if (cart.length === 0) return;
        const customer = customers.find(c => c.id === newOrderMeta.customerId);
        const total = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        
        addOrder({
            id: '', // Generated by context
            customerId: newOrderMeta.customerId,
            customerName: customer ? customer.name : 'Cliente General',
            date: new Date().toISOString(),
            deliveryDate: newOrderMeta.deliveryDate,
            items: cart,
            total,
            status: 'PENDING',
            notes: newOrderMeta.notes,
            priority: newOrderMeta.priority
        });

        // Reset
        setCart([]);
        setNewOrderMeta({ customerId: '', notes: '', deliveryDate: '', priority: 'NORMAL' });
        setActiveTab('BOARD');
        notify("Pedido Creado", "Se ha agregado a la lista de pendientes.", "success");
    };

    // --- PRINT BATCH LOGIC ---
    const handleBatchPrint = async (type: 'LIST' | 'TICKETS') => {
        const targetOrders = boardOrders.filter(o => selectedOrders.has(o.id));
        if (targetOrders.length === 0) { notify("Error", "Selecciona pedidos primero.", "error"); return; }

        if (type === 'LIST') {
            printProductionMasterList(targetOrders, settings, products, sendBtData);
        } else {
            // Print Tickets Sequentially
            if (!btDevice) { notify("Error", "Conecta impresora Bluetooth.", "error"); return; }
            for (const order of targetOrders) {
                // TRACKER LOGIC
                const stockTracker = new Map<string, number>();
                products.forEach((p: Product) => {
                    stockTracker.set(p.id, p.stock);
                    if (p.variants) {
                        p.variants.forEach((v: ProductVariant) => stockTracker.set(`${p.id}-${v.id}`, v.stock));
                    }
                });

                await printProductionTicket(order, settings, products, sendBtData, stockTracker);
                
                // Update tracker: Deduct what was theoretically used by this order
                order.items.forEach((item: CartItem) => {
                    const trackKey = item.variantId ? `${item.id}-${item.variantId}` : item.id;
                    const currentStock = stockTracker.get(trackKey) || 0;
                    const consumed = Math.min(item.quantity, Math.max(0, currentStock));
                    stockTracker.set(trackKey, currentStock - consumed);
                });

                await new Promise(r => setTimeout(r, 2000)); // Delay between tickets
            }
        }
        setPrintSelectionMode(false);
        setSelectedOrders(new Set());
    };

    // --- DRAG AND DROP ENGINE (Reusable from previous, streamlined) ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("id", id);
        e.dataTransfer.effectAllowed = "move";
    };
    
    const onDrop = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverCol(null);
        const id = e.dataTransfer.getData("id");
        if (id) handleStatusChange(id, status);
    };

    // Mobile Touch Logic
    const onTouchStart = useCallback((e: React.TouchEvent, id: string, name: string, el: HTMLElement | null) => {
        if (!el) return;
        if (navigator.vibrate) navigator.vibrate(50);
        const touch = e.touches[0];
        dragInfoRef.current = { id, originalEl: el };
        
        el.style.opacity = '0.4';
        if (ghostRef.current) {
            ghostRef.current.style.opacity = '1';
            ghostRef.current.innerText = name;
            ghostRef.current.style.transform = `translate(${touch.clientX + 10}px, ${touch.clientY + 10}px)`;
        }
    }, []);

    useEffect(() => {
        const onMove = (e: TouchEvent) => {
            if (!dragInfoRef.current || !ghostRef.current) return;
            e.preventDefault();
            const t = e.touches[0];
            ghostRef.current.style.transform = `translate(${t.clientX + 10}px, ${t.clientY + 10}px)`;
            
            // Highlight Logic
            const el = document.elementFromPoint(t.clientX, t.clientY);
            const col = el?.closest('[data-col]');
            // Simple visual feedback could be added here
        };
        const onEnd = (e: TouchEvent) => {
            if (!dragInfoRef.current) return;
            dragInfoRef.current.originalEl.style.opacity = '1';
            if (ghostRef.current) ghostRef.current.style.opacity = '0';
            
            const t = e.changedTouches[0];
            const el = document.elementFromPoint(t.clientX, t.clientY);
            const col = el?.closest('[data-col]');
            if (col) {
                const status = col.getAttribute('data-col');
                if (status) handleStatusChange(dragInfoRef.current.id, status);
            }
            dragInfoRef.current = null;
        };
        window.addEventListener('touchmove', onMove, {passive: false});
        window.addEventListener('touchend', onEnd);
        return () => {
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, []);

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200 flex flex-col">
            {/* Ghost Element for Drag */}
            <div ref={ghostRef} className="fixed top-0 left-0 z-[9999] pointer-events-none bg-indigo-600 text-white px-4 py-2 rounded-full shadow-xl font-bold opacity-0 transition-opacity duration-75 text-sm whitespace-nowrap">Moving...</div>

            {/* Modals */}
            {finishingOrder && <ProductionResultModal order={finishingOrder} onClose={() => setFinishingOrder(null)} onConfirm={handleConfirmFinish} />}
            {isScannerOpen && <ScannerModal onClose={() => setIsScannerOpen(false)} onScan={(id) => { setIsScannerOpen(false); /* Handle Scan Logic */ }} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Factory className="w-8 h-8 text-indigo-500" /> Producción
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Gestiona el ciclo de vida de los pedidos.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                    <button onClick={() => setActiveTab('BOARD')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'BOARD' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}>Tablero</button>
                    <button onClick={() => setActiveTab('CREATE')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'CREATE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}><Plus className="w-4 h-4"/> Nuevo Pedido</button>
                </div>
            </div>

            {/* CONTENT: BOARD */}
            {activeTab === 'BOARD' && (
                <div className="flex flex-col h-full flex-1 min-h-0">
                    {/* Controls */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                            <input type="text" placeholder="Buscar pedido..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => setFilterPriority(p => p === 'ALL' ? 'HIGH' : 'ALL')} className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 ${filterPriority === 'HIGH' ? 'bg-red-100 border-red-200 text-red-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                <AlertTriangle className="w-4 h-4"/> Urgentes
                            </button>
                            <button onClick={() => setPrintSelectionMode(!printSelectionMode)} className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 ${printSelectionMode ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                <ListChecks className="w-4 h-4"/> Lote
                            </button>
                        </div>
                    </div>

                    {/* Batch Actions Bar */}
                    {printSelectionMode && (
                        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg mb-6 flex justify-between items-center animate-[slideUp_0.2s]">
                            <span className="font-bold text-sm">{selectedOrders.size} seleccionados</span>
                            <div className="flex gap-2">
                                <button onClick={() => handleBatchPrint('TICKETS')} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold flex items-center gap-2"><Printer className="w-4 h-4"/> Tickets</button>
                                <button onClick={() => handleBatchPrint('LIST')} className="px-4 py-2 bg-white text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"><Layers className="w-4 h-4"/> Lista Maestra</button>
                                <button onClick={() => {setPrintSelectionMode(false); setSelectedOrders(new Set())}} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-4 h-4"/></button>
                            </div>
                        </div>
                    )}

                    {/* Kanban Board */}
                    <div className="flex-1 overflow-x-auto pb-4" ref={scrollRef}>
                        <div className="flex gap-6 min-w-[1000px] h-full">
                            {[
                                { id: 'PENDING', title: 'Por Hacer', color: 'bg-yellow-400', border: 'border-yellow-400', icon: ChefHat },
                                { id: 'IN_PROGRESS', title: 'En Proceso', color: 'bg-blue-500', border: 'border-blue-500', icon: Factory },
                                { id: 'READY', title: 'Listo / Entrega', color: 'bg-emerald-500', border: 'border-emerald-500', icon: Truck },
                            ].map(col => (
                                <div 
                                    key={col.id} 
                                    data-col={col.id}
                                    onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                                    onDragLeave={() => setDragOverCol(null)}
                                    onDrop={e => onDrop(e, col.id)}
                                    className={`
                                        flex-1 flex flex-col rounded-2xl border-2 transition-colors duration-200
                                        ${dragOverCol === col.id ? 'bg-indigo-50/50 border-indigo-400' : 'bg-slate-100/50 dark:bg-slate-900/30 border-transparent'}
                                    `}
                                >
                                    {/* Column Header */}
                                    <div className="p-4 flex items-center justify-between sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 rounded-t-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${col.color.replace('bg-', 'bg-opacity-20 text-').replace('500', '600').replace('400', '600')}`}>
                                                <col.icon className="w-5 h-5"/>
                                            </div>
                                            <span className="font-black text-slate-700 dark:text-slate-200">{col.title}</span>
                                        </div>
                                        <span className="bg-white dark:bg-slate-800 text-xs font-bold px-2.5 py-1 rounded-full text-slate-500 border border-slate-200 dark:border-slate-700">
                                            {boardOrders.filter(o => o.status === col.id).length}
                                        </span>
                                    </div>

                                    {/* Cards Container */}
                                    <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                                        {boardOrders.filter(o => o.status === col.id).map(order => (
                                            <div key={order.id} className="relative group/card">
                                                {printSelectionMode && (
                                                    <div className="absolute top-2 left-2 z-30" onClick={e => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedOrders.has(order.id)}
                                                            onChange={() => {
                                                                const next = new Set(selectedOrders);
                                                                next.has(order.id) ? next.delete(order.id) : next.add(order.id);
                                                                setSelectedOrders(next);
                                                            }}
                                                            className="w-5 h-5 accent-indigo-600 cursor-pointer shadow-sm"
                                                        />
                                                    </div>
                                                )}
                                                <OrderCard 
                                                    order={order}
                                                    statusConfig={{ color: col.color, icon: col.icon }}
                                                    onAction={() => col.id === 'READY' ? handleFinishOrder(order) : handleStatusChange(order.id, col.id === 'PENDING' ? 'IN_PROGRESS' : 'READY')}
                                                    onPrint={() => handlePrintSingle(order)}
                                                    onEdit={() => {}} // Hook up edit later if needed
                                                    onDelete={() => handleDelete(order.id)}
                                                    onDragStart={handleDragStart}
                                                    onTouchStart={onTouchStart}
                                                />
                                            </div>
                                        ))}
                                        {boardOrders.filter(o => o.status === col.id).length === 0 && (
                                            <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl m-2 opacity-50">
                                                <Package className="w-8 h-8 mb-2" />
                                                <span className="text-xs font-bold uppercase">Vacío</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: CREATE */}
            {activeTab === 'CREATE' && (
                <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden pb-4">
                    {/* Catalog (Left) */}
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                                <input 
                                    type="text" 
                                    placeholder="Buscar producto..." 
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                                    value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {catalogProducts.map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="text-left p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all group flex flex-col h-full"
                                    >
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{p.category}</p>
                                            <p className="font-bold text-slate-800 dark:text-white text-sm line-clamp-2">{p.name}</p>
                                        </div>
                                        <div className="flex justify-between items-end mt-3 pt-3 border-t border-slate-50 dark:border-slate-700">
                                            <span className="font-black text-indigo-600 dark:text-indigo-400">${p.price}</span>
                                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Plus className="w-4 h-4"/></div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Form (Right) */}
                    <div className="w-full lg:w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-full">
                        <div className="p-5 bg-slate-900 dark:bg-slate-800 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><FileEdit className="w-5 h-5"/> Nuevo Pedido</h3>
                            <span className="text-xs bg-white/20 px-2 py-1 rounded">{cart.length} items</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Cliente</label>
                                    <div className="relative mt-1">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <select 
                                            value={newOrderMeta.customerId}
                                            onChange={e => setNewOrderMeta({...newOrderMeta, customerId: e.target.value})}
                                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium dark:text-white appearance-none"
                                        >
                                            <option value="">Cliente General</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Entrega</label>
                                        <input 
                                            type="date" 
                                            value={newOrderMeta.deliveryDate} 
                                            onChange={e => setNewOrderMeta({...newOrderMeta, deliveryDate: e.target.value})} 
                                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white" 
                                            min={todayStr}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Prioridad</label>
                                        <select 
                                            value={newOrderMeta.priority} 
                                            onChange={e => setNewOrderMeta({...newOrderMeta, priority: e.target.value as any})}
                                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold dark:text-white"
                                        >
                                            <option value="NORMAL">Normal</option>
                                            <option value="HIGH">Alta 🔥</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Notas</label>
                                    <textarea 
                                        rows={2} 
                                        value={newOrderMeta.notes} 
                                        onChange={e => setNewOrderMeta({...newOrderMeta, notes: e.target.value})}
                                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white resize-none" 
                                        placeholder="Instrucciones..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Resumen Items</p>
                                <div className="space-y-2">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{item.name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs bg-white dark:bg-slate-700 px-1.5 rounded border border-slate-200 dark:border-slate-600">x{item.quantity}</span>
                                                    <span className="text-xs text-indigo-600 font-bold">${item.price}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 p-1"><X className="w-4 h-4"/></button>
                                        </div>
                                    ))}
                                    {cart.length === 0 && <p className="text-center text-slate-400 text-sm italic">Agrega productos</p>}
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-slate-500 font-medium">Total Estimado</span>
                                <span className="text-2xl font-black text-slate-800 dark:text-white">${cart.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={createOrder}
                                disabled={cart.length === 0}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                Crear Pedido <ArrowRight className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

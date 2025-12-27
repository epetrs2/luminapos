
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, Clock, CheckCircle, Package, ArrowRight, X, AlertCircle, ShoppingCart, Trash2, Printer, Edit2, Check, AlertTriangle, FileText, ChevronRight, MoreHorizontal, Timer, ListChecks, Filter, CheckSquare, Square, FileEdit, Receipt, GripVertical, User } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem, Product, AppView } from '../types';
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
    // DnD Props
    onDragStart: (e: React.DragEvent, id: string) => void;
    // Mobile Touch Props
    onTouchStart: (e: React.TouchEvent, id: string) => void;
    isDragging: boolean;
}> = ({ order, statusColor, onMove, onPrint, onCancel, isReady, onConvert, onDragStart, onTouchStart, isDragging }) => {
    return (
        <div 
            className={`bg-white dark:bg-slate-800 p-4 rounded-xl border-l-4 ${statusColor} shadow-sm group transition-all relative select-none ${isDragging ? 'opacity-30 scale-95' : 'hover:shadow-md'}`}
            draggable
            onDragStart={(e) => onDragStart(e, order.id)}
        >
            {/* Mobile Drag Handle - Critical for touch UX */}
            <div 
                className="absolute top-0 right-0 p-2 w-14 h-14 flex justify-end items-start z-20 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ touchAction: 'none' }} // Prevents browser scrolling initiated on the handle
                onTouchStart={(e) => onTouchStart(e, order.id)}
            >
                <GripVertical className="w-6 h-6" /> 
            </div>

            <div className="flex justify-between items-start mb-2 pr-10">
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-sm line-clamp-1">{order.customerName}</h4>
                    <p className="text-xs text-slate-500 font-mono">#{order.id}</p>
                </div>
                {order.priority === 'HIGH' && (
                    <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">URGENTE</span>
                )}
            </div>
            
            <div className="space-y-1 mb-3 pointer-events-none">
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

            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-2 mb-3 pointer-events-none">
                <span className="flex items-center gap-1" title="Fecha Creación"><Clock className="w-3 h-3"/> {new Date(order.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                {order.deliveryDate && (
                    <span className={`font-bold flex items-center gap-1 ${new Date(order.deliveryDate) <= new Date() ? 'text-red-500' : 'text-indigo-500'}`} title="Fecha Entrega">
                        <Timer className="w-3 h-3"/> {new Date(order.deliveryDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                    </span>
                )}
            </div>

            <div className="flex justify-between items-center gap-2 mt-auto relative z-10">
                <div className="flex gap-1" onTouchStart={(e) => e.stopPropagation()}>
                    <button onClick={onPrint} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 rounded transition-colors" title="Imprimir"><Printer className="w-4 h-4"/></button>
                    <button onClick={onCancel} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 rounded transition-colors" title="Cancelar"><Trash2 className="w-4 h-4"/></button>
                </div>
                
                {isReady ? (
                    <button onClick={onConvert} onTouchStart={(e) => e.stopPropagation()} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5"/> Entregar
                    </button>
                ) : (
                    <button onClick={onMove} onTouchStart={(e) => e.stopPropagation()} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm md:hidden">
                        Avanzar <ArrowRight className="w-3.5 h-3.5"/>
                    </button>
                )}
            </div>
        </div>
    );
};

interface OrdersProps {
    setView?: (view: AppView) => void;
}

export const Orders: React.FC<OrdersProps> = ({ setView }) => {
    const { orders, products, customers, addOrder, updateOrderStatus, deleteOrder, settings, sendOrderToPOS } = useStore();
    const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
    const [mobileCreateStep, setMobileCreateStep] = useState<'CATALOG' | 'DETAILS'>('CATALOG');
    
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

    // Print Modal State
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedOrdersForPrint, setSelectedOrdersForPrint] = useState<Set<string>>(new Set());

    // Delete Confirmation State
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    // Desktop DnD State
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // --- HIGH PERFORMANCE MOBILE DRAG ENGINE ---
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ghostRef = useRef<HTMLDivElement>(null); 
    const [touchDraggingId, setTouchDraggingId] = useState<string | null>(null);
    
    // Refs for performance (Avoid React State updates during drag)
    const columnRectsRef = useRef<{[key: string]: {rect: DOMRect, el: HTMLElement}}>({}); 
    const currentOverColumnRef = useRef<string | null>(null);
    const autoScrollSpeedRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    const draggedOrder = useMemo(() => orders.find(o => o.id === touchDraggingId), [touchDraggingId, orders]);

    const activeOrders = orders.filter(o => o.status !== 'COMPLETED').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm));

    const todayStr = useMemo(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    }, []);

    useEffect(() => {
        if (editingItemId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingItemId]);

    // --- AUTO SCROLL ENGINE ---
    const startAutoScroll = () => {
        if (animationFrameRef.current) return;
        
        const scrollLoop = () => {
            if (scrollContainerRef.current && autoScrollSpeedRef.current !== 0) {
                scrollContainerRef.current.scrollLeft += autoScrollSpeedRef.current;
            }
            animationFrameRef.current = requestAnimationFrame(scrollLoop);
        };
        animationFrameRef.current = requestAnimationFrame(scrollLoop);
    };

    const stopAutoScroll = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        autoScrollSpeedRef.current = 0;
    };

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
            id: '',
            customerId: selectedCustomerId,
            customerName: customer ? customer.name : 'Cliente General',
            date: new Date().toISOString(),
            deliveryDate: deliveryDate, 
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
        setMobileCreateStep('CATALOG');
    };

    // --- Delete Logic ---
    const confirmDeleteOrder = () => {
        if (orderToDelete) {
            deleteOrder(orderToDelete);
            setOrderToDelete(null);
        }
    };

    // --- Deliver to POS Logic ---
    const handleDeliverToPOS = (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            sendOrderToPOS(order);
            if (setView) {
                setView(AppView.POS);
            }
        }
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
        printProductionSummary(ordersToPrint, settings, products);
        setPrintModalOpen(false);
    };

    // --- DESKTOP DRAG AND DROP HANDLERS ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("orderId", id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverColumn(status);
    };

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData("orderId");
        setDragOverColumn(null);
        if (orderId) {
            updateOrderStatus(orderId, newStatus);
        }
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    // --- MOBILE TOUCH DRAG AND DROP HANDLERS (OPTIMIZED 60FPS) ---
    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        if (navigator.vibrate) navigator.vibrate(50);
        
        const touch = e.touches[0];
        setTouchDraggingId(id);
        
        // CACHE COLUMN RECTS
        const cols = document.querySelectorAll<HTMLElement>('[data-column-status]');
        const rects: {[key: string]: {rect: DOMRect, el: HTMLElement}} = {};
        cols.forEach(el => {
            const status = el.getAttribute('data-column-status');
            if (status) rects[status] = { rect: el.getBoundingClientRect(), el: el };
        });
        columnRectsRef.current = rects;

        // Lock scroll globally
        document.body.style.overflow = 'hidden'; 
        
        // Initialize ghost position immediately
        if (ghostRef.current) {
            ghostRef.current.style.transform = `translate3d(${touch.clientX - 100}px, ${touch.clientY - 50}px, 0) rotate(3deg)`;
            ghostRef.current.style.opacity = '0.95';
        }

        startAutoScroll();
    };

    // Global Window Listeners - Passive: false is CRITICAL
    useEffect(() => {
        if (!touchDraggingId) return;

        const handleWindowTouchMove = (e: TouchEvent) => {
            e.preventDefault(); // This is the key to preventing the "lag" / scroll interference
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            
            // 1. UPDATE GHOST (Direct DOM)
            if (ghostRef.current) {
                ghostRef.current.style.transform = `translate3d(${x - 100}px, ${y - 50}px, 0) rotate(3deg)`;
            }

            // 2. DETECT COLUMN HOVER (Math instead of React State)
            let foundStatus: string | null = null;
            for (const [status, data] of Object.entries(columnRectsRef.current)) {
                const r = (data as {rect: DOMRect}).rect;
                // Add margins for easier detection
                if (x >= r.left && x <= r.right && y >= r.top - 50 && y <= r.bottom + 50) {
                    foundStatus = status;
                    break;
                }
            }

            // 3. APPLY HIGHLIGHT CLASS DIRECTLY (Bypassing React Render Cycle)
            if (currentOverColumnRef.current !== foundStatus) {
                // Remove class from old
                if (currentOverColumnRef.current && columnRectsRef.current[currentOverColumnRef.current]) {
                    columnRectsRef.current[currentOverColumnRef.current].el.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/30');
                }
                // Add class to new
                if (foundStatus && columnRectsRef.current[foundStatus]) {
                    columnRectsRef.current[foundStatus].el.classList.add('ring-4', 'ring-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/30');
                }
                currentOverColumnRef.current = foundStatus;
            }

            // 4. AUTO SCROLL CALCULATION
            const screenW = window.innerWidth;
            const edgeZone = 60; // px from edge
            
            if (x < edgeZone) {
                autoScrollSpeedRef.current = -15; 
            } else if (x > screenW - edgeZone) {
                autoScrollSpeedRef.current = 15; 
            } else {
                autoScrollSpeedRef.current = 0;
            }
        };

        const handleWindowTouchEnd = (e: TouchEvent) => {
            stopAutoScroll();
            document.body.style.overflow = ''; // Unlock scroll
            
            // Cleanup Highlights
            if (currentOverColumnRef.current && columnRectsRef.current[currentOverColumnRef.current]) {
                columnRectsRef.current[currentOverColumnRef.current].el.classList.remove('ring-4', 'ring-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/30');
            }

            // Logic to drop
            const finalStatus = currentOverColumnRef.current;
            if (finalStatus) {
                const order = orders.find(o => o.id === touchDraggingId);
                if (order && order.status !== finalStatus) {
                    updateOrderStatus(touchDraggingId, finalStatus);
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Success vibration
                }
            }
            
            // Reset
            setTouchDraggingId(null);
            currentOverColumnRef.current = null;
            if (ghostRef.current) {
                ghostRef.current.style.opacity = '0';
                ghostRef.current.style.transform = 'translate3d(-1000px, -1000px, 0)'; 
            }
        };

        // Attach non-passive listeners
        window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
        window.addEventListener('touchend', handleWindowTouchEnd);
        window.addEventListener('touchcancel', handleWindowTouchEnd);

        return () => {
            stopAutoScroll();
            window.removeEventListener('touchmove', handleWindowTouchMove);
            window.removeEventListener('touchend', handleWindowTouchEnd);
            window.removeEventListener('touchcancel', handleWindowTouchEnd);
            document.body.style.overflow = ''; 
        };
    }, [touchDraggingId, orders, updateOrderStatus]);


    const OrderColumn = ({ status, title, colorClass, badgeColor }: { status: string, title: string, colorClass: string, badgeColor: string }) => {
        const columnOrders = activeOrders.filter(o => o.status === status);
        const isDesktopOver = dragOverColumn === status;

        return (
            <div 
                className={`flex-1 min-w-[85vw] md:min-w-0 flex flex-col rounded-2xl border transition-colors duration-200 snap-center backdrop-blur-sm
                    ${isDesktopOver ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/40 dark:border-indigo-500 ring-2 ring-indigo-500' : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800'}
                `}
                onDragOver={(e) => handleDragOver(e, status)}
                onDrop={(e) => handleDrop(e, status)}
                onDragLeave={handleDragLeave}
                data-column-status={status} // CRITICAL: This allows the DOM hit test to work
            >
                <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${badgeColor} shadow-sm`}></div>
                        <h3 className={`font-bold text-slate-700 dark:text-slate-200`}>{title}</h3>
                    </div>
                    <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        {columnOrders.length}
                    </span>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
                    {columnOrders.map(order => (
                        <OrderCard 
                            key={order.id}
                            order={order} 
                            statusColor={colorClass}
                            onMove={() => updateOrderStatus(order.id, status === 'PENDING' ? 'IN_PROGRESS' : 'READY')} 
                            onPrint={() => handlePrintOrder(order)}
                            onCancel={() => setOrderToDelete(order.id)}
                            isReady={status === 'READY'}
                            onConvert={() => handleDeliverToPOS(order.id)}
                            onDragStart={handleDragStart}
                            onTouchStart={handleTouchStart}
                            isDragging={touchDraggingId === order.id}
                        />
                    ))}
                    {columnOrders.length === 0 && (
                        <div className="text-center py-10 opacity-40 pointer-events-none">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 inline-block mb-2">
                                <Package className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-500">Arrastra pedidos aquí</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
            {/* OPTIMIZED GHOST ELEMENT (Always in DOM, hidden/shown via opacity/transform) */}
            <div 
                ref={ghostRef}
                className="fixed top-0 left-0 z-[9999] pointer-events-none p-4 rounded-xl bg-white dark:bg-slate-800 shadow-2xl border-l-4 border-indigo-500 w-56 opacity-0 will-change-transform"
                style={{ transform: 'translate3d(-1000px, -1000px, 0)' }}
            >
                {touchDraggingId && draggedOrder && (
                    <>
                        <h4 className="font-bold text-sm line-clamp-1 text-slate-800 dark:text-white">{draggedOrder.customerName}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 font-bold mt-1">
                            <GripVertical className="w-3 h-3"/> Moviendo...
                        </p>
                    </>
                )}
            </div>

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
                    <div className="flex flex-col md:flex-row w-full md:w-auto gap-2">
                        {activeTab === 'LIST' && (
                            <button
                                onClick={handleOpenPrintModal}
                                className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            >
                                <ListChecks className="w-4 h-4" /> Hoja de Producción
                            </button>
                        )}
                        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 w-full md:w-auto">
                            <button 
                                onClick={() => setActiveTab('LIST')}
                                className={`flex-1 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'LIST' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                Tablero
                            </button>
                            <button 
                                onClick={() => setActiveTab('CREATE')}
                                className={`flex-1 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'CREATE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <Plus className="w-4 h-4" /> Nuevo
                            </button>
                        </div>
                    </div>
                </div>

                {activeTab === 'LIST' && (
                    <div className="flex-1 overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0" ref={scrollContainerRef}>
                        <div className="flex gap-6 min-w-[90vw] md:min-w-[1000px] h-full snap-x snap-mandatory">
                            <OrderColumn 
                                status="PENDING" 
                                title="Pendientes" 
                                colorClass="border-yellow-400" 
                                badgeColor="bg-yellow-400" 
                            />
                            <OrderColumn 
                                status="IN_PROGRESS" 
                                title="En Producción" 
                                colorClass="border-blue-500" 
                                badgeColor="bg-blue-500" 
                            />
                            <OrderColumn 
                                status="READY" 
                                title="Listos / Por Entregar" 
                                colorClass="border-emerald-500" 
                                badgeColor="bg-emerald-500" 
                            />
                        </div>
                    </div>
                )}

                {/* Print Selection Modal */}
                {printModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800 animate-[slideUp_0.3s_ease-out]">
                            <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center rounded-t-3xl md:rounded-t-2xl">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Printer className="w-5 h-5 text-indigo-500" />
                                        Seleccionar Pedidos
                                    </h3>
                                    <p className="text-xs text-slate-500">Calcula automáticamente qué necesitas producir.</p>
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
                                    Generar Hoja Inteligente ({selectedOrdersForPrint.size})
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- RESTORED CREATE TAB CONTENT --- */}
                {activeTab === 'CREATE' && (
                    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden pb-4 relative">
                        {/* (Keep existing CREATE content same as before) */}
                        <div className="md:hidden flex border-b border-slate-200 dark:border-slate-800">
                            <button 
                                onClick={() => setMobileCreateStep('CATALOG')} 
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${mobileCreateStep === 'CATALOG' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                            >
                                <Search className="w-4 h-4"/> Catálogo
                            </button>
                            <button 
                                onClick={() => setMobileCreateStep('DETAILS')} 
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${mobileCreateStep === 'DETAILS' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                            >
                                <FileEdit className="w-4 h-4"/> Detalles ({cart.length})
                            </button>
                        </div>

                        {/* Left: Product Catalog */}
                        <div className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden ${mobileCreateStep === 'DETAILS' ? 'hidden md:flex' : 'flex'}`}>
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
                                            className="relative group p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all text-left flex flex-col h-32 active:scale-95"
                                        >
                                            <div className="flex-1">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">{p.category}</span>
                                                <p className="text-xs text-slate-500 font-mono">SKU: {p.sku}</p>
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

                        {/* Right: Order Summary Form */}
                        <div className={`w-full lg:w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col h-full overflow-hidden ${mobileCreateStep === 'CATALOG' ? 'hidden md:flex' : 'flex'}`}>
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
                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium dark:text-white"
                                                value={selectedCustomerId}
                                                onChange={(e) => setSelectedCustomerId(e.target.value)}
                                            >
                                                <option value="">Cliente General</option>
                                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrega</label>
                                            <input 
                                                type="date" 
                                                min={todayStr}
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                                                value={deliveryDate}
                                                onChange={(e) => setDeliveryDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                                            <select 
                                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold dark:text-white"
                                                value={priority}
                                                onChange={(e) => setPriority(e.target.value as any)}
                                            >
                                                <option value="NORMAL">Normal</option>
                                                <option value="HIGH">Alta / Urgente</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas / Instrucciones</label>
                                        <textarea 
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white resize-none"
                                            rows={2}
                                            placeholder="Detalles especiales..."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Productos ({cart.length})</p>
                                    <div className="space-y-2">
                                        {cart.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg group">
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold bg-white dark:bg-slate-700 px-2 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">x{item.quantity}</span>
                                                        {editingItemId === item.id ? (
                                                            <input
                                                                ref={editInputRef}
                                                                type="number"
                                                                value={editPrice}
                                                                onChange={(e) => setEditPrice(e.target.value)}
                                                                onBlur={() => saveEdit(item.id)}
                                                                onKeyDown={(e) => handleEditKeyDown(e, item.id)}
                                                                className="w-16 p-0.5 text-xs border border-indigo-500 rounded text-center outline-none"
                                                            />
                                                        ) : (
                                                            <span 
                                                                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline"
                                                                onClick={() => startEditing(item)}
                                                            >
                                                                ${item.price.toFixed(2)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">${(item.price * item.quantity).toFixed(2)}</p>
                                                    <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {cart.length === 0 && <p className="text-center text-slate-400 text-sm italic py-4">Agrega productos del catálogo</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-slate-500 font-medium">Total Estimado</span>
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">
                                        ${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleCreateOrder}
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

            {/* Delete Confirmation Modal */}
            {orderToDelete && (
                <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-100 dark:border-slate-800 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">¿Eliminar Pedido?</h3>
                        <p className="text-sm text-slate-500 mb-6">Esta acción no se puede deshacer.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setOrderToDelete(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold">Cancelar</button>
                            <button onClick={confirmDeleteOrder} className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

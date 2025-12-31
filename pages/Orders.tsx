
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Clock, CheckCircle, Package, ArrowRight, X, AlertCircle, ShoppingCart, Trash2, Printer, Edit2, Check, AlertTriangle, FileText, ChevronRight, MoreHorizontal, Timer, ListChecks, Filter, CheckSquare, Square, FileEdit, Receipt, GripVertical, User, Save, Minus, Scan, QrCode, Layers } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem, Product, AppView } from '../types';
import { printOrderInvoice, printProductionSummary, printProductionTicket, printProductionMasterList } from '../utils/printService';

// --- MEMOIZED ORDER CARD ---
const OrderCard = React.memo(({ 
    order, 
    statusColor, 
    onMove, 
    onPrint, 
    onCancel, 
    isReady, 
    onConvert, 
    onDragStart, 
    onTouchStart,
    onEdit
}: {
    order: Order;
    statusColor: string;
    onMove?: () => void;
    onPrint: () => void;
    onCancel: () => void;
    prevStatus?: boolean;
    isReady?: boolean;
    onConvert?: () => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onTouchStart: (e: React.TouchEvent, id: string, name: string, element: HTMLElement | null) => void;
    onEdit: () => void;
}) => {
    const cardRef = useRef<HTMLDivElement>(null);

    return (
        <div 
            ref={cardRef}
            className={`bg-white dark:bg-slate-800 p-4 rounded-xl border-l-4 ${statusColor} shadow-sm group transition-all relative select-none order-card-item will-change-transform`}
            draggable
            onDragStart={(e) => onDragStart(e, order.id)}
        >
            {/* Mobile Drag Handle */}
            <div 
                className="absolute top-0 right-0 p-2 w-14 h-14 flex justify-end items-start z-20 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ touchAction: 'none' }} 
                onTouchStart={(e) => onTouchStart(e, order.id, order.customerName, cardRef.current)}
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
                    <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 rounded transition-colors" title="Editar"><Edit2 className="w-4 h-4"/></button>
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
});

// --- QR SCANNER MODAL COMPONENT ---
const QrScannerModal = ({ onClose, onScanSuccess }: { onClose: () => void, onScanSuccess: (id: string) => void }) => {
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        // Initialize HTML5-QRCode
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScan = (decodedText: string, decodedResult: any) => {
            // Stop scanning and callback
            if (scannerRef.current) {
                scannerRef.current.clear().then(() => {
                    onScanSuccess(decodedText);
                }).catch((err: any) => console.error("Failed to clear scanner", err));
            }
        };

        const html5QrcodeScanner = new (window as any).Html5QrcodeScanner(
            "reader", config, /* verbose= */ false);
        
        scannerRef.current = html5QrcodeScanner;
        html5QrcodeScanner.render(onScan, (err: any) => {/* ignore errors */});

        return () => {
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear(); 
                } catch(e) {}
            }
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full">
                    <X className="w-6 h-6" />
                </button>
                <div className="p-6 text-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Escanear Ticket</h3>
                    <p className="text-sm text-slate-500 mb-4">Apunta la cámara al código QR del pedido.</p>
                    <div id="reader" className="w-full rounded-xl overflow-hidden"></div>
                </div>
            </div>
        </div>
    );
};

interface OrdersProps {
    setView?: (view: AppView) => void;
}

export const Orders: React.FC<OrdersProps> = ({ setView }) => {
    const { orders, products, customers, addOrder, updateOrder, updateOrderStatus, deleteOrder, settings, sendOrderToPOS, btDevice, sendBtData, notify } = useStore();
    const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
    const [mobileCreateStep, setMobileCreateStep] = useState<'CATALOG' | 'DETAILS'>('CATALOG');
    
    // Create Order State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [notes, setNotes] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [priority, setPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');

    // Edit Order State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [editCart, setEditCart] = useState<CartItem[]>([]);
    const [editSearchTerm, setEditSearchTerm] = useState('');
    const [editMobileTab, setEditMobileTab] = useState<'CATALOG' | 'DETAILS'>('DETAILS');

    // Edit Price State
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Print Modal State
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [selectedOrdersForPrint, setSelectedOrdersForPrint] = useState<Set<string>>(new Set());
    const [showMasterListPrompt, setShowMasterListPrompt] = useState(false); // NEW STATE FOR WORKFLOW

    // Delete Confirmation State
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

    // Scanner State
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Desktop DnD State
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // --- ZERO-LATENCY MOBILE DRAG ENGINE ---
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const ghostRef = useRef<HTMLDivElement>(null); 
    const ghostTextRef = useRef<HTMLHeadingElement>(null);
    
    // Refs to bypass React State
    const dragInfoRef = useRef<{ id: string, originalEl: HTMLElement } | null>(null);
    const currentOverColumnRef = useRef<string | null>(null);
    const currentOverColumnElRef = useRef<HTMLElement | null>(null);
    const autoScrollSpeedRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);

    const activeOrders = useMemo(() => 
        orders.filter(o => o.status !== 'COMPLETED').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), 
    [orders]);
    
    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.includes(searchTerm));
    
    const filteredEditProducts = products.filter(p => p.name.toLowerCase().includes(editSearchTerm.toLowerCase()) || p.sku.includes(editSearchTerm));

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

    const startEditing = (item: CartItem) => {
        setEditingItemId(item.id);
        setEditPrice(item.price.toString());
    };

    const saveEdit = (id: string) => {
        const newPrice = parseFloat(editPrice);
        if (!isNaN(newPrice) && newPrice >= 0) {
            setCart(prev => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
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

    // --- ORDER EDITING LOGIC ---
    const handleEditClick = (order: Order) => {
        setEditingOrder(order);
        setEditCart(JSON.parse(JSON.stringify(order.items))); // Deep copy
        setEditSearchTerm('');
        setIsEditModalOpen(true);
        setEditMobileTab('DETAILS');
    };

    const addToEditCart = (product: Product) => {
        setEditCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1, originalPrice: product.price }];
        });
    };

    const updateEditQty = (itemId: string, delta: number) => {
        setEditCart(prev => prev.map(item => {
            if (item.id === itemId) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
        }));
    };

    const removeFromEditCart = (id: string) => {
        setEditCart(prev => prev.filter(item => item.id !== id));
    };

    const handleSaveEditedOrder = () => {
        if (!editingOrder) return;
        if (editCart.length === 0) {
            alert("El pedido debe tener al menos un producto.");
            return;
        }

        const newTotal = editCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const updatedOrder: Order = {
            ...editingOrder,
            items: editCart,
            total: newTotal,
            // Allow basic detail updates if bound to inputs in modal
            deliveryDate: editingOrder.deliveryDate, 
            notes: editingOrder.notes,
            priority: editingOrder.priority
        };

        updateOrder(updatedOrder);
        setIsEditModalOpen(false);
        setEditingOrder(null);
        setEditCart([]);
    };

    const confirmDeleteOrder = () => {
        if (orderToDelete) {
            deleteOrder(orderToDelete);
            setOrderToDelete(null);
        }
    };

    const handleDeliverToPOS = useCallback((orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            sendOrderToPOS(order);
            if (setView) setView(AppView.POS);
        }
    }, [orders, sendOrderToPOS, setView]);

    const handlePrintOrder = useCallback((order: Order) => {
        const customer = customers.find(c => c.id === order.customerId);
        printOrderInvoice(order, customer, settings);
    }, [customers, settings]);

    const handleOpenPrintModal = () => {
        if (activeOrders.length === 0) {
            alert("No hay pedidos activos para imprimir.");
            return;
        }
        const allIds = new Set<string>(activeOrders.map(o => o.id));
        setSelectedOrdersForPrint(allIds);
        setShowMasterListPrompt(false); // Reset flow
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

    // --- SMART PRINT WORKFLOW ---
    const confirmPrintProduction = async (type: 'SHEET' | 'THERMAL' | 'MASTER') => {
        const ordersToPrint = activeOrders.filter(o => selectedOrdersForPrint.has(o.id));
        if (ordersToPrint.length === 0) {
            alert("Selecciona al menos un pedido.");
            return;
        }
        
        if (type === 'SHEET') {
            printProductionSummary(ordersToPrint, settings, products);
            setPrintModalOpen(false);
        } else if (type === 'MASTER') {
            if (!btDevice) { notify("Error", "Conecta la impresora Bluetooth.", "error"); return; }
            printProductionMasterList(ordersToPrint, settings, products, sendBtData);
            setPrintModalOpen(false);
        } else {
            // THERMAL INDIVIDUAL TICKETS FLOW
            if (!btDevice) {
                notify("Error", "Conecta la impresora Bluetooth en Configuración.", "error");
                return;
            }
            
            // 1. Print Individual Tickets (QR) with 10s Delay
            for (let i = 0; i < ordersToPrint.length; i++) {
                const order = ordersToPrint[i];
                await printProductionTicket(order, settings, products, sendBtData);
                
                // Add delay between tickets (except optionally after the very last one, but safer to keep it)
                if (i < ordersToPrint.length - 1) {
                    notify("Enfriando Impresora", `Esperando 10s para siguiente ticket (${i+1}/${ordersToPrint.length})`, "info");
                    await new Promise(r => setTimeout(r, 10000)); 
                } else {
                    // Small delay after last one before prompt
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // 2. Ask user for Master List
            setShowMasterListPrompt(true);
        }
    };

    const handleMasterListResponse = (shouldPrint: boolean) => {
        if (shouldPrint) {
            const ordersToPrint = activeOrders.filter(o => selectedOrdersForPrint.has(o.id));
            printProductionMasterList(ordersToPrint, settings, products, sendBtData);
        }
        setPrintModalOpen(false);
        setShowMasterListPrompt(false);
    };

    // --- SCANNER LOGIC ---
    const handleScanSuccess = (decodedId: string) => {
        setIsScannerOpen(false);
        const order = orders.find(o => o.id === decodedId);
        
        if (!order) {
            alert("Pedido no encontrado. Verifica el código QR.");
            return;
        }

        if (order.status === 'COMPLETED') {
            alert("Este pedido ya fue completado y entregado.");
            return;
        }

        let nextStatus: any = order.status;
        let action = "";

        if (order.status === 'PENDING') {
            nextStatus = 'IN_PROGRESS';
            action = "Iniciar Producción";
        } else if (order.status === 'IN_PROGRESS') {
            nextStatus = 'READY';
            action = "Marcar como LISTO";
        } else if (order.status === 'READY') {
            // Deliver
            if (confirm(`¿Entregar pedido de ${order.customerName}? Se enviará a caja para cobro.`)) {
                handleDeliverToPOS(order.id);
                return;
            }
            return;
        }

        if (confirm(`Pedido #${order.id} de ${order.customerName}.\n¿${action}?`)) {
            updateOrderStatus(order.id, nextStatus);
            notify("Actualizado", "Estado del pedido actualizado correctamente.", "success");
        }
    };

    // --- DESKTOP DRAG HANDLERS ---
    const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("orderId", id);
        e.dataTransfer.effectAllowed = "move";
    }, []);

    const handleDragOver = (e: React.DragEvent, status: string) => {
        e.preventDefault();
        setDragOverColumn(status);
    };

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const orderId = e.dataTransfer.getData("orderId");
        setDragOverColumn(null);
        if (orderId) updateOrderStatus(orderId, newStatus);
    };

    const handleDragLeave = () => setDragOverColumn(null);

    // --- ZERO LATENCY TOUCH HANDLER ---
    // Uses refs and DOM directly. No React state updates during drag.
    const handleTouchStart = useCallback((e: React.TouchEvent, id: string, name: string, element: HTMLElement | null) => {
        if (!element) return;
        if (navigator.vibrate) navigator.vibrate(50);
        
        const touch = e.touches[0];
        
        // 1. Setup Refs
        dragInfoRef.current = { id, originalEl: element };
        
        // 2. DOM Visuals (Immediate)
        element.style.opacity = '0.3';
        element.style.transform = 'scale(0.95)';
        
        // 3. Setup Ghost
        if (ghostRef.current) {
            ghostRef.current.style.opacity = '1';
            ghostRef.current.style.transform = `translate3d(${touch.clientX - 20}px, ${touch.clientY - 20}px, 0) rotate(3deg)`;
            if (ghostTextRef.current) ghostTextRef.current.innerText = name;
        }

        // 4. Lock Scroll
        document.body.style.overflow = 'hidden'; 
        startAutoScroll();
    }, []);

    // Global Listeners (Passive: false)
    useEffect(() => {
        const handleWindowTouchMove = (e: TouchEvent) => {
            // Only active if we have a drag ref
            if (!dragInfoRef.current) return;
            
            e.preventDefault(); // Stop scroll
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            
            // 1. Move Ghost (Fastest possible way)
            if (ghostRef.current) {
                ghostRef.current.style.transform = `translate3d(${x - 20}px, ${y - 20}px, 0) rotate(3deg)`;
            }

            // 2. Hit Test using elementFromPoint (Robust against scrolling)
            const elUnderFinger = document.elementFromPoint(x, y);
            const colEl = elUnderFinger?.closest('[data-column-status]') as HTMLElement | null;
            const foundStatus = colEl?.getAttribute('data-column-status') || null;

            // 3. Highlight Column (Direct DOM)
            if (currentOverColumnRef.current !== foundStatus) {
                // Clear old
                if (currentOverColumnRef.current && currentOverColumnElRef.current) {
                    const el = currentOverColumnElRef.current;
                    el.style.backgroundColor = '';
                    el.style.borderColor = '';
                    el.style.transform = '';
                }
                
                // Set new
                if (foundStatus && colEl) {
                    colEl.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'; // indigo-50
                    colEl.style.borderColor = '#6366f1';
                    colEl.style.transform = 'scale(1.01)';
                    currentOverColumnElRef.current = colEl;
                } else {
                    currentOverColumnElRef.current = null;
                }
                currentOverColumnRef.current = foundStatus;
            }

            // 4. Auto Scroll (Horizontal)
            const screenW = window.innerWidth;
            const edgeZone = 60; 
            if (x < edgeZone) autoScrollSpeedRef.current = -12; 
            else if (x > screenW - edgeZone) autoScrollSpeedRef.current = 12; 
            else autoScrollSpeedRef.current = 0;
        };

        const handleWindowTouchEnd = (e: TouchEvent) => {
            if (!dragInfoRef.current) return;
            
            // 1. Cleanup Visuals
            stopAutoScroll();
            document.body.style.overflow = '';
            if (ghostRef.current) {
                ghostRef.current.style.opacity = '0';
                ghostRef.current.style.transform = 'translate3d(-1000px, -1000px, 0)';
            }
            if (dragInfoRef.current.originalEl) {
                dragInfoRef.current.originalEl.style.opacity = '1';
                dragInfoRef.current.originalEl.style.transform = 'none';
            }
            
            // Cleanup Highlights
            if (currentOverColumnRef.current && currentOverColumnElRef.current) {
                const el = currentOverColumnElRef.current;
                el.style.backgroundColor = '';
                el.style.borderColor = '';
                el.style.transform = '';
            }

            // 2. Logic Drop
            const finalStatus = currentOverColumnRef.current;
            const orderId = dragInfoRef.current.id;
            
            if (finalStatus) {
                const order = orders.find(o => o.id === orderId);
                if (order && order.status !== finalStatus) {
                    updateOrderStatus(orderId, finalStatus);
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                }
            }

            // 3. Reset Refs
            dragInfoRef.current = null;
            currentOverColumnRef.current = null;
            currentOverColumnElRef.current = null;
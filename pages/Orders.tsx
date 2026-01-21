// ... (imports remain unchanged)
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Clock, CheckCircle, Package, ArrowRight, X, AlertCircle, ShoppingCart, Trash2, Printer, Edit2, Check, AlertTriangle, FileText, ChevronRight, MoreHorizontal, Timer, ListChecks, Filter, CheckSquare, Square, FileEdit, Receipt, GripVertical, User, Save, Minus, Scan, QrCode, Layers, PackagePlus } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem, Product, AppView } from '../types';
import { printOrderInvoice, printProductionSummary, printProductionTicket, printProductionMasterList } from '../utils/printService';

// ... (OrderCard, SurplusModal, QrScannerModal components remain unchanged) ...
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
    onEdit,
    onSurplus
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
    onSurplus: () => void;
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
                    
                    {/* SURPLUS BUTTON - Only for IN_PROGRESS or READY */}
                    {(order.status === 'IN_PROGRESS' || order.status === 'READY') && (
                        <button onClick={onSurplus} className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-500 rounded transition-colors" title="Registrar Sobrante Producción">
                            <PackagePlus className="w-4 h-4"/>
                        </button>
                    )}

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

const SurplusModal = ({ order, onClose, onConfirm }: { order: Order, onClose: () => void, onConfirm: (items: {itemId: string, variantId?: string, qty: number}[]) => void }) => {
    const [quantities, setQuantities] = useState<Record<string, string>>({});

    const handleQtyChange = (id: string, val: string) => {
        setQuantities(prev => ({ ...prev, [id]: val }));
    };

    const handleSave = () => {
        const surplusItems: {itemId: string, variantId?: string, qty: number}[] = [];
        
        order.items.forEach(item => {
            const key = item.variantId ? `${item.id}-${item.variantId}` : item.id;
            const qty = parseFloat(quantities[key]);
            if (qty > 0) {
                surplusItems.push({
                    itemId: item.id,
                    variantId: item.variantId,
                    qty: qty
                });
            }
        });

        if (surplusItems.length === 0) {
            alert("Ingresa al menos una cantidad mayor a 0.");
            return;
        }

        onConfirm(surplusItems);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <PackagePlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            Registrar Sobrante
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ingresa la cantidad EXTRA producida para sumar al stock.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full"><X className="w-5 h-5 opacity-50"/></button>
                </div>
                
                <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                    {order.items.map(item => {
                        const key = item.variantId ? `${item.id}-${item.variantId}` : item.id;
                        return (
                            <div key={key} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex-1 pr-4">
                                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.name}</p>
                                    {item.variantName && <p className="text-xs text-slate-500">{item.variantName}</p>}
                                    <p className="text-xs text-slate-400 mt-1">Pedido: {item.quantity}</p>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <label className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Sobrante</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="0"
                                        className="w-20 p-2 text-center font-bold border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 dark:text-white"
                                        value={quantities[key] || ''}
                                        onChange={(e) => handleQtyChange(key, e.target.value)}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
                    <button onClick={handleSave} className="flex-[2] py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" /> Guardar en Inventario
                    </button>
                </div>
            </div>
        </div>
    );
};

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
    const { orders, products, customers, addOrder, updateOrder, updateOrderStatus, deleteOrder, settings, sendOrderToPOS, btDevice, sendBtData, notify, adjustStock } = useStore();
    // ... (state declarations remain same)
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

    // Surplus State
    const [surplusOrder, setSurplusOrder] = useState<Order | null>(null);

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
            // FIX: AUTOMATICALLY ADD STOCK (IN) SO POS DOESN'T COMPLAIN ABOUT INSUFFICIENT STOCK
            // This assumes "Delivering" means production is complete and items are added to inventory.
            order.items.forEach(item => {
                adjustStock(item.id, item.quantity, 'IN', item.variantId);
            });
            
            // Then send to POS where they will be sold (Stock OUT)
            sendOrderToPOS(order);
            if (setView) setView(AppView.POS);
        }
    }, [orders, sendOrderToPOS, setView, adjustStock]);

    const handlePrintOrder = useCallback((order: Order) => {
        const customer = customers.find(c => c.id === order.customerId);
        printOrderInvoice(order, customer, settings);
    }, [customers, settings]);

    // ... (rest of the file logic remains unchanged) ...
    // ...
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

    // --- SURPLUS HANDLERS ---
    const handleSaveSurplus = (surplusItems: {itemId: string, variantId?: string, qty: number}[]) => {
        surplusItems.forEach(item => {
            adjustStock(item.itemId, item.qty, 'IN', item.variantId);
        });
        notify("Inventario Actualizado", `${surplusItems.length} productos sobrantes agregados al stock.`, "success");
        setSurplusOrder(null);
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
        // FIX: Cast string to valid order status
        if (orderId) updateOrderStatus(orderId, newStatus as Order['status']);
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
                    // FIX: Cast string status to Order['status']
                    updateOrderStatus(orderId, finalStatus as Order['status']);
                    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                }
            }

            // 3. Reset Refs
            dragInfoRef.current = null;
            currentOverColumnRef.current = null;
            currentOverColumnElRef.current = null;
        };

        // Bind with { passive: false } to allow e.preventDefault()
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
    }, [orders, updateOrderStatus]);

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
            {/* OPTIMIZED GHOST ELEMENT */}
            <div 
                ref={ghostRef}
                className="fixed top-0 left-0 z-[9999] pointer-events-none p-4 rounded-xl bg-white dark:bg-slate-800 shadow-2xl border-l-4 border-indigo-500 w-56 opacity-0 will-change-transform transition-opacity duration-75"
                style={{ transform: 'translate3d(-1000px, -1000px, 0)' }}
            >
                <h4 ref={ghostTextRef} className="font-bold text-sm line-clamp-1 text-slate-800 dark:text-white">...</h4>
                <p className="text-xs text-slate-500 flex items-center gap-1 font-bold mt-1">
                    <GripVertical className="w-3 h-3"/> Moviendo...
                </p>
            </div>

            {/* SCANNER MODAL */}
            {isScannerOpen && (
                <QrScannerModal onClose={() => setIsScannerOpen(false)} onScanSuccess={handleScanSuccess} />
            )}

            {/* SURPLUS MODAL */}
            {surplusOrder && (
                <SurplusModal 
                    order={surplusOrder} 
                    onClose={() => setSurplusOrder(null)} 
                    onConfirm={handleSaveSurplus} 
                />
            )}

            <div className="max-w-7xl mx-auto h-full flex flex-col">
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
                            <>
                                <button
                                    onClick={() => setIsScannerOpen(true)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                                >
                                    <Scan className="w-4 h-4" /> Escanear
                                </button>
                                <button
                                    onClick={handleOpenPrintModal}
                                    className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <ListChecks className="w-4 h-4" /> Generar Orden
                                </button>
                            </>
                        )}
                        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 w-full md:w-auto">
                            <button onClick={() => setActiveTab('LIST')} className={`flex-1 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'LIST' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Tablero</button>
                            <button onClick={() => setActiveTab('CREATE')} className={`flex-1 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'CREATE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><Plus className="w-4 h-4" /> Nuevo</button>
                        </div>
                    </div>
                </div>

                {activeTab === 'LIST' && (
                    <div className="flex-1 overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0" ref={scrollContainerRef}>
                        <div className="flex gap-6 min-w-[90vw] md:min-w-[1000px] h-full snap-x snap-mandatory">
                            {['PENDING', 'IN_PROGRESS', 'READY'].map(status => {
                                const title = status === 'PENDING' ? 'Pendientes' : status === 'IN_PROGRESS' ? 'En Producción' : 'Listos / Por Entregar';
                                const colorClass = status === 'PENDING' ? 'border-yellow-400' : status === 'IN_PROGRESS' ? 'border-blue-500' : 'border-emerald-500';
                                const badgeColor = status === 'PENDING' ? 'bg-yellow-400' : status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-emerald-500';
                                const columnOrders = activeOrders.filter(o => o.status === status);
                                const isDesktopOver = dragOverColumn === status;

                                return (
                                    <div 
                                        key={status}
                                        data-column-status={status}
                                        className={`flex-1 min-w-[85vw] md:min-w-0 flex flex-col rounded-2xl border transition-all duration-200 snap-center backdrop-blur-sm ${isDesktopOver ? 'bg-indigo-50 border-indigo-400' : 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-800'}`}
                                        onDragOver={(e) => handleDragOver(e, status)}
                                        onDrop={(e) => handleDrop(e, status)}
                                        onDragLeave={handleDragLeave}
                                    >
                                        <div className="p-4 border-b flex justify-between items-center rounded-t-2xl bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 pointer-events-none">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${badgeColor} shadow-sm`}></div>
                                                <h3 className="font-bold text-slate-700 dark:text-slate-200">{title}</h3>
                                            </div>
                                            <span className="bg-white dark:bg-slate-800 text-slate-500 text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">{columnOrders.length}</span>
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
                                                    onEdit={() => handleEditClick(order)}
                                                    isReady={status === 'READY'}
                                                    onConvert={() => handleDeliverToPOS(order.id)}
                                                    onDragStart={handleDragStart}
                                                    onTouchStart={handleTouchStart}
                                                    onSurplus={() => setSurplusOrder(order)}
                                                />
                                            ))}
                                            {columnOrders.length === 0 && (
                                                <div className="text-center py-10 opacity-40 pointer-events-none">
                                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 inline-block mb-2"><Package className="w-6 h-6 text-slate-400" /></div>
                                                    <p className="text-sm text-slate-500">Arrastra pedidos aquí</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Print Selection Modal */}
                {printModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4 animate-[fadeIn_0.2s_ease-out]">
                        <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] border border-slate-100 dark:border-slate-800 animate-[slideUp_0.3s_ease-out]">
                            {showMasterListPrompt ? (
                                // SECONDARY FLOW: ASK FOR MASTER LIST
                                <div className="p-8 text-center flex flex-col items-center">
                                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                                        <Layers className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Tickets Individuales Enviados</h3>
                                    <p className="text-slate-500 mb-6 text-sm">¿Deseas imprimir también la Lista Maestra consolidada para producción?</p>
                                    
                                    <div className="flex gap-3 w-full">
                                        <button onClick={() => handleMasterListResponse(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold">No, Gracias</button>
                                        <button onClick={() => handleMasterListResponse(true)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg">Sí, Imprimir</button>
                                    </div>
                                </div>
                            ) : (
                                // PRIMARY FLOW: SELECT ORDERS
                                <>
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

                                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-2 flex-wrap">
                                        <button 
                                            onClick={() => confirmPrintProduction('SHEET')}
                                            disabled={selectedOrdersForPrint.size === 0}
                                            className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                                        >
                                            <FileText className="w-4 h-4"/> Hoja Carta
                                        </button>
                                        <button 
                                            onClick={() => confirmPrintProduction('MASTER')}
                                            disabled={selectedOrdersForPrint.size === 0}
                                            className="flex-1 py-3 bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 text-xs"
                                        >
                                            <Layers className="w-4 h-4"/> Lista Maestra
                                        </button>
                                        <button 
                                            onClick={() => confirmPrintProduction('THERMAL')}
                                            disabled={selectedOrdersForPrint.size === 0}
                                            className="flex-[1.5] py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg flex items-center justify-center gap-2 text-xs"
                                        >
                                            <Receipt className="w-4 h-4"/> Ticket Térmico
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ... (Create and Edit Modals omitted for brevity, keeping original logic) ... */}
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
                        <div className={`flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden ${mobileCreateStep === 'DETAILS' ? 'hidden md:flex' : 'flex'}`}>
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

            {/* EDIT ORDER MODAL */}
            {isEditModalOpen && editingOrder && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center backdrop-blur-sm p-0 md:p-4">
                    <div className="bg-white dark:bg-slate-900 w-full h-full md:h-[90vh] md:max-w-5xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Edit2 className="w-5 h-5 text-indigo-500" />
                                    Editar Pedido #{editingOrder.id.slice(-4)}
                                </h3>
                                <p className="text-xs text-slate-500">{editingOrder.customerName}</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        {/* Mobile Tabs */}
                        <div className="md:hidden flex border-b border-slate-200 dark:border-slate-800">
                            <button onClick={() => setEditMobileTab('DETAILS')} className={`flex-1 py-3 text-sm font-bold ${editMobileTab === 'DETAILS' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>Detalles ({editCart.length})</button>
                            <button onClick={() => setEditMobileTab('CATALOG')} className={`flex-1 py-3 text-sm font-bold ${editMobileTab === 'CATALOG' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>Agregar Productos</button>
                        </div>

                        <div className="flex flex-1 overflow-hidden">
                            {/* LEFT: Catalog (Hidden on Mobile if Details active) */}
                            <div className={`flex-1 border-r border-slate-100 dark:border-slate-800 flex-col bg-slate-50 dark:bg-slate-950 ${editMobileTab === 'DETAILS' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            placeholder="Buscar productos..."
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                                            value={editSearchTerm}
                                            onChange={e => setEditSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                        {filteredEditProducts.map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => addToEditCart(p)}
                                                className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all text-left flex flex-col h-28 active:scale-95 shadow-sm"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2">{p.name}</p>
                                                    <p className="text-[10px] text-slate-500 uppercase mt-1">{p.category}</p>
                                                </div>
                                                <div className="flex justify-between items-end mt-2">
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">${p.price}</span>
                                                    <Plus className="w-5 h-5 text-slate-300" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: Order Details (Hidden on Mobile if Catalog active) */}
                            <div className={`w-full md:w-[400px] flex flex-col bg-white dark:bg-slate-900 ${editMobileTab === 'CATALOG' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                                    {/* Order Settings */}
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Entrega</label>
                                            <input 
                                                type="date" 
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white"
                                                value={editingOrder.deliveryDate || ''}
                                                onChange={(e) => setEditingOrder({...editingOrder, deliveryDate: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                                            <select 
                                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold dark:text-white"
                                                value={editingOrder.priority}
                                                onChange={(e) => setEditingOrder({...editingOrder, priority: e.target.value as any})}
                                            >
                                                <option value="NORMAL">Normal</option>
                                                <option value="HIGH">Alta / Urgente</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas</label>
                                        <textarea 
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm dark:text-white resize-none"
                                            value={editingOrder.notes || ''}
                                            onChange={(e) => setEditingOrder({...editingOrder, notes: e.target.value})}
                                        />
                                    </div>

                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                        <div className="space-y-2">
                                            {editCart.map((item: CartItem) => (
                                                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <button onClick={() => updateEditQty(item.id, 1)} className="w-6 h-6 bg-white dark:bg-slate-700 rounded shadow-sm text-slate-500 hover:text-indigo-600 flex items-center justify-center"><Plus className="w-3 h-3"/></button>
                                                        <span className="text-xs font-bold w-6 text-center dark:text-white">{item.quantity}</span>
                                                        <button onClick={() => updateEditQty(item.id, -1)} className="w-6 h-6 bg-white dark:bg-slate-700 rounded shadow-sm text-slate-500 hover:text-red-600 flex items-center justify-center"><Minus className="w-3 h-3"/></button>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">${item.price}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-white">${(item.price * item.quantity).toFixed(2)}</p>
                                                        <button onClick={() => removeFromEditCart(item.id)} className="text-xs text-red-400 hover:text-red-600 mt-1">Eliminar</button>
                                                    </div>
                                                </div>
                                            ))}
                                            {editCart.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Sin productos</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-slate-500 font-bold text-sm">Nuevo Total</span>
                                        <span className="text-2xl font-black text-slate-800 dark:text-white">${editCart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)}</span>
                                    </div>
                                    <button 
                                        onClick={handleSaveEditedOrder}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <Save className="w-5 h-5" /> Guardar Cambios
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
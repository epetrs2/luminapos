import React, { useState, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Order, CartItem } from '../types';
import { Plus, Search, Filter, Clock, CheckCircle, Package, Truck, Trash2, ArrowRight, QrCode, X, AlertCircle } from 'lucide-react';
import { printOrderInvoice, printProductionTicket, printProductionMasterList } from '../utils/printService';

export const Orders: React.FC<{ setView: (view: any) => void }> = ({ setView }) => {
    const { orders, addOrder, updateOrderStatus, deleteOrder, customers, products, notify, pushToCloud, settings, sendBtData, btDevice, sendOrderToPOS } = useStore();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'READY'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanInput, setScanInput] = useState('');

    // Filter Logic
    const filteredOrders = orders.filter(o => {
        const matchesTab = activeTab === 'ALL' || o.status === activeTab;
        const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
        return matchesTab && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // --- SCANNER LOGIC ---
    // Simulating scanner input via text field for web compatibility without external libraries
    const handleScanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleScanSuccess(scanInput);
        setScanInput('');
    };

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
            notify("Actualizado", "Estado actualizado. Sincronizando...", "success");
            // Force push to prevent cloud overwriting local state
            setTimeout(() => pushToCloud(), 100);
        }
    };

    const handleDeliverToPOS = (orderId: string) => {
        sendOrderToPOS(orderId);
        updateOrderStatus(orderId, 'COMPLETED');
        notify("Enviado a Caja", "El pedido se ha transferido al punto de venta.", "success");
        setView('POS');
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
            case 'READY': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
            case 'COMPLETED': return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
            default: return 'bg-slate-100 text-slate-500';
        }
    };

    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'PENDING': return 'Pendiente';
            case 'IN_PROGRESS': return 'En Proceso';
            case 'READY': return 'Listo / Entrega';
            case 'COMPLETED': return 'Entregado';
            default: return status;
        }
    };

    return (
        <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Pedidos y Producción</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de órdenes de trabajo y entregas.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsScannerOpen(true)} className="flex items-center gap-2 bg-slate-900 dark:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95">
                            <QrCode className="w-5 h-5" /> <span className="hidden md:inline">Escanear QR</span>
                        </button>
                        <button onClick={() => printProductionMasterList(filteredOrders.filter(o => o.status === 'PENDING'), settings, products, btDevice ? sendBtData : undefined)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95">
                            <Package className="w-5 h-5" /> <span className="hidden md:inline">Lista Producción</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto w-full lg:w-auto custom-scrollbar">
                            {['ALL', 'PENDING', 'IN_PROGRESS', 'READY'].map((tab: any) => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {tab === 'ALL' ? 'Todos' : getStatusLabel(tab)}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Buscar pedido..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredOrders.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No se encontraron pedidos.</p>
                            </div>
                        ) : filteredOrders.map(order => (
                            <div key={order.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(order.status)}`}>
                                                {getStatusLabel(order.status)}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">#{order.id}</span>
                                            {order.priority === 'HIGH' && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">URGENTE</span>}
                                        </div>
                                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">{order.customerName}</h3>
                                        <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {new Date(order.date).toLocaleDateString()}</span>
                                            {order.deliveryDate && <span className="flex items-center gap-1 font-medium text-indigo-600"><Truck className="w-3.5 h-3.5"/> Entrega: {order.deliveryDate}</span>}
                                        </div>
                                        {order.notes && <p className="text-xs text-slate-500 mt-2 italic bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-100 dark:border-yellow-900/30 inline-block">{order.notes}</p>}
                                    </div>

                                    <div className="flex flex-col md:items-end justify-between gap-3">
                                        <div className="flex gap-2">
                                            <button onClick={() => printOrderInvoice(order, customers.find(c => c.id === order.customerId), settings)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors" title="Imprimir Nota"><Package className="w-4 h-4"/></button>
                                            {order.status !== 'COMPLETED' && (
                                                <button onClick={() => deleteOrder(order.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4"/></button>
                                            )}
                                        </div>
                                        
                                        {order.status === 'READY' ? (
                                            <button onClick={() => handleDeliverToPOS(order.id)} className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4"/> Entregar y Cobrar
                                            </button>
                                        ) : order.status !== 'COMPLETED' ? (
                                            <div className="text-right">
                                                <span className="text-xs text-slate-400 font-bold uppercase">Siguiente Paso</span>
                                                <div className="flex items-center gap-2 text-indigo-600 font-bold cursor-pointer hover:underline" onClick={() => handleScanSuccess(order.id)}>
                                                    {order.status === 'PENDING' ? 'Iniciar Producción' : 'Marcar Listo'} <ArrowRight className="w-4 h-4"/>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                
                                {/* Items Preview */}
                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
                                    <p className="text-xs font-bold uppercase text-slate-400 mb-1">Contenido:</p>
                                    <ul className="list-disc list-inside">
                                        {order.items.map((item, idx) => (
                                            <li key={idx} className="truncate">
                                                <span className="font-bold text-slate-800 dark:text-white">{item.quantity}x</span> {item.name} {item.variantName ? `(${item.variantName})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SCANNER MODAL */}
            {isScannerOpen && (
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm relative">
                        <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
                        <h3 className="text-xl font-bold text-center mb-6 dark:text-white">Escáner de Pedidos</h3>
                        
                        <div className="aspect-square bg-slate-100 dark:bg-black rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center mb-6 relative overflow-hidden">
                            <QrCode className="w-24 h-24 text-slate-300 dark:text-slate-700" />
                            <div className="absolute inset-0 border-2 border-indigo-500 animate-[ping_2s_infinite] rounded-xl opacity-20"></div>
                            <p className="absolute bottom-4 text-xs text-slate-500 font-bold">Enfoca el código QR del ticket</p>
                        </div>

                        <form onSubmit={handleScanSubmit}>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Entrada Manual / Pistola USB</label>
                            <input 
                                type="text" 
                                autoFocus 
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-center text-lg outline-none focus:ring-4 focus:ring-indigo-500/20"
                                placeholder="Escanea o escribe ID..."
                            />
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

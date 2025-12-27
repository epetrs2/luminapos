
import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Truck, Mail, Phone, Building, ShoppingCart, Archive, DollarSign, Calendar, X, Save, ArrowRight, Package, Check, AlertCircle, PackagePlus, History, Zap, Box, Tag, Receipt, List, ArrowDownAZ, ArrowUpNarrowWide, Filter, Clock, Activity } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Supplier, Product, PurchaseItem, Purchase, ProductType } from '../types';

export const Suppliers: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier, products, addProduct, categories, addPurchase, purchases } = useStore();
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'PURCHASES'>('DIRECTORY');
  const [subTab, setSubTab] = useState<'LIST' | 'NEW'>('LIST'); 
  const [mobilePurchaseStep, setMobilePurchaseStep] = useState<'CATALOG' | 'TICKET'>('CATALOG');

  // Suppliers CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Suppliers Filter & Sort State
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'VOLUME'>('NAME');

  // Purchase State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [purchaseCart, setPurchaseCart] = useState<PurchaseItem[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseShipping, setPurchaseShipping] = useState(''); // NEW: Shipping Cost

  // Quick Product Create State
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ name: '', price: '', cost: '', category: 'General', sku: '', type: 'PRODUCT' as ProductType });

  // --- Suppliers Logic ---
  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData(supplier);
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', contactPerson: '', email: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return;

    if (editingSupplier) {
      updateSupplier({ ...editingSupplier, ...formData } as Supplier);
    } else {
      addSupplier({ ...formData, id: crypto.randomUUID() } as Supplier);
    }
    setIsModalOpen(false);
  };

  // --- STATS CALCULATION ---
  const supplierStats = useMemo(() => {
      const stats: Record<string, { totalSpent: number, count: number, lastDate: number }> = {};
      
      // Initialize
      suppliers.forEach(s => {
          stats[s.id] = { totalSpent: 0, count: 0, lastDate: 0 };
      });

      // Calculate from purchases
      purchases.forEach(p => {
          if (stats[p.supplierId]) {
              stats[p.supplierId].totalSpent += p.total;
              stats[p.supplierId].count += 1;
              const dateTs = new Date(p.date).getTime();
              if (dateTs > stats[p.supplierId].lastDate) {
                  stats[p.supplierId].lastDate = dateTs;
              }
          }
      });
      return stats;
  }, [suppliers, purchases]);

  // --- FILTERING & SORTING ---
  const filteredSuppliers = useMemo(() => {
      let result = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Filter
      if (filterType === 'ACTIVE') {
          result = result.filter(s => supplierStats[s.id]?.count > 0);
      } else if (filterType === 'INACTIVE') {
          result = result.filter(s => supplierStats[s.id]?.count === 0);
      }

      // Sort
      result.sort((a, b) => {
          if (sortBy === 'VOLUME') {
              return (supplierStats[b.id]?.totalSpent || 0) - (supplierStats[a.id]?.totalSpent || 0);
          }
          return a.name.localeCompare(b.name);
      });

      return result;
  }, [suppliers, searchTerm, filterType, sortBy, supplierStats]);

  const counts = useMemo(() => {
      const activeCount = suppliers.filter(s => supplierStats[s.id]?.count > 0).length;
      return {
          all: suppliers.length,
          active: activeCount,
          inactive: suppliers.length - activeCount
      };
  }, [suppliers, supplierStats]);


  // --- Purchase Logic ---
  const filteredProducts = useMemo(() => {
      if (!productSearch) return [];
      return products.filter(p => 
          p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
          p.sku.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 7);
  }, [productSearch, products]);

  const addToPurchaseCart = (product: Product, variantId?: string) => {
      setPurchaseCart(prev => {
          const existing = prev.find(i => i.productId === product.id && i.variantId === variantId);
          if (existing) {
              return prev.map(i => i.productId === product.id && i.variantId === variantId 
                  ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitCost } 
                  : i
              );
          }
          const variant = variantId ? product.variants?.find(v => v.id === variantId) : null;
          return [...prev, {
              productId: product.id,
              variantId,
              variantName: variant?.name,
              name: product.name,
              quantity: 1,
              unitCost: variant ? variant.price : (product.cost || product.price), 
              total: variant ? variant.price : (product.cost || product.price),
              type: product.type
          }];
      });
      setProductSearch(''); 
  };

  const updateCartItem = (index: number, field: 'quantity' | 'unitCost', value: number) => {
      setPurchaseCart(prev => prev.map((item, idx) => {
          if (idx !== index) return item;
          const updated = { ...item, [field]: value };
          updated.total = updated.quantity * updated.unitCost;
          return updated;
      }));
  };

  const removeCartItem = (index: number) => {
      setPurchaseCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Calculate Total Including Shipping
  const subtotal = purchaseCart.reduce((sum, item) => sum + item.total, 0);
  const shippingCost = parseFloat(purchaseShipping) || 0;
  const purchaseTotal = subtotal + shippingCost;

  const handleConfirmPurchase = () => {
      if (!selectedSupplierId) {
          alert('Selecciona un proveedor.');
          return;
      }
      if (purchaseCart.length === 0) {
          alert('Agrega productos a la compra.');
          return;
      }

      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      
      const newPurchase: Purchase = {
          id: crypto.randomUUID(),
          supplierId: selectedSupplierId,
          supplierName: supplier?.name || 'Desconocido',
          date: new Date().toISOString(),
          items: purchaseCart,
          shippingCost: shippingCost, // Save shipping
          total: purchaseTotal,
          status: 'COMPLETED',
          notes: purchaseNotes
      };

      addPurchase(newPurchase);
      
      // Reset Form
      setPurchaseCart([]);
      setPurchaseNotes('');
      setPurchaseShipping('');
      setProductSearch('');
      setSubTab('LIST');
      setMobilePurchaseStep('CATALOG');
  };

  // --- Quick Create Logic ---
  const initiateQuickCreate = () => {
      setQuickProduct({
          name: productSearch,
          price: '',
          cost: '',
          category: categories[0] || 'General',
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          type: 'PRODUCT'
      });
      setIsQuickCreateOpen(true);
  };

  const saveQuickProduct = () => {
      if (!quickProduct.name) return;
      
      const newProd: Product = {
          id: '', 
          name: quickProduct.name,
          price: quickProduct.type === 'SUPPLY' ? 0 : (parseFloat(quickProduct.price) || 0),
          cost: parseFloat(quickProduct.cost) || 0,
          stock: 0,
          category: quickProduct.category,
          sku: quickProduct.sku,
          taxRate: 0,
          hasVariants: false,
          type: quickProduct.type,
          unit: 'PIECE',
          isActive: true
      };

      addProduct(newProd);
      setIsQuickCreateOpen(false);
      setProductSearch('');
      alert("Producto creado. Búscalo nuevamente para agregarlo a la compra."); 
  };

  const sortedPurchases = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Proveedores y Compras</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de relaciones comerciales y abastecimiento.</p>
          </div>
          
          {/* Main Tabs */}
          <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 w-full md:w-auto overflow-x-auto">
             <button 
                onClick={() => setActiveTab('DIRECTORY')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'DIRECTORY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
             >
                <Truck className="w-4 h-4" /> Directorio
             </button>
             <button 
                onClick={() => setActiveTab('PURCHASES')}
                className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'PURCHASES' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
             >
                <ShoppingCart className="w-4 h-4" /> Compras
             </button>
          </div>
        </div>

        {/* --- DIRECTORY TAB --- */}
        {activeTab === 'DIRECTORY' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-[fadeIn_0.3s_ease-out] flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    {/* Filters */}
                    <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl overflow-x-auto w-full lg:w-auto custom-scrollbar">
                        <button onClick={() => setFilterType('ALL')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'ALL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            Todos <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.all}</span>
                        </button>
                        <button onClick={() => setFilterType('ACTIVE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'ACTIVE' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <Activity className="w-3 h-3"/> Con Movimientos <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.active}</span>
                        </button>
                        <button onClick={() => setFilterType('INACTIVE')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterType === 'INACTIVE' ? 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                            <Box className="w-3 h-3"/> Sin Movimientos <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-md text-[10px]">{counts.inactive}</span>
                        </button>
                    </div>

                    <div className="flex gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar proveedor..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setSortBy(prev => prev === 'NAME' ? 'VOLUME' : 'NAME')}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                            title={sortBy === 'NAME' ? 'Ordenar por Volumen de Compra' : 'Ordenar Alfabéticamente'}
                        >
                            {sortBy === 'NAME' ? <ArrowDownAZ className="w-4 h-4"/> : <ArrowUpNarrowWide className="w-4 h-4 text-emerald-500"/>}
                            <span className="hidden md:inline">{sortBy === 'NAME' ? 'Alfabético' : 'Mayor Compra'}</span>
                        </button>
                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile Cards for Suppliers */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSuppliers.map(supplier => {
                        const stats = supplierStats[supplier.id] || { totalSpent: 0, count: 0 };
                        return (
                            <div key={supplier.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                            <Building className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white">{supplier.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.contactPerson}</p>
                                        </div>
                                    </div>
                                    {stats.totalSpent > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">${stats.totalSpent.toLocaleString()}</p>
                                            <p className="text-[10px] text-slate-400">{stats.count} compras</p>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-sm text-slate-600 dark:text-slate-300 mb-3 pl-[52px]">
                                    {supplier.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5"/> {supplier.phone}</div>}
                                    {supplier.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5"/> {supplier.email}</div>}
                                </div>
                                <div className="flex justify-end gap-2 pl-[52px]">
                                    <button onClick={() => handleOpenModal(supplier)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                                    <button onClick={() => deleteSupplier(supplier.id)} className="p-2 bg-slate-100 dark:bg-slate-800 text-red-500 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                            <tr>
                            <th className="px-6 py-4 text-left">Empresa</th>
                            <th className="px-6 py-4 text-left">Contacto</th>
                            <th className="px-6 py-4 text-left">Detalles</th>
                            <th className="px-6 py-4 text-right">Volumen Compras</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredSuppliers.map(supplier => {
                                const stats = supplierStats[supplier.id] || { totalSpent: 0, count: 0 };
                                return (
                                    <tr key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                                    <Building className="w-4 h-4" />
                                                </div>
                                                {supplier.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {supplier.contactPerson || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-sm">
                                                {supplier.email && (
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                        <Mail className="w-3 h-3" /> {supplier.email}
                                                    </div>
                                                )}
                                                {supplier.phone && (
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                                        <Phone className="w-3 h-3" /> {supplier.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {stats.count > 0 ? (
                                                <div>
                                                    <span className="font-bold text-slate-800 dark:text-white">${stats.totalSpent.toLocaleString()}</span>
                                                    <p className="text-xs text-slate-400">{stats.count} compras</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Sin actividad</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleOpenModal(supplier)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteSupplier(supplier.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {filteredSuppliers.length === 0 && (
                    <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No se encontraron proveedores con este filtro.</p>
                    </div>
                )}
            </div>
        )}

        {/* --- PURCHASES TAB --- */}
        {activeTab === 'PURCHASES' && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                {/* Improved Sub-Nav */}
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-full md:w-fit">
                    <button 
                        onClick={() => setSubTab('LIST')}
                        className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${subTab === 'LIST' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <History className="w-4 h-4" /> Historial
                    </button>
                    <button 
                        onClick={() => setSubTab('NEW')}
                        className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${subTab === 'NEW' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <Plus className="w-4 h-4" /> Nueva Compra
                    </button>
                </div>

                {subTab === 'LIST' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        {/* Mobile Cards for Purchases */}
                        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {sortedPurchases.map(purchase => (
                                <div key={purchase.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">{purchase.supplierName}</p>
                                            <p className="text-xs text-slate-500">{new Date(purchase.date).toLocaleDateString()} - {new Date(purchase.date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                                        </div>
                                        <span className="font-black text-slate-800 dark:text-white">${purchase.total.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded-lg text-xs text-slate-600 dark:text-slate-400 mb-2 truncate">
                                        {purchase.items.length} items: {purchase.items.map(i => i.name).join(', ')}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        {(purchase.shippingCost || 0) > 0 && <span className="text-[10px] text-slate-400 flex items-center gap-1"><Truck className="w-3 h-3"/> Envío: ${purchase.shippingCost?.toFixed(2)}</span>}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ml-auto">
                                            <Check className="w-3 h-3" /> Completado
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Fecha</th>
                                        <th className="px-6 py-4 text-left">Proveedor</th>
                                        <th className="px-6 py-4 text-left">Items</th>
                                        <th className="px-6 py-4 text-right">Envío</th>
                                        <th className="px-6 py-4 text-right">Total Compra</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {sortedPurchases.map(purchase => (
                                        <tr key={purchase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 dark:text-white">{new Date(purchase.date).toLocaleDateString()}</span>
                                                    <span className="text-xs">{new Date(purchase.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{purchase.supplierName}</td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                <span className="font-bold">{purchase.items.length}</span> productos
                                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{purchase.items.map(i => i.name + (i.variantName ? ` (${i.variantName})` : '')).join(', ')}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400 font-medium">
                                                {purchase.shippingCost ? `$${purchase.shippingCost.toFixed(2)}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">${purchase.total.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    <Check className="w-3 h-3" /> Completado
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {subTab === 'NEW' && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row min-h-[600px] relative">
                        
                        {/* Mobile Toggle Bar */}
                        <div className="md:hidden flex border-b border-slate-200 dark:border-slate-800">
                            <button 
                                onClick={() => setMobilePurchaseStep('CATALOG')} 
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${mobilePurchaseStep === 'CATALOG' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                            >
                                <Search className="w-4 h-4"/> Catálogo
                            </button>
                            <button 
                                onClick={() => setMobilePurchaseStep('TICKET')} 
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${mobilePurchaseStep === 'TICKET' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}
                            >
                                <Receipt className="w-4 h-4"/> Ticket ({purchaseCart.length})
                            </button>
                        </div>

                        {/* LEFT SIDE: CATALOG & SUPPLIER INFO (Hidden on mobile if Ticket active) */}
                        <div className={`flex-1 flex flex-col ${mobilePurchaseStep === 'TICKET' ? 'hidden md:flex' : 'flex'}`}>
                            {/* Header Panel */}
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                                <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                                    <div className="w-full md:w-1/2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Proveedor</label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <select 
                                                className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                                value={selectedSupplierId}
                                                onChange={(e) => setSelectedSupplierId(e.target.value)}
                                            >
                                                <option value="">-- Selecciona --</option>
                                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-1/2 flex flex-col md:items-end">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 text-left md:text-right">Fecha</label>
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium w-full md:w-auto">
                                            <Calendar className="w-4 h-4 text-indigo-500" />
                                            {new Date().toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Search & Action Bar */}
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 bg-white dark:bg-slate-900 sticky top-0 z-10">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar producto..."
                                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                        />
                                        {productSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                                                {filteredProducts.map(p => (
                                                    <button 
                                                        key={p.id} 
                                                        onClick={() => {
                                                            if(!p.hasVariants) {
                                                                addToPurchaseCart(p);
                                                                // Optional: Auto switch to ticket on mobile? No, let user stay in catalog.
                                                            }
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0 flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                                                {p.name}
                                                                {p.type === 'SUPPLY' && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 rounded border border-orange-200">INSUMO</span>}
                                                            </p>
                                                            <p className="text-xs text-slate-500">SKU: {p.sku}</p>
                                                        </div>
                                                        <Plus className="w-5 h-5 text-slate-300 group-hover:text-indigo-600" />
                                                    </button>
                                                ))}
                                                {filteredProducts.length === 0 && (
                                                    <div className="p-3 text-center text-sm text-slate-400">No se encontraron coincidencias</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={initiateQuickCreate}
                                        className="w-12 md:w-auto md:px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        <Zap className="w-5 h-5" /> <span className="hidden md:inline">Rápido</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Empty State / Catalog hint */}
                            <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-8 flex flex-col items-center justify-center text-slate-400">
                                <PackagePlus className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-center">Busca productos arriba o crea uno rápido<br/>para agregarlo a la lista de compra.</p>
                            </div>
                        </div>

                        {/* RIGHT SIDE: CART (Hidden on mobile if Catalog active) */}
                        <div className={`w-full md:w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full ${mobilePurchaseStep === 'CATALOG' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                                Resumen de Compra
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {purchaseCart.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>Carrito vacío.</p>
                                    </div>
                                ) : (
                                    purchaseCart.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 relative">
                                            <button onClick={() => removeCartItem(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                                            <p className="font-bold text-slate-800 dark:text-white pr-6 text-sm">{item.name}</p>
                                            {item.variantName && <p className="text-xs text-slate-500 mb-2">{item.variantName}</p>}
                                            
                                            <div className="flex items-end gap-3 mt-2">
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Cant.</label>
                                                    <input 
                                                        type="number" min="1" 
                                                        className="w-16 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm font-bold outline-none focus:border-indigo-500"
                                                        value={item.quantity}
                                                        onChange={(e) => updateCartItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Costo U.</label>
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                                        <input 
                                                            type="number" min="0" step="0.01"
                                                            className="w-24 pl-5 p-1 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded text-sm font-bold outline-none focus:border-indigo-500"
                                                            value={item.unitCost}
                                                            onChange={(e) => updateCartItem(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 text-right">
                                                    <p className="text-xs text-slate-400">Total</p>
                                                    <p className="font-bold text-slate-800 dark:text-white">${item.total.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Costo Envío / Flete</label>
                                    <div className="relative">
                                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input 
                                            type="number"
                                            placeholder="0.00"
                                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none font-medium"
                                            value={purchaseShipping}
                                            onChange={(e) => setPurchaseShipping(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notas</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Detalles..."
                                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none resize-none mb-4"
                                    value={purchaseNotes}
                                    onChange={(e) => setPurchaseNotes(e.target.value)}
                                />
                                <div className="space-y-1 mb-4 text-sm">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Subtotal</span>
                                        <span>${subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-slate-500 font-medium">Total a Pagar</span>
                                        <span className="text-3xl font-black text-slate-800 dark:text-white">${purchaseTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleConfirmPurchase}
                                    className="w-full py-4 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" /> Confirmar Compra
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Supplier Modal (Existing) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full animate-[slideUp_0.3s_ease-out] border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre de la Empresa *</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.contactPerson || ''}
                  onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
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

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección / Detalles</label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  value={formData.address || ''}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button onClick={() => setIsModalOpen(false)} className="hidden md:block px-6 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">Cancelar</button>
                <button onClick={handleSave} className="w-full md:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK PRODUCT CREATE MODAL */}
      {isQuickCreateOpen && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-end md:items-center justify-center backdrop-blur-sm p-0 md:p-4">
              <div className="bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl p-6 max-w-md w-full border border-slate-100 dark:border-slate-800 animate-[slideUp_0.3s_ease-out]">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <PackagePlus className="w-6 h-6 text-indigo-500" />
                          Crear Item Rápido
                      </h3>
                      <button onClick={() => setIsQuickCreateOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
                  </div>
                  
                  <div className="space-y-5">
                      {/* Type Toggle */}
                      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                          <button 
                            onClick={() => setQuickProduct({...quickProduct, type: 'PRODUCT'})}
                            className={`flex-1 py-3 md:py-2 text-sm font-bold rounded-lg transition-all ${quickProduct.type === 'PRODUCT' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                          >
                              Producto (Venta)
                          </button>
                          <button 
                            onClick={() => setQuickProduct({...quickProduct, type: 'SUPPLY'})}
                            className={`flex-1 py-3 md:py-2 text-sm font-bold rounded-lg transition-all ${quickProduct.type === 'SUPPLY' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}
                          >
                              Insumo / Gasto
                          </button>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Item</label>
                          <input type="text" autoFocus value={quickProduct.name} onChange={(e) => setQuickProduct({...quickProduct, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder={quickProduct.type === 'SUPPLY' ? 'Ej. Rollo Etiquetas, Leche, Empaques' : 'Ej. Coca Cola 600ml'} />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Costo Compra</label>
                              <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                  <input type="number" min="0" step="0.01" value={quickProduct.cost} onChange={(e) => setQuickProduct({...quickProduct, cost: e.target.value})} className="w-full pl-6 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                              </div>
                          </div>
                          
                          {quickProduct.type === 'PRODUCT' ? (
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Precio Venta</label>
                                  <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                      <input type="number" min="0" step="0.01" value={quickProduct.price} onChange={(e) => setQuickProduct({...quickProduct, price: e.target.value})} className="w-full pl-6 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                                  </div>
                              </div>
                          ) : (
                              <div className="flex flex-col justify-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800">
                                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400 mb-1">Uso Interno</span>
                                  <span className="text-[10px] text-orange-800 dark:text-orange-300 leading-tight">No aparecerá en el punto de venta.</span>
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                              <select value={quickProduct.category} onChange={(e) => setQuickProduct({...quickProduct, category: e.target.value})} className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">SKU (Opcional)</label>
                              <input type="text" value={quickProduct.sku} onChange={(e) => setQuickProduct({...quickProduct, sku: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm" placeholder="Auto-generado"/>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setIsQuickCreateOpen(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold">Cancelar</button>
                      <button onClick={saveQuickProduct} className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-transform hover:scale-105 active:scale-95">Guardar y Agregar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

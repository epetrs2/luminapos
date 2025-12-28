import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Package, AlertTriangle, ArrowLeftRight, Sparkles, X, BrainCircuit, Loader2, Filter, Check, Layers, Tag, Percent, DollarSign, Archive, Box, Eye, EyeOff, Scale, Info, Hash, Handshake } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Product, ProductVariant, MeasurementUnit } from '../types';
import { generateStockRecommendations, StockRecommendation } from '../services/geminiService';

const UNITS: { label: string, value: MeasurementUnit }[] = [
    { label: 'Pieza (Pz)', value: 'PIECE' },
    { label: 'Kilogramo (Kg)', value: 'KG' },
    { label: 'Gramo (Gr)', value: 'GRAM' },
    { label: 'Litro (Lt)', value: 'LITER' },
    { label: 'Metro (Mt)', value: 'METER' }
];

const PRESENTATION_UNITS = [
    'g', 'kg', 'ml', 'L', 'oz', 'lb', 'm', 'cm', 'pz', 'caja', 'paq'
];

export const Inventory: React.FC = () => {
  const { products, transactions, categories, addProduct, updateProduct, deleteProduct, adjustStock, addCategory, removeCategory, settings, currentUser } = useStore();
  
  // Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VARIANTS'>('GENERAL');
  
  // Inventory View Type (Product vs Supply)
  const [inventoryType, setInventoryType] = useState<'PRODUCT' | 'SUPPLY'>('PRODUCT');

  // Variant State inside Modal
  const [tempVariants, setTempVariants] = useState<ProductVariant[]>([]);
  const [variantName, setVariantName] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('');
  const [variantSku, setVariantSku] = useState('');

  // Category Management
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustVariantId, setAdjustVariantId] = useState<string>(''); 
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');

  // AI Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // --- CRUD Handlers ---
  const handleOpenModal = (product?: Product) => {
    setIsAddingCategory(false);
    setNewCategoryName('');
    setActiveTab('GENERAL');
    if (product) {
      setEditingProduct(product);
      setFormData(product);
      setTempVariants(product.variants || []);
    } else {
      setEditingProduct(null);
      setFormData({ 
          name: '', 
          sku: '', 
          category: '', 
          price: 0, 
          stock: 0, 
          taxRate: settings.taxRate, 
          hasVariants: false,
          type: inventoryType,
          unit: 'PIECE',
          isActive: true,
          isConsignment: false,
          description: '',
          presentationValue: undefined,
          presentationUnit: 'ml'
      });
      setTempVariants([]);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.sku || !formData.category) {
        alert("Por favor completa los campos requeridos (Nombre, SKU, Categoría).");
        return;
    } 

    const finalProduct: Product = {
        ...(editingProduct || {}),
        ...formData,
        id: editingProduct?.id || '', // Empty ID tells StoreContext to generate a SAFE, SEQUENTIAL ID
        stock: formData.hasVariants ? tempVariants.reduce((sum, v) => sum + v.stock, 0) : (formData.stock || 0),
        variants: formData.hasVariants ? tempVariants : undefined,
        taxRate: settings.enableTax ? (formData.taxRate ?? 0) : 0,
        type: formData.type || inventoryType,
        unit: formData.unit || 'PIECE',
        isActive: formData.isActive ?? true,
        isConsignment: formData.isConsignment ?? false
    } as Product;

    if (editingProduct) {
      updateProduct(finalProduct);
    } else {
      addProduct(finalProduct);
      // UX Improvement: Reset filters so the new product is immediately visible
      setCategoryFilter('ALL');
      setSearchTerm('');
      // If user added a supply while in product view (or vice versa), switch to correct view
      if (finalProduct.type && finalProduct.type !== inventoryType) {
          setInventoryType(finalProduct.type);
      }
    }
    setIsModalOpen(false);
  };

  // --- Variant Handlers ---
  const addVariant = () => {
      if (!variantName || !variantPrice || !variantSku) return;
      const newVariant: ProductVariant = {
          id: crypto.randomUUID(),
          name: variantName,
          price: parseFloat(variantPrice),
          stock: parseInt(variantStock) || 0,
          sku: variantSku
      };
      setTempVariants([...tempVariants, newVariant]);
      setVariantName('');
      setVariantStock('');
      setVariantSku('');
  };

  const removeVariant = (id: string) => {
      setTempVariants(tempVariants.filter(v => v.id !== id));
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
        addCategory(newCategoryName.trim());
        setFormData({ ...formData, category: newCategoryName.trim() });
        setIsAddingCategory(false);
        setNewCategoryName('');
    }
  };

  const handleOpenAdjust = (product: Product) => {
    setAdjustProduct(product);
    setAdjustQty(0);
    setAdjustType('IN');
    setAdjustVariantId(''); 
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = () => {
    if (adjustProduct && adjustQty > 0) {
      if (adjustProduct.hasVariants && !adjustVariantId) {
          alert("Debes seleccionar una variante para ajustar el stock.");
          return;
      }
      adjustStock(adjustProduct.id, adjustQty, adjustType, adjustVariantId);
      setAdjustModalOpen(false);
    }
  };

  const handleOpenAi = async () => {
    setAiModalOpen(true);
    setLoadingAi(true);
    setRecommendations([]);
    const results = await generateStockRecommendations(products, transactions);
    setRecommendations(results);
    setLoadingAi(false);
  };

  const filteredProducts = products.filter(p => {
    const itemType = p.type || 'PRODUCT'; 
    const matchesType = itemType === inventoryType;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchTerm.toLowerCase()); // Added ID search
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    
    return matchesType && matchesSearch && matchesCategory;
  });

  const TAX_PRESETS = [
      { label: 'IVA 16%', value: 16 },
      { label: 'Frontera 8%', value: 8 },
      { label: '0%', value: 0 },
  ];

  // Helper to check if stock editing is allowed
  const isStockLocked = formData.hasVariants || (!!editingProduct && currentUser?.role !== 'ADMIN');

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Inventario</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión avanzada de stock y medición</p>
          </div>
          <div className="flex flex-wrap gap-3">
             <button onClick={handleOpenAi} className="flex items-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-slate-700 px-5 py-3 rounded-xl font-medium shadow-sm transition-all">
              <BrainCircuit className="w-5 h-5" /> <span className="hidden md:inline">IA Analysis</span>
            </button>
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
              <Plus className="w-5 h-5" /> Nuevo <span className="hidden md:inline">{inventoryType === 'PRODUCT' ? 'Producto' : 'Insumo'}</span>
            </button>
          </div>
        </div>

        {/* View Type Toggle */}
        <div className="flex mb-6 bg-white dark:bg-slate-900 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
            <button 
                onClick={() => setInventoryType('PRODUCT')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${inventoryType === 'PRODUCT' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Package className="w-4 h-4" /> <span className="hidden md:inline">Productos (Venta)</span><span className="md:hidden">Prod.</span>
            </button>
            <button 
                onClick={() => setInventoryType('SUPPLY')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${inventoryType === 'SUPPLY' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Archive className="w-4 h-4" /> <span className="hidden md:inline">Insumos / Internos</span><span className="md:hidden">Insumos</span>
            </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="relative w-full md:w-64">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none cursor-pointer">
                <option value="ALL">Todas las Categorías</option>
                {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                <tr>
                  <th className="px-3 md:px-6 py-4 text-left hidden md:table-cell">Estado</th>
                  <th className="px-3 md:px-6 py-4 text-left">Item</th>
                  <th className="px-3 md:px-6 py-4 text-left hidden lg:table-cell">SKU</th>
                  <th className="px-3 md:px-6 py-4 text-center hidden md:table-cell">Unidad</th>
                  <th className="px-3 md:px-6 py-4 text-right">{inventoryType === 'PRODUCT' ? 'Precio' : 'Costo'}</th>
                  <th className="px-3 md:px-6 py-4 text-center">Stock</th>
                  <th className="px-3 md:px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map(product => (
                  <tr key={product.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${!product.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-3 md:px-6 py-4 hidden md:table-cell">
                        {product.isActive ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><Eye className="w-3 h-3" /> Activo</span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400"><EyeOff className="w-3 h-3" /> Inactivo</span>
                        )}
                        {product.isConsignment && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 mt-1"><Handshake className="w-3 h-3"/> Tercero</span>
                        )}
                    </td>
                    <td className="px-3 md:px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-sm md:text-base">
                            <span className="line-clamp-2 md:line-clamp-1">{product.name}</span>
                            {product.presentationValue && (
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded w-fit">
                                    {product.presentationValue} {product.presentationUnit}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">{product.category}</span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-800 px-1 rounded hidden lg:flex items-center gap-0.5"><Hash className="w-2.5 h-2.5"/> {product.id}</span>
                        </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs hidden lg:table-cell">{product.sku}</td>
                    <td className="px-3 md:px-6 py-4 text-center hidden md:table-cell">
                        <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 uppercase">{product.unit || 'PIECE'}</span>
                    </td>
                    <td className="px-3 md:px-6 py-4 text-right font-medium text-slate-800 dark:text-slate-200 text-sm md:text-base">
                        {product.hasVariants ? 
                            <span className="text-xs text-slate-400 italic">Varía</span> : 
                            (inventoryType === 'PRODUCT' ? `$${product.price.toFixed(2)}` : <span className="text-slate-400 font-normal italic text-xs">${product.cost?.toFixed(2) || '0.00'}</span>)
                        }
                    </td>
                    <td className="px-3 md:px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${product.stock < 5 && product.isActive ? 'bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                          {product.stock}
                        </span>
                    </td>
                    <td className="px-3 md:px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 md:gap-2">
                         <button onClick={() => handleOpenAdjust(product)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-500 dark:text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="Ajustar Stock"><ArrowLeftRight className="w-4 h-4" /></button>
                        <button onClick={() => handleOpenModal(product)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                    <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            <Box className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No hay {inventoryType === 'PRODUCT' ? 'productos' : 'insumos'} registrados.</p>
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Product CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-0 max-w-2xl w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {editingProduct ? 'Editar' : 'Nuevo'} {formData.type === 'SUPPLY' ? 'Insumo' : 'Producto'}
                </h3>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className={`text-[10px] font-black uppercase px-2 ${formData.isActive ? 'text-emerald-500' : 'text-slate-400'}`}>{formData.isActive ? 'Activo' : 'Inactivo'}</span>
                    <button 
                        onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>
            
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 flex border-b border-slate-200 dark:border-slate-700">
                <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'GENERAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>General y Precio</button>
                <button onClick={() => setActiveTab('VARIANTS')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'VARIANTS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}>Variantes</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {activeTab === 'GENERAL' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Item</label>
                            <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoría</label>
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex gap-2">
                                        <input type="text" className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
                                        <button onClick={handleAddCategory} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Check className="w-5 h-5"/></button>
                                        <button onClick={() => setIsAddingCategory(false)} className="p-2 bg-slate-100 text-slate-500 rounded-lg"><X className="w-5 h-5"/></button>
                                    </div>
                                ) : (
                                    <>
                                        <select className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                        </select>
                                        <button onClick={() => setIsAddingCategory(true)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Plus className="w-5 h-5" /></button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">SKU / Código</label>
                            <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-sm" value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descripción</label>
                            <textarea rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none resize-none" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ej. Material 100% algodón, ideal para verano..." />
                        </div>

                        {inventoryType === 'PRODUCT' && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-0.5">Tipo de Propiedad</p>
                                    <p className={`text-sm font-bold ${formData.isConsignment ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                        {formData.isConsignment ? 'Consignación / Tercero' : 'Propio del Negocio'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setFormData({...formData, isConsignment: !formData.isConsignment})}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isConsignment ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isConsignment ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        )}
                        {formData.isConsignment && (
                            <p className="text-[10px] text-orange-600 mt-1 bg-orange-50 p-2 rounded border border-orange-100 flex gap-1">
                                <Handshake className="w-3 h-3 mt-0.5" />
                                Venta se registra como "Recaudo Terceros".
                            </p>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <h4 className="text-xs font-black text-indigo-500 uppercase mb-3 flex items-center gap-2"><Scale className="w-4 h-4"/> Medición y Venta</h4>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Se vende por</label>
                                    <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold" value={formData.unit || 'PIECE'} onChange={e => setFormData({ ...formData, unit: e.target.value as any })}>
                                        {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                                        <span>Stock Actual</span>
                                        {editingProduct && !formData.hasVariants && currentUser?.role === 'ADMIN' && (
                                            <span className="text-[9px] text-indigo-500 font-normal bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded cursor-help" title="Solo Admin: Edita para corregir">
                                                Corregir (Admin)
                                            </span>
                                        )}
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={isStockLocked}
                                        className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-bold ${isStockLocked ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500'}`} 
                                        value={formData.stock || 0} 
                                        onChange={e => setFormData({ ...formData, stock: parseFloat(e.target.value) })} 
                                        placeholder="0"
                                    />
                                    {formData.hasVariants && <p className="text-[10px] text-slate-400 mt-1">Calculado por variantes</p>}
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Presentación / Contenido (Opcional)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Ej. 600" 
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none" 
                                        value={formData.presentationValue || ''}
                                        onChange={e => setFormData({ ...formData, presentationValue: parseFloat(e.target.value) })}
                                    />
                                    <select 
                                        className="w-24 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium"
                                        value={formData.presentationUnit || 'ml'}
                                        onChange={e => setFormData({ ...formData, presentationUnit: e.target.value })}
                                    >
                                        {PRESENTATION_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Ej: Si vendes por "Pieza", especifica si son 600ml, 250g, etc.</p>
                            </div>
                            
                            <div className="mb-2">
                                <label className="block text-xs font-bold text-slate-500 mb-1">{formData.type === 'SUPPLY' ? 'Costo' : 'Precio Venta'}</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input type="number" step="0.01" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-indigo-600" value={formData.type === 'SUPPLY' ? formData.cost : formData.price} onChange={e => setFormData({ ...formData, [formData.type === 'SUPPLY' ? 'cost' : 'price']: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                        </div>

                        {inventoryType === 'PRODUCT' && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-xs font-black text-slate-500 uppercase mb-3 flex items-center gap-2"><Percent className="w-4 h-4"/> Impuestos</h4>
                                <div className="flex gap-2">
                                    {TAX_PRESETS.map(preset => (
                                        <button key={preset.value} onClick={() => setFormData({...formData, taxRate: preset.value})} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${formData.taxRate === preset.value ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!formData.isActive && (
                            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-2xl flex gap-3">
                                <Info className="w-5 h-5 text-orange-600 shrink-0" />
                                <p className="text-xs text-orange-800 dark:text-orange-300 font-medium">Este producto está **inactivo**. No aparecerá en ventas y las alertas de stock estarán apagadas.</p>
                            </div>
                        )}
                    </div>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                          <input type="checkbox" id="hasVariants" checked={formData.hasVariants || false} onChange={e => setFormData({...formData, hasVariants: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                          <label htmlFor="hasVariants" className="text-sm font-bold text-indigo-900 dark:text-indigo-200 cursor-pointer">Habilitar Variantes (Talla, Color, Medida)</label>
                      </div>

                      {formData.hasVariants && (
                          <div className="animate-[fadeIn_0.3s]">
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 shadow-inner">
                                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus className="w-4 h-4"/> Agregar Variante</h4>
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                      <input type="text" placeholder="Ej. Rojo / Grande" className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantName} onChange={e => setVariantName(e.target.value)} />
                                      <input type="text" placeholder="SKU Variante" className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white font-mono" value={variantSku} onChange={e => setVariantSku(e.target.value)} />
                                      <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span><input type="number" placeholder="Precio" className="w-full pl-5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} /></div>
                                      <input type="number" placeholder="Stock" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantStock} onChange={e => setVariantStock(e.target.value)} />
                                  </div>
                                  <button onClick={addVariant} className="w-full py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">Agregar a la Lista</button>
                              </div>

                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {tempVariants.map(v => (
                                      <div key={v.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm group">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800 dark:text-white">{v.name}</p>
                                              <p className="text-xs text-slate-500 font-mono">SKU: {v.sku} | ${v.price.toFixed(2)}</p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <span className="text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded">{v.stock} un.</span>
                                              <button onClick={() => removeVariant(v.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-10 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-transform hover:scale-105 active:scale-95">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustModalOpen && adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white">Ajustar Stock</h3>
                    <button onClick={() => setAdjustModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{adjustProduct.type === 'SUPPLY' ? 'Insumo' : 'Producto'}</p>
                        <p className="font-bold text-slate-800 dark:text-white">{adjustProduct.name}</p>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Unidad: {adjustProduct.unit || 'PIECE'}</span>
                    </div>

                    {adjustProduct.hasVariants && (
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Variante</label>
                            <select className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none text-sm" value={adjustVariantId} onChange={(e) => setAdjustVariantId(e.target.value)}>
                                <option value="">Seleccionar variante...</option>
                                {adjustProduct.variants?.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} (Stock: {v.stock})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
                        <button onClick={() => setAdjustType('IN')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${adjustType === 'IN' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Entrada (+)</button>
                        <button onClick={() => setAdjustType('OUT')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${adjustType === 'OUT' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Salida (-)</button>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cantidad</label>
                        <input type="number" step={adjustProduct.unit === 'PIECE' ? '1' : '0.001'} min="0" value={adjustQty} onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)} className="w-full text-center text-3xl font-bold py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    <button onClick={handleSaveAdjust} className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${adjustType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar {adjustType === 'IN' ? 'Entrada' : 'Salida'}</button>
                </div>
            </div>
        </div>
      )}

      {/* AI Recommendations Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
                <div className="p-6 border-b border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-violet-600 to-indigo-600 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <Sparkles className="w-6 h-6" />
                        <div>
                            <h3 className="text-xl font-bold">Recomendaciones de Inventario</h3>
                            <p className="text-indigo-200 text-xs">Basado en tu historial de consumo y ventas</p>
                        </div>
                    </div>
                    <button onClick={() => setAiModalOpen(false)} className="text-indigo-200 hover:text-white p-2 hover:bg-white/10 rounded-lg"><X className="w-6 h-6"/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
                    {loadingAi ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" /><p className="font-medium">Analizando patrones de venta...</p></div>
                    ) : recommendations.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1"><h4 className="font-bold text-slate-800 dark:text-white">{rec.productName}</h4><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{rec.analysis}</span></div>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="text-center px-4 border-l border-slate-100 dark:border-slate-800"><p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Punto Reorden</p><p className="text-xl font-bold text-orange-600 dark:text-orange-400">{rec.reorderPoint}</p></div>
                                        <div className="text-center px-4 border-l border-slate-100 dark:border-slate-800"><p className="text-[10px] uppercase text-slate-400 dark:text-slate-500 font-bold mb-1">Stock Ideal</p><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{rec.recommendedStock}</p></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (<div className="text-center py-12 text-slate-400 dark:text-slate-500"><BrainCircuit className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No se pudieron generar recomendaciones.</p></div>)}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
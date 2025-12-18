import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, Package, AlertTriangle, ArrowLeftRight, Sparkles, X, BrainCircuit, Loader2, Filter, Check, Layers, Tag, Percent, DollarSign, Archive, Box } from 'lucide-react';
import { useStore } from '../components/StoreContext';
import { Product, ProductVariant } from '../types';
import { generateStockRecommendations, StockRecommendation } from '../services/geminiService';

export const Inventory: React.FC = () => {
  const { products, transactions, categories, addProduct, updateProduct, deleteProduct, adjustStock, addCategory, removeCategory, settings } = useStore();
  
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
  const [adjustVariantId, setAdjustVariantId] = useState<string>(''); // For variant selection in adjust
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
      // Default type based on current tab
      setFormData({ 
          name: '', 
          sku: '', 
          category: '', 
          price: 0, 
          stock: 0, 
          taxRate: settings.taxRate, 
          hasVariants: false,
          type: inventoryType 
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
        id: editingProduct?.id || crypto.randomUUID(),
        // If has variants, calculate total stock from sum of variants
        stock: formData.hasVariants ? tempVariants.reduce((sum, v) => sum + v.stock, 0) : (formData.stock || 0),
        variants: formData.hasVariants ? tempVariants : undefined,
        taxRate: settings.enableTax ? (formData.taxRate ?? 0) : 0,
        type: formData.type || inventoryType
    } as Product;

    if (editingProduct) {
      updateProduct(finalProduct);
    } else {
      addProduct(finalProduct);
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
      // Clear fields
      setVariantName('');
      setVariantStock('');
      setVariantSku('');
      // Keep price for convenience
  };

  const removeVariant = (id: string) => {
      setTempVariants(tempVariants.filter(v => v.id !== id));
  };

  // --- Category Handlers ---
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
        addCategory(newCategoryName.trim());
        setFormData({ ...formData, category: newCategoryName.trim() });
        setIsAddingCategory(false);
        setNewCategoryName('');
    }
  };

  const handleDeleteCategory = (catName: string) => {
      if (window.confirm(`¿Eliminar categoría "${catName}"?`)) {
          removeCategory(catName);
          if (formData.category === catName) setFormData({...formData, category: ''});
      }
  };

  // --- Adjustment Handlers ---
  const handleOpenAdjust = (product: Product) => {
    setAdjustProduct(product);
    setAdjustQty(0);
    setAdjustType('IN');
    setAdjustVariantId(''); // Reset selection
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
    const itemType = p.type || 'PRODUCT'; // Legacy items are products
    const matchesType = itemType === inventoryType;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    
    return matchesType && matchesSearch && matchesCategory;
  });

  const TAX_PRESETS = [
      { label: 'IVA 16%', value: 16 },
      { label: 'Frontera 8%', value: 8 },
      { label: '0%', value: 0 },
  ];

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Inventario</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de productos y existencias</p>
          </div>
          <div className="flex flex-wrap gap-3">
             <button onClick={handleOpenAi} className="flex items-center gap-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-slate-700 px-5 py-3 rounded-xl font-medium shadow-sm transition-all">
              <BrainCircuit className="w-5 h-5" /> IA Analysis
            </button>
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
              <Plus className="w-5 h-5" /> Nuevo {inventoryType === 'PRODUCT' ? 'Producto' : 'Insumo'}
            </button>
          </div>
        </div>

        {/* View Type Toggle */}
        <div className="flex mb-6 bg-white dark:bg-slate-900 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
            <button 
                onClick={() => setInventoryType('PRODUCT')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${inventoryType === 'PRODUCT' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Package className="w-4 h-4" /> Productos (Venta)
            </button>
            <button 
                onClick={() => setInventoryType('SUPPLY')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${inventoryType === 'SUPPLY' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Archive className="w-4 h-4" /> Insumos / Internos
            </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder={`Buscar ${inventoryType === 'PRODUCT' ? 'producto' : 'insumo'}...`} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
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
                  <th className="px-6 py-4 text-left">Item</th>
                  <th className="px-6 py-4 text-left">SKU</th>
                  {settings.enableTax && inventoryType === 'PRODUCT' && <th className="px-6 py-4 text-left">Impuesto</th>}
                  <th className="px-6 py-4 text-right">{inventoryType === 'PRODUCT' ? 'Precio Venta' : 'Costo Aprox.'}</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {product.name}
                            {inventoryType === 'SUPPLY' && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200">USO INTERNO</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{product.category}</div>
                        {product.hasVariants && <div className="text-xs text-indigo-500 flex items-center gap-1 mt-1"><Layers className="w-3 h-3" /> {product.variants?.length} Variantes</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{product.sku}</td>
                    {settings.enableTax && inventoryType === 'PRODUCT' && (
                        <td className="px-6 py-4">
                            <span className={`text-xs px-2 py-1 rounded border ${product.taxRate === 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                                {product.taxRate}%
                            </span>
                        </td>
                    )}
                    <td className="px-6 py-4 text-right font-medium text-slate-800 dark:text-slate-200">
                        {product.hasVariants ? 
                            <span className="text-xs text-slate-400 italic">Varía</span> : 
                            (inventoryType === 'PRODUCT' ? `$${product.price.toFixed(2)}` : <span className="text-slate-400 font-normal italic text-xs">Costo: ${product.cost?.toFixed(2) || '0.00'}</span>)
                        }
                    </td>
                    <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${product.stock < 5 ? 'bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                          {product.stock}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                         <button onClick={() => handleOpenAdjust(product)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-500 dark:text-slate-400 hover:text-indigo-600 rounded-lg transition-colors" title="Ajustar Stock"><ArrowLeftRight className="w-4 h-4" /></button>
                        <button onClick={() => handleOpenModal(product)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteProduct(product.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                            <Box className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No hay {inventoryType === 'PRODUCT' ? 'productos' : 'insumos'} registrados en esta categoría.</p>
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-0 max-w-lg w-full border border-slate-100 dark:border-slate-800 max-h-[90vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {editingProduct ? 'Editar' : 'Nuevo'} {formData.type === 'SUPPLY' ? 'Insumo (Interno)' : 'Producto (Venta)'}
                </h3>
            </div>
            
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 flex border-b border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => setActiveTab('GENERAL')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'GENERAL' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    General
                </button>
                <button 
                    onClick={() => setActiveTab('VARIANTS')}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'VARIANTS' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    Variantes
                </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {activeTab === 'GENERAL' ? (
                  <>
                    {!editingProduct && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, type: 'PRODUCT'})} 
                                className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${formData.type === 'PRODUCT' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500'}`}
                            >
                                Venta Público
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, type: 'SUPPLY'})} 
                                className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${formData.type === 'SUPPLY' ? 'bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}
                            >
                                Uso Interno
                            </button>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                        <input type="text" placeholder={formData.type === 'SUPPLY' ? "Ej. Caja Cartón 30x30" : "Ej. Camiseta Polo"} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                            <div className="flex gap-2">
                                {isAddingCategory ? (
                                    <div className="flex-1 flex gap-2 animate-[fadeIn_0.2s_ease-out]">
                                        <input type="text" placeholder="Nueva..." className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
                                        <button onClick={handleAddCategory} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Check className="w-5 h-5"/></button>
                                        <button onClick={() => setIsAddingCategory(false)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200"><X className="w-5 h-5"/></button>
                                    </div>
                                ) : (
                                    <>
                                        <select className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                        </select>
                                        <button onClick={() => setIsAddingCategory(true)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"><Plus className="w-5 h-5" /></button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU</label>
                            <input type="text" placeholder="CÓDIGO" className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-sm" value={formData.sku || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
                        </div>
                        
                        {settings.enableTax && formData.type === 'PRODUCT' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Impuesto (%)</label>
                                    <div className="relative">
                                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                        <input 
                                            type="number" 
                                            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none" 
                                            value={formData.taxRate ?? settings.taxRate} 
                                            onChange={e => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })} 
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2 flex gap-2">
                                    {TAX_PRESETS.map(preset => (
                                        <button
                                            key={preset.value}
                                            onClick={() => setFormData({...formData, taxRate: preset.value})}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${formData.taxRate === preset.value ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {!formData.hasVariants && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    {formData.type === 'SUPPLY' ? 'Costo Compra' : 'Precio Venta'}
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    {formData.type === 'SUPPLY' ? (
                                        <input type="number" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-bold" value={formData.cost || 0} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) })} />
                                    ) : (
                                        <input type="number" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-bold" value={formData.price || 0} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stock Inicial</label>
                                <input type="number" disabled={!!editingProduct} className={`w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 outline-none ${editingProduct ? 'bg-slate-100 text-slate-500' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'}`} value={formData.stock || 0} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    )}
                  </>
              ) : (
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                          <input type="checkbox" id="hasVariants" checked={formData.hasVariants || false} onChange={e => setFormData({...formData, hasVariants: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                          <label htmlFor="hasVariants" className="text-sm font-medium text-indigo-900 dark:text-indigo-200 cursor-pointer">Habilitar Variantes (Talla, Color, Medida)</label>
                      </div>

                      {formData.hasVariants && (
                          <div className="animate-[fadeIn_0.3s]">
                              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 shadow-inner">
                                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Plus className="w-4 h-4"/> Agregar Variante</h4>
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                      <input type="text" placeholder="Ej. Rojo / Grande" className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantName} onChange={e => setVariantName(e.target.value)} />
                                      <input type="text" placeholder="SKU Variante" className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white font-mono" value={variantSku} onChange={e => setVariantSku(e.target.value)} />
                                      <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                          <input type="number" placeholder="Precio" className="w-full pl-5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} />
                                      </div>
                                      <input type="number" placeholder="Stock" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 outline-none text-sm dark:text-white" value={variantStock} onChange={e => setVariantStock(e.target.value)} />
                                  </div>
                                  <button onClick={addVariant} className="w-full py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">Agregar a la Lista</button>
                              </div>

                              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
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
                                  {tempVariants.length === 0 && <p className="text-center text-xs text-slate-400 py-4 italic">No hay variantes agregadas</p>}
                              </div>
                          </div>
                      )}
                  </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors">Cancelar</button>
              <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-transform hover:scale-105 active:scale-95">Guardar</button>
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
                        <p className="font-medium text-slate-800 dark:text-white">{adjustProduct.name}</p>
                    </div>

                    {adjustProduct.hasVariants && (
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Variante</label>
                            <select 
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none text-sm"
                                value={adjustVariantId}
                                onChange={(e) => setAdjustVariantId(e.target.value)}
                            >
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
                        <input type="number" min="1" value={adjustQty} onChange={(e) => setAdjustQty(parseInt(e.target.value) || 0)} className="w-full text-center text-3xl font-bold py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    <button onClick={handleSaveAdjust} className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${adjustType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>Confirmar {adjustType === 'IN' ? 'Entrada' : 'Salida'}</button>
                </div>
            </div>
        </div>
      )}

      {/* AI Recommendations Modal (Same as before) */}
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

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Save, Upload, Store, FileText, Palette, Sun, Moon, CheckCircle, Database, Download, AlertTriangle, PieChart, Bell, Volume2, Printer, Trash2, Hash, FileInput, Info, CreditCard, Percent, Cloud, CloudOff, RefreshCw, LayoutTemplate, Eye, Calendar, Phone, DollarSign, ToggleLeft, ToggleRight, Check, Lock, RotateCw, ShieldCheck, Loader2, Zap, X, Move, ZoomIn, Link as LinkIcon, FileCheck, Server, AlertCircle } from 'lucide-react';
import { fetchFullDataFromCloud } from '../services/syncService';

// --- IMAGE CROPPER COMPONENT (UNCHANGED BUT INCLUDED FOR COMPLETENESS) ---
interface ImageCropperProps {
    imageSrc: string;
    onCancel: () => void;
    onSave: (processedImage: string) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCancel, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(new Image());
    const [imgLoaded, setImgLoaded] = useState(false);

    useEffect(() => {
        imgRef.current.src = imageSrc;
        imgRef.current.onload = () => {
            setImgLoaded(true);
            const canvasSize = 300;
            let initialScale = 1;
            if (imgRef.current.width > imgRef.current.height) {
                initialScale = canvasSize / imgRef.current.height;
            } else {
                initialScale = canvasSize / imgRef.current.width;
            }
            setScale(initialScale * 0.8);
        };
    }, [imageSrc]);

    useEffect(() => {
        if (!imgLoaded || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.translate(centerX + offset.x, centerY + offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(
            imgRef.current, 
            -imgRef.current.width / 2, 
            -imgRef.current.height / 2
        );
        ctx.restore();

    }, [imgLoaded, scale, offset]);

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setStartPan({ x: clientX - offset.x, y: clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        e.preventDefault(); 
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setOffset({ x: clientX - startPan.x, y: clientY - startPan.y });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleFinalSave = () => {
        if (!canvasRef.current) return;
        const outputSize = 180; 
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const ctx = outputCanvas.getContext('2d');
        
        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, outputSize, outputSize);
            const ratio = outputSize / 300; 
            const centerX = outputSize / 2;
            const centerY = outputSize / 2;

            ctx.save();
            ctx.translate(centerX + (offset.x * ratio), centerY + (offset.y * ratio));
            ctx.scale(scale * ratio, scale * ratio);
            ctx.drawImage(
                imgRef.current, 
                -imgRef.current.width / 2, 
                -imgRef.current.height / 2
            );
            ctx.restore();
            onSave(outputCanvas.toDataURL('image/jpeg', 0.7)); // Higher compression for cloud
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-[fadeIn_0.2s]">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Move className="w-5 h-5 text-indigo-500" /> Ajustar Logo
                    </h3>
                    <button onClick={onCancel}><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="relative w-[300px] h-[300px] mx-auto bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shadow-inner border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-move touch-none">
                    <canvas 
                        ref={canvasRef}
                        width={300}
                        height={300}
                        className="w-full h-full"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown}
                        onTouchMove={handleMouseMove}
                    />
                </div>
                <div className="flex items-center gap-4 my-6">
                    <ZoomIn className="w-5 h-5 text-slate-400" />
                    <input 
                        type="range" 
                        min="0.1" 
                        max="3" 
                        step="0.1" 
                        value={scale} 
                        onChange={(e) => setScale(parseFloat(e.target.value))} 
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
                    <button onClick={handleFinalSave} className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg">Guardar Logo</button>
                </div>
            </div>
        </div>
    );
};

export const Settings: React.FC = () => {
  const { settings, updateSettings, hardReset, pushToCloud, notify } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'OPERATIONS' | 'DATA'>('GENERAL');
  const [formData, setFormData] = useState(settings);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'MAIN' | 'RECEIPT'>('MAIN');
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
      setFormData(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
    // Force a push immediately after saving settings
    pushToCloud({ settings: formData });
    notify("Configuración Guardada", "Los cambios se han guardado y sincronizado.", "success");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'MAIN' | 'RECEIPT') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  setCropImage(evt.target.result as string);
                  setCropTarget(target);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const onCropComplete = (processedImage: string) => {
      if (cropTarget === 'MAIN') {
          setFormData(prev => ({ ...prev, logo: processedImage }));
      } else {
          setFormData(prev => ({ ...prev, receiptLogo: processedImage }));
      }
      setCropImage(null);
  };

  const handleTestConnection = async () => {
      if (!formData.googleWebAppUrl) {
          notify("Error", "Ingresa una URL de Google Apps Script primero.", "warning");
          return;
      }
      setTestingConnection(true);
      try {
          const result = await fetchFullDataFromCloud(formData.googleWebAppUrl, formData.cloudSecret);
          if (result) {
              notify("¡Conexión Exitosa!", "La nube responde correctamente.", "success");
          } else {
              notify("Advertencia", "Conexión establecida pero sin datos.", "warning");
          }
      } catch (e: any) {
          notify("Error de Conexión", e.message || "Verifica la URL y tu internet.", "error");
      } finally {
          setTestingConnection(false);
      }
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      {cropImage && <ImageCropper imageSrc={cropImage} onCancel={() => setCropImage(null)} onSave={onCropComplete} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Configuración</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Personaliza tu negocio y sincronización.</p>
          </div>
          <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
             <Save className="w-5 h-5" /> Guardar Todo
          </button>
        </div>

        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto w-full md:w-fit">
            {['GENERAL', 'OPERATIONS', 'DATA'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    {tab === 'GENERAL' ? 'Identidad' : tab === 'OPERATIONS' ? 'Operación y Presupuesto' : 'Nube y Datos'}
                </button>
            ))}
        </div>

        <div className="space-y-6">
            {/* --- GENERAL SETTINGS --- */}
            {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s]">
                    {/* Basic Info */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Store className="w-5 h-5 text-indigo-500"/> Datos del Negocio</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Negocio</label>
                            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                            <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                                <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input type="email" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Branding */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Palette className="w-5 h-5 text-pink-500"/> Marca Visual</h3>
                        
                        <div className="flex gap-6">
                            <div className="flex-1 text-center">
                                <p className="text-xs font-bold text-slate-500 mb-2">Logo Principal (App)</p>
                                <div className="relative group mx-auto w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700">
                                    {formData.logo ? <img src={formData.logo} className="w-full h-full object-contain" /> : <Store className="w-8 h-8 text-slate-400" />}
                                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Upload className="w-6 h-6 mb-1" />
                                        <span className="text-[10px] font-bold">Cambiar</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'MAIN')} />
                                    </label>
                                </div>
                            </div>
                            <div className="flex-1 text-center">
                                <p className="text-xs font-bold text-slate-500 mb-2">Logo Tickets (B/N)</p>
                                <div className="relative group mx-auto w-24 h-24 bg-white rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300">
                                    {formData.receiptLogo ? <img src={formData.receiptLogo} className="w-full h-full object-contain p-2" /> : <Printer className="w-8 h-8 text-slate-300" />}
                                    <label className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Upload className="w-6 h-6 mb-1" />
                                        <span className="text-[10px] font-bold">Cambiar</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'RECEIPT')} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tema de la App</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button onClick={() => setFormData({ ...formData, theme: 'light' })} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${formData.theme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><Sun className="w-4 h-4"/> Claro</button>
                                <button onClick={() => setFormData({ ...formData, theme: 'dark' })} className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-all ${formData.theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'}`}><Moon className="w-4 h-4"/> Oscuro</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- OPERATIONS SETTINGS --- */}
            {activeTab === 'OPERATIONS' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s]">
                    {/* Presupuesto */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><PieChart className="w-5 h-5 text-emerald-500"/> Configuración de Presupuesto</h3>
                        <p className="text-xs text-slate-500">Define cómo distribuir tus ingresos automáticamente.</p>
                        
                        <div className="space-y-4 pt-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-indigo-600">Gastos Operativos (Renta, Luz, Stock)</span>
                                    <span>{formData.budgetConfig?.expensesPercentage}%</span>
                                </div>
                                <input type="range" className="w-full accent-indigo-600" min="0" max="100" value={formData.budgetConfig?.expensesPercentage || 50} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, expensesPercentage: parseInt(e.target.value) } })} />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-emerald-600">Inversión / Ahorro</span>
                                    <span>{formData.budgetConfig?.investmentPercentage}%</span>
                                </div>
                                <input type="range" className="w-full accent-emerald-600" min="0" max="100" value={formData.budgetConfig?.investmentPercentage || 30} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, investmentPercentage: parseInt(e.target.value) } })} />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-pink-600">Sueldos / Ganancia Personal</span>
                                    <span>{formData.budgetConfig?.profitPercentage}%</span>
                                </div>
                                <input type="range" className="w-full accent-pink-600" min="0" max="100" value={formData.budgetConfig?.profitPercentage || 20} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, profitPercentage: parseInt(e.target.value) } })} />
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-center font-mono">
                                Total: {(formData.budgetConfig?.expensesPercentage || 0) + (formData.budgetConfig?.investmentPercentage || 0) + (formData.budgetConfig?.profitPercentage || 0)}% 
                                {((formData.budgetConfig?.expensesPercentage || 0) + (formData.budgetConfig?.investmentPercentage || 0) + (formData.budgetConfig?.profitPercentage || 0)) !== 100 && <span className="text-red-500 font-bold ml-2">(Debe ser 100%)</span>}
                            </div>
                        </div>
                    </div>

                    {/* Folios y Tickets */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Hash className="w-5 h-5 text-orange-500"/> Folios y Tickets</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio Folio Tickets</label>
                                <input type="number" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.sequences?.ticketStart} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, ticketStart: parseInt(e.target.value) } })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inicio Folio Clientes</label>
                                <input type="number" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.sequences?.customerStart} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, customerStart: parseInt(e.target.value) } })} />
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pie de Página del Ticket</label>
                            <textarea className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none text-xs" rows={2} value={formData.receiptFooter} onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })} />
                        </div>
                    </div>

                    {/* Producción Docs */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 md:col-span-2">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><FileText className="w-5 h-5 text-blue-500"/> Documentos de Producción</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título del Documento</label>
                                <input type="text" className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" value={formData.productionDoc?.title} onChange={e => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, title: e.target.value } })} />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={formData.productionDoc?.showPrices} onChange={e => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, showPrices: e.target.checked } })} />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mostrar Precios en Orden</span>
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <input type="checkbox" className="w-5 h-5 rounded text-indigo-600" checked={formData.productionDoc?.showCustomerContact} onChange={e => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, showCustomerContact: e.target.checked } })} />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mostrar Teléfono Cliente</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DATA & SYNC SETTINGS --- */}
            {activeTab === 'DATA' && (
                <div className="grid grid-cols-1 gap-6 animate-[fadeIn_0.3s]">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Cloud className="w-5 h-5 text-indigo-500"/> Sincronización en la Nube</h3>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${formData.enableCloudSync ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {formData.enableCloudSync ? <CheckCircle className="w-3 h-3"/> : <CloudOff className="w-3 h-3"/>}
                                {formData.enableCloudSync ? 'Activado' : 'Desactivado'}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL del Google Apps Script</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs" 
                                    placeholder="https://script.google.com/macros/s/..."
                                    value={formData.googleWebAppUrl || ''} 
                                    onChange={e => setFormData({ ...formData, googleWebAppUrl: e.target.value })} 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clave Secreta (API Secret)</label>
                                <input 
                                    type="password" 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none font-mono text-xs" 
                                    value={formData.cloudSecret || ''} 
                                    onChange={e => setFormData({ ...formData, cloudSecret: e.target.value })} 
                                    placeholder="Opcional: Solo si configuraste seguridad en el script"
                                />
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button 
                                    onClick={() => setFormData({ ...formData, enableCloudSync: !formData.enableCloudSync })}
                                    className={`flex-1 py-3 rounded-xl font-bold border transition-colors ${formData.enableCloudSync ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}
                                >
                                    {formData.enableCloudSync ? 'Desactivar Sync' : 'Activar Sync'}
                                </button>
                                
                                <button 
                                    onClick={handleTestConnection}
                                    disabled={testingConnection || !formData.googleWebAppUrl}
                                    className="flex-[2] py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {testingConnection ? <Loader2 className="w-4 h-4 animate-spin"/> : <Server className="w-4 h-4"/>}
                                    {testingConnection ? 'Probando...' : 'Probar Conexión'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                        <h3 className="font-bold text-lg text-red-800 dark:text-red-400 flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5"/> Zona de Peligro</h3>
                        <p className="text-sm text-red-600 dark:text-red-300 mb-4">Acciones irreversibles que afectan tus datos locales.</p>
                        <button onClick={hardReset} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 dark:shadow-none flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> Restablecer y Descargar de Nube
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

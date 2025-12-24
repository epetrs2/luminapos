
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Save, Upload, Store, FileText, Palette, Sun, Moon, CheckCircle, Database, Download, AlertTriangle, PieChart, Bell, Volume2, Printer, Trash2, Hash, FileInput, Info, CreditCard, Percent, Cloud, CloudOff, RefreshCw, LayoutTemplate, Eye, Calendar, Phone, DollarSign, ToggleLeft, ToggleRight, Check, Lock, RotateCw, ShieldCheck, Loader2, Zap, X, Move, ZoomIn } from 'lucide-react';
import { pushFullDataToCloud } from '../services/syncService';

// --- IMAGE CROPPER COMPONENT ---
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

    // Load image initially
    useEffect(() => {
        imgRef.current.src = imageSrc;
        imgRef.current.onload = () => {
            setImgLoaded(true);
            // Center image initially
            const canvasSize = 300;
            let initialScale = 1;
            
            // Fit logic
            if (imgRef.current.width > imgRef.current.height) {
                initialScale = canvasSize / imgRef.current.height;
            } else {
                initialScale = canvasSize / imgRef.current.width;
            }
            setScale(initialScale * 0.8); // Start slightly zoomed out to see full image
        };
    }, [imageSrc]);

    // Draw Loop
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Clear & Fill White (Handles Transparency)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Image with Transforms
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.translate(centerX + offset.x, centerY + offset.y);
        ctx.scale(scale, scale);
        // Draw image centered at origin
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
        
        // FIX: Aggressively reduced resolution to ensuring it fits in cloud storage limits (Google Sheets cells)
        // 180px is plenty for a logo on a receipt or dashboard header.
        const outputSize = 180; 
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const ctx = outputCanvas.getContext('2d');
        
        if (ctx) {
            // Fill White
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, outputSize, outputSize);

            // Calculate ratio between preview (300px) and output (180px)
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

            // Export as JPEG with moderate quality (0.6) to ensure small base64 string (~3-6KB)
            onSave(outputCanvas.toDataURL('image/jpeg', 0.6));
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
  const { settings, updateSettings, hardReset, pushToCloud } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'DATA'>('GENERAL');
  const [formData, setFormData] = useState(settings);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'MAIN' | 'RECEIPT'>('MAIN');

  // Sync internal state with context when context updates (e.g. after cloud pull)
  useEffect(() => {
      setFormData(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(formData);
    pushToCloud({ settings: formData }); // Force push settings immediately
    // Show visual feedback maybe? Toast is handled in StoreContext usually
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

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      
      {cropImage && (
          <ImageCropper 
            imageSrc={cropImage} 
            onCancel={() => setCropImage(null)} 
            onSave={onCropComplete} 
          />
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Configuración</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Personaliza tu negocio y sistema.</p>
          </div>
          <div className="flex gap-2">
             <button onClick={handleSave} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
               <Save className="w-5 h-5" /> Guardar Cambios
             </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 mb-6 w-fit">
            <button 
                onClick={() => setActiveTab('GENERAL')} 
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'GENERAL' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
                General y Marca
            </button>
            <button 
                onClick={() => setActiveTab('DATA')} 
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'DATA' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
                Datos y Nube
            </button>
        </div>

        {activeTab === 'GENERAL' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
            {/* Business Info */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <Store className="w-5 h-5 text-indigo-500" /> Información del Negocio
                </h3>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre del Negocio</label>
                    <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                        <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                    <textarea rows={2} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
            </div>

            {/* Branding & Logos */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <Palette className="w-5 h-5 text-pink-500" /> Marca y Logos
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    {/* Main Logo */}
                    <div className="text-center">
                        <p className="text-xs font-bold text-slate-500 mb-2">Logo Principal (App)</p>
                        <div className="relative group w-32 h-32 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors">
                            {formData.logo ? (
                                <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                            ) : (
                                <Upload className="w-8 h-8 text-slate-400" />
                            )}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleLogoUpload(e, 'MAIN')} />
                            {formData.logo && (
                                <button onClick={(e) => { e.preventDefault(); setFormData({ ...formData, logo: null }); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Receipt Logo */}
                    <div className="text-center">
                        <p className="text-xs font-bold text-slate-500 mb-2">Logo Tickets (B/N)</p>
                        <div className="relative group w-32 h-32 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors">
                            {formData.receiptLogo ? (
                                <img src={formData.receiptLogo} alt="Receipt Logo" className="w-full h-full object-contain p-2 grayscale contrast-125" />
                            ) : (
                                <Upload className="w-8 h-8 text-slate-400" />
                            )}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => handleLogoUpload(e, 'RECEIPT')} />
                            {formData.receiptLogo && (
                                <button onClick={(e) => { e.preventDefault(); setFormData({ ...formData, receiptLogo: null }); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Theme Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        {formData.theme === 'dark' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>} Tema de la Aplicación
                    </span>
                    <button 
                        onClick={() => setFormData({...formData, theme: formData.theme === 'dark' ? 'light' : 'dark'})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Receipt Config */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                    <Printer className="w-5 h-5 text-emerald-500" /> Configuración de Tickets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Encabezado del Ticket</label>
                        <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.receiptHeader} onChange={e => setFormData({ ...formData, receiptHeader: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Pie de Página</label>
                        <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none" value={formData.receiptFooter} onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ancho del Papel</label>
                        <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button onClick={() => setFormData({...formData, ticketPaperWidth: '58mm'})} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${formData.ticketPaperWidth === '58mm' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>58mm</button>
                            <button onClick={() => setFormData({...formData, ticketPaperWidth: '80mm'})} className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${formData.ticketPaperWidth === '80mm' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>80mm</button>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        )}

        {activeTab === 'DATA' && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                {/* Cloud Sync Config */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Cloud className="w-5 h-5 text-blue-500" /> Sincronización en Nube (Google Sheets)
                    </h3>
                    
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50 mb-6 text-sm text-blue-800 dark:text-blue-200">
                        <p className="font-bold flex items-center gap-2"><Info className="w-4 h-4"/> ¿Cómo funciona?</p>
                        <p className="mt-1 opacity-80">Conecta tu sistema a una hoja de cálculo de Google para respaldar ventas, inventario y clientes automáticamente. Permite usar múltiples dispositivos.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Habilitar Sincronización</label>
                            <button 
                                onClick={() => setFormData({...formData, enableCloudSync: !formData.enableCloudSync})}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enableCloudSync ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enableCloudSync ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {formData.enableCloudSync && (
                            <div className="animate-[fadeIn_0.2s] space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL del Web App (Google Apps Script)</label>
                                    <input 
                                        type="text" 
                                        placeholder="https://script.google.com/macros/s/..." 
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                        value={formData.googleWebAppUrl || ''} 
                                        onChange={e => setFormData({ ...formData, googleWebAppUrl: e.target.value })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clave Secreta (Opcional)</label>
                                    <input 
                                        type="password" 
                                        placeholder="Si configuraste una clave en el script..." 
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={formData.cloudSecret || ''} 
                                        onChange={e => setFormData({ ...formData, cloudSecret: e.target.value })} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fiscal Data */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-orange-500" /> Datos Fiscales
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RFC / ID Fiscal</label>
                            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.taxId} onChange={e => setFormData({ ...formData, taxId: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
                            <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tasa de Impuesto (%)</label>
                            <div className="flex items-center gap-2">
                                <input type="number" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" value={formData.taxRate} onChange={e => setFormData({ ...formData, taxRate: parseFloat(e.target.value) })} />
                                <div className="flex items-center h-full">
                                    <input type="checkbox" checked={formData.enableTax} onChange={e => setFormData({...formData, enableTax: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ID Sequences */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                        <Hash className="w-5 h-5 text-slate-500" /> Secuencias de Folios
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ticket Inicio</label>
                            <input type="number" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" value={formData.sequences?.ticketStart || 10001} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, ticketStart: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente Inicio</label>
                            <input type="number" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" value={formData.sequences?.customerStart || 1001} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, customerStart: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Orden Inicio</label>
                            <input type="number" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" value={formData.sequences?.orderStart || 5001} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, orderStart: parseInt(e.target.value) } })} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prod ID Inicio</label>
                            <input type="number" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" value={formData.sequences?.productStart || 100} onChange={e => setFormData({ ...formData, sequences: { ...formData.sequences, productStart: parseInt(e.target.value) } })} />
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5" /> Zona de Peligro
                    </h3>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-red-700 dark:text-red-300">¿Problemas de sincronización? Esto forzará una descarga completa de la nube.</p>
                        <button onClick={hardReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow">
                            Resetear y Descargar
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

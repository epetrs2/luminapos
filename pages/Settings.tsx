
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../components/StoreContext';
import { Save, Upload, Store, FileText, Sun, Moon, CheckCircle, Cloud, CloudOff, Hash, PieChart, Printer, Trash2, Server, AlertTriangle, Loader2, X, Move, ZoomIn, ZoomOut, Grid3X3, Image as ImageIcon, Briefcase, Minus, Plus as PlusIcon, Ticket, Users, Receipt, Bluetooth, Power, Search, Bell, Volume2, Play, ClipboardList, Database, Download, UploadCloud, Lock, Shield, FileCheck, Copy, Calendar, Timer } from 'lucide-react';
import { fetchFullDataFromCloud } from '../services/syncService';
import { generateTestTicket } from '../utils/escPosHelper';
import { optimizeForThermal } from '../utils/imageHelper';
import { SoundType } from '../types';
import { playSystemSound } from '../utils/sound';

// ... ImageCropper code remains unchanged ...
interface ImageCropperProps {
    imageSrc: string;
    onCancel: () => void;
    onSave: (processedImage: string) => void;
    target: 'MAIN' | 'RECEIPT';
}

const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCancel, onSave, target }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(new Image());
    const [imgLoaded, setImgLoaded] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        imgRef.current.src = imageSrc;
        imgRef.current.onload = () => {
            setImgLoaded(true);
            const canvasSize = 320; 
            let initialScale = 1;
            if (imgRef.current.width > imgRef.current.height) {
                initialScale = canvasSize / imgRef.current.height;
            } else {
                initialScale = canvasSize / imgRef.current.width;
            }
            setScale(initialScale * 0.6); 
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
        ctx.drawImage(imgRef.current, -imgRef.current.width / 2, -imgRef.current.height / 2);
        ctx.restore();

        if (showGrid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(canvas.width * 0.33, 0); ctx.lineTo(canvas.width * 0.33, canvas.height);
            ctx.moveTo(canvas.width * 0.66, 0); ctx.lineTo(canvas.width * 0.66, canvas.height);
            ctx.moveTo(0, canvas.height * 0.33); ctx.lineTo(canvas.width, canvas.height * 0.33);
            ctx.moveTo(0, canvas.height * 0.66); ctx.lineTo(canvas.width, canvas.height * 0.66);
            ctx.stroke();
            
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; 
            ctx.beginPath();
            ctx.moveTo(centerX - 10, centerY); ctx.lineTo(centerX + 10, centerY);
            ctx.moveTo(centerX, centerY - 10); ctx.lineTo(centerX, centerY + 10);
            ctx.stroke();
        }

    }, [imgLoaded, scale, offset, showGrid]);

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

    const adjustZoom = (delta: number) => {
        setScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
    };

    const handleFinalSave = async () => {
        if (!canvasRef.current) return;
        setProcessing(true);
        
        await new Promise(r => setTimeout(r, 10));

        try {
            const outputSize = 384; 
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = outputSize;
            outputCanvas.height = outputSize;
            const ctx = outputCanvas.getContext('2d');
            
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, outputSize, outputSize);
                const ratio = outputSize / 320; 
                const centerX = outputSize / 2;
                const centerY = outputSize / 2;

                ctx.save();
                ctx.translate(centerX + (offset.x * ratio), centerY + (offset.y * ratio));
                ctx.scale(scale * ratio, scale * ratio);
                ctx.drawImage(imgRef.current, -imgRef.current.width / 2, -imgRef.current.height / 2);
                ctx.restore();
                
                let dataUrl = outputCanvas.toDataURL('image/png');
                
                if (target === 'RECEIPT') {
                    dataUrl = await optimizeForThermal(dataUrl);
                }
                
                onSave(dataUrl); 
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-[fadeIn_0.2s]">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Move className="w-5 h-5 text-indigo-500" /> {target === 'RECEIPT' ? 'Optimizar Logo Ticket' : 'Ajustar Logo'}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {target === 'RECEIPT' ? 'Se convertirá a B/N ideal para térmicas.' : 'Arrastra para mover, usa el slider para zoom.'}
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="relative w-full max-w-[320px] aspect-square mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-inner border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-move touch-none group">
                    <canvas ref={canvasRef} width={320} height={320} className="w-full h-full"
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove}
                    />
                    <button 
                        onClick={() => setShowGrid(!showGrid)} 
                        className="absolute top-2 right-2 p-2 bg-white/80 dark:bg-slate-900/80 rounded-lg shadow-sm text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Alternar Cuadrícula"
                    >
                        <Grid3X3 className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-6 mb-8">
                    <div className="flex items-center gap-4 justify-between">
                        <button onClick={() => adjustZoom(-0.1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"><Minus className="w-4 h-4"/></button>
                        
                        <div className="flex-1 flex items-center gap-3">
                            <ZoomOut className="w-4 h-4 text-slate-400" />
                            <input 
                                type="range" 
                                min="0.1" 
                                max="4" 
                                step="0.02" 
                                value={scale} 
                                onChange={(e) => setScale(parseFloat(e.target.value))} 
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                            />
                            <ZoomIn className="w-4 h-4 text-slate-400" />
                        </div>

                        <button onClick={() => adjustZoom(0.1)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"><PlusIcon className="w-4 h-4"/></button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancelar</button>
                    <button onClick={handleFinalSave} disabled={processing} className="flex-[2] py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2">
                        {processing ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle className="w-5 h-5" />}
                        {processing ? 'Procesando...' : 'Aplicar Logo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ... InputField component ...
const InputField = ({ label, value, onChange, type = "text", placeholder = "", icon: Icon }: any) => (
    <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{label}</label>
        <div className="relative group">
            {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />}
            <input 
                type={type} 
                value={value} 
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full ${Icon ? 'pl-9' : 'pl-4'} pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-medium text-sm shadow-sm`}
            />
        </div>
    </div>
);

// ... Main Settings Component ...
export const Settings: React.FC = () => {
  const { settings, updateSettings, hardReset, pushToCloud, pullFromCloud, notify, btDevice, btCharacteristic, connectBtPrinter, disconnectBtPrinter, sendBtData, products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, importData } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'OPERATIONS' | 'TICKETS' | 'DATA' | 'BLUETOOTH' | 'NOTIFICATIONS' | 'SECURITY' | 'BACKUP'>('GENERAL');
  const [formData, setFormData] = useState(settings);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'MAIN' | 'RECEIPT'>('MAIN');
  const [testingConnection, setTestingConnection] = useState(false);

  // --- BLUETOOTH STATE ---
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [btError, setBtError] = useState('');

  const isCloudConfigured = !!settings.googleWebAppUrl && settings.enableCloudSync;

  // Calculate Budget Total for Validation
  const budgetTotal = useMemo(() => {
      const b = formData.budgetConfig || { expensesPercentage: 0, investmentPercentage: 0, profitPercentage: 0 };
      return (b.expensesPercentage || 0) + (b.investmentPercentage || 0) + (b.profitPercentage || 0);
  }, [formData.budgetConfig]);

  useEffect(() => {
      setFormData(settings);
  }, [settings]);

  useEffect(() => {
      const root = window.document.documentElement;
      if (formData.theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      return () => {
          const globalIsDark = settings.theme === 'dark';
          if (globalIsDark) root.classList.add('dark');
          else root.classList.remove('dark');
      };
  }, [formData.theme, settings.theme]);

  const handleSave = () => {
    // Operations Budget Validation
    if (budgetTotal > 100) {
        notify("Error en Distribución", `La suma de porcentajes es ${budgetTotal}%. No puedes exceder el 100%.`, "error");
        return;
    }

    updateSettings(formData);
    pushToCloud({ settings: formData });
    notify("Configuración Guardada", "Los cambios se han guardado y sincronizado.", "success");
  };

  // ... (Existing handlers: logo, test connection, BT, backup) ...
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
          const success = await pullFromCloud(formData.googleWebAppUrl, formData.cloudSecret, false, true);
          if (success) {
              notify("¡Sincronizado!", "Conexión exitosa. Se han descargado tus datos.", "success");
          } else {
              notify("Conectado", "Nube vinculada (Sin datos previos).", "success");
          }
      } catch (e: any) {
          notify("Error", e.message || "Verifica la URL y tu internet.", "error");
      } finally {
          setTestingConnection(false);
      }
  };

  const handleBtScan = async () => {
      setBtError('');
      if (!(navigator as any).bluetooth) {
          setBtError("Tu navegador no soporta Bluetooth Web. Usa Chrome o Edge en Android/PC.");
          return;
      }
      setIsScanningBt(true);
      try {
          await connectBtPrinter();
      } catch (error: any) {
          if (error.name !== 'NotFoundError') {
              setBtError(error.message || 'Error al escanear.');
          }
      } finally {
          setIsScanningBt(false);
      }
  };

  const printBtTest = async () => {
      if (!btCharacteristic) return;
      try {
          const data = generateTestTicket();
          await sendBtData(data);
      } catch (error) {
          setBtError("Error al enviar datos.");
      }
  };

  const handleExportBackup = () => {
      const backupData = {
          products, transactions, customers, suppliers, cashMovements,
          orders, purchases, users, userInvites, categories, activityLogs,
          settings: formData,
          timestamp: new Date().toISOString(),
          version: '1.0'
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lumina_Backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify("Copia Creada", "El archivo de respaldo se ha descargado.", "success");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!window.confirm("¡ADVERTENCIA! Al restaurar, se SOBRESCRIBIRÁN todos los datos actuales con los del archivo. ¿Estás seguro?")) {
          e.target.value = ''; 
          return;
      }
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const json = JSON.parse(evt.target?.result as string);
              const success = await importData(json);
              if (success) {
                  notify("Restauración Completa", "Los datos han sido recuperados.", "success");
                  setTimeout(() => window.location.reload(), 1500);
              } else {
                  notify("Error", "El archivo parece estar dañado o inválido.", "error");
              }
          } catch (err) {
              console.error(err);
              notify("Error", "No se pudo leer el archivo de respaldo.", "error");
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      {cropImage && <ImageCropper imageSrc={cropImage} onCancel={() => setCropImage(null)} onSave={onCropComplete} target={cropTarget} />}

      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Configuración</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Personaliza la identidad y funcionamiento de tu negocio.</p>
          </div>
          
          <button onClick={handleSave} className="fixed bottom-6 right-6 md:static z-50 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-xl shadow-slate-300 dark:shadow-none transition-all active:scale-95">
             <Save className="w-5 h-5" /> Guardar Todo
          </button>
        </div>

        {/* ... Tab Menu (unchanged) ... */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-full md:w-fit overflow-x-auto">
            {[
                { id: 'GENERAL', label: 'Identidad', icon: Store },
                { id: 'OPERATIONS', label: 'Operación', icon: PieChart },
                { id: 'TICKETS', label: 'Impresión', icon: Receipt },
                { id: 'SECURITY', label: 'Seguridad', icon: Shield },
                { id: 'BLUETOOTH', label: 'Bluetooth', icon: Bluetooth },
                { id: 'NOTIFICATIONS', label: 'Alertas', icon: Bell },
                { id: 'DATA', label: 'Nube', icon: Cloud },
                { id: 'BACKUP', label: 'Respaldo', icon: Database }
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)} 
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 dark:bg-slate-800 dark:text-white shadow-sm ring-1 ring-indigo-100 dark:ring-slate-700' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300'}`}
                >
                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.label.split(' ')[0]}</span>
                </button>
            ))}
        </div>

        <div className="space-y-6">
            {/* GENERAL TAB (Unchanged) */}
            {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Briefcase className="w-5 h-5"/></div>
                                Información del Negocio
                            </h3>
                            <div className="space-y-5">
                                <InputField label="Nombre del Negocio" value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} icon={Store} />
                                <InputField label="Dirección / Ubicación" value={formData.address} onChange={(e: any) => setFormData({ ...formData, address: e.target.value })} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <InputField label="Teléfono de Contacto" value={formData.phone} onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })} />
                                    <InputField label="Correo Electrónico" value={formData.email} onChange={(e: any) => setFormData({ ...formData, email: e.target.value })} type="email" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-fit">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Apariencia</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <button onClick={() => setFormData({ ...formData, theme: 'light' })} className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.theme === 'light' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
                                    <Sun className={`w-6 h-6 ${formData.theme === 'light' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-xs">Claro</span>
                                </button>
                                <button onClick={() => setFormData({ ...formData, theme: 'dark' })} className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${formData.theme === 'dark' ? 'border-indigo-500 bg-slate-800' : 'border-slate-100 dark:border-slate-800'}`}>
                                    <Moon className={`w-6 h-6 ${formData.theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`} />
                                    <span className="font-bold text-xs">Oscuro</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OPERATIONS TAB - UPDATED WITH CYCLE START DATE */}
            {activeTab === 'OPERATIONS' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    
                    {/* NEW: Fiscal Cycle Settings */}
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600"><Calendar className="w-5 h-5"/></div>
                            Ciclo Fiscal y Presupuesto
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Inicio de Operaciones</label>
                                <input 
                                    type="date"
                                    value={formData.budgetConfig?.fiscalStartDate || new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setFormData({...formData, budgetConfig: {...formData.budgetConfig, fiscalStartDate: e.target.value}})}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Fecha base para calcular los periodos (Ej. Si pones 11 de Dic, tu mes es del 11 al 10).</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Tipo de Ciclo</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setFormData({...formData, budgetConfig: {...formData.budgetConfig, cycleType: 'MONTHLY'}})}
                                        className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${formData.budgetConfig?.cycleType === 'MONTHLY' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                    >
                                        📅 Mensual
                                    </button>
                                    <button 
                                        onClick={() => setFormData({...formData, budgetConfig: {...formData.budgetConfig, cycleType: 'FIXED_DAYS'}})}
                                        className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${formData.budgetConfig?.cycleType === 'FIXED_DAYS' ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                    >
                                        🔢 Días Fijos
                                    </button>
                                </div>
                            </div>

                            {formData.budgetConfig?.cycleType === 'FIXED_DAYS' && (
                                <div className="animate-[fadeIn_0.3s]">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Duración del Ciclo (Días)</label>
                                    <div className="relative">
                                        <Timer className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                                        <input 
                                            type="number"
                                            min="1"
                                            value={formData.budgetConfig?.cycleLength || 30}
                                            onChange={(e) => setFormData({...formData, budgetConfig: {...formData.budgetConfig, cycleLength: parseInt(e.target.value)}})}
                                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border transition-colors ${budgetTotal > 100 ? 'border-red-300 dark:border-red-900' : 'border-slate-100 dark:border-slate-800'}`}>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600"><PieChart className="w-5 h-5"/></div>
                            Distribución de Ingresos
                        </h3>
                        
                        <div className="space-y-8 mt-6">
                            <div className="relative">
                                <div className="flex justify-between text-sm font-bold mb-2">
                                    <span className="text-indigo-600 dark:text-indigo-400">Gastos Operativos</span>
                                    <span className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded text-indigo-700 dark:text-indigo-300">{formData.budgetConfig?.expensesPercentage}%</span>
                                </div>
                                <input type="range" className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500" min="0" max="100" value={formData.budgetConfig?.expensesPercentage || 50} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, expensesPercentage: parseInt(e.target.value) } })} />
                            </div>
                            
                            <div className="relative">
                                <div className="flex justify-between text-sm font-bold mb-2">
                                    <span className="text-emerald-600 dark:text-emerald-400">Inversión y Ahorro</span>
                                    <span className="bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">{formData.budgetConfig?.investmentPercentage}%</span>
                                </div>
                                <input type="range" className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400" min="0" max="100" value={formData.budgetConfig?.investmentPercentage || 30} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, investmentPercentage: parseInt(e.target.value) } })} />
                            </div>

                            <div className="relative">
                                <div className="flex justify-between text-sm font-bold mb-2">
                                    <span className="text-pink-600 dark:text-pink-400">Sueldos y Ganancia</span>
                                    <span className="bg-pink-50 dark:bg-pink-900/30 px-2 py-0.5 rounded text-pink-700 dark:text-pink-300">{formData.budgetConfig?.profitPercentage}%</span>
                                </div>
                                <input type="range" className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400" min="0" max="100" value={formData.budgetConfig?.profitPercentage || 20} onChange={e => setFormData({ ...formData, budgetConfig: { ...formData.budgetConfig, profitPercentage: parseInt(e.target.value) } })} />
                            </div>
                        </div>

                        <div className={`mt-8 p-4 rounded-2xl border flex justify-between items-center transition-colors ${budgetTotal > 100 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm uppercase tracking-wide">Total Distribución</span>
                                {budgetTotal > 100 && <span className="text-xs font-bold mt-1">⚠️ Excede el 100%</span>}
                            </div>
                            <span className="font-black text-2xl">{budgetTotal}%</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Hash className="w-5 h-5"/></div>
                                Secuencias y Folios
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group focus-within:border-indigo-500 transition-colors">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Próximo Ticket</p>
                                        <div className="flex items-center gap-2">
                                            <Ticket className="w-5 h-5 text-indigo-500"/>
                                            <input 
                                                type="number" 
                                                value={formData.sequences?.ticketStart} 
                                                onChange={(e: any) => setFormData({ ...formData, sequences: { ...formData.sequences, ticketStart: parseInt(e.target.value) } })} 
                                                className="bg-transparent text-2xl font-black text-slate-800 dark:text-white outline-none w-full" 
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between group focus-within:border-emerald-500 transition-colors">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Próximo Cliente</p>
                                        <div className="flex items-center gap-2">
                                            <Users className="w-5 h-5 text-emerald-500"/>
                                            <input 
                                                type="number" 
                                                value={formData.sequences?.customerStart} 
                                                onChange={(e: any) => setFormData({ ...formData, sequences: { ...formData.sequences, customerStart: parseInt(e.target.value) } })} 
                                                className="bg-transparent text-2xl font-black text-slate-800 dark:text-white outline-none w-full" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TICKETS TAB */}
            {activeTab === 'TICKETS' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-6">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Receipt className="w-5 h-5"/></div>
                                    Diseño del Ticket
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ancho de Papel</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setFormData({...formData, ticketPaperWidth: '58mm'})} className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${formData.ticketPaperWidth === '58mm' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>58mm (Estándar)</button>
                                            <button onClick={() => setFormData({...formData, ticketPaperWidth: '80mm'})} className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${formData.ticketPaperWidth === '80mm' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>80mm (Ancho)</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Comportamiento Copia Cliente</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button onClick={() => setFormData({...formData, printConfig: {...formData.printConfig, customerCopyBehavior: 'ALWAYS'}})} className={`py-2 rounded-lg text-xs font-bold border ${formData.printConfig?.customerCopyBehavior === 'ALWAYS' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>Siempre</button>
                                            <button onClick={() => setFormData({...formData, printConfig: {...formData.printConfig, customerCopyBehavior: 'ASK'}})} className={`py-2 rounded-lg text-xs font-bold border ${formData.printConfig?.customerCopyBehavior === 'ASK' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>Preguntar</button>
                                            <button onClick={() => setFormData({...formData, printConfig: {...formData.printConfig, customerCopyBehavior: 'NEVER'}})} className={`py-2 rounded-lg text-xs font-bold border ${formData.printConfig?.customerCopyBehavior === 'NEVER' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500'}`}>Nunca</button>
                                        </div>
                                    </div>

                                    <InputField label="Encabezado del Ticket" value={formData.receiptHeader} onChange={(e: any) => setFormData({ ...formData, receiptHeader: e.target.value })} placeholder="Ej. Bienvenido a..." />
                                    <InputField label="Pie de Página" value={formData.receiptFooter} onChange={(e: any) => setFormData({ ...formData, receiptFooter: e.target.value })} placeholder="Ej. ¡Gracias por su compra!" />
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Logo para Ticket (B/N)</label>
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative group">
                                            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'RECEIPT')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                            {formData.receiptLogo ? (
                                                <div className="relative h-20 w-full flex items-center justify-center">
                                                    <img src={formData.receiptLogo} alt="Receipt Logo" className="h-full object-contain filter grayscale" />
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">Cambiar</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400">
                                                    <Upload className="w-8 h-8 mb-2" />
                                                    <span className="text-xs">Subir imagen (PNG/JPG)</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Se convertirá automáticamente a blanco y negro de alto contraste.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-100 dark:bg-black p-4 rounded-xl shadow-inner font-mono text-xs overflow-hidden flex flex-col items-center">
                                <p className="text-slate-400 mb-2 uppercase font-bold text-[10px]">Vista Previa Aproximada</p>
                                <div className={`bg-white text-black p-4 shadow-lg w-full max-w-[${formData.ticketPaperWidth === '58mm' ? '280px' : '360px'}]`} style={{minHeight: '400px'}}>
                                    <div className="text-center mb-4">
                                        {formData.receiptLogo && <img src={formData.receiptLogo} className="h-12 mx-auto mb-2 grayscale" />}
                                        <div className="font-bold text-sm uppercase">{formData.name || 'NOMBRE NEGOCIO'}</div>
                                        <div>{formData.address || 'Dirección...'}</div>
                                        <div>Tel: {formData.phone || '000-000-0000'}</div>
                                    </div>
                                    <div className="border-b border-black border-dashed my-2"></div>
                                    <div>Ticket: #0001</div>
                                    <div>Fecha: {new Date().toLocaleDateString()}</div>
                                    <div className="border-b border-black border-dashed my-2"></div>
                                    <div className="flex justify-between font-bold mb-1">
                                        <span>CANT. DESC</span>
                                        <span>TOTAL</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>1 x Producto Ejemplo</span>
                                        <span>$150.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>2 x Otro Articulo</span>
                                        <span>$50.00</span>
                                    </div>
                                    <div className="border-b border-black border-dashed my-2"></div>
                                    <div className="flex justify-between font-bold text-sm">
                                        <span>TOTAL:</span>
                                        <span>$200.00</span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span>Efectivo:</span>
                                        <span>$200.00</span>
                                    </div>
                                    <div className="border-b border-black border-dashed my-2"></div>
                                    <div className="text-center mt-4">
                                        {formData.receiptFooter || 'Gracias por su compra'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'SECURITY' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600"><Lock className="w-5 h-5"/></div>
                            Seguridad y Privacidad
                        </h3>
                        
                        <div className="space-y-6 max-w-2xl">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Bloqueo Automático</label>
                                <div className="flex gap-2">
                                    {[0, 1, 5, 15, 30].map(mins => (
                                        <button 
                                            key={mins}
                                            onClick={() => setFormData({...formData, securityConfig: {...formData.securityConfig, autoLockMinutes: mins}})}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${formData.securityConfig?.autoLockMinutes === mins ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                        >
                                            {mins === 0 ? 'Nunca' : `${mins} min`}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">La pantalla se bloqueará tras este tiempo de inactividad.</p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">Desenfocar en Segundo Plano</h4>
                                    <p className="text-xs text-slate-500">Ocultar contenido si cambias de pestaña o minimizas.</p>
                                </div>
                                <button 
                                    onClick={() => setFormData({...formData, securityConfig: {...formData.securityConfig, blurAppOnBackground: !formData.securityConfig.blurAppOnBackground}})}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.securityConfig?.blurAppOnBackground ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.securityConfig?.blurAppOnBackground ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BLUETOOTH TAB */}
            {activeTab === 'BLUETOOTH' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><Bluetooth className="w-5 h-5"/></div>
                            Impresora Bluetooth
                        </h3>

                        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 mb-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${btDevice ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-200 text-slate-400'}`}>
                                <Bluetooth className="w-10 h-10" />
                            </div>
                            <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                                {btDevice ? `Conectado: ${btDevice.name || 'Dispositivo'}` : 'No conectado'}
                            </h4>
                            <p className="text-sm text-slate-500 mb-6">Estado del servicio: {btDevice ? 'Activo' : 'Inactivo'}</p>
                            
                            <div className="flex gap-3">
                                {!btDevice ? (
                                    <button 
                                        onClick={handleBtScan} 
                                        disabled={isScanningBt}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {isScanningBt ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5" />}
                                        {isScanningBt ? 'Buscando...' : 'Buscar Dispositivo'}
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={printBtTest} className="bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50">
                                            <FileText className="w-5 h-5" /> Probar Impresión
                                        </button>
                                        <button onClick={disconnectBtPrinter} className="bg-red-100 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-200">
                                            <Power className="w-5 h-5" /> Desconectar
                                        </button>
                                    </>
                                )}
                            </div>
                            {btError && <p className="mt-4 text-red-500 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg">{btError}</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'NOTIFICATIONS' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600"><Bell className="w-5 h-5"/></div>
                            Preferencias de Alertas y Sonido
                        </h3>
                        <div className="space-y-8 max-w-2xl">
                            <div className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 gap-3 md:gap-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-0.5 md:mb-1 text-sm md:text-base">Activar Efectos de Sonido</h4>
                                    <p className="text-[10px] md:text-xs text-slate-500 leading-snug">Reproducir sonidos al completar ventas, errores o advertencias.</p>
                                </div>
                                <button 
                                    onClick={() => setFormData({...formData, soundConfig: {...formData.soundConfig, enabled: !formData.soundConfig.enabled}})}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.soundConfig?.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.soundConfig?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            
                            <div className={`transition-opacity ${formData.soundConfig?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div className="flex items-center gap-4 mb-2">
                                    <Volume2 className="w-5 h-5 text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Volumen General</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={formData.soundConfig?.volume || 0.5} 
                                    onChange={(e) => setFormData({...formData, soundConfig: {...formData.soundConfig, volume: parseFloat(e.target.value)}})}
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                            
                            {['saleSound', 'errorSound', 'clickSound', 'notificationSound'].map((key) => (
                                <div key={key} className={`space-y-2 transition-opacity ${formData.soundConfig?.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase">{key.replace('Sound', '')}</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={(formData.soundConfig as any)[key]}
                                            onChange={(e) => setFormData({...formData, soundConfig: {...formData.soundConfig, [key]: e.target.value}})}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium outline-none focus:border-indigo-500"
                                        >
                                            <option value="SUCCESS">Éxito</option>
                                            <option value="ERROR">Error</option>
                                            <option value="POP">Pop</option>
                                            <option value="NOTE">Nota</option>
                                            <option value="NONE">Silencio</option>
                                        </select>
                                        <button onClick={() => playSystemSound((formData.soundConfig as any)[key], formData.soundConfig.volume)} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100"><Play className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* DATA & CLOUD TAB */}
            {activeTab === 'DATA' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg text-cyan-600"><Cloud className="w-5 h-5"/></div>
                            Sincronización en Nube
                        </h3>

                        <div className="space-y-6">
                            <div className={`p-4 rounded-2xl border flex items-center gap-4 ${isCloudConfigured ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                                <div className={`p-3 rounded-full ${isCloudConfigured ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                    {isCloudConfigured ? <Cloud className="w-6 h-6" /> : <CloudOff className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{isCloudConfigured ? 'Conectado a Google Sheets' : 'Modo Local (Sin Respaldo)'}</h4>
                                    <p className="text-xs text-slate-500">{isCloudConfigured ? 'Tus datos se guardan automáticamente.' : 'Configura la URL para activar el respaldo.'}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <InputField label="URL del Script (Google Apps Script)" value={formData.googleWebAppUrl || ''} onChange={(e: any) => setFormData({ ...formData, googleWebAppUrl: e.target.value })} placeholder="https://script.google.com/..." />
                                <InputField label="Clave Secreta (Opcional)" value={formData.cloudSecret || ''} onChange={(e: any) => setFormData({ ...formData, cloudSecret: e.target.value })} type="password" />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={handleTestConnection} disabled={testingConnection} className="flex-1 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                                    {testingConnection ? <Loader2 className="w-4 h-4 animate-spin"/> : <Server className="w-4 h-4"/>}
                                    {testingConnection ? 'Verificando...' : 'Probar Conexión'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BACKUP TAB */}
            {activeTab === 'BACKUP' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Database className="w-5 h-5"/></div>
                            Gestión de Datos Local
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center hover:border-indigo-500 transition-colors group">
                                <Download className="w-10 h-10 text-indigo-500 mb-3 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-slate-800 dark:text-white">Exportar Copia</h4>
                                <p className="text-xs text-slate-500 mb-4 px-4">Descarga un archivo .json con toda tu información actual.</p>
                                <button onClick={handleExportBackup} className="w-full py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600">Descargar</button>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center hover:border-emerald-500 transition-colors group relative">
                                <UploadCloud className="w-10 h-10 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                                <h4 className="font-bold text-slate-800 dark:text-white">Restaurar Copia</h4>
                                <p className="text-xs text-slate-500 mb-4 px-4">Carga un archivo de respaldo para recuperar datos.</p>
                                <button className="w-full py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600">Seleccionar Archivo</button>
                                <input type="file" accept=".json" onChange={handleImportBackup} className="absolute inset-0 opacity-0 cursor-pointer" />
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Zona de Peligro</h4>
                            <p className="text-xs text-slate-500 mb-4">Estas acciones son irreversibles. Ten cuidado.</p>
                            <button 
                                onClick={() => { if(window.confirm("¿SEGURO? Se borrarán TODOS los datos locales y se reiniciará la app.")) hardReset(); }} 
                                className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4"/> Borrar Todo y Reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

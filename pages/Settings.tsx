import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Save, Upload, Store, FileText, Palette, Sun, Moon, CheckCircle, Cloud, CloudOff, Hash, PieChart, Printer, Trash2, Server, AlertTriangle, Loader2, X, Move, ZoomIn, ZoomOut, Grid3X3, Image as ImageIcon, Briefcase, Minus, Plus as PlusIcon, Ticket, Users, Receipt, Smartphone, LayoutTemplate, Bluetooth, RefreshCw, Power, Search } from 'lucide-react';
import { fetchFullDataFromCloud } from '../services/syncService';

// --- IMAGE CROPPER COMPONENT (IMPROVED UX) ---
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
    const [showGrid, setShowGrid] = useState(true);

    useEffect(() => {
        imgRef.current.src = imageSrc;
        imgRef.current.onload = () => {
            setImgLoaded(true);
            const canvasSize = 320; // Slightly larger canvas
            // Initial fit logic
            let initialScale = 1;
            if (imgRef.current.width > imgRef.current.height) {
                initialScale = canvasSize / imgRef.current.height;
            } else {
                initialScale = canvasSize / imgRef.current.width;
            }
            setScale(initialScale * 0.6); // Start slightly zoomed out for easier adjustment
        };
    }, [imageSrc]);

    useEffect(() => {
        if (!imgLoaded || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear and set background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF'; // Always white background for thermal printer compatibility
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.translate(centerX + offset.x, centerY + offset.y);
        ctx.scale(scale, scale);
        ctx.drawImage(imgRef.current, -imgRef.current.width / 2, -imgRef.current.height / 2);
        ctx.restore();

        // Draw Guide Grid (Overlay)
        if (showGrid) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Vertical lines
            ctx.moveTo(canvas.width * 0.33, 0); ctx.lineTo(canvas.width * 0.33, canvas.height);
            ctx.moveTo(canvas.width * 0.66, 0); ctx.lineTo(canvas.width * 0.66, canvas.height);
            // Horizontal lines
            ctx.moveTo(0, canvas.height * 0.33); ctx.lineTo(canvas.width, canvas.height * 0.33);
            ctx.moveTo(0, canvas.height * 0.66); ctx.lineTo(canvas.width, canvas.height * 0.66);
            ctx.stroke();
            
            // Center Crosshair
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; // Indigo color
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

    const handleFinalSave = () => {
        if (!canvasRef.current) return;
        // Optimization: Standardize to 200x200 for sync efficiency
        const outputSize = 200; 
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputSize;
        outputCanvas.height = outputSize;
        const ctx = outputCanvas.getContext('2d');
        
        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, outputSize, outputSize);
            const ratio = outputSize / 320; // 320 is the view canvas size
            const centerX = outputSize / 2;
            const centerY = outputSize / 2;

            ctx.save();
            ctx.translate(centerX + (offset.x * ratio), centerY + (offset.y * ratio));
            ctx.scale(scale * ratio, scale * ratio);
            ctx.drawImage(imgRef.current, -imgRef.current.width / 2, -imgRef.current.height / 2);
            ctx.restore();
            // Lower quality slightly to ensure sync robustness (0.6 is good for logos)
            onSave(outputCanvas.toDataURL('image/jpeg', 0.6)); 
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-[fadeIn_0.2s]">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Move className="w-5 h-5 text-indigo-500" /> Ajustar Logo
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Arrastra para mover, usa el slider para zoom.</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="relative w-[320px] h-[320px] mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-inner border-2 border-dashed border-slate-300 dark:border-slate-600 cursor-move touch-none group">
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

                {/* Precision Zoom Controls */}
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
                    <button onClick={handleFinalSave} className="flex-[2] py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Aplicar Logo
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Settings: React.FC = () => {
  const { settings, updateSettings, hardReset, pushToCloud, notify } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'OPERATIONS' | 'TICKETS' | 'DATA' | 'BLUETOOTH'>('GENERAL');
  const [formData, setFormData] = useState(settings);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<'MAIN' | 'RECEIPT'>('MAIN');
  const [testingConnection, setTestingConnection] = useState(false);

  // --- BLUETOOTH STATE ---
  const [btDevice, setBtDevice] = useState<any>(null);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [btError, setBtError] = useState('');
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);

  // Sync internal state with context updates
  useEffect(() => {
      setFormData(settings);
  }, [settings]);

  // Preview Theme Immediately
  useEffect(() => {
      const root = window.document.documentElement;
      if (formData.theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
      // Revert if navigating away without saving happens via unmount of component
      return () => {
          // Re-apply the globally saved setting to ensure consistency
          const globalIsDark = settings.theme === 'dark';
          if (globalIsDark) root.classList.add('dark');
          else root.classList.remove('dark');
      };
  }, [formData.theme, settings.theme]);

  const handleSave = () => {
    updateSettings(formData);
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

  // --- BLUETOOTH FUNCTIONS ---
  const handleBtScan = async () => {
      setBtError('');
      setIsScanningBt(true);
      try {
          // Request Web Bluetooth Device
          const device = await (navigator as any).bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Generic service often used, helps permission flow
          });

          await connectToDevice(device);
      } catch (error: any) {
          console.error("BT Error:", error);
          setBtError(error.message || 'Error al escanear. Asegúrate de tener Bluetooth encendido.');
      } finally {
          setIsScanningBt(false);
      }
  };

  const connectToDevice = async (device: any) => {
      try {
          const server = await device.gatt.connect();
          setBtDevice(device);
          
          // Store device name in settings automatically
          if (device.name) {
              setFormData(prev => ({...prev, bluetoothPrinterName: device.name}));
          }

          // Try to find a writable characteristic
          // This is a generic approach for thermal printers
          const services = await server.getPrimaryServices();
          let char: any = null;

          for (const service of services) {
              const characteristics = await service.getCharacteristics();
              for (const c of characteristics) {
                  if (c.properties.write || c.properties.writeWithoutResponse) {
                      char = c;
                      break;
                  }
              }
              if (char) break;
          }

          if (char) {
              setBtCharacteristic(char);
              notify('Impresora Conectada', `Conectado a ${device.name}`, 'success');
          } else {
              setBtError('No se encontró un servicio de escritura compatible en este dispositivo.');
              device.gatt.disconnect();
              setBtDevice(null);
          }

      } catch (error: any) {
          console.error("Connect Error:", error);
          setBtError('No se pudo conectar. Verifica que la impresora esté encendida y cerca.');
      }
  };

  const handleBtDisconnect = () => {
      if (btDevice && btDevice.gatt.connected) {
          btDevice.gatt.disconnect();
      }
      setBtDevice(null);
      setBtCharacteristic(null);
  };

  const printBtTest = async () => {
      if (!btCharacteristic) return;
      try {
          const encoder = new TextEncoder();
          const commands = [
              0x1B, 0x40, // Initialize
              0x1B, 0x61, 0x01, // Center align
              ...encoder.encode("LuminaPOS\n"),
              ...encoder.encode("Prueba Bluetooth\n"),
              ...encoder.encode("----------------\n"),
              0x1B, 0x61, 0x00, // Left align
              ...encoder.encode("Conexion exitosa.\n"),
              ...encoder.encode("Listo para imprimir.\n\n\n\n"), // Feed
          ];
          await btCharacteristic.writeValue(new Uint8Array(commands));
      } catch (error) {
          console.error("Print Error:", error);
          setBtError("Error al enviar datos. Intenta reconectar.");
      }
  };

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

  // Derived state for Cloud Connection Status
  const isCloudConfigured = formData.enableCloudSync && formData.googleWebAppUrl && formData.googleWebAppUrl.trim().length > 10;

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      {cropImage && <ImageCropper imageSrc={cropImage} onCancel={() => setCropImage(null)} onSave={onCropComplete} />}

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

        {/* --- NAVIGATION TABS --- */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-full md:w-fit">
            {[
                { id: 'GENERAL', label: 'Identidad', icon: Store },
                { id: 'OPERATIONS', label: 'Operación', icon: PieChart },
                { id: 'TICKETS', label: 'Impresión', icon: Receipt },
                { id: 'BLUETOOTH', label: 'Impresora Bluetooth', icon: Bluetooth },
                { id: 'DATA', label: 'Nube', icon: Cloud }
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
            {/* --- GENERAL SETTINGS --- */}
            {activeTab === 'GENERAL' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    {/* Basic Info Column */}
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

                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600"><Palette className="w-5 h-5"/></div>
                                Apariencia
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setFormData({ ...formData, theme: 'light' })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.theme === 'light' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}>
                                    <Sun className={`w-8 h-8 ${formData.theme === 'light' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-sm">Modo Claro</span>
                                </button>
                                <button onClick={() => setFormData({ ...formData, theme: 'dark' })} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${formData.theme === 'dark' ? 'border-indigo-500 bg-slate-800' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}>
                                    <Moon className={`w-8 h-8 ${formData.theme === 'dark' ? 'text-indigo-400' : 'text-slate-400'}`} />
                                    <span className="font-bold text-sm">Modo Oscuro</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Branding Column */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 h-fit">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Logotipos</h3>
                        
                        <div className="space-y-8">
                            <div className="text-center">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Logo Principal (App & Web)</p>
                                <div className="relative group mx-auto w-40 h-40 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-colors">
                                    {formData.logo ? <img src={formData.logo} className="w-full h-full object-contain p-2" /> : <ImageIcon className="w-12 h-12 text-slate-300" />}
                                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer">
                                        <Upload className="w-8 h-8 mb-2" />
                                        <span className="text-xs font-bold">Cambiar Logo</span>
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleLogoUpload(e, 'MAIN')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- OPERATIONS SETTINGS --- */}
            {activeTab === 'OPERATIONS' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    {/* Budget Config */}
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-2">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600"><PieChart className="w-5 h-5"/></div>
                            Distribución de Ingresos
                        </h3>
                        <p className="text-sm text-slate-500 mb-8">Define automáticamente cómo se dividen tus ganancias.</p>
                        
                        <div className="space-y-8">
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

                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex justify-between items-center border border-slate-100 dark:border-slate-700">
                                <span className="text-xs font-bold text-slate-500 uppercase">Suma Total</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-black ${((formData.budgetConfig?.expensesPercentage || 0) + (formData.budgetConfig?.investmentPercentage || 0) + (formData.budgetConfig?.profitPercentage || 0)) === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                        {(formData.budgetConfig?.expensesPercentage || 0) + (formData.budgetConfig?.investmentPercentage || 0) + (formData.budgetConfig?.profitPercentage || 0)}%
                                    </span>
                                    {((formData.budgetConfig?.expensesPercentage || 0) + (formData.budgetConfig?.investmentPercentage || 0) + (formData.budgetConfig?.profitPercentage || 0)) !== 100 && <AlertTriangle className="w-5 h-5 text-red-500" />}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tickets & Config */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600"><Hash className="w-5 h-5"/></div>
                                Secuencias y Folios
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Ticket Counter Card */}
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
                                    <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600">
                                        <Hash className="w-5 h-5"/>
                                    </div>
                                </div>

                                {/* Customer Counter Card */}
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
                                    <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                                        <Hash className="w-5 h-5"/>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><FileText className="w-5 h-5"/></div>
                                Hoja de Producción
                            </h3>
                            <InputField label="Título del Documento" value={formData.productionDoc?.title} onChange={(e: any) => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, title: e.target.value } })} />
                            
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer" onClick={() => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, showPrices: !formData.productionDoc?.showPrices } })}>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mostrar Precios</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.productionDoc?.showPrices ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${formData.productionDoc?.showPrices ? 'translate-x-6' : ''}`} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer" onClick={() => setFormData({ ...formData, productionDoc: { ...formData.productionDoc, showCustomerContact: !formData.productionDoc?.showCustomerContact } })}>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mostrar Contacto Cliente</span>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.productionDoc?.showCustomerContact ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${formData.productionDoc?.showCustomerContact ? 'translate-x-6' : ''}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TICKETS & PRINTING (NEW TAB) --- */}
            {activeTab === 'TICKETS' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-[fadeIn_0.3s_ease-out]">
                    {/* Controls Column */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Printer className="w-5 h-5"/></div>
                                Ticket Térmico
                            </h3>

                            <div className="space-y-6">
                                {/* Paper Size */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1 mb-2 block">Ancho de Papel</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => setFormData({...formData, ticketPaperWidth: '58mm'})}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${formData.ticketPaperWidth === '58mm' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'}`}
                                        >
                                            <Receipt className="w-6 h-6" />
                                            <span className="font-bold text-sm">58 mm</span>
                                        </button>
                                        <button 
                                            onClick={() => setFormData({...formData, ticketPaperWidth: '80mm'})}
                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${formData.ticketPaperWidth === '80mm' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'}`}
                                        >
                                            <Receipt className="w-8 h-8" />
                                            <span className="font-bold text-sm">80 mm</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Logo Uploader for Receipt */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="relative group w-24 h-24 bg-white rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 hover:border-slate-900 transition-colors shadow-sm shrink-0">
                                            {formData.receiptLogo ? <img src={formData.receiptLogo} className="w-full h-full object-contain p-2" /> : <Printer className="w-8 h-8 text-slate-300" />}
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer">
                                                <Upload className="w-5 h-5" />
                                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleLogoUpload(e, 'RECEIPT')} />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-800 dark:text-white">Logo de Ticket</p>
                                            <p className="text-xs text-slate-500 mt-1 leading-tight">Recomendado: Fondo blanco puro y líneas negras (B/N) para impresión térmica nítida.</p>
                                        </div>
                                    </div>
                                </div>

                                <InputField label="Encabezado / Slogan" value={formData.receiptHeader || ''} onChange={(e: any) => setFormData({ ...formData, receiptHeader: e.target.value })} placeholder="Ej. ¡Bienvenido!" />
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Pie de Página</label>
                                    <textarea 
                                        className="w-full px-4 pt-3 pb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none text-center text-xs font-mono focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none shadow-sm" 
                                        rows={3} 
                                        value={formData.receiptFooter} 
                                        onChange={e => setFormData({ ...formData, receiptFooter: e.target.value })} 
                                        placeholder="Ej. Gracias por su compra"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600"><FileText className="w-5 h-5"/></div>
                                Nota de Venta (Carta)
                            </h3>
                            
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Márgenes de Impresión</label>
                                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{formData.invoicePadding || 10}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="50" 
                                    step="1" 
                                    value={formData.invoicePadding || 10} 
                                    onChange={(e) => setFormData({...formData, invoicePadding: parseInt(e.target.value)})}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <p className="text-[10px] text-slate-400 mt-2">Ajusta si el contenido se corta al imprimir en tu impresora.</p>
                            </div>
                        </div>
                    </div>

                    {/* Live Preview Column */}
                    <div className="bg-slate-100 dark:bg-black/20 rounded-3xl p-8 flex items-start justify-center overflow-hidden border border-slate-200/50 dark:border-slate-800">
                        <div 
                            className="bg-white text-black shadow-2xl transition-all duration-300 flex flex-col"
                            style={{ 
                                width: formData.ticketPaperWidth === '58mm' ? '200px' : '300px', 
                                minHeight: '400px',
                                padding: '10px',
                                fontFamily: "'Courier New', monospace",
                                fontSize: '11px'
                            }}
                        >
                            {/* Thermal Header */}
                            <div className="text-center mb-4 pb-2 border-b border-dashed border-black">
                                {formData.receiptLogo ? (
                                    <img src={formData.receiptLogo} className="max-w-[60%] h-auto mx-auto mb-2 block" alt="Logo Ticket" />
                                ) : (
                                    <div className="text-xs font-bold mb-1">[LOGO]</div>
                                )}
                                {formData.receiptHeader && <div className="font-bold text-[10px] mb-1 whitespace-pre-wrap">{formData.receiptHeader}</div>}
                                <div className="font-bold text-sm uppercase">{formData.name}</div>
                                <div className="text-[10px]">{formData.address}</div>
                                <div className="text-[10px]">{formData.phone}</div>
                            </div>

                            {/* Dummy Content */}
                            <div className="flex justify-between mb-1">
                                <span>Ticket #12345</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="border-b border-dashed border-black my-2"></div>
                            
                            <div className="space-y-1 mb-4">
                                <div className="flex justify-between">
                                    <span>2 x Producto A</span>
                                    <span>$50.00</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>1 x Producto B</span>
                                    <span>$120.00</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-black pt-2 mt-auto">
                                <div className="flex justify-between font-bold text-sm">
                                    <span>TOTAL</span>
                                    <span>$170.00</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-2 border-t border-dashed border-black text-center text-[10px] whitespace-pre-wrap">
                                {formData.receiptFooter}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- BLUETOOTH PRINTER TAB --- */}
            {activeTab === 'BLUETOOTH' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Connection Panel */}
                        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Bluetooth className="w-5 h-5"/></div>
                                Vincular Impresora Portátil
                            </h3>
                            <p className="text-sm text-slate-500 mb-6">Conecta tu impresora térmica directamente desde la app sin instalar drivers.</p>

                            <div className="space-y-6">
                                {btError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 font-medium flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        {btError}
                                    </div>
                                )}

                                {!btDevice ? (
                                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                            <Printer className="w-8 h-8" />
                                        </div>
                                        <p className="font-bold text-slate-600 dark:text-slate-300 mb-4">No hay impresora conectada</p>
                                        <button 
                                            onClick={handleBtScan}
                                            disabled={isScanningBt}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                                        >
                                            {isScanningBt ? <Loader2 className="w-5 h-5 animate-spin"/> : <Search className="w-5 h-5"/>}
                                            {isScanningBt ? 'Buscando...' : 'Buscar Dispositivo'}
                                        </button>
                                        <p className="text-[10px] text-slate-400 mt-4 text-center max-w-xs">
                                            Asegúrate de que la impresora esté encendida y que el Bluetooth de tu dispositivo esté activo.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 border-2 border-emerald-500/30 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10">
                                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400 animate-pulse">
                                            <CheckCircle className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">{btDevice.name || 'Impresora Genérica'}</h3>
                                        <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">Conectado</p>
                                        
                                        <div className="grid grid-cols-2 gap-3 w-full">
                                            <button 
                                                onClick={printBtTest}
                                                disabled={!btCharacteristic}
                                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                <Printer className="w-4 h-4" /> Prueba
                                            </button>
                                            <button 
                                                onClick={handleBtDisconnect}
                                                className="flex-1 py-3 bg-white border border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <Power className="w-4 h-4" /> Desconectar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Instructions Panel */}
                        <div className="bg-indigo-900 text-white p-6 md:p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Bluetooth className="w-40 h-40" />
                            </div>
                            
                            <div className="relative z-10">
                                <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div> Guía Rápida
                                </h4>
                                <ul className="space-y-4 text-sm text-indigo-100">
                                    <li className="flex gap-3">
                                        <span className="font-bold bg-indigo-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">1</span>
                                        <span>Enciende tu impresora térmica portátil.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="font-bold bg-indigo-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">2</span>
                                        <span>Activa el Bluetooth y la Ubicación (GPS) en tu celular o computadora.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="font-bold bg-indigo-800 w-6 h-6 flex items-center justify-center rounded-full text-xs">3</span>
                                        <span>Presiona "Buscar Dispositivo" y selecciona tu impresora en la lista.</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-8 p-4 bg-white/10 rounded-xl border border-white/10 backdrop-blur-sm relative z-10">
                                <p className="text-xs font-bold text-indigo-200 uppercase mb-1">Nota de Compatibilidad</p>
                                <p className="text-xs text-white leading-relaxed">
                                    Funciona con la mayoría de impresoras térmicas genéricas que soporten protocolo <strong>Bluetooth LE (Low Energy)</strong>. Si tu impresora es muy antigua (Classic Bluetooth), es posible que no aparezca en la lista web.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DATA & SYNC SETTINGS --- */}
            {activeTab === 'DATA' && (
                <div className="grid grid-cols-1 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600"><Server className="w-5 h-5"/></div>
                                    Conexión a la Nube
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">Vincula tu sistema con Google Sheets para respaldo en tiempo real.</p>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 border ${isCloudConfigured ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'}`}>
                                {isCloudConfigured ? <CheckCircle className="w-4 h-4"/> : <CloudOff className="w-4 h-4"/>}
                                {isCloudConfigured ? 'CONECTADO A LA NUBE' : 'DESCONECTADO (OFFLINE)'}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">URL del Script (Google Apps Script)</label>
                                <div className="relative">
                                    <textarea 
                                        rows={2}
                                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none" 
                                        placeholder="https://script.google.com/macros/s/..."
                                        value={formData.googleWebAppUrl || ''} 
                                        onChange={e => setFormData({ ...formData, googleWebAppUrl: e.target.value })} 
                                    />
                                    <div className="absolute right-3 bottom-3">
                                        <button 
                                            onClick={handleTestConnection}
                                            disabled={testingConnection || !formData.googleWebAppUrl}
                                            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                                        >
                                            {testingConnection ? <Loader2 className="w-3 h-3 animate-spin"/> : <Server className="w-3 h-3"/>}
                                            {testingConnection ? 'Probando...' : 'Probar Conexión'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <InputField label="Clave Secreta (API Secret)" value={formData.cloudSecret || ''} onChange={(e: any) => setFormData({ ...formData, cloudSecret: e.target.value })} type="password" placeholder="Opcional: Solo si configuraste seguridad" />

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                <button 
                                    onClick={() => setFormData({ ...formData, enableCloudSync: !formData.enableCloudSync })}
                                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${formData.enableCloudSync ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                >
                                    {formData.enableCloudSync ? 'Desactivar Sincronización' : 'Activar Sincronización'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-red-100 dark:border-red-900/30">
                        <h3 className="font-bold text-lg text-red-700 dark:text-red-400 flex items-center gap-3 mb-2">
                            <AlertTriangle className="w-5 h-5"/> Zona de Peligro
                        </h3>
                        <p className="text-sm text-slate-500 mb-6">Acciones destructivas. Úsalas solo si tienes problemas graves de datos.</p>
                        
                        <div className="flex flex-col md:flex-row gap-4">
                            <button onClick={hardReset} className="flex-1 px-6 py-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 rounded-2xl font-bold border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-3 transition-colors group">
                                <div className="p-2 bg-white dark:bg-slate-900 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                    <Trash2 className="w-4 h-4" />
                                </div>
                                <span>Restablecer y Bajar de Nube</span>
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
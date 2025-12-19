
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Save, Upload, Store, FileText, Palette, Sun, Moon, CheckCircle, Database, Download, AlertTriangle, PieChart, Bell, Volume2, Printer, Trash2, Hash, FileInput, Info, CreditCard, Percent, Cloud, CloudOff, RefreshCw, LayoutTemplate, Eye, Calendar, Phone, DollarSign, ToggleLeft, ToggleRight, Check, Lock, RotateCw, ShieldCheck, Loader2 } from 'lucide-react';
import { processLogoImage } from '../utils/imageHelper';

export const Settings: React.FC = () => {
  const { settings, updateSettings, products, categories, transactions, cashMovements, customers, suppliers, users, importData, requestNotificationPermission, notify, pullFromCloud, pushToCloud, isSyncing, hardReset } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'RECEIPT' | 'PRODUCTION' | 'THEME' | 'DATA' | 'BUDGET' | 'NOTIFICATIONS' | 'SEQUENCES'>('GENERAL');
  const [formData, setFormData] = useState(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptLogoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Check initial permission status and auto-enable if granted
  const checkPermission = () => {
    if ('Notification' in window) {
        const status = Notification.permission;
        setPermissionStatus(status);
        
        // AUTO-SYNC: If browser says YES, we force the switch to ON.
        if (status === 'granted') {
             setFormData(prev => ({...prev, notificationsEnabled: true}));
             
             // Ensure global settings are in sync without triggering infinite loops
             if (!settings.notificationsEnabled) {
                 updateSettings({ ...settings, notificationsEnabled: true });
             }
        }
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsSaved(false);
  };

  const handleBudgetChange = (field: keyof typeof formData.budgetConfig, value: number) => {
      setFormData(prev => ({
          ...prev,
          budgetConfig: {
              ...prev.budgetConfig,
              [field]: value
          }
      }));
      setIsSaved(false);
  };

  const handleSequenceChange = (field: keyof typeof formData.sequences, value: number) => {
      setFormData(prev => ({
          ...prev,
          sequences: {
              ...prev.sequences,
              [field]: value
          }
      }));
      setIsSaved(false);
  };

  const handleProductionDocChange = (field: keyof typeof formData.productionDoc, value: any) => {
      setFormData(prev => ({
          ...prev,
          productionDoc: {
              ...prev.productionDoc,
              [field]: value
          }
      }));
      setIsSaved(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'receiptLogo') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit check before processing
          alert("La imagen es demasiado grande. Intenta con una menor a 5MB.");
          return;
      }
      
      setIsProcessingImage(true);
      try {
          // Use the new helper to process: resize + white background
          const processedImage = await processLogoImage(file);
          handleInputChange(field, processedImage);
          notify("Imagen Procesada", "Se ha ajustado el tamaño y el fondo correctamente.", "success");
      } catch (error) {
          console.error("Error processing image", error);
          notify("Error de Imagen", "No se pudo procesar la imagen. Intenta con otro archivo.", "error");
      } finally {
          setIsProcessingImage(false);
          // Reset input so same file can be selected again if needed
          if (e.target) e.target.value = '';
      }
    }
  };

  const handleSave = async () => {
    // Basic validation
    const budgetSum = formData.budgetConfig.expensesPercentage + formData.budgetConfig.investmentPercentage + formData.budgetConfig.profitPercentage;
    if (Math.abs(budgetSum - 100) > 1) { 
        alert(`Los porcentajes del presupuesto deben sumar 100%. Suma actual: ${budgetSum}%`);
        return;
    }

    updateSettings(formData);
    setIsSaved(true);
    
    // Force immediate push to cloud if enabled, using the NEW form data to avoid race condition
    if (formData.enableCloudSync) {
        await pushToCloud({ settings: formData });
    }
    
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleNotificationToggle = async (checked: boolean) => {
      if (checked) {
          if (!("Notification" in window)) {
              alert("Tu navegador no soporta notificaciones.");
              return;
          }

          if (Notification.permission === 'granted') {
              handleInputChange('notificationsEnabled', true);
              updateSettings({ ...settings, notificationsEnabled: true }); // Instant save
              setPermissionStatus('granted');
              notify('Sistema Activado', 'Las notificaciones de escritorio están habilitadas.', 'success', true);
              return;
          }

          if (Notification.permission === 'denied') {
              setPermissionStatus('denied');
              handleInputChange('notificationsEnabled', false);
              return;
          }

          const granted = await requestNotificationPermission();
          setPermissionStatus(granted ? 'granted' : 'denied');
          
          if (granted) {
              handleInputChange('notificationsEnabled', true);
              updateSettings({ ...settings, notificationsEnabled: true }); // Instant save
              notify('Sistema Activado', 'Las notificaciones de escritorio están habilitadas.', 'success', true);
          } else {
              handleInputChange('notificationsEnabled', false);
          }
      } else {
          handleInputChange('notificationsEnabled', false);
          updateSettings({ ...settings, notificationsEnabled: false }); // Instant save
      }
  };

  const testNotification = () => {
      notify('Prueba de Sistema', '¡Funciona! Esta es una notificación de prueba.', 'success', true);
  };

  const handleReload = () => {
      window.location.reload();
  };

  const handleExportData = () => {
    const data = {
        settings: formData,
        products,
        categories,
        transactions,
        cashMovements,
        customers,
        suppliers,
        users,
        exportDate: new Date().toISOString()
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LuminaPOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (window.confirm("ADVERTENCIA: Esto sobrescribirá todos los datos actuales con la copia de seguridad. ¿Deseas continuar?")) {
                  importData(json);
                  alert("Datos restaurados correctamente. La página se recargará.");
                  window.location.reload();
              }
          } catch (err) {
              alert("Error al leer el archivo. Asegúrate de que es un backup válido de LuminaPOS.");
          }
      };
      reader.readAsText(file);
  };

  const currentBudgetSum = formData.budgetConfig.expensesPercentage + formData.budgetConfig.investmentPercentage + formData.budgetConfig.profitPercentage;

  const MenuItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 text-left ${activeTab === id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </button>
  );

  const ToggleSwitch = ({ checked, onChange, label, icon: Icon, disabled }: { checked: boolean, onChange: (v: boolean) => void, label: string, icon?: any, disabled?: boolean }) => (
      <div 
        onClick={() => !disabled && onChange(!checked)}
        className={`cursor-pointer group flex items-center justify-between p-4 rounded-xl border transition-all ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : checked ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}
      >
          <div className="flex items-center gap-3">
              {Icon && <div className={`p-2 rounded-lg ${checked ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}><Icon className="w-5 h-5" /></div>}
              <span className={`font-medium ${checked ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-600 dark:text-slate-300'}`}>{label}</span>
          </div>
          <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
      </div>
  );

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Configuración</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Personaliza tu negocio y la app.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaved || isSyncing || isProcessingImage}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${isSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none disabled:opacity-70'}`}
          >
            {isSyncing || isProcessingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : isSaved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {isProcessingImage ? 'Procesando img...' : isSyncing ? 'Sincronizando...' : isSaved ? '¡Guardado!' : 'Guardar Cambios'}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-2 space-y-1 sticky top-24">
              <MenuItem id="GENERAL" label="General" icon={Store} />
              <MenuItem id="SEQUENCES" label="Secuencias" icon={Hash} />
              <MenuItem id="BUDGET" label="Finanzas" icon={PieChart} />
              <MenuItem id="NOTIFICATIONS" label="Alertas" icon={Bell} />
              <MenuItem id="RECEIPT" label="Ticket" icon={Printer} />
              <MenuItem id="PRODUCTION" label="Producción" icon={FileText} />
              <MenuItem id="THEME" label="Tema" icon={Palette} />
              <MenuItem id="DATA" label="Datos" icon={Database} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            
            {activeTab === 'GENERAL' && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Store className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                  Datos del Negocio
                </h3>
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                    <div className="shrink-0 text-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo Principal</p>
                        <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors relative group">
                            {formData.logo ? (
                                <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2 bg-white" /> 
                            ) : (
                                <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400" />
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">Cambiar</div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')}/>
                        <p className="text-[10px] text-slate-400 mt-2">Se ajustará y pondrá fondo blanco automáticamente.</p>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Negocio</label><input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección</label><input type="text" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label><input type="text" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                        <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"/></div>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Impuestos y Moneda</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <input type="checkbox" id="enableTax" checked={formData.enableTax} onChange={(e) => handleInputChange('enableTax', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                            <label htmlFor="enableTax" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">Habilitar IVA/Impuestos</label>
                        </div>
                        {formData.enableTax && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tasa General (%)</label>
                                <input type="number" value={formData.taxRate} onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Símbolo Moneda</label>
                            <input type="text" value={formData.currency} onChange={(e) => handleInputChange('currency', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* ... other tabs ... */}
            {activeTab === 'RECEIPT' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Printer className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        Diseño de Ticket (Térmico)
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="flex gap-4 items-center p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <div className="shrink-0">
                                    <p className="text-xs font-bold text-slate-500 mb-1">Logo Ticket (BN)</p>
                                    <div onClick={() => receiptLogoInputRef.current?.click()} className="w-20 h-20 bg-white border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 relative group">
                                        {formData.receiptLogo ? <img src={formData.receiptLogo} alt="Receipt Logo" className="w-full h-full object-contain p-1 filter grayscale contrast-150" /> : <Upload className="w-6 h-6 text-slate-300" />}
                                        <div className="absolute inset-0 bg-black/10 hidden group-hover:flex items-center justify-center text-[10px]">Cambiar</div>
                                    </div>
                                    <input type="file" ref={receiptLogoInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'receiptLogo')} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 mb-2">Ancho de Papel</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleInputChange('ticketPaperWidth', '58mm')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${formData.ticketPaperWidth === '58mm' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>58mm</button>
                                        <button onClick={() => handleInputChange('ticketPaperWidth', '80mm')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${formData.ticketPaperWidth === '80mm' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>80mm</button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Encabezado (Mensaje Superior)</label>
                                <textarea rows={2} value={formData.receiptHeader} onChange={(e) => handleInputChange('receiptHeader', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none resize-none text-sm"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pie de Página (Despedida)</label>
                                <textarea rows={2} value={formData.receiptFooter} onChange={(e) => handleInputChange('receiptFooter', e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none resize-none text-sm"/>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-slate-100 p-6 rounded-xl flex justify-center items-start overflow-hidden">
                            <div className="bg-white shadow-md p-4 text-center font-mono text-[10px] md:text-xs leading-tight" style={{width: formData.ticketPaperWidth === '58mm' ? '180px' : '260px'}}>
                                {formData.receiptLogo && <img src={formData.receiptLogo} className="w-16 h-16 object-contain mx-auto mb-2 filter grayscale contrast-150"/>}
                                <p className="font-bold text-sm mb-1">{formData.name}</p>
                                <p>{formData.address}</p>
                                <p>{formData.phone}</p>
                                <div className="border-b border-dashed border-black my-2"></div>
                                <p className="font-bold">{formData.receiptHeader}</p>
                                <div className="border-b border-dashed border-black my-2"></div>
                                <div className="flex justify-between font-bold my-2"><span>TOTAL</span><span>$0.00</span></div>
                                <div className="border-b border-dashed border-black my-2"></div>
                                <p>{formData.receiptFooter}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rest of the component (Production, Theme, etc. remains identical) */}
            {activeTab === 'PRODUCTION' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Plantilla de Producción</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Personaliza el documento que se entrega al taller o almacén.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Settings Column */}
                        <div className="lg:col-span-1 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Título del Documento</label>
                                <input 
                                    type="text" 
                                    value={formData.productionDoc.title} 
                                    onChange={(e) => handleProductionDocChange('title', e.target.value)} 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contenido Visible</p>
                                <ToggleSwitch 
                                    checked={formData.productionDoc.showPrices} 
                                    onChange={(v) => handleProductionDocChange('showPrices', v)}
                                    label="Mostrar Precios"
                                    icon={DollarSign}
                                />
                                <ToggleSwitch 
                                    checked={formData.productionDoc.showCustomerContact} 
                                    onChange={(v) => handleProductionDocChange('showCustomerContact', v)}
                                    label="Datos de Cliente"
                                    icon={Phone}
                                />
                                <ToggleSwitch 
                                    checked={formData.productionDoc.showDates} 
                                    onChange={(v) => handleProductionDocChange('showDates', v)}
                                    label="Fechas de Entrega"
                                    icon={Calendar}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nota al Pie</label>
                                <textarea 
                                    rows={3} 
                                    value={formData.productionDoc.customFooter} 
                                    onChange={(e) => handleProductionDocChange('customFooter', e.target.value)} 
                                    placeholder="Ej. Revisar calidad..." 
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Live Preview Column */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl flex justify-center h-full items-start overflow-hidden border border-slate-200 dark:border-slate-800 relative">
                                <div className="absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-500 flex items-center gap-2 shadow-sm border border-slate-200 dark:border-slate-700">
                                    <Eye className="w-3 h-3" /> Vista Previa
                                </div>

                                {/* Mock Paper Document */}
                                <div className="bg-white w-full max-w-md shadow-lg p-8 min-h-[500px] text-slate-800 text-xs font-serif leading-relaxed scale-95 origin-top transition-all duration-300">
                                    <div className="border-b-2 border-slate-800 pb-4 mb-4 text-center">
                                        <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900">{formData.productionDoc.title || 'TITULO'}</h1>
                                        <p className="text-slate-400 mt-1">Folio: #0000</p>
                                    </div>

                                    {formData.productionDoc.showCustomerContact && (
                                        <div className="bg-slate-50 p-3 mb-4 border border-slate-100 rounded">
                                            <p className="font-bold">Cliente: Juan Pérez</p>
                                            <p className="text-slate-500">Tel: 555-1234 | contacto@email.com</p>
                                        </div>
                                    )}

                                    {formData.productionDoc.showDates && (
                                        <div className="flex justify-between mb-4 font-bold border-b border-slate-100 pb-2">
                                            <span>Fecha: {new Date().toLocaleDateString()}</span>
                                            <span>Entrega: {new Date().toLocaleDateString()}</span>
                                        </div>
                                    )}

                                    <table className="w-full mb-6 border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-300">
                                                <th className="p-2 text-left">Cant</th>
                                                <th className="p-2 text-left">Descripción</th>
                                                {formData.productionDoc.showPrices && <th className="p-2 text-right">Importe</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-slate-100">
                                                <td className="p-2 font-bold text-center">2</td>
                                                <td className="p-2">Producto de Ejemplo</td>
                                                {formData.productionDoc.showPrices && <td className="p-2 text-right">$500.00</td>}
                                            </tr>
                                            <tr className="border-b border-slate-100">
                                                <td className="p-2 font-bold text-center">5</td>
                                                <td className="p-2">Material de Insumo</td>
                                                {formData.productionDoc.showPrices && <td className="p-2 text-right">$120.00</td>}
                                            </tr>
                                        </tbody>
                                    </table>

                                    {formData.productionDoc.customFooter && (
                                        <div className="mt-auto pt-4 border-t border-slate-200 text-center italic text-slate-500">
                                            {formData.productionDoc.customFooter}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Other tabs follow same pattern, ensuring imageHelper is not needed there */}
            {activeTab === 'THEME' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Palette className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        Apariencia
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => { handleInputChange('theme', 'light'); document.documentElement.classList.remove('dark'); }}
                            className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${formData.theme === 'light' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-indigo-300 bg-white text-slate-600'}`}
                        >
                            <Sun className="w-12 h-12" />
                            <span className="font-bold text-lg">Modo Claro</span>
                        </button>
                        <button 
                            onClick={() => { handleInputChange('theme', 'dark'); document.documentElement.classList.add('dark'); }}
                            className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${formData.theme === 'dark' ? 'border-indigo-500 bg-slate-800 text-white' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 bg-slate-900 text-slate-400'}`}
                        >
                            <Moon className="w-12 h-12" />
                            <span className="font-bold text-lg">Modo Oscuro</span>
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'SEQUENCES' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Hash className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        Secuencias y Folios
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Inicio Tickets Venta</label>
                            <input type="number" value={formData.sequences.ticketStart} onChange={(e) => handleSequenceChange('ticketStart', parseInt(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xl font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500" />
                            <p className="text-xs text-slate-400 mt-2">Próximo ticket será #{formData.sequences.ticketStart + transactions.length}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Inicio Clientes</label>
                            <input type="number" value={formData.sequences.customerStart} onChange={(e) => handleSequenceChange('customerStart', parseInt(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xl font-bold text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500" />
                            <p className="text-xs text-slate-400 mt-2">Próximo ID será {formData.sequences.customerStart + customers.length}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Inicio Pedidos</label>
                            <input type="number" value={formData.sequences.orderStart} onChange={(e) => handleSequenceChange('orderStart', parseInt(e.target.value))} className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xl font-bold text-orange-600 dark:text-orange-400 outline-none focus:ring-2 focus:ring-orange-500" />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'BUDGET' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <PieChart className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        Reglas Financieras
                    </h3>
                    <p className="text-slate-500 mb-6">Define cómo se deben distribuir teóricamente tus ingresos para mantener un negocio saludable.</p>
                    
                    <div className="space-y-6 max-w-2xl">
                        {/* ... budget sliders ... */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Gastos Operativos</label>
                                <span className="font-bold">{formData.budgetConfig.expensesPercentage}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" step="5" 
                                value={formData.budgetConfig.expensesPercentage} 
                                onChange={(e) => handleBudgetChange('expensesPercentage', parseInt(e.target.value))}
                                className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <p className="text-xs text-slate-400 mt-1">Renta, luz, agua, resurtido de mercancía.</p>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Inversión / Ahorro</label>
                                <span className="font-bold">{formData.budgetConfig.investmentPercentage}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" step="5" 
                                value={formData.budgetConfig.investmentPercentage} 
                                onChange={(e) => handleBudgetChange('investmentPercentage', parseInt(e.target.value))}
                                className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                            />
                            <p className="text-xs text-slate-400 mt-1">Fondo de emergencia, expansión, nuevo equipo.</p>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-bold text-pink-600 dark:text-pink-400">Utilidad / Sueldos</label>
                                <span className="font-bold">{formData.budgetConfig.profitPercentage}%</span>
                            </div>
                            <input 
                                type="range" min="0" max="100" step="5" 
                                value={formData.budgetConfig.profitPercentage} 
                                onChange={(e) => handleBudgetChange('profitPercentage', parseInt(e.target.value))}
                                className="w-full h-2 bg-pink-100 rounded-lg appearance-none cursor-pointer accent-pink-600"
                            />
                            <p className="text-xs text-slate-400 mt-1">Sueldos de dueños, retiros de ganancias.</p>
                        </div>

                        <div className={`p-4 rounded-xl flex items-center justify-between border ${currentBudgetSum === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                            <span className="font-bold text-sm">Total Distribución: {currentBudgetSum}%</span>
                            {currentBudgetSum === 100 ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'NOTIFICATIONS' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    {/* ... existing notifications content ... */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Bell className="w-7 h-7 text-indigo-500" />
                                Centro de Notificaciones
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Controla cómo y cuándo el sistema te alerta.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Status Card */}
                        <div className={`p-6 rounded-2xl border-2 transition-all ${formData.notificationsEnabled ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-full ${formData.notificationsEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                        <Bell className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-800 dark:text-white">Alertas de Escritorio</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {permissionStatus === 'denied' ? 'Permiso bloqueado por navegador.' : formData.notificationsEnabled ? 'Notificaciones nativas activas.' : 'Sistema silenciado.'}
                                        </p>
                                    </div>
                                </div>
                                <div onClick={() => handleNotificationToggle(!formData.notificationsEnabled)} className={`cursor-pointer relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${formData.notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'} ${permissionStatus === 'denied' ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${formData.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                                </div>
                            </div>
                            
                            {formData.notificationsEnabled && (
                                <button onClick={testNotification} className="w-full py-2.5 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                    <Volume2 className="w-4 h-4" /> Probar Sonido / Alerta
                                </button>
                            )}

                            {permissionStatus === 'denied' && (
                                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Permiso Bloqueado</h4>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-2">
                                            Para activar las alertas, debes permitir las notificaciones manualmente:
                                        </p>
                                        <ol className="list-decimal list-inside text-xs text-red-700 dark:text-red-300 space-y-1 mb-3">
                                            <li>Clic en el icono de <strong>candado 🔒</strong> en la barra de dirección.</li>
                                            <li>Busca "Notificaciones" o "Permisos".</li>
                                            <li>Cambia a <strong>"Permitir"</strong>.</li>
                                            <li>Recarga la página.</li>
                                        </ol>
                                        <button onClick={handleReload} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline cursor-pointer"><RotateCw className="w-3 h-3" /> Verificar (Recargar)</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Configuration Details */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider mb-2">Eventos Monitoreados</h4>
                            
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl opacity-70">
                                <div className={`p-2 rounded-lg ${formData.notificationsEnabled ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-400'}`}>
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">Stock Crítico (Bajo Inventario)</span>
                                {formData.notificationsEnabled && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl opacity-70">
                                <div className={`p-2 rounded-lg ${formData.notificationsEnabled ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400'}`}>
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">Pedidos Completados</span>
                                {formData.notificationsEnabled && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl opacity-70">
                                <div className={`p-2 rounded-lg ${formData.notificationsEnabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-400'}`}>
                                    <Info className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">Avisos del Sistema</span>
                                {formData.notificationsEnabled && <Check className="w-4 h-4 text-emerald-500 ml-auto" />}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'DATA' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <Database className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                        Gestión de Datos y Nube
                    </h3>

                    <div className="space-y-6">
                        {/* Cloud Sync Section */}
                        <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400">
                                    <Cloud className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-slate-800 dark:text-white">Sincronización con Google Sheets</h4>
                                        <button 
                                            onClick={() => handleInputChange('enableCloudSync', !formData.enableCloudSync)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.enableCloudSync ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enableCloudSync ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">Guarda automáticamente tus ventas en una hoja de cálculo externa para verlas desde cualquier lugar.</p>
                                </div>
                            </div>
                            
                            {formData.enableCloudSync && (
                                <div className="space-y-4 animate-[fadeIn_0.2s]">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL de Google Apps Script (Web App)</label>
                                        <input 
                                            type="text" 
                                            placeholder="https://script.google.com/macros/s/.../exec"
                                            value={formData.googleWebAppUrl || ''}
                                            onChange={(e) => handleInputChange('googleWebAppUrl', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    
                                    {/* NEW: API Secret Input */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> Contraseña de Conexión (Opcional)
                                        </label>
                                        <input 
                                            type="password" 
                                            placeholder="Escribe la clave secreta configurada en tu Script..."
                                            value={formData.cloudSecret || ''}
                                            onChange={(e) => handleInputChange('cloudSecret', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Protege tu base de datos contra accesos no autorizados. Debes configurar la misma clave en el código de tu Google Apps Script.
                                        </p>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-3">
                                        <button 
                                            onClick={() => pullFromCloud()}
                                            disabled={isSyncing || !formData.googleWebAppUrl}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                            {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                                        </button>
                                        
                                        <button 
                                            onClick={hardReset}
                                            disabled={isSyncing || !formData.googleWebAppUrl}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-all shadow-md disabled:opacity-50"
                                            title="Usa esto si los datos no aparecen en este dispositivo."
                                        >
                                            <Database className="w-4 h-4" /> Resetear y Descargar de Nube
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white">Copia de Seguridad (Local)</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Descarga todos tus datos en un archivo JSON.</p>
                            </div>
                            <div className="flex gap-2">
                                <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportData} />
                                <button onClick={() => importInputRef.current?.click()} className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-6 py-3 rounded-xl font-bold shadow-sm transition-all">
                                    <Upload className="w-5 h-5" /> Restaurar
                                </button>
                                <button onClick={handleExportData} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
                                    <Download className="w-5 h-5" /> Exportar Backup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

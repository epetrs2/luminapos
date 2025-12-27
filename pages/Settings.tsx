
            {/* --- NOTIFICATIONS SETTINGS --- */}
            {activeTab === 'NOTIFICATIONS' && (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-3 mb-6">
                            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600"><Bell className="w-5 h-5"/></div>
                            Preferencias de Alertas y Sonido
                        </h3>
                        
                        <div className="space-y-8 max-w-2xl">
                            {/* Master Switches */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 gap-4">
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-1 text-sm md:text-base">Activar Efectos de Sonido</h4>
                                    <p className="text-xs text-slate-500 leading-snug">Reproducir sonidos al completar ventas, errores o advertencias.</p>
                                </div>
                                <button 
                                    onClick={() => setFormData({...formData, soundConfig: {...formData.soundConfig, enabled: !formData.soundConfig.enabled}})}
                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formData.soundConfig?.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.soundConfig?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Volume Control */}

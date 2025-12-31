
                        {activeTab === 'LIST' && (
                            <>
                                <button
                                    onClick={() => setIsScannerOpen(true)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                                >
                                    <Scan className="w-4 h-4" /> Escanear
                                </button>
                                <button
                                    onClick={handleOpenPrintModal}
                                    className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                                >
                                    <ListChecks className="w-4 h-4" /> Generar Orden
                                </button>
                            </>
                        )}

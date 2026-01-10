
                 <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                         {/* BASIC INCOME */}
                         <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'SALES')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'SALES' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Ingreso Venta</button>
                         {/* BASIC EXPENSE */}
                         <button type="button" onClick={() => handleTypeChange('EXPENSE', 'OPERATIONAL')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'EXPENSE' ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Gasto Op.</button>
                         {/* OWNER EQUITY (NEW) */}
                         <button type="button" onClick={() => handleTypeChange('DEPOSIT', 'EQUITY')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'DEPOSIT' && category === 'EQUITY' ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Aporte Dueño</button>
                         {/* PROFIT WITHDRAWAL */}
                         <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'PROFIT')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'PROFIT' ? 'bg-pink-100 border-pink-300 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Retiro Ganancia</button>
                         {/* INVESTMENT WITHDRAWAL (NEW) */}
                         <button type="button" onClick={() => { handleTypeChange('WITHDRAWAL', 'OTHER'); setSubCategory('Inversión/Ahorro'); }} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'OTHER' && subCategory === 'Inversión/Ahorro' ? 'bg-cyan-100 border-cyan-300 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Retiro Inversión</button>
                         {/* REEMBOLSO */}
                         <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'LOAN')} className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'LOAN' ? 'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Reembolso Dueño</button>
                         {/* THIRD PARTY PAYOUT */}
                         <button type="button" onClick={() => handleTypeChange('WITHDRAWAL', 'THIRD_PARTY')} className={`col-span-2 py-2 rounded-lg text-xs font-bold border transition-all ${type === 'WITHDRAWAL' && category === 'THIRD_PARTY' ? 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>Liq. Tercero</button>
                    </div>
                    
                    {/* CHANNEL SELECTOR */}

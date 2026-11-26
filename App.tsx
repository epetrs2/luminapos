
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { CashRegister } from './pages/CashRegister';
import { Reports } from './pages/Reports';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { SalesHistory } from './pages/SalesHistory';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders'; 
import { NotificationSystem } from './components/NotificationSystem';
import { StoreProvider, useStore } from './components/StoreContext';
import { AppView } from './types';
import { Store, Zap, Lock, LogOut, ArrowRight, EyeOff, KeyRound, Check, X, Eye } from 'lucide-react';
import { validatePasswordPolicy } from './utils/security';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center text-white animate-[fadeOut_0.5s_ease-in_forwards_2.5s]">
            <div className="relative animate-[zoomIn_0.8s_ease-out_forwards]">
                <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/20">
                    <Store className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 bg-indigo-500 rounded-full p-2 animate-[bounce_2s_infinite]">
                    <Zap className="w-4 h-4 text-white" />
                </div>
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2 animate-[slideUp_0.8s_ease-out_forwards_0.2s] opacity-0">LuminaPOS</h1>
            <p className="text-slate-400 text-sm animate-[slideUp_0.8s_ease-out_forwards_0.4s] opacity-0">Sistema de Venta Inteligente</p>
        </div>
    );
};

// Lock Screen Overlay
const LockScreen: React.FC = () => {
    const { currentUser, unlockApp, logout, settings } = useStore();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const success = await unlockApp(password);
        if (!success) {
            setError('Contraseña incorrecta');
            setPassword('');
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-white animate-[fadeIn_0.3s]">
            <div className="w-full max-w-sm px-6">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 border border-white/20 shadow-2xl">
                        <Lock className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{settings.name || 'LuminaPOS'}</h2>
                    <p className="text-slate-400 text-sm mt-1">Sesión bloqueada por seguridad</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl">
                    <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">
                            {currentUser?.username.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-sm">{currentUser?.fullName}</p>
                            <p className="text-xs text-slate-400">@{currentUser?.username}</p>
                        </div>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1">Contraseña</label>
                            <input 
                                type="password" 
                                autoFocus
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Ingresa tu contraseña..."
                            />
                        </div>
                        
                        {error && <p className="text-red-400 text-xs font-bold text-center animate-pulse">{error}</p>}

                        <button 
                            type="submit" 
                            disabled={!password || isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-900/50 transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Verificando...' : <>Desbloquear <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>
                </div>

                <button 
                    onClick={logout}
                    className="w-full mt-6 text-slate-500 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors py-2"
                >
                    <LogOut className="w-4 h-4" /> Cambiar de Usuario
                </button>
            </div>
        </div>
    );
};

// Password Recovery Overlay (Triggered automatically when opening a Supabase Recovery Link)
const PasswordRecoveryModal: React.FC = () => {
    const { updateSupabasePassword, clearPasswordRecoveryMode, notify } = useStore();
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const { isValid, errors } = validatePasswordPolicy(newPass);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) {
            setError('La contraseña no cumple con los requisitos mínimos.');
            return;
        }
        if (newPass !== confirmPass) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        setSaving(true);
        setError('');
        const res = await updateSupabasePassword(newPass);
        setSaving(false);
        if (res.ok) {
            notify('Contraseña Actualizada', 'Ya puedes usar tu nueva contraseña en todos tus dispositivos.', 'success');
        } else {
            setError(res.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.25s]">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                            <KeyRound className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Nueva Contraseña</h2>
                            <p className="text-xs text-slate-500">Enlace de recuperación verificado</p>
                        </div>
                    </div>
                    <button onClick={clearPasswordRecoveryMode} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                {error && <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-300">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Mínimo 8 caracteres"
                                autoFocus
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Contraseña</label>
                        <input
                            type={showPass ? 'text' : 'password'}
                            value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 ${confirmPass && newPass !== confirmPass ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'}`}
                            placeholder="Repite tu contraseña"
                        />
                    </div>
                    {newPass && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                            <div className={`flex items-center gap-2 ${newPass.length >= 8 ? 'text-emerald-600' : 'text-slate-400'}`}>{newPass.length >= 8 ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Mínimo 8 caracteres</div>
                            <div className={`flex items-center gap-2 ${/[A-Z]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[A-Z]/.test(newPass) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Una mayúscula</div>
                            <div className={`flex items-center gap-2 ${/[a-z]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[a-z]/.test(newPass) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Una minúscula</div>
                            <div className={`flex items-center gap-2 ${/[0-9]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[0-9]/.test(newPass) ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} Un número</div>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={saving || errors.length > 0 || newPass !== confirmPass}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Guardar Nueva Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Wrapper component to handle auth state consumption
const MainApp: React.FC = () => {
    const { currentUser, isLoggingOut, isAppLocked, isPasswordRecoveryMode, settings, manualLockApp } = useStore();
    const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
    const [visitedViews, setVisitedViews] = useState<Set<AppView>>(() => new Set([AppView.DASHBOARD]));
    const [showSplash, setShowSplash] = useState(true);
    const [privacyMode, setPrivacyMode] = useState(false);

    useEffect(() => {
        setVisitedViews(prev => {
            if (prev.has(currentView)) return prev;
            const next = new Set(prev);
            next.add(currentView);
            return next;
        });
    }, [currentView]);

    useEffect(() => {
        // Splash screen timer
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 3000); // 2.5s fade out start + buffer
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (currentUser) {
            setCurrentView(AppView.DASHBOARD);
            setVisitedViews(new Set([AppView.DASHBOARD]));
        }
    }, [currentUser?.id]);

    // Apply Blur effect for privacy settings
    useEffect(() => {
        if (settings.securityConfig?.blurAppOnBackground) {
            const handleVisibilityChange = () => {
                // We rely on CSS blur on the main container based on a class, but React state is safer
                // This is just a placeholder if we wanted JS-based blur
            };
            document.addEventListener("visibilitychange", handleVisibilityChange);
            return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
        }
    }, [settings.securityConfig]);

    const renderKeepAliveViews = () => {
        const role = currentUser?.role || 'CASHIER';
        const isAdmin = role === 'ADMIN';
        const isManager = role === 'MANAGER' || isAdmin;

        const views: { id: AppView; allowed: boolean; element: React.ReactNode }[] = [
            { id: AppView.DASHBOARD, allowed: true, element: <Dashboard setView={setCurrentView} /> },
            { id: AppView.POS, allowed: true, element: <POS /> },
            { id: AppView.ORDERS, allowed: true, element: <Orders setView={setCurrentView} /> },
            { id: AppView.INVENTORY, allowed: isManager, element: <Inventory /> },
            { id: AppView.HISTORY, allowed: isManager, element: <SalesHistory /> },
            { id: AppView.CUSTOMERS, allowed: true, element: <Customers /> },
            { id: AppView.SUPPLIERS, allowed: isManager, element: <Suppliers /> },
            { id: AppView.CASH, allowed: true, element: <CashRegister /> },
            { id: AppView.REPORTS, allowed: isManager, element: <Reports /> },
            { id: AppView.SETTINGS, allowed: isAdmin, element: <Settings /> },
            { id: AppView.USERS, allowed: isAdmin, element: <Users /> },
        ];

        return views
            .filter(v => v.allowed && visitedViews.has(v.id))
            .map(v => (
                <div key={v.id} className={currentView === v.id ? 'block' : 'hidden'}>
                    {v.element}
                </div>
            ));
    };

    if (showSplash) {
        return <SplashScreen />;
    }

    if (!currentUser) {
        return (
            <div className="animate-[fadeIn_0.5s_ease-out]">
                {isPasswordRecoveryMode && <PasswordRecoveryModal />}
                <Login />
            </div>
        );
    }

    return (
        <div className={`relative min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 ${isLoggingOut ? 'animate-[fadeOut_0.3s_ease-in_forwards]' : 'animate-[fadeIn_0.5s_ease-out]'}`}>
            {isPasswordRecoveryMode && <PasswordRecoveryModal />}
            {isAppLocked && <LockScreen />}
            
            {/* Quick Lock & Privacy Controls (Fixed Bottom Left for Accessibility) */}
            <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
                <button 
                    onClick={() => setPrivacyMode(!privacyMode)}
                    className={`p-3 rounded-full shadow-lg border transition-all ${privacyMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    title="Modo Privacidad (Ocultar Pantalla)"
                >
                    {privacyMode ? <EyeOff className="w-5 h-5" /> : <Store className="w-5 h-5" />}
                </button>
                <button 
                    onClick={manualLockApp}
                    className="p-3 rounded-full bg-slate-800 text-white shadow-lg border border-slate-700 hover:bg-slate-700 transition-all active:scale-95"
                    title="Bloquear Pantalla"
                >
                    <Lock className="w-5 h-5" />
                </button>
            </div>

            {/* Privacy Curtain Overlay */}
            {privacyMode && (
                <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white" onClick={() => setPrivacyMode(false)}>
                    <EyeOff className="w-16 h-16 mb-4 text-slate-500" />
                    <h2 className="text-2xl font-bold">Modo Privacidad</h2>
                    <p className="text-slate-400 mt-2 text-sm">Toca cualquier parte para volver</p>
                </div>
            )}

            <Sidebar currentView={currentView} setView={setCurrentView} />
            <main className={`min-h-screen transition-all duration-300 ${privacyMode ? 'filter blur-sm brightness-50' : ''}`}>
                {renderKeepAliveViews()}
            </main>
            <NotificationSystem />
        </div>
    );
};

function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}

export default App;

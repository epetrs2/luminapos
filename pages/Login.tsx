
import React, { useState, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Store, User, Lock, AlertCircle, Loader2, ShieldCheck, ArrowLeft, Smartphone, RefreshCw, Settings, Save, Link as LinkIcon, Check, X, CloudCog, Ticket, UserPlus, HelpCircle, KeyRound } from 'lucide-react';
import { validatePasswordPolicy, verifyPassword } from '../utils/security';
import { generate2FASecret, generateQRCode, verify2FAToken } from '../utils/twoFactor';

const SECURITY_QUESTIONS = [
    "¿Cuál es el nombre de tu primera mascota?",
    "¿Cuál es el apellido de soltera de tu madre?",
    "¿En qué ciudad naciste?",
    "¿Cuál fue el modelo de tu primer auto?",
    "¿Cuál es tu comida favorita?",
    "¿Cómo se llamaba tu escuela primaria?"
];

export const Login: React.FC = () => {
  const { login, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo, settings, updateSettings, pullFromCloud, isSyncing, users, registerWithInvite } = useStore();
  const [view, setView] = useState<'LOGIN' | 'RECOVER_INIT' | 'RECOVER_METHOD' | 'RECOVER_RESET' | 'CONNECTION' | 'REGISTER'>('LOGIN');
  const [step, setStep] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  
  // Recovery State
  const [recUser, setRecUser] = useState('');
  const [recMethod, setRecMethod] = useState<'CODE' | 'SECURITY_QUESTION' | '2FA'>('SECURITY_QUESTION');
  const [recPayload, setRecPayload] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);

  // Registration State
  const [regCode, setRegCode] = useState('');
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  
  // New Registration Fields (Security & 2FA)
  const [regSecurityQuestion, setRegSecurityQuestion] = useState('');
  const [regSecurityAnswer, setRegSecurityAnswer] = useState('');
  const [regIs2FAEnabled, setRegIs2FAEnabled] = useState(false);
  const [reg2FASecret, setReg2FASecret] = useState('');
  const [reg2FAUrl, setReg2FAUrl] = useState(''); // QR Code URL
  const [reg2FACode, setReg2FACode] = useState(''); // Verification Input
  const [show2FASetup, setShow2FASetup] = useState(false);

  // Settings State
  const [tempUrl, setTempUrl] = useState('');
  const [tempSecret, setTempSecret] = useState('');
  
  // Validation State
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Initial Sync State
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

  // AUTO-SYNC ON MOUNT
  // This ensures the device has the latest data (including 2FA settings) BEFORE the user attempts to login.
  useEffect(() => {
      const initSystem = async () => {
          // Only auto-sync if URL is configured and enabled
          if (settings.googleWebAppUrl && settings.enableCloudSync) {
              setIsInitialSyncing(true);
              try {
                  console.log("Iniciando sincronización automática...");
                  await pullFromCloud();
                  // Short delay to ensure state updates propagate
                  await new Promise(resolve => setTimeout(resolve, 500));
              } catch (e) {
                  console.error("Error en auto-sync:", e);
                  // We don't block login on error (offline mode), but we log it
                  setError('Modo Offline: No se pudo conectar con la nube.');
              } finally {
                  setIsInitialSyncing(false);
              }
          }
      };
      
      initSystem();
  }, []); // Run once on mount

  useEffect(() => {
      if (view === 'RECOVER_RESET') {
          const { errors } = validatePasswordPolicy(newPass);
          setPasswordErrors(errors);
      }
      if (view === 'REGISTER') {
          const { errors } = validatePasswordPolicy(regPass);
          setPasswordErrors(errors);
      }
  }, [newPass, regPass, view]);

  useEffect(() => {
      if (view === 'CONNECTION') {
          setTempUrl(settings.googleWebAppUrl || '');
          setTempSecret(settings.cloudSecret || '');
      }
  }, [view, settings.googleWebAppUrl, settings.cloudSecret]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Login uses the 'users' state which should now be fresh from the useEffect pull
      const status = await login(username, password);
      
      if (status === 'SUCCESS') {
          // Entró directo
      } else if (status === '2FA_REQUIRED') {
          setStep('2FA');
          setLoading(false);
          setError('');
      } else if (status === 'LOCKED') {
          setError('Cuenta bloqueada temporalmente');
          setLoading(false);
      } else {
          setError('Credenciales inválidas');
          setLoading(false);
      }
    } catch (err) {
      setError('Error al iniciar sesión');
      setLoading(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!twoFactorCode || twoFactorCode.length !== 6) {
          setError('Ingresa el código de 6 dígitos');
          return;
      }

      setLoading(true);
      setError('');

      const status = await login(username, password, twoFactorCode);
      
      if (status === 'SUCCESS') {
          // Logged in
      } else if (status === 'INVALID_2FA') {
          setError('Código 2FA incorrecto');
          setLoading(false);
      } else {
          setError('Error de autenticación');
          setLoading(false);
      }
  };

  const handlePullCloudData = async () => {
      setError('');
      setSuccessMsg('');
      if (!settings.googleWebAppUrl) {
          setError('Configura la URL de conexión primero (icono engranaje).');
          return;
      }
      try {
          setIsInitialSyncing(true);
          await pullFromCloud(undefined, undefined, false, true); // FORCE SYNC
          setSuccessMsg('Datos sincronizados correctamente.');
      } catch (e: any) {
          setError(e.message || 'Error al sincronizar. Verifica tu conexión.');
      } finally {
          setIsInitialSyncing(false);
      }
  };

  const handleSaveConnection = async () => {
      // 1. Update Context/Storage
      updateSettings({ ...settings, googleWebAppUrl: tempUrl, cloudSecret: tempSecret, enableCloudSync: true });
      
      // 2. Immediate Pull using the values directly, IGNORING stale local data (force=true)
      setSuccessMsg('Guardando configuración...');
      setError('');
      
      try {
          setIsInitialSyncing(true);
          await pullFromCloud(tempUrl, tempSecret, false, true); // Force overwrite
          setSuccessMsg('¡Conectado! Datos descargados de la nube.');
          setView('LOGIN');
      } catch (e: any) {
          setError(e.message || 'Error al descargar datos.');
      } finally {
          setIsInitialSyncing(false);
      }
  };

  const initRecovery = () => {
    if (!recUser) {
        setError('Ingresa tu nombre de usuario');
        return;
    }
    const info = getUserPublicInfo(recUser);
    if (!info) {
        setError('Usuario no encontrado');
        return;
    }
    setUserInfo(info);
    setRecMethod(info.securityQuestion ? 'SECURITY_QUESTION' : 'CODE');
    setRecPayload('');
    setView('RECOVER_METHOD');
    setError('');
  };

  const verifyRecoveryCode = async () => {
      const user = users.find(u => u.username.toLowerCase() === recUser.toLowerCase());
      if (!user) {
          setError('Error: Usuario no encontrado');
          return;
      }

      let isValid = false;
      if (recMethod === 'SECURITY_QUESTION') {
          if (user.securityAnswerHash && user.salt) {
             isValid = await verifyPassword(recPayload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
          }
      } else {
          isValid = user.recoveryCode === recPayload.trim();
      }

      if (isValid) {
          setView('RECOVER_RESET');
          setError('');
      } else {
          setError(recMethod === 'SECURITY_QUESTION' ? 'Respuesta incorrecta' : 'Código inválido');
      }
  };

  const finalizeRecovery = async () => {
      if (newPass !== confirmNewPass) {
          setError('Las contraseñas no coinciden');
          return;
      }
      if (passwordErrors.length > 0) {
          setError('La contraseña es demasiado débil');
          return;
      }
      
      setLoading(true);
      const result = await recoverAccount(recUser, recMethod, recPayload, newPass);
      setLoading(false);

      if (result === 'SUCCESS') {
          setSuccessMsg('Contraseña restablecida. Inicia sesión.');
          setView('LOGIN');
          setStep('CREDENTIALS');
          setRecUser('');
          setRecPayload('');
          setNewPass('');
          setConfirmNewPass('');
      } else {
          setError('No se pudo actualizar la contraseña');
      }
  };

  const handleStart2FASetup = async () => {
      const secret = generate2FASecret();
      const url = await generateQRCode(secret, regUser || 'Nuevo Usuario', settings.name);
      setReg2FASecret(secret);
      setReg2FAUrl(url);
      setShow2FASetup(true);
      setReg2FACode('');
  };

  const handleConfirm2FA = () => {
      if (verify2FAToken(reg2FACode, reg2FASecret)) {
          setRegIs2FAEnabled(true);
          setShow2FASetup(false);
          setSuccessMsg("¡2FA Activado correctamente!");
          setTimeout(() => setSuccessMsg(''), 3000);
      } else {
          setError("Código incorrecto");
          setTimeout(() => setError(''), 3000);
      }
  };

  const handleRegistration = async () => {
      if (!regCode || !regName || !regUser || !regPass) {
          setError('Completa todos los campos obligatorios');
          return;
      }
      if (regPass !== regConfirmPass) {
          setError('Las contraseñas no coinciden');
          return;
      }
      if (passwordErrors.length > 0) {
          setError('Contraseña insegura');
          return;
      }
      if (!regSecurityQuestion || !regSecurityAnswer) {
          setError('Configura tu pregunta de seguridad');
          return;
      }

      setLoading(true);
      const result = await registerWithInvite(regCode, {
          username: regUser,
          password: regPass,
          fullName: regName,
          securityQuestion: regSecurityQuestion,
          securityAnswer: regSecurityAnswer,
          isTwoFactorEnabled: regIs2FAEnabled,
          twoFactorSecret: regIs2FAEnabled ? reg2FASecret : undefined
      });
      setLoading(false);

      if (result === 'SUCCESS') {
          setSuccessMsg('Usuario creado exitosamente. Inicia sesión.');
          setView('LOGIN');
          setRegCode('');
          setRegName('');
          setRegUser('');
          setRegPass('');
          setRegSecurityQuestion('');
          setRegSecurityAnswer('');
          setRegIs2FAEnabled(false);
          setReg2FASecret('');
      } else if (result === 'INVALID_CODE') {
          setError('Código de invitación inválido o ya usado.');
      } else if (result === 'USERNAME_EXISTS') {
          setError('El nombre de usuario ya está en uso.');
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      
      {/* INITIAL SYNC OVERLAY */}
      {isInitialSyncing && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-[fadeIn_0.3s]">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 relative">
                  <CloudCog className="w-8 h-8 animate-pulse" />
                  <div className="absolute inset-0 border-4 border-t-indigo-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <h2 className="text-xl font-bold mb-2">Sincronizando Base de Datos</h2>
              <p className="text-slate-300 text-sm">Descargando últimos usuarios y ventas...</p>
          </div>
      )}

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.5s_ease-out]">
        
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/20 blur-3xl rounded-full scale-150 translate-y-10"></div>
          
          <div className="relative z-10">
            <div className="absolute top-0 right-0">
                <button onClick={() => setView('CONNECTION')} className="text-slate-500 hover:text-white transition-colors p-2" title="Configurar Conexión">
                    <Settings className="w-5 h-5" />
                </button>
            </div>

            <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-white/20 overflow-hidden">
                {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain p-2" alt="Logo"/> : <Store className="w-8 h-8 text-white" />}
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{settings.name || 'LuminaPOS'}</h1>
                <div className="flex items-center gap-2 mt-2">
                    <button onClick={handlePullCloudData} disabled={isSyncing || isInitialSyncing} className="bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white text-[10px] px-3 py-1.5 rounded-full uppercase font-bold tracking-widest flex items-center gap-2 transition-all border border-white/10">
                        {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
                    </button>
                </div>
            </div>
          </div>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 animate-[shake_0.4s_ease-in-out]">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}
          
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-600 dark:text-emerald-300 font-medium">{successMsg}</p>
            </div>
          )}

          {view === 'CONNECTION' && (
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">Conexión a la Nube</h2>
                  <p className="text-sm text-slate-500 text-center mb-4">Ingresa la URL de tu Google Web App para sincronizar usuarios y datos.</p>
                  
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">URL del Script (Google Apps Script)</label>
                      <div className="relative">
                          <LinkIcon className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                          <textarea 
                            value={tempUrl} 
                            onChange={(e) => setTempUrl(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono" 
                            placeholder="https://script.google.com/..."
                            rows={3}
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Contraseña de Conexión (Opcional)
                      </label>
                      <input 
                        type="password" 
                        value={tempSecret} 
                        onChange={(e) => setTempSecret(e.target.value)} 
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="Solo si configuraste API_SECRET en el script..."
                      />
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setView('LOGIN')} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200">Cancelar</button>
                      <button onClick={handleSaveConnection} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                          {isInitialSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                          {isInitialSyncing ? 'Conectando...' : 'Guardar y Sincronizar'}
                      </button>
                  </div>
              </div>
          )}

          {view === 'LOGIN' && step === 'CREDENTIALS' && (
             <form onSubmit={handleLogin} className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 text-center">Bienvenido</h2>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Usuario</label>
                    <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Usuario"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Contraseña</label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="••••••••"/>
                    </div>
                </div>
                <button type="submit" disabled={loading || isInitialSyncing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                </button>
                <div className="flex flex-col gap-2 text-center mt-4">
                    <button type="button" onClick={() => setView('RECOVER_INIT')} className="text-sm text-slate-500 hover:text-indigo-600 font-medium">¿Olvidaste tu contraseña?</button>
                    <div className="flex items-center gap-3 my-2">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-xs text-slate-400 uppercase">o</span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    <button type="button" onClick={() => setView('REGISTER')} className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1">
                        <Ticket className="w-4 h-4" /> Registrarse con Código
                    </button>
                </div>
            </form>
          )}

          {view === 'LOGIN' && step === '2FA' && (
             <form onSubmit={handle2FAVerify} className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 text-center">Verificación 2FA</h2>
                <div className="text-center">
                    <Smartphone className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-500">Ingresa el código de 6 dígitos de tu app de autenticación.</p>
                </div>
                <input type="text" maxLength={6} value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="000000" autoFocus />
                <div className="flex gap-3">
                    <button type="button" onClick={() => setStep('CREDENTIALS')} className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                    <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verificar'}
                    </button>
                </div>
            </form>
          )}

          {view === 'REGISTER' && (
              <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center flex items-center justify-center gap-2">
                      <UserPlus className="w-6 h-6 text-emerald-500" /> Registro Nuevo
                  </h2>
                  <p className="text-xs text-center text-slate-500 mb-4">Ingresa el código proporcionado por el administrador.</p>
                  
                  <div>
                      <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1 ml-1">Código de Invitación</label>
                      <input type="text" value={regCode} onChange={(e) => setRegCode(e.target.value.toUpperCase())} className="w-full px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-400 font-mono font-bold text-center tracking-widest outline-none focus:ring-2 focus:ring-emerald-500 uppercase text-lg" placeholder="XXXX-XXXX"/>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Nombre Completo</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input type="text" placeholder="Ej. Juan Pérez" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/>
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Usuario</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input type="text" placeholder="Usuario para entrar" value={regUser} onChange={(e) => setRegUser(e.target.value.replace(/\s/g, ''))} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Contraseña</label>
                              <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                  <input type="password" placeholder="••••••" value={regPass} onChange={(e) => setRegPass(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/>
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 ml-1">Confirmar</label>
                              <div className="relative">
                                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                  <input type="password" placeholder="••••••" value={regConfirmPass} onChange={(e) => setRegConfirmPass(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/>
                              </div>
                          </div>
                      </div>
                  </div>

                  {regPass && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-[10px]">
                          <ul className="grid grid-cols-2 gap-1">
                              <li className={`flex items-center gap-1 ${regPass.length >= 12 ? 'text-emerald-600' : 'text-slate-400'}`}>{regPass.length >= 12 ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} 12+ caracteres</li>
                              <li className={`flex items-center gap-1 ${/[A-Z]/.test(regPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[A-Z]/.test(regPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Mayúscula</li>
                              <li className={`flex items-center gap-1 ${/[0-9]/.test(regPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[0-9]/.test(regPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Número</li>
                              <li className={`flex items-center gap-1 ${/[!@#$%^&*(),.?":{}|<>]/.test(regPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[!@#$%^&*(),.?":{}|<>]/.test(regPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Símbolo</li>
                          </ul>
                      </div>
                  )}

                  {/* SECURITY & 2FA SECTION */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-4">
                          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4" /> Seguridad Adicional
                          </h4>
                          
                          {/* Security Question */}
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Pregunta de Seguridad</label>
                              <select 
                                value={regSecurityQuestion}
                                onChange={(e) => setRegSecurityQuestion(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm appearance-none"
                              >
                                  <option value="">-- Selecciona --</option>
                                  {SECURITY_QUESTIONS.map((q, i) => <option key={i} value={q}>{q}</option>)}
                              </select>
                          </div>
                          
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Respuesta</label>
                              <input 
                                type="text"
                                placeholder="Escribe tu respuesta..."
                                value={regSecurityAnswer}
                                onChange={(e) => setRegSecurityAnswer(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                              />
                          </div>

                          {/* 2FA Toggle */}
                          <div className="pt-2 border-t border-indigo-100 dark:border-indigo-800">
                              {regIs2FAEnabled ? (
                                  <div className="flex items-center justify-between bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                                          <Check className="w-4 h-4" /> 2FA Activado
                                      </div>
                                      <button 
                                        onClick={() => {setRegIs2FAEnabled(false); setReg2FASecret(''); setReg2FAUrl('');}}
                                        className="text-xs text-red-500 hover:underline"
                                      >
                                          Desactivar
                                      </button>
                                  </div>
                              ) : (
                                  !show2FASetup ? (
                                      <button 
                                        onClick={handleStart2FASetup}
                                        className="w-full py-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700 text-indigo-700 dark:text-indigo-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                                      >
                                          <Smartphone className="w-4 h-4" /> Configurar 2FA (Opcional)
                                      </button>
                                  ) : (
                                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg text-center animate-[fadeIn_0.2s]">
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Escanea para activar</p>
                                          <div className="bg-white p-2 rounded border border-slate-200 inline-block mb-3">
                                              {reg2FAUrl ? <img src={reg2FAUrl} className="w-24 h-24" /> : <div className="w-24 h-24 bg-slate-100 animate-pulse"/>}
                                          </div>
                                          <input 
                                            type="text" 
                                            maxLength={6}
                                            placeholder="Código 6 dígitos"
                                            value={reg2FACode}
                                            onChange={(e) => setReg2FACode(e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-center text-sm mb-2 outline-none"
                                          />
                                          <div className="flex gap-2">
                                              <button onClick={() => setShow2FASetup(false)} className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">Cancelar</button>
                                              <button onClick={handleConfirm2FA} disabled={reg2FACode.length !== 6} className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold disabled:opacity-50">Verificar</button>
                                          </div>
                                      </div>
                                  )
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                      <button type="button" onClick={() => setView('LOGIN')} className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                      <button onClick={handleRegistration} disabled={loading} className="flex-1 bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2">
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Cuenta'}
                      </button>
                  </div>
              </div>
          )}

          {view === 'RECOVER_INIT' && (
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">Recuperar Cuenta</h2>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Usuario</label>
                    <input type="text" value={recUser} onChange={(e) => setRecUser(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Usuario"/>
                  </div>
                  <div className="flex gap-3">
                      <button type="button" onClick={() => setView('LOGIN')} className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                      <button onClick={initRecovery} className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg">Buscar</button>
                  </div>
              </div>
          )}

          {view === 'RECOVER_METHOD' && (
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">Verificación de Seguridad</h2>
                  <div className="text-sm text-center text-slate-500 mb-4">
                      {recMethod === 'SECURITY_QUESTION' ? 'Responde tu pregunta de seguridad.' : 'Ingresa tu Clave Maestra de recuperación.'}
                  </div>

                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
                      <button 
                        onClick={() => setRecMethod('SECURITY_QUESTION')} 
                        disabled={!userInfo?.securityQuestion}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${recMethod === 'SECURITY_QUESTION' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                          Pregunta
                      </button>
                      <button 
                        onClick={() => setRecMethod('CODE')} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${recMethod === 'CODE' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                          Clave Maestra
                      </button>
                  </div>

                  {recMethod === 'SECURITY_QUESTION' ? (
                      <div>
                          <p className="font-medium text-slate-800 dark:text-white mb-2 block">{userInfo?.securityQuestion}</p>
                          <input type="text" value={recPayload} onChange={(e) => setRecPayload(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Tu respuesta..."/>
                      </div>
                  ) : (
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Clave de Recuperación</label>
                          <input type="text" value={recPayload} onChange={(e) => setRecPayload(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-wider" placeholder="XXXX-XXXX"/>
                      </div>
                  )}

                  <div className="flex gap-3">
                      <button type="button" onClick={() => setView('RECOVER_INIT')} className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
                      <button onClick={verifyRecoveryCode} className="flex-1 bg-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg">Verificar</button>
                  </div>
              </div>
          )}

          {view === 'RECOVER_RESET' && (
              <div className="space-y-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">Nueva Contraseña</h2>
                  
                  <div>
                      <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 mb-3" placeholder="Nueva contraseña"/>
                      <input type="password" value={confirmNewPass} onChange={(e) => setConfirmNewPass(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Confirmar contraseña"/>
                  </div>

                  {newPass && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                          <p className="font-bold text-slate-500 dark:text-slate-400 mb-2">Requisitos:</p>
                          <ul className="space-y-1">
                              <li className={`flex items-center gap-2 ${newPass.length >= 12 ? 'text-emerald-600' : 'text-slate-400'}`}>{newPass.length >= 12 ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} 12+ caracteres</li>
                              <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[A-Z]/.test(newPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Mayúscula</li>
                              <li className={`flex items-center gap-2 ${/[0-9]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[0-9]/.test(newPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Número</li>
                              <li className={`flex items-center gap-2 ${/[!@#$%^&*(),.?":{}|<>]/.test(newPass) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[!@#$%^&*(),.?":{}|<>]/.test(newPass) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Símbolo</li>
                          </ul>
                      </div>
                  )}

                  <button onClick={finalizeRecovery} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Restablecer'}
                  </button>
              </div>
          )}

        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 text-center border-t border-slate-100 dark:border-slate-800">
           <p className="text-xs text-slate-400">Credenciales por defecto: <strong>admin</strong> / <strong>Admin@123456</strong></p>
        </div>
      </div>
    </div>
  );
};

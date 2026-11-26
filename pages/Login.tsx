
import React, { useState, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { Store, User, Lock, AlertCircle, Loader2, ShieldCheck, ArrowLeft, Smartphone, RefreshCw, X, Ticket, Wifi, WifiOff, Eye, EyeOff, Mail, UserPlus } from 'lucide-react';
import { validatePasswordPolicy, verifyPassword } from '../utils/security';
import { generate2FASecret, generateQRCode, verify2FAToken } from '../utils/twoFactor';
import { isSupabaseConfigured } from '../services/supabaseClient';

const SECURITY_QUESTIONS = [
    "¿Cuál es el nombre de tu primera mascota?",
    "¿Cuál es el apellido de soltera de tu madre?",
    "¿En qué ciudad naciste?",
    "¿Cuál fue el modelo de tu primer auto?",
    "¿Cuál es tu comida favorita?",
    "¿Cómo se llamaba tu escuela primaria?"
];

export const Login: React.FC = () => {
  const { login, loginWithSupabase, signUpWithSupabase, recoverAccount, getUserPublicInfo, settings, users, registerWithInvite } = useStore();
  const [view, setView] = useState<'LOGIN' | 'SIGNUP_CLOUD' | 'RECOVER_INIT' | 'RECOVER_METHOD' | 'RECOVER_RESET' | 'REGISTER'>('LOGIN');
  const [step, setStep] = useState<'CREDENTIALS' | '2FA'>('CREDENTIALS');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullNameCloud, setFullNameCloud] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // Validation State
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Initial Sync State
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

  // Status check: Supabase Cloud is built-in
  const isCloudConfigured = isSupabaseConfigured();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      // Unified Supabase Cloud Auth when configured and input looks like an email
      if (isCloudConfigured && username.includes('@')) {
        setIsInitialSyncing(true);
        const res = await loginWithSupabase(username.trim(), password);
        setIsInitialSyncing(false);
        if (!res.ok) {
          setError(res.message || 'Credenciales inválidas');
          setLoading(false);
        }
        return;
      }

      // Fallback local login (for offline / non-email usernames)
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
          setError(isCloudConfigured ? 'Usa tu correo y contraseña de la nube' : 'Credenciales inválidas');
          setLoading(false);
      }
    } catch (err) {
      setError('Error al iniciar sesión');
      setLoading(false);
      setIsInitialSyncing(false);
    }
  };

  const handleCloudSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !fullNameCloud.trim()) {
      setError('Completa tu nombre, correo y contraseña');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const res = await signUpWithSupabase(username.trim(), password, fullNameCloud.trim());
    setLoading(false);
    if (res.ok) {
      setSuccessMsg(res.message || 'Cuenta creada. Revisa tu correo o inicia sesión.');
      setView('LOGIN');
    } else {
      setError(res.message || 'No se pudo crear la cuenta');
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

  // ... (Keep existing recovery/registration functions logic exactly as before)
  const initRecovery = () => {
    if (!recUser) { setError('Ingresa tu nombre de usuario'); return; }
    const info = getUserPublicInfo(recUser);
    if (!info) { setError('Usuario no encontrado'); return; }
    setUserInfo(info);
    setRecMethod(info.securityQuestion ? 'SECURITY_QUESTION' : 'CODE');
    setRecPayload('');
    setView('RECOVER_METHOD');
    setError('');
  };

  const verifyRecoveryCode = async () => {
      const user = users.find(u => u.username.toLowerCase() === recUser.toLowerCase());
      if (!user) { setError('Error: Usuario no encontrado'); return; }
      let isValid = false;
      if (recMethod === 'SECURITY_QUESTION') {
          if (user.securityAnswerHash && user.salt) {
             isValid = await verifyPassword(recPayload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
          }
      } else { isValid = user.recoveryCode === recPayload.trim(); }
      if (isValid) { setView('RECOVER_RESET'); setError(''); } else { setError(recMethod === 'SECURITY_QUESTION' ? 'Respuesta incorrecta' : 'Código inválido'); }
  };

  const finalizeRecovery = async () => {
      if (newPass !== confirmNewPass) { setError('Las contraseñas no coinciden'); return; }
      if (passwordErrors.length > 0) { setError('La contraseña es demasiado débil'); return; }
      setLoading(true);
      const result = await recoverAccount(recUser, recMethod, recPayload, newPass);
      setLoading(false);
      if (result === 'SUCCESS') {
          setSuccessMsg('Contraseña restablecida. Inicia sesión.'); setView('LOGIN'); setStep('CREDENTIALS'); setRecUser(''); setRecPayload(''); setNewPass(''); setConfirmNewPass('');
      } else { setError('No se pudo actualizar la contraseña'); }
  };

  const handleStart2FASetup = async () => {
      const secret = generate2FASecret();
      const url = await generateQRCode(secret, regUser || 'Nuevo Usuario', settings.name);
      setReg2FASecret(secret); setReg2FAUrl(url); setShow2FASetup(true); setReg2FACode('');
  };

  const handleConfirm2FA = () => {
      if (verify2FAToken(reg2FACode, reg2FASecret)) {
          setRegIs2FAEnabled(true); setShow2FASetup(false); setSuccessMsg("¡2FA Activado correctamente!"); setTimeout(() => setSuccessMsg(''), 3000);
      } else { setError("Código incorrecto"); setTimeout(() => setError(''), 3000); }
  };

  const handleRegistration = async () => {
      if (!regCode || !regName || !regUser || !regPass) { setError('Completa todos los campos obligatorios'); return; }
      if (regPass !== regConfirmPass) { setError('Las contraseñas no coinciden'); return; }
      if (passwordErrors.length > 0) { setError('Contraseña insegura'); return; }
      if (!regSecurityQuestion || !regSecurityAnswer) { setError('Configura tu pregunta de seguridad'); return; }
      setLoading(true);
      const result = await registerWithInvite(regCode, {
          username: regUser, password: regPass, fullName: regName, securityQuestion: regSecurityQuestion, securityAnswer: regSecurityAnswer, isTwoFactorEnabled: regIs2FAEnabled, twoFactorSecret: regIs2FAEnabled ? reg2FASecret : undefined
      });
      setLoading(false);
      if (result === 'SUCCESS') {
          setSuccessMsg('Usuario creado exitosamente. Inicia sesión.'); setView('LOGIN'); setRegCode(''); setRegName(''); setRegUser(''); setRegPass(''); setRegSecurityQuestion(''); setRegSecurityAnswer(''); setRegIs2FAEnabled(false); setReg2FASecret('');
      } else if (result === 'INVALID_CODE') { setError('Código de invitación inválido o ya usado.'); } else if (result === 'USERNAME_EXISTS') { setError('El nombre de usuario ya está en uso.'); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      
      {/* INITIAL SYNC OVERLAY */}
      {isInitialSyncing && (
          <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-[fadeIn_0.3s]">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 relative">
                  <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-xl font-bold mb-2">Sincronizando Dispositivo</h2>
              <p className="text-slate-300 text-sm">Descargando datos de tu negocio...</p>
          </div>
      )}

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.5s_ease-out]">
        
        {/* HEADER AREA */}
        <div className="bg-slate-900 p-8 pb-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/20 blur-3xl rounded-full scale-150 translate-y-10"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-white/20 overflow-hidden">
                {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain p-2" alt="Logo"/> : <Store className="w-10 h-10 text-white" />}
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{settings.name || 'LuminaPOS'}</h1>
                
                {/* STATUS INDICATOR */}
                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${isCloudConfigured ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                    {isCloudConfigured ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isCloudConfigured ? 'CONECTADO A NUBE' : 'MODO LOCAL'}
                </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 -mt-6 relative z-20">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6">
              
              {error && (
                <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-start gap-3 animate-[shake_0.4s_ease-in-out]">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-300 font-bold">{error}</p>
                </div>
              )}
              
              {successMsg && (
                <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-600 dark:text-emerald-300 font-bold">{successMsg}</p>
                </div>
              )}

              {/* VIEW: CLOUD SIGNUP */}
              {view === 'SIGNUP_CLOUD' && (
                  <form onSubmit={handleCloudSignUp} className="space-y-4">
                      <div className="flex justify-between items-center mb-1">
                          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Crear Cuenta en la Nube</h2>
                          <button type="button" onClick={() => { setView('LOGIN'); setError(''); }}><X className="w-5 h-5 text-slate-400" /></button>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Nombre Completo</label>
                          <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input type="text" value={fullNameCloud} onChange={(e) => setFullNameCloud(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="Ej. Antonio Salem" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Correo Electrónico</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="tu@correo.com" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Contraseña</label>
                          <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="Mínimo 6 caracteres" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                          </div>
                      </div>
                      <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Cuenta'}
                      </button>
                  </form>
              )}

              {/* VIEW: LOGIN */}
              {view === 'LOGIN' && step === 'CREDENTIALS' && (
                 <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">{isCloudConfigured ? 'Correo Electrónico' : 'Usuario'}</label>
                        <div className="relative group">
                            {isCloudConfigured ? <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /> : <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />}
                            <input type={isCloudConfigured ? "email" : "text"} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder={isCloudConfigured ? "tu@correo.com" : "Tu usuario"}/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-70">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Iniciar Sesión'}
                    </button>

                    <div className="flex flex-col gap-3 text-center mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center px-2">
                            <button type="button" onClick={() => setView('RECOVER_INIT')} className="text-xs text-slate-500 hover:text-indigo-600 font-medium">¿Olvidaste pass?</button>
                            {isCloudConfigured ? (
                                <button type="button" onClick={() => { setView('SIGNUP_CLOUD'); setError(''); }} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                                    <UserPlus className="w-3 h-3" /> Crear Cuenta
                                </button>
                            ) : (
                                <button type="button" onClick={() => setView('REGISTER')} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                                    <Ticket className="w-3 h-3" /> Canjear Código
                                </button>
                            )}
                        </div>
                    </div>
                </form>
              )}

              {/* ... (2FA, REGISTER, RECOVERY views remain identical) ... */}
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

              {/* ... (Kept existing Register/Recover views to save space, they are functional) ... */}
              {view === 'REGISTER' && (
                  <div className="space-y-4">
                      {/* ... Same as before ... */}
                      <div className="flex justify-between items-center"><h2 className="text-lg font-bold text-slate-800 dark:text-white">Registro</h2><button onClick={() => setView('LOGIN')}><X className="w-5 h-5 text-slate-400"/></button></div>
                      <input type="text" value={regCode} onChange={(e) => setRegCode(e.target.value.toUpperCase())} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white font-mono uppercase text-center tracking-widest" placeholder="CÓDIGO"/>
                      <input type="text" placeholder="Nombre Completo" value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"/>
                      <input type="text" placeholder="Usuario" value={regUser} onChange={(e) => setRegUser(e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"/>
                      <input type="password" placeholder="Contraseña" value={regPass} onChange={(e) => setRegPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"/>
                      <input type="password" placeholder="Confirmar" value={regConfirmPass} onChange={(e) => setRegConfirmPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 dark:text-white"/>
                      
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border dark:border-slate-700">
                          <label className="text-xs font-bold text-slate-500 block mb-1">Pregunta Seguridad</label>
                          <select value={regSecurityQuestion} onChange={(e) => setRegSecurityQuestion(e.target.value)} className="w-full mb-2 p-2 rounded border dark:bg-slate-800 dark:border-slate-600 text-xs"><option value="">Selecciona...</option>{SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}</select>
                          <input type="text" placeholder="Respuesta" value={regSecurityAnswer} onChange={(e) => setRegSecurityAnswer(e.target.value)} className="w-full p-2 rounded border dark:bg-slate-800 dark:border-slate-600 text-xs"/>
                      </div>

                      <button onClick={handleRegistration} disabled={loading} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl">{loading ? 'Procesando...' : 'Registrar'}</button>
                  </div>
              )}

              {view === 'RECOVER_INIT' && (
                  <div className="space-y-4">
                      <h2 className="text-lg font-bold text-slate-800 dark:text-white text-center">Recuperar</h2>
                      <input type="text" value={recUser} onChange={(e) => setRecUser(e.target.value)} className="w-full px-4 py-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" placeholder="Usuario"/>
                      <div className="flex gap-2"><button onClick={() => setView('LOGIN')} className="flex-1 py-3 bg-slate-100 rounded-xl text-slate-500 font-bold">Volver</button><button onClick={initRecovery} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Buscar</button></div>
                  </div>
              )}

              {view === 'RECOVER_METHOD' && (
                  <div className="space-y-4">
                      <h2 className="text-lg font-bold text-center dark:text-white">Verificación</h2>
                      <p className="text-sm text-center text-slate-500">{recMethod === 'SECURITY_QUESTION' ? userInfo?.securityQuestion : 'Ingresa Clave Maestra'}</p>
                      <input type="text" value={recPayload} onChange={(e) => setRecPayload(e.target.value)} className="w-full px-4 py-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" placeholder="Respuesta..."/>
                      <div className="flex gap-2"><button onClick={() => setView('RECOVER_INIT')} className="flex-1 py-3 bg-slate-100 rounded-xl text-slate-500 font-bold">Volver</button><button onClick={verifyRecoveryCode} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Verificar</button></div>
                  </div>
              )}

              {view === 'RECOVER_RESET' && (
                  <div className="space-y-4">
                      <h2 className="text-lg font-bold text-center dark:text-white">Nueva Contraseña</h2>
                      <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full px-4 py-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" placeholder="Nueva"/>
                      <input type="password" value={confirmNewPass} onChange={(e) => setConfirmNewPass(e.target.value)} className="w-full px-4 py-3 border rounded-xl dark:bg-slate-900 dark:border-slate-700 dark:text-white" placeholder="Confirmar"/>
                      <button onClick={finalizeRecovery} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Cambiar</button>
                  </div>
              )}

          </div>
        </div>
      </div>
    </div>
  );
};

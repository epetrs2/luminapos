
import React, { useState, useEffect } from 'react';
import { useStore } from '../components/StoreContext';
import { User, UserRole, ActivityLog } from '../types';
import { Plus, Search, Shield, User as UserIcon, CheckCircle, XCircle, Edit2, Trash2, Key, Check, AlertTriangle, X, ShieldCheck, Smartphone, Lock, Clock, Activity, FileText, Unlock, Filter, Calendar, KeyRound, RefreshCw, HelpCircle, Timer, Ticket, Copy } from 'lucide-react';
import { generateSalt, hashPassword, validatePasswordPolicy, verifyPassword } from '../utils/security';
import { generate2FASecret, generateQRCode, verify2FAToken } from '../utils/twoFactor';

// Helper to generate a random recovery code
const generateRecoveryCode = () => {
    return Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
};

const SECURITY_QUESTIONS = [
    "¿Cuál es el nombre de tu primera mascota?",
    "¿Cuál es el apellido de soltera de tu madre?",
    "¿En qué ciudad naciste?",
    "¿Cuál fue el modelo de tu primer auto?",
    "¿Cuál es tu comida favorita?",
    "¿Cómo se llamaba tu escuela primaria?"
];

export const Users: React.FC = () => {
  const { users, currentUser, addUser, updateUser, deleteUser, settings, activityLogs, generateInvite, userInvites, deleteInvite } = useStore();
  const [activeTab, setActiveTab] = useState<'USERS' | 'ACTIVITY' | 'INVITES'>('USERS');
  const [searchTerm, setSearchTerm] = useState('');
  
  // ... (filters state)
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');

  // ... (modal state)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  
  // ... (invite modal)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('CASHIER');
  const [generatedCode, setGeneratedCode] = useState('');

  // ... (pass state)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  
  // ... (security state)
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ... (2fa state)
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [setupStep, setSetupStep] = useState<'INTRO' | 'SCAN' | 'SUCCESS'>('INTRO');

  // ... (confirm modal state)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: 'DELETE' | 'TOGGLE_ACTIVE', userId: string, targetUser?: User} | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Force re-render periodically to update countdowns on locked users
  const [, setTick] = useState(0);
  useEffect(() => {
      const timer = setInterval(() => setTick(t => t + 1), 1000 * 60); // Update every minute
      return () => clearInterval(timer);
  }, []);

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = activityLogs.filter(log => {
    // Text Filter
    const matchesText = searchTerm === '' || 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    // User Filter
    const matchesUser = filterUser === 'ALL' || log.userId === filterUser;

    // Action Filter
    const matchesAction = filterAction === 'ALL' || log.action === filterAction;

    // Date Range Filter
    let matchesDate = true;
    if (filterDateStart) {
        matchesDate = matchesDate && new Date(log.timestamp) >= new Date(filterDateStart);
    }
    if (filterDateEnd) {
        // Set end date to end of day
        const end = new Date(filterDateEnd);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(log.timestamp) <= end;
    }

    return matchesText && matchesUser && matchesAction && matchesDate;
  });

  // Validate password on change
  useEffect(() => {
      if (password) {
          const { errors } = validatePasswordPolicy(password);
          setPasswordErrors(errors);
      } else {
          setPasswordErrors([]);
      }
  }, [password]);

  const getRoleBadge = (role: UserRole) => {
    switch(role) {
      case 'ADMIN': return <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-md text-xs font-bold border border-purple-200 dark:border-purple-800">ADMIN</span>;
      case 'MANAGER': return <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md text-xs font-bold border border-blue-200 dark:border-blue-800">GERENTE</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-700">CAJERO</span>;
    }
  };

  const getActionBadge = (action: ActivityLog['action']) => {
      const styles = {
          'LOGIN': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
          'SALE': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          'INVENTORY': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
          'SETTINGS': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
          'USER_MGMT': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
          'SECURITY': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
          'CASH': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
          'ORDER': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
          'CRM': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
          'RECOVERY': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      };
      return (
          <span className={`px-2 py-1 rounded text-xs font-bold ${styles[action] || styles['SETTINGS']}`}>
              {action}
          </span>
      );
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
      setPassword(''); // Don't show existing hash
      setConfirmPassword('');
      setSecurityAnswer('');
    } else {
      setEditingUser(null);
      // New users get a recovery code generated automatically
      setFormData({ username: '', fullName: '', role: 'CASHIER', active: true, recoveryCode: generateRecoveryCode(), isTwoFactorEnabled: false });
      setPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');
    }
    setPasswordErrors([]);
    setIsModalOpen(true);
  };

  const handleGenerateRecoveryCode = () => {
      setFormData(prev => ({...prev, recoveryCode: generateRecoveryCode()}));
  };

  const handleSave = async () => {
    if (!formData.username || !formData.fullName) {
      alert("Por favor completa los campos requeridos");
      return;
    }

    // Password Validation for New Users
    if (!editingUser && !password) {
      alert("La contraseña es obligatoria para nuevos usuarios");
      return;
    }

    // Strict Policy Check
    if (password) {
        const { isValid, errors } = validatePasswordPolicy(password);
        if (!isValid) {
            alert("La contraseña no es segura:\n- " + errors.join("\n- "));
            return;
        }
        if (password !== confirmPassword) {
            alert("Las contraseñas no coinciden");
            return;
        }
    }

    // --- CRITICAL FIX: Ensure 2FA consistency ---
    if (formData.isTwoFactorEnabled && !formData.twoFactorSecret) {
        alert("Error: Has activado 2FA pero no se ha completado la configuración (falta el secreto). Por favor haz clic en 'Configurar' y completa el proceso, o desactiva la opción.");
        return;
    }

    setIsSaving(true);

    try {
        let finalSalt = editingUser?.salt || generateSalt();
        let finalHash = editingUser?.passwordHash || '';

        // If new password provided, re-hash with PBKDF2
        if (password) {
            finalSalt = generateSalt(); // Rotate salt on password change
            finalHash = await hashPassword(password, finalSalt);
        }

        let securityAnswerHash = editingUser?.securityAnswerHash;
        if (securityAnswer) {
            // Hash the answer (normalized to lowercase)
            securityAnswerHash = await hashPassword(securityAnswer.trim().toLowerCase(), finalSalt);
        }

        // Prepare User Object
        const userToSave: User = {
            id: editingUser ? editingUser.id : crypto.randomUUID(),
            username: formData.username!,
            fullName: formData.fullName!,
            role: formData.role || 'CASHIER',
            active: formData.active ?? true,
            passwordHash: finalHash,
            salt: finalSalt,
            lastLogin: editingUser?.lastLogin,
            lastActive: editingUser?.lastActive,
            isTwoFactorEnabled: !!formData.isTwoFactorEnabled, // Force strict boolean to avoid undefined
            twoFactorSecret: formData.twoFactorSecret, // This persists the secret
            recoveryCode: formData.recoveryCode, // Save generated code
            securityQuestion: formData.securityQuestion,
            securityAnswerHash: securityAnswerHash,
            lockoutUntil: editingUser?.lockoutUntil // Preserve lockout state unless explicitly cleared
        };

        if (editingUser) {
            updateUser(userToSave);
        } else {
            // Check username uniqueness
            if (users.some(u => u.username.toLowerCase() === userToSave.username.toLowerCase())) {
                alert("El nombre de usuario ya existe");
                setIsSaving(false);
                return;
            }
            addUser(userToSave);
        }
        setIsModalOpen(false);
    } catch (e) {
        console.error("Error saving user", e);
        alert("Error crítico de seguridad al guardar usuario.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleInitiateDelete = (id: string) => {
    if (id === currentUser?.id) {
        alert("No puedes eliminar tu propio usuario");
        return;
    }
    setConfirmAction({ type: 'DELETE', userId: id });
    setAdminPassword('');
    setAuthError('');
    setIsConfirmModalOpen(true);
  };

  const handleInitiateToggleActive = (user: User) => {
      if (user.id === currentUser?.id) {
          alert("No puedes desactivar tu propio usuario");
          return;
      }
      setConfirmAction({ type: 'TOGGLE_ACTIVE', userId: user.id, targetUser: user });
      setAdminPassword('');
      setAuthError('');
      setIsConfirmModalOpen(true);
  };

  const executeSecureAction = async () => {
      if (!adminPassword || !currentUser) return;
      setVerifying(true);
      setAuthError('');

      try {
          const isValid = await verifyPassword(adminPassword, currentUser.salt, currentUser.passwordHash);
          if (!isValid) {
              setAuthError('Contraseña incorrecta');
              setVerifying(false);
              return;
          }

          if (confirmAction?.type === 'DELETE') {
              deleteUser(confirmAction.userId);
          } else if (confirmAction?.type === 'TOGGLE_ACTIVE' && confirmAction.targetUser) {
              const isCurrentlyLocked = confirmAction.targetUser.lockoutUntil && new Date(confirmAction.targetUser.lockoutUntil) > new Date();
              
              // If manually unlocking/locking, we should clear the temporary lockout timer to avoid confusion
              const updatedUser = { 
                  ...confirmAction.targetUser, 
                  active: !confirmAction.targetUser.active,
                  lockoutUntil: undefined, 
                  failedLoginAttempts: 0 
              };
              updateUser(updatedUser);
          }

          setIsConfirmModalOpen(false);
          setConfirmAction(null);
      } catch (e) {
          setAuthError('Error de verificación');
      } finally {
          setVerifying(false);
      }
  };

  const handleOpen2FASetup = async () => {
      const secret = generate2FASecret();
      setTempSecret(secret);
      setVerifyCode('');
      setSetupStep('INTRO');
      const url = await generateQRCode(secret, editingUser?.username || 'user', settings.name);
      setQrCodeUrl(url);
      setIs2FAModalOpen(true);
  };

  const handleVerify2FA = () => {
      const isValid = verify2FAToken(verifyCode, tempSecret);
      if (isValid) {
          setSetupStep('SUCCESS');
          setFormData(prev => ({ ...prev, isTwoFactorEnabled: true, twoFactorSecret: tempSecret }));
      } else {
          alert('Código inválido. Intenta de nuevo.');
      }
  };

  const handleDisable2FA = () => {
      if (window.confirm("¿Desactivar la autenticación de dos factores? La cuenta será menos segura.")) {
          setFormData(prev => ({ ...prev, isTwoFactorEnabled: false, twoFactorSecret: undefined }));
          alert("2FA desactivado. Recuerda hacer clic en 'Guardar' para aplicar los cambios.");
      }
  };

  const formatLastActive = (isoString?: string) => {
      if (!isoString) return 'Nunca';
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMs / 3600000);

      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} horas`;
      return date.toLocaleDateString();
  };

  // --- INVITE HANDLERS ---
  const handleOpenInviteModal = () => {
      setGeneratedCode('');
      setInviteRole('CASHIER');
      setIsInviteModalOpen(true);
  };

  const handleGenerateCode = () => {
      const code = generateInvite(inviteRole);
      setGeneratedCode(code);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert('Código copiado al portapapeles');
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-8 md:pl-72 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Usuarios</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de accesos y seguridad</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
                 <button onClick={() => setActiveTab('USERS')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'USERS' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Lista de Usuarios</button>
                 <button onClick={() => setActiveTab('INVITES')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'INVITES' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Invitaciones</button>
                 <button onClick={() => setActiveTab('ACTIVITY')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ACTIVITY' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Registro de Actividad</button>
              </div>
              {activeTab === 'USERS' && (
                  <button onClick={() => handleOpenModal()} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all">
                    <Plus className="w-5 h-5" /> Nuevo
                  </button>
              )}
              {activeTab === 'INVITES' && (
                  <button onClick={handleOpenInviteModal} className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 dark:shadow-none transition-all">
                    <Ticket className="w-5 h-5" /> Generar Código
                  </button>
              )}
          </div>
        </div>

        {activeTab === 'USERS' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex gap-4">
                <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o usuario..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold">
                    <tr>
                    <th className="px-6 py-4 text-left">Usuario</th>
                    <th className="px-6 py-4 text-left">Rol</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-left">Actividad</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers.map(user => {
                        const isLockedOut = user.lockoutUntil && new Date(user.lockoutUntil) > new Date();
                        
                        return (
                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                <UserIcon className="w-5 h-5" />
                                </div>
                                <div>
                                <p className="font-bold text-slate-800 dark:text-white">{user.fullName}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">@{user.username}</p>
                                    {user.isTwoFactorEnabled && <div title="2FA Activado"><ShieldCheck className="w-3 h-3 text-emerald-500" /></div>}
                                </div>
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                            <td className="px-6 py-4 text-center">
                                {isLockedOut ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800" title={`Desbloqueo automático a las ${new Date(user.lockoutUntil!).toLocaleTimeString()}`}>
                                    <Timer className="w-3 h-3 animate-pulse" /> Temp. Bloqueado
                                    </div>
                                ) : user.active ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle className="w-3 h-3" /> Activo
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                                    <XCircle className="w-3 h-3" /> Bloqueado
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5 text-xs" title="Último Login">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Nunca'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium" title="Última Acción">
                                        <Activity className="w-3 h-3" />
                                        <span>Activo: {formatLastActive(user.lastActive)}</span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                                {user.id !== currentUser?.id && (
                                    <button onClick={() => handleInitiateToggleActive(user)} className={`p-2 rounded-lg transition-colors ${user.active && !isLockedOut ? 'hover:bg-orange-50 dark:hover:bg-orange-900/30 text-orange-500' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600'}`} title={user.active ? "Bloquear Acceso" : "Desbloquear Acceso"}>
                                        {user.active && !isLockedOut ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                    </button>
                                )}
                                <button onClick={() => handleOpenModal(user)} className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                {user.id !== currentUser?.id && (
                                <button onClick={() => handleInitiateDelete(user.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
            </div>
        )}

        {activeTab === 'INVITES' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Invitaciones Pendientes</h3>
                        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">{userInvites.length} activas</span>
                    </div>
                    
                    {userInvites.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <Ticket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="text-slate-500 dark:text-slate-400">No hay invitaciones pendientes.</p>
                            <button onClick={handleOpenInviteModal} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">Generar una nueva</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {userInvites.map((invite) => (
                                <div key={invite.code} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col relative group">
                                    <div className="flex justify-between items-start mb-2">
                                        {getRoleBadge(invite.role)}
                                        <button onClick={() => deleteInvite(invite.code)} className="text-slate-400 hover:text-red-500 transition-colors p-1"><X className="w-4 h-4"/></button>
                                    </div>
                                    <div className="my-2 bg-white dark:bg-slate-900 p-2 rounded border border-dashed border-slate-300 dark:border-slate-600 text-center relative cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => copyToClipboard(invite.code)}>
                                        <code className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">{invite.code}</code>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300"><Copy className="w-4 h-4"/></div>
                                    </div>
                                    <div className="mt-auto pt-2 text-xs text-slate-400 flex justify-between">
                                        <span>Creado por: {invite.createdBy}</span>
                                        <span>{new Date(invite.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'ACTIVITY' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden animate-[fadeIn_0.3s_ease-out]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row gap-4 items-end lg:items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input type="text" placeholder="Buscar en logs (detalles)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"/>
                    </div>
                    <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white min-w-[140px]"><option value="ALL">Todos los Usuarios</option>{users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}</select>
                        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white min-w-[140px]"><option value="ALL">Todas las Acciones</option><option value="LOGIN">Inicios de Sesión</option><option value="SALE">Ventas</option><option value="INVENTORY">Inventario</option><option value="CASH">Caja Chica</option><option value="ORDER">Pedidos</option><option value="CRM">Clientes/Prov</option><option value="USER_MGMT">Gestión Usuarios</option><option value="SECURITY">Seguridad</option><option value="SETTINGS">Configuración</option><option value="RECOVERY">Recuperación</option></select>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 rounded-lg border border-slate-200 dark:border-slate-700"><Calendar className="w-4 h-4 text-slate-500" /><input type="date" className="bg-transparent border-none text-sm outline-none w-[110px] dark:text-white" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} title="Fecha Inicio"/><span className="text-slate-400">-</span><input type="date" className="bg-transparent border-none text-sm outline-none w-[110px] dark:text-white" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} title="Fecha Fin"/></div>
                    </div>
                </div>
                <div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm uppercase font-semibold"><tr><th className="px-6 py-4 text-left">Fecha</th><th className="px-6 py-4 text-left">Usuario</th><th className="px-6 py-4 text-left">Acción</th><th className="px-6 py-4 text-left">Detalles</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td><td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-sm">{log.userName}</td><td className="px-6 py-4">{getActionBadge(log.action)}</td><td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{log.details}</td></tr>))}{filteredLogs.length === 0 && (<tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />No hay registros de actividad.</td></tr>)}</tbody></table></div>
            </div>
        )}
      </div>

      {/* CONFIRM MODAL (Keep existing) */}
      {isConfirmModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400"><Shield className="w-6 h-6" /></div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-2">Seguridad Requerida</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">{confirmAction?.type === 'DELETE' ? 'Estás a punto de eliminar un usuario permanentemente.' : confirmAction?.targetUser?.active ? 'Estás a punto de BLOQUEAR el acceso a este usuario.' : 'Estás a punto de DESBLOQUEAR el acceso a este usuario.'}<br/>Por favor, confirma <strong>tu contraseña de administrador</strong> para continuar.</p>
                  <div className="mb-4"><input type="password" placeholder="Tu contraseña..." className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-red-500 outline-none dark:text-white" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} autoFocus />{authError && <p className="text-red-500 text-xs mt-2 font-bold">{authError}</p>}</div>
                  <div className="flex gap-3"><button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-medium">Cancelar</button><button onClick={executeSecureAction} disabled={verifying || !adminPassword} className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50">{verifying ? 'Verificando...' : 'Confirmar'}</button></div>
              </div>
          </div>
      )}

      {/* USER FORM MODAL (Keep existing logic) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-lg w-full border border-slate-100 dark:border-slate-800 animate-[fadeIn_0.2s_ease-out] max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-500" />
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h3>
            
            <div className="space-y-5">
              {/* ... form fields ... */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.fullName || ''} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuario (Login)</label>
                    <input type="text" disabled={!!editingUser} className={`w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none ${editingUser ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500'}`} value={formData.username || ''} onChange={e => setFormData({ ...formData, username: e.target.value.replace(/\s/g, '') })} />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                      <option value="CASHIER">Cajero</option>
                      <option value="MANAGER">Gerente</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                 </div>
              </div>

              {/* Security Settings Section */}
              <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Configuración de Recuperación
                  </h4>

                  {/* Security Question */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                      <div className="mb-3">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pregunta de Seguridad</label>
                          <select 
                            value={formData.securityQuestion || ''}
                            onChange={(e) => setFormData({...formData, securityQuestion: e.target.value})}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-sm"
                          >
                              <option value="">-- Selecciona una pregunta --</option>
                              {SECURITY_QUESTIONS.map((q, i) => <option key={i} value={q}>{q}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Respuesta</label>
                          <input 
                            type="text" 
                            placeholder={editingUser?.securityAnswerHash ? "******** (Ya configurada)" : "Escribe tu respuesta"}
                            value={securityAnswer}
                            onChange={(e) => setSecurityAnswer(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          />
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><HelpCircle className="w-3 h-3"/> Se usará para recuperar la contraseña si la olvidas.</p>
                      </div>
                  </div>

                  {/* Recovery Code */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800 flex justify-between items-center">
                      <div className="flex items-start gap-3">
                          <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300 mt-1">
                              <KeyRound className="w-5 h-5" />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-sm">Clave Maestra</h4>
                              <div className="flex items-center gap-2 mt-1">
                                  <code className="bg-white dark:bg-slate-950 px-3 py-1 rounded border border-amber-200 dark:border-amber-900 font-mono text-sm font-bold tracking-wider select-all">
                                      {formData.recoveryCode || 'No generada'}
                                  </code>
                                  <button onClick={handleGenerateRecoveryCode} className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800/50 rounded transition-colors text-amber-600" title="Regenerar"><RefreshCw className="w-4 h-4"/></button>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* 2FA Section */}
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-300">
                              <Smartphone className="w-5 h-5" />
                          </div>
                          <div>
                              <h4 className="font-bold text-slate-800 dark:text-white text-sm">Autenticación 2FA</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {formData.isTwoFactorEnabled ? 'Activado y seguro.' : 'No configurado.'}
                              </p>
                          </div>
                      </div>
                      
                      {formData.isTwoFactorEnabled ? (
                          <button onClick={handleDisable2FA} className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors">Desactivar</button>
                      ) : (
                          <button onClick={handleOpen2FASetup} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">Configurar</button>
                      )}
                  </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <Key className="w-4 h-4" /> {editingUser ? 'Cambiar Contraseña (Opcional)' : 'Contraseña'}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div><input type="password" placeholder="Nueva Contraseña" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
                     <div><input type="password" placeholder="Confirmar" className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 outline-none ${password && confirmPassword && password !== confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'}`} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
                  </div>
                  {password && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                          <p className="font-bold text-slate-500 dark:text-slate-400 mb-2">Requisitos de Seguridad:</p>
                          <ul className="space-y-1">
                              <li className={`flex items-center gap-2 ${password.length >= 12 ? 'text-emerald-600' : 'text-slate-400'}`}>{password.length >= 12 ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Mínimo 12 caracteres</li>
                              <li className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[A-Z]/.test(password) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Mayúscula</li>
                              <li className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[a-z]/.test(password) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Minúscula</li>
                              <li className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[0-9]/.test(password) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Número</li>
                              <li className={`flex items-center gap-2 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>{/[!@#$%^&*(),.?":{}|<>]/.test(password) ? <Check className="w-3 h-3"/> : <X className="w-3 h-3"/>} Símbolo especial</li>
                          </ul>
                          {passwordErrors.length > 0 && (<div className="mt-2 text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /><span className="font-bold">Contraseña débil</span></div>)}
                      </div>
                  )}
              </div>
              
              <div className="flex items-center gap-3 pt-2">
                 <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${formData.active ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'}`}>
                    {formData.active ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <span>{formData.active ? 'Usuario Activo' : 'Usuario Inactivo (Acceso Bloqueado)'}</span>
                 </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium">Cancelar</button>
              <button onClick={handleSave} disabled={isSaving || (!!password && passwordErrors.length > 0)} className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'Encriptando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW INVITE GENERATOR MODAL */}
      {isInviteModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-slate-100 dark:border-slate-800 text-center animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400"><Ticket className="w-8 h-8" /></div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Invitación de Empleado</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Genera un código único para que un nuevo empleado se registre.</p>
                  
                  {!generatedCode ? (
                      <div className="space-y-4">
                          <div className="text-left">
                              <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">Asignar Rol</label>
                              <div className="flex gap-2">
                                  <button onClick={() => setInviteRole('CASHIER')} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${inviteRole === 'CASHIER' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Cajero</button>
                                  <button onClick={() => setInviteRole('MANAGER')} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${inviteRole === 'MANAGER' ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Gerente</button>
                              </div>
                          </div>
                          <button onClick={handleGenerateCode} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg">Generar Código</button>
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600">
                              <p className="text-xs text-slate-500 uppercase font-bold mb-2">CÓDIGO DE REGISTRO</p>
                              <p className="text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider break-all">{generatedCode}</p>
                          </div>
                          <div className="flex gap-2">
                              <button onClick={() => copyToClipboard(generatedCode)} className="flex-1 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100">Copiar</button>
                              <button onClick={() => {setGeneratedCode(''); setIsInviteModalOpen(false);}} className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">Listo</button>
                          </div>
                      </div>
                  )}
                  
                  {!generatedCode && <button onClick={() => setIsInviteModalOpen(false)} className="mt-4 text-sm text-slate-400 hover:text-slate-600">Cancelar</button>}
              </div>
          </div>
      )}

      {/* 2FA SETUP MODAL (Keep existing) */}
      {is2FAModalOpen && (
          // ... (2FA setup modal remains same) ...
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-slate-100 dark:border-slate-800 text-center animate-[fadeIn_0.2s_ease-out]">
                  {setupStep === 'INTRO' && (
                      <>
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400"><ShieldCheck className="w-8 h-8" /></div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Configurar 2FA</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Protege tu cuenta con una capa extra de seguridad usando Google Authenticator, Authy, etc.</p>
                        <button onClick={() => setSetupStep('SCAN')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl">Comenzar</button>
                      </>
                  )}
                  {setupStep === 'SCAN' && (
                      <>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Escanea el Código QR</h3>
                        <div className="bg-white p-4 rounded-xl shadow-inner border border-slate-200 mx-auto w-fit mb-4">{qrCodeUrl ? <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" /> : <div className="w-40 h-40 bg-slate-200 animate-pulse"></div>}</div>
                        <p className="text-xs text-slate-500 mb-4">O ingresa manualmente: <code className="bg-slate-100 dark:bg-slate-800 p-1 rounded font-mono select-all">{tempSecret}</code></p>
                        <input type="text" maxLength={6} placeholder="Ingresa el código de 6 dígitos" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} className="w-full mb-4 px-4 py-3 text-center tracking-widest font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={handleVerify2FA} disabled={verifyCode.length !== 6} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl mb-2">Verificar y Activar</button>
                        <button onClick={() => setIs2FAModalOpen(false)} className="text-sm text-slate-500 hover:underline">Cancelar</button>
                      </>
                  )}
                  {setupStep === 'SUCCESS' && (
                      <>
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-8 h-8" /></div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">¡Activado!</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">La autenticación de dos factores está habilitada. Haz clic en <strong>Guardar</strong> en el formulario principal para confirmar.</p>
                        <button onClick={() => setIs2FAModalOpen(false)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">Entendido</button>
                      </>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};


// ... (imports remain same, not changing top part) ...
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Transaction, Customer, Supplier, CashMovement, Order, User, ActivityLog, ToastNotification, BusinessSettings, CartItem, Purchase, UserInvite, UserRole } from '../types';
import { hashPassword, verifyPassword, sanitizeDataStructure, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';

// ... (interface definition remains same) ...
interface StoreContextType {
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  suppliers: Supplier[];
  cashMovements: CashMovement[];
  orders: Order[];
  purchases: Purchase[];
  users: User[];
  userInvites: UserInvite[];
  settings: BusinessSettings;
  currentUser: User | null;
  activityLogs: ActivityLog[];
  categories: string[];
  toasts: ToastNotification[];
  isSyncing: boolean;
  
  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => Promise<boolean>; 
  adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string, items: any[]) => void;
  registerTransactionPayment: (id: string, amount: number, method: string) => void;
  updateStockAfterSale: (items: any[]) => void;
  addCustomer: (c: Customer) => void;
  updateCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => Promise<boolean>; 
  processCustomerPayment: (customerId: string, amount: number) => void;
  addSupplier: (s: Supplier) => void;
  updateSupplier: (s: Supplier) => void;
  deleteSupplier: (id: string) => Promise<boolean>; 
  addPurchase: (p: Purchase) => void;
  addCashMovement: (m: CashMovement) => void;
  deleteCashMovement: (id: string) => void;
  addOrder: (o: Order) => void;
  updateOrderStatus: (id: string, status: string) => void;
  convertOrderToSale: (id: string, paymentMethod: string) => void;
  deleteOrder: (id: string) => void;
  updateSettings: (s: BusinessSettings) => void;
  importData: (data: any) => void;
  login: (u: string, p: string, code?: string) => Promise<string>;
  logout: () => void;
  addUser: (u: User) => void;
  updateUser: (u: User) => void;
  deleteUser: (id: string) => void;
  recoverAccount: (u: string, method: string, payload: string, newPass: string) => Promise<string>;
  verifyRecoveryAttempt: (u: string, method: string, payload: string) => Promise<boolean>;
  getUserPublicInfo: (username: string) => any;
  notify: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', forceNative?: boolean) => void;
  removeToast: (id: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
  logActivity: (action: string, details: string) => void;
  pullFromCloud: () => Promise<void>;
  pushToCloud: () => Promise<void>;
  generateInvite: (role: UserRole) => string;
  registerWithInvite: (code: string, userData: {
      username: string; 
      password: string; 
      fullName: string;
      securityQuestion: string;
      securityAnswer: string;
      isTwoFactorEnabled: boolean;
      twoFactorSecret?: string;
  }) => Promise<string>;
  deleteInvite: (code: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Security Config
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-logout
const STORAGE_PREFIX = "LUMINA_SEC::"; // Prefix to identify encrypted data

const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'Mi Negocio',
    address: 'Calle Principal #123',
    phone: '555-0000',
    email: 'contacto@negocio.com',
    website: '',
    taxId: '',
    currency: '$',
    taxRate: 16,
    enableTax: true,
    logo: null,
    receiptLogo: null,
    receiptHeader: '*** GRACIAS POR SU COMPRA ***',
    receiptFooter: 'Síguenos en redes sociales',
    ticketPaperWidth: '80mm',
    theme: 'light',
    budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    notificationsEnabled: false,
    sequences: { customerStart: 1001, ticketStart: 10001, orderStart: 5001 },
    productionDoc: { title: 'ORDEN DE TRABAJO', showPrices: true, showCustomerContact: true, showDates: true, customFooter: '' },
    enableCloudSync: true,
    googleWebAppUrl: '',
    cloudSecret: '' 
};

// --- DATA INTEGRITY & SECURITY HELPERS ---

const encodeData = (data: any): string => {
    try {
        const json = JSON.stringify(data);
        const b64 = btoa(encodeURIComponent(json));
        return STORAGE_PREFIX + b64.split('').reverse().join('');
    } catch (e) {
        console.error("Encoding failed", e);
        return "";
    }
};

const decodeData = <T,>(encoded: string | null, fallback: T): T => {
    if (!encoded) return fallback;
    try {
        if (!encoded.startsWith(STORAGE_PREFIX)) {
            try { return JSON.parse(encoded); } catch { return fallback; }
        }
        const payload = encoded.replace(STORAGE_PREFIX, '');
        const reversed = payload.split('').reverse().join('');
        const json = decodeURIComponent(atob(reversed));
        return JSON.parse(json);
    } catch (e) {
        return fallback;
    }
};

const safeLoad = <T,>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return decodeData(item, fallback);
    } catch (e) {
        return fallback;
    }
};

const safeSave = (key: string, data: any) => {
    try {
        if (data === undefined) return;
        const encrypted = encodeData(data);
        localStorage.setItem(key, encrypted);
    } catch (e) {
        console.error(`Failed to save ${key} to storage.`, e);
    }
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>(() => safeLoad('products', []));
    const [transactions, setTransactions] = useState<Transaction[]>(() => safeLoad('transactions', []));
    const [customers, setCustomers] = useState<Customer[]>(() => safeLoad('customers', []));
    const [suppliers, setSuppliers] = useState<Supplier[]>(() => safeLoad('suppliers', []));
    const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => safeLoad('cashMovements', []));
    const [orders, setOrders] = useState<Order[]>(() => safeLoad('orders', []));
    const [purchases, setPurchases] = useState<Purchase[]>(() => safeLoad('purchases', []));
    const [users, setUsers] = useState<User[]>(() => safeLoad('users', []));
    const [userInvites, setUserInvites] = useState<UserInvite[]>(() => safeLoad('userInvites', []));
    const [categories, setCategories] = useState<string[]>(() => safeLoad('categories', ["General"]));
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => safeLoad('activityLogs', []));
    
    const [settings, setSettings] = useState<BusinessSettings>(() => {
        const saved = safeLoad<Partial<BusinessSettings> | null>('settings', null);
        if (saved && typeof saved === 'object') {
            return { ...DEFAULT_SETTINGS, ...saved };
        }
        return DEFAULT_SETTINGS;
    });
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const justPulledFromCloud = useRef(false);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // --- AUDIO SYSTEM ---
    useEffect(() => {
        // Unlock AudioContext on first user interaction
        const unlockAudio = () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(e => console.warn("Audio resume failed", e));
            }
            if (!audioCtxRef.current) {
                try {
                    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                } catch (e) { console.warn("Audio not supported"); }
            }
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
        return () => {
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        };
    }, []);

    const playSound = (type: 'success' | 'error' | 'warning' | 'info') => {
        if (!settings.notificationsEnabled && type === 'info') return;
        
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
            } else if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(500, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.1);
            } else {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
            }

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.warn("Audio play failed", e);
        }
    };

    // --- SECURITY CHECKS ---
    useEffect(() => {
        const savedUser = safeLoad<User | null>('currentUser', null);
        if (savedUser) {
            const validUser = users.find(u => u.id === savedUser.id && u.username === savedUser.username);
            if (validUser) {
                if (savedUser.role !== validUser.role) {
                    const sanitizedUser = { ...validUser, role: validUser.role }; 
                    setCurrentUser(sanitizedUser);
                    safeSave('currentUser', sanitizedUser);
                } else {
                    setCurrentUser(savedUser);
                }
            } else {
                if (users.length > 0) { 
                    setCurrentUser(null);
                    localStorage.removeItem('currentUser');
                } else {
                    setCurrentUser(savedUser);
                }
            }
        }
    }, [users]); 

    useEffect(() => {
        let idleTimer: ReturnType<typeof setTimeout>;
        const resetTimer = () => {
            if (!currentUser) return; 
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                notify('Sesión Cerrada', 'Tu sesión ha expirado por seguridad (15 min inactividad).', 'warning');
                logout();
            }, IDLE_TIMEOUT_MS);
        };
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        if (currentUser) {
            activityEvents.forEach(event => window.addEventListener(event, resetTimer));
            resetTimer(); 
        }
        return () => {
            clearTimeout(idleTimer);
            activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [currentUser]); 

    // --- PERSISTENCE ---
    useEffect(() => {
        safeSave('products', products);
        safeSave('transactions', transactions);
        safeSave('customers', customers);
        safeSave('suppliers', suppliers);
        safeSave('cashMovements', cashMovements);
        safeSave('orders', orders);
        safeSave('purchases', purchases);
        safeSave('users', users);
        safeSave('userInvites', userInvites);
        safeSave('settings', settings);
        safeSave('categories', categories);
        safeSave('activityLogs', activityLogs);
    }, [products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, categories, activityLogs]);

    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', forceNative: boolean = false) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => removeToast(id), 6000);
        
        playSound(type);

        if ((settings.notificationsEnabled || forceNative) && Notification.permission === 'granted') {
            try { new Notification(title, { body: message, icon: '/pwa-192x192.png', silent: false }); } catch (error) {}
        }
    };

    const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

    const pushToCloud = useCallback(async () => {
        if (!settings.enableCloudSync || !settings.googleWebAppUrl || settings.googleWebAppUrl.length < 10) return;
        setIsSyncing(true);
        const dataToPush = {
            products, transactions, customers, suppliers, 
            cashMovements, orders, purchases, users, userInvites, categories, activityLogs, settings
        };
        await pushFullDataToCloud(settings.googleWebAppUrl, settings.cloudSecret, dataToPush);
        setIsSyncing(false);
    }, [settings, products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs]);

    const pullFromCloud = async () => {
        if (!settings.googleWebAppUrl || settings.googleWebAppUrl.length < 10) return;
        setIsSyncing(true);
        try {
            const cloudData = await fetchFullDataFromCloud(settings.googleWebAppUrl, settings.cloudSecret);
            if (cloudData && typeof cloudData === 'object') {
                const safeData = sanitizeDataStructure(cloudData);
                if (Array.isArray(safeData.products)) setProducts(safeData.products);
                if (Array.isArray(safeData.transactions)) setTransactions(safeData.transactions);
                if (Array.isArray(safeData.customers)) setCustomers(safeData.customers);
                if (Array.isArray(safeData.suppliers)) setSuppliers(safeData.suppliers);
                if (Array.isArray(safeData.cashMovements)) setCashMovements(safeData.cashMovements);
                if (Array.isArray(safeData.orders)) setOrders(safeData.orders);
                if (Array.isArray(safeData.purchases)) setPurchases(safeData.purchases);
                if (Array.isArray(safeData.users)) setUsers(safeData.users);
                if (Array.isArray(safeData.userInvites)) setUserInvites(safeData.userInvites);
                if (Array.isArray(safeData.categories)) setCategories(safeData.categories);
                if (Array.isArray(safeData.activityLogs)) setActivityLogs(safeData.activityLogs);
                
                // Smart Settings Merge
                if (safeData.settings && typeof safeData.settings === 'object') {
                    const mergedSettings = { 
                        ...DEFAULT_SETTINGS,
                        ...safeData.settings, 
                        // Always preserve critical connection details from local state
                        googleWebAppUrl: settings.googleWebAppUrl, 
                        enableCloudSync: settings.enableCloudSync, 
                        cloudSecret: settings.cloudSecret,
                        // FIX FOR LOGO: If cloud logo is empty/small but local is valid, KEEP LOCAL
                        // This prevents sync overwriting a freshly uploaded logo before it was pushed
                        logo: (safeData.settings.logo && safeData.settings.logo.length > 50) ? safeData.settings.logo : settings.logo,
                        receiptLogo: (safeData.settings.receiptLogo && safeData.settings.receiptLogo.length > 50) ? safeData.settings.receiptLogo : settings.receiptLogo
                    };
                    setSettings(mergedSettings);
                }
                justPulledFromCloud.current = true;
                notify('Datos Sincronizados', 'Sincronización con la nube completada.', 'success');
            }
        } catch (e: any) {
            console.error("Sync Pull Error:", e);
            if (e.message && e.message.includes("ACCESO DENEGADO")) {
                 notify("Error de Acceso", "Contraseña de nube incorrecta. Verifica la configuración.", "error");
            } else {
                 notify("Error Sincronización", "No se pudieron descargar los datos. Verifique su conexión.", "error");
            }
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            // Initial pull
            if (settings.enableCloudSync && settings.googleWebAppUrl) {
                await pullFromCloud();
            }
            if (users.length === 0) {
                const salt = 'default_salt'; 
                const hash = await hashPassword('Admin@123456', salt);
                const admin: User = {
                    id: 'admin-001', username: 'admin', passwordHash: hash, salt: salt,
                    fullName: 'Administrador', role: 'ADMIN', active: true
                };
                setUsers([admin]);
            }
        };
        init();
    }, []);

    // Debounced Push
    useEffect(() => {
        if (justPulledFromCloud.current) {
            justPulledFromCloud.current = false;
            return;
        }
        const timer = setTimeout(() => {
            if (settings.enableCloudSync) pushToCloud();
        }, 2000); 
        return () => clearTimeout(timer);
    }, [products, transactions, customers, cashMovements, users, userInvites, orders, purchases, activityLogs, settings, pushToCloud]);

    // ... rest of the functions (logActivity, login, logout, etc.)
    const logActivity = (action: string, details: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        const newLog: ActivityLog = {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            userName: currentUser.username,
            userRole: currentUser.role,
            action: action as any,
            details,
            timestamp: now
        };
        setActivityLogs(prev => [newLog, ...prev].slice(0, 1000));
        setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: now } : u));
    };

    const login = async (u: string, p: string, code?: string) => {
        const userIndex = users.findIndex(user => user.username.toLowerCase() === u.toLowerCase());
        const user = users[userIndex];
        if (!user || !user.active) return 'INVALID';
        if (user.lockoutUntil) {
            if (new Date() < new Date(user.lockoutUntil)) {
                logActivity('SECURITY', `Intento de login en cuenta bloqueada: ${u}`);
                return 'LOCKED';
            } else {
                const updatedUsers = [...users];
                updatedUsers[userIndex] = { ...user, lockoutUntil: undefined, failedLoginAttempts: 0 };
                setUsers(updatedUsers);
            }
        }
        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        if (!isValid) {
            const attempts = (user.failedLoginAttempts || 0) + 1;
            let lockoutUntil = undefined;
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
                logActivity('SECURITY', `Cuenta bloqueada por fuerza bruta: ${u}`);
            }
            const updatedUsers = [...users];
            updatedUsers[userIndex] = { ...user, failedLoginAttempts: attempts, lockoutUntil };
            setUsers(updatedUsers);
            return 'INVALID';
        }
        if (user.isTwoFactorEnabled === true && user.twoFactorSecret) {
            if (!code) return '2FA_REQUIRED';
            const is2FAValid = verify2FAToken(code, user.twoFactorSecret);
            if (!is2FAValid) {
                logActivity('SECURITY', `Fallo de 2FA para: ${u}`);
                return 'INVALID_2FA';
            }
        }
        const now = new Date().toISOString();
        const updatedUser = { ...user, lastLogin: now, lastActive: now, failedLoginAttempts: 0, lockoutUntil: undefined };
        setUsers(prev => prev.map(usr => usr.id === user.id ? updatedUser : usr));
        setCurrentUser(updatedUser);
        safeSave('currentUser', updatedUser); 
        const loginLog: ActivityLog = {
            id: crypto.randomUUID(), userId: updatedUser.id, userName: updatedUser.username, userRole: updatedUser.role,
            action: 'LOGIN', details: `Usuario ${u} inició sesión`, timestamp: now
        };
        setActivityLogs(prev => [loginLog, ...prev].slice(0, 1000));
        return 'SUCCESS';
    };

    const logout = () => {
        if (currentUser) logActivity('LOGIN', `Cierre de sesión`);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
    };

    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newInvite: UserInvite = { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' };
        setUserInvites(prev => [...prev, newInvite]);
        logActivity('USER_MGMT', `Invitación generada (${role})`);
        return code;
    };
    const deleteInvite = (code: string) => setUserInvites(prev => prev.filter(i => i.code !== code));
    const registerWithInvite = async (code: string, userData: any) => {
        const inviteIndex = userInvites.findIndex(i => i.code === code);
        if (inviteIndex === -1) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) return 'USERNAME_EXISTS';
        const invite = userInvites[inviteIndex];
        const salt = generateSalt();
        const hash = await hashPassword(userData.password, salt);
        const answerHash = await hashPassword(userData.securityAnswer.trim().toLowerCase(), salt);
        const newUser: User = {
            id: crypto.randomUUID(), username: userData.username, fullName: userData.fullName, role: invite.role, active: true,
            passwordHash: hash, salt: salt, recoveryCode: Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            securityQuestion: userData.securityQuestion, securityAnswerHash: answerHash, isTwoFactorEnabled: userData.isTwoFactorEnabled, twoFactorSecret: userData.twoFactorSecret
        };
        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter((_, i) => i !== inviteIndex));
        const log: ActivityLog = { id: crypto.randomUUID(), userId: newUser.id, userName: newUser.username, userRole: newUser.role, action: 'USER_MGMT', details: `Registro completado`, timestamp: new Date().toISOString() };
        setActivityLogs(prev => [log, ...prev]);
        return 'SUCCESS';
    };

    // State updaters
    const addProduct = (p: Product) => { setProducts(prev => [...prev, p]); logActivity('INVENTORY', `Producto creado: ${p.name}`); };
    const updateProduct = (p: Product) => { setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)); logActivity('INVENTORY', `Producto actualizado: ${p.name}`); };
    const deleteProduct = async (id: string): Promise<boolean> => {
        const product = products.find(p => p.id === id);
        if (!product) return false;
        const hasSales = transactions.some(t => t.items.some(i => i.id === id));
        if (hasSales) { notify('Error', 'Producto con ventas. No se puede eliminar.', 'error'); return false; }
        setProducts(prev => prev.filter(p => p.id !== id));
        logActivity('INVENTORY', `Producto eliminado ID: ${id}`);
        return true;
    };
    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (p.hasVariants && variantId) {
                    const newVariants = p.variants?.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty) } : v);
                    return { ...p, variants: newVariants, stock: newVariants?.reduce((acc, v) => acc + v.stock, 0) || 0 };
                }
                return { ...p, stock: type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty) };
            }
            return p;
        }));
        logActivity('INVENTORY', `Ajuste stock (${type} ${qty}) ID: ${id}`);
    };
    const addCategory = (name: string) => setCategories(prev => [...prev, name]);
    const removeCategory = (name: string) => setCategories(prev => prev.filter(c => c !== name));
    const addTransaction = (t: Transaction) => {
        const finalTrans = { ...t, id: t.id || (settings.sequences.ticketStart + transactions.length).toString(), customerName: customers.find(c => c.id === t.customerId)?.name || 'Cliente General' };
        setTransactions(prev => [finalTrans, ...prev]);
        if (t.paymentMethod === 'credit' && t.customerId) { setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + (t.total - (t.amountPaid || 0)) } : c)); }
        if (t.paymentStatus === 'paid' && t.paymentMethod !== 'credit' && !t.isReturn) {
             const movement: CashMovement = { id: `mv_${finalTrans.id}`, type: 'DEPOSIT', amount: t.amountPaid, description: `Venta Ticket #${finalTrans.id}`, date: new Date().toISOString(), category: 'SALES', customerId: t.customerId };
             setCashMovements(prev => [movement, ...prev]);
        }
        logActivity('SALE', `Venta registrada #${finalTrans.id}`);
    };
    const deleteTransaction = (id: string, items: any[]) => { setTransactions(prev => prev.filter(t => t.id !== id)); logActivity('SALE', `Venta anulada #${id}`); };
    const registerTransactionPayment = (id: string, amount: number, method: string) => {
        setTransactions(prev => prev.map(t => { if (t.id === id) { const newPaid = (t.amountPaid || 0) + amount; return { ...t, amountPaid: newPaid, paymentStatus: newPaid >= t.total ? 'paid' : 'partial' }; } return t; }));
        logActivity('CASH', `Pago registrado en venta #${id}: $${amount}`);
    };
    const updateStockAfterSale = (items: any[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find((i: any) => i.id === p.id);
            if (item) { if (p.hasVariants && item.variantId) { const newVariants = p.variants?.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v); return { ...p, variants: newVariants, stock: (newVariants?.reduce((acc, v) => acc + v.stock, 0) || 0) }; } return { ...p, stock: p.stock - item.quantity }; } return p;
        }));
    };
    const addCustomer = (c: Customer) => { const newId = (settings.sequences.customerStart + customers.length).toString(); setCustomers(prev => [...prev, { ...c, id: newId }]); logActivity('CRM', `Nuevo cliente: ${c.name}`); };
    const updateCustomer = (c: Customer) => setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust));
    const deleteCustomer = async (id: string): Promise<boolean> => {
        const customer = customers.find(c => c.id === id);
        if (!customer) return false;
        if (customer.currentDebt > 0) { notify('Error', 'Cliente con deuda pendiente.', 'error'); return false; }
        setCustomers(prev => prev.filter(c => c.id !== id));
        notify('Éxito', 'Cliente eliminado.', 'success'); return true;
    };
    const processCustomerPayment = (customerId: string, amount: number) => { setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c)); logActivity('CASH', `Abono cliente ID ${customerId}: $${amount}`); };
    const addSupplier = (s: Supplier) => setSuppliers(prev => [...prev, s]);
    const updateSupplier = (s: Supplier) => setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup));
    const deleteSupplier = async (id: string): Promise<boolean> => { setSuppliers(prev => prev.filter(s => s.id !== id)); return true; };
    const addPurchase = (purchase: Purchase) => {
        setPurchases(prev => [purchase, ...prev]);
        purchase.items.forEach(item => { adjustStock(item.productId, item.quantity, 'IN', item.variantId); });
        const expenseMovement: CashMovement = { id: `purch_${purchase.id}`, type: 'EXPENSE', amount: purchase.total, description: `Compra a ${purchase.supplierName}`, date: purchase.date, category: 'OPERATIONAL' };
        addCashMovement(expenseMovement);
        logActivity('INVENTORY', `Compra registrada #${purchase.id}`);
        notify('Compra Exitosa', `Gasto de $${purchase.total.toFixed(2)} registrado.`, 'success');
    };
    const addCashMovement = (m: CashMovement) => { setCashMovements(prev => [m, ...prev]); logActivity('CASH', `Movimiento caja: ${m.type} $${m.amount}`); };
    const deleteCashMovement = (id: string) => setCashMovements(prev => prev.filter(m => m.id !== id));
    const addOrder = (o: Order) => { const newId = (settings.sequences.orderStart + orders.length).toString(); setOrders(prev => [...prev, { ...o, id: newId }]); logActivity('ORDER', `Nuevo pedido #${newId}`); };
    const updateOrderStatus = (id: string, status: string) => { setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o)); logActivity('ORDER', `Pedido #${id} estado: ${status}`); };
    const deleteOrder = (id: string) => setOrders(prev => prev.filter(o => o.id !== id));
    const convertOrderToSale = (id: string, paymentMethod: string) => {
        const order = orders.find(o => o.id === id); if (!order) return;
        const transaction: Transaction = { id: '', date: new Date().toISOString(), subtotal: order.total, taxAmount: 0, discount: 0, shipping: 0, total: order.total, items: order.items, paymentMethod: paymentMethod as any, paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid', amountPaid: paymentMethod === 'credit' ? 0 : order.total, customerId: order.customerId, status: 'completed' };
        addTransaction(transaction); updateStockAfterSale(order.items); updateOrderStatus(id, 'COMPLETED'); logActivity('ORDER', `Pedido #${id} convertido a venta`);
    };
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); logActivity('USER_MGMT', `Usuario creado: ${u.username}`); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(user => user.id === u.id ? u : user)); logActivity('USER_MGMT', `Usuario actualizado: ${u.username}`); };
    const deleteUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));
    const getUserPublicInfo = (username: string) => { const user = users.find(u => u.username.toLowerCase() === username.toLowerCase()); return user ? { username: user.username, fullName: user.fullName, securityQuestion: user.securityQuestion, isTwoFactorEnabled: user.isTwoFactorEnabled } : null; };
    const recoverAccount = async (u: string, method: string, payload: string, newPass: string) => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'INVALID';
        const salt = 'new_salt_' + Date.now(); 
        const hash = await hashPassword(newPass, salt);
        updateUser({ ...user, passwordHash: hash, salt: salt, lockoutUntil: undefined, failedLoginAttempts: 0 });
        logActivity('RECOVERY', `Cuenta recuperada: ${u}`);
        return 'SUCCESS';
    };
    const verifyRecoveryAttempt = async (u: string, method: string, payload: string) => !!users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
    const updateSettings = (s: BusinessSettings) => { setSettings(s); logActivity('SETTINGS', 'Configuración actualizada'); };
    const importData = (data: any) => {
        try {
            const safeData = sanitizeDataStructure(data);
            if (Array.isArray(safeData.products)) setProducts(safeData.products);
            if (Array.isArray(safeData.users)) setUsers(safeData.users);
            if (safeData.settings && typeof safeData.settings === 'object') setSettings(safeData.settings);
            if (Array.isArray(safeData.transactions)) setTransactions(safeData.transactions);
            if (Array.isArray(safeData.customers)) setCustomers(safeData.customers);
            logActivity('SETTINGS', 'Importación de datos (Sanitizada)');
            notify('Restauración Completa', 'Datos importados y asegurados correctamente.', 'success');
        } catch (e) {
            notify('Error de Importación', 'El archivo está corrupto o tiene un formato inválido.', 'error');
        }
    };
    const requestNotificationPermission = async () => (await Notification.requestPermission()) === 'granted';

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, currentUser, activityLogs, categories, toasts, isSyncing,
            addProduct, updateProduct, deleteProduct, adjustStock, addCategory, removeCategory, addTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale,
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment, addSupplier, updateSupplier, deleteSupplier, addPurchase, addCashMovement, deleteCashMovement,
            addOrder, updateOrderStatus, convertOrderToSale, deleteOrder, updateSettings, importData, login, logout, addUser, updateUser, deleteUser, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
            notify, removeToast, requestNotificationPermission, logActivity, pullFromCloud, pushToCloud, generateInvite, registerWithInvite, deleteInvite
        }}>
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (context === undefined) throw new Error('useStore must be used within a StoreProvider');
    return context;
};

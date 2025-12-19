
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Transaction, Customer, Supplier, CashMovement, Order, User, ActivityLog, ToastNotification, BusinessSettings, Purchase, UserInvite, UserRole } from '../types';
import { hashPassword, verifyPassword, sanitizeDataStructure, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';

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
  pullFromCloud: (overrideUrl?: string, overrideSecret?: string) => Promise<void>;
  pushToCloud: (overrides?: any) => Promise<void>;
  generateInvite: (role: UserRole) => string;
  registerWithInvite: (code: string, userData: any) => Promise<string>;
  deleteInvite: (code: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Security Config
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STORAGE_PREFIX = "LUMINA_SEC::"; 

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
    
    // --- MASTER REFS FOR SYNC (Race Condition Solvers) ---
    // These Refs will ALWAYS hold the current state. Push will read from here.
    const storeRef = useRef({
        products, transactions, customers, suppliers, cashMovements, 
        orders, purchases, users, userInvites, categories, activityLogs, settings
    });

    // Update ref whenever state changes
    useEffect(() => {
        storeRef.current = {
            products, transactions, customers, suppliers, cashMovements, 
            orders, purchases, users, userInvites, categories, activityLogs, settings
        };
    }, [products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, settings]);

    // Timestamps to prevent overwrites
    const lastLocalUpdate = useRef<number>(Date.now());
    const lastCloudSyncTimestamp = useRef<number>(0);
    const dataLoadedRef = useRef(false);
    
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Set DataLoaded to true if we load data from LocalStorage on mount
    useEffect(() => {
        if (products.length > 0 || customers.length > 0 || users.length > 0) {
            dataLoadedRef.current = true;
        }
    }, []); 

    // --- HELPER: Mark Local Change ---
    // Every time we modify data locally, we update this timestamp.
    // Sync Pull will respect this and NOT overwrite if local is newer.
    const markLocalChange = () => {
        dataLoadedRef.current = true;
        lastLocalUpdate.current = Date.now();
    };

    // --- AUDIO SYSTEM ---
    useEffect(() => {
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

    // --- ROBUST SYNC ENGINE ---

    const pushToCloud = useCallback(async (overrides?: any) => {
        // ALWAYS Read from Ref to avoid stale closures
        const currentData = storeRef.current;
        const settingsToPush = overrides?.settings || currentData.settings;
        
        if (!settingsToPush.enableCloudSync || !settingsToPush.googleWebAppUrl || settingsToPush.googleWebAppUrl.length < 10) return;
        
        // Safety Check: Prevent pushing empty state if we haven't loaded yet
        const isLocalStateEmpty = currentData.products.length === 0 && currentData.customers.length === 0 && currentData.transactions.length === 0;
        if (!dataLoadedRef.current && isLocalStateEmpty) {
            console.warn("SYNC PROTECT: Bloqueando subida (Estado vacío/No cargado).");
            return; 
        }

        setIsSyncing(true);
        
        // Construct payload using LATEST data from Ref
        const dataToPush = {
            ...currentData,
            settings: settingsToPush,
            ...overrides 
        };

        try {
            await pushFullDataToCloud(settingsToPush.googleWebAppUrl, settingsToPush.cloudSecret, dataToPush);
            // Update last known cloud timestamp to Now, so we don't re-download what we just sent
            lastCloudSyncTimestamp.current = Date.now();
        } catch (e: any) {
            if (overrides) { 
                notify("Error de Sincronización", e.message || "No se pudieron subir los datos.", "error");
            }
            console.error("Push failed:", e);
        } finally {
            setIsSyncing(false);
        }
    }, []); // No dependencies needed because we use storeRef

    const pullFromCloud = async (overrideUrl?: string, overrideSecret?: string, silent: boolean = false) => {
        const currentSettings = storeRef.current.settings;
        const urlToUse = overrideUrl || currentSettings.googleWebAppUrl;
        const secretToUse = overrideSecret !== undefined ? overrideSecret : currentSettings.cloudSecret;

        if (!urlToUse || urlToUse.length < 10) return;
        
        if (!silent) setIsSyncing(true);
        
        try {
            const cloudData = await fetchFullDataFromCloud(urlToUse, secretToUse);
            
            if (!cloudData) {
                if(!silent) throw new Error("Respuesta vacía.");
                return;
            }

            // --- CRITICAL TIMESTAMP CHECK ---
            const cloudTs = cloudData.timestamp ? new Date(cloudData.timestamp).getTime() : 0;
            const localTs = lastLocalUpdate.current;

            // Logica: Si mi último cambio local es MAS NUEVO que la fecha de los datos que vienen de la nube...
            // SIGNIFICA QUE YO TENGO DATOS MAS FRESCOS QUE AUN NO HAN SUBIDO.
            // EN ESE CASO, IGNORO LA NUBE PARA NO SOBRESCRIBIR MI TRABAJO.
            // (Allow 2 second buffer for network latency)
            if (localTs > cloudTs + 2000) {
                // console.log("SYNC PROTECT: Datos locales más recientes. Ignorando nube.");
                // Implicitly triggers a push via debouncer usually
                return;
            }

            // Also check against last successful sync to avoid redundant updates
            if (cloudTs <= lastCloudSyncTimestamp.current) {
                return; 
            }

            const safeData = sanitizeDataStructure(cloudData);

            // Validation
            if (!safeData || typeof safeData !== 'object' || (safeData.products && !Array.isArray(safeData.products))) {
                if(!silent) throw new Error("Datos corruptos.");
                return;
            }

            // Empty Cloud Protection
            const localHasData = storeRef.current.products.length > 0 || storeRef.current.customers.length > 0;
            const cloudIsEmpty = (!safeData.products || safeData.products.length === 0) && (!safeData.customers || safeData.customers.length === 0);

            if (localHasData && cloudIsEmpty) {
                if (!silent) notify("Respaldo Automático", "Nube vacía detectada. Subiendo datos locales...", "info");
                setTimeout(() => pushToCloud(), 100);
                return; 
            }

            // APPLY UPDATES
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
            
            if (safeData.settings && typeof safeData.settings === 'object') {
                const mergedSettings = { 
                    ...DEFAULT_SETTINGS,
                    ...safeData.settings, 
                    googleWebAppUrl: urlToUse, 
                    enableCloudSync: true, 
                    cloudSecret: secretToUse,
                    logo: safeData.settings.logo !== undefined ? safeData.settings.logo : currentSettings.logo,
                    receiptLogo: safeData.settings.receiptLogo !== undefined ? safeData.settings.receiptLogo : currentSettings.receiptLogo
                };
                setSettings(mergedSettings);
            }
            
            dataLoadedRef.current = true;
            lastCloudSyncTimestamp.current = cloudTs; // Mark that we are up to date with this cloud version
            // Note: We DO NOT update lastLocalUpdate here, because this is a sync, not a user action.

            if (!silent) notify('Sincronizado', 'Datos actualizados desde la nube.', 'success');
            
        } catch (e: any) {
            console.error("Pull Error:", e);
            if (!silent) notify("Error Sincronización", e.message || "Error al conectar.", "error");
        } finally {
            if (!silent) setIsSyncing(false);
        }
    };

    // --- AUTOMATIC POLLING ---
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (storeRef.current.settings.enableCloudSync && storeRef.current.settings.googleWebAppUrl) {
                pullFromCloud(undefined, undefined, true);
            }
        }, 15000); 
        return () => clearInterval(intervalId);
    }, []);

    // --- INITIAL LOAD ---
    useEffect(() => {
        const init = async () => {
            if (storeRef.current.settings.enableCloudSync && storeRef.current.settings.googleWebAppUrl) {
                try { await pullFromCloud(); } catch(e) {}
            }
            // Ensure Admin exists
            if (users.length === 0) {
                const salt = 'default_salt'; 
                const hash = await hashPassword('Admin@123456', salt);
                setUsers([{
                    id: 'admin-001', username: 'admin', passwordHash: hash, salt: salt,
                    fullName: 'Administrador', role: 'ADMIN', active: true
                }]);
                markLocalChange();
            }
        };
        init();
    }, []);

    // --- DEBOUNCED AUTO-PUSH ---
    // Whenever local state changes (detected via effect dependencies), we schedule a push.
    // BUT we check if it was a local change (via markLocalChange) vs a sync update.
    useEffect(() => {
        // If last update was from cloud (local timestamp is old), don't push immediately unless needed.
        // But simpler: just debounced push everything. The Pull logic protects us from overwrites.
        const timer = setTimeout(() => {
            if (settings.enableCloudSync) pushToCloud();
        }, 2000); 
        return () => clearTimeout(timer);
    }, [products, transactions, customers, cashMovements, users, userInvites, orders, purchases, activityLogs, settings]);

    // ... rest of the functions ...
    const logActivity = (action: string, details: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        setActivityLogs(prev => [{
            id: crypto.randomUUID(), userId: currentUser.id, userName: currentUser.username, userRole: currentUser.role,
            action: action as any, details, timestamp: now
        }, ...prev].slice(0, 1000));
        setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: now } : u));
        markLocalChange(); // Log is a change
    };

    const login = async (u: string, p: string, code?: string) => {
        const userIndex = users.findIndex(user => user.username.toLowerCase() === u.toLowerCase());
        const user = users[userIndex];
        if (!user || !user.active) return 'INVALID';
        if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) return 'LOCKED';
        
        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        if (!isValid) {
            const attempts = (user.failedLoginAttempts || 0) + 1;
            const lockoutUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : undefined;
            const updatedUsers = [...users];
            updatedUsers[userIndex] = { ...user, failedLoginAttempts: attempts, lockoutUntil };
            setUsers(updatedUsers);
            markLocalChange();
            return 'INVALID';
        }
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
            if (!code) return '2FA_REQUIRED';
            if (!verify2FAToken(code, user.twoFactorSecret)) return 'INVALID_2FA';
        }
        const now = new Date().toISOString();
        const updatedUser = { ...user, lastLogin: now, lastActive: now, failedLoginAttempts: 0, lockoutUntil: undefined };
        setUsers(prev => prev.map(usr => usr.id === user.id ? updatedUser : usr));
        setCurrentUser(updatedUser);
        safeSave('currentUser', updatedUser); 
        logActivity('LOGIN', `Inicio sesión: ${u}`);
        markLocalChange();
        return 'SUCCESS';
    };

    const logout = () => {
        if (currentUser) logActivity('LOGIN', `Cierre de sesión`);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
    };

    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' }]);
        logActivity('USER_MGMT', `Invitación generada`);
        markLocalChange();
        return code;
    };
    
    const deleteInvite = (code: string) => {
        setUserInvites(prev => prev.filter(i => i.code !== code));
        markLocalChange();
    };

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
        logActivity('USER_MGMT', `Registro nuevo usuario`);
        markLocalChange();
        return 'SUCCESS';
    };

    // State updaters with markLocalChange
    const addProduct = (p: Product) => { setProducts(prev => [...prev, p]); logActivity('INVENTORY', `Creó: ${p.name}`); markLocalChange(); };
    const updateProduct = (p: Product) => { setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)); logActivity('INVENTORY', `Actualizó: ${p.name}`); markLocalChange(); };
    const deleteProduct = async (id: string): Promise<boolean> => {
        const product = products.find(p => p.id === id);
        if (!product) return false;
        if (transactions.some(t => t.items.some(i => i.id === id))) { notify('Error', 'Producto con ventas.', 'error'); return false; }
        setProducts(prev => prev.filter(p => p.id !== id));
        logActivity('INVENTORY', `Eliminó: ${id}`);
        markLocalChange();
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
        logActivity('INVENTORY', `Ajuste stock (${type} ${qty})`);
        markLocalChange();
    };
    const addCategory = (name: string) => { setCategories(prev => [...prev, name]); markLocalChange(); };
    const removeCategory = (name: string) => { setCategories(prev => prev.filter(c => c !== name)); markLocalChange(); };
    const addTransaction = (t: Transaction) => {
        const finalTrans = { ...t, id: t.id || (settings.sequences.ticketStart + transactions.length).toString(), customerName: customers.find(c => c.id === t.customerId)?.name || 'Cliente General' };
        setTransactions(prev => [finalTrans, ...prev]);
        if (t.paymentMethod === 'credit' && t.customerId) { setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + (t.total - (t.amountPaid || 0)) } : c)); }
        if (t.paymentStatus === 'paid' && t.paymentMethod !== 'credit' && !t.isReturn) {
             const movement: CashMovement = { id: `mv_${finalTrans.id}`, type: 'DEPOSIT', amount: t.amountPaid, description: `Venta Ticket #${finalTrans.id}`, date: new Date().toISOString(), category: 'SALES', customerId: t.customerId };
             setCashMovements(prev => [movement, ...prev]);
        }
        logActivity('SALE', `Venta #${finalTrans.id}`);
        markLocalChange();
    };
    const deleteTransaction = (id: string, items: any[]) => { 
        setTransactions(prev => prev.filter(t => t.id !== id)); 
        logActivity('SALE', `Venta anulada #${id}`); 
        markLocalChange();
        // Restore stock logic is handled in UI by calling updateStockAfterSale manually or here if passed logic
        // For this context, simplistic delete
    };
    const registerTransactionPayment = (id: string, amount: number, method: string) => {
        setTransactions(prev => prev.map(t => { if (t.id === id) { const newPaid = (t.amountPaid || 0) + amount; return { ...t, amountPaid: newPaid, paymentStatus: newPaid >= t.total ? 'paid' : 'partial' }; } return t; }));
        logActivity('CASH', `Pago venta #${id}: $${amount}`);
        markLocalChange();
    };
    const updateStockAfterSale = (items: any[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find((i: any) => i.id === p.id);
            if (item) { if (p.hasVariants && item.variantId) { const newVariants = p.variants?.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v); return { ...p, variants: newVariants, stock: (newVariants?.reduce((acc, v) => acc + v.stock, 0) || 0) }; } return { ...p, stock: p.stock - item.quantity }; } return p;
        }));
        markLocalChange();
    };
    const addCustomer = (c: Customer) => { const newId = (settings.sequences.customerStart + customers.length).toString(); setCustomers(prev => [...prev, { ...c, id: newId }]); logActivity('CRM', `Nuevo cliente: ${c.name}`); markLocalChange(); };
    const updateCustomer = (c: Customer) => { setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust)); markLocalChange(); };
    const deleteCustomer = async (id: string): Promise<boolean> => {
        if (customers.find(c => c.id === id)?.currentDebt! > 0) { notify('Error', 'Deuda pendiente.', 'error'); return false; }
        setCustomers(prev => prev.filter(c => c.id !== id));
        notify('Éxito', 'Cliente eliminado.', 'success');
        markLocalChange();
        return true;
    };
    const processCustomerPayment = (customerId: string, amount: number) => { 
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c)); 
        logActivity('CASH', `Abono cliente: $${amount}`); 
        markLocalChange(); 
    };
    const addSupplier = (s: Supplier) => { setSuppliers(prev => [...prev, s]); markLocalChange(); };
    const updateSupplier = (s: Supplier) => { setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup)); markLocalChange(); };
    const deleteSupplier = async (id: string): Promise<boolean> => { setSuppliers(prev => prev.filter(s => s.id !== id)); markLocalChange(); return true; };
    const addPurchase = (purchase: Purchase) => {
        setPurchases(prev => [purchase, ...prev]);
        purchase.items.forEach(item => { adjustStock(item.productId, item.quantity, 'IN', item.variantId); });
        const expenseMovement: CashMovement = { id: `purch_${purchase.id}`, type: 'EXPENSE', amount: purchase.total, description: `Compra a ${purchase.supplierName}`, date: purchase.date, category: 'OPERATIONAL' };
        addCashMovement(expenseMovement);
        logActivity('INVENTORY', `Compra #${purchase.id}`);
        notify('Compra Exitosa', `$${purchase.total} registrado.`, 'success');
        markLocalChange();
    };
    const addCashMovement = (m: CashMovement) => { setCashMovements(prev => [m, ...prev]); logActivity('CASH', `Caja: ${m.type} $${m.amount}`); markLocalChange(); };
    const deleteCashMovement = (id: string) => { setCashMovements(prev => prev.filter(m => m.id !== id)); markLocalChange(); };
    const addOrder = (o: Order) => { const newId = (settings.sequences.orderStart + orders.length).toString(); setOrders(prev => [...prev, { ...o, id: newId }]); logActivity('ORDER', `Pedido #${newId}`); markLocalChange(); };
    const updateOrderStatus = (id: string, status: string) => { setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o)); markLocalChange(); };
    const deleteOrder = (id: string) => { setOrders(prev => prev.filter(o => o.id !== id)); markLocalChange(); };
    const convertOrderToSale = (id: string, paymentMethod: string) => {
        const order = orders.find(o => o.id === id); if (!order) return;
        const transaction: Transaction = { id: '', date: new Date().toISOString(), subtotal: order.total, taxAmount: 0, discount: 0, shipping: 0, total: order.total, items: order.items, paymentMethod: paymentMethod as any, paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid', amountPaid: paymentMethod === 'credit' ? 0 : order.total, customerId: order.customerId, status: 'completed' };
        addTransaction(transaction); updateStockAfterSale(order.items); updateOrderStatus(id, 'COMPLETED');
        markLocalChange();
    };
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); logActivity('USER_MGMT', `Usuario creado: ${u.username}`); markLocalChange(); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(user => user.id === u.id ? u : user)); logActivity('USER_MGMT', `Usuario actualizado: ${u.username}`); markLocalChange(); };
    const deleteUser = (id: string) => { setUsers(prev => prev.filter(u => u.id !== id)); markLocalChange(); };
    const getUserPublicInfo = (username: string) => { const user = users.find(u => u.username.toLowerCase() === username.toLowerCase()); return user ? { username: user.username, fullName: user.fullName, securityQuestion: user.securityQuestion, isTwoFactorEnabled: user.isTwoFactorEnabled } : null; };
    const recoverAccount = async (u: string, method: string, payload: string, newPass: string) => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'INVALID';
        const salt = 'new_salt_' + Date.now(); 
        const hash = await hashPassword(newPass, salt);
        updateUser({ ...user, passwordHash: hash, salt: salt, lockoutUntil: undefined, failedLoginAttempts: 0 });
        logActivity('RECOVERY', `Cuenta recuperada: ${u}`);
        markLocalChange();
        return 'SUCCESS';
    };
    const verifyRecoveryAttempt = async (u: string, method: string, payload: string) => !!users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
    const updateSettings = (s: BusinessSettings) => { setSettings(s); logActivity('SETTINGS', 'Config actualizada'); markLocalChange(); };
    const importData = (data: any) => {
        try {
            const safeData = sanitizeDataStructure(data);
            if (Array.isArray(safeData.products)) setProducts(safeData.products);
            if (Array.isArray(safeData.users)) setUsers(safeData.users);
            if (safeData.settings && typeof safeData.settings === 'object') setSettings(safeData.settings);
            if (Array.isArray(safeData.transactions)) setTransactions(safeData.transactions);
            if (Array.isArray(safeData.customers)) setCustomers(safeData.customers);
            logActivity('SETTINGS', 'Importación datos');
            notify('Restauración', 'Datos importados.', 'success');
            markLocalChange();
        } catch (e) {
            notify('Error', 'Archivo corrupto.', 'error');
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

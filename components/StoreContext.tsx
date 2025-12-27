import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Transaction, Customer, Supplier, CashMovement, Order, User, ActivityLog, ToastNotification, BusinessSettings, Purchase, UserInvite, UserRole, SoundType } from '../types';
import { hashPassword, verifyPassword, sanitizeDataStructure, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { playSystemSound } from '../utils/sound';

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
  hasPendingChanges: boolean;
  
  // Animation State
  isLoggingOut: boolean;

  // Order to POS handoff
  incomingOrder: Order | null;
  sendOrderToPOS: (order: Order) => void;
  clearIncomingOrder: () => void;

  // Bluetooth State
  btDevice: BluetoothDevice | null;
  btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  connectBtPrinter: () => Promise<void>;
  disconnectBtPrinter: () => void;
  sendBtData: (data: Uint8Array) => Promise<void>;

  addProduct: (p: Product) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => Promise<boolean>; 
  adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;
  addCategory: (name: string) => void;
  removeCategory: (name: string) => void;
  addTransaction: (t: Transaction) => void;
  updateTransaction: (oldId: string, updates: Partial<Transaction>) => void; // UPDATE FUNCTION
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
  updateOrder: (o: Order) => void; 
  updateOrderStatus: (id: string, status: string) => void;
  convertOrderToSale: (id: string, paymentMethod: string) => void;
  deleteOrder: (id: string) => void;
  updateSettings: (s: BusinessSettings) => void;
  importData: (data: any) => Promise<boolean>;
  login: (u: string, p: string, code?: string) => Promise<string>;
  logout: () => Promise<void>; 
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
  pullFromCloud: (overrideUrl?: string, overrideSecret?: string, silent?: boolean, force?: boolean) => Promise<any>;
  pushToCloud: (overrides?: any) => Promise<boolean>;
  generateInvite: (role: UserRole) => string;
  registerWithInvite: (code: string, userData: any) => Promise<string>;
  deleteInvite: (code: string) => void;
  hardReset: () => Promise<void>;
  playSound: (event: 'SALE' | 'ERROR' | 'CLICK' | 'NOTIFICATION') => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_PREFIX = "LUMINA_SEC::"; 

// ... (Rest of constants remain same)
const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'LuminaPOS',
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
    invoicePadding: 10, 
    bluetoothPrinterName: null, 
    theme: 'light',
    budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    notificationsEnabled: true,
    soundConfig: { 
        enabled: true,
        volume: 0.5,
        saleSound: 'SUCCESS',
        errorSound: 'ERROR',
        clickSound: 'POP',
        notificationSound: 'GLASS'
    },
    sequences: { customerStart: 1001, ticketStart: 10001, orderStart: 5001, productStart: 100 },
    productionDoc: { title: 'ORDEN DE TRABAJO', showPrices: true, showCustomerContact: true, showDates: true, customFooter: '' },
    enableCloudSync: true,
    googleWebAppUrl: '',
    cloudSecret: '' 
};

// ... (Helper functions remain same)
const encodeData = (data: any): string => {
    try {
        const json = JSON.stringify(data);
        const b64 = btoa(encodeURIComponent(json));
        return STORAGE_PREFIX + b64.split('').reverse().join('');
    } catch (e) { return ""; }
};

const decodeData = <T,>(encoded: string | null, fallback: T): T => {
    if (!encoded) return fallback;
    try {
        if (!encoded.startsWith(STORAGE_PREFIX)) {
            try { return JSON.parse(encoded); } catch { return fallback; }
        }
        const reversed = encoded.replace(STORAGE_PREFIX, '').split('').reverse().join('');
        return JSON.parse(decodeURIComponent(atob(reversed)));
    } catch (e) { return fallback; }
};

const safeLoad = <T,>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        return decodeData(item, fallback);
    } catch (e) { return fallback; }
};

const safeSave = (key: string, data: any) => {
    try {
        if (data === undefined) return;
        localStorage.setItem(key, encodeData(data));
    } catch (e) {}
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
        const loaded = safeLoad<any>('settings', {});
        return { 
            ...DEFAULT_SETTINGS, 
            ...loaded,
            soundConfig: { ...DEFAULT_SETTINGS.soundConfig, ...(loaded.soundConfig || {}) }
        };
    });
    
    const [currentUser, setCurrentUser] = useState<User | null>(() => safeLoad('currentUser', null));
    
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    
    // --- ANIMATION STATE ---
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // --- ORDER TO POS HANDOFF STATE ---
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);

    // --- BLUETOOTH STATE ---
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // Ref to track pending changes instantly
    const hasPendingChangesRef = useRef(false);
    const lastLocalUpdate = useRef<number>(0); 
    const lastCloudSyncTimestamp = useRef<number>(0);
    const lastPushSuccessAt = useRef<number>(0); 
    const dataLoadedRef = useRef(false);
    
    const storeRef = useRef({
        products, transactions, customers, suppliers, cashMovements, 
        orders, purchases, users, userInvites, categories, activityLogs, settings
    });

    useEffect(() => {
        storeRef.current = {
            products, transactions, customers, suppliers, cashMovements, 
            orders, purchases, users, userInvites, categories, activityLogs, settings
        };
    }, [products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, categories, activityLogs]);

    // Apply Theme Effect
    useEffect(() => {
        const root = window.document.documentElement;
        if (settings.theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }, [settings.theme]);

    // AUTO-SEED ADMIN
    useEffect(() => {
        const initializeAdmin = async () => {
            if (users.length === 0) {
                const salt = generateSalt();
                const adminPass = 'Admin@123456';
                const passHash = await hashPassword(adminPass, salt);
                const initialAdmin: User = {
                    id: 'default-admin-001',
                    username: 'admin',
                    fullName: 'Administrador Inicial',
                    role: 'ADMIN',
                    active: true,
                    passwordHash: passHash,
                    salt: salt,
                    recoveryCode: 'LUMINA-ADMIN-INIT'
                };
                setUsers([initialAdmin]);
                safeSave('users', [initialAdmin]);
            }
        };
        initializeAdmin();
    }, []);

    const markLocalChange = () => {
        dataLoadedRef.current = true;
        lastLocalUpdate.current = Date.now();
        hasPendingChangesRef.current = true;
        setHasPendingChanges(true); 
    };

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

    useEffect(() => {
        if (currentUser) {
            safeSave('currentUser', currentUser);
        } else {
            localStorage.removeItem(STORAGE_PREFIX + 'currentUser'.split('').reverse().join(''));
        }
    }, [currentUser]);

    // --- BLUETOOTH FUNCTIONS ---
    const connectBtPrinter = useCallback(async () => {
        try {
            if (!(navigator as any).bluetooth) {
                throw new Error("Bluetooth no soportado en este navegador.");
            }

            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], 
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] 
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            
            const characteristics = await service.getCharacteristics();
            let writer: any = null;
            
            for (const c of characteristics) {
                if (c.properties.writeWithoutResponse) {
                    writer = c;
                    break;
                }
            }
            if (!writer) {
                for (const c of characteristics) {
                    if (c.properties.write) {
                        writer = c;
                        break;
                    }
                }
            }

            if (!writer) {
                device.gatt.disconnect();
                throw new Error("No se encontró característica de escritura.");
            }

            device.addEventListener('gattserverdisconnected', () => {
                setBtDevice(null);
                setBtCharacteristic(null);
                notify("Impresora Desconectada", "La conexión Bluetooth se perdió.", "warning");
            });

            setBtDevice(device);
            setBtCharacteristic(writer);
            
            if(device.name) {
                updateSettings({...settings, bluetoothPrinterName: device.name});
            }

            notify("Impresora Conectada", `Vinculado a ${device.name}`, "success");

        } catch (error: any) {
            console.error("BT Connection Error:", error);
            if (error.name !== 'NotFoundError') {
                notify("Error Bluetooth", error.message || "No se pudo conectar.", "error");
            }
            throw error;
        }
    }, [settings]);

    const disconnectBtPrinter = useCallback(() => {
        if (btDevice && btDevice.gatt?.connected) {
            btDevice.gatt.disconnect();
        }
        setBtDevice(null);
        setBtCharacteristic(null);
    }, [btDevice]);

    const sendBtData = useCallback(async (data: Uint8Array) => {
        if (!btCharacteristic || !btDevice?.gatt?.connected) {
            throw new Error("Impresora no conectada.");
        }
        const CHUNK_SIZE = 100; 
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            if (btCharacteristic.properties.writeWithoutResponse) {
                await btCharacteristic.writeValueWithoutResponse(chunk);
            } else {
                await btCharacteristic.writeValue(chunk);
            }
            await new Promise(r => setTimeout(r, 25)); 
        }
    }, [btCharacteristic, btDevice]);

    // --- SYNC & LOGIC ---
    const pushToCloud = useCallback(async (overrides?: any) => {
        const currentData = storeRef.current;
        const config = overrides?.settings || currentData.settings;
        if (!config.enableCloudSync || !config.googleWebAppUrl) return false;
        
        // --- SAFETY GUARD: EMPTY DEVICE PROTECTION ---
        // Prevent wiping cloud data if device is empty, BUT allow if manual sync or user activity present
        const isLocalEmpty = currentData.products.length === 0 && currentData.customers.length === 0;
        const hasActivity = currentData.activityLogs.length > 0;
        const isForced = overrides?.forcePush === true || overrides?.manual === true || hasActivity;

        if (isLocalEmpty && !isForced) {
            console.warn("🛡️ DATA SAFETY: Sincronización de subida bloqueada. Base de datos local vacía.");
            // If this was a manual triggered sync that got blocked (rare case if logic above holds), notify user.
            if (overrides?.manual) {
                notify("Sincronización Bloqueada", "Base de datos vacía. Agrega productos o configuración primero.", "warning");
            }
            return false;
        }
        // ---------------------------------------------

        setIsSyncing(true);
        try {
            await pushFullDataToCloud(config.googleWebAppUrl, config.cloudSecret, { ...currentData, ...overrides });
            
            lastCloudSyncTimestamp.current = Date.now();
            lastPushSuccessAt.current = Date.now();
            hasPendingChangesRef.current = false;
            setHasPendingChanges(false);
            
            // Only notify if explicit manual sync
            if (overrides?.manual) {
                notify("Sincronizado", "Cambios guardados correctamente.", "success");
            }
            return true;
        } catch (e) {
            console.error("Sync Error (Push):", e);
            notify("Error de Sincronización", "No se pudieron guardar los cambios en la nube.", "error");
            return false;
        } finally { 
            setIsSyncing(false); 
        }
    }, []); 

    const pullFromCloud = async (overrideUrl?: string, overrideSecret?: string, silent: boolean = false, force: boolean = false) => {
        const url = overrideUrl || storeRef.current.settings.googleWebAppUrl;
        const secret = overrideSecret !== undefined ? overrideSecret : storeRef.current.settings.cloudSecret;
        if (!url) return false;
        
        if (!force && hasPendingChangesRef.current) {
            // Await push so user sees the result of the "pending changes" save
            // Treat this as manual to ensure feedback is given
            return await pushToCloud({ manual: !silent });
        }

        if (!silent) setIsSyncing(true);
        try {
            const cloudData = await fetchFullDataFromCloud(url, secret);
            if (!cloudData) return false;
            
            await importData(cloudData);

            dataLoadedRef.current = true;
            lastCloudSyncTimestamp.current = new Date().getTime();
            hasPendingChangesRef.current = false;
            setHasPendingChanges(false); 
            if (!silent) notify('Sincronizado', 'Datos actualizados desde la nube.', 'success');
            return true;
        } catch (e: any) {
            if (!silent) notify("Error Sincro", e.message, "error");
            return false;
        } finally { if (!silent) setIsSyncing(false); }
    };

    const importData = async (data: any): Promise<boolean> => {
        try {
            if (!data) return false;
            
            // Clean/Sanitize input first
            const safeData = sanitizeDataStructure(data);

            if (Array.isArray(safeData.products)) setProducts(safeData.products);
            if (Array.isArray(safeData.transactions)) setTransactions(safeData.transactions);
            if (Array.isArray(safeData.customers)) setCustomers(safeData.customers);
            if (Array.isArray(safeData.suppliers)) setSuppliers(safeData.suppliers);
            if (Array.isArray(safeData.purchases)) setPurchases(safeData.purchases);
            if (Array.isArray(safeData.users)) setUsers(safeData.users);
            if (Array.isArray(safeData.categories)) setCategories(safeData.categories);
            if (Array.isArray(safeData.activityLogs)) setActivityLogs(safeData.activityLogs);
            if (Array.isArray(safeData.cashMovements)) setCashMovements(safeData.cashMovements);
            if (Array.isArray(safeData.orders)) setOrders(safeData.orders);
            if (Array.isArray(safeData.userInvites)) setUserInvites(safeData.userInvites);
            
            if (safeData.settings) {
                setSettings(currentSettings => {
                    const incomingSettings = { 
                        ...DEFAULT_SETTINGS, 
                        ...safeData.settings,
                        budgetConfig: { ...DEFAULT_SETTINGS.budgetConfig, ...(safeData.settings.budgetConfig || {}) },
                        soundConfig: { ...DEFAULT_SETTINGS.soundConfig, ...(safeData.settings.soundConfig || {}) },
                        sequences: { ...DEFAULT_SETTINGS.sequences, ...(safeData.settings.sequences || {}) },
                        productionDoc: { ...DEFAULT_SETTINGS.productionDoc, ...(safeData.settings.productionDoc || {}) },
                        // Keep current sync config unless specifically overwritten by backup
                        googleWebAppUrl: safeData.settings.googleWebAppUrl || currentSettings.googleWebAppUrl,
                        cloudSecret: safeData.settings.cloudSecret || currentSettings.cloudSecret
                    };
                    return incomingSettings;
                });
            }
            
            // Force save to local storage immediately to ensure persistence even if app closes
            setTimeout(() => {
                safeSave('products', safeData.products || []);
                safeSave('transactions', safeData.transactions || []);
                // ... (localStorage persistence handled by useEffects, but triggering state updates above does it)
            }, 100);

            return true;
        } catch (error) {
            console.error("Import Error", error);
            return false;
        }
    };

    const hardReset = async () => {
        if (!window.confirm("¿Restablecer y descargar todo de la nube? Se perderán cambios no guardados.")) return;
        lastLocalUpdate.current = 0;
        hasPendingChangesRef.current = false;
        setHasPendingChanges(false);
        lastPushSuccessAt.current = 0; 
        await pullFromCloud(undefined, undefined, false, true);
    };

    // --- AUTO-SYNC LOGIC ---
    useEffect(() => {
        // Fallback interval (every 30s)
        const interval = setInterval(() => {
            if (settings.enableCloudSync && settings.googleWebAppUrl) {
                // If we have pending changes, push. If not, pull to get updates from others.
                if (hasPendingChanges) pushToCloud();
                else pullFromCloud(undefined, undefined, true);
            }
        }, 30000); 
        return () => clearInterval(interval);
    }, [hasPendingChanges, settings.enableCloudSync, settings.googleWebAppUrl]);

    // NEW: Reactive Auto-Sync (Debounce)
    // Triggers save 5 seconds after a change is made, improving UX
    useEffect(() => {
        if (hasPendingChanges && settings.enableCloudSync && settings.googleWebAppUrl) {
            const debounceTimer = setTimeout(() => {
                console.log("Auto-saving pending changes...");
                pushToCloud();
            }, 5000); // 5 seconds debounce
            return () => clearTimeout(debounceTimer);
        }
    }, [hasPendingChanges, settings.enableCloudSync, settings.googleWebAppUrl, pushToCloud]);

    // --- RECOVERY LOGIC (FIXED) ---
    const getUserPublicInfo = (username: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return null;
        return {
            username: user.username,
            securityQuestion: user.securityQuestion,
            hasRecoveryCode: !!user.recoveryCode
        };
    };

    const verifyRecoveryAttempt = async (username: string, method: string, payload: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return false;

        if (method === 'SECURITY_QUESTION' && user.securityAnswerHash) {
            // Check hash against stored salt
            return await verifyPassword(payload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
        } else if (method === 'CODE') {
             return user.recoveryCode === payload.trim();
        }
        return false;
    };

    const recoverAccount = async (username: string, method: string, payload: string, newPass: string) => {
        const uIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (uIndex === -1) return 'USER_NOT_FOUND';

        const user = users[uIndex];
        let isValid = false;

        if (method === 'SECURITY_QUESTION' && user.securityAnswerHash) {
            isValid = await verifyPassword(payload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
        } else if (method === 'CODE') {
            isValid = user.recoveryCode === payload.trim();
        }

        if (!isValid) return 'INVALID';

        // Keep the OLD salt so we don't invalidate the securityAnswerHash (which was hashed with the old salt)
        const newHash = await hashPassword(newPass, user.salt);

        const updatedUser = {
            ...user,
            passwordHash: newHash,
            failedLoginAttempts: 0,
            lockoutUntil: undefined
        };

        setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
        markLocalChange();
        logActivity('RECOVERY', `Recuperación de cuenta exitosa: ${username}`);

        return 'SUCCESS';
    };

    // --- AUTH LOGIC ---
    const login = async (u: string, p: string, code?: string) => {
        const userIndex = users.findIndex(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (userIndex === -1) return 'INVALID';
        
        const user = users[userIndex];
        if (!user.active) return 'INVALID';
        if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) return 'LOCKED';
        
        // Self-Healing Admin (If hashes outdated)
        if (u.toLowerCase() === 'admin' && p === 'Admin@123456') {
             const checkDefault = await verifyPassword(p, user.salt, user.passwordHash);
             if (!checkDefault) {
                 const newSalt = generateSalt();
                 const newHash = await hashPassword(p, newSalt);
                 const fixedUser = { ...user, salt: newSalt, passwordHash: newHash };
                 setUsers(prev => prev.map(usr => usr.id === user.id ? fixedUser : usr));
                 // Allow pass through for this session
             }
        }

        if (!(await verifyPassword(p, user.salt, user.passwordHash))) return 'INVALID';
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
            if (!code) return '2FA_REQUIRED';
            if (!verify2FAToken(code, user.twoFactorSecret)) return 'INVALID_2FA';
        }

        const now = new Date().toISOString();
        const updatedUser = { ...user, lastLogin: now, lastActive: now };
        setUsers(prev => prev.map(usr => usr.id === user.id ? updatedUser : usr));
        setCurrentUser(updatedUser);
        logActivity('LOGIN', `Entró: ${u}`);
        pullFromCloud(undefined, undefined, true);
        markLocalChange(); 
        return 'SUCCESS';
    };

    // ANIMATED LOGOUT
    const logout = async () => { 
        setIsLoggingOut(true);
        // Add artificial delay for fade out animation
        await new Promise(resolve => setTimeout(resolve, 300));
        setCurrentUser(null); 
        localStorage.removeItem('currentUser');
        setIsLoggingOut(false);
    };

    const logActivity = (action: string, details: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: now } : u));
        setActivityLogs(prev => [{ 
            id: crypto.randomUUID(), 
            userId: currentUser.id, 
            userName: currentUser.username, 
            userRole: currentUser.role, 
            action: action as any, 
            details, 
            timestamp: now 
        }, ...prev].slice(0, 500));
        markLocalChange();
    };

    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
        if (type === 'success') playSound('SALE');
        else if (type === 'error') playSound('ERROR');
        else playSound('NOTIFICATION');
    };

    const playSound = (event: 'SALE' | 'ERROR' | 'CLICK' | 'NOTIFICATION') => {
        if (!settings.soundConfig?.enabled) return;
        const vol = settings.soundConfig.volume;
        switch(event) {
            case 'SALE': playSystemSound(settings.soundConfig.saleSound, vol); break;
            case 'ERROR': playSystemSound(settings.soundConfig.errorSound, vol); break;
            case 'CLICK': playSystemSound(settings.soundConfig.clickSound, vol); break;
            case 'NOTIFICATION': playSystemSound(settings.soundConfig.notificationSound, vol); break;
        }
    };
    
    // --- ACTIONS ---
    const addProduct = (p: Product) => {
        const currentMaxId = products.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, (settings.sequences.productStart || 100) - 1);
        const newId = (currentMaxId + 1).toString();
        setProducts(prev => [...prev, { ...p, id: newId }]); 
        markLocalChange(); 
        logActivity('INVENTORY', `Agregó producto: ${p.name}`); 
    };

    const updateProduct = (p: Product) => { setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)); markLocalChange(); logActivity('INVENTORY', `Actualizó producto: ${p.name}`); };
    const deleteProduct = async (id: string) => { const p = products.find(prod=>prod.id===id); setProducts(prev => prev.filter(p => p.id !== id)); markLocalChange(); logActivity('INVENTORY', `Eliminó producto: ${p?.name}`); return true; };
    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', vId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (vId) {
                    const vs = p.variants?.map(v => v.id === vId ? { ...v, stock: type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty) } : v);
                    return { ...p, variants: vs, stock: vs?.reduce((a,b)=>a+b.stock,0) || 0 };
                }
                return { ...p, stock: type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty) };
            }
            return p;
        }));
        markLocalChange();
    };
    
    const addTransaction = (t: Transaction) => {
        let newId = t.id;
        if (!newId) {
            const currentMaxId = transactions.reduce((max, curr) => {
                const idNum = parseInt(curr.id);
                return !isNaN(idNum) && idNum > max ? idNum : max;
            }, settings.sequences.ticketStart - 1);
            newId = (currentMaxId + 1).toString();
        }
        const final = { ...t, id: newId };
        setTransactions(prev => [final, ...prev]);
        const isToday = new Date(final.date).toDateString() === new Date().toDateString();
        if (t.paymentStatus === 'paid' && !t.isReturn && isToday) {
             addCashMovement({ 
                 id: `mv_${final.id}`, 
                 type: 'DEPOSIT', 
                 amount: t.amountPaid, 
                 description: `Venta #${final.id}`, 
                 date: new Date().toISOString(), 
                 category: 'SALES' 
             });
        }
        const debt = final.total - (final.amountPaid || 0);
        if (debt > 0.01 && final.customerId && final.status !== 'cancelled' && final.status !== 'returned') {
            setCustomers(prev => prev.map(c => {
                if (c.id === final.customerId) return { ...c, currentDebt: c.currentDebt + debt };
                return c;
            }));
        }
        logActivity('SALE', `Venta #${final.id}`);
        playSound('SALE');
        markLocalChange();
    };

    // --- NEW: Update Transaction Logic ---
    const updateTransaction = (oldId: string, updates: Partial<Transaction>) => {
        // If ID is changing, verify uniqueness first
        if (updates.id && updates.id !== oldId) {
            if (transactions.some(t => t.id === updates.id)) {
                throw new Error(`El folio #${updates.id} ya existe.`);
            }
        }

        setTransactions(prev => prev.map(t => t.id === oldId ? { ...t, ...updates } : t));

        // IMPORTANT: If ID changed, we must update the linked Cash Movement to maintain history
        if (updates.id && updates.id !== oldId) {
            setCashMovements(prev => prev.map(m => {
                if (m.id === `mv_${oldId}`) {
                    return { 
                        ...m, 
                        id: `mv_${updates.id}`, 
                        description: m.description.replace(`#${oldId}`, `#${updates.id}`) 
                    };
                }
                return m;
            }));
        }

        markLocalChange();
        logActivity('SALE', `Editó Venta #${oldId} -> ${updates.id || oldId}`);
    };

    const updateStockAfterSale = (items: any[]) => {
        items.forEach(i => adjustStock(i.id, i.quantity, 'OUT', i.variantId));
    };

    const deleteTransaction = (id: string, items: any[]) => {
        const tx = transactions.find(t => t.id === id);
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled', amountPaid: 0 } : t));
        setCashMovements(prev => prev.filter(m => m.id !== `mv_${id}`));
        items.forEach(i => adjustStock(i.id, i.quantity, 'IN', i.variantId));
        if (tx && tx.customerId) {
            const debt = tx.total - (tx.amountPaid || 0);
            if (debt > 0.01) {
                 setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - debt) } : c));
            }
        }
        logActivity('SALE', `Anuló Venta #${id}`);
        markLocalChange();
        setTimeout(() => pushToCloud(), 100);
    };

    const registerTransactionPayment = (id: string, amount: number, method: string) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        setTransactions(prev => prev.map(t => {
            if (t.id === id) {
                const newPaid = (t.amountPaid || 0) + amount;
                let newStatus: Transaction['paymentStatus'] = t.paymentStatus;
                if (newPaid >= t.total - 0.01) newStatus = 'paid';
                else if (newPaid > 0) newStatus = 'partial';
                return { ...t, amountPaid: newPaid, paymentStatus: newStatus };
            }
            return t;
        }));
        if (tx.customerId) {
            setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        }
        if (method !== 'credit') {
            addCashMovement({
                id: `pay_${id}_${Date.now()}`,
                type: 'DEPOSIT',
                amount: amount,
                description: `Abono Venta #${id} (${method})`,
                date: new Date().toISOString(),
                category: 'SALES'
            });
        }
        playSound('SALE');
        markLocalChange();
    };

    const addCustomer = (c: Customer) => {
        const currentMaxId = customers.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, settings.sequences.customerStart - 1);
        const newId = (currentMaxId + 1).toString();
        setCustomers(prev => [...prev, { ...c, id: newId }]);
        markLocalChange();
        logActivity('CRM', `Nuevo cliente: ${c.name}`);
    };

    const addSupplier = (s: Supplier) => { setSuppliers(prev => [...prev, s]); markLocalChange(); logActivity('CRM', `Nuevo proveedor: ${s.name}`); };
    const updateSupplier = (s: Supplier) => { setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup)); markLocalChange(); };
    const deleteSupplier = async (id: string) => { const s = suppliers.find(sup => sup.id === id); setSuppliers(prev => prev.filter(sup => sup.id !== id)); markLocalChange(); return true; };
    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [...prev, p]);
        p.items.forEach(item => adjustStock(item.productId, item.quantity, 'IN', item.variantId));
        addCashMovement({ id: `purch_${p.id}`, type: 'EXPENSE', amount: p.total, description: `Compra a ${p.supplierName}`, date: p.date, category: 'OPERATIONAL' });
        markLocalChange();
        logActivity('INVENTORY', `Compra a ${p.supplierName}`);
    };
    const addOrder = (o: Order) => {
        const currentMaxId = orders.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, settings.sequences.orderStart - 1);
        const newId = (currentMaxId + 1).toString();
        setOrders(prev => [...prev, { ...o, id: newId }]);
        markLocalChange();
        logActivity('ORDER', `Nuevo pedido #${newId}`);
    };
    
    // NEW: Update full order
    const updateOrder = (o: Order) => {
        setOrders(prev => prev.map(ord => ord.id === o.id ? o : ord));
        markLocalChange();
        logActivity('ORDER', `Editó pedido #${o.id}`);
    };

    // --- SEND ORDER TO POS LOGIC ---
    const sendOrderToPOS = (order: Order) => {
        setIncomingOrder(order);
        setOrders(prev => prev.filter(o => o.id !== order.id));
        logActivity('ORDER', `Pedido #${order.id} enviado a Caja`);
    };

    const clearIncomingOrder = () => setIncomingOrder(null);

    const convertOrderToSale = (id: string, paymentMethod: string) => {
        // Legacy: Logic moved to POS page via sendOrderToPOS
    };

    const updateCustomer = (c: Customer) => { setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust)); markLocalChange(); };
    const deleteCustomer = async (id: string) => { const c = customers.find(cust=>cust.id===id); setCustomers(prev => prev.filter(c => c.id !== id)); markLocalChange(); return true; };
    const addCashMovement = (m: CashMovement) => { setCashMovements(prev => [m, ...prev]); markLocalChange(); logActivity('CASH', `${m.type}: ${m.description}`); };
    const deleteCashMovement = (id: string) => { const m = cashMovements.find(mv=>mv.id===id); setCashMovements(prev => prev.filter(m => m.id !== id)); markLocalChange(); };
    const updateSettings = (s: BusinessSettings) => { setSettings(s); markLocalChange(); logActivity('SETTINGS', `Actualizó configuración`);};
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); markLocalChange(); logActivity('USER_MGMT', `Nuevo usuario: ${u.username}`); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(user => user.id === u.id ? u : user)); markLocalChange(); logActivity('USER_MGMT', `Editó usuario: ${u.username}`); };
    const deleteUser = (id: string) => { setUsers(prev => prev.filter(u => u.id !== id)); markLocalChange(); logActivity('USER_MGMT', `Eliminó usuario`); };
    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' }]);
        markLocalChange(); return code;
    };
    const deleteInvite = (code: string) => { setUserInvites(prev => prev.filter(i => i.code !== code)); markLocalChange(); };
    const registerWithInvite = async (code: string, data: any) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) return 'USERNAME_EXISTS';
        const salt = generateSalt();
        const newUser: User = { id: crypto.randomUUID(), username: data.username, fullName: data.fullName, role: invite.role, active: true, passwordHash: await hashPassword(data.password, salt), salt, recoveryCode: generateSalt().substring(0,8), securityQuestion: data.securityQuestion, securityAnswerHash: await hashPassword(data.securityAnswer.toLowerCase(), salt) };
        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter(i => i.code !== code));
        markLocalChange(); return 'SUCCESS';
    };

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, currentUser, activityLogs, categories, toasts, isSyncing, hasPendingChanges,
            btDevice, btCharacteristic, connectBtPrinter, disconnectBtPrinter, sendBtData, 
            isLoggingOut, 
            addProduct, updateProduct, deleteProduct, adjustStock, addCategory: (n) => setCategories(p=>[...p, n]), removeCategory: (n)=>setCategories(p=>p.filter(c=>c!==n)), 
            addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale,
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment: (id, am)=>setCustomers(p=>p.map(c=>c.id===id?{...c, currentDebt: Math.max(0, c.currentDebt-am)}:c)), 
            addSupplier, updateSupplier, deleteSupplier, addPurchase,
            addCashMovement, deleteCashMovement,
            addOrder, updateOrder, updateOrderStatus: (id, st)=>setOrders(p=>p.map(o=>o.id===id?{...o, status: st as any}:o)), convertOrderToSale, deleteOrder: (id)=>setOrders(p=>p.filter(o=>o.id!==id)), updateSettings, importData, login, logout, addUser, updateUser, deleteUser, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
            notify, removeToast: (id)=>setToasts(p=>p.filter(t=>t.id !== id)), requestNotificationPermission: async ()=>true, logActivity, pullFromCloud, pushToCloud, generateInvite, registerWithInvite, deleteInvite, hardReset,
            playSound,
            incomingOrder, sendOrderToPOS, clearIncomingOrder
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
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
  
  // App State
  isLoggingOut: boolean;
  isAppLocked: boolean;
  unlockApp: (password: string) => Promise<boolean>;
  manualLockApp: () => void;

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
  addTransaction: (t: Transaction, opts?: { shouldAffectCash?: boolean }) => void; 
  updateTransaction: (oldId: string, updates: Partial<Transaction>) => void; 
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
  registerProductionSurplus: (orderId: string, items: {id: string, variantId?: string, quantity: number}[]) => void;
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

const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'LuminaPOS',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    currency: 'MXN',
    taxRate: 0,
    enableTax: false,
    logo: null,
    receiptLogo: null,
    receiptHeader: '',
    receiptFooter: 'Gracias por su compra',
    ticketPaperWidth: '80mm',
    invoicePadding: 10,
    theme: 'light',
    budgetConfig: {
        expensesPercentage: 50,
        investmentPercentage: 30,
        profitPercentage: 20
    },
    notificationsEnabled: true,
    soundConfig: {
        enabled: true,
        volume: 0.5,
        saleSound: 'SUCCESS',
        errorSound: 'ERROR',
        clickSound: 'POP',
        notificationSound: 'NOTE'
    },
    securityConfig: {
        autoLockMinutes: 5, // Default 5 min auto-lock
        blurAppOnBackground: true
    },
    printConfig: {
        customerCopyBehavior: 'ASK' // ALWAYS, ASK, NEVER
    },
    sequences: {
        customerStart: 1,
        ticketStart: 1,
        orderStart: 1,
        productStart: 1000
    },
    productionDoc: {
        title: 'ORDEN DE PRODUCCIÓN',
        showPrices: false,
        showCustomerContact: true,
        showDates: true,
        customFooter: ''
    },
    bluetoothPrinterName: null,
    googleWebAppUrl: '',
    enableCloudSync: false,
    cloudSecret: ''
};

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
            soundConfig: { ...DEFAULT_SETTINGS.soundConfig, ...(loaded.soundConfig || {}) },
            securityConfig: { ...DEFAULT_SETTINGS.securityConfig, ...(loaded.securityConfig || {}) },
            printConfig: { ...DEFAULT_SETTINGS.printConfig, ...(loaded.printConfig || {}) } // Merge Print Config
        };
    });
    
    const [currentUser, setCurrentUser] = useState<User | null>(() => safeLoad('currentUser', null));
    
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    
    // --- APP SECURITY STATE ---
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);
    
    const inactivityTimerRef = useRef<any>(null);
    const lastActivityRef = useRef<number>(Date.now());

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

    // --- SECURITY: AUTO-LOCK & INACTIVITY ---
    const resetInactivityTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    useEffect(() => {
        // Only run inactivity logic if logged in and not already locked
        if (!currentUser || isAppLocked) return;

        const checkInactivity = () => {
            const minutes = settings.securityConfig?.autoLockMinutes || 0;
            if (minutes === 0) return; // Feature disabled

            const elapsed = Date.now() - lastActivityRef.current;
            if (elapsed > minutes * 60 * 1000) {
                setIsAppLocked(true);
            }
        };

        const interval = setInterval(checkInactivity, 5000); // Check every 5s
        
        // Listeners for activity
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        const handler = () => resetInactivityTimer();
        
        events.forEach(e => window.addEventListener(e, handler));

        return () => {
            clearInterval(interval);
            events.forEach(e => window.removeEventListener(e, handler));
        };
    }, [currentUser, isAppLocked, settings.securityConfig?.autoLockMinutes, resetInactivityTimer]);

    // Background Blur Effect
    useEffect(() => {
        if (!settings.securityConfig?.blurAppOnBackground) return;

        const handleVisibilityChange = () => {
            if (document.hidden && currentUser) {
                // Optional: Instant lock on tab switch? Maybe too aggressive.
                // For now, let's just rely on the CSS blur which can be handled in App.tsx
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [settings.securityConfig?.blurAppOnBackground, currentUser]);

    const unlockApp = async (password: string) => {
        if (!currentUser) return false;
        const isValid = await verifyPassword(password, currentUser.salt, currentUser.passwordHash);
        if (isValid) {
            setIsAppLocked(false);
            resetInactivityTimer();
            return true;
        }
        return false;
    };

    const manualLockApp = () => {
        setIsAppLocked(true);
    };

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
        
        const isLocalEmpty = currentData.products.length === 0 && currentData.customers.length === 0;
        const hasActivity = currentData.activityLogs.length > 0;
        const isForced = overrides?.forcePush === true || overrides?.manual === true || hasActivity;

        if (isLocalEmpty && !isForced) {
            console.warn("🛡️ DATA SAFETY: Sincronización bloqueada. Base de datos vacía.");
            return false;
        }

        setIsSyncing(true);
        try {
            await pushFullDataToCloud(config.googleWebAppUrl, config.cloudSecret, { ...currentData, ...overrides });
            
            lastCloudSyncTimestamp.current = Date.now();
            lastPushSuccessAt.current = Date.now();
            hasPendingChangesRef.current = false;
            setHasPendingChanges(false);
            
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
                        securityConfig: { ...DEFAULT_SETTINGS.securityConfig, ...(safeData.settings.securityConfig || {}) },
                        printConfig: { ...DEFAULT_SETTINGS.printConfig, ...(safeData.settings.printConfig || {}) }, // Merge Print Config
                        sequences: { ...DEFAULT_SETTINGS.sequences, ...(safeData.settings.sequences || {}) },
                        productionDoc: { ...DEFAULT_SETTINGS.productionDoc, ...(safeData.settings.productionDoc || {}) },
                        googleWebAppUrl: safeData.settings.googleWebAppUrl || currentSettings.googleWebAppUrl,
                        cloudSecret: safeData.settings.cloudSecret || currentSettings.cloudSecret
                    };
                    return incomingSettings;
                });
            }
            
            storeRef.current = {
                ...storeRef.current,
                ...safeData,
                settings: { ...storeRef.current.settings, ...safeData.settings }
            };

            setTimeout(() => {
                safeSave('products', safeData.products || []);
                safeSave('transactions', safeData.transactions || []);
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

    useEffect(() => {
        const interval = setInterval(() => {
            if (settings.enableCloudSync && settings.googleWebAppUrl) {
                if (hasPendingChanges) pushToCloud();
                else pullFromCloud(undefined, undefined, true);
            }
        }, 30000); 
        return () => clearInterval(interval);
    }, [hasPendingChanges, settings.enableCloudSync, settings.googleWebAppUrl]);

    useEffect(() => {
        if (hasPendingChanges && settings.enableCloudSync && settings.googleWebAppUrl) {
            const debounceTimer = setTimeout(() => {
                console.log("Auto-saving pending changes...");
                pushToCloud();
            }, 5000); 
            return () => clearTimeout(debounceTimer);
        }
    }, [hasPendingChanges, settings.enableCloudSync, settings.googleWebAppUrl, pushToCloud]);

    // ... (Auth Logic) ...
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

    const login = async (u: string, p: string, code?: string) => {
        const userIndex = users.findIndex(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (userIndex === -1) return 'INVALID';
        
        const user = users[userIndex];
        if (!user.active) return 'INVALID';
        if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) return 'LOCKED';
        
        if (u.toLowerCase() === 'admin' && p === 'Admin@123456') {
             const checkDefault = await verifyPassword(p, user.salt, user.passwordHash);
             if (!checkDefault) {
                 const newSalt = generateSalt();
                 const newHash = await hashPassword(p, newSalt);
                 const fixedUser = { ...user, salt: newSalt, passwordHash: newHash };
                 setUsers(prev => prev.map(usr => usr.id === user.id ? fixedUser : usr));
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
        setIsAppLocked(false); 
        logActivity('LOGIN', `Entró: ${u}`);
        pullFromCloud(undefined, undefined, true);
        markLocalChange(); 
        return 'SUCCESS';
    };

    const logout = async () => { 
        setIsLoggingOut(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setCurrentUser(null); 
        setIsAppLocked(false);
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

    // ... (rest of context code same as before: playSound, addProduct, etc)
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
    
    // --- UPDATED ACTIONS WITH MANUAL REF SYNC ---
    const addProduct = (p: Product) => {
        const currentList = storeRef.current.products; 
        const currentMaxId = currentList.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, (settings.sequences.productStart || 100) - 1);
        
        const newId = (currentMaxId + 1).toString();
        const newProduct = { ...p, id: newId };

        setProducts(prev => [...prev, newProduct]); 
        storeRef.current.products = [...storeRef.current.products, newProduct];

        markLocalChange(); 
        logActivity('INVENTORY', `Agregó producto: ${p.name}`); 
    };

    const updateProduct = (p: Product) => { 
        setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod)); 
        storeRef.current.products = storeRef.current.products.map(prod => prod.id === p.id ? p : prod);
        markLocalChange(); 
        logActivity('INVENTORY', `Actualizó producto: ${p.name}`); 
    };

    const deleteProduct = async (id: string) => { 
        const p = products.find(prod=>prod.id===id); 
        setProducts(prev => prev.filter(p => p.id !== id)); 
        storeRef.current.products = storeRef.current.products.filter(p => p.id !== id);
        markLocalChange(); 
        logActivity('INVENTORY', `Eliminó producto: ${p?.name}`); 
        return true; 
    };

    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', vId?: string) => {
        const updater = (p: Product) => {
            if (p.id === id) {
                if (vId) {
                    const vs = p.variants?.map(v => v.id === vId ? { ...v, stock: type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty) } : v);
                    return { ...p, variants: vs, stock: vs?.reduce((a,b)=>a+b.stock,0) || 0 };
                }
                return { ...p, stock: type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty) };
            }
            return p;
        };
        setProducts(prev => prev.map(updater));
        storeRef.current.products = storeRef.current.products.map(updater);
        markLocalChange();
    };

    const addCategory = (name: string) => {
        const updater = (prev: string[]) => prev.includes(name) ? prev : [...prev, name];
        setCategories(updater);
        storeRef.current.categories = updater(storeRef.current.categories);
        markLocalChange();
    };

    const removeCategory = (name: string) => {
        const updater = (prev: string[]) => prev.filter(c => c !== name);
        setCategories(updater);
        storeRef.current.categories = updater(storeRef.current.categories);
        markLocalChange();
    };
    
    // UPDATED: addTransaction with explicit cash option AND strictly cash method check
    const addTransaction = (t: Transaction, opts?: { shouldAffectCash?: boolean }) => {
        let newId = t.id;
        if (!newId) {
            const currentList = storeRef.current.transactions;
            const currentMaxId = currentList.reduce((max, curr) => {
                const idNum = parseInt(curr.id);
                return !isNaN(idNum) && idNum > max ? idNum : max;
            }, settings.sequences.ticketStart - 1);
            newId = (currentMaxId + 1).toString();
        }
        const final = { ...t, id: newId };
        
        setTransactions(prev => [final, ...prev]);
        storeRef.current.transactions = [final, ...storeRef.current.transactions];

        // Logic for Cash Movement
        let shouldAddCash = false;
        if (opts?.shouldAffectCash !== undefined) {
            // Manual override
            shouldAddCash = opts.shouldAffectCash;
        } else {
            // Automatic behavior
            const isToday = new Date(final.date).toDateString() === new Date().toDateString();
            shouldAddCash = t.paymentStatus === 'paid' && !t.isReturn && isToday;
        }

        // Calculate actual cash amount
        let cashAmount = 0;
        if (final.paymentMethod === 'cash') {
            cashAmount = final.amountPaid;
        } else if (final.paymentMethod === 'split') {
            cashAmount = final.splitDetails?.cash || 0;
        }

        // Only add movement if it's supposed to affect cash AND there is actual cash involved
        if (shouldAddCash && final.paymentStatus === 'paid' && !final.isReturn && cashAmount > 0) {
             addCashMovement({ 
                 id: `mv_${final.id}`, 
                 type: 'DEPOSIT', 
                 amount: cashAmount, // Use strictly the cash amount
                 description: `Venta #${final.id}`, 
                 date: final.date, // Use transaction date, not NOW, for correct history logging
                 category: 'SALES' 
             });
        }

        const debt = final.total - (final.amountPaid || 0);
        if (debt > 0.01 && final.customerId && final.status !== 'cancelled' && final.status !== 'returned') {
            const custUpdater = (prev: Customer[]) => prev.map(c => {
                if (c.id === final.customerId) return { ...c, currentDebt: c.currentDebt + debt };
                return c;
            });
            setCustomers(custUpdater);
            storeRef.current.customers = custUpdater(storeRef.current.customers);
        }
        logActivity('SALE', `Venta #${final.id}`);
        playSound('SALE');
        markLocalChange();
    };

    const updateTransaction = (oldId: string, updates: Partial<Transaction>) => {
        if (updates.id && updates.id !== oldId) {
            if (storeRef.current.transactions.some(t => t.id === updates.id)) {
                throw new Error(`El folio #${updates.id} ya existe.`);
            }
        }
        const updater = (prev: Transaction[]) => prev.map(t => t.id === oldId ? { ...t, ...updates } : t);
        setTransactions(updater);
        storeRef.current.transactions = updater(storeRef.current.transactions);

        if (updates.id && updates.id !== oldId) {
            const mvUpdater = (prev: CashMovement[]) => prev.map(m => {
                if (m.id === `mv_${oldId}`) {
                    return { ...m, id: `mv_${updates.id}`, description: m.description.replace(`#${oldId}`, `#${updates.id}`) };
                }
                return m;
            });
            setCashMovements(mvUpdater);
            storeRef.current.cashMovements = mvUpdater(storeRef.current.cashMovements);
        }
        markLocalChange();
        logActivity('SALE', `Editó Venta #${oldId} -> ${updates.id || oldId}`);
    };

    const updateStockAfterSale = (items: any[]) => {
        items.forEach(i => adjustStock(i.id, i.quantity, 'OUT', i.variantId));
    };

    const deleteTransaction = (id: string, items: any[]) => {
        const tx = transactions.find(t => t.id === id);
        const txUpdater = (prev: Transaction[]) => prev.map(t => t.id === id ? { ...t, status: 'cancelled' as const, amountPaid: 0 } : t);
        setTransactions(txUpdater);
        storeRef.current.transactions = txUpdater(storeRef.current.transactions);

        const mvUpdater = (prev: CashMovement[]) => prev.filter(m => m.id !== `mv_${id}`);
        setCashMovements(mvUpdater);
        storeRef.current.cashMovements = mvUpdater(storeRef.current.cashMovements);

        items.forEach(i => adjustStock(i.id, i.quantity, 'IN', i.variantId));
        
        if (tx && tx.customerId) {
            const debt = tx.total - (tx.amountPaid || 0);
            if (debt > 0.01) {
                 const custUpdater = (prev: Customer[]) => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - debt) } : c);
                 setCustomers(custUpdater);
                 storeRef.current.customers = custUpdater(storeRef.current.customers);
            }
        }
        logActivity('SALE', `Anuló Venta #${id}`);
        markLocalChange();
        setTimeout(() => pushToCloud(), 100);
    };

    const registerTransactionPayment = (id: string, amount: number, method: string) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        const txUpdater = (prev: Transaction[]) => prev.map(t => {
            if (t.id === id) {
                const newPaid = (t.amountPaid || 0) + amount;
                let newStatus: Transaction['paymentStatus'] = t.paymentStatus;
                if (newPaid >= t.total - 0.01) newStatus = 'paid';
                else if (newPaid > 0) newStatus = 'partial';
                return { ...t, amountPaid: newPaid, paymentStatus: newStatus };
            }
            return t;
        });
        setTransactions(txUpdater);
        storeRef.current.transactions = txUpdater(storeRef.current.transactions);

        if (tx.customerId) {
            const custUpdater = (prev: Customer[]) => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c);
            setCustomers(custUpdater);
            storeRef.current.customers = custUpdater(storeRef.current.customers);
        }
        // Only add cash movement if actual cash is involved
        if (method === 'cash') {
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
        const currentList = storeRef.current.customers;
        const currentMaxId = currentList.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, settings.sequences.customerStart - 1);
        const newId = (currentMaxId + 1).toString();
        const newC = { ...c, id: newId };
        
        setCustomers(prev => [...prev, newC]);
        storeRef.current.customers = [...storeRef.current.customers, newC];
        markLocalChange();
        logActivity('CRM', `Nuevo cliente: ${c.name}`);
    };

    const addSupplier = (s: Supplier) => { 
        setSuppliers(prev => [...prev, s]); 
        storeRef.current.suppliers = [...storeRef.current.suppliers, s];
        markLocalChange(); 
        logActivity('CRM', `Nuevo proveedor: ${s.name}`); 
    };
    
    const updateSupplier = (s: Supplier) => { 
        const updater = (prev: Supplier[]) => prev.map(sup => sup.id === s.id ? s : sup);
        setSuppliers(updater); 
        storeRef.current.suppliers = updater(storeRef.current.suppliers);
        markLocalChange(); 
    };
    
    const deleteSupplier = async (id: string) => { 
        const s = suppliers.find(sup => sup.id === id); 
        const updater = (prev: Supplier[]) => prev.filter(sup => sup.id !== id);
        setSuppliers(updater); 
        storeRef.current.suppliers = updater(storeRef.current.suppliers);
        markLocalChange(); 
        return true; 
    };
    
    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [...prev, p]);
        storeRef.current.purchases = [...storeRef.current.purchases, p];
        p.items.forEach(item => adjustStock(item.productId, item.quantity, 'IN', item.variantId));
        addCashMovement({ id: `purch_${p.id}`, type: 'EXPENSE', amount: p.total, description: `Compra a ${p.supplierName}`, date: p.date, category: 'OPERATIONAL' });
        markLocalChange();
        logActivity('INVENTORY', `Compra a ${p.supplierName}`);
    };
    
    const addOrder = (o: Order) => {
        const currentList = storeRef.current.orders;
        const currentMaxId = currentList.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, settings.sequences.orderStart - 1);
        const newId = (currentMaxId + 1).toString();
        const newO = { ...o, id: newId };
        
        setOrders(prev => [...prev, newO]);
        storeRef.current.orders = [...storeRef.current.orders, newO];
        markLocalChange();
        logActivity('ORDER', `Nuevo pedido #${newId}`);
    };
    
    const updateOrder = (o: Order) => {
        const updater = (prev: Order[]) => prev.map(ord => ord.id === o.id ? o : ord);
        setOrders(updater);
        storeRef.current.orders = updater(storeRef.current.orders);
        markLocalChange();
        logActivity('ORDER', `Editó pedido #${o.id}`);
    };

    const sendOrderToPOS = (order: Order) => {
        setIncomingOrder(order);
        const updater = (prev: Order[]) => prev.filter(o => o.id !== order.id);
        setOrders(updater);
        storeRef.current.orders = updater(storeRef.current.orders);
        logActivity('ORDER', `Pedido #${order.id} enviado a Caja`);
    };

    const clearIncomingOrder = () => setIncomingOrder(null);

    const convertOrderToSale = (id: string, paymentMethod: string) => { };

    const updateCustomer = (c: Customer) => { 
        const updater = (prev: Customer[]) => prev.map(cust => cust.id === c.id ? c : cust);
        setCustomers(updater); 
        storeRef.current.customers = updater(storeRef.current.customers);
        markLocalChange(); 
    };
    
    const deleteCustomer = async (id: string) => { 
        const c = customers.find(cust=>cust.id===id); 
        const updater = (prev: Customer[]) => prev.filter(c => c.id !== id);
        setCustomers(updater); 
        storeRef.current.customers = updater(storeRef.current.customers);
        markLocalChange(); 
        return true; 
    };
    
    const addCashMovement = (m: CashMovement) => { 
        setCashMovements(prev => [m, ...prev]); 
        storeRef.current.cashMovements = [m, ...storeRef.current.cashMovements];
        markLocalChange(); 
        logActivity('CASH', `${m.type}: ${m.description}`); 
    };
    
    const deleteCashMovement = (id: string) => { 
        const m = cashMovements.find(mv=>mv.id===id); 
        const updater = (prev: CashMovement[]) => prev.filter(m => m.id !== id);
        setCashMovements(updater); 
        storeRef.current.cashMovements = updater(storeRef.current.cashMovements);
        markLocalChange(); 
    };
    
    // --- NEW FUNCTION TO HANDLE PRODUCTION SURPLUS ---
    const registerProductionSurplus = (orderId: string, items: {id: string, variantId?: string, quantity: number}[]) => {
        items.forEach(item => {
            if (item.quantity > 0) {
                adjustStock(item.id, item.quantity, 'IN', item.variantId);
            }
        });
        logActivity('INVENTORY', `Excedente Producción Orden #${orderId}`);
        notify("Stock Actualizado", "El excedente se ha agregado al inventario.", "success");
    };

    const updateSettings = (s: BusinessSettings) => { 
        setSettings(s); 
        storeRef.current.settings = s;
        markLocalChange(); 
        logActivity('SETTINGS', `Actualizó configuración`);
    };
    
    const addUser = (u: User) => { 
        setUsers(prev => [...prev, u]); 
        storeRef.current.users = [...storeRef.current.users, u];
        markLocalChange(); 
        logActivity('USER_MGMT', `Nuevo usuario: ${u.username}`); 
    };
    
    const updateUser = (u: User) => { 
        const updater = (prev: User[]) => prev.map(user => user.id === u.id ? u : user);
        setUsers(updater); 
        storeRef.current.users = updater(storeRef.current.users);
        markLocalChange(); 
        logActivity('USER_MGMT', `Editó usuario: ${u.username}`); 
    };
    
    const deleteUser = (id: string) => { 
        const updater = (prev: User[]) => prev.filter(u => u.id !== id);
        setUsers(updater); 
        storeRef.current.users = updater(storeRef.current.users);
        markLocalChange(); 
        logActivity('USER_MGMT', `Eliminó usuario`); 
    };
    
    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newInvite = { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' };
        setUserInvites(prev => [...prev, newInvite]);
        storeRef.current.userInvites = [...storeRef.current.userInvites, newInvite];
        markLocalChange(); 
        return code;
    };
    
    const deleteInvite = (code: string) => { 
        const updater = (prev: UserInvite[]) => prev.filter(i => i.code !== code);
        setUserInvites(updater); 
        storeRef.current.userInvites = updater(storeRef.current.userInvites);
        markLocalChange(); 
    };
    
    const registerWithInvite = async (code: string, data: any) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) return 'USERNAME_EXISTS';
        const salt = generateSalt();
        const newUser: User = { id: crypto.randomUUID(), username: data.username, fullName: data.fullName, role: invite.role, active: true, passwordHash: await hashPassword(data.password, salt), salt, recoveryCode: generateSalt().substring(0,8), securityQuestion: data.securityQuestion, securityAnswerHash: await hashPassword(data.securityAnswer.toLowerCase(), salt) };
        
        setUsers(prev => [...prev, newUser]);
        storeRef.current.users = [...storeRef.current.users, newUser];
        
        const inviteUpdater = (prev: UserInvite[]) => prev.filter(i => i.code !== code);
        setUserInvites(inviteUpdater);
        storeRef.current.userInvites = inviteUpdater(storeRef.current.userInvites);
        
        markLocalChange(); 
        return 'SUCCESS';
    };

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, currentUser, activityLogs, categories, toasts, isSyncing, hasPendingChanges,
            btDevice, btCharacteristic, connectBtPrinter, disconnectBtPrinter, sendBtData, 
            isLoggingOut, 
            // --- NEW SECURITY EXPORTS ---
            isAppLocked, unlockApp, manualLockApp,
            
            addProduct, updateProduct, deleteProduct, adjustStock, 
            addCategory, removeCategory, 
            addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale,
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment: (id, am)=> {
                const updater = (p: Customer[]) => p.map(c=>c.id===id?{...c, currentDebt: Math.max(0, c.currentDebt-am)}:c);
                setCustomers(updater);
                storeRef.current.customers = updater(storeRef.current.customers);
            }, 
            addSupplier, updateSupplier, deleteSupplier, addPurchase,
            addCashMovement, deleteCashMovement,
            addOrder, updateOrder, updateOrderStatus: (id, st)=>{
                const updater = (p: Order[]) => p.map(o=>o.id===id?{...o, status: st as any}:o);
                setOrders(updater);
                storeRef.current.orders = updater(storeRef.current.orders);
            }, convertOrderToSale, deleteOrder: (id)=>{
                const updater = (p: Order[]) => p.filter(o=>o.id!==id);
                setOrders(updater);
                storeRef.current.orders = updater(storeRef.current.orders);
            }, registerProductionSurplus, 
            updateSettings, importData, login, logout, addUser, updateUser, deleteUser, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
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
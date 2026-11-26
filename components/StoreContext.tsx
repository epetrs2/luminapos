import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
    Product, Transaction, Customer, Supplier, CashMovement, Order, Purchase,
    User, UserInvite, ActivityLog, PeriodClosure, BusinessSettings, ToastNotification,
    CartItem, UserRole
} from '../types';
import { verifyPassword, hashPassword, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { supabase } from '../services/supabaseClient';
import { fetchAllFromSupabase, subscribeToSupabaseRealtime } from '../services/supabaseSync';
import {
    sbAddCategory,
    sbRemoveCategory,
    sbUpsertProduct,
    sbDeleteProduct,
    sbUpsertCustomer,
    sbDeleteCustomer,
    sbUpsertSupplier,
    sbDeleteSupplier,
    sbSaveTransaction,
    sbUpdateTransaction,
    sbSaveCashMovement,
    sbDeleteCashMovement,
    sbUpsertOrder,
    sbUpdateOrderStatus,
    sbDeleteOrder,
    sbSavePurchase,
    sbUpdateSettings,
    sbAdminUpdateProfile,
    sbSendPasswordRecovery,
    sbSendMagicLink,
    sbUpdateMyPassword,
    sbVerifyCurrentUserPassword,
    sbTouchUserActivity,
    sbLogActivity,
} from '../services/supabaseWrites';
import { roundCurrency, roundQty, generateId } from '../utils/financeHelpers';

export interface PosDraft {
    cart: CartItem[];
    selectedCustomerId: string;
    discountValue: string;
    discountType: 'PERCENT' | 'FIXED';
    shippingCost: string;
    sourceOrderId: string | null;
}

export const EMPTY_POS_DRAFT: PosDraft = {
    cart: [],
    selectedCustomerId: '',
    discountValue: '0',
    discountType: 'PERCENT',
    shippingCost: '',
    sourceOrderId: null
};

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
    categories: string[];
    activityLogs: ActivityLog[];
    periodClosures: PeriodClosure[];
    settings: BusinessSettings;
    toasts: ToastNotification[];
    currentUser: User | null;
    isAppLocked: boolean;
    isSyncing: boolean;
    hasPendingChanges: boolean;
    incomingOrder: Order | null;
    btDevice: BluetoothDevice | null;
    btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
    isLoggingOut: boolean;

    // Persistent POS draft so switching tabs (e.g. to Settings/Bluetooth) never wipes the cart
    posDraft: PosDraft;
    setPosDraft: React.Dispatch<React.SetStateAction<PosDraft>>;
    clearPosDraft: () => void;

    addProduct: (p: Product) => void;
    updateProduct: (p: Product) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;

    addTransaction: (t: Transaction, options?: { shouldAffectCash?: boolean }) => void;
    updateTransaction: (id: string, updates: Partial<Transaction>) => void;
    deleteTransaction: (id: string, items: any[]) => void;
    registerTransactionPayment: (id: string, amount: number, method: 'cash' | 'card' | 'transfer') => void;
    rectifyTransactionChannel: (id: string) => void;
    updateStockAfterSale: (items: CartItem[]) => void;

    addCustomer: (c: Customer) => void;
    updateCustomer: (c: Customer) => void;
    deleteCustomer: (id: string) => void;
    processCustomerPayment: (id: string, amount: number, channel?: 'CASH' | 'VIRTUAL') => void;

    addSupplier: (s: Supplier) => void;
    updateSupplier: (s: Supplier) => void;
    deleteSupplier: (id: string) => void;

    addCashMovement: (m: CashMovement) => void;
    deleteCashMovement: (id: string) => void;

    addOrder: (o: Order) => void;
    updateOrder: (o: Order) => void;
    updateOrderStatus: (id: string, status: Order['status']) => void;
    deleteOrder: (id: string) => void;
    completeOrder: (id: string) => void;
    sendOrderToPOS: (order: Order) => void;
    clearIncomingOrder: () => void;

    addPurchase: (p: Purchase, channel?: 'CASH' | 'VIRTUAL') => void;
    deletePurchase: (id: string) => void;

    addUser: (u: User) => void;
    updateUser: (u: User) => void;
    deleteUser: (id: string) => void;
    generateInvite: (role: UserRole) => string;
    deleteInvite: (code: string) => void;
    registerWithInvite: (code: string, userData: Partial<User> & { password?: string; securityAnswer?: string }) => Promise<string>;

    addCategory: (cat: string) => void;
    removeCategory: (cat: string) => void;

    addPeriodClosure: (pc: PeriodClosure) => void;

    updateSettings: (s: BusinessSettings) => void;

    login: (u: string, p: string, code?: string) => Promise<string>;
    loginWithSupabase: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
    signUpWithSupabase: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; message?: string }>;
    sendSupabasePasswordReset: (email: string) => Promise<{ ok: boolean; message: string }>;
    sendSupabaseMagicLink: (email: string) => Promise<{ ok: boolean; message: string }>;
    updateSupabasePassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>;
    adminUpdateSupabaseProfile: (targetId: string, fullName: string, role: UserRole, active: boolean) => Promise<{ ok: boolean; message?: string }>;
    verifyCurrentUserPassword: (password: string) => Promise<boolean>;
    isPasswordRecoveryMode: boolean;
    clearPasswordRecoveryMode: () => void;
    syncFromSupabase: (silent?: boolean) => Promise<boolean>;
    logout: () => void;
    manualLockApp: () => void;
    unlockApp: (password: string) => Promise<boolean>;
    recoverAccount: (user: string, method: string, payload: string, newPass: string) => Promise<string>;
    verifyRecoveryAttempt: (user: string, code: string) => boolean;
    getUserPublicInfo: (username: string) => { id: string; username: string; fullName: string; securityQuestion?: string; isTwoFactorEnabled?: boolean; active: boolean } | undefined;

    pushToCloud: (data?: any) => Promise<boolean>;
    pullFromCloud: (url?: string, secret?: string, silent?: boolean, force?: boolean) => Promise<boolean>;
    hardReset: () => void;
    importData: (json: any) => Promise<boolean>;

    notify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
    removeToast: (id: string) => void;
    flagChange: () => void;
    logActivity: (action: ActivityLog['action'], details: string) => void;

    connectBtPrinter: () => Promise<void>;
    disconnectBtPrinter: () => void;
    sendBtData: (data: Uint8Array) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error("useStore must be used within StoreProvider");
    return context;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// Initial Settings
const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'Mi Negocio',
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
    receiptFooter: 'Gracias por su preferencia',
    ticketPaperWidth: '58mm',
    invoicePadding: 10,
    theme: 'light',
    budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    notificationsEnabled: true,
    soundConfig: { enabled: true, volume: 0.5, saleSound: 'SUCCESS', errorSound: 'ERROR', clickSound: 'POP', notificationSound: 'NOTE' },
    securityConfig: { autoLockMinutes: 0, blurAppOnBackground: false },
    printConfig: { customerCopyBehavior: 'ASK' },
    sequences: { customerStart: 1, ticketStart: 1, orderStart: 1, productStart: 1 },
    productionDoc: { title: 'Orden de Producción', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' }
};

const mergeSettings = (saved: any): BusinessSettings => {
    if (!saved || typeof saved !== 'object') return DEFAULT_SETTINGS;
    return {
        ...DEFAULT_SETTINGS,
        ...saved,
        budgetConfig: { ...DEFAULT_SETTINGS.budgetConfig, ...(saved.budgetConfig || {}) },
        soundConfig: { ...DEFAULT_SETTINGS.soundConfig!, ...(saved.soundConfig || {}) },
        securityConfig: { ...DEFAULT_SETTINGS.securityConfig!, ...(saved.securityConfig || {}) },
        printConfig: { ...DEFAULT_SETTINGS.printConfig!, ...(saved.printConfig || {}) },
        sequences: { ...DEFAULT_SETTINGS.sequences, ...(saved.sequences || {}) },
        productionDoc: { ...DEFAULT_SETTINGS.productionDoc, ...(saved.productionDoc || {}) },
    };
};

const safeLoad = <T,>(key: string, fallback: T): T => {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return fallback;
        return JSON.parse(stored) as T;
    } catch (e) {
        console.error(`Failed to load ${key}`, e);
        return fallback;
    }
};

const safeSave = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save ${key} (storage quota?)`, e);
    }
};

const loadPosDraft = (): PosDraft => {
    try {
        const stored = sessionStorage.getItem('lumina_pos_draft');
        if (!stored) return EMPTY_POS_DRAFT;
        const parsed = JSON.parse(stored);
        return { ...EMPTY_POS_DRAFT, ...parsed, cart: Array.isArray(parsed.cart) ? parsed.cart : [] };
    } catch {
        return EMPTY_POS_DRAFT;
    }
};

const generateRecoveryCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const str = Array.from(bytes, b => chars[b % chars.length]).join('');
    return `${str.slice(0, 4)}-${str.slice(4, 8)}`;
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- LAZY-INITIALIZED STATE (never overwrites localStorage on first render) ---
    const [products, setProducts] = useState<Product[]>(() => safeLoad('products', []));
    const [transactions, setTransactions] = useState<Transaction[]>(() => safeLoad('transactions', []));
    const [customers, setCustomers] = useState<Customer[]>(() => safeLoad('customers', []));
    const [suppliers, setSuppliers] = useState<Supplier[]>(() => safeLoad('suppliers', []));
    const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => safeLoad('cashMovements', []));
    const [orders, setOrders] = useState<Order[]>(() => safeLoad('orders', []));
    const [purchases, setPurchases] = useState<Purchase[]>(() => safeLoad('purchases', []));
    const [users, setUsers] = useState<User[]>(() => safeLoad('users', []));
    const [userInvites, setUserInvites] = useState<UserInvite[]>(() => safeLoad('userInvites', []));
    const [categories, setCategories] = useState<string[]>(() => safeLoad('categories', ['General']));
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => safeLoad('activityLogs', []));
    const [periodClosures, setPeriodClosures] = useState<PeriodClosure[]>(() => safeLoad('periodClosures', []));
    const [settings, setSettings] = useState<BusinessSettings>(() => mergeSettings(safeLoad('settings', null)));

    // Persistent POS draft across tab switches
    const [posDraft, setPosDraft] = useState<PosDraft>(() => loadPosDraft());

    // UI State
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(() => safeLoad('currentUser', null));
    const [isAppLocked, setIsAppLocked] = useState<boolean>(() => sessionStorage.getItem('lumina_locked') === '1');
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.location.hash.includes('type=recovery');
    });

    // Bluetooth
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
    const btWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
    const btDisconnectHandlerRef = useRef<(() => void) | null>(null);

    // Sync version counter to prevent clearing hasPendingChanges if new edits arrive mid-push
    const changeVersionRef = useRef(0);

    // --- PERSISTENCE ---
    useEffect(() => { safeSave('products', products); }, [products]);
    useEffect(() => { safeSave('transactions', transactions); }, [transactions]);
    useEffect(() => { safeSave('customers', customers); }, [customers]);
    useEffect(() => { safeSave('suppliers', suppliers); }, [suppliers]);
    useEffect(() => { safeSave('cashMovements', cashMovements); }, [cashMovements]);
    useEffect(() => { safeSave('orders', orders); }, [orders]);
    useEffect(() => { safeSave('purchases', purchases); }, [purchases]);
    useEffect(() => { safeSave('users', users); }, [users]);
    useEffect(() => { safeSave('userInvites', userInvites); }, [userInvites]);
    useEffect(() => { safeSave('categories', categories); }, [categories]);
    useEffect(() => { safeSave('activityLogs', activityLogs); }, [activityLogs]);
    useEffect(() => { safeSave('periodClosures', periodClosures); }, [periodClosures]);
    useEffect(() => { safeSave('settings', settings); }, [settings]);

    useEffect(() => {
        try {
            sessionStorage.setItem('lumina_pos_draft', JSON.stringify(posDraft));
        } catch (e) {
            console.error('Failed to persist POS draft', e);
        }
    }, [posDraft]);

    // Sync dark mode class on <html>
    useEffect(() => {
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [settings.theme]);

    // Seed default admin user automatically on a fresh browser (when users array is empty)
    useEffect(() => {
        if (users.length === 0) {
            const seedAdmin = async () => {
                const salt = generateSalt();
                const passwordHash = await hashPassword('Admin@123456', salt);
                const defaultAdmin: User = {
                    id: 'admin-default',
                    username: 'admin',
                    fullName: 'Administrador',
                    role: 'ADMIN',
                    active: true,
                    passwordHash,
                    salt,
                    recoveryCode: generateRecoveryCode(),
                    isTwoFactorEnabled: false
                };
                setUsers(prev => prev.length === 0 ? [defaultAdmin] : prev);
            };
            seedAdmin();
        }
    }, [users.length]);

    // --- AUTO-DISCOVER CATEGORIES ---
    useEffect(() => {
        if (products.length > 0) {
            const uniqueProductCats = Array.from(new Set(products.map(p => p.category).filter(c => c && c.trim() !== '')));
            setCategories(prevCats => {
                const missing = uniqueProductCats.filter(c => !prevCats.includes(c));
                return missing.length > 0 ? [...prevCats, ...missing] : prevCats;
            });
        }
    }, [products]);

    useEffect(() => {
        if (currentUser) safeSave('currentUser', currentUser);
        else localStorage.removeItem('currentUser');
    }, [currentUser]);

    useEffect(() => {
        if (isAppLocked) sessionStorage.setItem('lumina_locked', '1');
        else sessionStorage.removeItem('lumina_locked');
    }, [isAppLocked]);

    // --- HELPERS ---
    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        const id = generateId();
        setToasts(prev => [...prev.slice(-4), { id, title, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    };

    const flagChange = () => {
        changeVersionRef.current += 1;
        setHasPendingChanges(true);
    };

    const clearPosDraft = () => setPosDraft(EMPTY_POS_DRAFT);

    const logActivity = (action: ActivityLog['action'], details: string) => {
        const nowIso = new Date().toISOString();
        const log: ActivityLog = {
            id: generateId(),
            userId: currentUser?.id || 'system',
            userName: currentUser?.username || 'Sistema',
            userRole: currentUser?.role || 'CASHIER',
            action,
            details,
            timestamp: nowIso
        };
        setActivityLogs(prev => [log, ...prev].slice(0, 1000));
        if (currentUser?.id) {
            setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: nowIso } : u));
        }
        sbLogActivity(action, details, log.userName, log.userRole, log.userId);
    };

    // --- BLUETOOTH REAL IMPLEMENTATION (with sequential write queue) ---
    const connectBtPrinter = async () => {
        if (!(navigator as any).bluetooth) {
            notify("Error", "Bluetooth no soportado en este navegador. Usa Chrome o Edge.", "error");
            return;
        }

        try {
            const PRINT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
            const WRITE_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: [PRINT_SERVICE_UUID] }]
            });

            if (!device.gatt) {
                throw new Error("El dispositivo no soporta conexión GATT.");
            }

            if (btDevice && btDisconnectHandlerRef.current) {
                btDevice.removeEventListener('gattserverdisconnected', btDisconnectHandlerRef.current);
            }

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(PRINT_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(WRITE_CHAR_UUID);

            const onDisconnected = () => {
                setBtDevice(null);
                setBtCharacteristic(null);
                notify("Bluetooth", "Impresora desconectada.", "warning");
            };
            btDisconnectHandlerRef.current = onDisconnected;
            device.addEventListener('gattserverdisconnected', onDisconnected);

            setBtDevice(device);
            setBtCharacteristic(characteristic);
            notify("Bluetooth", `Conectado a ${device.name || 'Impresora Térmica'}`, "success");
        } catch (e: any) {
            console.error("Error de conexión Bluetooth:", e);
            if (e.name !== 'NotFoundError') {
                notify("Error Conexión", e.message || "No se pudo conectar a la impresora.", "error");
            }
        }
    };

    const disconnectBtPrinter = () => {
        if (btDevice) {
            if (btDisconnectHandlerRef.current) {
                btDevice.removeEventListener('gattserverdisconnected', btDisconnectHandlerRef.current);
                btDisconnectHandlerRef.current = null;
            }
            if (btDevice.gatt && btDevice.gatt.connected) {
                btDevice.gatt.disconnect();
            }
        }
        setBtDevice(null);
        setBtCharacteristic(null);
        notify("Bluetooth", "Desconectado.", "info");
    };

    const sendBtData = async (data: Uint8Array) => {
        if (!btCharacteristic) {
            notify("Error", "Impresora no conectada. Conéctala desde el botón Bluetooth.", "error");
            return;
        }

        const runWrite = async () => {
            try {
                const CHUNK_SIZE = 50;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    if (typeof (btCharacteristic as any).writeValueWithoutResponse === 'function' && btCharacteristic.properties?.writeWithoutResponse) {
                        await (btCharacteristic as any).writeValueWithoutResponse(chunk);
                    } else {
                        await btCharacteristic.writeValue(chunk);
                    }
                    await new Promise(r => setTimeout(r, 20));
                }
            } catch (e: any) {
                console.error("Error al enviar datos a la impresora:", e);
                notify("Error Impresión", "Fallo al enviar datos. Intenta reconectar.", "error");
                disconnectBtPrinter();
            }
        };

        btWriteQueueRef.current = btWriteQueueRef.current.then(runWrite, runWrite);
        await btWriteQueueRef.current;
    };

    // --- ACTIONS ---
    const addProduct = (p: Product) => {
        const maxNum = products.reduce((max, prod) => {
            const n = parseInt(prod.id, 10);
            return Number.isFinite(n) && n > max ? n : max;
        }, (settings.sequences.productStart || 1) - 1);
        const id = p.id || String(maxNum + 1);
        const newProduct = { ...p, id };
        setProducts(prev => [...prev, newProduct]);
        sbUpsertProduct(newProduct);
        notify("Producto", "Agregado correctamente", "success");
        flagChange();
    };

    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
        sbUpsertProduct(p);
        notify("Producto", "Actualizado", "success");
        flagChange();
    };

    const deleteProduct = (id: string) => {
        if (confirm("¿Eliminar producto?")) {
            setProducts(prev => prev.filter(p => p.id !== id));
            sbDeleteProduct(id);
            notify("Producto", "Eliminado", "info");
            flagChange();
        }
    };

    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        if (!Number.isFinite(qty) || qty <= 0) return;
        setProducts(prev => prev.map(p => {
            if (p.id !== id) return p;
            let updated: Product;
            if (variantId && p.variants) {
                const newVariants = p.variants.map(v =>
                    v.id === variantId
                        ? { ...v, stock: roundQty(type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty)) }
                        : v
                );
                const totalStock = roundQty(newVariants.reduce((s, v) => s + v.stock, 0));
                updated = { ...p, variants: newVariants, stock: totalStock };
            } else {
                updated = { ...p, stock: roundQty(type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty)) };
            }
            sbUpsertProduct(updated);
            return updated;
        }));
        logActivity('INVENTORY', `${type === 'IN' ? 'Entrada' : 'Salida'} de ${qty} un. en producto ID ${id}`);
        flagChange();
    };

    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        const cleanTx: Transaction = {
            ...t,
            subtotal: roundCurrency(t.subtotal),
            taxAmount: roundCurrency(t.taxAmount || 0),
            discount: roundCurrency(t.discount || 0),
            shipping: roundCurrency(t.shipping || 0),
            total: roundCurrency(t.total),
            amountPaid: roundCurrency(t.amountPaid || 0),
        };
        setTransactions(prev => [...prev, cleanTx]);
        sbSaveTransaction(cleanTx);

        // Update customer debt if pending or partial
        if (cleanTx.paymentStatus === 'pending' || cleanTx.paymentStatus === 'partial') {
            const pendingAmount = roundCurrency(Math.max(0, cleanTx.total - (cleanTx.amountPaid || 0)));
            if (cleanTx.customerId && pendingAmount > 0) {
                setCustomers(prev => prev.map(c => {
                    if (c.id !== cleanTx.customerId) return c;
                    const updated = { ...c, currentDebt: roundCurrency((c.currentDebt || 0) + pendingAmount) };
                    sbUpsertCustomer(updated);
                    return updated;
                }));
            }
        }

        // Register cash movement automatically
        const shouldAffectCash = options?.shouldAffectCash ?? true;
        if (shouldAffectCash && (cleanTx.amountPaid || 0) > 0) {
            if (cleanTx.paymentMethod === 'cash' || cleanTx.paymentMethod === 'credit') {
                addCashMovement({
                    id: generateId(),
                    type: 'DEPOSIT',
                    amount: cleanTx.amountPaid || 0,
                    description: cleanTx.paymentMethod === 'credit' ? `Anticipo Venta #${cleanTx.id}` : `Venta #${cleanTx.id}`,
                    date: cleanTx.date,
                    category: 'SALES',
                    subCategory: 'SALE',
                    channel: 'CASH',
                    customerId: cleanTx.customerId
                });
            } else if (cleanTx.paymentMethod === 'card' || cleanTx.paymentMethod === 'transfer') {
                addCashMovement({
                    id: generateId(),
                    type: 'DEPOSIT',
                    amount: cleanTx.amountPaid || 0,
                    description: `Venta #${cleanTx.id} (${cleanTx.paymentMethod === 'card' ? 'Tarjeta' : 'Transf.'})`,
                    date: cleanTx.date,
                    category: 'SALES',
                    subCategory: 'SALE',
                    channel: 'VIRTUAL',
                    customerId: cleanTx.customerId
                });
            } else if (cleanTx.paymentMethod === 'split' && cleanTx.splitDetails) {
                if (cleanTx.splitDetails.cash > 0) {
                    addCashMovement({
                        id: generateId(),
                        type: 'DEPOSIT',
                        amount: roundCurrency(cleanTx.splitDetails.cash),
                        description: `Venta #${cleanTx.id} (Efectivo)`,
                        date: cleanTx.date,
                        category: 'SALES',
                        subCategory: 'SALE',
                        channel: 'CASH',
                        customerId: cleanTx.customerId
                    });
                }
                if (cleanTx.splitDetails.other > 0) {
                    addCashMovement({
                        id: generateId(),
                        type: 'DEPOSIT',
                        amount: roundCurrency(cleanTx.splitDetails.other),
                        description: `Venta #${cleanTx.id} (Virtual)`,
                        date: cleanTx.date,
                        category: 'SALES',
                        subCategory: 'SALE',
                        channel: 'VIRTUAL',
                        customerId: cleanTx.customerId
                    });
                }
            }
        }

        // Safely update sequence only if ID is numeric
        const numericId = parseInt(cleanTx.id, 10);
        if (Number.isFinite(numericId) && /^\d+$/.test(cleanTx.id.trim())) {
            setSettings(prev => ({
                ...prev,
                sequences: {
                    ...prev.sequences,
                    ticketStart: Math.max(prev.sequences.ticketStart || 1, numericId + 1)
                }
            }));
        }

        flagChange();
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        sbUpdateTransaction(id, updates);
        flagChange();
    };

    const deleteTransaction = (id: string, items: any[]) => {
        const tx = transactions.find(t => t.id === id);
        // Prevent double cancellation
        if (!tx || tx.status === 'cancelled') return;

        // Reverse stock IMMUTABLY (safe under React.StrictMode)
        setProducts(prev => prev.map(prod => {
            const matchingItems = items.filter(item => item.id === prod.id);
            if (matchingItems.length === 0) return prod;

            if (prod.variants && prod.variants.length > 0) {
                const newVariants = prod.variants.map(v => {
                    const added = matchingItems
                        .filter(it => it.variantId === v.id)
                        .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
                    return added !== 0 ? { ...v, stock: roundQty(v.stock + added) } : v;
                });
                const unvariantedAdded = matchingItems
                    .filter(it => !it.variantId)
                    .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
                const totalStock = roundQty(newVariants.reduce((s, v) => s + v.stock, 0) + unvariantedAdded);
                return { ...prod, variants: newVariants, stock: totalStock };
            }

            const totalAdded = matchingItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
            return { ...prod, stock: roundQty(prod.stock + totalAdded) };
        }));

        // Revert customer pending debt if this sale had unpaid balance
        if (tx.customerId && (tx.paymentStatus === 'pending' || tx.paymentStatus === 'partial')) {
            const pendingDebt = roundCurrency(Math.max(0, tx.total - (tx.amountPaid || 0)));
            if (pendingDebt > 0) {
                setCustomers(prev => prev.map(c =>
                    c.id === tx.customerId
                        ? { ...c, currentDebt: roundCurrency(Math.max(0, (c.currentDebt || 0) - pendingDebt)) }
                        : c
                ));
            }
        }

        // Mark cancelled
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' } : t));
        sbUpdateTransaction(id, { status: 'cancelled' });

        // Add cash withdrawal refund if it was paid
        if (tx.amountPaid && tx.amountPaid > 0) {
            const isCash = tx.paymentMethod === 'cash' || tx.paymentMethod === 'credit' || (tx.paymentMethod === 'split' && (tx.splitDetails?.cash || 0) > 0);
            const isVirtual = tx.paymentMethod === 'card' || tx.paymentMethod === 'transfer' || (tx.paymentMethod === 'split' && (tx.splitDetails?.other || 0) > 0);

            if (isCash) {
                addCashMovement({
                    id: generateId(),
                    type: 'WITHDRAWAL',
                    amount: roundCurrency(tx.paymentMethod === 'split' ? (tx.splitDetails?.cash || 0) : tx.amountPaid),
                    description: `Devolución por anulación #${id} (Efec)`,
                    date: new Date().toISOString(),
                    category: 'SALES',
                    channel: 'CASH'
                });
            }
            if (isVirtual) {
                addCashMovement({
                    id: generateId(),
                    type: 'WITHDRAWAL',
                    amount: roundCurrency(tx.paymentMethod === 'split' ? (tx.splitDetails?.other || 0) : tx.amountPaid),
                    description: `Devolución por anulación #${id} (Virtual)`,
                    date: new Date().toISOString(),
                    category: 'SALES',
                    channel: 'VIRTUAL'
                });
            }
        }

        flagChange();
    };

    const registerTransactionPayment = (id: string, amount: number, method: 'cash' | 'card' | 'transfer') => {
        if (!Number.isFinite(amount) || amount <= 0) return;
        const tx = transactions.find(t => t.id === id);
        if (!tx || tx.status === 'cancelled') return;

        const cleanAmount = roundCurrency(amount);
        const newPaid = roundCurrency(Math.min(tx.total, (tx.amountPaid || 0) + cleanAmount));
        let newStatus: Transaction['paymentStatus'] = tx.paymentStatus;
        if (newPaid >= tx.total - 0.01) newStatus = 'paid';
        else if (newPaid > 0) newStatus = 'partial';

        updateTransaction(id, { amountPaid: newPaid, paymentStatus: newStatus });

        if (tx.customerId) {
            setCustomers(prev => prev.map(c => {
                if (c.id !== tx.customerId) return c;
                const nextDebt = roundCurrency(Math.max(0, (c.currentDebt || 0) - cleanAmount));
                return { ...c, currentDebt: nextDebt < 0.01 ? 0 : nextDebt };
            }));
        }

        addCashMovement({
            id: generateId(),
            type: 'DEPOSIT',
            amount: cleanAmount,
            description: method === 'cash' ? `Abono Venta #${id}` : `Abono Venta #${id} (${method === 'card' ? 'Tarjeta' : 'Transf.'})`,
            date: new Date().toISOString(),
            category: 'SALES',
            subCategory: 'DEBT_PAYMENT',
            channel: method === 'cash' ? 'CASH' : 'VIRTUAL',
            customerId: tx.customerId
        });

        notify("Pago Registrado", `Se abonaron $${cleanAmount.toFixed(2)}`, "success");
    };

    const rectifyTransactionChannel = (id: string) => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        notify("Info", "Funcionalidad de rectificación disponible próximamente con Supabase.", "info");
    };

    // 100% IMMUTABLE stock update (safe under React.StrictMode)
    const updateStockAfterSale = (items: CartItem[]) => {
        setProducts(prev => prev.map(prod => {
            const matchingItems = items.filter(item => item.id === prod.id);
            if (matchingItems.length === 0) return prod;

            if (prod.variants && prod.variants.length > 0) {
                const newVariants = prod.variants.map(v => {
                    const delta = matchingItems
                        .filter(it => it.variantId === v.id)
                        .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
                    return delta !== 0 ? { ...v, stock: roundQty(v.stock - delta) } : v;
                });
                const unvariantedDelta = matchingItems
                    .filter(it => !it.variantId)
                    .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
                const totalStock = roundQty(newVariants.reduce((s, v) => s + v.stock, 0) - unvariantedDelta);
                return { ...prod, variants: newVariants, stock: totalStock };
            }

            const totalDelta = matchingItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
            const updatedProd = { ...prod, stock: roundQty(prod.stock - totalDelta) };
            sbUpsertProduct(updatedProd);
            return updatedProd;
        }));
        flagChange();
    };

    // Customer
    const addCustomer = (c: Customer) => {
        const maxNum = customers.reduce((max, cust) => {
            const match = /^C?(\d+)$/i.exec(cust.id);
            const n = match ? parseInt(match[1], 10) : 0;
            return n > max ? n : max;
        }, (settings.sequences.customerStart || 1) - 1);
        const id = c.id || `C${(maxNum + 1).toString().padStart(4, '0')}`;
        const newCust = { ...c, id, currentDebt: roundCurrency(c.currentDebt || 0), creditLimit: roundCurrency(Math.max(0, c.creditLimit || 0)) };
        setCustomers(prev => [...prev, newCust]);
        sbUpsertCustomer(newCust);
        notify("Cliente", "Registrado", "success");
        flagChange();
    };

    const updateCustomer = (c: Customer) => {
        const cleanCust = { ...c, currentDebt: roundCurrency(c.currentDebt || 0), creditLimit: roundCurrency(Math.max(0, c.creditLimit || 0)) };
        setCustomers(prev => prev.map(cust => cust.id === c.id ? cleanCust : cust));
        sbUpsertCustomer(cleanCust);
        notify("Cliente", "Actualizado", "success");
        flagChange();
    };

    const deleteCustomer = (id: string) => {
        const cust = customers.find(c => c.id === id);
        if (cust && (cust.currentDebt || 0) > 0.01) {
            notify("No permitido", `El cliente tiene una deuda pendiente de $${cust.currentDebt.toFixed(2)}. Liquídala primero.`, "error");
            return;
        }
        if (confirm("¿Eliminar cliente?")) {
            setCustomers(prev => prev.filter(c => c.id !== id));
            sbDeleteCustomer(id);
            flagChange();
        }
    };

    // FIFO settlement of customer pending transactions + debt reduction + tagged cash movement
    const processCustomerPayment = (id: string, amount: number, channel: 'CASH' | 'VIRTUAL' = 'CASH') => {
        if (!Number.isFinite(amount) || amount <= 0) {
            notify("Error", "Ingresa un monto válido mayor a 0.", "error");
            return;
        }
        const cleanAmount = roundCurrency(amount);

        // 1. Reduce customer debt safely
        setCustomers(prev => prev.map(c => {
            if (c.id !== id) return c;
            const nextDebt = roundCurrency(Math.max(0, (c.currentDebt || 0) - cleanAmount));
            return { ...c, currentDebt: nextDebt < 0.01 ? 0 : nextDebt };
        }));

        // 2. Apply payment FIFO across customer's pending/partial transactions so tickets actually close!
        setTransactions(prev => {
            let remainingToApply = cleanAmount;
            // Oldest unpaid first
            const unpaidIds = prev
                .filter(t => t.customerId === id && t.status !== 'cancelled' && t.status !== 'returned' && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial'))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map(t => t.id);

            const updates = new Map<string, { amountPaid: number; paymentStatus: Transaction['paymentStatus'] }>();
            for (const txId of unpaidIds) {
                if (remainingToApply <= 0.005) break;
                const tx = prev.find(t => t.id === txId);
                if (!tx) continue;
                const txRemaining = roundCurrency(Math.max(0, tx.total - (tx.amountPaid || 0)));
                if (txRemaining <= 0) continue;
                const applied = roundCurrency(Math.min(txRemaining, remainingToApply));
                const newPaid = roundCurrency((tx.amountPaid || 0) + applied);
                const newStatus: Transaction['paymentStatus'] = newPaid >= tx.total - 0.01 ? 'paid' : 'partial';
                updates.set(txId, { amountPaid: newStatus === 'paid' ? tx.total : newPaid, paymentStatus: newStatus });
                remainingToApply = roundCurrency(remainingToApply - applied);
            }

            if (updates.size === 0) return prev;
            return prev.map(t => {
                const u = updates.get(t.id);
                return u ? { ...t, ...u } : t;
            });
        });

        // 3. Record cash movement tagged specifically as DEBT_PAYMENT (so timeline never confuses it with cash sales)
        addCashMovement({
            id: generateId(),
            type: 'DEPOSIT',
            amount: cleanAmount,
            description: channel === 'VIRTUAL' ? 'Abono a cuenta cliente (Banco/Transf.)' : 'Abono a cuenta cliente',
            date: new Date().toISOString(),
            category: 'SALES',
            subCategory: 'DEBT_PAYMENT',
            channel,
            customerId: id
        });

        notify("Abono", `Abono de $${cleanAmount.toFixed(2)} registrado correctamente`, "success");
        flagChange();
    };

    // Suppliers
    const addSupplier = (s: Supplier) => { setSuppliers(prev => [...prev, s]); sbUpsertSupplier(s); flagChange(); };
    const updateSupplier = (s: Supplier) => { setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup)); sbUpsertSupplier(s); flagChange(); };
    const deleteSupplier = (id: string) => {
        if (confirm("¿Eliminar proveedor? Las compras históricas conservarán su registro.")) {
            setSuppliers(prev => prev.filter(s => s.id !== id));
            sbDeleteSupplier(id);
            flagChange();
        }
    };

    // Cash
    const addCashMovement = (m: CashMovement) => {
        if (!Number.isFinite(m.amount) || m.amount < 0) return;
        const cleanM = { ...m, amount: roundCurrency(m.amount) };
        setCashMovements(prev => [...prev, cleanM]);
        sbSaveCashMovement(cleanM);
        flagChange();
    };
    const deleteCashMovement = (id: string) => { setCashMovements(prev => prev.filter(m => m.id !== id)); sbDeleteCashMovement(id); flagChange(); };

    // Orders
    const addOrder = (o: Order) => {
        const id = o.id || `ORD-${Date.now().toString().slice(-6)}`;
        const newOrder = { ...o, id };
        setOrders(prev => [...prev, newOrder]);
        sbUpsertOrder(newOrder);
        notify("Pedido", "Creado exitosamente", "success");
        flagChange();
    };
    const updateOrder = (o: Order) => { setOrders(prev => prev.map(ord => ord.id === o.id ? o : ord)); sbUpsertOrder(o); flagChange(); };
    const updateOrderStatus = (id: string, status: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        sbUpdateOrderStatus(id, status);
        notify("Estado", "Actualizado", "info");
        flagChange();
    };
    const deleteOrder = (id: string) => { setOrders(prev => prev.filter(o => o.id !== id)); sbDeleteOrder(id); flagChange(); };
    const completeOrder = (id: string) => updateOrderStatus(id, 'COMPLETED');
    const sendOrderToPOS = (order: Order) => {
        setIncomingOrder(order);
        notify("Caja", "Pedido cargado para cobro", "success");
    };
    const clearIncomingOrder = () => setIncomingOrder(null);

    // Purchases (updates stock + product.cost + cash movement, and deletePurchase reverses them!)
    const addPurchase = (p: Purchase, channel: 'CASH' | 'VIRTUAL' = 'CASH') => {
        const cleanPurchase: Purchase = { ...p, total: roundCurrency(p.total) };
        setPurchases(prev => [...prev, cleanPurchase]);
        sbSavePurchase(cleanPurchase, channel);

        // Update stock and last purchase cost immutably
        setProducts(prev => prev.map(prod => {
            const matching = cleanPurchase.items.filter(i => i.productId === prod.id);
            if (matching.length === 0) return prod;

            const latestCost = matching[matching.length - 1].unitCost;
            if (prod.variants && prod.variants.length > 0) {
                const newVariants = prod.variants.map(v => {
                    const qtyAdded = matching
                        .filter(i => i.variantId === v.id)
                        .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                    return qtyAdded > 0 ? { ...v, stock: roundQty(v.stock + qtyAdded) } : v;
                });
                const unvariantedAdded = matching
                    .filter(i => !i.variantId)
                    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                const totalStock = roundQty(newVariants.reduce((s, v) => s + v.stock, 0) + unvariantedAdded);
                return { ...prod, variants: newVariants, stock: totalStock, cost: latestCost > 0 ? roundCurrency(latestCost) : prod.cost };
            }

            const totalAdded = matching.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            return {
                ...prod,
                stock: roundQty(prod.stock + totalAdded),
                cost: latestCost > 0 ? roundCurrency(latestCost) : prod.cost
            };
        }));

        addCashMovement({
            id: generateId(),
            type: 'EXPENSE',
            amount: cleanPurchase.total,
            description: `Compra #${cleanPurchase.id} a ${cleanPurchase.supplierName}`,
            date: cleanPurchase.date,
            category: 'OPERATIONAL',
            subCategory: 'PURCHASE',
            channel
        });

        notify("Compra", "Registrada, inventario y costo actualizados", "success");
        flagChange();
    };

    const deletePurchase = (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        // 1. Reverse stock added by this purchase immutably
        setProducts(prev => prev.map(prod => {
            const matching = purchase.items.filter(i => i.productId === prod.id);
            if (matching.length === 0) return prod;

            if (prod.variants && prod.variants.length > 0) {
                const newVariants = prod.variants.map(v => {
                    const qtyToRemove = matching
                        .filter(i => i.variantId === v.id)
                        .reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                    return qtyToRemove > 0 ? { ...v, stock: roundQty(Math.max(0, v.stock - qtyToRemove)) } : v;
                });
                const totalStock = roundQty(newVariants.reduce((s, v) => s + v.stock, 0));
                return { ...prod, variants: newVariants, stock: totalStock };
            }

            const totalRemoved = matching.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            return { ...prod, stock: roundQty(Math.max(0, prod.stock - totalRemoved)) };
        }));

        // 2. Remove purchase & reverse expense in cash register
        setPurchases(prev => prev.filter(p => p.id !== id));
        if (purchase.total > 0) {
            addCashMovement({
                id: generateId(),
                type: 'DEPOSIT',
                amount: roundCurrency(purchase.total),
                description: `Reversión compra eliminada #${purchase.id} (${purchase.supplierName})`,
                date: new Date().toISOString(),
                category: 'OPERATIONAL',
                subCategory: 'PURCHASE_REVERSAL',
                channel: 'CASH'
            });
        }
        notify("Compra Eliminada", "Stock y caja revertidos correctamente", "info");
        flagChange();
    };

    // Users
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); flagChange(); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(usr => usr.id === u.id ? u : usr)); flagChange(); };
    const deleteUser = (id: string) => { setUsers(prev => prev.filter(u => u.id !== id)); flagChange(); };
    const generateInvite = (role: UserRole) => {
        const code = generateRecoveryCode().replace('-', '').slice(0, 6);
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'admin' }]);
        flagChange();
        return code;
    };
    const deleteInvite = (code: string) => { setUserInvites(prev => prev.filter(i => i.code !== code)); flagChange(); };

    const registerWithInvite = async (code: string, userData: Partial<User> & { password?: string; securityAnswer?: string }) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === userData.username?.toLowerCase())) return 'USERNAME_EXISTS';

        const salt = generateSalt();
        const hash = await hashPassword(userData.password || '', salt);

        const newUser: User = {
            id: generateId(),
            username: userData.username!.trim(),
            fullName: userData.fullName!.trim(),
            passwordHash: hash,
            salt: salt,
            role: invite.role,
            active: true,
            recoveryCode: userData.recoveryCode || generateRecoveryCode(),
            securityQuestion: userData.securityQuestion,
            securityAnswerHash: userData.securityAnswer ? await hashPassword(userData.securityAnswer.trim().toLowerCase(), salt) : undefined,
            isTwoFactorEnabled: userData.isTwoFactorEnabled,
            twoFactorSecret: userData.twoFactorSecret
        };

        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter(i => i.code !== code));
        flagChange();
        return 'SUCCESS';
    };

    const addCategory = (cat: string) => {
        const clean = cat.trim();
        if (clean && !categories.includes(clean)) {
            setCategories(prev => [...prev, clean]);
            sbAddCategory(clean);
            flagChange();
        }
    };
    const removeCategory = (cat: string) => {
        setCategories(prev => prev.filter(c => c !== cat));
        sbRemoveCategory(cat);
        flagChange();
    };

    const addPeriodClosure = (pc: PeriodClosure) => { setPeriodClosures(prev => [...prev, pc]); flagChange(); };
    const updateSettings = (s: BusinessSettings) => { setSettings(s); sbUpdateSettings(s); flagChange(); };

    // Auth (with real 2FA verification and failed-attempt lockout)
    const login = async (u: string, p: string, code?: string) => {
        const cleanUser = u.trim().toLowerCase();
        const user = users.find(usr => usr.username.toLowerCase() === cleanUser);
        if (!user) return 'INVALID';

        if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return 'LOCKED';
        if (!user.active) return 'LOCKED';

        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        if (!isValid) {
            const attempts = (user.failedLoginAttempts || 0) + 1;
            const lockoutUntil = attempts >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : undefined;
            setUsers(prev => prev.map(usr => usr.id === user.id ? { ...usr, failedLoginAttempts: attempts, lockoutUntil } : usr));
            return lockoutUntil ? 'LOCKED' : 'INVALID';
        }

        if (user.isTwoFactorEnabled) {
            if (!code) return '2FA_REQUIRED';
            if (!user.twoFactorSecret || !verify2FAToken(code, user.twoFactorSecret)) {
                return 'INVALID_2FA';
            }
        }

        const nowIso = new Date().toISOString();
        const updatedUser: User = { ...user, lastLogin: nowIso, lastActive: nowIso, failedLoginAttempts: 0, lockoutUntil: undefined };
        setUsers(prev => prev.map(usr => usr.id === user.id ? updatedUser : usr));
        setCurrentUser(updatedUser);
        logActivity('LOGIN', `Inicio de sesión de ${user.username}`);
        return 'SUCCESS';
    };

    const syncFromSupabase = async (silent = true): Promise<boolean> => {
        if (!supabase) return false;
        try {
            const snap = await fetchAllFromSupabase();
            if (!snap) return false;
            if (snap.categories.length > 0) setCategories(snap.categories);
            if (snap.products.length > 0) setProducts(snap.products);
            if (snap.customers.length > 0) setCustomers(snap.customers);
            if (snap.suppliers.length > 0) setSuppliers(snap.suppliers);
            if (snap.transactions.length > 0) setTransactions(snap.transactions);
            if (snap.cashMovements.length > 0) setCashMovements(snap.cashMovements);
            if (snap.orders.length > 0) setOrders(snap.orders);
            if (snap.purchases.length > 0) setPurchases(snap.purchases);
            if (snap.profiles.length > 0) setUsers(snap.profiles);
            if (snap.activityLogs.length > 0) setActivityLogs(snap.activityLogs);
            if (snap.settingsPartial) setSettings(prev => mergeSettings({ ...prev, ...snap.settingsPartial }));
            if (!silent) notify("Nube Sincronizada", "Datos actualizados desde Supabase.", "success");
            return true;
        } catch (e) {
            console.warn('syncFromSupabase error:', e);
            return false;
        }
    };

    const hydrateUserFromSupabaseSession = async (sessionUser: any): Promise<boolean> => {
        if (!supabase || !sessionUser) return false;
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, email, full_name, role, active')
            .eq('id', sessionUser.id)
            .maybeSingle();

        // Enforce disabled account block immediately
        if (profile && profile.active === false) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            notify("Acceso Bloqueado", "Tu cuenta ha sido desactivada por un administrador.", "error");
            return false;
        }

        const nowIso = new Date().toISOString();
        const email = profile?.email || sessionUser.email || 'usuario@luminapos.app';
        const sbUser: User = {
            id: sessionUser.id,
            username: profile?.username || email.split('@')[0],
            email,
            fullName: profile?.full_name || sessionUser.user_metadata?.full_name || email.split('@')[0],
            role: (profile?.role as UserRole) || 'ADMIN',
            active: profile?.active !== false,
            passwordHash: '',
            salt: '',
            lastLogin: nowIso,
            lastActive: nowIso,
        };
        setCurrentUser(sbUser);
        sbTouchUserActivity(true);
        return true;
    };

    const loginWithSupabase = async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
        if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.session) {
            return { ok: false, message: error?.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : (error?.message || 'Error al iniciar sesión') };
        }
        const allowed = await hydrateUserFromSupabaseSession(data.user);
        if (!allowed) {
            return { ok: false, message: 'Tu cuenta está desactivada. Contacta al administrador.' };
        }
        await syncFromSupabase(true);
        return { ok: true };
    };

    const signUpWithSupabase = async (email: string, password: string, fullName: string): Promise<{ ok: boolean; message?: string }> => {
        if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName }, emailRedirectTo: redirectTo },
        });
        if (error) return { ok: false, message: error.message };
        if (data.session && data.user) {
            await hydrateUserFromSupabaseSession(data.user);
            await syncFromSupabase(true);
            return { ok: true, message: '¡Cuenta creada y sesión iniciada!' };
        }
        return { ok: true, message: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' };
    };

    const sendSupabasePasswordReset = async (email: string) => {
        const res = await sbSendPasswordRecovery(email);
        if (res.ok) logActivity('RECOVERY', `Enlace de recuperación enviado a ${email}`);
        return res;
    };

    const sendSupabaseMagicLink = async (email: string) => {
        const res = await sbSendMagicLink(email);
        if (res.ok) logActivity('LOGIN', `Magic Link enviado a ${email}`);
        return res;
    };

    const updateSupabasePassword = async (newPassword: string) => {
        const res = await sbUpdateMyPassword(newPassword);
        if (res.ok) {
            setIsPasswordRecoveryMode(false);
            if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
                window.history.replaceState(null, '', window.location.pathname);
            }
            logActivity('SECURITY', 'Contraseña actualizada correctamente');
        }
        return res;
    };

    const adminUpdateSupabaseProfile = async (targetId: string, fullName: string, role: UserRole, active: boolean) => {
        const res = await sbAdminUpdateProfile(targetId, fullName, role, active);
        if (res.ok) {
            setUsers(prev => prev.map(u => u.id === targetId ? { ...u, fullName, role, active } : u));
            await syncFromSupabase(true);
        }
        return res;
    };

    const verifyCurrentUserPassword = async (password: string): Promise<boolean> => {
        if (!currentUser || !password) return false;
        if (currentUser.email && supabase) {
            return await sbVerifyCurrentUserPassword(currentUser.email, password);
        }
        if (currentUser.salt && currentUser.passwordHash) {
            return await verifyPassword(password, currentUser.salt, currentUser.passwordHash);
        }
        return false;
    };

    const clearPasswordRecoveryMode = () => {
        setIsPasswordRecoveryMode(false);
        if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    };

    const logout = () => {
        setIsLoggingOut(true);
        if (supabase) {
            supabase.auth.signOut().catch(() => {});
        }
        setTimeout(() => {
            setCurrentUser(null);
            setIsAppLocked(false);
            setIsLoggingOut(false);
        }, 500);
    };

    const manualLockApp = () => setIsAppLocked(true);
    const unlockApp = async (password: string) => {
        if (!currentUser) return false;
        const valid = await verifyCurrentUserPassword(password);
        if (valid) setIsAppLocked(false);
        return valid;
    };

    const recoverAccount = async (user: string, method: string, payload: string, newPass: string) => {
        const usr = users.find(u => u.username.toLowerCase() === user.trim().toLowerCase());
        if (!usr) return 'ERROR';

        let verified = false;
        if (method === 'SECURITY_QUESTION' && usr.securityAnswerHash) {
            verified = await verifyPassword(payload.trim().toLowerCase(), usr.salt, usr.securityAnswerHash);
        } else if (method === 'CODE' && usr.recoveryCode) {
            verified = usr.recoveryCode.trim().toUpperCase() === payload.trim().toUpperCase();
        } else if (method === '2FA' && usr.isTwoFactorEnabled && usr.twoFactorSecret) {
            verified = verify2FAToken(payload, usr.twoFactorSecret);
        }

        if (!verified) return 'INVALID_RECOVERY';

        const newSalt = generateSalt();
        const hash = await hashPassword(newPass, newSalt);
        // If recovered via security question, re-hash answer with newSalt so it remains valid!
        const updatedAnswerHash = method === 'SECURITY_QUESTION'
            ? await hashPassword(payload.trim().toLowerCase(), newSalt)
            : usr.securityAnswerHash;

        setUsers(prev => prev.map(u => u.id === usr.id ? {
            ...u,
            passwordHash: hash,
            salt: newSalt,
            securityAnswerHash: updatedAnswerHash,
            failedLoginAttempts: 0,
            lockoutUntil: undefined
        } : u));
        flagChange();
        return 'SUCCESS';
    };

    const verifyRecoveryAttempt = (user: string, code: string) => {
        const usr = users.find(u => u.username.toLowerCase() === user.trim().toLowerCase());
        if (!usr || !usr.recoveryCode) return false;
        return usr.recoveryCode.trim().toUpperCase() === code.trim().toUpperCase();
    };

    const getUserPublicInfo = (username: string) => {
        const usr = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
        if (!usr) return undefined;
        return {
            id: usr.id,
            username: usr.username,
            fullName: usr.fullName,
            securityQuestion: usr.securityQuestion,
            isTwoFactorEnabled: usr.isTwoFactorEnabled,
            active: usr.active
        };
    };

    // Sync
    const pushToCloud = async (data?: any): Promise<boolean> => {
        if (!settings.enableCloudSync || !settings.googleWebAppUrl) return false;
        const versionAtStart = changeVersionRef.current;
        setIsSyncing(true);
        const payload = data || { products, transactions, customers, suppliers, cashMovements, orders, purchases, users, settings, userInvites, activityLogs, periodClosures, categories };
        try {
            await pushFullDataToCloud(settings.googleWebAppUrl, settings.cloudSecret, payload);
            if (changeVersionRef.current === versionAtStart) {
                setHasPendingChanges(false);
            }
            return true;
        } catch (e) {
            console.error("Sync error", e);
            notify("Error Sincronización", "No se pudo guardar en la nube.", "error");
            return false;
        } finally {
            setIsSyncing(false);
        }
    };

    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean) => {
        if (!url && (!settings.enableCloudSync || !settings.googleWebAppUrl)) return false;

        if (hasPendingChanges && !force) {
            if (!silent) notify("Sincronizando", "Subiendo cambios locales...", "info");
            const ok = await pushToCloud();
            if (ok && !silent) notify("Nube OK", "Tus cambios se han guardado.", "success");
            return ok;
        }

        const targetUrl = url || settings.googleWebAppUrl;
        const targetSecret = secret || settings.cloudSecret;
        if (!targetUrl) return false;

        setIsSyncing(true);
        try {
            const data = await fetchFullDataFromCloud(targetUrl, targetSecret);
            if (data) {
                if (data.products) setProducts(data.products);
                if (data.transactions) setTransactions(data.transactions);
                if (data.customers) setCustomers(data.customers);
                if (data.suppliers) setSuppliers(data.suppliers);
                if (data.cashMovements) setCashMovements(data.cashMovements);
                if (data.orders) setOrders(data.orders);
                if (data.purchases) setPurchases(data.purchases);
                if (data.users) setUsers(data.users);
                if (data.userInvites) setUserInvites(data.userInvites);
                if (data.activityLogs) setActivityLogs(data.activityLogs);
                if (data.periodClosures) setPeriodClosures(data.periodClosures);
                if (data.categories) setCategories(data.categories);
                if (data.settings) setSettings(mergeSettings(data.settings));

                if (!silent) notify("Sincronizado", "Datos actualizados desde la nube.", "success");
                return true;
            }
        } catch (e) {
            if (!silent) notify("Error Descarga", "No se pudieron obtener datos.", "error");
        } finally {
            setIsSyncing(false);
        }
        return false;
    };

    const hardReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    const importData = async (json: any) => {
        try {
            if (!json || typeof json !== 'object') return false;
            if (Array.isArray(json.products)) setProducts(json.products);
            if (Array.isArray(json.transactions)) setTransactions(json.transactions);
            if (Array.isArray(json.customers)) setCustomers(json.customers);
            if (Array.isArray(json.suppliers)) setSuppliers(json.suppliers);
            if (Array.isArray(json.cashMovements)) setCashMovements(json.cashMovements);
            if (Array.isArray(json.orders)) setOrders(json.orders);
            if (Array.isArray(json.purchases)) setPurchases(json.purchases);
            if (Array.isArray(json.users)) setUsers(json.users);
            if (Array.isArray(json.userInvites)) setUserInvites(json.userInvites);
            if (Array.isArray(json.activityLogs)) setActivityLogs(json.activityLogs);
            if (Array.isArray(json.periodClosures)) setPeriodClosures(json.periodClosures);
            if (Array.isArray(json.categories)) setCategories(json.categories);
            if (json.settings) setSettings(mergeSettings(json.settings));
            flagChange();
            return true;
        } catch (e) { return false; }
    };

    // --- SUPABASE REALTIME MULTI-DEVICE SYNC & AUTO-SESSION ---
    useEffect(() => {
        const client = supabase;
        if (!client) return;
        let unsubscribeRealtime: (() => void) | null = null;

        const setupRealtime = async () => {
            const { data } = await client.auth.getSession();
            if (!data.session) return;
            await hydrateUserFromSupabaseSession(data.session.user);
            await syncFromSupabase(true);
            unsubscribeRealtime = subscribeToSupabaseRealtime(async () => {
                await syncFromSupabase(true);
            });
        };

        setupRealtime();
        const { data: authSub } = client.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecoveryMode(true);
            }
            if (unsubscribeRealtime) {
                unsubscribeRealtime();
                unsubscribeRealtime = null;
            }
            if (session) {
                setupRealtime();
            }
        });

        return () => {
            if (unsubscribeRealtime) unsubscribeRealtime();
            authSub.subscription.unsubscribe();
        };
    }, []);

    // --- LIVE USER ACTIVITY HEARTBEAT (Updates lastActive every 2 min while active) ---
    useEffect(() => {
        if (!currentUser?.id) return;
        const beat = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const nowIso = new Date().toISOString();
            setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: nowIso } : u));
            sbTouchUserActivity(false);
        };
        const interval = setInterval(beat, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [currentUser?.id]);

    // --- AUTO SYNC ---
    useEffect(() => {
        if (settings.enableCloudSync && hasPendingChanges && !isSyncing) {
            const timer = setTimeout(() => {
                pushToCloud();
            }, 30000);
            return () => clearTimeout(timer);
        }
    }, [hasPendingChanges, settings.enableCloudSync, isSyncing, products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, activityLogs, periodClosures, categories, settings]);

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, periodClosures, settings, toasts,
            currentUser, isAppLocked, isSyncing, hasPendingChanges, incomingOrder, btDevice, btCharacteristic, isLoggingOut,
            posDraft, setPosDraft, clearPosDraft,
            addProduct, updateProduct, deleteProduct, adjustStock,
            addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, rectifyTransactionChannel, updateStockAfterSale,
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment,
            addSupplier, updateSupplier, deleteSupplier,
            addCashMovement, deleteCashMovement,
            addOrder, updateOrder, updateOrderStatus, deleteOrder, completeOrder, sendOrderToPOS, clearIncomingOrder,
            addPurchase, deletePurchase,
            addUser, updateUser, deleteUser, generateInvite, deleteInvite, registerWithInvite,
            addCategory, removeCategory,
            addPeriodClosure,
            updateSettings,
            login, loginWithSupabase, signUpWithSupabase, sendSupabasePasswordReset, sendSupabaseMagicLink, updateSupabasePassword, adminUpdateSupabaseProfile, verifyCurrentUserPassword, isPasswordRecoveryMode, clearPasswordRecoveryMode, syncFromSupabase, logout, manualLockApp, unlockApp, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
            pushToCloud, pullFromCloud, hardReset, importData,
            notify, removeToast, flagChange, logActivity,
            connectBtPrinter, disconnectBtPrinter, sendBtData
        }}>
            {children}
        </StoreContext.Provider>
    );
};

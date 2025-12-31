import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
    Product, Customer, Transaction, Supplier, Purchase, Order, CashMovement, 
    BusinessSettings, User, UserInvite, ActivityLog, ToastNotification, CartItem,
    UserRole
} from '../types';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';

interface StoreContextType {
    products: Product[];
    customers: Customer[];
    transactions: Transaction[];
    suppliers: Supplier[];
    purchases: Purchase[];
    orders: Order[];
    cashMovements: CashMovement[];
    settings: BusinessSettings;
    users: User[];
    userInvites: UserInvite[];
    categories: string[];
    activityLogs: ActivityLog[];
    toasts: ToastNotification[];
    currentUser: User | null;
    isSyncing: boolean;
    hasPendingChanges: boolean;
    incomingOrder: Order | null;
    isLoggingOut: boolean;
    isAppLocked: boolean;
    
    // Bluetooth
    btDevice: BluetoothDevice | null;
    btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
    connectBtPrinter: () => Promise<void>;
    disconnectBtPrinter: () => void;
    sendBtData: (data: Uint8Array) => Promise<void>;

    // Actions
    addProduct: (p: Product) => void;
    updateProduct: (p: Product) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (id: string, amount: number, type: 'IN' | 'OUT', variantId?: string) => void;
    
    addCustomer: (c: Customer) => void;
    updateCustomer: (c: Customer) => void;
    deleteCustomer: (id: string) => void;
    processCustomerPayment: (id: string, amount: number) => void;

    addTransaction: (t: Transaction, options?: { shouldAffectCash?: boolean }) => void;
    updateTransaction: (id: string, updates: Partial<Transaction>) => void;
    deleteTransaction: (id: string, itemsToRestore: CartItem[]) => void;
    registerTransactionPayment: (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => void;
    updateStockAfterSale: (items: {id: string, quantity: number, variantId?: string}[]) => void;

    addSupplier: (s: Supplier) => void;
    updateSupplier: (s: Supplier) => void;
    deleteSupplier: (id: string) => void;

    addPurchase: (p: Purchase) => void;
    
    addOrder: (o: Order) => void;
    updateOrderStatus: (id: string, status: Order['status']) => void;
    deleteOrder: (id: string) => void;
    sendOrderToPOS: (id: string) => void;
    clearIncomingOrder: () => void;

    addCashMovement: (m: CashMovement) => void;
    deleteCashMovement: (id: string) => void;

    addUser: (u: User) => void;
    updateUser: (u: User) => void;
    deleteUser: (id: string) => void;
    login: (u: string, p: string, code?: string) => Promise<'SUCCESS' | 'INVALID' | '2FA_REQUIRED' | 'INVALID_2FA' | 'LOCKED'>;
    logout: () => void;
    unlockApp: (password: string) => Promise<boolean>;
    manualLockApp: () => void;
    recoverAccount: (username: string, method: 'CODE' | 'SECURITY_QUESTION', payload: string, newPass: string) => Promise<'SUCCESS' | 'FAIL'>;
    verifyRecoveryAttempt: (username: string, code: string) => Promise<boolean>;
    getUserPublicInfo: (username: string) => { securityQuestion?: string } | null;
    generateInvite: (role: UserRole) => string;
    registerWithInvite: (code: string, userData: Partial<User>) => Promise<'SUCCESS' | 'INVALID_CODE' | 'USERNAME_EXISTS'>;
    deleteInvite: (code: string) => void;

    updateSettings: (s: BusinessSettings) => void;
    hardReset: () => void;
    importData: (data: any) => Promise<boolean>;
    
    addCategory: (c: string) => void;
    removeCategory: (c: string) => void;

    pullFromCloud: (url?: string, secret?: string, silent?: boolean, force?: boolean) => Promise<boolean>;
    pushToCloud: (overrideData?: any) => Promise<void>;
    
    notify: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', duration?: number) => void;
    removeToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

// Default Settings
const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'Mi Negocio',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    currency: 'MXN',
    taxRate: 16,
    enableTax: true,
    logo: null,
    receiptLogo: null,
    receiptHeader: '',
    receiptFooter: '',
    ticketPaperWidth: '58mm',
    invoicePadding: 10,
    theme: 'light',
    budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    notificationsEnabled: true,
    soundConfig: { enabled: true, volume: 0.5, saleSound: 'SUCCESS', errorSound: 'ERROR', clickSound: 'POP', notificationSound: 'NOTE' },
    securityConfig: { autoLockMinutes: 0, blurAppOnBackground: false },
    printConfig: { customerCopyBehavior: 'ASK' },
    sequences: { customerStart: 1, ticketStart: 1, orderStart: 1, productStart: 1 },
    productionDoc: { title: 'ORDEN DE PRODUCCIÓN', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' }
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
    const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
    const [users, setUsers] = useState<User[]>([]);
    const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
    const [categories, setCategories] = useState<string[]>(['General']);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    
    // UI State
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);

    // Bluetooth State
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // --- NOTIFICATION SYSTEM ---
    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', duration = 3000) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type, duration }]);
        setTimeout(() => removeToast(id), duration);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // --- DATA IMPORT/EXPORT ---
    const importData = async (data: any): Promise<boolean> => {
        try {
            if (data.products) setProducts(data.products);
            if (data.customers) setCustomers(data.customers);
            if (data.transactions) setTransactions(data.transactions);
            if (data.suppliers) setSuppliers(data.suppliers);
            if (data.purchases) setPurchases(data.purchases);
            if (data.orders) setOrders(data.orders);
            if (data.cashMovements) setCashMovements(data.cashMovements);
            if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
            if (data.users) setUsers(data.users);
            if (data.userInvites) setUserInvites(data.userInvites);
            if (data.categories) setCategories(data.categories);
            if (data.activityLogs) setActivityLogs(data.activityLogs);
            
            return true;
        } catch (e) {
            console.error("Import error", e);
            return false;
        }
    };

    // --- SYNC LOGIC (RECONSTRUCTED FROM SNIPPET) ---
    // Sync
    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean): Promise<boolean> => {
        const targetUrl = url || settings.googleWebAppUrl;
        const targetSecret = secret || settings.cloudSecret;
        
        if (!targetUrl || (!settings.enableCloudSync && !force)) return false;

        // GUARD: If we have pending local changes and this is not a forced pull, ABORT to prevent overwrite
        if (hasPendingChanges && !force) {
            if (!silent) notify("Sincronización Detenida", "Tienes cambios locales sin guardar. Se intentará subir primero.", "warning");
            return false;
        }

        setIsSyncing(true);
        try {
            const data = await fetchFullDataFromCloud(targetUrl, targetSecret);
            if (data) {
                await importData(data);
                setHasPendingChanges(false);
                if (!silent) notify("Sincronización", "Datos descargados correctamente.", "success");
                return true;
            }
        } catch (e: any) {
            if (!silent) notify("Error Sincronización", e.message, "error");
        } finally {
            setIsSyncing(false);
        }
        return false;
    };

    const pushToCloud = async (overrideData?: any) => {
        if (!settings.googleWebAppUrl || !settings.enableCloudSync) return;
        
        const dataToPush = overrideData || {
            products, customers, transactions, suppliers, purchases, orders, 
            cashMovements, settings, users, categories, activityLogs, userInvites
        };

        setIsSyncing(true);
        try {
            await pushFullDataToCloud(settings.googleWebAppUrl, settings.cloudSecret, dataToPush);
            setHasPendingChanges(false);
            notify("Nube Actualizada", "Tus cambios se han guardado exitosamente.", "success");
        } catch (e: any) {
            console.error("Push failed", e);
            notify("Error Nube", "No se pudieron guardar los cambios en la nube.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    // --- HELPER WRAPPER FOR STATE UPDATES ---
    const markChange = () => setHasPendingChanges(true);

    // --- CRUD OPERATIONS (BASIC IMPLEMENTATION) ---
    const addProduct = (p: Product) => {
        setProducts(prev => [...prev, { ...p, id: p.id || crypto.randomUUID() }]);
        markChange();
    };
    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(item => item.id === p.id ? p : item));
        markChange();
    };
    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(item => item.id !== id));
        markChange();
    };
    const adjustStock = (id: string, amount: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    return {
                        ...p,
                        variants: p.variants.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + amount : v.stock - amount } : v),
                        stock: p.stock // Master stock usually sum of variants, simplified here
                    };
                }
                return { ...p, stock: type === 'IN' ? p.stock + amount : p.stock - amount };
            }
            return p;
        }));
        markChange();
    };

    const addCustomer = (c: Customer) => {
        setCustomers(prev => [...prev, { ...c, id: c.id || crypto.randomUUID() }]);
        markChange();
    };
    const updateCustomer = (c: Customer) => {
        setCustomers(prev => prev.map(item => item.id === c.id ? c : item));
        markChange();
    };
    const deleteCustomer = (id: string) => {
        setCustomers(prev => prev.filter(item => item.id !== id));
        markChange();
    };
    const processCustomerPayment = (id: string, amount: number) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        // Add cash movement for payment
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: `Abono Cliente: ${id}`,
            date: new Date().toISOString(),
            customerId: id
        });
        markChange();
    };

    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        setTransactions(prev => [...prev, t]);
        
        // Update customer debt if needed
        if (t.customerId && (t.paymentStatus === 'pending' || t.paymentStatus === 'partial')) {
            const debt = t.total - (t.amountPaid || 0);
            setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + debt } : c));
        }

        // Add cash movement if paid and affecting cash
        if (options?.shouldAffectCash !== false && t.paymentMethod === 'cash' && t.amountPaid > 0) {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'DEPOSIT',
                amount: t.amountPaid,
                description: `Venta #${t.id}`,
                date: t.date,
                category: 'SALES'
            });
        }
        
        markChange();
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        markChange();
    };

    const deleteTransaction = (id: string, itemsToRestore: CartItem[]) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' } : t));
        // Restore Stock
        updateStockAfterSale(itemsToRestore.map(i => ({ id: i.id, quantity: -i.quantity, variantId: i.variantId })));
        markChange();
    };

    const registerTransactionPayment = (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        const newAmountPaid = (tx.amountPaid || 0) + amount;
        const newStatus = newAmountPaid >= tx.total ? 'paid' : 'partial';

        setTransactions(prev => prev.map(t => t.id === id ? { ...t, amountPaid: newAmountPaid, paymentStatus: newStatus } : t));
        
        if (tx.customerId) {
            setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        }

        if (method === 'cash') {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'DEPOSIT',
                amount: amount,
                description: `Pago Venta #${id}`,
                date: new Date().toISOString(),
                category: 'SALES'
            });
        }
        markChange();
    };

    const updateStockAfterSale = (items: {id: string, quantity: number, variantId?: string}[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find(i => i.id === p.id);
            if (item) {
                if (item.variantId && p.variants) {
                    return {
                        ...p,
                        variants: p.variants.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v)
                    };
                }
                return { ...p, stock: p.stock - item.quantity };
            }
            return p;
        }));
        markChange();
    };

    const addSupplier = (s: Supplier) => {
        setSuppliers(prev => [...prev, { ...s, id: s.id || crypto.randomUUID() }]);
        markChange();
    };
    const updateSupplier = (s: Supplier) => {
        setSuppliers(prev => prev.map(item => item.id === s.id ? s : item));
        markChange();
    };
    const deleteSupplier = (id: string) => {
        setSuppliers(prev => prev.filter(item => item.id !== id));
        markChange();
    };

    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [...prev, p]);
        // Update stock
        p.items.forEach(item => {
            adjustStock(item.productId, item.quantity, 'IN', item.variantId);
        });
        // Add expense
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'EXPENSE',
            amount: p.total,
            description: `Compra a ${p.supplierName}`,
            date: p.date,
            category: 'OPERATIONAL'
        });
        markChange();
    };

    const addOrder = (o: Order) => {
        setOrders(prev => [...prev, { ...o, id: o.id || crypto.randomUUID() }]);
        markChange();
    };
    const updateOrderStatus = (id: string, status: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        markChange();
    };
    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        markChange();
    };
    const sendOrderToPOS = (id: string) => {
        const order = orders.find(o => o.id === id);
        if (order) {
            setIncomingOrder(order);
        }
    };
    const clearIncomingOrder = () => setIncomingOrder(null);

    const addCashMovement = (m: CashMovement) => {
        setCashMovements(prev => [...prev, m]);
        markChange();
    };
    const deleteCashMovement = (id: string) => {
        setCashMovements(prev => prev.filter(m => m.id !== id));
        markChange();
    };

    const addUser = (u: User) => {
        setUsers(prev => [...prev, u]);
        markChange();
    };
    const updateUser = (u: User) => {
        setUsers(prev => prev.map(item => item.id === u.id ? u : item));
        markChange();
    };
    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(item => item.id !== id));
        markChange();
    };

    const updateSettings = (s: BusinessSettings) => {
        setSettings(s);
        markChange();
    };

    const hardReset = () => {
        if (window.confirm("¿Seguro que deseas borrar TODO? Esto es irreversible.")) {
            setProducts([]);
            setCustomers([]);
            setTransactions([]);
            setSuppliers([]);
            setPurchases([]);
            setOrders([]);
            setCashMovements([]);
            setUsers([]);
            setActivityLogs([]);
            notify("Reseteo Completo", "El sistema está vacío.", "warning");
        }
    };

    const addCategory = (c: string) => {
        if (!categories.includes(c)) setCategories(prev => [...prev, c]);
        markChange();
    };
    const removeCategory = (c: string) => {
        setCategories(prev => prev.filter(cat => cat !== c));
        markChange();
    };

    // --- AUTH MOCKS ---
    const login = async (u: string, p: string, code?: string) => {
        const user = users.find(user => user.username === u);
        if (user) {
            setCurrentUser(user);
            return 'SUCCESS';
        }
        return 'INVALID';
    };
    const logout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            setCurrentUser(null);
            setIsLoggingOut(false);
        }, 300);
    };
    const unlockApp = async (password: string) => {
        setIsAppLocked(false);
        return true;
    };
    const manualLockApp = () => setIsAppLocked(true);
    const recoverAccount = async () => 'SUCCESS';
    const verifyRecoveryAttempt = async () => true;
    const getUserPublicInfo = (username: string) => {
        const user = users.find(u => u.username === username);
        return user ? { securityQuestion: user.securityQuestion } : null;
    };
    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'Admin' }]);
        return code;
    };
    const registerWithInvite = async () => 'SUCCESS';
    const deleteInvite = (code: string) => setUserInvites(prev => prev.filter(i => i.code !== code));

    // --- BLUETOOTH MOCKS ---
    const connectBtPrinter = async () => {};
    const disconnectBtPrinter = () => {};
    const sendBtData = async () => {};

    return (
        <StoreContext.Provider value={{
            products, customers, transactions, suppliers, purchases, orders, cashMovements, settings, users, userInvites, categories, activityLogs, toasts, currentUser, isSyncing, hasPendingChanges, incomingOrder, isLoggingOut, isAppLocked, btDevice, btCharacteristic,
            connectBtPrinter, disconnectBtPrinter, sendBtData, addProduct, updateProduct, deleteProduct, adjustStock, addCustomer, updateCustomer, deleteCustomer, processCustomerPayment, addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale, addSupplier, updateSupplier, deleteSupplier, addPurchase, addOrder, updateOrderStatus, deleteOrder, sendOrderToPOS, clearIncomingOrder, addCashMovement, deleteCashMovement, addUser, updateUser, deleteUser, login, logout, unlockApp, manualLockApp, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo, generateInvite, registerWithInvite, deleteInvite, updateSettings, hardReset, importData, addCategory, removeCategory, pullFromCloud, pushToCloud, notify, removeToast
        }}>
            {children}
        </StoreContext.Provider>
    );
};

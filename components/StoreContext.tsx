import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { 
    Product, Customer, Transaction, Supplier, Purchase, Order, CashMovement, 
    BusinessSettings, User, UserInvite, ActivityLog, ToastNotification, CartItem,
    UserRole
} from '../types';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { playSystemSound } from '../utils/sound';
import { generateSalt, hashPassword, verifyPassword } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';

const generateRecoveryCode = () => {
    return Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
};

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
    login: (u: string, p: string, code?: string) => Promise<'SUCCESS' | 'INVALID_CREDENTIALS' | '2FA_REQUIRED' | 'INVALID_2FA' | 'LOCKED'>;
    logout: () => void;
    unlockApp: (password: string) => Promise<boolean>;
    manualLockApp: () => void;
    recoverAccount: (username: string, method: any, payload: string, newPass: string) => Promise<'SUCCESS' | 'FAIL' | 'USER_NOT_FOUND' | 'INVALID_ANSWER'>;
    verifyRecoveryAttempt: (username: string, method: any, payload: string) => Promise<boolean>;
    getUserPublicInfo: (username: string) => { securityQuestion?: string } | null;
    generateInvite: (role: UserRole) => string;
    // Fix: userData is 'any' to accept password field during registration
    registerWithInvite: (code: string, userData: any) => Promise<'SUCCESS' | 'INVALID_CODE' | 'USERNAME_EXISTS'>;
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
    logActivity: (action: any, details: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};

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

    // Refs needed for callbacks (optional, keeping for stability)
    const storeRef = useRef({
        products, customers, transactions, suppliers, purchases, orders, cashMovements, settings, users, activityLogs
    });

    useEffect(() => {
        storeRef.current = { products, customers, transactions, suppliers, purchases, orders, cashMovements, settings, users, activityLogs };
    }, [products, customers, transactions, suppliers, purchases, orders, cashMovements, settings, users, activityLogs]);

    // --- Persist & Load ---
    useEffect(() => {
        const load = (key: string, setter: any, def: any) => {
            const stored = localStorage.getItem(key);
            if (stored) {
                try { setter(JSON.parse(stored)); } catch(e) { console.error(e); setter(def); }
            } else { setter(def); }
        };
        load('products', setProducts, []);
        load('categories', setCategories, ['General']);
        load('customers', setCustomers, []);
        load('transactions', setTransactions, []);
        load('suppliers', setSuppliers, []);
        load('purchases', setPurchases, []);
        load('orders', setOrders, []);
        load('cashMovements', setCashMovements, []);
        load('settings', setSettings, DEFAULT_SETTINGS);
        load('users', setUsers, []);
        load('userInvites', setUserInvites, []);
        load('activityLogs', setActivityLogs, []);
        
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {}
        }
    }, []);

    // Save to LocalStorage on change
    useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
    useEffect(() => { localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
    useEffect(() => { localStorage.setItem('customers', JSON.stringify(customers)); }, [customers]);
    useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { localStorage.setItem('suppliers', JSON.stringify(suppliers)); }, [suppliers]);
    useEffect(() => { localStorage.setItem('purchases', JSON.stringify(purchases)); }, [purchases]);
    useEffect(() => { localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
    useEffect(() => { localStorage.setItem('cashMovements', JSON.stringify(cashMovements)); }, [cashMovements]);
    useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);
    useEffect(() => { localStorage.setItem('users', JSON.stringify(users)); }, [users]);
    useEffect(() => { localStorage.setItem('userInvites', JSON.stringify(userInvites)); }, [userInvites]);
    useEffect(() => { localStorage.setItem('activityLogs', JSON.stringify(activityLogs)); }, [activityLogs]);

    // --- HELPER WRAPPER FOR STATE UPDATES ---
    const markChange = () => {
        if (settings.enableCloudSync) {
            setHasPendingChanges(true);
        }
    };

    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', duration = 3000) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type, duration }]);
        setTimeout(() => removeToast(id), duration);
        
        if (settings.soundConfig?.enabled) {
            let soundType = settings.soundConfig.notificationSound;
            if (type === 'success') soundType = settings.soundConfig.saleSound;
            if (type === 'error' || type === 'warning') soundType = settings.soundConfig.errorSound;
            playSystemSound(soundType, settings.soundConfig.volume);
        }
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const logActivity = (action: any, details: string) => {
        if (!currentUser) return;
        const log: ActivityLog = {
            id: Date.now().toString(),
            userId: currentUser.id,
            userName: currentUser.username,
            userRole: currentUser.role,
            action,
            details,
            timestamp: new Date().toISOString()
        };
        setActivityLogs(prev => [log, ...prev].slice(0, 1000));
        markChange();
    };

    // --- CRUD OPERATIONS ---
    const addProduct = (p: Product) => {
        setProducts(prev => [...prev, { ...p, id: p.id || crypto.randomUUID() }]);
        markChange();
        logActivity('INVENTORY', `Producto creado: ${p.name}`);
    };
    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(item => item.id === p.id ? p : item));
        markChange();
        logActivity('INVENTORY', `Producto actualizado: ${p.name}`);
    };
    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(item => item.id !== id));
        markChange();
        logActivity('INVENTORY', `Producto eliminado ID: ${id}`);
    };
    const adjustStock = (id: string, amount: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    const newVariants = p.variants.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + amount : Math.max(0, v.stock - amount) } : v);
                    return { ...p, variants: newVariants, stock: newVariants.reduce((sum, v) => sum + v.stock, 0) };
                }
                return { ...p, stock: type === 'IN' ? p.stock + amount : Math.max(0, p.stock - amount) };
            }
            return p;
        }));
        markChange();
        logActivity('INVENTORY', `Ajuste stock ${type} ${amount} para ${id}`);
    };

    const addCustomer = (c: Customer) => {
        const nextId = (settings.sequences.customerStart + customers.length).toString();
        const newCustomer = { ...c, id: c.id || nextId };
        setCustomers(prev => [...prev, newCustomer]);
        markChange();
        logActivity('CRM', `Cliente creado: ${c.name}`);
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
            customerId: id,
            category: 'SALES'
        });
        markChange();
        logActivity('CRM', `Abono cliente ${id}: $${amount}`);
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
        logActivity('SALE', `Venta registrada #${t.id}`);
        notify("Venta Exitosa", `Folio #${t.id} guardado.`, "success");
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
        logActivity('SALE', `Venta anulada #${id}`);
        notify("Venta Anulada", "Inventario restaurado.", "warning");
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
        logActivity('SALE', `Pago registrado venta #${id}`);
    };

    const updateStockAfterSale = (items: {id: string, quantity: number, variantId?: string}[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find(i => i.id === p.id);
            if (item) {
                if (item.variantId && p.variants) {
                    return {
                        ...p,
                        variants: p.variants.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v),
                        stock: p.variants.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v).reduce((sum, v) => sum + v.stock, 0)
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
        logActivity('INVENTORY', `Compra registrada #${p.id}`);
        notify("Compra Exitosa", "Stock actualizado y gasto registrado.", "success");
    };

    const addOrder = (o: Order) => {
        const nextId = (settings.sequences.orderStart + orders.length).toString();
        const newOrder = { ...o, id: o.id || nextId };
        setOrders(prev => [...prev, newOrder]);
        markChange();
        logActivity('ORDER', `Pedido creado #${newOrder.id}`);
        notify("Pedido Creado", "Se ha añadido a la lista de producción.", "success");
    };
    const updateOrderStatus = (id: string, status: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        markChange();
        logActivity('ORDER', `Pedido #${id} cambio a ${status}`);
    };
    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        markChange();
        logActivity('ORDER', `Pedido eliminado #${id}`);
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
        logActivity('USER_MGMT', `Usuario creado: ${u.username}`);
    };
    const updateUser = (u: User) => {
        setUsers(prev => prev.map(item => item.id === u.id ? u : item));
        markChange();
    };
    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(item => item.id !== id));
        markChange();
        logActivity('USER_MGMT', `Usuario eliminado: ${id}`);
    };

    const updateSettings = (s: BusinessSettings) => {
        setSettings(s);
        markChange();
        logActivity('SETTINGS', 'Configuración actualizada');
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
            
            markChange();
            return true;
        } catch (e) {
            console.error("Import error", e);
            return false;
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

    // --- REAL AUTH ---
    const login = async (u: string, p: string, code?: string): Promise<'SUCCESS' | 'INVALID_CREDENTIALS' | '2FA_REQUIRED' | 'INVALID_2FA' | 'LOCKED'> => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        
        if (!user) return 'INVALID_CREDENTIALS';
        if (!user.active) return 'LOCKED';
        if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return 'LOCKED';

        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        
        if (!isValid) {
            // Implement lockout logic
            const attempts = (user.failedLoginAttempts || 0) + 1;
            let lockout: string | undefined = undefined;
            if (attempts >= 5) {
                const lockTime = new Date();
                lockTime.setMinutes(lockTime.getMinutes() + 15);
                lockout = lockTime.toISOString();
            }
            updateUser({ ...user, failedLoginAttempts: attempts, lockoutUntil: lockout });
            return 'INVALID_CREDENTIALS';
        }

        if (user.isTwoFactorEnabled) {
            if (!code) return '2FA_REQUIRED';
            if (!user.twoFactorSecret || !verify2FAToken(code, user.twoFactorSecret)) {
                return 'INVALID_2FA';
            }
        }

        // Success
        const updatedUser = { ...user, failedLoginAttempts: 0, lastLogin: new Date().toISOString(), lastActive: new Date().toISOString() };
        updateUser(updatedUser);
        setCurrentUser(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        logActivity('LOGIN', `Inicio de sesión: ${u}`);
        return 'SUCCESS';
    };

    const logout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            setIsLoggingOut(false);
        }, 500);
    };

    const unlockApp = async (p: string): Promise<boolean> => {
        if (!currentUser) return false;
        const isValid = await verifyPassword(p, currentUser.salt, currentUser.passwordHash);
        if (isValid) setIsAppLocked(false);
        return isValid;
    };

    const manualLockApp = () => setIsAppLocked(true);

    const recoverAccount = async (u: string, m: any, a: string, newPass: string): Promise<'SUCCESS' | 'FAIL' | 'USER_NOT_FOUND' | 'INVALID_ANSWER'> => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'USER_NOT_FOUND';

        let isValid = false;
        if (m === 'SECURITY_QUESTION') {
            if (user.securityAnswerHash) {
                isValid = await verifyPassword(a.trim().toLowerCase(), user.salt, user.securityAnswerHash);
            }
        } else {
            isValid = user.recoveryCode === a.trim();
        }

        if (isValid) {
            const salt = generateSalt();
            const hash = await hashPassword(newPass, salt);
            updateUser({ ...user, passwordHash: hash, salt: salt, failedLoginAttempts: 0, lockoutUntil: undefined });
            return 'SUCCESS';
        }
        return 'INVALID_ANSWER';
    };

    const verifyRecoveryAttempt = async (u: string, m: any, a: string): Promise<boolean> => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return false;
        if (m === 'SECURITY_QUESTION' && user.securityAnswerHash) {
            return await verifyPassword(a.trim().toLowerCase(), user.salt, user.securityAnswerHash);
        }
        return user.recoveryCode === a.trim();
    };

    const getUserPublicInfo = (u: string) => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (user) {
            return { securityQuestion: user.securityQuestion };
        }
        return null;
    };

    const generateInvite = (role: UserRole): string => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const invite: UserInvite = {
            code,
            role,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.username || 'System'
        };
        setUserInvites(prev => [...prev, invite]);
        markChange();
        return code;
    };

    // UserData is ANY to accept password field which is not in User interface
    const registerWithInvite = async (code: string, userData: any): Promise<'SUCCESS' | 'INVALID_CODE' | 'USERNAME_EXISTS'> => {
        const inviteIndex = userInvites.findIndex(i => i.code === code);
        if (inviteIndex === -1) return 'INVALID_CODE';
        
        if (users.some(u => u.username.toLowerCase() === userData.username.toLowerCase())) {
            return 'USERNAME_EXISTS';
        }

        const invite = userInvites[inviteIndex];
        
        // Hashes
        const salt = generateSalt();
        const hash = await hashPassword(userData.password, salt);
        let secHash = undefined;
        if (userData.securityAnswer) {
            secHash = await hashPassword(userData.securityAnswer.trim().toLowerCase(), salt);
        }

        const newUser: User = {
            id: crypto.randomUUID(),
            username: userData.username,
            fullName: userData.fullName,
            role: invite.role,
            active: true,
            passwordHash: hash,
            salt: salt,
            securityQuestion: userData.securityQuestion,
            securityAnswerHash: secHash,
            isTwoFactorEnabled: userData.isTwoFactorEnabled,
            twoFactorSecret: userData.twoFactorSecret,
            recoveryCode: generateRecoveryCode() 
        };

        addUser(newUser);
        
        // Remove invite
        const newInvites = [...userInvites];
        newInvites.splice(inviteIndex, 1);
        setUserInvites(newInvites);
        markChange();

        return 'SUCCESS';
    };

    const deleteInvite = (code: string) => {
        setUserInvites(prev => prev.filter(i => i.code !== code));
        markChange();
    };

    // --- BLUETOOTH ---
    const connectBtPrinter = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }] // Standard printer service UUID
            });
            const server = await device.gatt?.connect();
            const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            
            setBtDevice(device);
            setBtCharacteristic(characteristic || null);
            notify("Impresora Conectada", device.name || "Dispositivo Bluetooth", "success");
        } catch (e: any) {
            throw e;
        }
    };

    const disconnectBtPrinter = () => {
        if (btDevice?.gatt?.connected) {
            btDevice.gatt.disconnect();
        }
        setBtDevice(null);
        setBtCharacteristic(null);
    };

    const sendBtData = async (data: Uint8Array) => {
        if (btCharacteristic) {
            // Send in chunks
            const chunkSize = 512;
            for (let i = 0; i < data.length; i += chunkSize) {
                await btCharacteristic.writeValue(data.slice(i, i + chunkSize));
            }
        }
    };

    // Auto-lock monitor
    useEffect(() => {
        if (settings.securityConfig?.autoLockMinutes > 0 && currentUser && !isAppLocked) {
            let timer: any;
            const resetTimer = () => {
                clearTimeout(timer);
                timer = setTimeout(() => setIsAppLocked(true), settings.securityConfig.autoLockMinutes * 60000);
                // Also update last active
                if (currentUser) {
                    const now = new Date();
                    if (now.getTime() - new Date(currentUser.lastActive || 0).getTime() > 60000) {
                        updateUser({ ...currentUser, lastActive: now.toISOString() });
                    }
                }
            };
            
            window.addEventListener('mousemove', resetTimer);
            window.addEventListener('keydown', resetTimer);
            window.addEventListener('click', resetTimer);
            resetTimer();

            return () => {
                clearTimeout(timer);
                window.removeEventListener('mousemove', resetTimer);
                window.removeEventListener('keydown', resetTimer);
                window.removeEventListener('click', resetTimer);
            };
        }
    }, [settings.securityConfig?.autoLockMinutes, currentUser, isAppLocked]);

    // --- SYNC ---
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

    return (
        <StoreContext.Provider value={{
            products, customers, transactions, suppliers, purchases, orders, cashMovements, settings, users, userInvites, categories, activityLogs, toasts, currentUser, isSyncing, hasPendingChanges, incomingOrder, isLoggingOut, isAppLocked, btDevice, btCharacteristic,
            connectBtPrinter, disconnectBtPrinter, sendBtData, addProduct, updateProduct, deleteProduct, adjustStock, addCustomer, updateCustomer, deleteCustomer, processCustomerPayment, addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale, addSupplier, updateSupplier, deleteSupplier, addPurchase, addOrder, updateOrderStatus, deleteOrder, sendOrderToPOS, clearIncomingOrder, addCashMovement, deleteCashMovement, addUser, updateUser, deleteUser, login, logout, unlockApp, manualLockApp, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo, generateInvite, registerWithInvite, deleteInvite, updateSettings, hardReset, importData, addCategory, removeCategory, pullFromCloud, pushToCloud, notify, removeToast, logActivity
        }}>
            {children}
        </StoreContext.Provider>
    );
};
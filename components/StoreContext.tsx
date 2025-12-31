import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
    Product, Customer, Transaction, Supplier, Purchase, Order, CashMovement, 
    BusinessSettings, User, UserInvite, ActivityLog, ToastNotification, 
    ProductType, CartItem, UserRole, BudgetConfig, ProductVariant
} from '../types';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { playSystemSound } from '../utils/sound';
import { generateSalt, hashPassword, verifyPassword } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';

const generateRecoveryCode = () => {
    return Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
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
    productionDoc: { title: 'HOJA DE PRODUCCION', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' }
};

interface StoreContextType {
    products: Product[];
    categories: string[];
    customers: Customer[];
    transactions: Transaction[];
    suppliers: Supplier[];
    purchases: Purchase[];
    orders: Order[];
    cashMovements: CashMovement[];
    settings: BusinessSettings;
    users: User[];
    userInvites: UserInvite[];
    activityLogs: ActivityLog[];
    currentUser: User | null;
    toasts: ToastNotification[];
    
    isSyncing: boolean;
    hasPendingChanges: boolean;
    isLoggingOut: boolean;
    isAppLocked: boolean;
    incomingOrder: Order | null;

    addProduct: (p: Product) => void;
    updateProduct: (p: Product) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;
    updateStockAfterSale: (items: any[]) => void;
    addCategory: (c: string) => void;
    removeCategory: (c: string) => void;

    addTransaction: (t: Transaction, options?: { shouldAffectCash?: boolean }) => void;
    updateTransaction: (id: string, updates: Partial<Transaction>) => void;
    deleteTransaction: (id: string, itemsToRestore: any[]) => void;
    registerTransactionPayment: (id: string, amount: number, method: string) => void;

    addCustomer: (c: Customer) => void;
    updateCustomer: (c: Customer) => void;
    deleteCustomer: (id: string) => void;
    processCustomerPayment: (id: string, amount: number) => void;

    addSupplier: (s: Supplier) => void;
    updateSupplier: (s: Supplier) => void;
    deleteSupplier: (id: string) => void;
    addPurchase: (p: Purchase) => void;

    addCashMovement: (m: CashMovement) => void;
    deleteCashMovement: (id: string) => void;

    addOrder: (o: Order) => void;
    updateOrder: (o: Order) => void;
    updateOrderStatus: (id: string, status: string) => void;
    convertOrderToSale: (orderId: string) => void;
    deleteOrder: (id: string) => void;
    sendOrderToPOS: (orderId: string) => void;
    clearIncomingOrder: () => void;

    updateSettings: (s: BusinessSettings) => void;
    importData: (json: any) => Promise<boolean>;
    login: (u: string, p: string, code?: string) => Promise<string>;
    logout: () => void;
    addUser: (u: User) => void;
    updateUser: (u: User) => void;
    deleteUser: (id: string) => void;
    recoverAccount: (u: string, m: string, a: string, p: string) => Promise<string>;
    verifyRecoveryAttempt: (u: string, m: string, a: string) => Promise<boolean>;
    getUserPublicInfo: (u: string) => any;
    unlockApp: (p: string) => Promise<boolean>;
    manualLockApp: () => void;
    
    notify: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    removeToast: (id: string) => void;
    requestNotificationPermission: () => Promise<boolean>;
    playSound: (type: any) => void;

    logActivity: (action: any, details: string) => void;
    pullFromCloud: (url?: string, secret?: string, silent?: boolean, force?: boolean) => Promise<boolean>;
    pushToCloud: (overrideData?: any) => Promise<void>;
    hardReset: () => void;

    generateInvite: (role: UserRole) => string;
    registerWithInvite: (code: string, userData: any) => Promise<string>;
    deleteInvite: (code: string) => void;

    btDevice: BluetoothDevice | null;
    btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
    connectBtPrinter: () => Promise<void>;
    disconnectBtPrinter: () => void;
    sendBtData: (data: Uint8Array) => Promise<void>;
}

const StoreContext = createContext<StoreContextType>({} as StoreContextType);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<string[]>(['General']);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
    const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
    const [users, setUsers] = useState<User[]>([]);
    const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);

    // Bluetooth
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // Refs for accessing state in callbacks/intervals without dependency loops
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

    const markLocalChange = () => {
        if (settings.enableCloudSync) {
            setHasPendingChanges(true);
        }
    };

    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
        
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

    const playSound = (type: any) => {
        if (settings.soundConfig?.enabled) {
            playSystemSound(type, settings.soundConfig.volume);
        }
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
        markLocalChange();
    };

    // --- ACTIONS ---
    const addProduct = (p: Product) => {
        const newProduct = { ...p, id: p.id || (Date.now().toString()) };
        setProducts(prev => [...prev, newProduct]);
        markLocalChange();
        logActivity('INVENTORY', `Producto creado: ${p.name}`);
    };

    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
        markLocalChange();
        logActivity('INVENTORY', `Producto actualizado: ${p.name}`);
    };

    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        markLocalChange();
        logActivity('INVENTORY', `Producto eliminado ID: ${id}`);
    };

    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    const newVariants = p.variants.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty) } : v);
                    return { ...p, variants: newVariants, stock: newVariants.reduce((sum, v) => sum + v.stock, 0) };
                }
                const newStock = type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty);
                return { ...p, stock: newStock };
            }
            return p;
        }));
        markLocalChange();
        logActivity('INVENTORY', `Ajuste stock ${type} ${qty} para ${id}`);
    };

    const updateStockAfterSale = (items: any[]) => {
        setProducts(prev => prev.map(p => {
            const soldItems = items.filter(i => i.id === p.id);
            if (soldItems.length === 0) return p;

            let newVariants = p.variants ? [...p.variants] : undefined;
            let totalStock = p.stock;

            soldItems.forEach(item => {
                if (item.variantId && newVariants) {
                    newVariants = newVariants!.map(v => v.id === item.variantId ? { ...v, stock: v.stock - item.quantity } : v);
                } else {
                    totalStock -= item.quantity;
                }
            });

            if (newVariants) {
                totalStock = newVariants.reduce((sum, v) => sum + v.stock, 0);
            }

            return { ...p, stock: totalStock, variants: newVariants };
        }));
        markLocalChange();
    };

    const addCategory = (c: string) => {
        if (!categories.includes(c)) setCategories(prev => [...prev, c]);
        markLocalChange();
    };

    const removeCategory = (c: string) => {
        setCategories(prev => prev.filter(cat => cat !== c));
        markLocalChange();
    };

    // Transactions
    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        setTransactions(prev => [t, ...prev]);
        
        // Auto add to cash if applicable
        if (options?.shouldAffectCash !== false && t.paymentMethod === 'cash' && t.paymentStatus !== 'pending' && t.amountPaid > 0) {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'DEPOSIT',
                amount: t.amountPaid,
                description: `Venta #${t.id}`,
                date: t.date,
                category: 'SALES'
            });
        }
        
        // Update Customer Debt
        if (t.customerId) {
            const debtIncrease = t.total - (t.amountPaid || 0);
            if (debtIncrease > 0) {
                setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + debtIncrease } : c));
            }
        }

        markLocalChange();
        logActivity('SALE', `Venta registrada #${t.id}`);
        notify("Venta Exitosa", `Folio #${t.id} guardado.`, "success");
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        markLocalChange();
    };

    const deleteTransaction = (id: string, itemsToRestore: any[]) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' } : t));
        
        // Restore stock
        setProducts(prev => prev.map(p => {
            const restoredItems = itemsToRestore.filter(i => i.id === p.id);
            if (restoredItems.length === 0) return p;

            let newVariants = p.variants ? [...p.variants] : undefined;
            let totalStock = p.stock;

            restoredItems.forEach(item => {
                if (item.variantId && newVariants) {
                    newVariants = newVariants!.map(v => v.id === item.variantId ? { ...v, stock: v.stock + item.quantity } : v);
                } else {
                    totalStock += item.quantity;
                }
            });

            if (newVariants) {
                totalStock = newVariants.reduce((sum, v) => sum + v.stock, 0);
            }
            return { ...p, stock: totalStock, variants: newVariants };
        }));

        markLocalChange();
        logActivity('SALE', `Venta anulada #${id}`);
        notify("Venta Anulada", "Inventario restaurado.", "warning");
    };

    const registerTransactionPayment = (id: string, amount: number, method: string) => {
        setTransactions(prev => prev.map(t => {
            if (t.id === id) {
                const newPaid = (t.amountPaid || 0) + amount;
                const status = newPaid >= t.total ? 'paid' : 'partial';
                
                // If paid, reduce customer debt
                if (t.customerId) {
                    setCustomers(cPrev => cPrev.map(c => c.id === t.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
                }

                // Add to Cash Register
                addCashMovement({
                    id: crypto.randomUUID(),
                    type: 'DEPOSIT',
                    amount: amount,
                    description: `Abono Venta #${id} (${method})`,
                    date: new Date().toISOString(),
                    category: 'SALES'
                });

                return { ...t, amountPaid: newPaid, paymentStatus: status };
            }
            return t;
        }));
        markLocalChange();
        logActivity('SALE', `Pago registrado venta #${id}`);
    };

    // Customers
    const addCustomer = (c: Customer) => {
        // Simple sequential ID if not provided or empty
        const nextId = (settings.sequences.customerStart + customers.length).toString();
        const newCustomer = { ...c, id: c.id || nextId };
        setCustomers(prev => [...prev, newCustomer]);
        markLocalChange();
        logActivity('CRM', `Cliente creado: ${c.name}`);
    };

    const updateCustomer = (c: Customer) => {
        setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust));
        markLocalChange();
        logActivity('CRM', `Cliente actualizado: ${c.name}`);
    };

    const deleteCustomer = (id: string) => {
        setCustomers(prev => prev.filter(c => c.id !== id));
        markLocalChange();
        logActivity('CRM', `Cliente eliminado: ${id}`);
    };

    const processCustomerPayment = (id: string, amount: number) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: `Abono a Cuenta Cliente #${id}`,
            date: new Date().toISOString(),
            category: 'SALES',
            customerId: id
        });

        markLocalChange();
        logActivity('CRM', `Abono cliente ${id}: $${amount}`);
        notify("Abono Registrado", "La deuda del cliente ha disminuido.", "success");
    };

    // Suppliers & Purchases
    const addSupplier = (s: Supplier) => {
        setSuppliers(prev => [...prev, s]);
        markLocalChange();
        logActivity('CRM', `Proveedor creado: ${s.name}`);
    };

    const updateSupplier = (s: Supplier) => {
        setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup));
        markLocalChange();
    };

    const deleteSupplier = (id: string) => {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        markLocalChange();
    };

    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [p, ...prev]);
        
        // Add items to stock
        setProducts(prev => prev.map(prod => {
            const item = p.items.find(i => i.productId === prod.id);
            if (item) {
                // If it's a supply, we don't necessarily track stock for sale, but let's assume we do for inventory
                if (item.variantId && prod.variants) {
                    const newVars = prod.variants.map(v => v.id === item.variantId ? { ...v, stock: v.stock + item.quantity } : v);
                    return { ...prod, variants: newVars, stock: newVars.reduce((s, v) => s + v.stock, 0), cost: item.unitCost };
                }
                return { ...prod, stock: prod.stock + item.quantity, cost: item.unitCost };
            }
            return prod;
        }));

        // Register Expense
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'EXPENSE',
            amount: p.total,
            description: `Compra Proveedor: ${p.supplierName}`,
            date: p.date,
            category: 'OPERATIONAL',
            subCategory: 'Mercancía'
        });

        markLocalChange();
        logActivity('INVENTORY', `Compra registrada #${p.id}`);
        notify("Compra Exitosa", "Stock actualizado y gasto registrado.", "success");
    };

    // Cash
    const addCashMovement = (m: CashMovement) => {
        setCashMovements(prev => [m, ...prev]);
        markLocalChange();
    };

    const deleteCashMovement = (id: string) => {
        setCashMovements(prev => prev.filter(m => m.id !== id));
        markLocalChange();
    };

    // Orders
    const addOrder = (o: Order) => {
        const nextId = (settings.sequences.orderStart + orders.length).toString();
        const newOrder = { ...o, id: o.id || nextId };
        setOrders(prev => [newOrder, ...prev]);
        markLocalChange();
        logActivity('ORDER', `Pedido creado #${newOrder.id}`);
        notify("Pedido Creado", "Se ha añadido a la lista de producción.", "success");
    };

    const updateOrder = (o: Order) => {
        setOrders(prev => prev.map(ord => ord.id === o.id ? o : ord));
        markLocalChange();
    };

    const updateOrderStatus = (id: string, status: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
        markLocalChange();
        logActivity('ORDER', `Pedido #${id} cambio a ${status}`);
    };

    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        markLocalChange();
        logActivity('ORDER', `Pedido eliminado #${id}`);
    };

    const convertOrderToSale = (orderId: string) => {
        // Logic handled in POS usually, but helper here
    };

    const sendOrderToPOS = (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            setIncomingOrder(order);
            // Optionally redirect
        }
    };

    const clearIncomingOrder = () => setIncomingOrder(null);

    // Settings
    const updateSettings = (s: BusinessSettings) => {
        setSettings(s);
        markLocalChange();
        logActivity('SETTINGS', 'Configuración actualizada');
    };

    const importData = async (json: any): Promise<boolean> => {
        try {
            if (json.products) setProducts(json.products);
            if (json.customers) setCustomers(json.customers);
            if (json.transactions) setTransactions(json.transactions);
            if (json.suppliers) setSuppliers(json.suppliers);
            if (json.purchases) setPurchases(json.purchases);
            if (json.orders) setOrders(json.orders);
            if (json.cashMovements) setCashMovements(json.cashMovements);
            if (json.settings) setSettings(json.settings);
            if (json.users) setUsers(json.users);
            if (json.categories) setCategories(json.categories);
            
            markLocalChange();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    // Auth
    const login = async (u: string, p: string, code?: string): Promise<string> => {
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

    const addUser = (u: User) => {
        setUsers(prev => [...prev, u]);
        markLocalChange();
        logActivity('USER_MGMT', `Usuario creado: ${u.username}`);
    };

    const updateUser = (u: User) => {
        setUsers(prev => prev.map(usr => usr.id === u.id ? u : usr));
        markLocalChange();
    };

    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        markLocalChange();
        logActivity('USER_MGMT', `Usuario eliminado: ${id}`);
    };

    const recoverAccount = async (u: string, m: string, a: string, newPass: string): Promise<string> => {
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

    const verifyRecoveryAttempt = async (u: string, m: string, a: string): Promise<boolean> => {
        // Just verify, don't change
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

    const unlockApp = async (p: string): Promise<boolean> => {
        if (!currentUser) return false;
        const isValid = await verifyPassword(p, currentUser.salt, currentUser.passwordHash);
        if (isValid) setIsAppLocked(false);
        return isValid;
    };

    const manualLockApp = () => setIsAppLocked(true);

    // Sync
    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean): Promise<boolean> => {
        const targetUrl = url || settings.googleWebAppUrl;
        const targetSecret = secret || settings.cloudSecret;
        
        if (!targetUrl || (!settings.enableCloudSync && !force)) return false;

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
        } catch (e: any) {
            console.error("Push failed", e);
            notify("Error Nube", "No se pudieron guardar los cambios en la nube.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const hardReset = () => {
        if (confirm("¿Estás seguro de borrar todos los datos locales y recargar de la nube?")) {
            localStorage.clear();
            window.location.reload();
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

    // Invites
    const generateInvite = (role: UserRole): string => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const invite: UserInvite = {
            code,
            role,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.username || 'System'
        };
        setUserInvites(prev => [...prev, invite]);
        markLocalChange();
        return code;
    };

    const registerWithInvite = async (code: string, userData: any): Promise<string> => {
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
            recoveryCode: generateRecoveryCode() // Generate recovery code
        };

        addUser(newUser);
        
        // Remove invite
        const newInvites = [...userInvites];
        newInvites.splice(inviteIndex, 1);
        setUserInvites(newInvites);
        markLocalChange();

        return 'SUCCESS';
    };

    const deleteInvite = (code: string) => {
        setUserInvites(prev => prev.filter(i => i.code !== code));
        markLocalChange();
    };

    // Bluetooth
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

    return (
        <StoreContext.Provider value={{
            products, categories, customers, transactions, suppliers, purchases, 
            orders, cashMovements, settings, users, userInvites, activityLogs, 
            currentUser, toasts, isSyncing, hasPendingChanges, isLoggingOut, isAppLocked, incomingOrder,
            
            addProduct, updateProduct, deleteProduct, adjustStock, updateStockAfterSale, 
            addCategory, removeCategory,
            
            addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment,
            
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment, 
            
            addSupplier, updateSupplier, deleteSupplier, addPurchase,
            
            addCashMovement, deleteCashMovement,
            
            addOrder, updateOrder, updateOrderStatus, convertOrderToSale, deleteOrder,
            sendOrderToPOS, clearIncomingOrder,

            updateSettings, importData, login, logout, addUser, updateUser, deleteUser, 
            recoverAccount, verifyRecoveryAttempt, getUserPublicInfo, unlockApp, manualLockApp,
            
            notify, removeToast, requestNotificationPermission: async ()=>true, playSound,
            logActivity, pullFromCloud, pushToCloud, hardReset,
            
            generateInvite, registerWithInvite, deleteInvite,

            btDevice, btCharacteristic, connectBtPrinter, disconnectBtPrinter, sendBtData
        }}>
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => useContext(StoreContext);
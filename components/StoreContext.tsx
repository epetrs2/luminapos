import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
    Product, Transaction, Customer, Supplier, CashMovement, Order, Purchase, 
    User, UserInvite, ActivityLog, BusinessSettings, CartItem, ToastNotification,
    UserRole, PeriodClosure
} from '../types';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { playSystemSound } from '../utils/sound';
import { verifyPassword, hashPassword, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';

// Default Settings
const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'LuminaPOS',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    currency: 'USD',
    taxRate: 0,
    enableTax: false,
    logo: null,
    receiptLogo: null,
    receiptHeader: '',
    receiptFooter: '',
    ticketPaperWidth: '58mm',
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
        clickSound: 'NONE',
        notificationSound: 'NOTE'
    },
    securityConfig: {
        autoLockMinutes: 0,
        blurAppOnBackground: false
    },
    printConfig: {
        customerCopyBehavior: 'ASK'
    },
    sequences: {
        customerStart: 1,
        ticketStart: 1,
        orderStart: 1,
        productStart: 1
    },
    productionDoc: {
        title: 'Orden de Producción',
        showPrices: false,
        showCustomerContact: true,
        showDates: true,
        customFooter: ''
    }
};

// Define Context Type
interface StoreContextType {
    // Data
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
    
    // State
    currentUser: User | null;
    isAppLocked: boolean;
    isSyncing: boolean;
    hasPendingChanges: boolean;
    incomingOrder: Order | null;
    btDevice: BluetoothDevice | null;
    btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
    isLoggingOut: boolean;

    // Actions - Data
    addProduct: (p: Product) => void;
    updateProduct: (p: Product) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;
    
    addTransaction: (t: Transaction, options?: { shouldAffectCash?: boolean }) => void;
    updateTransaction: (id: string, updates: Partial<Transaction>) => void;
    deleteTransaction: (id: string, items: CartItem[]) => void;
    registerTransactionPayment: (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => void;
    rectifyTransactionChannel: (id: string) => void;
    updateStockAfterSale: (items: CartItem[]) => void;

    addCustomer: (c: Customer) => void;
    updateCustomer: (c: Customer) => void;
    deleteCustomer: (id: string) => void;
    processCustomerPayment: (customerId: string, amount: number) => void;

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
    sendOrderToPOS: (o: Order) => void;
    clearIncomingOrder: () => void;

    addPurchase: (p: Purchase) => void;
    deletePurchase: (id: string) => void;

    addUser: (u: User) => void;
    updateUser: (u: User) => void;
    deleteUser: (id: string) => void;
    generateInvite: (role: UserRole) => string;
    deleteInvite: (code: string) => void;
    registerWithInvite: (code: string, userData: Partial<User>) => Promise<string>;
    
    addCategory: (c: string) => void;
    removeCategory: (c: string) => void;

    addPeriodClosure: (pc: PeriodClosure) => void;

    updateSettings: (s: BusinessSettings) => void;
    
    // Actions - Auth/System
    login: (u: string, p: string, code2fa?: string) => Promise<'SUCCESS' | 'INVALID' | 'LOCKED' | '2FA_REQUIRED' | 'INVALID_2FA'>;
    logout: () => void;
    manualLockApp: () => void;
    unlockApp: (p: string) => Promise<boolean>;
    recoverAccount: (u: string, method: string, payload: string, newPass: string) => Promise<'SUCCESS' | 'FAIL'>;
    verifyRecoveryAttempt: (u: string, method: string, payload: string) => Promise<boolean>;
    getUserPublicInfo: (u: string) => any;

    // Actions - Cloud/Sync
    pushToCloud: (data?: any) => Promise<void>;
    pullFromCloud: (url?: string, secret?: string, silent?: boolean, force?: boolean) => Promise<boolean>;
    hardReset: () => void;
    importData: (json: any) => Promise<boolean>;

    // Actions - Utils
    notify: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    removeToast: (id: string) => void;
    flagChange: () => void;
    logActivity: (action: ActivityLog['action'], details: string) => void;

    // Bluetooth
    connectBtPrinter: () => Promise<void>;
    disconnectBtPrinter: () => void;
    sendBtData: (data: Uint8Array) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // --- STATE INITIALIZATION ---
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
    const [categories, setCategories] = useState<string[]>(['General']);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [periodClosures, setPeriodClosures] = useState<PeriodClosure[]>([]);
    const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
    
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAppLocked, setIsAppLocked] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Bluetooth
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // --- PERSISTENCE & INITIALIZATION ---
    useEffect(() => {
        const loadLocal = (key: string, setter: any, def: any) => {
            const stored = localStorage.getItem(`lumina_${key}`);
            if (stored) {
                try { setter(JSON.parse(stored)); } catch (e) { console.error(`Error loading ${key}`, e); }
            } else {
                if (def !== undefined) setter(def);
            }
        };

        loadLocal('products', setProducts, []);
        loadLocal('transactions', setTransactions, []);
        loadLocal('customers', setCustomers, []);
        loadLocal('suppliers', setSuppliers, []);
        loadLocal('cashMovements', setCashMovements, []);
        loadLocal('orders', setOrders, []);
        loadLocal('purchases', setPurchases, []);
        loadLocal('users', setUsers, []);
        loadLocal('userInvites', setUserInvites, []);
        loadLocal('categories', setCategories, ['General']);
        loadLocal('activityLogs', setActivityLogs, []);
        loadLocal('periodClosures', setPeriodClosures, []);
        loadLocal('settings', setSettings, DEFAULT_SETTINGS);

        // Session check
        const sessionUser = sessionStorage.getItem('lumina_session_user');
        if (sessionUser) {
            try { setCurrentUser(JSON.parse(sessionUser)); } catch (e) {}
        }
    }, []);

    // Save to local storage on change
    useEffect(() => localStorage.setItem('lumina_products', JSON.stringify(products)), [products]);
    useEffect(() => localStorage.setItem('lumina_transactions', JSON.stringify(transactions)), [transactions]);
    useEffect(() => localStorage.setItem('lumina_customers', JSON.stringify(customers)), [customers]);
    useEffect(() => localStorage.setItem('lumina_suppliers', JSON.stringify(suppliers)), [suppliers]);
    useEffect(() => localStorage.setItem('lumina_cashMovements', JSON.stringify(cashMovements)), [cashMovements]);
    useEffect(() => localStorage.setItem('lumina_orders', JSON.stringify(orders)), [orders]);
    useEffect(() => localStorage.setItem('lumina_purchases', JSON.stringify(purchases)), [purchases]);
    useEffect(() => localStorage.setItem('lumina_users', JSON.stringify(users)), [users]);
    useEffect(() => localStorage.setItem('lumina_userInvites', JSON.stringify(userInvites)), [userInvites]);
    useEffect(() => localStorage.setItem('lumina_categories', JSON.stringify(categories)), [categories]);
    useEffect(() => localStorage.setItem('lumina_activityLogs', JSON.stringify(activityLogs)), [activityLogs]);
    useEffect(() => localStorage.setItem('lumina_periodClosures', JSON.stringify(periodClosures)), [periodClosures]);
    useEffect(() => localStorage.setItem('lumina_settings', JSON.stringify(settings)), [settings]);

    // Auto-Sync Trigger
    useEffect(() => {
        if (hasPendingChanges && settings.enableCloudSync && settings.googleWebAppUrl) {
            const timeout = setTimeout(() => {
                pushToCloud();
            }, 5000); // Debounce sync 5s
            return () => clearTimeout(timeout);
        }
    }, [hasPendingChanges, settings.enableCloudSync]);

    // --- HELPER FUNCTIONS ---
    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }]);
        if (settings.soundConfig?.enabled) {
            if (type === 'error') playSystemSound(settings.soundConfig.errorSound || 'ERROR', settings.soundConfig.volume);
            else if (type === 'success') playSystemSound(settings.soundConfig.saleSound || 'SUCCESS', settings.soundConfig.volume);
            else playSystemSound(settings.soundConfig.notificationSound || 'NOTE', settings.soundConfig.volume);
        }
        setTimeout(() => removeToast(id), 4000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const flagChange = () => setHasPendingChanges(true);

    const logActivity = (action: ActivityLog['action'], details: string) => {
        if (!currentUser) return;
        const log: ActivityLog = {
            id: crypto.randomUUID(),
            userId: currentUser.id,
            userName: currentUser.username,
            userRole: currentUser.role,
            action,
            details,
            timestamp: new Date().toISOString()
        };
        setActivityLogs(prev => [log, ...prev].slice(0, 500)); // Keep last 500 logs
    };

    // --- DATA ACTIONS ---

    // Transactions (Sales)
    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        setTransactions(prev => [t, ...prev]);
        
        if (options?.shouldAffectCash !== false) {
            // FIX: Usar el monto pagado real. NO usar t.total como respaldo si amountPaid es 0 (Venta Pendiente).
            const amount = t.amountPaid !== undefined ? t.amountPaid : 0;
            
            if (amount > 0) {
                if (t.paymentMethod === 'cash') {
                    addCashMovement({
                        id: crypto.randomUUID(),
                        type: 'DEPOSIT',
                        amount: amount,
                        description: `Venta #${t.id} (Efectivo)`,
                        date: t.date,
                        category: 'SALES',
                        channel: 'CASH'
                    });
                } else if (t.paymentMethod === 'card' || t.paymentMethod === 'transfer') {
                    addCashMovement({
                        id: crypto.randomUUID(),
                        type: 'DEPOSIT',
                        amount: amount,
                        description: `Venta #${t.id} (${t.paymentMethod === 'card' ? 'Tarjeta' : 'Transf.'})`,
                        date: t.date,
                        category: 'SALES',
                        channel: 'VIRTUAL'
                    });
                } else if (t.paymentMethod === 'split') {
                    const cashAmt = t.splitDetails?.cash || 0;
                    const otherAmt = t.splitDetails?.other || 0;
                    
                    if (cashAmt > 0) {
                        addCashMovement({
                            id: crypto.randomUUID(),
                            type: 'DEPOSIT',
                            amount: cashAmt,
                            description: `Venta #${t.id} (Efectivo)`,
                            date: t.date,
                            category: 'SALES',
                            channel: 'CASH'
                        });
                    }
                    if (otherAmt > 0) {
                        addCashMovement({
                            id: crypto.randomUUID(),
                            type: 'DEPOSIT',
                            amount: otherAmt,
                            description: `Venta #${t.id} (Virtual)`,
                            date: t.date,
                            category: 'SALES',
                            channel: 'VIRTUAL'
                        });
                    }
                }
            }
        }
        
        if (t.customerId) {
            const debt = t.total - (t.amountPaid || 0);
            if (debt > 0) {
                setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + debt } : c));
            }
        }
        
        flagChange();
        logActivity('SALE', `Venta registrada #${t.id}`);
        notify("Venta Exitosa", `Ticket #${t.id} guardado.`);
    };

    const updateStockAfterSale = (items: CartItem[]) => {
        setProducts(prev => prev.map(p => {
            const saleItems = items.filter(i => i.id === p.id);
            if (saleItems.length === 0) return p;

            if (p.hasVariants && p.variants) {
                const newVariants = p.variants.map(v => {
                    const soldVariant = saleItems.find(si => si.variantId === v.id);
                    if (soldVariant) {
                        return { ...v, stock: v.stock - soldVariant.quantity };
                    }
                    return v;
                });
                const totalStock = newVariants.reduce((sum, v) => sum + v.stock, 0);
                return { ...p, variants: newVariants, stock: totalStock };
            } else {
                const totalSold = saleItems.reduce((sum, si) => sum + si.quantity, 0);
                return { ...p, stock: p.stock - totalSold };
            }
        }));
        flagChange();
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        flagChange();
    };

    const deleteTransaction = (id: string, items: CartItem[]) => {
        setTransactions(prev => prev.filter(t => t.id !== id));
        // Return Stock
        const itemsToReturn = items.map(i => ({...i, quantity: -i.quantity}));
        updateStockAfterSale(itemsToReturn);
        flagChange();
        logActivity('SALE', `Venta anulada #${id}`);
        notify("Venta Anulada", `La venta #${id} fue eliminada y el stock devuelto.`);
    };

    const registerTransactionPayment = (id: string, amount: number, method: 'cash' | 'transfer' | 'card') => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        const newPaid = (tx.amountPaid || 0) + amount;
        let newStatus: Transaction['paymentStatus'] = 'partial';
        if (newPaid >= tx.total - 0.01) newStatus = 'paid';

        updateTransaction(id, { amountPaid: newPaid, paymentStatus: newStatus });

        // Add movement
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: `Pago a cuenta Ticket #${id} (${method})`,
            date: new Date().toISOString(),
            category: 'SALES',
            channel: method === 'cash' ? 'CASH' : 'VIRTUAL',
            customerId: tx.customerId
        });

        // Update customer debt
        if (tx.customerId) {
            setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        }
        
        flagChange();
        notify("Pago Registrado", `Se abonaron $${amount} a la venta #${id}`, 'success');
    };

    const rectifyTransactionChannel = (id: string) => {
        // Logic to verify/fix funds associated with transaction
        // Simplified: Check payments and ensure they exist in cash movements
        // For now, mostly a placeholder for UI action in SalesHistory
        notify("Sincronización", "Verificando fondos... (Lógica de rectificación no implementada)", "info");
    };

    // Products
    const addProduct = (p: Product) => {
        const id = p.id || (settings.sequences.productStart + products.length).toString();
        setProducts(prev => [...prev, { ...p, id }]);
        flagChange();
        logActivity('INVENTORY', `Producto creado: ${p.name}`);
    };

    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
        flagChange();
        logActivity('INVENTORY', `Producto actualizado: ${p.name}`);
    };

    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        flagChange();
        logActivity('INVENTORY', `Producto eliminado ID: ${id}`);
    };

    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    const newVars = p.variants.map(v => v.id === variantId ? { 
                        ...v, 
                        stock: type === 'IN' ? v.stock + qty : v.stock - qty 
                    } : v);
                    const total = newVars.reduce((acc, v) => acc + v.stock, 0);
                    return { ...p, variants: newVars, stock: total };
                } else {
                    return { ...p, stock: type === 'IN' ? p.stock + qty : p.stock - qty };
                }
            }
            return p;
        }));
        flagChange();
        logActivity('INVENTORY', `Ajuste stock ${type} ${qty} en ID ${id}`);
    };

    // Customers
    const addCustomer = (c: Customer) => {
        const id = c.id || `C-${settings.sequences.customerStart + customers.length}`;
        setCustomers(prev => [...prev, { ...c, id }]);
        flagChange();
        logActivity('CRM', `Cliente creado: ${c.name}`);
    };

    const updateCustomer = (c: Customer) => {
        setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust));
        flagChange();
    };

    const deleteCustomer = (id: string) => {
        setCustomers(prev => prev.filter(c => c.id !== id));
        flagChange();
    };

    const processCustomerPayment = (customerId: string, amount: number) => {
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: `Abono de deuda Cliente #${customerId}`,
            date: new Date().toISOString(),
            category: 'SALES',
            channel: 'CASH', // Assume cash for manual debt payment
            customerId: customerId
        });
        
        flagChange();
        notify("Abono Exitoso", `Se registraron $${amount} a la cuenta del cliente.`);
    };

    // Cash Movements
    const addCashMovement = (m: CashMovement) => {
        setCashMovements(prev => [m, ...prev]);
        flagChange();
        logActivity('CASH', `Movimiento caja: ${m.type} $${m.amount}`);
    };

    const deleteCashMovement = (id: string) => {
        setCashMovements(prev => prev.filter(m => m.id !== id));
        flagChange();
    };

    // Orders
    const addOrder = (o: Order) => {
        const id = o.id || `ORD-${settings.sequences.orderStart + orders.length}`;
        setOrders(prev => [...prev, { ...o, id }]);
        flagChange();
        logActivity('ORDER', `Pedido creado: ${o.customerName}`);
        notify("Pedido Creado", `Orden #${id} registrada.`);
    };

    const updateOrder = (o: Order) => {
        setOrders(prev => prev.map(ord => ord.id === o.id ? o : ord));
        flagChange();
    };

    const updateOrderStatus = (id: string, status: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        flagChange();
    };

    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        flagChange();
    };

    const completeOrder = (id: string) => {
        updateOrderStatus(id, 'COMPLETED');
    };

    const sendOrderToPOS = (o: Order) => {
        setIncomingOrder(o);
    };

    const clearIncomingOrder = () => {
        setIncomingOrder(null);
    };

    // Suppliers & Purchases
    const addSupplier = (s: Supplier) => {
        setSuppliers(prev => [...prev, s]);
        flagChange();
    };

    const updateSupplier = (s: Supplier) => {
        setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup));
        flagChange();
    };

    const deleteSupplier = (id: string) => {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        flagChange();
    };

    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [...prev, p]);
        // Update stock based on purchase
        p.items.forEach(item => {
            adjustStock(item.productId, item.quantity, 'IN', item.variantId);
        });
        
        // Register expense
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'EXPENSE',
            amount: p.total,
            description: `Compra Proveedor: ${p.supplierName}`,
            date: p.date,
            category: 'OPERATIONAL',
            channel: 'CASH'
        });

        flagChange();
        notify("Compra Registrada", "Stock actualizado y gasto registrado.");
    };

    const deletePurchase = (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (purchase) {
            // Revert stock
            purchase.items.forEach(item => {
                adjustStock(item.productId, item.quantity, 'OUT', item.variantId);
            });
            setPurchases(prev => prev.filter(p => p.id !== id));
            flagChange();
            notify("Compra Eliminada", "Stock revertido.");
        }
    };

    // Users
    const addUser = (u: User) => {
        setUsers(prev => [...prev, u]);
        flagChange();
    };

    const updateUser = (u: User) => {
        setUsers(prev => prev.map(user => user.id === u.id ? u : user));
        flagChange();
    };

    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        flagChange();
    };

    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const invite: UserInvite = {
            code,
            role,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.username || 'System'
        };
        setUserInvites(prev => [...prev, invite]);
        flagChange();
        return code;
    };

    const deleteInvite = (code: string) => {
        setUserInvites(prev => prev.filter(i => i.code !== code));
        flagChange();
    };

    const registerWithInvite = async (code: string, userData: Partial<User>) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        
        // Username check
        if (users.some(u => u.username.toLowerCase() === userData.username?.toLowerCase())) {
            return 'USERNAME_EXISTS';
        }

        let passwordHash = '';
        let salt = generateSalt();
        if (userData.password) {
            passwordHash = await hashPassword(userData.password, salt);
        }

        let securityAnswerHash = '';
        if (userData.securityAnswer) {
            securityAnswerHash = await hashPassword(userData.securityAnswer.toLowerCase(), salt);
        }

        const newUser: User = {
            id: crypto.randomUUID(),
            username: userData.username!,
            fullName: userData.fullName!,
            role: invite.role,
            active: true,
            passwordHash,
            salt,
            securityQuestion: userData.securityQuestion,
            securityAnswerHash,
            isTwoFactorEnabled: userData.isTwoFactorEnabled,
            twoFactorSecret: userData.twoFactorSecret,
            recoveryCode: userData.recoveryCode || 'PENDING'
        };

        addUser(newUser);
        deleteInvite(code);
        return 'SUCCESS';
    };

    // Settings & Categories
    const updateSettings = (s: BusinessSettings) => {
        setSettings(s);
        flagChange();
    };

    const addCategory = (c: string) => {
        if (!categories.includes(c)) {
            setCategories(prev => [...prev, c]);
            flagChange();
        }
    };

    const removeCategory = (c: string) => {
        setCategories(prev => prev.filter(cat => cat !== c));
        flagChange();
    };

    const addPeriodClosure = (pc: PeriodClosure) => {
        setPeriodClosures(prev => [...prev, pc]);
        flagChange();
        notify("Cierre de Periodo", "El periodo fiscal ha sido cerrado correctamente.", "success");
    };

    // --- AUTH ACTIONS ---
    const login = async (u: string, p: string, code2fa?: string) => {
        const user = users.find(user => user.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'INVALID';
        
        if (!user.active) return 'LOCKED';
        if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return 'LOCKED';

        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        
        if (isValid) {
            if (user.isTwoFactorEnabled) {
                if (!code2fa) return '2FA_REQUIRED';
                if (!verify2FAToken(code2fa, user.twoFactorSecret || '')) return 'INVALID_2FA';
            }

            // Reset failed attempts
            updateUser({ ...user, failedLoginAttempts: 0, lastLogin: new Date().toISOString(), lastActive: new Date().toISOString() });
            setCurrentUser(user);
            sessionStorage.setItem('lumina_session_user', JSON.stringify(user));
            logActivity('LOGIN', `Inicio de sesión exitoso: ${user.username}`);
            return 'SUCCESS';
        } else {
            // Handle failed attempts
            const attempts = (user.failedLoginAttempts || 0) + 1;
            let lockoutUntil = user.lockoutUntil;
            
            if (attempts >= 5) {
                const lockoutTime = new Date();
                lockoutTime.setMinutes(lockoutTime.getMinutes() + 15); // 15 min lock
                lockoutUntil = lockoutTime.toISOString();
            }
            
            updateUser({ ...user, failedLoginAttempts: attempts, lockoutUntil });
            return 'INVALID';
        }
    };

    const logout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            setCurrentUser(null);
            sessionStorage.removeItem('lumina_session_user');
            setIsLoggingOut(false);
        }, 300);
    };

    const manualLockApp = () => {
        setIsAppLocked(true);
    };

    const unlockApp = async (password: string) => {
        if (!currentUser) return false;
        const isValid = await verifyPassword(password, currentUser.salt, currentUser.passwordHash);
        if (isValid) {
            setIsAppLocked(false);
            return true;
        }
        return false;
    };

    const getUserPublicInfo = (username: string) => {
        const u = users.find(user => user.username.toLowerCase() === username.toLowerCase());
        if (!u) return null;
        return { securityQuestion: u.securityQuestion };
    };

    const verifyRecoveryAttempt = async (u: string, method: string, payload: string) => {
        // Implementation moved inside recoverAccount or kept simple here
        return false; 
    };

    const recoverAccount = async (u: string, method: string, payload: string, newPass: string) => {
        const user = users.find(user => user.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'FAIL';

        let isValid = false;
        if (method === 'SECURITY_QUESTION') {
            if (user.securityAnswerHash) {
                isValid = await verifyPassword(payload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
            }
        } else {
            // Recovery Code
            isValid = user.recoveryCode === payload.trim();
        }

        if (isValid) {
            const newSalt = generateSalt();
            const newHash = await hashPassword(newPass, newSalt);
            updateUser({ ...user, passwordHash: newHash, salt: newSalt, failedLoginAttempts: 0, lockoutUntil: undefined });
            logActivity('RECOVERY', `Cuenta recuperada: ${user.username}`);
            return 'SUCCESS';
        }
        return 'FAIL';
    };

    // --- SYNC ACTIONS ---
    const pushToCloud = async (data?: any) => {
        if (!settings.googleWebAppUrl || !settings.enableCloudSync) return;
        
        setIsSyncing(true);
        try {
            const payload = {
                products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, periodClosures, settings,
                ...data
            };
            await pushFullDataToCloud(settings.googleWebAppUrl, settings.cloudSecret, payload);
            setHasPendingChanges(false);
        } catch (e) {
            console.error("Sync push failed", e);
            notify("Error Sincronización", "No se pudo guardar en la nube.", "warning");
        } finally {
            setIsSyncing(false);
        }
    };

    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean) => {
        const targetUrl = url || settings.googleWebAppUrl;
        const targetSecret = secret || settings.cloudSecret;
        
        if (!targetUrl) return false;

        if (!silent) setIsSyncing(true);
        try {
            const data = await fetchFullDataFromCloud(targetUrl, targetSecret);
            if (data) {
                // Determine conflict resolution (Cloud wins if force=true or cloud is newer?)
                // For simplicity, Cloud wins here if manually triggered
                setProducts(data.products || []);
                setTransactions(data.transactions || []);
                setCustomers(data.customers || []);
                setSuppliers(data.suppliers || []);
                setCashMovements(data.cashMovements || []);
                setOrders(data.orders || []);
                setPurchases(data.purchases || []);
                setUsers(data.users || []);
                setUserInvites(data.userInvites || []);
                setCategories(data.categories || []);
                setActivityLogs(data.activityLogs || []);
                setPeriodClosures(data.periodClosures || []);
                setSettings(data.settings || DEFAULT_SETTINGS);
                setHasPendingChanges(false);
                return true;
            }
        } catch (e) {
            console.error("Sync pull failed", e);
            if (!silent) notify("Error Sincronización", "No se pudo descargar de la nube.", "error");
        } finally {
            if (!silent) setIsSyncing(false);
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
            if (json.products) setProducts(json.products);
            if (json.transactions) setTransactions(json.transactions);
            if (json.customers) setCustomers(json.customers);
            if (json.suppliers) setSuppliers(json.suppliers);
            if (json.cashMovements) setCashMovements(json.cashMovements);
            if (json.orders) setOrders(json.orders);
            if (json.purchases) setPurchases(json.purchases);
            if (json.users) setUsers(json.users);
            if (json.userInvites) setUserInvites(json.userInvites);
            if (json.categories) setCategories(json.categories);
            if (json.activityLogs) setActivityLogs(json.activityLogs);
            if (json.periodClosures) setPeriodClosures(json.periodClosures);
            if (json.settings) setSettings(json.settings);
            
            flagChange();
            return true;
        } catch (e) {
            return false;
        }
    };

    // --- BLUETOOTH MOCK ---
    const connectBtPrinter = async () => {
        // In a real implementation, use navigator.bluetooth
        // For now, assume success if browser supports it
        if ((navigator as any).bluetooth) {
            try {
                const device = await (navigator as any).bluetooth.requestDevice({
                    filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }] // Standard ESC/POS service
                });
                setBtDevice(device);
                // Connect GATT...
                notify("Bluetooth", "Conectado a impresora (Simulado)", "success");
            } catch (e) {
                throw e;
            }
        } else {
            throw new Error("Bluetooth no soportado");
        }
    };

    const disconnectBtPrinter = () => {
        setBtDevice(null);
        setBtCharacteristic(null);
    };

    const sendBtData = async (data: Uint8Array) => {
        // Real implementation would write to characteristic
        console.log("Sending bytes to printer:", data.length);
        return new Promise<void>(r => setTimeout(r, 500));
    };

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, periodClosures, settings, toasts,
            currentUser, isAppLocked, isSyncing, hasPendingChanges, incomingOrder, btDevice, btCharacteristic, isLoggingOut,
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
            login, logout, manualLockApp, unlockApp, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
            pushToCloud, pullFromCloud, hardReset, importData,
            notify, removeToast, flagChange, logActivity,
            connectBtPrinter, disconnectBtPrinter, sendBtData
        }}>
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error('useStore must be used within a StoreProvider');
    }
    return context;
};
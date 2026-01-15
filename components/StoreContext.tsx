
// ... existing imports
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
    Product, Customer, Supplier, Transaction, CashMovement, Order, Purchase, 
    User, UserRole, UserInvite, ActivityLog, BusinessSettings, ToastNotification,
    ProductType, AppView, CartItem, PeriodClosure
} from '../types';
import { playSystemSound } from '../utils/sound';
import { pushFullDataToCloud, fetchFullDataFromCloud } from '../services/syncService';
import { verifyPassword, hashPassword, generateSalt } from '../utils/security';
import { verify2FAToken } from '../utils/twoFactor';

// Default Settings
const DEFAULT_SETTINGS: BusinessSettings = {
    name: 'Mi Negocio',
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
        profitPercentage: 20, 
        fiscalStartDate: new Date().toISOString().split('T')[0], // Defaults to today
        cycleType: 'MONTHLY',
        cycleLength: 30
    },
    notificationsEnabled: true,
    soundConfig: { enabled: true, volume: 0.5, saleSound: 'SUCCESS', errorSound: 'ERROR', clickSound: 'POP', notificationSound: 'NOTE' },
    securityConfig: { autoLockMinutes: 0, blurAppOnBackground: false },
    printConfig: { customerCopyBehavior: 'ASK' },
    sequences: { customerStart: 1, ticketStart: 1, orderStart: 1, productStart: 1 },
    productionDoc: { title: 'ORDEN DE PRODUCCIÓN', showPrices: false, showCustomerContact: true, showDates: true, customFooter: '' }
};

interface StoreContextType {
// ... existing interface methods
    products: Product[];
    customers: Customer[];
    suppliers: Supplier[];
    transactions: Transaction[];
    cashMovements: CashMovement[];
    orders: Order[];
    purchases: Purchase[];
    users: User[];
    userInvites: UserInvite[];
    activityLogs: ActivityLog[];
    periodClosures: PeriodClosure[]; // NEW
    settings: BusinessSettings;
    currentUser: User | null;
    toasts: ToastNotification[];
    isSyncing: boolean;
    hasPendingChanges: boolean;
    categories: string[];
    btDevice: BluetoothDevice | null;
    btCharacteristic: BluetoothRemoteGATTCharacteristic | null;
    incomingOrder: Order | null;
    isLoggingOut: boolean;
    isAppLocked: boolean;

    addProduct: (product: Product) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (id: string) => void;
    adjustStock: (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => void;
    addCategory: (category: string) => void;
    removeCategory: (category: string) => void;

    addTransaction: (transaction: Transaction, options?: { shouldAffectCash?: boolean }) => void;
    updateTransaction: (id: string, updates: Partial<Transaction>) => void;
    deleteTransaction: (id: string, items: any[]) => void;
    registerTransactionPayment: (id: string, amount: number, method: 'cash' | 'card' | 'transfer') => void;
    updateStockAfterSale: (items: any[]) => void;
    rectifyTransactionChannel: (transactionId: string) => void; // NEW METHOD

    addCustomer: (customer: Customer) => void;
    updateCustomer: (customer: Customer) => void;
    deleteCustomer: (id: string) => void;
    processCustomerPayment: (id: string, amount: number) => void;

    addSupplier: (supplier: Supplier) => void;
    updateSupplier: (supplier: Supplier) => void;
    deleteSupplier: (id: string) => void;
    addPurchase: (purchase: Purchase) => void;
    deletePurchase: (id: string) => void;

    addCashMovement: (movement: CashMovement) => void;
    deleteCashMovement: (id: string) => void;

    addPeriodClosure: (closure: PeriodClosure) => void; // NEW

    addOrder: (order: Order) => void;
    updateOrder: (order: Order) => void;
    updateOrderStatus: (id: string, status: string) => void;
    completeOrder: (id: string) => void; 
    convertOrderToSale: (order: Order) => void; 
    deleteOrder: (id: string) => void;
    sendOrderToPOS: (order: Order) => void;
    clearIncomingOrder: () => void;

    updateSettings: (settings: BusinessSettings) => void;
    importData: (data: any) => Promise<boolean>;
    
    login: (u: string, p: string, code?: string) => Promise<'SUCCESS' | 'INVALID' | '2FA_REQUIRED' | 'LOCKED' | 'INVALID_2FA'>;
    logout: () => void;
    unlockApp: (password: string) => Promise<boolean>;
    manualLockApp: () => void;
    
    addUser: (user: User) => void;
    updateUser: (user: User) => void;
    deleteUser: (id: string) => void;
    recoverAccount: (username: string, method: string, payload: string, newPass: string) => Promise<'SUCCESS' | 'FAIL'>;
    verifyRecoveryAttempt: (username: string, method: string, payload: string) => Promise<boolean>;
    getUserPublicInfo: (username: string) => { securityQuestion?: string } | null;
    
    generateInvite: (role: UserRole) => string;
    registerWithInvite: (code: string, userData: Partial<User> & { password?: string; securityAnswer?: string }) => Promise<'SUCCESS' | 'INVALID_CODE' | 'USERNAME_EXISTS'>;
    deleteInvite: (code: string) => void;

    notify: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    removeToast: (id: string) => void;
    requestNotificationPermission: () => Promise<boolean>;
    playSound: (type: any) => void;

    logActivity: (action: ActivityLog['action'], details: string) => void;
    pullFromCloud: (url?: string, secret?: string, silent?: boolean, force?: boolean) => Promise<boolean>;
    pushToCloud: (overrideData?: any) => Promise<boolean>;
    hardReset: () => void;

    connectBtPrinter: () => Promise<void>;
    disconnectBtPrinter: () => void;
    sendBtData: (data: Uint8Array) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ... State definitions (unchanged) ...
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [periodClosures, setPeriodClosures] = useState<PeriodClosure[]>([]); // NEW STATE
    const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isAppLocked, setIsAppLocked] = useState(false);
    
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    
    // Bluetooth
    const [btDevice, setBtDevice] = useState<BluetoothDevice | null>(null);
    const [btCharacteristic, setBtCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

    // Derived
    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    // Refs (unchanged)
    const storeRef = useRef({
        products, customers, suppliers, transactions, cashMovements, orders, purchases, users, userInvites, activityLogs, periodClosures, settings
    });
    const pendingChangesRef = useRef(false);

    useEffect(() => {
        storeRef.current = { products, customers, suppliers, transactions, cashMovements, orders, purchases, users, userInvites, activityLogs, periodClosures, settings };
    }, [products, customers, suppliers, transactions, cashMovements, orders, purchases, users, userInvites, activityLogs, periodClosures, settings]);

    useEffect(() => {
        pendingChangesRef.current = hasPendingChanges;
    }, [hasPendingChanges]);

    // ... Load and Save Effects (unchanged) ...
    // Load from LocalStorage on mount
    useEffect(() => {
        const load = (key: string, setter: any, def: any) => {
            const stored = localStorage.getItem(key);
            if (stored) setter(JSON.parse(stored));
            else setter(def);
        };
        load('products', setProducts, []);
        load('customers', setCustomers, []);
        load('suppliers', setSuppliers, []);
        load('transactions', setTransactions, []);
        load('cashMovements', setCashMovements, []);
        load('orders', setOrders, []);
        load('purchases', setPurchases, []);
        load('users', setUsers, []);
        load('userInvites', setUserInvites, []);
        load('activityLogs', setActivityLogs, []);
        load('periodClosures', setPeriodClosures, []); // NEW
        load('settings', setSettings, DEFAULT_SETTINGS);
        
        // Recover session if exists
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
    }, []);

    // Save to LocalStorage on change
    useEffect(() => { localStorage.setItem('products', JSON.stringify(products)); }, [products]);
    useEffect(() => { localStorage.setItem('customers', JSON.stringify(customers)); }, [customers]);
    useEffect(() => { localStorage.setItem('suppliers', JSON.stringify(suppliers)); }, [suppliers]);
    useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { localStorage.setItem('cashMovements', JSON.stringify(cashMovements)); }, [cashMovements]);
    useEffect(() => { localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
    useEffect(() => { localStorage.setItem('purchases', JSON.stringify(purchases)); }, [purchases]);
    useEffect(() => { localStorage.setItem('users', JSON.stringify(users)); }, [users]);
    useEffect(() => { localStorage.setItem('userInvites', JSON.stringify(userInvites)); }, [userInvites]);
    useEffect(() => { localStorage.setItem('activityLogs', JSON.stringify(activityLogs)); }, [activityLogs]);
    useEffect(() => { localStorage.setItem('periodClosures', JSON.stringify(periodClosures)); }, [periodClosures]); // NEW
    useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);
    useEffect(() => { 
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
        else localStorage.removeItem('currentUser');
    }, [currentUser]);

    // ... Helper functions (notify, etc) ...
    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, title, message, type }]);
        if (settings.soundConfig?.enabled) {
            if (type === 'error') playSound(settings.soundConfig.errorSound);
            else if (type === 'success') playSound(settings.soundConfig.saleSound);
            else playSound(settings.soundConfig.notificationSound);
        }
        setTimeout(() => removeToast(id), 3000);
    };

    const removeToast = (id: string) => setToasts(p => p.filter(t => t.id !== id));

    const playSound = (type: any) => {
        if (settings.soundConfig?.enabled) {
            playSystemSound(type, settings.soundConfig.volume);
        }
    };

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
        setActivityLogs(prev => [log, ...prev].slice(0, 1000));
    };

    // ... CRUD Methods (unchanged until Purchases) ...
    const addProduct = (p: Product) => {
        const newProduct = { ...p, id: p.id || (settings.sequences.productStart + products.length).toString() };
        setProducts(prev => [...prev, newProduct]);
        setHasPendingChanges(true);
        logActivity('INVENTORY', `Producto creado: ${p.name}`);
    };
    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(item => item.id === p.id ? p : item));
        setHasPendingChanges(true);
        logActivity('INVENTORY', `Producto actualizado: ${p.name}`);
    };
    const deleteProduct = (id: string) => {
        setProducts(prev => prev.filter(p => p.id !== id));
        setHasPendingChanges(true);
        logActivity('INVENTORY', `Producto eliminado: ${id}`);
    };
    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    return {
                        ...p,
                        variants: p.variants.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + qty : v.stock - qty } : v)
                    };
                } else {
                    return { ...p, stock: type === 'IN' ? p.stock + qty : p.stock - qty };
                }
            }
            return p;
        }));
        setHasPendingChanges(true);
    };
    const addCategory = (c: string) => { };
    const removeCategory = (c: string) => { };

    // --- ADD TRANSACTION ---
    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        setTransactions(prev => [t, ...prev]);
        
        if (options?.shouldAffectCash !== false) {
            const amount = t.amountPaid || t.total;
            if (amount > 0) {
                // Determine Channel (Cash or Virtual)
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
        
        setHasPendingChanges(true);
        logActivity('SALE', `Venta registrada #${t.id}`);
        notify("Venta Exitosa", `Ticket #${t.id} guardado.`);
    };

    // --- RECTIFY TRANSACTION (FIX PAST SALES) ---
    const rectifyTransactionChannel = (transactionId: string) => {
        const tx = transactions.find(t => t.id === transactionId);
        if (!tx) return;

        let targetChannel: 'CASH' | 'VIRTUAL' = 'CASH';
        if (tx.paymentMethod === 'card' || tx.paymentMethod === 'transfer') targetChannel = 'VIRTUAL';
        
        // Find associated movements
        let found = false;
        let anyChanges = false;

        setCashMovements(prev => {
            const updated = prev.map(m => {
                // Improved matching: Look for ID within description strings
                if (m.type === 'DEPOSIT' && (m.description.includes(`#${tx.id}`) || m.description.includes(`Venta ${tx.id}`))) {
                    found = true;
                    if (m.channel !== targetChannel) {
                        anyChanges = true;
                        return { ...m, channel: targetChannel };
                    }
                }
                return m;
            });
            return updated;
        });

        // If not found, CREATE IT (Retroactive fix)
        if (!found) {
            const missingAmount = tx.amountPaid || tx.total;
            if (missingAmount > 0) {
                addCashMovement({
                    id: crypto.randomUUID(),
                    type: 'DEPOSIT',
                    amount: missingAmount,
                    description: `Venta #${tx.id} (Sincronizada)`, // Mark as synced/restored
                    date: tx.date, // Use ORIGINAL date to keep history correct
                    category: 'SALES',
                    customerId: tx.customerId,
                    channel: targetChannel
                });
                notify("Corrección Aplicada", `Movimiento faltante RECREADO en cuenta ${targetChannel === 'VIRTUAL' ? 'VIRTUAL' : 'EFECTIVO'}.`, "success");
                setHasPendingChanges(true);
            } else {
                 notify("Aviso", "La venta no tiene monto pagado, no se requiere movimiento.", "warning");
            }
        } else if (anyChanges) {
            notify("Sincronizado", `Flujo de venta #${tx.id} actualizado a ${targetChannel === 'VIRTUAL' ? 'VIRTUAL' : 'EFECTIVO'}.`, "success");
            setHasPendingChanges(true);
        } else {
            notify("Info", "El movimiento ya estaba correcto.", "info");
        }
    };

    const updateStockAfterSale = (items: any[]) => {
        setProducts(prev => prev.map(p => {
            const soldItem = items.find((i: any) => i.id === p.id);
            if (soldItem) {
                if (soldItem.variantId && p.variants) {
                    return {
                        ...p,
                        variants: p.variants.map(v => v.id === soldItem.variantId ? { ...v, stock: v.stock - soldItem.quantity } : v)
                    };
                } else {
                    return { ...p, stock: p.stock - soldItem.quantity };
                }
            }
            return p;
        }));
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        setHasPendingChanges(true);
    };

    const deleteTransaction = (id: string, items: any[]) => {
        items.forEach(item => adjustStock(item.id, item.quantity, 'IN', item.variantId));
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' } : t));
        setHasPendingChanges(true);
        logActivity('SALE', `Venta anulada #${id}`);
    };

    // --- REGISTER PAYMENT ---
    const registerTransactionPayment = (id: string, amount: number, method: 'cash' | 'card' | 'transfer') => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        const newPaid = (tx.amountPaid || 0) + amount;
        const newStatus = newPaid >= tx.total ? 'paid' : 'partial';
        
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, amountPaid: newPaid, paymentStatus: newStatus } : t));
        
        if (tx.customerId) {
            setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        }

        // Handle Channel
        const channel = method === 'cash' ? 'CASH' : 'VIRTUAL';
        
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: `Abono Venta #${id} (${method})`,
            date: new Date().toISOString(),
            category: 'SALES',
            customerId: tx.customerId,
            channel: channel
        });
        
        setHasPendingChanges(true);
    };

    const addCustomer = (c: Customer) => {
        const newC = { ...c, id: c.id || (settings.sequences.customerStart + customers.length).toString() };
        setCustomers(prev => [...prev, newC]);
        setHasPendingChanges(true);
    };
    const updateCustomer = (c: Customer) => {
        setCustomers(prev => prev.map(item => item.id === c.id ? c : item));
        setHasPendingChanges(true);
    };
    const deleteCustomer = (id: string) => {
        setCustomers(prev => prev.filter(c => c.id !== id));
        setHasPendingChanges(true);
    };
    // Default to Cash for manual customer payment unless extended later
    const processCustomerPayment = (id: string, amount: number) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount: amount,
            description: 'Abono a Cuenta Cliente (Efectivo)',
            date: new Date().toISOString(),
            category: 'SALES',
            customerId: id,
            channel: 'CASH'
        });
        setHasPendingChanges(true);
    };

    const addSupplier = (s: Supplier) => {
        setSuppliers(prev => [...prev, s]);
        setHasPendingChanges(true);
    };
    const updateSupplier = (s: Supplier) => {
        setSuppliers(prev => prev.map(item => item.id === s.id ? s : item));
        setHasPendingChanges(true);
    };
    const deleteSupplier = (id: string) => {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        setHasPendingChanges(true);
    };
    // Purchase affects Cash by default (Operational Expense)
    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [p, ...prev]);
        p.items.forEach(item => adjustStock(item.productId, item.quantity, 'IN', item.variantId));
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'EXPENSE',
            amount: p.total,
            description: `Compra Proveedor: ${p.supplierName}`,
            date: p.date,
            category: 'OPERATIONAL',
            channel: 'CASH' // Purchases typically default to cash here, or we could add a selector in Purchase Form later
        });
        setHasPendingChanges(true);
    };

    const deletePurchase = (id: string) => {
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return;

        purchase.items.forEach(item => {
            adjustStock(item.productId, item.quantity, 'OUT', item.variantId);
        });

        setCashMovements(prev => prev.filter(m => m.date !== purchase.date));
        setPurchases(prev => prev.filter(p => p.id !== id));

        setHasPendingChanges(true);
        logActivity('INVENTORY', `Compra eliminada: ${purchase.supplierName} - Stock revertido`);
        notify("Compra Eliminada", "Stock descontado y dinero devuelto a caja.", "success");
    };

    const addCashMovement = (m: CashMovement) => {
        setCashMovements(prev => [m, ...prev]);
        setHasPendingChanges(true);
    };
    const deleteCashMovement = (id: string) => {
        setCashMovements(prev => prev.filter(m => m.id !== id));
        setHasPendingChanges(true);
    };

    const addPeriodClosure = (closure: PeriodClosure) => {
        setPeriodClosures(prev => [...prev, closure]);
        setHasPendingChanges(true);
        logActivity('SETTINGS', `Cierre de periodo realizado: ${closure.periodStart} - ${closure.periodEnd}`);
    };

    const addOrder = (o: Order) => {
        // Calculate distinct ID based on max existing numeric ID to prevent collisions
        // Prevents duplications when array length changes due to deletions
        let newId = o.id;
        if (!newId) {
            const maxId = orders.reduce((max, order) => {
                const numId = parseInt(order.id);
                return !isNaN(numId) && numId > max ? numId : max;
            }, settings.sequences.orderStart - 1);
            newId = (maxId + 1).toString();
        }

        const newO = { ...o, id: newId };
        setOrders(prev => [...prev, newO]);
        setHasPendingChanges(true);
    };
    const updateOrder = (o: Order) => {
        setOrders(prev => prev.map(item => item.id === o.id ? o : item));
        setHasPendingChanges(true);
    };
    
    const updateOrderStatus = (id: string, status: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as any } : o));
        setHasPendingChanges(true);
        if(settings.enableCloudSync) setTimeout(() => pushToCloud(), 200); 
    };

    const completeOrder = (id: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'COMPLETED' } : o));
        setHasPendingChanges(true);
        logActivity('ORDER', `Pedido completado y entregado #${id}`);
        if(settings.enableCloudSync) setTimeout(() => pushToCloud(), 200);
    };

    const deleteOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
        setHasPendingChanges(true);
        logActivity('ORDER', `Pedido eliminado #${id}`);
        if(settings.enableCloudSync) setTimeout(() => pushToCloud(), 200);
    };

    const convertOrderToSale = (o: Order) => { };
    const sendOrderToPOS = (order: Order) => {
        setIncomingOrder(order);
    };
    const clearIncomingOrder = () => setIncomingOrder(null);

    const updateSettings = (s: BusinessSettings) => {
        setSettings(s);
        setHasPendingChanges(true);
    };

    const importData = async (data: any) => {
        try {
            if (data.products) setProducts(data.products);
            if (data.customers) setCustomers(data.customers);
            if (data.suppliers) setSuppliers(data.suppliers);
            if (data.transactions) setTransactions(data.transactions);
            if (data.cashMovements) setCashMovements(data.cashMovements);
            if (data.orders) setOrders(data.orders);
            if (data.purchases) setPurchases(data.purchases);
            if (data.users) setUsers(data.users);
            if (data.periodClosures) setPeriodClosures(data.periodClosures); // NEW
            if (data.settings) setSettings(data.settings);
            return true;
        } catch (e) {
            return false;
        }
    };

    const login = async (u: string, p: string, code?: string) => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'INVALID';
        if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return 'LOCKED';
        if (!user.active) return 'INVALID';
        const validPass = await verifyPassword(p, user.salt, user.passwordHash);
        if (!validPass) return 'INVALID';
        if (user.isTwoFactorEnabled) {
            if (!code) return '2FA_REQUIRED';
            if (!user.twoFactorSecret || !verify2FAToken(code, user.twoFactorSecret)) return 'INVALID_2FA';
        }
        setCurrentUser({ ...user, lastLogin: new Date().toISOString() });
        return 'SUCCESS';
    };

    const logout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            setCurrentUser(null);
            setIsLoggingOut(false);
        }, 500);
    };

    const addUser = (u: User) => {
        setUsers(prev => [...prev, u]);
        setHasPendingChanges(true);
    };
    const updateUser = (u: User) => {
        setUsers(prev => prev.map(item => item.id === u.id ? u : item));
        setHasPendingChanges(true);
    };
    const deleteUser = (id: string) => {
        setUsers(prev => prev.filter(u => u.id !== id));
        setHasPendingChanges(true);
    };

    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const invite: UserInvite = { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' };
        setUserInvites(prev => [...prev, invite]);
        return code;
    };

    const registerWithInvite = async (code: string, userData: Partial<User> & { password?: string; securityAnswer?: string }) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === userData.username?.toLowerCase())) return 'USERNAME_EXISTS';
        const salt = generateSalt();
        const hash = await hashPassword(userData.password || '', salt);
        let securityAnswerHash;
        if (userData.securityAnswer) {
            securityAnswerHash = await hashPassword(userData.securityAnswer.trim().toLowerCase(), salt);
        }
        const newUser: User = {
            id: crypto.randomUUID(),
            username: userData.username!,
            fullName: userData.fullName!,
            role: invite.role,
            active: true,
            passwordHash: hash,
            salt,
            securityQuestion: userData.securityQuestion,
            securityAnswerHash: securityAnswerHash,
            isTwoFactorEnabled: userData.isTwoFactorEnabled,
            twoFactorSecret: userData.twoFactorSecret
        };
        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter(i => i.code !== code));
        return 'SUCCESS';
    };

    const deleteInvite = (code: string) => setUserInvites(prev => prev.filter(i => i.code !== code));

    const recoverAccount = async (username: string, method: string, payload: string, newPass: string): Promise<'SUCCESS' | 'FAIL'> => {
        const userIndex = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (userIndex === -1) return 'FAIL';
        const user = users[userIndex];
        let verified = false;
        if (method === 'SECURITY_QUESTION') {
             if (user.securityAnswerHash && user.salt) {
                 verified = await verifyPassword(payload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
             }
        } else {
             verified = user.recoveryCode === payload.trim();
        }
        if (!verified) return 'FAIL';
        const salt = generateSalt();
        const hash = await hashPassword(newPass, salt);
        const updatedUser = { ...user, passwordHash: hash, salt, failedLoginAttempts: 0, lockoutUntil: undefined };
        const newUsers = [...users];
        newUsers[userIndex] = updatedUser;
        setUsers(newUsers);
        setHasPendingChanges(true);
        return 'SUCCESS';
    };

    const verifyRecoveryAttempt = async (username: string, method: string, payload: string): Promise<boolean> => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) return false;
        if (method === 'SECURITY_QUESTION') {
             if (user.securityAnswerHash && user.salt) {
                 return await verifyPassword(payload.trim().toLowerCase(), user.salt, user.securityAnswerHash);
             }
             return false;
        } else {
             return user.recoveryCode === payload.trim();
        }
    };

    const getUserPublicInfo = (username: string) => {
        const u = users.find(user => user.username.toLowerCase() === username.toLowerCase());
        return u ? { securityQuestion: u.securityQuestion } : null;
    };

    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean) => {
        if (!settings.enableCloudSync && !force) return false;
        if (hasPendingChanges && !force) {
            await pushToCloud();
            return false;
        }
        setIsSyncing(true);
        try {
            const data = await fetchFullDataFromCloud(url || settings.googleWebAppUrl || '', secret || settings.cloudSecret);
            if (pendingChangesRef.current && !force) {
                return false;
            }
            if (data) {
                await importData(data);
                if (!silent) notify("Sincronización", "Datos descargados correctamente.", "success");
                setHasPendingChanges(false);
                return true;
            }
        } catch (e) {
            if (!silent) notify("Error de Sync", "No se pudo descargar de la nube.", "error");
        } finally {
            setIsSyncing(false);
        }
        return false;
    };

    const pushToCloud = async (overrideData?: any) => {
        if (!settings.enableCloudSync) return false;
        if (isSyncing) return false;
        setIsSyncing(true);
        try {
            const dataToPush = overrideData || storeRef.current;
            await pushFullDataToCloud(settings.googleWebAppUrl || '', settings.cloudSecret, dataToPush);
            setHasPendingChanges(false);
            return true;
        } catch (e) {
            notify("Error de Sync", "No se pudo subir a la nube.", "error");
            return false;
        } finally {
            setIsSyncing(false);
        }
    };

    const connectBtPrinter = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
            });
            const server = await device.gatt?.connect();
            const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            setBtDevice(device);
            setBtCharacteristic(characteristic || null);
            notify("Bluetooth", "Impresora conectada.", "success");
        } catch (e) {
            console.error(e);
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
        if (!btCharacteristic) throw new Error("No printer connected");
        const chunkSize = 512;
        for (let i = 0; i < data.length; i += chunkSize) {
            await btCharacteristic.writeValue(data.slice(i, i + chunkSize));
        }
    };

    const hardReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    const requestNotificationPermission = async () => true;

    const unlockApp = async (password: string) => {
        if (!currentUser) return false;
        const valid = await verifyPassword(password, currentUser.salt, currentUser.passwordHash);
        if (valid) setIsAppLocked(false);
        return valid;
    };

    const manualLockApp = () => setIsAppLocked(true);

    useEffect(() => {
        let intervalId: any;
        if (settings.enableCloudSync && settings.googleWebAppUrl) {
            intervalId = setInterval(() => {
                if (isSyncing) return;
                if (pendingChangesRef.current) {
                    pushToCloud().catch(console.error);
                } else {
                    pullFromCloud(undefined, undefined, true).catch(console.error);
                }
            }, 30000); 
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [settings.enableCloudSync, settings.googleWebAppUrl, isSyncing]);

    return (
        <StoreContext.Provider value={{
            products, customers, suppliers, transactions, cashMovements, orders, purchases, users, userInvites, activityLogs, periodClosures, settings, currentUser, toasts, isSyncing, hasPendingChanges,
            categories, btDevice, btCharacteristic, incomingOrder, isLoggingOut, isAppLocked,
            addProduct, updateProduct, deleteProduct, adjustStock, addCategory, removeCategory,
            addTransaction, updateTransaction, deleteTransaction, registerTransactionPayment, updateStockAfterSale,
            rectifyTransactionChannel, // NEW EXPORT
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment,
            addSupplier, updateSupplier, deleteSupplier, addPurchase, deletePurchase,
            addCashMovement, deleteCashMovement,
            addPeriodClosure, // NEW EXPORT
            addOrder, updateOrder, updateOrderStatus, completeOrder, convertOrderToSale, deleteOrder, sendOrderToPOS, clearIncomingOrder,
            updateSettings, importData, login, logout, unlockApp, manualLockApp,
            addUser, updateUser, deleteUser, recoverAccount, verifyRecoveryAttempt, getUserPublicInfo,
            generateInvite, registerWithInvite, deleteInvite,
            notify, removeToast, requestNotificationPermission, playSound,
            logActivity, pullFromCloud, pushToCloud, hardReset,
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
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
    Product, Transaction, Customer, Supplier, CashMovement, Order, Purchase, 
    User, UserInvite, ActivityLog, PeriodClosure, BusinessSettings, ToastNotification,
    CartItem, UserRole, BudgetCategory
} from '../types';
import { verifyPassword, hashPassword, generateSalt } from '../utils/security';
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
    processCustomerPayment: (id: string, amount: number) => void;

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

    addPurchase: (p: Purchase) => void;
    deletePurchase: (id: string) => void;

    addUser: (u: User) => void;
    updateUser: (u: User) => void;
    deleteUser: (id: string) => void;
    generateInvite: (role: UserRole) => string;
    deleteInvite: (code: string) => void;
    registerWithInvite: (code: string, userData: Partial<User>) => Promise<string>;

    addCategory: (cat: string) => void;
    removeCategory: (cat: string) => void;

    addPeriodClosure: (pc: PeriodClosure) => void;

    updateSettings: (s: BusinessSettings) => void;

    login: (u: string, p: string, code?: string) => Promise<string>;
    logout: () => void;
    manualLockApp: () => void;
    unlockApp: (password: string) => Promise<boolean>;
    recoverAccount: (user: string, method: string, payload: string, newPass: string) => Promise<string>;
    verifyRecoveryAttempt: (user: string, code: string) => boolean;
    getUserPublicInfo: (username: string) => any;

    pushToCloud: (data?: any) => Promise<void>;
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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // --- STATE ---
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
    
    // UI State
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

    // Persistence Refs
    const initialized = useRef(false);

    // --- LOAD DATA ---
    useEffect(() => {
        if (!initialized.current) {
            const load = (key: string, setter: any, def: any) => {
                const stored = localStorage.getItem(key);
                if (stored) {
                    try { setter(JSON.parse(stored)); } catch(e) { console.error(`Failed to load ${key}`); }
                } else {
                    setter(def);
                }
            };

            load('products', setProducts, []);
            load('transactions', setTransactions, []);
            load('customers', setCustomers, []);
            load('suppliers', setSuppliers, []);
            load('cashMovements', setCashMovements, []);
            load('orders', setOrders, []);
            load('purchases', setPurchases, []);
            load('users', setUsers, []);
            load('userInvites', setUserInvites, []);
            load('categories', setCategories, ['General']);
            load('activityLogs', setActivityLogs, []);
            load('periodClosures', setPeriodClosures, []);
            load('settings', setSettings, DEFAULT_SETTINGS);
            
            // Check session
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                try { setCurrentUser(JSON.parse(storedUser)); } catch (e) {}
            }

            initialized.current = true;
        }
    }, []);

    // --- PERSISTENCE ---
    useEffect(() => { if (initialized.current) localStorage.setItem('products', JSON.stringify(products)); }, [products]);
    useEffect(() => { if (initialized.current) localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
    useEffect(() => { if (initialized.current) localStorage.setItem('customers', JSON.stringify(customers)); }, [customers]);
    useEffect(() => { if (initialized.current) localStorage.setItem('suppliers', JSON.stringify(suppliers)); }, [suppliers]);
    useEffect(() => { if (initialized.current) localStorage.setItem('cashMovements', JSON.stringify(cashMovements)); }, [cashMovements]);
    useEffect(() => { if (initialized.current) localStorage.setItem('orders', JSON.stringify(orders)); }, [orders]);
    useEffect(() => { if (initialized.current) localStorage.setItem('purchases', JSON.stringify(purchases)); }, [purchases]);
    useEffect(() => { if (initialized.current) localStorage.setItem('users', JSON.stringify(users)); }, [users]);
    useEffect(() => { if (initialized.current) localStorage.setItem('userInvites', JSON.stringify(userInvites)); }, [userInvites]);
    useEffect(() => { if (initialized.current) localStorage.setItem('categories', JSON.stringify(categories)); }, [categories]);
    useEffect(() => { if (initialized.current) localStorage.setItem('activityLogs', JSON.stringify(activityLogs)); }, [activityLogs]);
    useEffect(() => { if (initialized.current) localStorage.setItem('periodClosures', JSON.stringify(periodClosures)); }, [periodClosures]);
    useEffect(() => { if (initialized.current) localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);

    useEffect(() => {
        if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
        else localStorage.removeItem('currentUser');
    }, [currentUser]);

    // --- HELPERS ---
    const notify = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, title, message, type }]);
        setTimeout(() => removeToast(id), 4000);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const flagChange = () => setHasPendingChanges(true);

    const logActivity = (action: ActivityLog['action'], details: string) => {
        const log: ActivityLog = {
            id: crypto.randomUUID(),
            userId: currentUser?.id || 'system',
            userName: currentUser?.username || 'Sistema',
            userRole: currentUser?.role || 'CASHIER',
            action,
            details,
            timestamp: new Date().toISOString()
        };
        setActivityLogs(prev => [log, ...prev].slice(0, 1000)); // Keep last 1000 logs
    };

    // --- BLUETOOTH REAL IMPLEMENTATION ---
    const connectBtPrinter = async () => {
        // Verificar soporte de Web Bluetooth
        if (!(navigator as any).bluetooth) {
            notify("Error", "Bluetooth no soportado en este navegador. Usa Chrome o Edge.", "error");
            return; // Detener si no hay soporte real
        }

        try {
            // UUIDs Estándar para Impresoras Térmicas ESC/POS (GATT)
            const PRINT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
            const WRITE_CHAR_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

            console.log("Iniciando escaneo de dispositivos...");
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ services: [PRINT_SERVICE_UUID] }]
            });

            if (!device.gatt) {
                throw new Error("El dispositivo no soporta conexión GATT.");
            }

            console.log("Conectando al servidor GATT...");
            const server = await device.gatt.connect();
            
            console.log("Obteniendo servicio de impresión...");
            const service = await server.getPrimaryService(PRINT_SERVICE_UUID);
            
            console.log("Obteniendo característica de escritura...");
            const characteristic = await service.getCharacteristic(WRITE_CHAR_UUID);

            setBtDevice(device);
            setBtCharacteristic(characteristic);
            
            // Manejador de desconexión automática
            device.addEventListener('gattserverdisconnected', () => {
                setBtDevice(null);
                setBtCharacteristic(null);
                notify("Bluetooth", "Impresora desconectada.", "warning");
            });

            notify("Bluetooth", `Conectado a ${device.name}`, "success");
        } catch (e: any) {
            console.error("Error de conexión Bluetooth:", e);
            // Ignorar error si el usuario canceló la selección
            if (e.name !== 'NotFoundError') {
                 notify("Error Conexión", e.message || "No se pudo conectar a la impresora.", "error");
            }
        }
    };

    const disconnectBtPrinter = () => {
        if (btDevice && btDevice.gatt && btDevice.gatt.connected) {
            btDevice.gatt.disconnect();
        }
        setBtDevice(null);
        setBtCharacteristic(null);
        notify("Bluetooth", "Desconectado.", "info");
    };

    const sendBtData = async (data: Uint8Array) => {
        if (!btCharacteristic) {
            notify("Error", "Impresora no conectada. Ve a Configuración > Bluetooth.", "error");
            return;
        }

        try {
            // Enviar en trozos pequeños (Chunks) para evitar desbordamiento del buffer de la impresora
            const CHUNK_SIZE = 50; // Reducido a 50 bytes para mayor compatibilidad
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                await btCharacteristic.writeValue(chunk);
                // Breve pausa para dar tiempo a la impresora de procesar
                await new Promise(r => setTimeout(r, 25));
            }
        } catch (e: any) {
            console.error("Error al enviar datos a la impresora:", e);
            notify("Error Impresión", "Fallo al enviar datos. Intenta reconectar.", "error");
            disconnectBtPrinter(); // Desconectar si falla la escritura para forzar reconexión limpia
        }
    };

    // --- ACTIONS ---
    const addProduct = (p: Product) => {
        const id = p.id || (settings.sequences.productStart + products.length).toString();
        const newProduct = { ...p, id };
        setProducts(prev => [...prev, newProduct]);
        notify("Producto", "Agregado correctamente", "success");
        flagChange();
    };

    const updateProduct = (p: Product) => {
        setProducts(prev => prev.map(prod => prod.id === p.id ? p : prod));
        notify("Producto", "Actualizado", "success");
        flagChange();
    };

    const deleteProduct = (id: string) => {
        if (confirm("¿Eliminar producto?")) {
            setProducts(prev => prev.filter(p => p.id !== id));
            notify("Producto", "Eliminado", "info");
            flagChange();
        }
    };

    const adjustStock = (id: string, qty: number, type: 'IN' | 'OUT', variantId?: string) => {
        setProducts(prev => prev.map(p => {
            if (p.id === id) {
                if (variantId && p.variants) {
                    const newVariants = p.variants.map(v => v.id === variantId ? { ...v, stock: type === 'IN' ? v.stock + qty : Math.max(0, v.stock - qty) } : v);
                    const totalStock = newVariants.reduce((s, v) => s + v.stock, 0);
                    return { ...p, variants: newVariants, stock: totalStock };
                } else {
                    return { ...p, stock: type === 'IN' ? p.stock + qty : Math.max(0, p.stock - qty) };
                }
            }
            return p;
        }));
        logActivity('INVENTORY', `${type === 'IN' ? 'Entrada' : 'Salida'} de ${qty} un. en producto ID ${id}`);
        flagChange();
    };

    const addTransaction = (t: Transaction, options?: { shouldAffectCash?: boolean }) => {
        setTransactions(prev => [...prev, t]);
        
        // Update customer debt if pending
        if (t.paymentStatus === 'pending' || t.paymentStatus === 'partial') {
            const pendingAmount = t.total - (t.amountPaid || 0);
            if (t.customerId) {
                setCustomers(prev => prev.map(c => c.id === t.customerId ? { ...c, currentDebt: c.currentDebt + pendingAmount } : c));
            }
        }

        // Register cash movement automatically if Cash and option is true (default true)
        const shouldAffectCash = options?.shouldAffectCash ?? true;
        if (shouldAffectCash && t.paymentMethod === 'cash' && (t.amountPaid || 0) > 0) {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'DEPOSIT',
                amount: t.amountPaid || 0,
                description: `Venta #${t.id}`,
                date: t.date,
                category: 'SALES',
                channel: 'CASH',
                customerId: t.customerId
            });
        }

        // Update sequences
        setSettings(prev => ({...prev, sequences: {...prev.sequences, ticketStart: Math.max(prev.sequences.ticketStart, parseInt(t.id) + 1)}}));
        
        flagChange();
    };

    const updateTransaction = (id: string, updates: Partial<Transaction>) => {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        flagChange();
    };

    const deleteTransaction = (id: string, items: any[]) => {
        // Reverse stock
        setProducts(prev => {
            const newProducts = [...prev];
            items.forEach(item => {
                const prodIndex = newProducts.findIndex(p => p.id === item.id);
                if (prodIndex >= 0) {
                    const prod = newProducts[prodIndex];
                    if (item.variantId && prod.variants) {
                        const vIndex = prod.variants.findIndex(v => v.id === item.variantId);
                        if (vIndex >= 0) {
                            prod.variants[vIndex].stock += item.quantity;
                            prod.stock += item.quantity; // Sync total
                        }
                    } else {
                        prod.stock += item.quantity;
                    }
                }
            });
            return newProducts;
        });

        // Mark cancelled
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'cancelled' } : t));
        
        // Add movement refund if it was cash
        const tx = transactions.find(t => t.id === id);
        if (tx && tx.amountPaid && tx.amountPaid > 0 && tx.paymentMethod === 'cash') {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'WITHDRAWAL',
                amount: tx.amountPaid,
                description: `Devolución por anulación #${id}`,
                date: new Date().toISOString(),
                category: 'SALES',
                channel: 'CASH'
            });
        }

        flagChange();
    };

    const registerTransactionPayment = (id: string, amount: number, method: 'cash' | 'card' | 'transfer') => {
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        const newPaid = (tx.amountPaid || 0) + amount;
        let newStatus: Transaction['paymentStatus'] = tx.paymentStatus;
        if (newPaid >= tx.total - 0.01) newStatus = 'paid';
        else if (newPaid > 0) newStatus = 'partial';

        updateTransaction(id, { amountPaid: newPaid, paymentStatus: newStatus });

        // Update Customer Debt
        if (tx.customerId) {
            setCustomers(prev => prev.map(c => c.id === tx.customerId ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        }

        // Add Cash Movement if Cash
        if (method === 'cash') {
            addCashMovement({
                id: crypto.randomUUID(),
                type: 'DEPOSIT',
                amount: amount,
                description: `Abono Venta #${id}`,
                date: new Date().toISOString(),
                category: 'SALES',
                channel: 'CASH',
                customerId: tx.customerId
            });
        }

        notify("Pago Registrado", `Se abonaron $${amount.toFixed(2)}`, "success");
    };

    const rectifyTransactionChannel = (id: string) => {
        // Logic to switch movement channel if recorded incorrectly
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;
        // This assumes finding the related cash movement and swapping channel
        // For simplicity, just log it. Real implementation would search cashMovements by description/ref.
        notify("Info", "Funcionalidad de rectificación pendiente de implementación completa", "info");
    };

    const updateStockAfterSale = (items: CartItem[]) => {
        setProducts(prev => {
            const newProducts = [...prev];
            items.forEach(item => {
                const prodIndex = newProducts.findIndex(p => p.id === item.id);
                if (prodIndex >= 0) {
                    const prod = newProducts[prodIndex];
                    // If quantity is negative (return), it adds stock. Positive removes.
                    const change = item.quantity; 
                    
                    if (item.variantId && prod.variants) {
                        const vIndex = prod.variants.findIndex(v => v.id === item.variantId);
                        if (vIndex >= 0) {
                            prod.variants[vIndex].stock -= change;
                            prod.stock -= change;
                        }
                    } else {
                        prod.stock -= change;
                    }
                }
            });
            return newProducts;
        });
        flagChange();
    };

    // Customer
    const addCustomer = (c: Customer) => {
        const id = c.id || `C${(settings.sequences.customerStart + customers.length).toString().padStart(4, '0')}`;
        setCustomers(prev => [...prev, { ...c, id }]);
        notify("Cliente", "Registrado", "success");
        flagChange();
    };
    const updateCustomer = (c: Customer) => {
        setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust));
        notify("Cliente", "Actualizado", "success");
        flagChange();
    };
    const deleteCustomer = (id: string) => {
        if(confirm("¿Eliminar cliente?")) {
            setCustomers(prev => prev.filter(c => c.id !== id));
            flagChange();
        }
    };
    const processCustomerPayment = (id: string, amount: number) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, currentDebt: Math.max(0, c.currentDebt - amount) } : c));
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'DEPOSIT',
            amount,
            description: 'Abono a cuenta cliente',
            date: new Date().toISOString(),
            category: 'SALES',
            channel: 'CASH',
            customerId: id
        });
        notify("Abono", "Registrado correctamente", "success");
        flagChange();
    };

    // Suppliers
    const addSupplier = (s: Supplier) => { setSuppliers(prev => [...prev, s]); flagChange(); };
    const updateSupplier = (s: Supplier) => { setSuppliers(prev => prev.map(sup => sup.id === s.id ? s : sup)); flagChange(); };
    const deleteSupplier = (id: string) => { setSuppliers(prev => prev.filter(s => s.id !== id)); flagChange(); };

    // Cash
    const addCashMovement = (m: CashMovement) => { setCashMovements(prev => [...prev, m]); flagChange(); };
    const deleteCashMovement = (id: string) => { setCashMovements(prev => prev.filter(m => m.id !== id)); flagChange(); };

    // Orders
    const addOrder = (o: Order) => {
        const id = o.id || `ORD-${Date.now().toString().slice(-6)}`;
        setOrders(prev => [...prev, { ...o, id }]);
        notify("Pedido", "Creado exitosamente", "success");
        flagChange();
    };
    const updateOrder = (o: Order) => { setOrders(prev => prev.map(ord => ord.id === o.id ? o : ord)); flagChange(); };
    const updateOrderStatus = (id: string, status: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
        notify("Estado", "Actualizado", "info");
        flagChange();
    };
    const deleteOrder = (id: string) => { setOrders(prev => prev.filter(o => o.id !== id)); flagChange(); };
    const completeOrder = (id: string) => updateOrderStatus(id, 'COMPLETED');
    const sendOrderToPOS = (order: Order) => {
        setIncomingOrder(order);
        notify("Caja", "Pedido cargado para cobro", "success");
    };
    const clearIncomingOrder = () => setIncomingOrder(null);

    // Purchases
    const addPurchase = (p: Purchase) => {
        setPurchases(prev => [...prev, p]);
        // Add stock
        const itemsToStock: CartItem[] = p.items.map(i => ({
            id: i.productId,
            quantity: -i.quantity, // Negative to add stock in updateStockAfterSale logic (double negative)
            variantId: i.variantId,
            price: 0, name: '', stock: 0, category: '', sku: ''
        }));
        updateStockAfterSale(itemsToStock);
        
        // Add expense
        addCashMovement({
            id: crypto.randomUUID(),
            type: 'EXPENSE',
            amount: p.total,
            description: `Compra a ${p.supplierName}`,
            date: p.date,
            category: 'OPERATIONAL',
            channel: 'CASH'
        });
        
        notify("Compra", "Registrada e inventario actualizado", "success");
        flagChange();
    };
    const deletePurchase = (id: string) => {
        // Reverse logic would be needed here (remove stock, return cash).
        // Simplified: just remove record
        setPurchases(prev => prev.filter(p => p.id !== id));
        flagChange();
    };

    // Users
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); flagChange(); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(usr => usr.id === u.id ? u : usr)); flagChange(); };
    const deleteUser = (id: string) => { setUsers(prev => prev.filter(u => u.id !== id)); flagChange(); };
    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'admin' }]);
        flagChange();
        return code;
    };
    const deleteInvite = (code: string) => { setUserInvites(prev => prev.filter(i => i.code !== code)); flagChange(); };
    const registerWithInvite = async (code: string, userData: Partial<User>) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        if (users.some(u => u.username.toLowerCase() === userData.username?.toLowerCase())) return 'USERNAME_EXISTS';

        const salt = generateSalt();
        const hash = await hashPassword(userData.password || '', salt);
        
        const newUser: User = {
            id: crypto.randomUUID(),
            username: userData.username!,
            fullName: userData.fullName!,
            passwordHash: hash,
            salt: salt,
            role: invite.role,
            active: true,
            recoveryCode: userData.recoveryCode || '1234',
            securityQuestion: userData.securityQuestion,
            securityAnswerHash: userData.securityAnswer ? await hashPassword(userData.securityAnswer.toLowerCase(), salt) : undefined,
            isTwoFactorEnabled: userData.isTwoFactorEnabled,
            twoFactorSecret: userData.twoFactorSecret
        };

        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter(i => i.code !== code));
        flagChange();
        return 'SUCCESS';
    };

    const addCategory = (cat: string) => { if(!categories.includes(cat)) setCategories(prev => [...prev, cat]); };
    const removeCategory = (cat: string) => { setCategories(prev => prev.filter(c => c !== cat)); };

    const addPeriodClosure = (pc: PeriodClosure) => { setPeriodClosures(prev => [...prev, pc]); flagChange(); };

    const updateSettings = (s: BusinessSettings) => { setSettings(s); flagChange(); };

    // Auth
    const login = async (u: string, p: string, code?: string) => {
        const user = users.find(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (!user) return 'INVALID';
        
        if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) return 'LOCKED';
        if (!user.active) return 'LOCKED';

        const isValid = await verifyPassword(p, user.salt, user.passwordHash);
        if (!isValid) {
            // Logic for lockout count would go here
            return 'INVALID';
        }

        // 2FA Check
        if (user.isTwoFactorEnabled && !code) return '2FA_REQUIRED';
        if (user.isTwoFactorEnabled && code) {
            // Verify code logic (placeholder)
            // if (!verify2FA(code, user.twoFactorSecret)) return 'INVALID_2FA';
        }

        setCurrentUser({ ...user, lastLogin: new Date().toISOString() });
        logActivity('LOGIN', `Inicio de sesión de ${user.username}`);
        return 'SUCCESS';
    };

    const logout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            setCurrentUser(null);
            setIsLoggingOut(false);
        }, 500);
    };

    const manualLockApp = () => setIsAppLocked(true);
    const unlockApp = async (password: string) => {
        if (!currentUser) return false;
        const valid = await verifyPassword(password, currentUser.salt, currentUser.passwordHash);
        if (valid) setIsAppLocked(false);
        return valid;
    };

    const recoverAccount = async (user: string, method: string, payload: string, newPass: string) => {
        const usr = users.find(u => u.username === user);
        if (!usr) return 'ERROR';
        // Verify payload logic here
        const salt = generateSalt();
        const hash = await hashPassword(newPass, salt);
        setUsers(prev => prev.map(u => u.id === usr.id ? { ...u, passwordHash: hash, salt } : u));
        return 'SUCCESS';
    };

    const verifyRecoveryAttempt = (user: string, code: string) => true; // Implement actual check
    const getUserPublicInfo = (username: string) => users.find(u => u.username === username);

    // Sync
    const pushToCloud = async (data?: any) => {
        if (!settings.enableCloudSync || !settings.googleWebAppUrl) return;
        setIsSyncing(true);
        const payload = data || { products, transactions, customers, suppliers, cashMovements, orders, purchases, users, settings };
        try {
            await pushFullDataToCloud(settings.googleWebAppUrl, settings.cloudSecret, payload);
            setHasPendingChanges(false);
        } catch (e) {
            console.error("Sync error", e);
            notify("Error Sincronización", "No se pudo guardar en la nube.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const pullFromCloud = async (url?: string, secret?: string, silent?: boolean, force?: boolean) => {
        if (!url && (!settings.enableCloudSync || !settings.googleWebAppUrl)) return false;
        const targetUrl = url || settings.googleWebAppUrl;
        const targetSecret = secret || settings.cloudSecret;
        
        if (!targetUrl) return false;

        setIsSyncing(true);
        try {
            const data = await fetchFullDataFromCloud(targetUrl, targetSecret);
            if (data) {
                // Bulk update state
                if(data.products) setProducts(data.products);
                if(data.transactions) setTransactions(data.transactions);
                if(data.customers) setCustomers(data.customers);
                if(data.suppliers) setSuppliers(data.suppliers);
                if(data.cashMovements) setCashMovements(data.cashMovements);
                if(data.orders) setOrders(data.orders);
                if(data.purchases) setPurchases(data.purchases);
                if(data.users) setUsers(data.users);
                if(data.settings) setSettings(data.settings);
                // ... others
                if(!silent) notify("Sincronizado", "Datos actualizados desde la nube.", "success");
                return true;
            }
        } catch (e) {
            if(!silent) notify("Error Descarga", "No se pudieron obtener datos.", "error");
        } finally {
            setIsSyncing(false);
        }
        return false;
    };

    const hardReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    const importData = async (json: any) => {
        try {
            if(json.products) setProducts(json.products);
            if(json.transactions) setTransactions(json.transactions);
            if(json.customers) setCustomers(json.customers);
            if(json.suppliers) setSuppliers(json.suppliers);
            if(json.cashMovements) setCashMovements(json.cashMovements);
            if(json.orders) setOrders(json.orders);
            if(json.purchases) setPurchases(json.purchases);
            if(json.users) setUsers(json.users);
            if(json.settings) setSettings(json.settings);
            return true;
        } catch(e) { return false; }
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
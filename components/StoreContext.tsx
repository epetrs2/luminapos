
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
  hasPendingChanges: boolean;
  
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
  pullFromCloud: (overrideUrl?: string, overrideSecret?: string, silent?: boolean, force?: boolean) => Promise<void>;
  pushToCloud: (overrides?: any) => Promise<void>;
  generateInvite: (role: UserRole) => string;
  registerWithInvite: (code: string, userData: any) => Promise<string>;
  deleteInvite: (code: string) => void;
  hardReset: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_PREFIX = "LUMINA_SEC::"; 

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
    theme: 'light',
    budgetConfig: { expensesPercentage: 50, investmentPercentage: 30, profitPercentage: 20 },
    notificationsEnabled: false,
    sequences: { customerStart: 1001, ticketStart: 10001, orderStart: 5001, productStart: 100 },
    productionDoc: { title: 'ORDEN DE TRABAJO', showPrices: true, showCustomerContact: true, showDates: true, customFooter: '' },
    enableCloudSync: true,
    googleWebAppUrl: '',
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
    const [settings, setSettings] = useState<BusinessSettings>(() => ({ ...DEFAULT_SETTINGS, ...safeLoad('settings', {}) }));
    
    // FIX: CARGAR USUARIO AL RECARGAR PÁGINA
    const [currentUser, setCurrentUser] = useState<User | null>(() => safeLoad('currentUser', null));
    
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);

    const lastLocalUpdate = useRef<number>(0); 
    const lastCloudSyncTimestamp = useRef<number>(0);
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
    }, [products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, categories, activityLogs, settings]);

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
        if (isSyncing) return;
        dataLoadedRef.current = true;
        lastLocalUpdate.current = Date.now();
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

    // GUARDAR USUARIO ACTUAL EN CADA CAMBIO
    useEffect(() => {
        if (currentUser) {
            safeSave('currentUser', currentUser);
        } else {
            localStorage.removeItem(STORAGE_PREFIX + 'currentUser'.split('').reverse().join(''));
        }
    }, [currentUser]);

    const pushToCloud = useCallback(async (overrides?: any) => {
        const currentData = storeRef.current;
        const config = overrides?.settings || currentData.settings;
        if (!config.enableCloudSync || !config.googleWebAppUrl) return;
        if (!dataLoadedRef.current && currentData.products.length === 0) return;

        setIsSyncing(true);
        try {
            await pushFullDataToCloud(config.googleWebAppUrl, config.cloudSecret, { ...currentData, ...overrides });
            lastCloudSyncTimestamp.current = Date.now();
            setHasPendingChanges(false); 
        } catch (e) {} finally { setIsSyncing(false); }
    }, []); 

    const pullFromCloud = async (overrideUrl?: string, overrideSecret?: string, silent: boolean = false, force: boolean = false) => {
        const url = overrideUrl || storeRef.current.settings.googleWebAppUrl;
        const secret = overrideSecret !== undefined ? overrideSecret : storeRef.current.settings.cloudSecret;
        if (!url) return;
        if (!silent) setIsSyncing(true);
        try {
            const cloudData = await fetchFullDataFromCloud(url, secret);
            if (!cloudData) return;
            const cloudTs = cloudData.timestamp ? new Date(cloudData.timestamp).getTime() : 0;
            if (!force && hasPendingChanges && lastLocalUpdate.current > cloudTs + 10000) {
                pushToCloud();
                return;
            }
            const safeData = sanitizeDataStructure(cloudData);
            if (Array.isArray(safeData.products)) setProducts(safeData.products);
            if (Array.isArray(safeData.transactions)) setTransactions(safeData.transactions);
            if (Array.isArray(safeData.customers)) setCustomers(safeData.customers);
            if (Array.isArray(safeData.users)) setUsers(safeData.users);
            if (Array.isArray(safeData.categories)) setCategories(safeData.categories);
            if (Array.isArray(safeData.activityLogs)) setActivityLogs(safeData.activityLogs);
            if (safeData.settings) setSettings({ ...DEFAULT_SETTINGS, ...safeData.settings, googleWebAppUrl: url, cloudSecret: secret });
            dataLoadedRef.current = true;
            lastCloudSyncTimestamp.current = cloudTs;
            setHasPendingChanges(false); 
            if (!silent) notify('Sincronizado', 'Datos actualizados.', 'success');
        } catch (e: any) {
            if (!silent) notify("Error Sincro", e.message, "error");
        } finally { if (!silent) setIsSyncing(false); }
    };

    const hardReset = async () => {
        if (!window.confirm("¿Restablecer y descargar todo de la nube?")) return;
        lastLocalUpdate.current = 0;
        setHasPendingChanges(false);
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
    }, [hasPendingChanges]);

    const login = async (u: string, p: string, code?: string) => {
        const userIndex = users.findIndex(usr => usr.username.toLowerCase() === u.toLowerCase());
        if (userIndex === -1) return 'INVALID';
        
        const user = users[userIndex];
        if (!user.active) return 'INVALID';
        if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) return 'LOCKED';
        
        if (!(await verifyPassword(p, user.salt, user.passwordHash))) return 'INVALID';
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
            if (!code) return '2FA_REQUIRED';
            if (!verify2FAToken(code, user.twoFactorSecret)) return 'INVALID_2FA';
        }

        const now = new Date().toISOString();
        const updatedUser = { ...user, lastLogin: now, lastActive: now };
        
        // ACTUALIZAR EN LA LISTA MAESTRA PARA QUE SE VEA EN "USUARIOS"
        setUsers(prev => prev.map(usr => usr.id === user.id ? updatedUser : usr));
        
        setCurrentUser(updatedUser);
        logActivity('LOGIN', `Entró: ${u}`);
        pullFromCloud(undefined, undefined, true);
        markLocalChange(); // Asegura que el lastLogin se suba a la nube
        return 'SUCCESS';
    };

    const logActivity = (action: string, details: string) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
        
        // 1. ACTUALIZAR ÚLTIMA ACTIVIDAD EN EL USUARIO ACTUAL
        setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, lastActive: now } : u));
        
        // 2. ACTUALIZAR LOGS
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
    };

    // --- ID GENERATOR ---
    const generateNextId = (items: {id: string}[], startSeq: number): string => {
        const maxId = items.reduce((max, item) => {
            const num = parseInt(item.id);
            return !isNaN(num) && num > max ? num : max;
        }, startSeq - 1);
        return (maxId + 1).toString();
    };

    const logout = () => { setCurrentUser(null); localStorage.removeItem('currentUser'); };
    
    // --- STABILIZED ADD PRODUCT ---
    const addProduct = (p: Product) => {
        // Generate Safe ID based on current max + 1
        const currentMaxId = products.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, (settings.sequences.productStart || 100) - 1);
        
        const newId = (currentMaxId + 1).toString();
        const finalProduct = { ...p, id: newId };

        setProducts(prev => [...prev, finalProduct]); 
        markLocalChange(); 
        logActivity('INVENTORY', `Agregó producto: ${p.name} (ID: ${newId})`); 
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
        const p = products.find(prod=>prod.id===id);
        logActivity('INVENTORY', `Ajuste stock (${type}): ${qty} un. de ${p?.name}`);
        markLocalChange();
    };
    
    // --- STABILIZED ADD FUNCTIONS ---
    
    const addTransaction = (t: Transaction) => {
        const currentMaxId = transactions.reduce((max, curr) => {
            const idNum = parseInt(curr.id);
            return !isNaN(idNum) && idNum > max ? idNum : max;
        }, settings.sequences.ticketStart - 1);
        
        const newId = t.id || (currentMaxId + 1).toString();
        const final = { ...t, id: newId };
        
        setTransactions(prev => [final, ...prev]);
        
        if (t.paymentStatus === 'paid' && !t.isReturn) {
             addCashMovement({ 
                 id: `mv_${final.id}`, 
                 type: 'DEPOSIT', 
                 amount: t.amountPaid, 
                 description: `Venta #${final.id}`, 
                 date: new Date().toISOString(), 
                 category: 'SALES' 
             });
        }
        logActivity('SALE', `Venta #${final.id} - Total: $${t.total}`);
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

    const updateCustomer = (c: Customer) => { setCustomers(prev => prev.map(cust => cust.id === c.id ? c : cust)); markLocalChange(); logActivity('CRM', `Editó cliente: ${c.name}`); };
    const deleteCustomer = async (id: string) => { const c = customers.find(cust=>cust.id===id); setCustomers(prev => prev.filter(c => c.id !== id)); markLocalChange(); logActivity('CRM', `Eliminó cliente: ${c?.name}`); return true; };
    const addCashMovement = (m: CashMovement) => { setCashMovements(prev => [m, ...prev]); markLocalChange(); logActivity('CASH', `Movimiento: ${m.description} - $${m.amount}`); };
    const deleteCashMovement = (id: string) => { const m = cashMovements.find(mv=>mv.id===id); setCashMovements(prev => prev.filter(m => m.id !== id)); markLocalChange(); logActivity('CASH', `Eliminó movimiento: ${m?.description}`); };
    const updateSettings = (s: BusinessSettings) => { setSettings(s); markLocalChange(); logActivity('SETTINGS', `Actualizó configuración del negocio`); };
    const addUser = (u: User) => { setUsers(prev => [...prev, u]); markLocalChange(); logActivity('USER_MGMT', `Nuevo usuario: ${u.username}`); };
    const updateUser = (u: User) => { setUsers(prev => prev.map(user => user.id === u.id ? u : user)); markLocalChange(); logActivity('USER_MGMT', `Editó usuario: ${u.username}`); };
    const deleteUser = (id: string) => { const u = users.find(usr=>usr.id===id); setUsers(prev => prev.filter(u => u.id !== id)); markLocalChange(); logActivity('USER_MGMT', `Eliminó usuario: ${u?.username}`); };
    const generateInvite = (role: UserRole) => {
        const code = Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        setUserInvites(prev => [...prev, { code, role, createdAt: new Date().toISOString(), createdBy: currentUser?.username || 'System' }]);
        markLocalChange(); return code;
    };
    const deleteInvite = (code: string) => { setUserInvites(prev => prev.filter(i => i.code !== code)); markLocalChange(); };
    const registerWithInvite = async (code: string, data: any) => {
        const invite = userInvites.find(i => i.code === code);
        if (!invite) return 'INVALID_CODE';
        const salt = generateSalt();
        const newUser: User = { id: crypto.randomUUID(), username: data.username, fullName: data.fullName, role: invite.role, active: true, passwordHash: await hashPassword(data.password, salt), salt, recoveryCode: generateSalt().substring(0,8), securityQuestion: data.securityQuestion, securityAnswerHash: await hashPassword(data.securityAnswer.toLowerCase(), salt) };
        setUsers(prev => [...prev, newUser]);
        setUserInvites(prev => prev.filter(i => i.code !== code));
        markLocalChange(); return 'SUCCESS';
    };

    return (
        <StoreContext.Provider value={{
            products, transactions, customers, suppliers, cashMovements, orders, purchases, users, userInvites, settings, currentUser, activityLogs, categories, toasts, isSyncing, hasPendingChanges,
            addProduct, updateProduct, deleteProduct, adjustStock, addCategory: (n) => setCategories(p=>[...p, n]), removeCategory: (n)=>setCategories(p=>p.filter(c=>c!==n)), addTransaction, deleteTransaction: (id)=>setTransactions(p=>p.filter(t=>t.id!==id)), registerTransactionPayment: (id, am)=>setTransactions(p=>p.map(t=>t.id===id?{...t, amountPaid: (t.amountPaid||0)+am}:t)), updateStockAfterSale: (its)=>its.forEach(i=>adjustStock(i.id, i.quantity, 'OUT', i.variantId)),
            addCustomer, updateCustomer, deleteCustomer, processCustomerPayment: (id, am)=>setCustomers(p=>p.map(c=>c.id===id?{...c, currentDebt: Math.max(0, c.currentDebt-am)}:c)), addSupplier: (s)=>console.log(s), updateSupplier: (s)=>console.log(s), deleteSupplier: async (id)=>true, addPurchase: (p)=>console.log(p), addCashMovement, deleteCashMovement,
            addOrder, updateOrderStatus: (id, st)=>setOrders(p=>p.map(o=>o.id===id?{...o, status: st as any}:o)), convertOrderToSale: (id, m)=>{}, deleteOrder: (id)=>setOrders(p=>p.filter(o=>o.id!==id)), updateSettings, importData: (d)=>{}, login, logout, addUser, updateUser, deleteUser, recoverAccount: async (u,m,p,np)=>'SUCCESS', verifyRecoveryAttempt: async (u,m,p)=>true, getUserPublicInfo: (u)=>null,
            notify, removeToast: (id)=>setToasts(p=>p.filter(t=>t.id !== id)), requestNotificationPermission: async ()=>true, logActivity, pullFromCloud, pushToCloud, generateInvite, registerWithInvite, deleteInvite, hardReset
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

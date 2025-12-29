
import { Transaction, BusinessSettings, CashMovement, Order, Product } from "../types";
import QRCode from 'qrcode';

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],
    CODE_PAGE: [ESC, 0x74, 0x00], // PC437
    ALIGN_LEFT: [ESC, 0x61, 0x00],
    ALIGN_CENTER: [ESC, 0x61, 0x01],
    ALIGN_RIGHT: [ESC, 0x61, 0x02],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    INVERT_ON: [GS, 0x42, 0x01], // Black background / White text
    INVERT_OFF: [GS, 0x42, 0x00],
    FEED_LINES: (n: number) => [ESC, 0x64, n],
};

const normalize = (str: string) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^\x20-\x7E\n]/g, "?"); // Replace non-ascii with ?
};

const encode = (str: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(normalize(str));
};

// --- HELPER: STRICT FIXED WIDTH COLUMNS ---
const formatRow = (col1: string, col2: string, col3: string, widthType: '58mm' | '80mm') => {
    const is58mm = widthType === '58mm';
    // Total Chars: 32 for 58mm, 48 for 80mm
    
    // DEFINICION DE COLUMNAS 
    // 58mm: [Qty 4] [Desc 17] [Total 11] = 32
    // 80mm: [Qty 6] [Desc 30] [Total 12] = 48

    const wQty = is58mm ? 4 : 6;
    const wTotal = is58mm ? 11 : 12;
    const wDesc = is58mm ? 17 : 30; // Remainder

    // 1. Normalizar (Quitar acentos)
    const nCol1 = normalize(col1);
    const nCol2 = normalize(col2);
    const nCol3 = normalize(col3);

    // 2. Truncar y Rellenar
    const c1 = nCol1.substring(0, wQty - 1).padEnd(wQty, ' '); // Left align
    const c2 = nCol2.substring(0, wDesc - 1).padEnd(wDesc, ' '); // Left align
    const c3 = nCol3.substring(0, wTotal).padStart(wTotal, ' '); // Right align

    return c1 + c2 + c3;
};

const formatTwoCols = (left: string, right: string, widthType: '58mm' | '80mm') => {
    const totalWidth = widthType === '58mm' ? 32 : 48;
    const wRight = Math.floor(totalWidth * 0.4); // 40% for value
    const wLeft = totalWidth - wRight; 
    
    const nLeft = normalize(left);
    const nRight = normalize(right);

    const l = nLeft.substring(0, wLeft - 1).padEnd(wLeft, ' ');
    const r = nRight.substring(0, wRight).padStart(wRight, ' ');
    return l + r;
};

// --- IMAGE PROCESSING ---
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
    });
};

const convertImageToRaster = (img: HTMLImageElement, maxWidth: number = 384): number[] => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    // Resize logic
    let width = img.width;
    let height = img.height;
    if (width > maxWidth) {
        height = Math.floor(height * (maxWidth / width));
        width = maxWidth;
    }
    // Width must be multiple of 8
    const roundedWidth = Math.floor(width / 8) * 8;
    
    canvas.width = roundedWidth;
    canvas.height = height;

    // Draw white bg
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, roundedWidth, height);
    ctx.drawImage(img, 0, 0, roundedWidth, height);

    const imgData = ctx.getImageData(0, 0, roundedWidth, height);
    const data = imgData.data;

    // Convert to Grayscale & Threshold (Simple binary for printer)
    const grayData = new Uint8Array(roundedWidth * height);
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        grayData[i / 4] = gray < 128 ? 0 : 1; // 0 = Black, 1 = White
    }

    // GS v 0 command
    const rasterData: number[] = [];
    const xL = (roundedWidth / 8) % 256;
    const xH = Math.floor((roundedWidth / 8) / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    rasterData.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);

    for (let i = 0; i < grayData.length; i += 8) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            if (grayData[i + b] === 0) { // If black
                byte |= (1 << (7 - b));
            }
        }
        rasterData.push(byte);
    }

    return rasterData;
};

// --- QR GENERATOR ---
const generateQRCodeBytes = async (text: string): Promise<number[]> => {
    try {
        const dataUrl = await QRCode.toDataURL(text, { margin: 1, width: 250, errorCorrectionLevel: 'M' });
        const img = await loadImage(dataUrl);
        return convertImageToRaster(img, 250);
    } catch (e) {
        console.error("QR Gen Error", e);
        return [];
    }
};

// --- PRODUCTION TICKET GENERATOR ---
export const generateProductionTicket = async (
    order: Order, 
    settings: BusinessSettings, 
    products: Product[]
): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);
    const thickSep = '='.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    // --- HEADER ---
    add(COMMANDS.BOLD_ON);
    addLine(settings.name.toUpperCase());
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    // Order ID (Huge)
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); // Double Height/Width
    addLine(`ORDEN #${order.id.slice(-4)}`);
    add([GS, 0x21, 0x00]); // Reset
    add(COMMANDS.BOLD_OFF);
    addLine(separator);

    // Customer & Dates
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Cliente: ${normalize(order.customerName).substring(0, 25)}`);
    addLine(`Creado:  ${new Date(order.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`);
    
    if (order.deliveryDate) {
        add(COMMANDS.BOLD_ON);
        addLine(`ENTREGA: ${new Date(order.deliveryDate).toLocaleDateString()}`);
        add(COMMANDS.BOLD_OFF);
    }
    
    if (order.priority === 'HIGH') {
        addLine('\n');
        add(COMMANDS.ALIGN_CENTER);
        add([GS, 0x42, 0x01]); // Invert
        addLine(" !!! URGENTE !!! ");
        add([GS, 0x42, 0x00]); // Normal
        add(COMMANDS.ALIGN_LEFT);
    }
    addLine('\n');

    // Split Logic
    const toProduce: any[] = [];
    const toPick: any[] = [];

    order.items.forEach(item => {
        let currentStock = 0;
        const product = products.find(p => p.id === item.id);
        if (product) {
            if (item.variantId && product.variants) {
                const v = product.variants.find(v => v.id === item.variantId);
                currentStock = v ? v.stock : 0;
            } else {
                currentStock = product.stock;
            }
        }
        const pickQty = Math.min(item.quantity, Math.max(0, currentStock));
        const makeQty = item.quantity - pickQty;

        if (pickQty > 0) toPick.push({ ...item, quantity: pickQty });
        if (makeQty > 0) toProduce.push({ ...item, quantity: makeQty });
    });

    // --- SECTION: PRODUCE (Bold, Big) ---
    if (toProduce.length > 0) {
        add(COMMANDS.ALIGN_CENTER);
        add([GS, 0x42, 0x01]); // Invert ON
        addLine("   A  PRODUCIR   ");
        add([GS, 0x42, 0x00]); // Invert OFF
        add(COMMANDS.ALIGN_LEFT);
        addLine('\n');
        
        toProduce.forEach(item => {
            // Checkbox and Qty
            add(COMMANDS.BOLD_ON);
            add([GS, 0x21, 0x11]); // Double Size
            add(encode(`[ ] ${item.quantity}`));
            add([GS, 0x21, 0x00]); // Reset
            add(COMMANDS.BOLD_OFF);
            
            // Item Name
            add(COMMANDS.BOLD_ON);
            addLine(` x ${normalize(item.name)}`);
            add(COMMANDS.BOLD_OFF);
            
            if (item.variantName) {
                addLine(`     >> ${normalize(item.variantName)}`);
            }
            addLine(separator); // Line between production items
        });
        addLine('\n');
    }

    // --- SECTION: WAREHOUSE (Simple list) ---
    if (toPick.length > 0) {
        add(COMMANDS.ALIGN_CENTER);
        addLine("--- TOMAR DE BODEGA ---");
        add(COMMANDS.ALIGN_LEFT);
        
        toPick.forEach(item => {
            addLine(`[ ] ${item.quantity} x ${normalize(item.name)}`);
            if (item.variantName) {
                addLine(`    (${normalize(item.variantName)})`);
            }
        });
        addLine('\n');
    }

    // --- NOTES ---
    if (order.notes) {
        add(COMMANDS.ALIGN_CENTER);
        add([GS, 0x42, 0x01]); // Invert
        addLine(" NOTAS ");
        add([GS, 0x42, 0x00]); // Normal
        add(COMMANDS.ALIGN_LEFT);
        addLine(normalize(order.notes));
        addLine('\n');
    }

    // --- QR CODE ---
    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    const qrData = await generateQRCodeBytes(order.id);
    if (qrData.length > 0) {
        add(qrData);
        addLine("SCAN TRACKING");
    }
    
    add(COMMANDS.FEED_LINES(4));
    return new Uint8Array(buffer);
};

// --- GLOBAL BATCH TICKET (CONSOLIDATED) ---
export const generateConsolidatedProduction = async (
    orders: Order[], 
    settings: BusinessSettings,
    products: Product[]
): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    // Consolidate Logic
    const summaryItems: Record<string, any> = {};
    orders.forEach(o => o.items.forEach(i => {
        const key = i.variantId ? `${i.id}-${i.variantId}` : i.id;
        if (!summaryItems[key]) summaryItems[key] = { ...i, quantity: 0, orders: [] };
        summaryItems[key].quantity += i.quantity;
    }));
    
    // Split Logic
    const toProduce: any[] = [];
    const toPick: any[] = [];

    Object.values(summaryItems).forEach((item: any) => {
        let currentStock = 0;
        const product = products.find(p => p.id === item.id);
        if (product) {
            if (item.variantId && product.variants) {
                const v = product.variants.find(v => v.id === item.variantId);
                currentStock = v ? v.stock : 0;
            } else {
                currentStock = product.stock;
            }
        }
        const pickQty = Math.min(item.quantity, Math.max(0, currentStock));
        const makeQty = item.quantity - pickQty;
        if (pickQty > 0) toPick.push({ ...item, quantity: pickQty });
        if (makeQty > 0) toProduce.push({ ...item, quantity: makeQty });
    });

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);
    
    // Header
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]);
    addLine("LISTA MAESTRA");
    add([GS, 0x21, 0x00]);
    add(COMMANDS.BOLD_OFF);
    addLine("RESUMEN GLOBAL");
    addLine(separator);
    
    addLine(`Fecha: ${new Date().toLocaleString()}`);
    addLine(`Pedidos: ${orders.length} órdenes`);
    addLine(separator);

    if (toProduce.length > 0) {
        add(COMMANDS.ALIGN_CENTER);
        add([GS, 0x42, 0x01]); // Invert
        addLine(" TOTAL A PRODUCIR ");
        add([GS, 0x42, 0x00]);
        add(COMMANDS.ALIGN_LEFT);
        addLine('\n');

        toProduce.forEach(item => {
            // Big Qty
            add(COMMANDS.BOLD_ON);
            add([GS, 0x21, 0x01]); 
            add(encode(`[ ] ${item.quantity}`));
            add([GS, 0x21, 0x00]); 
            add(COMMANDS.BOLD_OFF);
            
            addLine(` x ${normalize(item.name)}`);
            if(item.variantName) addLine(`     (${normalize(item.variantName)})`);
            addLine(separator);
        });
        addLine('\n');
    }

    if (toPick.length > 0) {
        add(COMMANDS.ALIGN_CENTER);
        addLine("--- TOTAL BODEGA ---");
        add(COMMANDS.ALIGN_LEFT);
        toPick.forEach(item => {
            addLine(`[ ] ${item.quantity} x ${normalize(item.name)}`);
            if(item.variantName) addLine(`    (${normalize(item.variantName)})`);
        });
    }

    add(COMMANDS.ALIGN_CENTER);
    addLine('\n');
    addLine("--- FIN DE LISTA ---");
    add(COMMANDS.FEED_LINES(4));
    return new Uint8Array(buffer);
};

// ... (Rest of existing Ticket generators remain unchanged)
// --- TICKET GENERATOR ---
export const generateEscPosTicket = async (transaction: Transaction, customerName: string, settings: BusinessSettings, copyLabel?: string): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    if (settings.receiptLogo) {
        try {
            const img = await loadImage(settings.receiptLogo);
            const maxDots = settings.ticketPaperWidth === '58mm' ? 384 : 576; 
            const rasterData = convertImageToRaster(img, maxDots);
            add(rasterData);
            add(COMMANDS.FEED_LINES(1));
        } catch (e) { console.warn("Logo failed", e); }
    }

    // --- COPY LABEL ---
    if (copyLabel) {
        add(COMMANDS.BOLD_ON);
        addLine(`*** ${copyLabel} ***`);
        add(COMMANDS.BOLD_OFF);
        addLine('\n');
    }

    add(COMMANDS.BOLD_ON);
    addLine(settings.name);
    add(COMMANDS.BOLD_OFF);
    if (settings.address) addLine(settings.address);
    if (settings.phone) addLine(`Tel: ${settings.phone}`);
    addLine('\n');
    
    if (settings.receiptHeader) {
        addLine(settings.receiptHeader);
        addLine('\n');
    }
    
    addLine(separator);
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Folio: #${transaction.id}`);
    addLine(`Fecha: ${new Date(transaction.date).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}`);
    addLine(`Cliente: ${customerName.substring(0, 20)}`);
    addLine(separator);

    add(COMMANDS.BOLD_ON);
    // Usamos headers cortos para que encajen mejor
    addLine(formatRow("Can", "Desc.", "Total", settings.ticketPaperWidth));
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    transaction.items.forEach(item => {
        const total = (item.price * item.quantity).toFixed(2);
        // El nombre se trunca para asegurar alineacion perfecta
        addLine(formatRow(item.quantity.toString(), item.name, `$${total}`, settings.ticketPaperWidth));
        
        // Si hay variante, se pone en otra linea con sangría
        if (item.variantName) {
            const indent = settings.ticketPaperWidth === '58mm' ? '    ' : '      ';
            addLine(`${indent}${normalize(item.variantName).substring(0, settings.ticketPaperWidth === '58mm' ? 28 : 42)}`);
        }
    });

    addLine(separator);
    add(COMMANDS.ALIGN_RIGHT);
    
    if (transaction.discount > 0) addLine(`Desc: -$${transaction.discount.toFixed(2)}`);
    if (transaction.shipping > 0) addLine(`Envio: $${transaction.shipping.toFixed(2)}`);
    
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); // Double Height/Width
    addLine(`TOTAL: $${transaction.total.toFixed(2)}`);
    add([GS, 0x21, 0x00]); // Reset
    add(COMMANDS.BOLD_OFF);

    // CHANGE AND PAYMENT DISPLAY LOGIC
    // Use tenderedAmount if available (new logic), otherwise fallback to amountPaid
    const paid = transaction.tenderedAmount || transaction.amountPaid || 0;
    const change = Math.max(0, paid - transaction.total);
    
    if (transaction.paymentMethod === 'cash' || paid > transaction.total) {
        addLine(`Efectivo: $${paid.toFixed(2)}`);
        add(COMMANDS.BOLD_ON);
        addLine(`Cambio:   $${change.toFixed(2)}`);
        add(COMMANDS.BOLD_OFF);
    } else {
        addLine(`Pago: ${transaction.paymentMethod.toUpperCase()}`);
    }

    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    if (settings.receiptFooter) addLine(settings.receiptFooter);
    else addLine("Gracias por su compra");
    
    add(COMMANDS.FEED_LINES(4)); 
    return new Uint8Array(buffer);
};

// --- Z REPORT GENERATOR ---
export const generateEscPosZReport = async (movement: CashMovement, settings: BusinessSettings): Promise<Uint8Array> => {
    const z = movement.zReportData;
    if (!z) return new Uint8Array([]);

    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);
    const width = settings.ticketPaperWidth;

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    if (settings.receiptLogo) {
        try {
            const img = await loadImage(settings.receiptLogo);
            const maxDots = width === '58mm' ? 384 : 576; 
            const rasterData = convertImageToRaster(img, maxDots);
            add(rasterData);
        } catch (e) {}
    }

    // --- ENHANCED TITLE ---
    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); // Double width/height
    addLine("CORTE Z");
    add([GS, 0x21, 0x00]); // Reset size
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    addLine(settings.name);
    addLine(new Date(movement.date).toLocaleString());
    addLine(separator);

    add(COMMANDS.ALIGN_LEFT);
    addLine(formatTwoCols("Fondo Inicial:", `$${z.openingFund.toFixed(2)}`, width));
    addLine(formatTwoCols("+ Ventas Totales:", `$${z.grossSales.toFixed(2)}`, width));
    addLine(formatTwoCols("- Gastos (Efe):", `$${z.expenses.toFixed(2)}`, width));
    addLine(formatTwoCols("- Retiros (Efe):", `$${z.withdrawals.toFixed(2)}`, width));
    addLine(separator);

    add(COMMANDS.BOLD_ON);
    addLine(formatTwoCols("Esperado Caja:", `$${z.expectedCash.toFixed(2)}`, width));
    addLine(formatTwoCols("Declarado:", `$${z.declaredCash.toFixed(2)}`, width));
    
    const diff = z.difference;
    if (diff !== 0) {
        addLine(formatTwoCols("DIFERENCIA:", `$${diff.toFixed(2)}`, width));
    } else {
        add(COMMANDS.ALIGN_CENTER);
        addLine("*** BALANCEADO ***");
        add(COMMANDS.ALIGN_LEFT);
    }
    add(COMMANDS.BOLD_OFF);
    addLine(separator);

    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    addLine("DESGLOSE DE VENTAS");
    add(COMMANDS.BOLD_OFF);
    add(COMMANDS.ALIGN_LEFT);
    addLine(formatTwoCols("Efectivo:", `$${z.cashSales.toFixed(2)}`, width));
    addLine(formatTwoCols("Tarjeta:", `$${z.cardSales.toFixed(2)}`, width));
    addLine(formatTwoCols("Transferencia:", `$${z.transferSales.toFixed(2)}`, width));
    addLine(formatTwoCols("Credito:", `$${z.creditSales.toFixed(2)}`, width));

    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    addLine("--- FIN DEL REPORTE ---");
    add(COMMANDS.FEED_LINES(4));

    return new Uint8Array(buffer);
};

export const generateTestTicket = (): Uint8Array => {
    // Basic test
    const buffer: number[] = [];
    const add = (data: number[]) => buffer.push(...data);
    const enc = new TextEncoder();
    const addText = (str: string) => buffer.push(...Array.from(enc.encode(normalize(str))));

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    addText("PRUEBA DE IMPRESION\n");
    add(COMMANDS.BOLD_OFF);
    addText("--------------------------------\n");
    add(COMMANDS.ALIGN_LEFT);
    addText(formatRow("1", "Producto Prueba", "$10.00", "58mm") + "\n");
    addText(formatRow("2", "Otro Producto", "$20.00", "58mm") + "\n");
    add(COMMANDS.ALIGN_CENTER);
    addText("--------------------------------\n");
    add(COMMANDS.FEED_LINES(5));
    
    return new Uint8Array(buffer);
};

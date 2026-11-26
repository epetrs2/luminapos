
import { Transaction, BusinessSettings, CashMovement, Order, Product } from "../types";
import QRCode from 'qrcode';

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],
    CODE_PAGE: [ESC, 0x74, 0x10], // WPC1252 (Spanish accents, ñ, ¿, ¡)
    ALIGN_LEFT: [ESC, 0x61, 0x00],
    ALIGN_CENTER: [ESC, 0x61, 0x01],
    ALIGN_RIGHT: [ESC, 0x61, 0x02],
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    INVERT_ON: [GS, 0x42, 0x01], // Black background / White text
    INVERT_OFF: [GS, 0x42, 0x00],
    FEED_LINES: (n: number) => [ESC, 0x64, n],
};

// Map common Spanish / Latin-1 characters to WPC1252 single-byte values
const WPC1252_MAP: Record<string, number> = {
    '¡': 0xA1, '¢': 0xA2, '£': 0xA3, '°': 0xB0, '¿': 0xBF,
    'Á': 0xC1, 'É': 0xC9, 'Í': 0xCD, 'Ñ': 0xD1, 'Ó': 0xD3, 'Ú': 0xDA, 'Ü': 0xDC,
    'á': 0xE1, 'é': 0xE9, 'í': 0xED, 'ñ': 0xF1, 'ó': 0xF3, 'ú': 0xFA, 'ü': 0xFC,
    '€': 0x80, '–': 0x2D, '—': 0x2D, '•': 0x2A, '“': 0x22, '”': 0x22, '‘': 0x27, '’': 0x27,
};

const normalize = (str: string | undefined | null) => {
    if (str === undefined || str === null) return '';
    return String(str);
};

const encode = (str: string | undefined | null): Uint8Array => {
    const safe = normalize(str);
    const bytes: number[] = [];
    for (let i = 0; i < safe.length; i++) {
        const ch = safe[i];
        const code = ch.charCodeAt(0);
        if ((code >= 0x20 && code <= 0x7E) || code === 0x0A || code === 0x0D) {
            bytes.push(code);
        } else if (WPC1252_MAP[ch] !== undefined) {
            bytes.push(WPC1252_MAP[ch]);
        } else {
            // Fallback strip diacritic to ASCII if possible
            const ascii = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const c = ascii.charCodeAt(0);
            bytes.push(c >= 0x20 && c <= 0x7E ? c : 0x3F);
        }
    }
    return new Uint8Array(bytes);
};

// --- HELPER: CLEAN WORD WRAPPING FOR 58mm (32 cols) & 80mm (48 cols) ---
const getLineWidth = (widthType: '58mm' | '80mm') => (widthType === '58mm' ? 32 : 48);

const wrapText = (text: string | undefined | null, maxCols: number, indent = ''): string[] => {
    const clean = normalize(text).trim();
    if (!clean) return [];
    const effectiveWidth = Math.max(8, maxCols - indent.length);
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            if (word.length <= effectiveWidth) {
                current = word;
            } else {
                // Break overly long word/SKU cleanly
                let rest = word;
                while (rest.length > effectiveWidth) {
                    lines.push(indent + rest.slice(0, effectiveWidth));
                    rest = rest.slice(effectiveWidth);
                }
                current = rest;
            }
        } else if (current.length + 1 + word.length <= effectiveWidth) {
            current += ' ' + word;
        } else {
            lines.push(indent + current);
            if (word.length <= effectiveWidth) {
                current = word;
            } else {
                let rest = word;
                while (rest.length > effectiveWidth) {
                    lines.push(indent + rest.slice(0, effectiveWidth));
                    rest = rest.slice(effectiveWidth);
                }
                current = rest;
            }
        }
    }
    if (current) lines.push(indent + current);
    return lines;
};

// --- HELPER: STRICT FIXED WIDTH COLUMNS ---
const formatRow = (col1: string, col2: string, col3: string, widthType: '58mm' | '80mm') => {
    const is58mm = widthType === '58mm';
    const wQty = is58mm ? 4 : 6;
    const wTotal = is58mm ? 11 : 12;
    const wDesc = is58mm ? 17 : 30;

    const nCol1 = normalize(col1);
    const nCol2 = normalize(col2);
    const nCol3 = normalize(col3);

    const c1 = nCol1.substring(0, wQty - 1).padEnd(wQty, ' ');
    const c2 = nCol2.substring(0, wDesc - 1).padEnd(wDesc, ' ');
    const c3 = nCol3.substring(0, wTotal).padStart(wTotal, ' ');

    return c1 + c2 + c3;
};

const formatTwoCols = (left: string, right: string, widthType: '58mm' | '80mm') => {
    const totalWidth = getLineWidth(widthType);
    const nLeft = normalize(left);
    const nRight = normalize(right);

    const gap = totalWidth - nLeft.length - nRight.length;
    if (gap >= 1) {
        return nLeft + ' '.repeat(gap) + nRight;
    }
    const maxLeft = Math.max(4, totalWidth - nRight.length - 1);
    return nLeft.substring(0, maxLeft).padEnd(maxLeft + 1, ' ') + nRight;
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

// --- MONTH END THERMAL TICKET ---
export const generateMonthEndTicket = async (
    data: any, 
    settings: BusinessSettings
): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);
    const width = settings.ticketPaperWidth;

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    // --- HEADER ---
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); 
    addLine("CIERRE DE MES");
    add([GS, 0x21, 0x00]); 
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    addLine(`Periodo:`);
    addLine(`${data.periodStart} - ${data.periodEnd}`);
    addLine(separator);

    // --- FINANCIAL SUMMARY ---
    add(COMMANDS.ALIGN_LEFT);
    add(COMMANDS.BOLD_ON);
    addLine("RESUMEN FINANCIERO");
    add(COMMANDS.BOLD_OFF);
    addLine(formatTwoCols("Ingresos:", `$${data.income.toLocaleString()}`, width));
    addLine(formatTwoCols("Gastos Op:", `$${data.actualOpEx.toLocaleString()}`, width));
    addLine(formatTwoCols("Retiros:", `$${data.actualProfit.toLocaleString()}`, width));
    addLine(separator);

    // --- NET RESULT ---
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x01]); 
    addLine(formatTwoCols("INVERSION:", `$${data.actualInvestment.toLocaleString()}`, width));
    add([GS, 0x21, 0x00]); 
    add(COMMANDS.BOLD_OFF);
    addLine(separator);

    // --- CHECKBOXES (Confirmation) ---
    addLine("[X] Ganancias Repartidas");
    addLine("[X] Ahorro Apartado");
    addLine(separator);

    add(COMMANDS.ALIGN_CENTER);
    addLine("Generado por LuminaPOS");
    addLine(new Date().toLocaleString());
    add(COMMANDS.FEED_LINES(4));

    return new Uint8Array(buffer);
};

// ... (Existing exports: generateProductionTicket, generateConsolidatedProduction, generateEscPosTicket, generateEscPosZReport, generateTestTicket) ...
// --- PRODUCTION TICKET GENERATOR (INDIVIDUAL) ---
export const generateProductionTicket = async (
    order: Order, 
    settings: BusinessSettings, 
    products: Product[]
): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    // --- HEADER ---
    add(COMMANDS.BOLD_ON);
    // Double Height Title
    add([GS, 0x21, 0x10]); 
    addLine("PRODUCCION");
    add([GS, 0x21, 0x00]); 
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    // Order ID (Huge)
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); // Double Height/Width
    addLine(`#${order.id.slice(-4)}`);
    add([GS, 0x21, 0x00]); // Reset
    add(COMMANDS.BOLD_OFF);
    
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Cliente: ${normalize(order.customerName).substring(0, 20)}`);
    
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
        add(COMMANDS.ALIGN_LEFT);
        add(COMMANDS.BOLD_ON);
        addLine(">> A FABRICAR:");
        add(COMMANDS.BOLD_OFF);
        addLine(separator);
        
        toProduce.forEach(item => {
            // Checkbox and Qty
            add(COMMANDS.BOLD_ON);
            add([GS, 0x21, 0x01]); // Double Height only
            add(encode(`[ ] ${item.quantity}`));
            add([GS, 0x21, 0x00]); // Reset
            add(COMMANDS.BOLD_OFF);
            
            // Item Name
            add(COMMANDS.BOLD_ON);
            addLine(` x ${normalize(item.name)}`);
            add(COMMANDS.BOLD_OFF);
            
            if (item.variantName) {
                addLine(`     ${normalize(item.variantName)}`);
            }
            addLine('\n'); // Spacing between items
        });
    }

    // --- SECTION: WAREHOUSE (Simple list) ---
    if (toPick.length > 0) {
        add(COMMANDS.ALIGN_LEFT);
        addLine("\n");
        addLine(">> TOMAR DE BODEGA:");
        addLine(separator);
        
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
        addLine("TRACKING ID");
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
    add([GS, 0x42, 0x01]); // Invert
    addLine("  LISTA MAESTRA  ");
    add([GS, 0x42, 0x00]);
    add(COMMANDS.BOLD_OFF);
    addLine(new Date().toLocaleTimeString());
    addLine(`TOTAL: ${orders.length} PEDIDOS`);
    addLine(separator);

    if (toProduce.length > 0) {
        add(COMMANDS.ALIGN_CENTER);
        add(COMMANDS.BOLD_ON);
        addLine("--- TOTAL A PRODUCIR ---");
        add(COMMANDS.BOLD_OFF);
        add(COMMANDS.ALIGN_LEFT);
        addLine('\n');

        toProduce.forEach(item => {
            // Big Qty
            add(COMMANDS.BOLD_ON);
            add([GS, 0x21, 0x11]); // Double Size
            add(encode(`[ ] ${item.quantity}`));
            add([GS, 0x21, 0x00]); 
            add(COMMANDS.BOLD_OFF);
            
            addLine(` x ${normalize(item.name)}`);
            if(item.variantName) addLine(`     VAR: ${normalize(item.variantName)}`);
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
    addLine("FIN DE LISTA MAESTRA");
    add(COMMANDS.FEED_LINES(4));
    return new Uint8Array(buffer);
};

// --- TICKET GENERATOR (OPTIMIZED 58mm / 80mm — ZERO TRUNCATION) ---
export const generateEscPosTicket = async (transaction: Transaction, customerName: string, settings: BusinessSettings, copyLabel?: string): Promise<Uint8Array> => {
    const buffer: number[] = [];
    const add = (data: number[] | Uint8Array) => buffer.push(...(data instanceof Uint8Array ? Array.from(data) : data));
    const addLine = (text: string) => add(encode(text + '\n'));
    const widthType = settings.ticketPaperWidth || '58mm';
    const cols = getLineWidth(widthType);
    const separator = '-'.repeat(cols);
    const doubleSep = '='.repeat(cols);
    const addWrapped = (text: string | undefined | null, indent = '') => {
        wrapText(text, cols, indent).forEach(l => addLine(l));
    };

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE);
    add(COMMANDS.ALIGN_CENTER);

    if (settings.receiptLogo) {
        try {
            const img = await loadImage(settings.receiptLogo);
            const maxDots = widthType === '58mm' ? 384 : 576;
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
    }

    // Business Header (Double height only so long names fit 32 cols cleanly)
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x01]);
    addWrapped(settings.name || 'LuminaPOS');
    add([GS, 0x21, 0x00]);
    add(COMMANDS.BOLD_OFF);

    if (settings.address) addWrapped(settings.address);
    if (settings.phone) addLine(`Tel: ${settings.phone}`);
    if (settings.taxId) addLine(`RFC: ${settings.taxId}`);

    if (settings.receiptHeader) {
        addLine('');
        addWrapped(settings.receiptHeader);
    }

    addLine(separator);
    add(COMMANDS.ALIGN_LEFT);
    const formattedDate = new Date(transaction.date).toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
    addLine(formatTwoCols(`Folio: #${transaction.id}`, formattedDate, widthType));
    addWrapped(`Cliente: ${customerName || 'Publico General'}`);
    const totalUnits = transaction.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    addLine(formatTwoCols(`Articulos: ${Number(totalUnits.toFixed(3))}`, `Pago: ${transaction.paymentMethod === 'cash' ? 'Efectivo' : transaction.paymentMethod === 'card' ? 'Tarjeta' : transaction.paymentMethod === 'transfer' ? 'Transf.' : transaction.paymentMethod === 'credit' ? 'Credito' : 'Dividido'}`, widthType));
    addLine(separator);

    // 2-Line Professional Layout per Item (Full Name + Qty x UnitPrice -> Line Total)
    add(COMMANDS.BOLD_ON);
    addLine(formatTwoCols('ARTICULO', 'IMPORTE', widthType));
    add(COMMANDS.BOLD_OFF);
    addLine(separator);

    transaction.items.forEach(item => {
        const lineTotal = (item.price * item.quantity).toFixed(2);
        const fullName = item.variantName ? `${item.name} (${item.variantName})` : item.name;
        // Line 1+: Complete wrapped product name (never truncated!)
        add(COMMANDS.BOLD_ON);
        addWrapped(fullName);
        add(COMMANDS.BOLD_OFF);
        // Line 2: Qty x Unit Price (left) + Subtotal (right)
        const qtyStr = Number.isInteger(item.quantity) ? String(item.quantity) : Number(item.quantity.toFixed(3)).toString();
        addLine(formatTwoCols(`  ${qtyStr} x $${item.price.toFixed(2)}`, `$${lineTotal}`, widthType));
    });

    addLine(separator);
    add(COMMANDS.ALIGN_LEFT);

    const hasExtras = (transaction.discount || 0) > 0 || (transaction.shipping || 0) > 0 || (transaction.taxAmount || 0) > 0;
    if (hasExtras) {
        addLine(formatTwoCols('Subtotal:', `$${transaction.subtotal.toFixed(2)}`, widthType));
    }
    if ((transaction.discount || 0) > 0) {
        addLine(formatTwoCols('Descuento:', `-$${transaction.discount.toFixed(2)}`, widthType));
    }
    if ((transaction.shipping || 0) > 0) {
        addLine(formatTwoCols('Envio:', `$${transaction.shipping.toFixed(2)}`, widthType));
    }
    if ((transaction.taxAmount || 0) > 0) {
        addLine(formatTwoCols('Impuestos:', `$${transaction.taxAmount.toFixed(2)}`, widthType));
    }

    addLine(doubleSep);
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x01]); // Double Height (fits 32 cols cleanly without wrapping!)
    addLine(formatTwoCols('TOTAL:', `$${transaction.total.toFixed(2)}`, widthType));
    add([GS, 0x21, 0x00]);
    add(COMMANDS.BOLD_OFF);
    addLine(doubleSep);

    // Complete Payment / Change / Split / Credit Balance Breakdown
    const paid = transaction.tenderedAmount || transaction.amountPaid || 0;
    const change = Math.max(0, paid - transaction.total);
    const pendingBalance = Math.max(0, transaction.total - (transaction.amountPaid || 0));

    if (transaction.paymentMethod === 'split' && transaction.splitDetails) {
        if (transaction.splitDetails.cash > 0) {
            addLine(formatTwoCols('  Efectivo:', `$${transaction.splitDetails.cash.toFixed(2)}`, widthType));
        }
        if (transaction.splitDetails.other > 0) {
            addLine(formatTwoCols('  Tarjeta/Transf:', `$${transaction.splitDetails.other.toFixed(2)}`, widthType));
        }
    } else if (transaction.paymentMethod === 'credit') {
        addLine(formatTwoCols('Abonado:', `$${(transaction.amountPaid || 0).toFixed(2)}`, widthType));
        add(COMMANDS.BOLD_ON);
        addLine(formatTwoCols('SALDO PENDIENTE:', `$${pendingBalance.toFixed(2)}`, widthType));
        add(COMMANDS.BOLD_OFF);
    } else if (transaction.paymentMethod === 'cash' || paid > transaction.total) {
        addLine(formatTwoCols('Efectivo:', `$${paid.toFixed(2)}`, widthType));
        add(COMMANDS.BOLD_ON);
        addLine(formatTwoCols('Cambio:', `$${change.toFixed(2)}`, widthType));
        add(COMMANDS.BOLD_OFF);
    } else {
        const label = transaction.paymentMethod === 'card' ? 'Tarjeta:' : 'Transferencia:';
        addLine(formatTwoCols(label, `$${(transaction.amountPaid || transaction.total).toFixed(2)}`, widthType));
    }

    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    if (settings.receiptFooter) {
        addWrapped(settings.receiptFooter);
    } else {
        addLine("Gracias por su compra");
    }
    if (settings.website) {
        addWrapped(settings.website);
    }

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

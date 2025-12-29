
import { Transaction, BusinessSettings, CashMovement } from "../types";

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
    FEED_LINES: (n: number) => [ESC, 0x64, n],
};

const normalize = (str: string) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\n]/g, "?");
};

const encode = (str: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(normalize(str));
};

// --- HELPER: FIXED WIDTH COLUMNS ---
const formatRow = (col1: string, col2: string, col3: string, widthType: '58mm' | '80mm') => {
    const totalWidth = widthType === '58mm' ? 32 : 48;
    
    // Config: 58mm [Qty 3][Space 1][Name 19][Space 1][Total 8] = 32
    // Config: 80mm [Qty 4][Space 1][Name 32][Space 1][Total 10] = 48
    
    const w1 = widthType === '58mm' ? 3 : 4;
    const w3 = widthType === '58mm' ? 8 : 10;
    const w2 = totalWidth - w1 - w3 - 2; 

    // Normalize FIRST to avoid length mismatch issues with accents
    const nCol1 = normalize(col1);
    const nCol2 = normalize(col2);
    const nCol3 = normalize(col3);

    // Truncate and Pad
    const c1 = nCol1.substring(0, w1).padEnd(w1);
    const c2 = nCol2.substring(0, w2).padEnd(w2);
    const c3 = nCol3.substring(0, w3).padStart(w3); // Align right

    return `${c1} ${c2} ${c3}`;
};

const formatTwoCols = (left: string, right: string, widthType: '58mm' | '80mm') => {
    const totalWidth = widthType === '58mm' ? 32 : 48;
    const wRight = Math.floor(totalWidth * 0.4); 
    const wLeft = totalWidth - wRight - 1;
    
    const nLeft = normalize(left);
    const nRight = normalize(right);

    const l = nLeft.substring(0, wLeft).padEnd(wLeft);
    const r = nRight.substring(0, wRight).padStart(wRight);
    return `${l} ${r}`;
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
    addLine(formatRow("Can", "Descripcion", "Total", settings.ticketPaperWidth));
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    transaction.items.forEach(item => {
        const total = (item.price * item.quantity).toFixed(2);
        addLine(formatRow(item.quantity.toString(), item.name, `$${total}`, settings.ticketPaperWidth));
        if (item.variantName) addLine(`  ${item.variantName}`);
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

    if (transaction.paymentMethod === 'cash') {
        const paid = transaction.amountPaid || 0;
        const change = Math.max(0, paid - transaction.total);
        addLine(`Efectivo: $${paid.toFixed(2)}`);
        addLine(`Cambio: $${change.toFixed(2)}`);
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

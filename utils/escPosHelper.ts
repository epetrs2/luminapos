
import { Transaction, BusinessSettings } from "../types";

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40],
    CODE_PAGE: [ESC, 0x74, 0], // PC437
    ALIGN_LEFT: [ESC, 0x61, 0],
    ALIGN_CENTER: [ESC, 0x61, 1],
    ALIGN_RIGHT: [ESC, 0x61, 2],
    BOLD_ON: [ESC, 0x45, 1],
    BOLD_OFF: [ESC, 0x45, 0],
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
/**
 * Creates a fixed-width row for thermal printers.
 * Handles text truncation or padding to ensure alignment.
 */
const formatRow = (col1: string, col2: string, col3: string, widthType: '58mm' | '80mm') => {
    const totalWidth = widthType === '58mm' ? 32 : 48;
    
    // Configuración de anchos
    // 58mm: Cant(3) + Space(1) + Name(18) + Space(1) + Total(9) = 32
    // 80mm: Cant(4) + Space(1) + Name(31) + Space(1) + Total(11) = 48
    let w1 = widthType === '58mm' ? 3 : 4;
    let w3 = widthType === '58mm' ? 9 : 11;
    let w2 = totalWidth - w1 - w3 - 2; // -2 for spaces

    const c1 = col1.substring(0, w1).padEnd(w1);
    const c3 = col3.substring(0, w3).padStart(w3); // Price aligned to right
    const c2 = col2.substring(0, w2).padEnd(w2);

    return `${c1} ${c2} ${c3}`;
};

// --- IMAGE PROCESSING: FLOYD-STEINBERG DITHERING ---
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

    // Resize
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

    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, roundedWidth, height);
    ctx.drawImage(img, 0, 0, roundedWidth, height);

    const imgData = ctx.getImageData(0, 0, roundedWidth, height);
    const data = imgData.data; // RGBA array

    // Convert to Grayscale
    const grayData = new Uint8Array(roundedWidth * height);
    for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        grayData[i / 4] = gray;
    }

    // Apply Floyd-Steinberg Dithering
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < roundedWidth; x++) {
            const idx = y * roundedWidth + x;
            const oldPixel = grayData[idx];
            const newPixel = oldPixel < 128 ? 0 : 255; // Threshold
            grayData[idx] = newPixel;
            
            const quantError = oldPixel - newPixel;

            // Distribute error to neighbors
            if (x + 1 < roundedWidth) 
                grayData[idx + 1] += (quantError * 7) / 16;
            if (x - 1 >= 0 && y + 1 < height) 
                grayData[idx + roundedWidth - 1] += (quantError * 3) / 16;
            if (y + 1 < height) 
                grayData[idx + roundedWidth] += (quantError * 5) / 16;
            if (x + 1 < roundedWidth && y + 1 < height) 
                grayData[idx + roundedWidth + 1] += (quantError * 1) / 16;
        }
    }

    // Pack bits for ESC/POS (GS v 0)
    const rasterData: number[] = [];
    const xL = (roundedWidth / 8) % 256;
    const xH = Math.floor((roundedWidth / 8) / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    // Command Header
    rasterData.push(GS, 0x76, 0x30, 0, xL, xH, yL, yH);

    for (let i = 0; i < grayData.length; i += 8) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            // If pixel is black (0), set bit to 1
            if (grayData[i + b] === 0) {
                byte |= (1 << (7 - b));
            }
        }
        rasterData.push(byte);
    }

    return rasterData;
};

// --- MAIN GENERATOR ---

export const generateEscPosTicket = async (transaction: Transaction, customerName: string, settings: BusinessSettings): Promise<Uint8Array> => {
    const buffer: number[] = [];

    const add = (data: number[] | Uint8Array) => {
        if (data instanceof Uint8Array) {
            buffer.push(...Array.from(data));
        } else {
            buffer.push(...data);
        }
    };

    const addText = (text: string) => add(encode(text));
    const addLine = (text: string) => addText(text + '\n');
    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    // 1. Init
    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    // 2. Logo (Receipt Logo Only - Optimized)
    if (settings.receiptLogo) {
        try {
            const img = await loadImage(settings.receiptLogo);
            // 384 dots for 58mm, 576 dots for 80mm
            const maxDots = settings.ticketPaperWidth === '58mm' ? 384 : 576; 
            const rasterData = convertImageToRaster(img, maxDots);
            
            add(rasterData);
            add(COMMANDS.FEED_LINES(1));
        } catch (e) {
            console.warn("Logo print failed", e);
        }
    }

    // 3. Header
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

    // 4. Info
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Folio: #${transaction.id}`);
    addLine(`Fecha: ${new Date(transaction.date).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}`);
    addLine(`Cliente: ${customerName.substring(0, settings.ticketPaperWidth === '58mm' ? 22 : 38)}`);
    addLine(separator);

    // 5. Items (Grid Layout)
    add(COMMANDS.BOLD_ON);
    addLine(formatRow("Cnt", "Descripcion", "Total", settings.ticketPaperWidth));
    add(COMMANDS.BOLD_OFF);
    addLine(separator);
    
    transaction.items.forEach(item => {
        const total = (item.price * item.quantity).toFixed(2);
        const qty = item.quantity.toString();
        // Use the formatter
        addLine(formatRow(qty, item.name, `$${total}`, settings.ticketPaperWidth));
        
        // Optional: If name is very long, print rest on next line?
        // Current logic truncates to keep table clean.
        // If variant exists, print below indented
        if (item.variantName) {
            const indent = settings.ticketPaperWidth === '58mm' ? "    " : "     ";
            addLine(`${indent}${item.variantName}`);
        }
    });

    addLine(separator);

    // 6. Totals
    add(COMMANDS.ALIGN_RIGHT);
    
    if (transaction.discount > 0) {
        addLine(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
        addLine(`Desc: -$${transaction.discount.toFixed(2)}`);
    }
    
    add(COMMANDS.BOLD_ON);
    add([GS, 0x21, 0x11]); // Double size
    addLine(`TOTAL: $${transaction.total.toFixed(2)}`);
    add([GS, 0x21, 0x00]); // Reset size
    add(COMMANDS.BOLD_OFF);

    if (transaction.paymentMethod === 'cash') {
        const paid = transaction.amountPaid || 0;
        const change = Math.max(0, paid - transaction.total);
        addLine(`Efectivo: $${paid.toFixed(2)}`);
        addLine(`Cambio: $${change.toFixed(2)}`);
    } else if (transaction.paymentMethod === 'split') {
        addLine(`Efectivo: $${transaction.splitDetails?.cash.toFixed(2)}`);
        addLine(`Otro: $${transaction.splitDetails?.other.toFixed(2)}`);
    } else {
        addLine(`Pago: ${transaction.paymentMethod === 'card' ? 'TARJETA' : transaction.paymentMethod === 'transfer' ? 'TRANSFERENCIA' : 'CREDITO'}`);
    }

    // 7. Footer
    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    if (settings.receiptFooter) {
        addLine(settings.receiptFooter);
    } else {
        addLine("Gracias por su compra");
    }
    
    // 8. Feed & Cut
    add(COMMANDS.FEED_LINES(5)); 
    
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


import { Transaction, BusinessSettings } from "../types";

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40], // Initialize printer
    CODE_PAGE: [ESC, 0x74, 0], // Select character code table (0 = PC437 standard)
    CHAR_SET: [ESC, 0x52, 0], // Select international character set (0 = USA)
    ALIGN_LEFT: [ESC, 0x61, 0],
    ALIGN_CENTER: [ESC, 0x61, 1],
    ALIGN_RIGHT: [ESC, 0x61, 2],
    BOLD_ON: [ESC, 0x45, 1],
    BOLD_OFF: [ESC, 0x45, 0],
    FEED_LINES: (n: number) => [ESC, 0x64, n], // Feed n lines
};

// Helper to sanitize text 
const normalize = (str: string) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^\x20-\x7E\n]/g, "?"); // Replace non-printable
};

const encode = (str: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(normalize(str));
};

// --- IMAGE PROCESSING LOGIC ---

// Load image from URL
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Important for external URLs
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
    });
};

// Convert Image to Raster Bit Format (GS v 0)
const convertImageToRaster = (img: HTMLImageElement, maxWidth: number = 384): number[] => {
    // 1. Setup Canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    // 2. Resize maintaining aspect ratio
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth) {
        height = Math.floor(height * (maxWidth / width));
        width = maxWidth;
    }

    // Ensure width is divisible by 8 for byte packing
    const roundedWidth = Math.floor(width / 8) * 8;
    
    canvas.width = roundedWidth;
    canvas.height = height;

    // 3. Draw image (Flatten transparency to white)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, roundedWidth, height);
    ctx.drawImage(img, 0, 0, roundedWidth, height);

    const imgData = ctx.getImageData(0, 0, roundedWidth, height);
    const pixels = imgData.data;
    
    // 4. Convert to Monochrome Raster Data
    const rasterData: number[] = [];
    
    // Raster Header: GS v 0 m xL xH yL yH
    // m=0 (Normal)
    const xL = (roundedWidth / 8) % 256;
    const xH = Math.floor((roundedWidth / 8) / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    rasterData.push(GS, 0x76, 0x30, 0, xL, xH, yL, yH);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < roundedWidth; x += 8) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                const pixelIndex = ((y * roundedWidth) + (x + b)) * 4;
                // Simple luminance formula: 0.299R + 0.587G + 0.114B
                const avg = (pixels[pixelIndex] * 0.299 + pixels[pixelIndex + 1] * 0.587 + pixels[pixelIndex + 2] * 0.114);
                
                // Threshold logic (Darker than 128 = Black/Print)
                // In thermal printing, 1 = Print (Black), 0 = White
                if (avg < 128) {
                    byte |= (1 << (7 - b));
                }
            }
            rasterData.push(byte);
        }
    }

    return rasterData;
};

// --- MAIN GENERATOR (Now Async) ---

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

    // --- 1. INITIALIZE ---
    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);

    // --- 2. LOGO (If available) ---
    if (settings.receiptLogo) {
        try {
            const img = await loadImage(settings.receiptLogo);
            // 384 dots for 58mm, 576 dots for 80mm
            const maxDots = settings.ticketPaperWidth === '58mm' ? 384 : 576; 
            const rasterData = convertImageToRaster(img, maxDots);
            
            add(rasterData);
            add(COMMANDS.FEED_LINES(1)); // Spacer after logo
        } catch (e) {
            console.warn("Could not load logo for printing", e);
        }
    }

    // --- 3. HEADER TEXT ---
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

    // --- 4. TRANSACTION INFO ---
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Folio: #${transaction.id}`);
    addLine(`Fecha: ${new Date(transaction.date).toLocaleString('es-MX')}`);
    addLine(`Cliente: ${customerName}`);
    addLine(separator);

    // --- 5. ITEMS ---
    if (settings.ticketPaperWidth === '58mm') {
        addLine("Cant  Descrip.       Total");
    } else {
        addLine("Cant   Descrip.           P.Unit   Total");
    }
    
    transaction.items.forEach(item => {
        const name = item.name.substring(0, 16);
        const total = (item.price * item.quantity).toFixed(2);
        
        if (settings.ticketPaperWidth === '58mm') {
            const qtyStr = item.quantity.toString().padEnd(3);
            const nameStr = name.padEnd(18);
            const totalStr = total.padStart(9);
            addLine(`${qtyStr} ${nameStr} ${totalStr}`);
        } else {
            addLine(`${item.quantity} x ${item.name}`);
            add(COMMANDS.ALIGN_RIGHT);
            addLine(`$${total}`);
            add(COMMANDS.ALIGN_LEFT);
        }
    });

    addLine(separator);

    // --- 6. TOTALS ---
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
    } else {
        addLine(`Pago: ${transaction.paymentMethod.toUpperCase()}`);
    }

    // --- 7. FOOTER ---
    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    if (settings.receiptFooter) addLine(settings.receiptFooter);
    addLine("Gracias por su compra");
    
    // --- 8. FEED & CUT ---
    add(COMMANDS.FEED_LINES(5)); 
    
    return new Uint8Array(buffer);
};

export const generateTestTicket = (): Uint8Array => {
    // Keep sync for simple test
    const buffer: number[] = [];
    const add = (data: number[]) => buffer.push(...data);
    const enc = new TextEncoder();
    const addText = (str: string) => {
        const safeStr = str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
        buffer.push(...Array.from(enc.encode(safeStr)));
    };

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); 
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    addText("LUMINA POS\n");
    addText("IMPRESION DE PRUEBA\n");
    add(COMMANDS.BOLD_OFF);
    addText("--------------------------------\n");
    add(COMMANDS.ALIGN_LEFT);
    addText("Si puedes leer esto,\n");
    addText("tu impresora funciona.\n");
    addText("Caracteres: ABC 123 USD\n");
    add(COMMANDS.ALIGN_CENTER);
    addText("--------------------------------\n");
    add(COMMANDS.FEED_LINES(5));
    
    return new Uint8Array(buffer);
};


import { Transaction, BusinessSettings } from "../types";

// Standard ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

const COMMANDS = {
    INIT: [ESC, 0x40], // Initialize printer
    CODE_PAGE: [ESC, 0x74, 0], // Select character code table (0 = PC437 standard)
    CHAR_SET: [ESC, 0x52, 0], // Select international character set (0 = USA)
    TEXT_FORMAT: [ESC, 0x21], // Select print mode
    ALIGN_LEFT: [ESC, 0x61, 0],
    ALIGN_CENTER: [ESC, 0x61, 1],
    ALIGN_RIGHT: [ESC, 0x61, 2],
    BOLD_ON: [ESC, 0x45, 1],
    BOLD_OFF: [ESC, 0x45, 0],
    CUT: [GS, 0x56, 66, 0], // Feed and cut
    FEED_LINES: (n: number) => [ESC, 0x64, n], // Feed n lines
};

// Helper to sanitize text 
// We aggressively strip accents and convert to ASCII to ensure compatibility with basic firmware
// that doesn't support UTF-8 multibyte characters.
const normalize = (str: string) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^\x20-\x7E\n]/g, "?"); // Replace non-printable/non-ASCII with ?
};

const encode = (str: string) => {
    const encoder = new TextEncoder();
    return encoder.encode(normalize(str));
};

export const generateEscPosTicket = (transaction: Transaction, customerName: string, settings: BusinessSettings): Uint8Array => {
    const buffer: number[] = [];

    const add = (data: number[] | Uint8Array) => {
        if (data instanceof Uint8Array) {
            buffer.push(...Array.from(data));
        } else {
            buffer.push(...data);
        }
    };

    const addText = (text: string) => {
        add(encode(text));
    };

    const addLine = (text: string) => {
        addText(text + '\n');
    };

    const separator = '-'.repeat(settings.ticketPaperWidth === '58mm' ? 32 : 48);

    // --- 1. INITIALIZE ---
    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); // Force PC437
    add(COMMANDS.CHAR_SET);
    
    // --- 2. HEADER ---
    add(COMMANDS.ALIGN_CENTER);
    add(COMMANDS.BOLD_ON);
    
    // Header Info
    addLine(settings.name);
    add(COMMANDS.BOLD_OFF);
    
    if (settings.address) addLine(settings.address);
    if (settings.phone) addLine(`Tel: ${settings.phone}`);
    addLine('\n'); // Spacer
    
    if (settings.receiptHeader) {
        addLine(settings.receiptHeader);
        addLine('\n');
    }
    
    addLine(separator);

    // --- 3. TRANSACTION INFO ---
    add(COMMANDS.ALIGN_LEFT);
    addLine(`Folio: #${transaction.id}`);
    addLine(`Fecha: ${new Date(transaction.date).toLocaleString('es-MX')}`);
    addLine(`Cliente: ${customerName}`);
    addLine(separator);

    // --- 4. ITEMS ---
    // Header for items
    if (settings.ticketPaperWidth === '58mm') {
        // Simple layout for 58mm
        addLine("Cant  Descrip.       Total");
    } else {
        addLine("Cant   Descrip.           P.Unit   Total");
    }
    
    transaction.items.forEach(item => {
        const name = item.name.substring(0, 16); // Truncate name
        const total = (item.price * item.quantity).toFixed(2);
        
        if (settings.ticketPaperWidth === '58mm') {
            // 58mm approx 32 chars
            // Qty (3) + Space (1) + Name (18) + Space (1) + Total (9)
            const qtyStr = item.quantity.toString().padEnd(3);
            const nameStr = name.padEnd(18);
            const totalStr = total.padStart(9);
            addLine(`${qtyStr} ${nameStr} ${totalStr}`);
            // If name was truncated or long, maybe print full on next line? 
            // For simplicity/cleanliness, we truncated.
        } else {
            // 80mm layout
            addLine(`${item.quantity} x ${item.name}`);
            add(COMMANDS.ALIGN_RIGHT);
            addLine(`$${total}`);
            add(COMMANDS.ALIGN_LEFT);
        }
    });

    addLine(separator);

    // --- 5. TOTALS ---
    add(COMMANDS.ALIGN_RIGHT);
    
    if (transaction.discount > 0) {
        addLine(`Subtotal: $${transaction.subtotal.toFixed(2)}`);
        addLine(`Desc: -$${transaction.discount.toFixed(2)}`);
    }
    
    add(COMMANDS.BOLD_ON);
    // Double size for Total
    add([GS, 0x21, 0x11]); // Double width & height
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

    // --- 6. FOOTER ---
    add(COMMANDS.ALIGN_CENTER);
    addLine(separator);
    if (settings.receiptFooter) addLine(settings.receiptFooter);
    addLine("Gracias por su compra");
    
    // --- 7. FEED & CUT ---
    // Feed 5 lines to clear the cutter/tear bar
    add(COMMANDS.FEED_LINES(5)); 
    
    return new Uint8Array(buffer);
};

export const generateTestTicket = (): Uint8Array => {
    const buffer: number[] = [];
    const add = (data: number[]) => buffer.push(...data);
    const enc = new TextEncoder();
    const addText = (str: string) => {
        // Simple normalization for test
        const safeStr = str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
        buffer.push(...Array.from(enc.encode(safeStr)));
    };

    add(COMMANDS.INIT);
    add(COMMANDS.CODE_PAGE); // PC437
    
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
    addText("\n\n\n\n\n"); // Feed lines manually to ensure it scrolls out
    
    return new Uint8Array(buffer);
};

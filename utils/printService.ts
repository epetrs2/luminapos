
import { Transaction, BusinessSettings, CashMovement, Order, CartItem, Product } from '../types';
import { generateEscPosTicket, generateEscPosZReport, generateProductionTicket, generateConsolidatedProduction } from './escPosHelper';

// Estilos CSS base compartidos
const BASE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background-color: #fff; }
`;

const PRODUCTION_CSS = `
    ${BASE_CSS}
    body { font-size: 12px; margin: 20px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .header-left h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -1px; }
    .header-left p { margin: 0; color: #666; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .header-right { text-align: right; font-size: 11px; }
    
    .section-header { background: #000; color: #fff; padding: 8px 12px; font-weight: 800; margin-bottom: 15px; border-radius: 6px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
    .section-header.secondary { background: #cbd5e1; color: #334155; margin-top: 30px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { border-bottom: 2px solid #0f172a; text-align: left; padding: 8px 5px; font-weight: 800; color: #334155; text-transform: uppercase; font-size: 11px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 8px 5px; vertical-align: middle; color: #334155; }
    
    .check-box { width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; margin: 0 auto; }
    .qty-box { display: inline-block; padding: 4px 10px; border: 2px solid #0f172a; border-radius: 6px; font-weight: 800; min-width: 20px; text-align: center; }
    
    .footer { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .sig-box { border-top: 2px solid #cbd5e1; width: 30%; text-align: center; padding-top: 8px; font-size: 10px; font-weight: 700; color: #94a3b8; }
    
    .row-high td { background-color: #fef2f2; }
    .priority-high { color: #dc2626; font-weight: 800; font-size: 9px; background: #fee2e2; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px; }
    
    .order-items-list { margin: 0; padding-left: 0; list-style: none; }
    .order-items-list li { margin-bottom: 3px; font-size: 11px; }
`;

const generateInvoiceCss = (settings: BusinessSettings) => `
    ${BASE_CSS}
    @page { 
        size: letter landscape; 
        margin: ${settings.invoicePadding || 10}px; 
    }
    
    .page-container {
        display: flex;
        width: 100%;
        height: 98vh;
        gap: 15px;
        justify-content: center;
        align-items: stretch;
    }

    .invoice-panel {
        flex: 1;
        border: 2px solid #1e293b; /* Slate 800 */
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
    }

    /* --- HEADER --- */
    .header-bar {
        background-color: #1e293b; 
        color: white;
        padding: 4px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #0f172a;
    }
    
    .header-title {
        font-weight: 800;
        font-size: 14px;
        letter-spacing: 1px;
        text-transform: uppercase;
    }
    
    .header-tag {
        background-color: white;
        color: #1e293b;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 2px;
        text-transform: uppercase;
    }

    .brand-row {
        display: flex;
        height: 55px; /* Increased height for bigger logo */
        border-bottom: 1px solid #334155;
    }

    .logo-area {
        width: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-right: 1px solid #e2e8f0;
    }
    /* Logo increased size */
    .logo-area img { max-height: 50px; max-width: 100%; object-fit: contain; }

    .company-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #f8fafc;
        padding: 0 10px;
    }
    
    .company-name { font-weight: 800; font-size: 12px; color: #334155; text-transform: uppercase; }
    .company-details { font-size: 8px; color: #64748b; text-align: center; line-height: 1.2; }

    .ticket-id-box {
        width: 90px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #fff;
        border-left: 2px solid #334155;
    }
    .ticket-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .ticket-value { font-size: 14px; font-weight: 800; color: #ef4444; }

    /* --- INFO GRID --- */
    .info-grid {
        display: grid;
        grid-template-columns: 70px 1fr 70px 1fr;
        font-size: 9px;
        border-bottom: 2px solid #1e293b;
    }

    .info-cell {
        display: flex;
        align-items: center;
        padding: 3px 6px;
        border-bottom: 1px solid #e2e8f0;
        height: 18px;
        overflow: hidden;
    }
    
    .info-label {
        background-color: #cbd5e1;
        font-weight: 700;
        color: #1e293b;
        text-transform: uppercase;
        border-right: 1px solid #94a3b8;
    }
    
    .info-value {
        font-weight: 500;
        color: #0f172a;
        white-space: nowrap;
        border-right: 1px solid #e2e8f0;
    }
    .info-value:last-child { border-right: none; }

    /* --- TABLE --- */
    .table-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9px;
    }

    thead th {
        background-color: #e2e8f0;
        color: #334155;
        font-weight: 800;
        text-transform: uppercase;
        padding: 4px;
        border-bottom: 1px solid #334155;
        border-right: 1px solid #cbd5e1;
        height: 16px;
    }
    thead th:last-child { border-right: none; }

    tbody td {
        padding: 3px 5px;
        border-bottom: 1px solid #f1f5f9;
        border-right: 1px solid #f1f5f9;
        color: #334155;
        height: 16px;
    }
    tbody td:last-child { border-right: none; }
    
    .col-price { text-align: right; width: 60px; }
    .col-qty { text-align: center; width: 40px; font-weight: bold; }
    .col-total { text-align: right; width: 70px; font-weight: bold; background-color: #f8fafc; }
    .row-empty td { border: none; }

    /* --- FOOTER --- */
    .footer-section {
        height: 105px; /* Fixed height to prevent overflow */
        border-top: 2px solid #1e293b;
        display: flex;
    }

    .footer-left {
        flex: 1;
        padding: 8px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }

    .signature-area {
        border-top: 1px solid #94a3b8;
        text-align: center;
        font-size: 8px;
        color: #64748b;
        padding-top: 2px;
        width: 70%;
        margin: 0 auto;
    }

    .footer-right {
        width: 220px;
        border-left: 2px solid #1e293b;
        display: flex;
        flex-direction: column;
    }

    .total-row {
        flex: 1;
        display: flex;
        align-items: stretch;
        border-bottom: 1px solid #cbd5e1;
    }
    .total-row:last-child { border-bottom: none; flex: 1.5; }

    .t-label {
        flex: 1;
        background-color: #f1f5f9;
        font-size: 9px;
        font-weight: 700;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        text-align: right;
        line-height: 1;
    }

    .t-value {
        width: 80px;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
        border-left: 1px solid #cbd5e1;
        background-color: white;
    }

    .final-total .t-label {
        background-color: #334155;
        color: white;
        font-size: 11px;
    }
    .final-total .t-value {
        background-color: #e2e8f0;
        font-size: 14px;
        font-weight: 800;
        color: #0f172a;
    }
`;

const openPrintWindow = (content: string) => {
    const win = window.open('', '', 'width=1100,height=800');
    if (win) {
        win.document.write(content);
        win.document.close();
        setTimeout(() => {
            win.focus();
            win.print();
        }, 500);
    }
};

const generateInvoiceHalf = (type: string, t: Transaction, c: any, settings: BusinessSettings) => {
    // 14 rows is a safe number for landscape split view
    const minRows = 14; 
    const emptyRows = Math.max(0, minRows - t.items.length);
    const emptyRowsArray = Array.from({ length: emptyRows });
    
    // FOR INVOICE: Use Main Logo (settings.logo) exclusively
    const logoHtml = settings.logo 
        ? `<div class="logo-area"><img src="${settings.logo}" /></div>` 
        : '<div class="logo-area" style="font-size:10px; color:#ccc;">SIN LOGO</div>';

    return `
    <div class="invoice-panel">
        <!-- HEADER -->
        <div class="header-bar">
            <span class="header-title">NOTA DE VENTA</span>
            <span class="header-tag">${type}</span>
        </div>
        
        <div class="brand-row">
            ${logoHtml}
            <div class="company-info">
                <div class="company-name">${settings.name}</div>
                <div class="company-details">
                    ${settings.address}<br/>
                    ${settings.phone} | ${settings.email}
                </div>
            </div>
            <div class="ticket-id-box">
                <span class="ticket-label">FOLIO</span>
                <span class="ticket-value">#${t.id}</span>
            </div>
        </div>
        
        <!-- INFO GRID -->
        <div class="info-grid">
            <div class="info-cell info-label">CLIENTE</div>
            <div class="info-cell info-value" style="font-weight:700">${c?.name || 'Cliente General'}</div>
            <div class="info-cell info-label">FECHA</div>
            <div class="info-cell info-value" style="justify-content:center;">${new Date(t.date).toLocaleDateString()}</div>

            <div class="info-cell info-label">DIRECCIÓN</div>
            <div class="info-cell info-value">${c?.address || ''}</div>
            <div class="info-cell info-label">TELÉFONO</div>
            <div class="info-cell info-value" style="justify-content:center;">${c?.phone || ''}</div>
            
            <div class="info-cell info-label" style="border-bottom:none">OBSERV.</div>
            <div class="info-cell info-value" style="border-bottom:none"></div>
            <div class="info-cell info-label" style="border-bottom:none">VENDEDOR</div>
            <div class="info-cell info-value" style="border-bottom:none; justify-content:center;">--</div>
        </div>

        <!-- PRODUCT TABLE -->
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th style="width:15%">CÓDIGO</th>
                        <th style="width:45%">DESCRIPCIÓN</th>
                        <th class="col-qty">CANT</th>
                        <th class="col-price">P.UNIT</th>
                        <th class="col-total">IMPORTE</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.items.map(item => `
                        <tr>
                            <td style="text-align:center; font-family:monospace;">${item.sku || '---'}</td>
                            <td>${item.name} ${item.variantName ? `(${item.variantName})` : ''}</td>
                            <td class="col-qty">${item.quantity}</td>
                            <td class="col-price">$${item.price.toFixed(2)}</td>
                            <td class="col-total">$${(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                    ${emptyRowsArray.map(() => `
                        <tr class="row-empty">
                            <td>&nbsp;</td><td></td><td></td><td></td><td class="col-total" style="background:transparent;"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- FOOTER -->
        <div class="footer-section">
            <div class="footer-left">
                <div style="font-size:9px; font-weight:bold; margin-bottom:2px; color:#64748b;">RECIBIDO DE CONFORMIDAD</div>
                <div style="flex:1;"></div>
                <div class="signature-area">NOMBRE Y FIRMA</div>
            </div>
            <div class="footer-right">
                <div class="total-row">
                    <div class="t-label">ENVÍO</div>
                    <div class="t-value">$${t.shipping > 0 ? t.shipping.toFixed(2) : '-'}</div>
                </div>
                <div class="total-row">
                    <div class="t-label">SUBTOTAL</div>
                    <div class="t-value">$${t.subtotal.toFixed(2)}</div>
                </div>
                <div class="total-row">
                    <div class="t-label">DESCUENTO</div>
                    <div class="t-value" style="color:#ef4444;">${t.discount > 0 ? '-$' + t.discount.toFixed(2) : '-'}</div>
                </div>
                <div class="total-row final-total">
                    <div class="t-label">TOTAL NETO</div>
                    <div class="t-value">$${t.total.toFixed(2)}</div>
                </div>
            </div>
        </div>
    </div>
    `;
};

export const printInvoice = (transaction: Transaction, customer: any, settings: BusinessSettings) => {
    const html = `
        <html>
        <head>
            <title>Nota de Venta #${transaction.id}</title>
            <style>${generateInvoiceCss(settings)}</style>
        </head>
        <body>
            <div class="page-container">
                ${generateInvoiceHalf("ORIGINAL", transaction, customer, settings)}
                ${generateInvoiceHalf("COPIA", transaction, customer, settings)}
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printOrderInvoice = (order: Order, customer: any, settings: BusinessSettings) => {
    const invoiceCss = generateInvoiceCss(settings);
    // Reutiliza el estilo de factura pero para una sola orden
    const html = `
        <html>
        <head><style>${invoiceCss} .invoice-panel { width: 95%; margin: 0 auto; height: auto; min-height: 80vh; }</style></head>
        <body>
            <div class="page-container" style="display:block;">
                <div class="invoice-panel">
                    <div class="header-bar">
                        <span class="header-title">ORDEN DE PEDIDO</span>
                        <span class="header-tag">PRODUCCIÓN</span>
                    </div>
                    
                    <div class="brand-row">
                        <div class="company-info">
                            <div class="company-name">${settings.name}</div>
                        </div>
                        <div class="ticket-id-box">
                            <span class="ticket-label">FOLIO</span>
                            <span class="ticket-value">#${order.id}</span>
                        </div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-cell info-label">CLIENTE</div>
                        <div class="info-cell info-value">${order.customerName}</div>
                        <div class="info-cell info-label">FECHA</div>
                        <div class="info-cell info-value" style="justify-content:center;">${new Date(order.date).toLocaleDateString()}</div>

                        <div class="info-cell info-label">ENTREGA</div>
                        <div class="info-cell info-value" style="font-weight:800">${order.deliveryDate || 'PENDIENTE'}</div>
                        <div class="info-cell info-label">NOTAS</div>
                        <div class="info-cell info-value" style="color:#ef4444; font-weight:bold;">${order.notes || '---'}</div>
                    </div>

                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th class="col-qty">CANT</th>
                                    <th>DESCRIPCIÓN</th>
                                    <th class="col-price">CONTROL</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items.map(item => `
                                    <tr>
                                        <td class="col-qty" style="font-size:16px;">${item.quantity}</td>
                                        <td>${item.name}</td>
                                        <td style="border:1px solid #ccc;"></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="padding:20px;"></div>
                </div>
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

// --- SINGLE OR MULTIPLE TICKET PRINTING ---
export const printProductionTicket = async (
    order: Order,
    settings: BusinessSettings,
    products: Product[],
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    if (!btSendFn) {
        console.error("Bluetooth printer not connected");
        return;
    }
    try {
        const data = await generateProductionTicket(order, settings, products);
        await btSendFn(data);
    } catch (e) {
        console.error("Print Error", e);
    }
};

// --- MASTER LIST PRINTING ---
export const printProductionMasterList = async (
    orders: Order[],
    settings: BusinessSettings,
    products: Product[],
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    if (!btSendFn) {
        console.error("Bluetooth printer not connected");
        return;
    }
    try {
        const data = await generateConsolidatedProduction(orders, settings, products);
        await btSendFn(data);
    } catch (e) {
        console.error("Print Error", e);
    }
};

export const printThermalTicket = async (
    transaction: Transaction, 
    customerName: string, 
    settings: BusinessSettings,
    btSendFn?: (data: Uint8Array) => Promise<void>,
    printMode: 'ORIGINAL' | 'COPY' | 'BOTH' = 'ORIGINAL'
) => {
    if (btSendFn) {
        try {
            // Print Original Logic
            if (printMode === 'ORIGINAL' || printMode === 'BOTH') {
                const data = await generateEscPosTicket(transaction, customerName, settings, "ORIGINAL");
                await btSendFn(data);
            }
            
            // Wait for cut/tear if printing both
            if (printMode === 'BOTH') {
                await new Promise(resolve => setTimeout(resolve, 8000));
            }

            // Print Copy Logic
            if (printMode === 'COPY' || printMode === 'BOTH') {
                const dataCopy = await generateEscPosTicket(transaction, customerName, settings, "COPIA CLIENTE");
                await btSendFn(dataCopy);
            }
            return; 
        } catch (e) {
            console.error("Bluetooth print failed, falling back to window", e);
        }
    }

    const TICKET_CSS = `
        @page { margin: 0; size: auto; }
        body { 
            font-family: 'Courier New', monospace; 
            font-size: 10px; 
            margin: 5px; 
            padding: 0; 
            width: 100%;
            max-width: ${settings.ticketPaperWidth === '58mm' ? '58mm' : '72mm'};
        }
        .header { text-align: center; margin-bottom: 8px; }
        .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 4px 0; }
        .separator { border-bottom: 1px dashed #000; margin: 6px 0; }
        
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { 
            text-align: left; 
            border-bottom: 1px dashed #000; 
            padding: 2px 0;
            white-space: nowrap;
            font-size: 10px;
        }
        td { 
            vertical-align: top; 
            padding: 2px 0; 
            font-size: 10px;
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis;
        }
        
        /* FIXED WIDTHS FOR PERFECT ALIGNMENT ON 58MM */
        .col-qty { width: 25px; text-align: center; font-weight: bold; }
        .col-total { width: 55px; text-align: right; }
        .col-desc { width: auto; padding-right: 4px; overflow: hidden; text-overflow: ellipsis; }
        
        .totals-section { margin-top: 5px; text-align: right; }
        .row { display: flex; justify-content: space-between; font-size: 10px; }
        .final-total { font-size: 14px; font-weight: bold; margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
        
        .footer { text-align: center; margin-top: 15px; font-size: 10px; }
        .page-break { page-break-after: always; height: 10px; border-bottom: 1px dotted #ccc; margin-bottom: 10px; }
    `;
    
    // Calculate Change
    // Fallback to amountPaid if tenderedAmount is missing (for older transactions)
    const paid = transaction.tenderedAmount || transaction.amountPaid || 0;
    const change = Math.max(0, paid - transaction.total);
    const showChange = transaction.paymentMethod === 'cash' || paid > transaction.total;

    // Helper to generate the ticket HTML body
    const generateTicketBody = (label?: string) => `
        <div class="header">
            ${label ? `<div style="font-weight:bold; font-size:12px; margin-bottom:5px;">*** ${label} ***</div>` : ''}
            ${settings.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width:60%; margin-bottom:5px;">` : ''}
            ${settings.receiptHeader ? `<div style="font-size:10px; margin-bottom:5px;">${settings.receiptHeader}</div>` : ''}
            <div class="title">${settings.name}</div>
            <div>${settings.address}</div>
            <div>${settings.phone}</div>
        </div>
        
        <div class="separator"></div>
        
        <div>Ticket: #${transaction.id}</div>
        <div>Fecha: ${new Date(transaction.date).toLocaleDateString()} ${new Date(transaction.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        <div>Cliente: ${customerName}</div>
        
        <div class="separator"></div>
        
        <table>
            <thead>
                <tr>
                    <th class="col-qty">Can</th>
                    <th class="col-desc">Desc</th>
                    <th class="col-total">Total</th>
                </tr>
            </thead>
            <tbody>
                ${transaction.items.map(item => `
                    <tr>
                        <td class="col-qty">${item.quantity}</td>
                        <td class="col-desc">${item.name}</td>
                        <td class="col-total">$${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                    ${item.variantName ? `<tr><td></td><td class="col-desc" style="font-size:9px; font-style:italic;">  ${item.variantName}</td><td></td></tr>` : ''}
                `).join('')}
            </tbody>
        </table>

        <div class="separator"></div>
        
        <div class="totals-section">
            <div class="row"><span>Subtotal:</span><span>$${transaction.subtotal.toFixed(2)}</span></div>
            ${transaction.taxAmount > 0 ? `<div class="row"><span>Impuestos:</span><span>$${transaction.taxAmount.toFixed(2)}</span></div>` : ''}
            ${transaction.discount > 0 ? `<div class="row"><span>Descuento:</span><span>-$${transaction.discount.toFixed(2)}</span></div>` : ''}
            <div class="final-total row"><span>TOTAL:</span><span>$${transaction.total.toFixed(2)}</span></div>
            ${showChange ? `
                <div class="row" style="margin-top:2px;"><span>Efectivo:</span><span>$${paid.toFixed(2)}</span></div>
                <div class="row" style="font-weight:bold;"><span>Cambio:</span><span>$${change.toFixed(2)}</span></div>
            ` : ''}
        </div>

        <div class="footer">${settings.receiptFooter}</div>
    `;

    const html = `
        <html>
        <head><style>${TICKET_CSS}</style></head>
        <body>
            ${(printMode === 'ORIGINAL' || printMode === 'BOTH') ? generateTicketBody(printMode === 'BOTH' ? "ORIGINAL" : undefined) : ''}
            ${printMode === 'BOTH' ? '<div class="page-break"></div>' : ''}
            ${(printMode === 'COPY' || printMode === 'BOTH') ? generateTicketBody("COPIA CLIENTE") : ''}
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printProductionSummary = (orders: Order[], settings: BusinessSettings, inventory?: Product[]) => {
    // 1. Consolidate items
    const summaryItems: Record<string, {
        id: string,
        name: string, 
        sku: string, 
        quantity: number, 
        variantName?: string, 
        variantId?: string,
        orders: string[]
    }> = {};

    orders.forEach(order => {
        order.items.forEach(item => {
            const key = item.variantId ? `${item.id}-${item.variantId}` : item.id;
            
            if (!summaryItems[key]) {
                summaryItems[key] = {
                    id: item.id,
                    name: item.name,
                    sku: item.sku || '---',
                    variantName: item.variantName,
                    variantId: item.variantId,
                    quantity: 0,
                    orders: []
                };
            }
            summaryItems[key].quantity += item.quantity;
            if (!summaryItems[key].orders.includes(order.id)) {
                summaryItems[key].orders.push(order.id);
            }
        });
    });

    const sortedSummary = Object.values(summaryItems).sort((a, b) => a.name.localeCompare(b.name));

    // STOCK CALCULATION LOGIC - SPLIT INTO "PICK" (BODEGA) AND "MAKE" (PRODUCCION)
    const pickingList: any[] = [];
    const productionList: any[] = [];

    sortedSummary.forEach(item => {
        let currentStock = 0;
        if (inventory) {
            const product = inventory.find(p => p.id === item.id);
            if (product) {
                if (item.variantId && product.variants) {
                    const variant = product.variants.find(v => v.id === item.variantId);
                    currentStock = variant ? variant.stock : 0;
                } else {
                    currentStock = product.stock;
                }
            }
        }

        const pickAmount = Math.min(item.quantity, currentStock);
        const makeAmount = Math.max(0, item.quantity - currentStock);

        if (pickAmount > 0) {
            pickingList.push({ ...item, qty: pickAmount });
        }
        if (makeAmount > 0) {
            productionList.push({ ...item, qty: makeAmount });
        }
    });

    const sortedOrders = [...orders].sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const html = `
        <html>
        <head>
            <title>Hoja de Producción Inteligente</title>
            <style>
                ${PRODUCTION_CSS}
                .highlight-box { border: 2px solid #000; padding: 10px; margin-bottom: 20px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>${settings.productionDoc.title || 'HOJA DE PRODUCCIÓN'}</h1>
                    <p>${settings.name} | MODO INTELIGENTE</p>
                </div>
                <div class="header-right">
                    <strong>FECHA:</strong> ${new Date().toLocaleDateString()}<br/>
                    <strong>HORA:</strong> ${new Date().toLocaleTimeString()}
                </div>
            </div>

            <!-- SECTION 1: CRITICAL PRODUCTION -->
            ${productionList.length > 0 ? `
                <div class="section-header">
                    <span>⚠️ PRIORIDAD 1: FABRICAR / PRODUCIR (FALTANTES)</span>
                </div>
                <div class="highlight-box">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">OK</th>
                                <th style="width: 80px; text-align: center;">CANTIDAD</th>
                                <th>PRODUCTO / DETALLE</th>
                                <th style="width: 150px;">REFERENCIA ORDEN</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productionList.map(item => `
                                <tr>
                                    <td style="text-align: center;"><div class="check-box"></div></td>
                                    <td style="text-align: center;">
                                        <span class="qty-box" style="border-color: #000; background: #000; color: #fff; font-size: 16px;">${item.qty}</span>
                                    </td>
                                    <td>
                                        <strong style="font-size: 14px;">${item.name}</strong>
                                        ${item.variantName ? `<div style="font-style: italic; margin-top: 2px;">Var: ${item.variantName}</div>` : ''}
                                    </td>
                                    <td style="font-size: 10px; color: #555;">
                                        ${item.orders.map((id: string) => `#${id.slice(-4)}`).join(', ')}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div style="padding:15px; border:2px dashed #ccc; text-align:center; margin-bottom:20px; background: #f9f9f9; color: #666; font-weight: bold;">
                    ✅ TODO CUBIERTO POR STOCK. NO SE REQUIERE PRODUCCIÓN ADICIONAL.
                </div>
            `}

            <!-- SECTION 2: PICKING -->
            ${pickingList.length > 0 ? `
                <div class="section-header secondary">
                    <span>📦 PASO 2: PICKING DE BODEGA (EXISTENTE)</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">OK</th>
                            <th style="width: 80px; text-align: center;">TOMAR</th>
                            <th>PRODUCTO</th>
                            <th style="width: 150px;">UBICACIÓN / SKU</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pickingList.map(item => `
                            <tr>
                                <td style="text-align: center;"><div class="check-box"></div></td>
                                <td style="text-align: center;"><span class="qty-box" style="font-size: 14px;">${item.qty}</span></td>
                                <td>
                                    <strong style="font-size: 12px;">${item.name}</strong>
                                    ${item.variantName ? `<div style="font-style: italic;">${item.variantName}</div>` : ''}
                                </td>
                                <td style="font-family: monospace; font-size: 10px;">
                                    ${item.sku}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}

            <!-- SECTION 3: ORDER DISTRIBUTION -->
            <div class="section-header secondary" style="margin-top: 30px;">
                <span>📋 PASO 3: DISTRIBUCIÓN POR PEDIDO</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;">FOLIO</th>
                        <th style="width: 150px;">CLIENTE / ENTREGA</th>
                        <th>CONTENIDO COMPLETO</th>
                        <th style="width: 40px; text-align: center;">QC</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedOrders.map(order => `
                        <tr class="${order.priority === 'HIGH' ? 'row-high' : ''}">
                            <td>
                                <strong>#${order.id}</strong>
                                ${order.priority === 'HIGH' ? '<div class="priority-high">URGENTE</div>' : ''}
                            </td>
                            <td>
                                <strong>${order.customerName}</strong><br/>
                                <span style="color: #666; font-size: 10px;">Entr: ${order.deliveryDate || 'N/A'}</span>
                            </td>
                            <td>
                                <ul class="order-items-list">
                                    ${order.items.map(i => `
                                        <li>[ <strong>${i.quantity}</strong> ] ${i.name} ${i.variantName ? `(${i.variantName})` : ''}</li>
                                    `).join('')}
                                </ul>
                                ${order.notes ? `<div style="margin-top:4px; font-style:italic; font-size:10px; background:#eee; padding:2px;">Nota: ${order.notes}</div>` : ''}
                            </td>
                            <td style="text-align: center;"><div class="check-box"></div></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <div class="sig-box">AUTORIZADO POR</div>
                <div class="sig-box">RESPONSABLE ALMACÉN</div>
                <div class="sig-box">FECHA / HORA ENTREGA</div>
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printZCutTicket = async (
    movement: CashMovement, 
    settings: BusinessSettings,
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    // ... (Keep existing Z Cut code)
    if (!movement.zReportData) return;

    if (btSendFn) {
        try {
            const data = await generateEscPosZReport(movement, settings);
            await btSendFn(data);
            return; 
        } catch (e) {
            console.error("Bluetooth print failed, falling back to window", e);
        }
    }

    const z = movement.zReportData;
    const TICKET_CSS = `
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 5px; width: ${settings.ticketPaperWidth}; }
        .header { text-align: center; margin-bottom: 10px; }
        .title { font-size: 14px; font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
    `;

    const html = `
        <html>
        <head><style>${TICKET_CSS}</style></head>
        <body>
            <div class="header">
                ${settings.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width:50%; margin-bottom:5px;">` : ''}
                
                <div style="border-top: 2px dashed black; border-bottom: 2px dashed black; padding: 5px 0; margin: 10px 0;">
                    <div class="title" style="font-size: 18px; text-transform: uppercase;">CORTE DE CAJA (Z)</div>
                </div>
                
                <div>${settings.name}</div>
                <div>${new Date(movement.date).toLocaleString()}</div>
            </div>
            <div class="line"></div>
            
            <div class="row"><span>Fondo Inicial:</span><span>$${z.openingFund.toFixed(2)}</span></div>
            <div class="row"><span>+ Ventas Totales:</span><span>$${z.grossSales.toFixed(2)}</span></div>
            <div class="row"><span>- Gastos (Efe):</span><span>$${z.expenses.toFixed(2)}</span></div>
            <div class="row"><span>- Retiros (Efe):</span><span>$${z.withdrawals.toFixed(2)}</span></div>
            <div class="line"></div>
            
            <div class="row bold"><span>Esperado en Caja:</span><span>$${z.expectedCash.toFixed(2)}</span></div>
            <div class="row bold"><span>Declarado:</span><span>$${z.declaredCash.toFixed(2)}</span></div>
            <div class="row bold" style="margin-top:5px; font-size:14px;">
                <span>Diferencia:</span>
                <span>$${z.difference.toFixed(2)}</span>
            </div>
            
            <div class="line"></div>
            <div style="text-align:center; font-weight:bold; margin-bottom:5px; text-transform:uppercase; border-bottom:1px solid #000; display:inline-block; padding:0 10px;">DESGLOSE DE VENTAS</div>
            <div class="row"><span>Efectivo:</span><span>$${z.cashSales.toFixed(2)}</span></div>
            <div class="row"><span>Tarjeta:</span><span>$${z.cardSales.toFixed(2)}</span></div>
            <div class="row"><span>Transferencia:</span><span>$${z.transferSales.toFixed(2)}</span></div>
            <div class="row"><span>Crédito:</span><span>$${z.creditSales.toFixed(2)}</span></div>
            
            <div class="line"></div>
            <div class="footer">--- FIN DEL REPORTE ---</div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printFinancialReport = (
    startDate: Date,
    endDate: Date,
    categories: { name: string, value: number }[],
    metrics: { totalSales: number, totalExpenses: number, netProfit: number, thirdParty: number },
    settings: BusinessSettings
) => {
    const css = `
        ${BASE_CSS}
        body { padding: 40px; }
        .report-header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #0f172a; padding-bottom: 20px; }
        .report-title { font-size: 28px; font-weight: 800; text-transform: uppercase; margin: 0; color: #0f172a; }
        .report-subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
        
        .metrics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 40px; }
        .metric-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 5px; }
        .metric-value { font-size: 20px; font-weight: 800; color: #0f172a; }
        
        .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; margin-top: 40px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; padding: 10px; background: #f8fafc; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
        .amount-col { text-align: right; font-family: monospace; font-weight: 600; }
        
        .footer { margin-top: 60px; text-align: center; font-size: 10px; color: #94a3b8; }
    `;

    const html = `
        <html>
        <head>
            <title>Reporte Financiero</title>
            <style>${css}</style>
        </head>
        <body>
            <div class="report-header">
                ${settings.logo ? `<img src="${settings.logo}" style="max-height:60px; margin-bottom:15px;">` : ''}
                <h1 class="report-title">Estado Financiero</h1>
                <div class="report-subtitle">
                    ${settings.name}<br/>
                    Periodo: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Ventas Totales</div>
                    <div class="metric-value">$${metrics.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Gastos / Egresos</div>
                    <div class="metric-value" style="color: #ef4444;">$${metrics.totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Ventas Terceros</div>
                    <div class="metric-value" style="color: #f59e0b;">$${metrics.thirdParty.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
                <div class="metric-card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                    <div class="metric-label" style="color: #166534;">Utilidad Neta (Est)</div>
                    <div class="metric-value" style="color: #15803d;">$${metrics.netProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                </div>
            </div>

            <div class="section-title">Desglose de Movimientos</div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 70%">Categoría / Concepto</th>
                        <th class="amount-col">Monto</th>
                        <th class="amount-col">% del Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${categories.map(cat => {
                        const percent = metrics.totalSales > 0 ? (cat.value / metrics.totalSales) * 100 : 0;
                        return `
                            <tr>
                                <td>${cat.name}</td>
                                <td class="amount-col">$${cat.value.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td class="amount-col">${percent.toFixed(1)}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="footer">
                Generado el ${new Date().toLocaleString()} por LuminaPOS
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};


import { Transaction, BusinessSettings, CashMovement, Order, CartItem, Product } from '../types';
import { generateEscPosTicket, generateEscPosZReport, generateProductionTicket, generateConsolidatedProduction, generateMonthEndTicket } from './escPosHelper';

// Estilos CSS base compartidos
const BASE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background-color: #fff; }
`;

// ... (Rest of existing CSS and functions kept, adding new ones below) ...

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
        gap: 20px;
        justify-content: center;
        align-items: stretch;
    }

    .invoice-panel {
        flex: 1;
        border: 2px solid #1e293b; /* Slate 800 */
        border-radius: 6px;
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
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #0f172a;
    }
    
    .header-title {
        font-weight: 800;
        font-size: 20px; /* Increased */
        letter-spacing: 1px;
        text-transform: uppercase;
    }
    
    .header-tag {
        background-color: white;
        color: #1e293b;
        font-size: 12px; /* Increased */
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 4px;
        text-transform: uppercase;
    }

    .brand-row {
        display: flex;
        height: 70px; /* Increased height */
        border-bottom: 1px solid #334155;
    }

    .logo-area {
        width: 130px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 5px;
        border-right: 1px solid #e2e8f0;
    }
    .logo-area img { max-height: 60px; max-width: 100%; object-fit: contain; }

    .company-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #f8fafc;
        padding: 0 15px;
    }
    
    .company-name { font-weight: 800; font-size: 18px; color: #334155; text-transform: uppercase; margin-bottom: 2px; } /* Increased */
    .company-details { font-size: 11px; color: #475569; text-align: center; line-height: 1.3; font-weight: 500; } /* Increased */

    .ticket-id-box {
        width: 110px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: #fff;
        border-left: 2px solid #334155;
    }
    .ticket-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; } /* Increased */
    .ticket-value { font-size: 20px; font-weight: 800; color: #ef4444; } /* Increased */

    /* --- INFO GRID --- */
    .info-grid {
        display: grid;
        grid-template-columns: 85px 1fr 85px 1fr; /* Adjusted for larger text */
        font-size: 12px; /* Increased Base Font */
        border-bottom: 2px solid #1e293b;
    }

    .info-cell {
        display: flex;
        align-items: center;
        padding: 5px 8px; /* Increased Padding */
        border-bottom: 1px solid #e2e8f0;
        height: 24px; /* Increased Height */
        overflow: hidden;
    }
    
    .info-label {
        background-color: #e2e8f0;
        font-weight: 700;
        color: #1e293b;
        text-transform: uppercase;
        border-right: 1px solid #94a3b8;
        font-size: 11px;
    }
    
    .info-value {
        font-weight: 600;
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
        font-size: 12px; /* Increased Table Font */
    }

    thead th {
        background-color: #f1f5f9;
        color: #334155;
        font-weight: 800;
        text-transform: uppercase;
        padding: 6px 8px; /* Increased Padding */
        border-bottom: 2px solid #334155;
        border-right: 1px solid #cbd5e1;
        height: 20px;
    }
    thead th:last-child { border-right: none; }

    tbody td {
        padding: 5px 8px; /* Increased Padding */
        border-bottom: 1px solid #f1f5f9;
        border-right: 1px solid #f1f5f9;
        color: #334155;
        height: 20px; /* Min height */
        font-weight: 500;
    }
    tbody td:last-child { border-right: none; }
    
    .col-price { text-align: right; width: 75px; }
    .col-qty { text-align: center; width: 50px; font-weight: bold; }
    .col-total { text-align: right; width: 85px; font-weight: bold; background-color: #f8fafc; }
    .row-empty td { border: none; }

    /* --- FOOTER --- */
    .footer-section {
        height: 120px; /* Increased Height for larger font footer */
        border-top: 2px solid #1e293b;
        display: flex;
    }

    .footer-left {
        flex: 1;
        padding: 10px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
    }

    .signature-area {
        border-top: 2px solid #94a3b8;
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        color: #64748b;
        padding-top: 4px;
        width: 80%;
        margin: 0 auto;
    }

    .footer-right {
        width: 260px; /* Wider for larger numbers */
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
        font-size: 11px; /* Increased */
        font-weight: 700;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 10px;
        text-align: right;
        line-height: 1;
        text-transform: uppercase;
    }

    .t-value {
        width: 100px;
        font-size: 13px; /* Increased */
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 10px;
        border-left: 1px solid #cbd5e1;
        background-color: white;
    }

    .final-total .t-label {
        background-color: #334155;
        color: white;
        font-size: 14px; /* Increased */
    }
    .final-total .t-value {
        background-color: #e2e8f0;
        font-size: 20px; /* SUPER LEGIBLE */
        font-weight: 900;
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

// ... (Keep existing generateInvoiceHalf, printInvoice, printOrderInvoice, etc.) ...
const generateInvoiceHalf = (type: string, t: Transaction, c: any, settings: BusinessSettings) => {
    const minRows = 12; 
    const emptyRows = Math.max(0, minRows - t.items.length);
    const emptyRowsArray = Array.from({ length: emptyRows });
    
    const logoHtml = settings.logo 
        ? `<div class="logo-area"><img src="${settings.logo}" /></div>` 
        : '<div class="logo-area" style="font-size:12px; font-weight:bold; color:#ccc;">SIN LOGO</div>';

    return `
    <div class="invoice-panel">
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
        
        <div class="info-grid">
            <div class="info-cell info-label">CLIENTE</div>
            <div class="info-cell info-value" style="font-weight:800; font-size:13px;">${c?.name || 'Cliente General'}</div>
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
                    ${t.items.map((item: CartItem) => `
                        <tr>
                            <td style="text-align:center; font-family:monospace; font-weight:600;">${item.sku || '---'}</td>
                            <td>${item.name} ${item.variantName ? `(${item.variantName})` : ''}</td>
                            <td class="col-qty" style="font-size:13px;">${item.quantity}</td>
                            <td class="col-price">$${item.price.toFixed(2)}</td>
                            <td class="col-total" style="font-size:13px;">$${(item.price * item.quantity).toFixed(2)}</td>
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

        <div class="footer-section">
            <div class="footer-left">
                <div style="font-size:10px; font-weight:bold; margin-bottom:4px; color:#64748b;">RECIBIDO DE CONFORMIDAD</div>
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
                        <div class="info-cell info-value" style="font-size:14px; font-weight:800;">${order.customerName}</div>
                        <div class="info-cell info-label">FECHA</div>
                        <div class="info-cell info-value" style="justify-content:center;">${new Date(order.date).toLocaleDateString()}</div>

                        <div class="info-cell info-label">ENTREGA</div>
                        <div class="info-cell info-value" style="font-weight:800; font-size:13px;">${order.deliveryDate || 'PENDIENTE'}</div>
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
                                ${order.items.map((item: CartItem) => `
                                    <tr>
                                        <td class="col-qty" style="font-size:16px;">${item.quantity}</td>
                                        <td style="font-size:13px; font-weight:600;">${item.name}</td>
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

export const printProductionSummary = (
    orders: Order[],
    settings: BusinessSettings,
    products: Product[]
) => {
    // Consolidate Logic
    const summaryItems: Record<string, any> = {};
    orders.forEach(o => o.items.forEach(i => {
        const key = i.variantId ? `${i.id}-${i.variantId}` : i.id;
        if (!summaryItems[key]) summaryItems[key] = { ...i, quantity: 0, orders: [] };
        summaryItems[key].quantity += i.quantity;
        // avoid duplicate order ids for same item in same order (unlikely but safe)
        if (!summaryItems[key].orders.includes(o.id.slice(-4))) {
             summaryItems[key].orders.push(o.id.slice(-4));
        }
    }));

    const sortedItems = Object.values(summaryItems).sort((a, b) => a.name.localeCompare(b.name));

    const css = `
        ${BASE_CSS}
        body { padding: 40px; font-family: 'Inter', sans-serif; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
        h1 { margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; }
        .meta { font-size: 12px; color: #666; margin-top: 5px; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; border-bottom: 2px solid #000; padding: 10px 5px; font-weight: 800; text-transform: uppercase; }
        td { border-bottom: 1px solid #ccc; padding: 10px 5px; vertical-align: top; }
        
        .qty-col { font-size: 16px; font-weight: 800; text-align: center; width: 60px; }
        .check-col { width: 40px; }
        .box { width: 20px; height: 20px; border: 2px solid #333; display: inline-block; border-radius: 4px; }
        
        .orders-list { font-size: 10px; color: #666; margin-top: 4px; font-family: monospace; }
        .variant-tag { font-size: 11px; font-style: italic; color: #444; }
    `;

    const html = `
        <html>
        <head>
            <title>Resumen de Producción</title>
            <style>${css}</style>
        </head>
        <body>
            <div class="header">
                <h1>Hoja de Producción</h1>
                <div class="meta">
                    ${settings.name}<br/>
                    Generado: ${new Date().toLocaleString()}<br/>
                    Total Pedidos: ${orders.length}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="check-col"></th>
                        <th class="qty-col">CANT</th>
                        <th>DESCRIPCIÓN</th>
                        <th>REFS</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedItems.map((item: any) => `
                        <tr>
                            <td class="check-col"><div class="box"></div></td>
                            <td class="qty-col">${item.quantity}</td>
                            <td>
                                <div style="font-weight:700; font-size:14px;">${item.name}</div>
                                ${item.variantName ? `<div class="variant-tag">${item.variantName}</div>` : ''}
                            </td>
                            <td>
                                <div class="orders-list">
                                    ${item.orders.join(', ')}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 40px; font-size: 10px; text-align: center; color: #999;">
                Documento interno de control - LuminaPOS
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

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
            if (printMode === 'ORIGINAL' || printMode === 'BOTH') {
                const data = await generateEscPosTicket(transaction, customerName, settings, "ORIGINAL");
                await btSendFn(data);
            }
            
            if (printMode === 'BOTH') {
                await new Promise(resolve => setTimeout(resolve, 8000));
            }

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
        
        .col-qty { width: 25px; text-align: center; font-weight: bold; }
        .col-total { width: 55px; text-align: right; }
        .col-desc { width: auto; padding-right: 4px; overflow: hidden; text-overflow: ellipsis; }
        
        .totals-section { margin-top: 5px; text-align: right; }
        .row { display: flex; justify-content: space-between; font-size: 10px; }
        .final-total { font-size: 14px; font-weight: bold; margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
        
        .footer { text-align: center; margin-top: 15px; font-size: 10px; }
        .page-break { page-break-after: always; height: 10px; border-bottom: 1px dotted #ccc; margin-bottom: 10px; }
    `;
    
    const paid = transaction.tenderedAmount || transaction.amountPaid || 0;
    const change = Math.max(0, paid - transaction.total);
    const showChange = transaction.paymentMethod === 'cash' || paid > transaction.total;

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
                ${transaction.items.map((item: CartItem) => `
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

export const printZCutTicket = async (
    movement: CashMovement, 
    settings: BusinessSettings,
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    const z = movement.zReportData;
    if (!z) return;

    if (btSendFn) {
        try {
            // Use the imported helper from escPosHelper
            const data = await generateEscPosZReport(movement, settings);
            await btSendFn(data);
            return; 
        } catch (e) {
            console.error("Bluetooth print failed, falling back to window", e);
        }
    }

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
            <div class="row"><span>Credito:</span><span>$${z.creditSales.toFixed(2)}</span></div>
            
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
                    ${categories.map((cat: { name: string, value: number }) => {
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

// --- NEW: MONTH END THERMAL TICKET ---
export const printMonthEndTicket = async (
    data: any,
    settings: BusinessSettings,
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    if (btSendFn) {
        try {
            const ticketData = await generateMonthEndTicket(data, settings);
            await btSendFn(ticketData);
            return;
        } catch (e) {
            console.error(e);
        }
    }
    // Fallback window print not implemented for this specialized ticket to keep simple, 
    // user likely wants to see the PDF report instead if no thermal printer.
    alert("Conecta impresora Bluetooth para ticket térmico, o usa 'Exportar PDF'.");
};

// --- NEW: MONTH END PDF REPORT (RICH HTML) ---
export const printMonthEndReportPDF = (
    data: any,
    analysisText: string,
    topProducts: any[],
    settings: BusinessSettings
) => {
    // Generate simple CSS Charts
    const opExPct = Math.min(100, (data.actualOpEx / data.income) * 100);
    const profitPct = Math.min(100, (data.actualProfit / data.income) * 100);
    const investPct = Math.min(100, (data.actualInvestment / data.income) * 100);

    const css = `
        ${BASE_CSS}
        @page { size: letter; margin: 20px; }
        body { padding: 40px; font-family: 'Inter', sans-serif; color: #1e293b; }
        
        .header { text-align: center; margin-bottom: 40px; border-bottom: 4px solid #4f46e5; padding-bottom: 20px; }
        .title { font-size: 32px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: -1px; }
        .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; font-weight: 500; }
        
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center; }
        .card-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 5px; }
        .card-value { font-size: 24px; font-weight: 800; color: #0f172a; }
        .card-sub { font-size: 11px; color: #94a3b8; margin-top: 5px; }

        .section-title { font-size: 18px; font-weight: 800; color: #4f46e5; margin-bottom: 20px; border-left: 4px solid #4f46e5; padding-left: 10px; display: flex; align-items: center; }
        
        /* CSS CHARTS */
        .chart-container { display: flex; gap: 40px; margin-bottom: 40px; }
        .chart-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
        
        /* Bar Chart */
        .bar-group { margin-bottom: 15px; }
        .bar-label { display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; margin-bottom: 5px; }
        .bar-track { background: #e2e8f0; height: 20px; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 10px; }
        
        /* Pie Chart (Conic Gradient) */
        .pie-chart { 
            width: 150px; height: 150px; border-radius: 50%; margin: 0 auto;
            background: conic-gradient(
                #ef4444 0% ${opExPct}%, 
                #ec4899 ${opExPct}% ${opExPct + profitPct}%, 
                #3b82f6 ${opExPct + profitPct}% ${opExPct + profitPct + investPct}%,
                #e2e8f0 ${opExPct + profitPct + investPct}% 100%
            );
        }
        .legend { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px; font-size: 11px; }
        .dot { width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 5px; }

        /* Tables */
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; }
        th { background: #f1f5f9; padding: 10px; text-align: left; font-weight: 700; color: #475569; }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        
        /* AI Insights */
        .ai-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 25px; color: #1e3a8a; line-height: 1.6; font-size: 13px; }
        .ai-box h1, .ai-box h2, .ai-box h3 { color: #1e40af; font-size: 16px; margin-top: 15px; margin-bottom: 10px; }
        .ai-box ul { padding-left: 20px; }
        .ai-box li { margin-bottom: 5px; }

        .footer { text-align: center; margin-top: 50px; font-size: 11px; color: #94a3b8; }
    `;

    // Process Markdown simple to HTML for print
    const formattedAnalysis = analysisText
        .replace(/\n/g, '<br/>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/# (.*?)<br\/>/g, '<h3>$1</h3>')
        .replace(/- (.*?)<br\/>/g, '<li>$1</li>');

    const html = `
        <html>
        <head>
            <title>Informe Mensual - ${settings.name}</title>
            <style>${css}</style>
        </head>
        <body>
            <div class="header">
                <div class="title">INFORME DE CIERRE MENSUAL</div>
                <div class="subtitle">${settings.name} | Periodo: ${data.periodStart} - ${data.periodEnd}</div>
            </div>

            <div class="grid-3">
                <div class="card">
                    <div class="card-label">Ingresos Totales</div>
                    <div class="card-value">$${data.income.toLocaleString()}</div>
                    <div class="card-sub">Ventas + Aportes</div>
                </div>
                <div class="card">
                    <div class="card-label">Gastos Operativos</div>
                    <div class="card-value" style="color:#ef4444">$${data.actualOpEx.toLocaleString()}</div>
                    <div class="card-sub">${opExPct.toFixed(1)}% del Ingreso</div>
                </div>
                <div class="card" style="background:#f0f9ff; border-color:#bae6fd;">
                    <div class="card-label">Inversión Neta</div>
                    <div class="card-value" style="color:#0284c7">$${data.actualInvestment.toLocaleString()}</div>
                    <div class="card-sub">Ahorro + Sobrantes</div>
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-box">
                    <div class="section-title" style="margin-top:0;">Distribución de Capital</div>
                    <div class="pie-chart"></div>
                    <div class="legend">
                        <span><span class="dot" style="background:#ef4444"></span>Gastos</span>
                        <span><span class="dot" style="background:#ec4899"></span>Retiros</span>
                        <span><span class="dot" style="background:#3b82f6"></span>Inversión</span>
                    </div>
                </div>
                <div class="chart-box">
                    <div class="section-title" style="margin-top:0;">Cumplimiento Presupuesto</div>
                    
                    <div class="bar-group">
                        <div class="bar-label"><span>Gastos</span><span>${opExPct.toFixed(1)}% / ${data.config.expensesPercentage}%</span></div>
                        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, opExPct)}%; background:#ef4444;"></div></div>
                    </div>
                    
                    <div class="bar-group">
                        <div class="bar-label"><span>Retiros (Sueldos)</span><span>${profitPct.toFixed(1)}% / ${data.config.profitPercentage}%</span></div>
                        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, profitPct)}%; background:#ec4899;"></div></div>
                    </div>

                    <div class="bar-group">
                        <div class="bar-label"><span>Inversión</span><span>${investPct.toFixed(1)}% / ${data.config.investmentPercentage}%</span></div>
                        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, investPct)}%; background:#3b82f6;"></div></div>
                    </div>
                </div>
            </div>

            <div class="section-title">Top Productos del Mes</div>
            <table>
                <thead>
                    <tr><th>Producto</th><th style="text-align:center;">Unidades</th><th style="text-align:right;">Total Ventas</th></tr>
                </thead>
                <tbody>
                    ${topProducts.map((p: any) => `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td style="text-align:center;">${p.qty}</td>
                            <td style="text-align:right;">$${p.total.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="section-title">Análisis Inteligente y Recomendaciones</div>
            <div class="ai-box">
                ${formattedAnalysis}
            </div>

            <div class="footer">
                Este documento es un reporte interno generado automáticamente por LuminaPOS el ${new Date().toLocaleString()}.
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

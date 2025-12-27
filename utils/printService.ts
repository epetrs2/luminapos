
import { Transaction, BusinessSettings, Order, CashMovement, Customer, CartItem } from '../types';
import { generateEscPosTicket } from './escPosHelper';

// Estilos CSS base compartidos
const BASE_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; background-color: #fff; }
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

const PRODUCTION_CSS = `
    ${BASE_CSS}
    @page { size: letter portrait; margin: 1cm; }
    body { font-family: 'Inter', sans-serif; color: #000; }
    
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; align-items: flex-end; }
    .header-left h1 { font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; }
    .header-left p { font-size: 12px; margin: 2px 0 0 0; }
    .header-right { text-align: right; font-size: 11px; }
    
    .section-header { 
        background-color: #eee; 
        border-top: 2px solid #000; 
        border-bottom: 2px solid #000; 
        padding: 5px 10px; 
        font-weight: 800; 
        text-transform: uppercase; 
        font-size: 14px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
    }

    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
    th { text-align: left; border-bottom: 1px solid #000; padding: 4px; font-weight: 700; text-transform: uppercase; }
    td { border-bottom: 1px solid #ddd; padding: 6px 4px; vertical-align: top; }
    
    .qty-box { 
        display: inline-block; 
        border: 2px solid #000; 
        padding: 2px 6px; 
        font-weight: 800; 
        font-size: 14px; 
        min-width: 30px; 
        text-align: center; 
        border-radius: 4px;
    }
    
    .check-box {
        width: 20px;
        height: 20px;
        border: 2px solid #ccc;
        display: inline-block;
    }

    .priority-high { color: #dc2626; font-weight: 800; }
    .row-high { background-color: #fef2f2; }
    
    .order-items-list { margin: 0; padding-left: 15px; }
    .order-items-list li { margin-bottom: 2px; }

    .footer {
        margin-top: 40px;
        border-top: 1px dashed #999;
        padding-top: 20px;
        display: flex;
        justify-content: space-between;
        font-size: 10px;
    }
    .sig-box { width: 30%; border-top: 1px solid #000; padding-top: 5px; text-align: center; }
`;

const FINANCIAL_REPORT_CSS = `
    ${BASE_CSS}
    @page { size: letter portrait; margin: 1cm; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: white; }
    
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 10px; border-bottom: 2px solid #cbd5e1; }
    .logo { max-height: 50px; margin-bottom: 10px; }
    .title { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 5px; }
    
    .period-box { background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; margin-bottom: 30px; font-weight: 600; font-size: 12px; border: 1px solid #e2e8f0; }

    .section { margin-bottom: 30px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px; display: flex; justify-content: space-between; }
    
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f8fafc; font-size: 11px; }
    .row:last-child { border-bottom: none; }
    .label { color: #334155; }
    .value { font-weight: 600; color: #0f172a; }
    
    .summary-box { background: #fff; border: 2px solid #0f172a; border-radius: 8px; padding: 15px; margin-top: 20px; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
    .summary-row.total { font-size: 16px; font-weight: 900; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-bottom: 0; margin-top: 10px; }
    
    .income-text { color: #059669; }
    .expense-text { color: #dc2626; }
    .net-text { color: #2563eb; }

    .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
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

export const printThermalTicket = async (
    transaction: Transaction, 
    customerName: string, 
    settings: BusinessSettings,
    btSendFn?: (data: Uint8Array) => Promise<void>
) => {
    // If a Bluetooth send function is provided, generate raw bytes and send them.
    if (btSendFn) {
        try {
            // Await the generation of the ticket data (which might involve async image loading)
            const data = await generateEscPosTicket(transaction, customerName, settings);
            await btSendFn(data);
            return; // Success, don't open window
        } catch (e) {
            console.error("Bluetooth print failed, falling back to window", e);
            // Fallback to window print if BT fails
        }
    }

    const TICKET_CSS = `
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 5px; width: ${settings.ticketPaperWidth}; }
        .header { text-align: center; margin-bottom: 10px; }
        .title { font-size: 14px; font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; }
        .item-row { margin-bottom: 2px; }
        .total { font-weight: bold; font-size: 14px; text-align: right; margin-top: 5px; }
        .footer { text-align: center; margin-top: 10px; font-size: 10px; }
    `;
    
    // For thermal ticket HTML fallback, also use Receipt Logo
    const html = `
        <html>
        <head><style>${TICKET_CSS}</style></head>
        <body>
            <div class="header">
                ${settings.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width:50%; margin-bottom:5px;">` : ''}
                ${settings.receiptHeader ? `<div style="font-size:10px; margin-bottom:5px;">${settings.receiptHeader}</div>` : ''}
                <div class="title">${settings.name}</div>
                <div>${settings.address}</div>
                <div>${settings.phone}</div>
                <div class="line"></div>
                <div>Ticket #${transaction.id}</div>
                <div>${new Date(transaction.date).toLocaleString()}</div>
                <div>Cliente: ${customerName}</div>
            </div>
            <div class="line"></div>
            <div class="row" style="font-weight:bold; border-bottom:1px solid #000;"><span>Cant</span><span>Desc.</span><span>Total</span></div>
            ${transaction.items.map(item => `
                <div class="item-row">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="width:10%">${item.quantity}</span>
                        <span style="width:60%">${item.name}</span>
                        <span style="width:30%; text-align:right;">$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                </div>
            `).join('')}
            <div class="line"></div>
            <div class="row"><span>Subtotal:</span><span>$${transaction.subtotal.toFixed(2)}</span></div>
            ${transaction.taxAmount > 0 ? `<div class="row"><span>Impuestos:</span><span>$${transaction.taxAmount.toFixed(2)}</span></div>` : ''}
            ${transaction.discount > 0 ? `<div class="row"><span>Descuento:</span><span>-$${transaction.discount.toFixed(2)}</span></div>` : ''}
            <div class="total">Total: $${transaction.total.toFixed(2)}</div>
            <div class="line"></div>
            <div class="footer">${settings.receiptFooter}</div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

// ... (Rest of exports remain same)
export const printProductionSummary = (orders: Order[], settings: BusinessSettings) => {
    // 1. Consolidate items
    const summaryItems: Record<string, {
        name: string, 
        sku: string, 
        quantity: number, 
        variantName?: string, 
        orders: string[]
    }> = {};

    orders.forEach(order => {
        order.items.forEach(item => {
            // Unique key combining ID and variant
            const key = item.variantId ? `${item.id}-${item.variantId}` : item.id;
            
            if (!summaryItems[key]) {
                summaryItems[key] = {
                    name: item.name,
                    sku: item.sku || '---',
                    variantName: item.variantName,
                    quantity: 0,
                    orders: []
                };
            }
            summaryItems[key].quantity += item.quantity;
            if (!summaryItems[key].orders.includes(order.id)) {
                summaryItems[key].orders.push(order.id); // Track which orders need this
            }
        });
    });

    // Sort consolidated items by name
    const sortedSummary = Object.values(summaryItems).sort((a, b) => a.name.localeCompare(b.name));

    // Sort orders: High priority first, then by date
    const sortedOrders = [...orders].sort((a, b) => {
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
        if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const html = `
        <html>
        <head>
            <title>Hoja de Producción</title>
            <style>
                ${PRODUCTION_CSS}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>${settings.productionDoc.title || 'HOJA DE PRODUCCIÓN'}</h1>
                    <p>${settings.name}</p>
                </div>
                <div class="header-right">
                    <strong>FECHA IMPRESIÓN:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br/>
                    <strong>TOTAL PEDIDOS:</strong> ${orders.length}
                </div>
            </div>

            <!-- SECTION 1: CONSOLIDATED -->
            <div class="section-header">
                <span>1. LISTA DE PREPARACIÓN (TOTALES)</span>
                <span>ITEMS ÚNICOS: ${sortedSummary.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px; text-align: center;">OK</th>
                        <th style="width: 80px; text-align: center;">CANT</th>
                        <th style="width: 100px;">SKU</th>
                        <th>PRODUCTO / DETALLE</th>
                        <th style="width: 150px;">NOTAS / PEDIDOS REF</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedSummary.map(item => `
                        <tr>
                            <td style="text-align: center;"><div class="check-box"></div></td>
                            <td style="text-align: center;"><span class="qty-box">${item.quantity}</span></td>
                            <td style="font-family: monospace;">${item.sku}</td>
                            <td>
                                <strong style="font-size: 13px;">${item.name}</strong>
                                ${item.variantName ? `<div style="font-style: italic; margin-top: 2px;">Variant: ${item.variantName}</div>` : ''}
                            </td>
                            <td style="font-size: 9px; color: #555;">
                                Ref: ${item.orders.map(id => `#${id.slice(-4)}`).join(', ')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- SECTION 2: ORDERS DETAIL -->
            <div class="section-header" style="margin-top: 30px;">
                <span>2. DISTRIBUCIÓN POR PEDIDO</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 60px;">FOLIO</th>
                        <th style="width: 150px;">CLIENTE / ENTREGA</th>
                        <th>CONTENIDO DEL PEDIDO</th>
                        <th style="width: 150px;">NOTAS</th>
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
                                <span style="color: #666;">Entr: ${order.deliveryDate || 'N/A'}</span>
                            </td>
                            <td>
                                <ul class="order-items-list">
                                    ${order.items.map(i => `
                                        <li>[ <strong>${i.quantity}</strong> ] ${i.name} ${i.variantName ? `(${i.variantName})` : ''}</li>
                                    `).join('')}
                                </ul>
                            </td>
                            <td>
                                ${order.notes ? `<em style="background: #fffbeb; display: block; padding: 2px;">${order.notes}</em>` : '-'}
                            </td>
                            <td style="text-align: center;"><div class="check-box"></div></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <div class="sig-box">FIRMA SUPERVISOR</div>
                <div class="sig-box">FIRMA EMPAQUE</div>
                <div class="sig-box">FECHA / HORA INICIO</div>
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printFinancialReport = (
    startDate: Date, 
    endDate: Date, 
    categories: {name: string, value: number}[], 
    summary: {totalSales: number, totalExpenses: number, netProfit: number, thirdParty: number}, 
    settings: BusinessSettings
) => {
    const startStr = startDate.toLocaleDateString();
    const endStr = endDate.toLocaleDateString();
    
    // Group categories for cleaner report
    const incomes = categories.filter(c => c.name === 'Ventas' || c.name === 'Otros Ingresos');
    const expenses = categories.filter(c => c.name !== 'Ventas' && c.name !== 'Otros Ingresos');

    const html = `
        <html>
        <head>
            <title>Estado Financiero</title>
            <style>${FINANCIAL_REPORT_CSS}</style>
        </head>
        <body>
            <div class="header">
                ${settings.logo ? `<img src="${settings.logo}" class="logo"/>` : ''}
                <div class="title">Estado Financiero</div>
                <div class="subtitle">${settings.name}</div>
            </div>

            <div class="period-box">
                PERIODO: ${startStr} - ${endStr}
            </div>

            <!-- INCOMES -->
            <div class="section">
                <div class="section-title">INGRESOS Y VENTAS</div>
                <div class="row">
                    <span class="label">Ventas Totales Brutas</span>
                    <span class="value income-text">$${summary.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                ${summary.thirdParty > 0 ? `
                <div class="row">
                    <span class="label">Ventas de Terceros (Consignación)</span>
                    <span class="value" style="color:#f59e0b;">$${summary.thirdParty.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                ` : ''}
            </div>

            <!-- EXPENSES Breakdown -->
            <div class="section">
                <div class="section-title">DESGLOSE DE EGRESOS</div>
                ${expenses.length === 0 ? '<div class="row"><span class="label">Sin egresos registrados</span></div>' : ''}
                ${expenses.map(exp => `
                    <div class="row">
                        <span class="label">${exp.name}</span>
                        <span class="value">$${exp.value.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                `).join('')}
            </div>

            <!-- SUMMARY -->
            <div class="summary-box">
                <div class="summary-row">
                    <span>Total Ingresos Operativos</span>
                    <span class="income-text">$${summary.totalSales.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="summary-row">
                    <span>Total Egresos y Salidas</span>
                    <span class="expense-text">-$${summary.totalExpenses.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="summary-row total">
                    <span>UTILIDAD NETA ESTIMADA</span>
                    <span class="net-text">$${summary.netProfit.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                <p style="font-size:9px; color:#64748b; margin-top:5px;">
                    * La utilidad se calcula: Ventas Propias - Gastos Operativos. 
                    (No incluye liquidaciones a terceros en el cálculo de utilidad propia).
                </p>
            </div>

            <div class="footer">
                Generado el ${new Date().toLocaleString()} por LuminaPOS
            </div>
        </body>
        </html>
    `;
    openPrintWindow(html);
};

export const printZCutTicket = (movement: CashMovement, settings: BusinessSettings) => {
    if (!movement.zReportData) return;
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

    // Z-Cut is thermal by definition, use Receipt Logo if possible for HTML preview, 
    // or rely on escPosHelper for real print.
    const html = `
        <html>
        <head><style>${TICKET_CSS}</style></head>
        <body>
            <div class="header">
                ${settings.receiptLogo ? `<img src="${settings.receiptLogo}" style="max-width:50%; margin-bottom:5px;">` : ''}
                <div class="title">CORTE DE CAJA (Z)</div>
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
            <div class="row bold"><span>Diferencia:</span><span>$${z.difference.toFixed(2)}</span></div>
            
            <div class="line"></div>
            <div style="text-align:center; font-weight:bold; margin-bottom:5px;">DESGLOSE DE VENTAS</div>
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

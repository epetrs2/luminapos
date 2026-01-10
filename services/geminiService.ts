
import { GoogleGenAI, Type } from "@google/genai";
import { Product, Transaction, CashMovement, BudgetConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateBusinessInsight = async (
  inventory: Product[],
  transactions: Transaction[],
  cashMovements: CashMovement[]
): Promise<{ text: string }> => {
  if (!process.env.API_KEY) {
    return { text: "API Key no configurada. Por favor configura tu API_KEY para recibir consejos de IA." };
  }

  // Filter out cancelled transactions for analysis
  const activeTransactions = transactions.filter(t => t.status !== 'cancelled');

  const lowStockItems = inventory.filter(p => p.stock < 5).map(p => p.name);
  const totalSales = activeTransactions.reduce((acc, t) => acc + t.total, 0);
  const todaySales = activeTransactions.filter(t => new Date(t.date).toDateString() === new Date().toDateString());
  const todayTotal = todaySales.reduce((acc, t) => acc + t.total, 0);

  const prompt = `
    Actúa como un consultor de negocios experto para una tienda minorista.
    Analiza los siguientes datos operativos y proporciona un resumen conciso y 3 recomendaciones accionables.
    
    Datos:
    - Ventas Totales Históricas (Completadas): $${totalSales.toFixed(2)}
    - Ventas de Hoy: $${todayTotal.toFixed(2)} (${todaySales.length} transacciones)
    - Productos con Stock Bajo (<5 unidades): ${lowStockItems.length > 0 ? lowStockItems.join(', ') : 'Ninguno'}
    - Movimientos de Caja: ${cashMovements.length} registrados.

    Responde en formato Markdown. Usa un tono profesional pero alentador.
    Enfócate en gestión de inventario, oportunidades de venta y control de flujo de efectivo.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return { text: response.text || "No se pudo generar el análisis." };
  } catch (error) {
    console.error("Error generating insight:", error);
    return { text: "Hubo un error al consultar a tu asistente IA. Intenta más tarde." };
  }
};

export interface StockRecommendation {
  productName: string;
  analysis: string;
  recommendedStock: number;
  reorderPoint: number;
}

export const generateStockRecommendations = async (
  products: Product[],
  transactions: Transaction[]
): Promise<StockRecommendation[]> => {
  if (!process.env.API_KEY) return [];

  // Prepare Data: Calculate sales velocity per product
  const productStats = products.map(p => {
    const soldCount = transactions
      .flatMap(t => t.items)
      .filter(i => i.id === p.id)
      .reduce((acc, item) => acc + item.quantity, 0);
    
    return {
      name: p.name,
      currentStock: p.stock,
      totalSold: soldCount,
      category: p.category
    };
  });

  const prompt = `
    Analiza el inventario y el historial de ventas (consumo) de los siguientes productos:
    ${JSON.stringify(productStats)}

    Basado en el "totalSold" (ventas históricas) y el stock actual, recomienda un nivel de stock ideal ("recommendedStock") para mantener y un punto de reorden ("reorderPoint").
    
    La "analysis" debe ser una frase muy breve (max 10 palabras) explicando por qué (ej: "Alta rotación, aumentar stock" o "Venta lenta, mantener bajo").
    Si el totalSold es 0, recomienda mantener stock bajo pero no cero.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              analysis: { type: Type.STRING },
              recommendedStock: { type: Type.NUMBER },
              reorderPoint: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as StockRecommendation[];
    }
    return [];
  } catch (error) {
    console.error("Error generating stock recommendations:", error);
    return [];
  }
};

export const generateBudgetAdvice = async (
    income: number,
    expenses: number,
    profitWithdrawals: number,
    config: BudgetConfig
): Promise<string> => {
    if (!process.env.API_KEY) return "Configura tu API Key para recibir consejos financieros.";

    const prompt = `
    Soy el dueño de un pequeño negocio. Mi distribución ideal de ingresos (semanal) es:
    - Gastos Operativos: ${config.expensesPercentage}%
    - Inversión/Ahorro: ${config.investmentPercentage}%
    - Sueldos/Gustos: ${config.profitPercentage}%

    Esta semana, mis números reales son:
    - Ingreso Total: $${income}
    - Gastos Reales: $${expenses} (${((expenses/income)*100).toFixed(1)}% del ingreso)
    - Retiros (Sueldos/Gustos): $${profitWithdrawals} (${((profitWithdrawals/income)*100).toFixed(1)}% del ingreso)
    
    Analiza si estoy cumpliendo mi presupuesto. Si me estoy excediendo en gastos o retiros, dame una advertencia severa pero constructiva.
    Si mis gastos son muy bajos, sugiereme si debería ajustar los porcentajes para invertir más.
    Dame 3 consejos breves y directos en formato Markdown.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "No se pudo generar el consejo.";
    } catch (error) {
        return "Error al conectar con el asistente financiero.";
    }
};

// --- NEW: MONTH END ANALYSIS ---
export const generateMonthEndAnalysis = async (
    financialData: any,
    topProducts: any[],
    topCustomers: any[]
): Promise<string> => {
    if (!process.env.API_KEY) return "Sin conexión a IA para análisis profundo.";

    const prompt = `
    Genera un INFORME EJECUTIVO DE CIERRE DE MES para un negocio minorista.
    
    DATOS FINANCIEROS:
    - Ingresos Totales: $${financialData.income.toFixed(2)}
    - Gastos Operativos: $${financialData.expenses.toFixed(2)}
    - Utilidad Neta (Aprox): $${financialData.net.toFixed(2)}
    - % Gasto vs Ingreso: ${((financialData.expenses/financialData.income)*100).toFixed(1)}%
    
    TOP PRODUCTOS: ${JSON.stringify(topProducts.slice(0,5))}
    TOP CLIENTES: ${JSON.stringify(topCustomers.slice(0,3))}

    Tu tarea:
    1. Escribe un párrafo breve de "Observaciones Generales" sobre la salud del mes.
    2. Proporciona "Recomendaciones de Presupuesto" para el próximo mes (ej: reducir gastos, reinvertir más).
    3. Calcula y sugiere "Puntos de Equilibrio" aproximados para los productos top (ej: "Para el Producto X, intenta vender al menos N unidades").
    
    Formato: Markdown limpio con subtítulos en negrita. Sé profesional, analítico y directo.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "Análisis no disponible.";
    } catch (error) {
        console.error(error);
        return "Error al generar análisis de cierre.";
    }
};

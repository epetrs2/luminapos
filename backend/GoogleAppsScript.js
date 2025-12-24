
/*
 * ==========================================
 *  LUMINA POS - BACKEND ROBUSTO (CHUNKED)
 * ==========================================
 */

const SCRIPT_VERSION = "3.3.0";
const API_SECRET = ""; // <--- ¡CONFIGURA TU CONTRASEÑA AQUÍ (Opcional)!

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  
  // Wait up to 30s for other processes to finish
  if (lock.tryLock(30000)) {
    try {
      var action = 'pull'; 
      var incomingSecret = '';
      var payloadData = null;

      // 1. Intentar leer desde el cuerpo (POST)
      if (e.postData && e.postData.contents) {
         try {
             var body = JSON.parse(e.postData.contents);
             if (body.action) action = body.action;
             if (body.secret) incomingSecret = body.secret;
             if (body.payload) payloadData = body.payload;
         } catch(err) {
             // No es JSON válido
         }
      } 

      // 2. Intentar leer desde parámetros (GET)
      if (e.parameter) {
          if (e.parameter.action) action = e.parameter.action;
          if (e.parameter.secret) incomingSecret = e.parameter.secret;
      }
      
      action = action ? action.toString().toLowerCase().trim() : 'pull';

      // Validación de Seguridad
      if (API_SECRET && API_SECRET.length > 0) {
          if (incomingSecret !== API_SECRET) {
              return createJSONOutput({ status: 'error', message: '⛔ ACCESO DENEGADO: Clave incorrecta.' });
          }
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var dbSheet = getOrCreateSheet(ss, "Database");
      var backupSheet = getOrCreateSheet(ss, "Backups");
      
      // --- ACCIÓN: PULL (DESCARGAR) ---
      if (action === 'pull') {
        var lastCol = dbSheet.getLastColumn();
        var data = "";
        
        if (lastCol > 0) {
            // Leer todos los chunks de la fila 1 y unirlos
            var values = dbSheet.getRange(1, 1, 1, lastCol).getValues()[0];
            data = values.join("");
        }
        
        return createJSONOutput({ status: 'success', payload: data || null });
      }
      
      // --- ACCIÓN: PUSH (GUARDAR) ---
      if (action === 'push') {
        if (!payloadData) {
           return createJSONOutput({ status: 'success', message: 'Ping recibido (sin datos).' });
        }
        
        // 1. Crear Respaldo (Si hay datos previos)
        var lastCol = dbSheet.getLastColumn();
        if (lastCol > 0) {
            var currentData = dbSheet.getRange(1, 1, 1, lastCol).getValues()[0].join("");
            if (currentData.length > 20) {
                // Guardar en Backups (Fecha | Datos)
                backupSheet.insertRowBefore(1); 
                backupSheet.getRange(1, 1).setValue(new Date()); 
                // Los backups antiguos se guardan truncados si son muy grandes para evitar errores, o en celda 2
                // Para robustez simple, guardamos solo los primeros 50k chars en backup visual
                backupSheet.getRange(1, 2).setValue(currentData.substring(0, 49000)); 
                
                // Limpiar backups viejos
                if (backupSheet.getLastRow() > 20) backupSheet.deleteRow(21);
            }
        }
        
        // 2. Guardar Datos Nuevos (CHUNK STRATEGY)
        // Google Sheets tiene limite de 50,000 caracteres por celda.
        // Dividimos el payload en chunks de 49,000 para estar seguros.
        var CHUNK_SIZE = 49000;
        var chunks = [];
        for (var i = 0; i < payloadData.length; i += CHUNK_SIZE) {
            chunks.push(payloadData.substring(i, i + CHUNK_SIZE));
        }
        
        // Limpiar fila 1 completamente
        dbSheet.getRange(1, 1, 1, Math.max(lastCol, 1)).clearContent();
        
        // Escribir chunks horizontalmente
        if (chunks.length > 0) {
            dbSheet.getRange(1, 1, 1, chunks.length).setValues([chunks]);
        }
        
        // Timestamp en fila 2 (meta info)
        dbSheet.getRange(2, 1).setValue("Última Sincronización: " + new Date().toLocaleString());
        dbSheet.getRange(2, 2).setValue("Tamaño Total: " + (payloadData.length / 1024).toFixed(2) + " KB");
        
        return createJSONOutput({ status: 'success', version: SCRIPT_VERSION, chunks: chunks.length });
      }
      
      return createJSONOutput({ status: 'error', message: 'Acción desconocida: ' + action });

    } catch (error) {
      return createJSONOutput({ status: 'error', message: "Script Error: " + error.toString() });
    } finally {
      lock.releaseLock();
    }
  } else {
    return createJSONOutput({ status: 'busy', message: 'Servidor ocupado, intentando de nuevo...' });
  }
}

function createJSONOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Database") {
       sheet.clear();
    }
  }
  return sheet;
}

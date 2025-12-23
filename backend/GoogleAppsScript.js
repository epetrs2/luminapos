
/*
 * ==========================================
 *  LUMINA POS - BACKEND SEGURO (VERSION 3.2)
 * ==========================================
 */

const SCRIPT_VERSION = "3.2.0";
const API_SECRET = ""; // <--- ¡CONFIGURA TU CONTRASEÑA AQUÍ (Opcional)!

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  
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
             // No es JSON, ignorar o procesar como texto plano
         }
      } 

      // 2. Intentar leer desde parámetros (GET o Query String)
      if (e.parameter) {
          if (e.parameter.action) action = e.parameter.action;
          if (e.parameter.secret) incomingSecret = e.parameter.secret;
      }
      
      action = action.toString().toLowerCase().trim();

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
        var data = dbSheet.getRange(1, 1).getValue();
        return createJSONOutput({ status: 'success', payload: data || null });
      }
      
      // --- ACCIÓN: PUSH (GUARDAR) ---
      if (action === 'push') {
        if (!payloadData || payloadData.length < 5) {
           return createJSONOutput({ status: 'success', message: 'Conexión verificada correctamente.' });
        }
        
        // Crear Respaldo antes de sobrescribir
        var currentData = dbSheet.getRange(1, 1).getValue();
        if (currentData && currentData.length > 10) {
          backupSheet.insertRowBefore(1); 
          backupSheet.getRange(1, 1).setValue(new Date()); 
          backupSheet.getRange(1, 2).setValue(currentData); 
          if (backupSheet.getLastRow() > 50) backupSheet.deleteRow(51);
        }
        
        // Guardar Datos Nuevos
        dbSheet.getRange(1, 1).setValue(payloadData);
        dbSheet.getRange(1, 2).setValue("Sincronizado: " + new Date().toLocaleString());
        
        return createJSONOutput({ status: 'success', version: SCRIPT_VERSION });
      }
      
      return createJSONOutput({ status: 'error', message: 'Acción desconocida: ' + action });

    } catch (error) {
      return createJSONOutput({ status: 'error', message: error.toString() });
    } finally {
      lock.releaseLock();
    }
  } else {
    return createJSONOutput({ status: 'busy', message: 'Servidor ocupado.' });
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
    if (name === "Database") sheet.clear();
  }
  return sheet;
}

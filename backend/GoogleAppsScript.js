
/*
 * ==========================================
 *  LUMINA POS - BACKEND SEGURO (VERSION 2.3)
 * ==========================================
 */

const SCRIPT_VERSION = "2.3.0";
const API_SECRET = ""; // <--- ¡CONFIGURA TU CONTRASEÑA AQUÍ!

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
      var incomingSecret = null;
      var payloadData = null;

      // Intentar leer datos de POST (Escritura)
      if (e.postData && e.postData.contents) {
         try {
             var body = JSON.parse(e.postData.contents);
             if (body.action) action = body.action;
             if (body.secret) incomingSecret = body.secret;
             if (body.payload) payloadData = body.payload;
         } catch(err) {}
      } 

      // Intentar leer datos de GET (Lectura/Sync)
      if (e.parameter.action) action = e.parameter.action;
      if (!incomingSecret && e.parameter.secret) incomingSecret = e.parameter.secret;
      
      action = action.toString().toLowerCase().trim();

      // Verificación de Seguridad
      if (API_SECRET && API_SECRET.length > 0) {
          if (incomingSecret !== API_SECRET) {
              return createJSONOutput({ status: 'error', message: '⛔ ACCESO DENEGADO: Clave incorrecta.' });
          }
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var dbSheet = getOrCreateSheet(ss, "Database");
      var backupSheet = getOrCreateSheet(ss, "Backups");
      
      // --- LECTURA ---
      if (action === 'pull') {
        var lastRow = dbSheet.getLastRow();
        if (lastRow < 1) return createJSONOutput({}); 
        var data = dbSheet.getRange(1, 1).getValue();
        if (!data) return createJSONOutput({});
        return createJSONOutput({ status: 'success', payload: data });
      }
      
      // --- ESCRITURA ---
      if (action === 'push') {
        if (!payloadData || payloadData.length < 10) {
           return createJSONOutput({ status: 'error', message: 'Datos inválidos o vacíos.' });
        }
        // Crear Backup
        var currentData = dbSheet.getRange(1, 1).getValue();
        if (currentData) {
          backupSheet.insertRowBefore(1); 
          backupSheet.getRange(1, 1).setValue(new Date()); 
          backupSheet.getRange(1, 2).setValue(currentData); 
          if (backupSheet.getLastRow() > 50) backupSheet.deleteRow(51);
        }
        // Guardar Nuevo
        dbSheet.getRange(1, 1).setValue(payloadData);
        dbSheet.getRange(1, 2).setValue("Última sincronización: " + new Date().toLocaleString());
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
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "Database") sheet.clear();
  }
  return sheet;
}

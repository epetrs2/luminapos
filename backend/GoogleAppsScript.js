
/*
 * ==========================================
 *  LUMINA POS - BACKEND SEGURO (VERSION 3.1)
 * ==========================================
 */

const SCRIPT_VERSION = "3.1.0";
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

      // 1. Try reading as JSON body (Normal API behavior)
      if (e.postData && e.postData.contents) {
         try {
             var content = e.postData.contents;
             var body = JSON.parse(content);
             if (body.action) action = body.action;
             if (body.secret) incomingSecret = body.secret;
             if (body.payload) payloadData = body.payload;
         } catch(err) {
             // If JSON parse fails, maybe it's just raw data? 
         }
      } 

      // 2. Try reading parameters (GET or URL-Encoded)
      if (e.parameter) {
          if (e.parameter.action) action = e.parameter.action;
          if (e.parameter.secret) incomingSecret = e.parameter.secret;
      }
      
      action = action.toString().toLowerCase().trim();

      // Security Check: Only if API_SECRET is configured in the script
      if (API_SECRET && API_SECRET.length > 0) {
          if (incomingSecret !== API_SECRET) {
              return createJSONOutput({ status: 'error', message: '⛔ ACCESO DENEGADO: Clave incorrecta.' });
          }
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var dbSheet = getOrCreateSheet(ss, "Database");
      var backupSheet = getOrCreateSheet(ss, "Backups");
      
      // --- READ (PULL) ---
      if (action === 'pull') {
        var lastRow = dbSheet.getLastRow();
        if (lastRow < 1) return createJSONOutput({}); 
        var data = dbSheet.getRange(1, 1).getValue();
        if (!data) return createJSONOutput({});
        
        // Ensure we return a JSON structure that the frontend expects
        // If data is already a JSON string (base64 encoded typically), wrap it
        return createJSONOutput({ status: 'success', payload: data });
      }
      
      // --- WRITE (PUSH) ---
      if (action === 'push') {
        if (!payloadData || payloadData.length < 10) {
           return createJSONOutput({ status: 'error', message: 'Datos inválidos o vacíos.' });
        }
        // Backup
        var currentData = dbSheet.getRange(1, 1).getValue();
        if (currentData) {
          backupSheet.insertRowBefore(1); 
          backupSheet.getRange(1, 1).setValue(new Date()); 
          backupSheet.getRange(1, 2).setValue(currentData); 
          if (backupSheet.getLastRow() > 50) backupSheet.deleteRow(51);
        }
        // Save
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

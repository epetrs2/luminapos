
const unicodeBase64Encode = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
        }));
};

const unicodeBase64Decode = (str: string) => {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
};

export const pushFullDataToCloud = async (url: string, secret: string | undefined, data: any): Promise<boolean> => {
    try {
        if (!url || !url.startsWith('http')) throw new Error("URL inválida");
        
        const jsonString = JSON.stringify({
            timestamp: new Date().toISOString(),
            data: data
        });
        
        const payload = unicodeBase64Encode(jsonString);
        const separator = url.includes('?') ? '&' : '?';
        
        // Enviamos la acción por URL para que Google la lea fácil
        const finalUrl = `${url.trim()}${separator}action=push`;

        const response = await fetch(finalUrl, {
            method: 'POST',
            mode: 'cors', 
            credentials: 'omit',
            redirect: 'follow', // IMPORTANTE: Google redirige la petición
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' // Evita el chequeo previo de seguridad (CORS)
            },
            body: JSON.stringify({
                action: 'push',
                secret: secret || '',
                payload: payload
            })
        });

        if (response.status === 404) {
            throw new Error("URL no encontrada (404).");
        }

        if (!response.ok) throw new Error(`Error de red: ${response.status}`);

        const responseText = await response.text();
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(responseText);
        } catch (e) {
            throw new Error("El servidor no devolvió JSON válido.");
        }

        if (jsonResponse.status !== 'success') {
            throw new Error(jsonResponse.message || "Error desconocido en el servidor");
        }

        return true; 
    } catch (error: any) {
        console.error('Error al subir:', error);
        throw error;
    }
};

export const fetchFullDataFromCloud = async (url: string, secret: string | undefined): Promise<any> => {
    try {
        if (!url || !url.startsWith('http')) throw new Error("URL inválida");

        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url.trim()}${separator}action=pull&secret=${encodeURIComponent(secret || '')}&t=${Date.now()}`;

        const response = await fetch(finalUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        });
        
        if (response.status === 404) {
            throw new Error("URL no encontrada (404).");
        }

        if (!response.ok) throw new Error(`Error de descarga: ${response.status}`);
        
        const text = await response.text();
        
        let responseData;
        try {
            responseData = JSON.parse(text);
        } catch (e) {
            if (text.includes('<!DOCTYPE html>')) {
                throw new Error("La URL devolvió HTML. Verifica permisos (Cualquier usuario).");
            }
            throw new Error("Respuesta inválida del servidor.");
        }
        
        if (responseData.status === 'busy') {
            // Treat busy as a temporary failure to fetch, don't throw hard error but return null so consumer knows no data came
            console.warn("Servidor ocupado (LockService)");
            return null; 
        }

        if (responseData.status === 'error') {
            throw new Error(responseData.message || "Error en el script");
        }
        
        if (responseData && responseData.payload && typeof responseData.payload === 'string') {
            try {
                const decodedJson = unicodeBase64Decode(responseData.payload);
                const parsed = JSON.parse(decodedJson);
                return parsed.data || parsed;
            } catch (e) {
                console.error("Error decoding payload", e);
                return null; // Corrupt payload
            }
        }
        
        return responseData.payload || responseData;
    } catch (error: any) {
        console.error('Error en descarga:', error);
        throw error;
    }
};


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
            throw new Error("URL no encontrada (404). Verifica que termina en '/exec' y la implementación es correcta.");
        }

        if (!response.ok) throw new Error(`Error de red: ${response.status}`);
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

        // GET request simple sin headers para evitar Preflight OPTIONS que GAS no maneja bien a veces
        const response = await fetch(finalUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        });
        
        if (response.status === 404) {
            throw new Error("URL no encontrada (404). Verifica que termina en '/exec' y la implementación es correcta.");
        }

        if (!response.ok) throw new Error(`Error de descarga: ${response.status}`);
        
        const text = await response.text();
        
        // Intentar parsear JSON, si falla puede ser la página de error HTML de Google
        let responseData;
        try {
            responseData = JSON.parse(text);
        } catch (e) {
            if (text.includes('<!DOCTYPE html>')) {
                throw new Error("La URL devolvió HTML en lugar de JSON. Verifica los permisos de acceso (Debe ser 'Cualquier usuario').");
            }
            throw new Error("Respuesta inválida del servidor.");
        }
        
        if (responseData.status === 'error') throw new Error(responseData.message);
        
        if (responseData && responseData.payload && typeof responseData.payload === 'string') {
            try {
                const decodedJson = unicodeBase64Decode(responseData.payload);
                const parsed = JSON.parse(decodedJson);
                return parsed.data || parsed;
            } catch (e) {
                return responseData.payload;
            }
        }
        return responseData.payload || responseData;
    } catch (error: any) {
        console.error('Error en descarga:', error);
        throw error;
    }
};

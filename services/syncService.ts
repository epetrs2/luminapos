
// Helper to safely encode Unicode strings to Base64
const unicodeBase64Encode = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode(parseInt(p1, 16));
        }));
};

// Helper to safely decode Base64 to Unicode strings
const unicodeBase64Decode = (str: string) => {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
};

export const pushFullDataToCloud = async (url: string, secret: string | undefined, data: any): Promise<boolean> => {
    try {
        if (!url || !url.startsWith('http')) throw new Error("URL inválida");
        
        // 1. Serialize and Encode
        const jsonString = JSON.stringify({
            timestamp: new Date().toISOString(),
            data: data
        });
        
        const payload = unicodeBase64Encode(jsonString);

        // POST: Push requires body.
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url.trim()}${separator}action=push`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for push

        const response = await fetch(finalUrl, {
            method: 'POST',
            mode: 'cors', 
            signal: controller.signal,
            headers: { 
                'Content-Type': 'text/plain' 
            },
            body: JSON.stringify({
                action: 'push',
                secret: secret || '',
                payload: payload
            })
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }

        const resJson = await response.json();
        if (resJson.status === 'error') {
            throw new Error(resJson.message);
        }

        return true; 
    } catch (error: any) {
        console.error('Error al subir a la nube:', error);
        throw error; // Re-throw to be handled by UI
    }
};

export const fetchFullDataFromCloud = async (url: string, secret: string | undefined): Promise<any> => {
    try {
        if (!url || !url.startsWith('http')) throw new Error("URL inválida");

        // GET: More reliable for GAS on MacOS/Safari to avoid redirects dropping POST bodies.
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url.trim()}${separator}action=pull&secret=${encodeURIComponent(secret || '')}&t=${Date.now()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for pull

        const response = await fetch(finalUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            signal: controller.signal,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Error de conexión (${response.status})`);
        }
        
        let responseData;
        try {
            const text = await response.text();
            responseData = JSON.parse(text);
        } catch (e) {
            throw new Error("La respuesta del servidor no es un JSON válido.");
        }
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message || "Error desconocido del servidor");
        }
        
        // Handle the Base64 format
        if (responseData && responseData.payload && typeof responseData.payload === 'string') {
            try {
                const decodedJson = unicodeBase64Decode(responseData.payload);
                const parsed = JSON.parse(decodedJson);
                return parsed.data || parsed;
            } catch (e) {
                console.warn("Error decoding payload, checking if raw data...", e);
                // Fallback attempt
                return responseData;
            }
        }

        // Direct JSON payload case
        if (responseData && responseData.payload && typeof responseData.payload === 'object') {
             return responseData.payload;
        }

        return responseData;
    } catch (error: any) {
        console.error('Error en descarga:', error);
        if (error.name === 'AbortError') {
            throw new Error("Tiempo de espera agotado. Verifica tu conexión.");
        }
        throw error;
    }
};

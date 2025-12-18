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
        if (!url || !url.startsWith('http')) return false;
        
        // 1. Serialize and Encode
        const jsonString = JSON.stringify({
            timestamp: new Date().toISOString(),
            data: data
        });
        
        const payload = unicodeBase64Encode(jsonString);

        // POST: Push requires body.
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url.trim()}${separator}action=push`;

        await fetch(finalUrl, {
            method: 'POST',
            mode: 'cors', 
            headers: { 
                'Content-Type': 'text/plain' 
            },
            body: JSON.stringify({
                action: 'push',
                secret: secret || '',
                payload: payload
            })
        });
        return true; 
    } catch (error) {
        console.error('Error al subir a la nube:', error);
        return false;
    }
};

export const fetchFullDataFromCloud = async (url: string, secret: string | undefined): Promise<any> => {
    try {
        if (!url || !url.startsWith('http')) return null;

        // GET: More reliable for GAS on MacOS/Safari to avoid redirects dropping POST bodies.
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url.trim()}${separator}action=pull&secret=${encodeURIComponent(secret || '')}&t=${Date.now()}`;

        const response = await fetch(finalUrl, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        if (!response.ok) {
            return null;
        }
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            console.error("Cloud Error:", responseData.message);
            throw new Error(responseData.message);
        }
        
        // Handle the Base64 format
        if (responseData && responseData.payload && typeof responseData.payload === 'string') {
            try {
                const decodedJson = unicodeBase64Decode(responseData.payload);
                const parsed = JSON.parse(decodedJson);
                return parsed.data || parsed;
            } catch (e) {
                console.warn("Legacy data format or decode error, trying direct use.");
                return responseData;
            }
        }

        return responseData;
    } catch (error) {
        console.error('Error en descarga:', error);
        return null;
    }
};
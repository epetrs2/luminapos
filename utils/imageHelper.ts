
/**
 * Processes an uploaded image file:
 * 1. Resizes it if it's too large (max 500px width/height) to save storage/bandwidth.
 * 2. Flattens transparency (PNG) onto a white background to prevent printing issues (black boxes on thermal printers).
 * 3. Converts to JPEG format.
 */
export const processLogoImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("No se pudo inicializar el contexto del canvas"));
                    return;
                }

                // 1. Calculate new size (Max 500px dimension)
                const MAX_SIZE = 500;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // 2. Fill background with WHITE (Handles transparency)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                // 3. Draw the image (scaled)
                ctx.drawImage(img, 0, 0, width, height);

                // 4. Export as JPEG (Standard, high compatibility, small size)
                // Quality 0.9 is excellent for logos
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = (e) => reject(e);
            img.src = event.target?.result as string;
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
};

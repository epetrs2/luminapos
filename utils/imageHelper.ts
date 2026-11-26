
/**
 * Optimizes an image specifically for Thermal Printing (1-bit monochrome).
 * Applies Grayscale, High Contrast, and Floyd-Steinberg Dithering.
 * This ensures the user sees exactly what will be printed on the receipt.
 */
export const optimizeForThermal = (base64Str: string, targetWidth: number = 384): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Canvas error"));
                if (!img.width || !img.height) return reject(new Error("Dimensiones de imagen inválidas"));

                const scale = targetWidth / img.width;
                const targetHeight = Math.min(1200, Math.max(1, Math.round(img.height * scale)));

                canvas.width = targetWidth;
                canvas.height = targetHeight;

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                const data = imgData.data;
                const w = targetWidth;
                const h = targetHeight;
                const grayBuf = new Float32Array(w * h);

                for (let i = 0; i < w * h; i++) {
                    const p = i * 4;
                    const gray = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
                    const highContrast = Math.max(0, Math.min(255, ((gray - 128) * 1.3) + 128));
                    grayBuf[i] = highContrast;
                }

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = y * w + x;
                        const oldPixel = grayBuf[i];
                        const newPixel = oldPixel < 128 ? 0 : 255;
                        const p = i * 4;
                        data[p] = newPixel;
                        data[p + 1] = newPixel;
                        data[p + 2] = newPixel;

                        const quantError = oldPixel - newPixel;
                        if (x + 1 < w) grayBuf[i + 1] += (quantError * 7) / 16;
                        if (x - 1 >= 0 && y + 1 < h) grayBuf[i + w - 1] += (quantError * 3) / 16;
                        if (y + 1 < h) grayBuf[i + w] += (quantError * 5) / 16;
                        if (x + 1 < w && y + 1 < h) grayBuf[i + w + 1] += (quantError * 1) / 16;
                    }
                }

                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = reject;
        img.src = base64Str;
    });
};

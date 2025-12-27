
/**
 * Optimizes an image specifically for Thermal Printing (1-bit monochrome).
 * Applies Grayscale, High Contrast, and Floyd-Steinberg Dithering.
 * This ensures the user sees exactly what will be printed on the receipt.
 */
export const optimizeForThermal = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas error");

            // Resize for standard thermal width (approx 384px is good for 58mm, 576 for 80mm)
            const targetWidth = 384; 
            const scale = targetWidth / img.width;
            const targetHeight = img.height * scale;

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            // White Background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imgData.data;

            // Floyd-Steinberg Dithering Logic
            // First pass: Convert to grayscale and apply contrast curve
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                // Contrast stretch: make darks darker and lights lighter before dithering
                const contrastFactor = 1.3; 
                let highContrast = ((gray - 128) * contrastFactor) + 128;
                highContrast = Math.max(0, Math.min(255, highContrast));
                
                data[i] = highContrast; // R
                data[i+1] = highContrast; // G
                data[i+2] = highContrast; // B
                // Alpha remains 255
            }

            const w = targetWidth;
            const h = targetHeight;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    const oldPixel = data[idx];
                    const newPixel = oldPixel < 128 ? 0 : 255; // Threshold
                    
                    data[idx] = newPixel;
                    data[idx+1] = newPixel;
                    data[idx+2] = newPixel;

                    const quantError = oldPixel - newPixel;

                    // Distribute error to neighbors
                    if (x + 1 < w) {
                        data[(y * w + x + 1) * 4] += (quantError * 7) / 16;
                    }
                    if (x - 1 >= 0 && y + 1 < h) {
                        data[((y + 1) * w + x - 1) * 4] += (quantError * 3) / 16;
                    }
                    if (y + 1 < h) {
                        data[((y + 1) * w + x) * 4] += (quantError * 5) / 16;
                    }
                    if (x + 1 < w && y + 1 < h) {
                        data[((y + 1) * w + x + 1) * 4] += (quantError * 1) / 16;
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = base64Str;
    });
};

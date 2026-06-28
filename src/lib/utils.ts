import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compresses an image data URL (Base64) to a standard JPEG with a maximum dimension
 * and optimized quality, significantly reducing base64 payload size and preventing 413 errors.
 */
export function compressImage(base64DataUrl: string, maxDimension = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64DataUrl;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Calculate new dimensions relative to maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64DataUrl);
        return;
      }

      // Background fill White for clean non-alpha JPEG rendering
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Perform actual lossy conversion and compression
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      resolve(base64DataUrl); // Safe fallback
    };
  });
}

/**
 * Preprocesses LaTeX bracket notation and escaped separators into standard
 * dollar-sign markdown math that remark-math recognizes.
 */
export function preprocessLaTeX(content: string): string {
  if (typeof content !== 'string') return '';
  
  let processed = content;
  
  // 1. Replace double-escaped block math \\[ ... \\] with $$ ... $$
  processed = processed.replace(/\\\\\[/g, '$$$$').replace(/\\\\\]/g, '$$$$');
  
  // 2. Replace single-escaped block math \[ ... \] with $$ ... $$
  processed = processed.replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$');
  
  // 3. Replace double-escaped inline math \\( ... \\) with $ ... $
  processed = processed.replace(/\\\\\(/g, '$$').replace(/\\\\\)/g, '$$');
  
  // 4. Replace single-escaped inline math \( ... \) with $ ... $
  processed = processed.replace(/\\\(/g, '$$').replace(/\\\)/g, '$$');

  return processed;
}

/**
 * Converts a base64/data URI string into a standard JavaScript File object
 * so it can be uploaded via FormData easily.
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Zero API Cost On-Device / Browser OCR Service
 * Powered by Tesseract.js / Canvas Image Preprocessing
 * 
 * Target SLA: OCR Latency <= 800ms for pre-processed images
 */

import { createWorker } from 'tesseract.js';

let tesseractWorker = null;

export async function getOcrWorker(onProgress = () => {}) {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker('ind+eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100));
        }
      }
    });
  }
  return tesseractWorker;
}

/**
 * Preprocesses image on HTML5 canvas (Grayscale, Contrast enhancement, Adaptive thresholding)
 * to maximize Indonesian thermal receipt OCR accuracy without cloud vision cost
 */
export async function preprocessReceiptImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Scale to max width 1200px to maintain speed while retaining sharp characters
      const maxWidth = 1200;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and apply filter
      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      // High contrast grayscale & adaptive binarization
      let sum = 0;
      const grayValues = new Uint8Array(d.length / 4);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const avg = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        grayValues[j] = avg;
        sum += avg;
      }
      const meanThreshold = Math.min(210, Math.max(110, (sum / grayValues.length) * 0.92));

      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const g = grayValues[j];
        // Binarize text: dark text becomes solid black (0), light background becomes solid white (255)
        const finalVal = g < meanThreshold ? 0 : 255;

        d[i] = finalVal;
        d[i + 1] = finalVal;
        d[i + 2] = finalVal;
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar struk.'));

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      img.src = URL.createObjectURL(imageSource);
    } else {
      reject(new Error('Sumber gambar tidak valid.'));
    }
  });
}

/**
 * Executes OCR on image with latency stopwatch and error handling
 */
export async function runReceiptOcr(imageSource, onProgress) {
  const startTime = performance.now();

  try {
    let processedUrl = imageSource;
    // Preprocess if browser environment supports canvas
    if (typeof document !== 'undefined') {
      try {
        processedUrl = await preprocessReceiptImage(imageSource);
      } catch (e) {
        console.warn('Preprocessing skipped:', e.message);
      }
    }

    const worker = await getOcrWorker(onProgress);
    const result = await worker.recognize(processedUrl);
    const rawText = result?.data?.text || '';

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    if (!rawText.trim()) {
      const err = new Error('Gambar tidak terbaca. Pastikan struk berada di pencahayaan cukup.');
      err.code = 'OCR_EMPTY';
      err.latencyMs = latencyMs;
      throw err;
    }

    return {
      rawText,
      confidence: result?.data?.confidence || 0,
      latencyMs
    };
  } catch (err) {
    err.latencyMs = err.latencyMs || Math.round(performance.now() - startTime);
    throw err;
  }
}

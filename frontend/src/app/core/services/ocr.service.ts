import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  private worker: any = null;
  private initializing: Promise<void> | null = null;

  private async ensureWorker() {
    if (this.worker) return;
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      this.worker = await createWorker('eng');
    })();

    return this.initializing;
  }

  async extractText(imageSource: string | HTMLCanvasElement | Blob, rectangle?: { left: number, top: number, width: number, height: number }): Promise<string> {
    await this.ensureWorker();
    
    try {
      const { data: { text } } = await this.worker.recognize(imageSource, {
        rectangle: rectangle
      });
      return text.trim();
    } catch (err) {
      console.error('OcrService: Recognition Error', err);
      // If worker fails, we might want to reset it
      this.worker = null;
      this.initializing = null;
      throw err;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initializing = null;
    }
  }
}

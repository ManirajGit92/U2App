import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OcrScanService {
  private worker: any = null;

  async detectTextFromImage(imageSource: File | string): Promise<string[]> {
    const Tesseract = await import('tesseract.js');

    const { data: { text } } = await Tesseract.recognize(
      imageSource as any,
      'eng',
      { logger: () => {} }
    );

    // Extract large/bold text - split by newlines and filter meaningful lines
    const lines = text
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length >= 2 && l.length <= 80);

    return lines;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

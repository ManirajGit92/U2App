import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  private stream: MediaStream | null = null;
  private animFrame: number | null = null;
  private detectorAvailable = false;

  constructor() {
    this.detectorAvailable = 'BarcodeDetector' in window;
  }

  async startScan(
    videoEl: HTMLVideoElement,
    onDetected: (value: string) => void,
    onError?: (err: any) => void
  ): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      videoEl.srcObject = this.stream;
      await videoEl.play();

      if (this.detectorAvailable) {
        await this.scanWithNativeDetector(videoEl, onDetected);
      } else {
        await this.scanWithZXing(videoEl, onDetected, onError);
      }
    } catch (err) {
      onError?.(err);
    }
  }

  stopScan() {
    if (this.animFrame != null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  private async scanWithNativeDetector(
    videoEl: HTMLVideoElement,
    onDetected: (value: string) => void
  ) {
    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a', 'upc_e', 'data_matrix']
    });

    const detect = async () => {
      if (!this.stream) return;
      try {
        const codes = await detector.detect(videoEl);
        if (codes.length > 0) {
          onDetected(codes[0].rawValue);
          return; // Stop after first detection
        }
      } catch {}
      this.animFrame = requestAnimationFrame(detect);
    };

    this.animFrame = requestAnimationFrame(detect);
  }

  private async scanWithZXing(
    videoEl: HTMLVideoElement,
    onDetected: (value: string) => void,
    onError?: (err: any) => void
  ) {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();

      reader.decodeFromVideoElement(videoEl, (result: any, err: any) => {
        if (result) {
          onDetected(result.getText());
        }
      });
    } catch (err) {
      onError?.(err);
    }
  }
}

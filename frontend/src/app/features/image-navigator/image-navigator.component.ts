import { 
  Component, 
  ElementRef, 
  OnInit, 
  ViewChild, 
  HostListener 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExcelDataService, ImageData } from '../../core/services/excel-data.service';
import { OcrService } from '../../core/services/ocr.service';
import { TtsService } from '../../core/services/tts.service';

@Component({
  selector: 'app-image-navigator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="navigator-container">
      <!-- Header / Toolbar -->
      <header class="toolbar glass-card">
        <div class="toolbar-left">
          <h1 class="title">Image <span class="gradient-text">Navigator</span></h1>
          <span class="status-badge" [class.active]="currentImage">
            {{ currentImage ? 'Active: ' + currentImage.uniqueName : 'No Image Loaded' }}
          </span>
        </div>
        
        <div class="toolbar-right">
          <button (click)="excelService.downloadSampleExcel()" class="btn btn-secondary btn-sm">
            <span class="icon">⏬</span> Sample Excel
          </button>
          <label class="btn btn-primary btn-sm">
            <span class="icon">📁</span> Upload Excel
            <input type="file" (change)="onFileSelected($event)" accept=".xlsx, .xls" hidden />
          </label>
        </div>
      </header>

      <main class="content-grid">
        <!-- Left: Image Display -->
        <section class="image-section glass-card">
          <div class="image-wrapper" #imageWrapper (mousedown)="startSelection($event)" (mousemove)="updateSelection($event)" (mouseup)="endSelection($event)">
            @if (currentImage) {
              <img [src]="currentImage.imageUrl" alt="Navigation Image" #navigationImage (load)="onImageLoad()" draggable="false" crossOrigin="anonymous" />
              <div class="selection-box" *ngIf="isSelecting || selectionRect" 
                   [style.left.px]="selectionRect?.left" 
                   [style.top.px]="selectionRect?.top" 
                   [style.width.px]="selectionRect?.width" 
                   [style.height.px]="selectionRect?.height">
                <div class="selection-label" *ngIf="isProcessing || extractedText">
                  {{ isProcessing ? 'Processing...' : extractedText }}
                </div>
              </div>
            } @else {
              <div class="empty-state">
                <span class="empty-icon">🖼️</span>
                <p>Upload an Excel file to start navigating</p>
                <button (click)="loadSample()" class="btn btn-secondary">Load Sample Data</button>
              </div>
            }
          </div>
          
          <div class="navigation-controls" *ngIf="currentImage">
            <button (click)="navigate('back')" class="btn-nav" title="Previous Image">❮</button>
            <div class="img-counter">{{ currentIndex + 1 }} / {{ totalImages }}</div>
            <button (click)="navigate('next')" class="btn-nav" title="Next Image">❯</button>
          </div>
        </section>

        <!-- Right: Results & Info -->
        <aside class="info-section">
          <div class="glass-card result-panel">
            <h3 class="panel-title">Extracted Text</h3>
            <div class="extracted-text-box" [class.loading]="isProcessing">
              @if (isProcessing) {
                <div class="loader-inline"></div>
                <span>OCR in progress...</span>
              } @else if (extractedText) {
                <p class="extracted-content">{{ extractedText }}</p>
              } @else {
                <p class="placeholder-text">Draw a box on the image to extract text</p>
              }
            </div>
          </div>

          <div class="glass-card speech-panel">
            <h3 class="panel-title">Voice Description</h3>
            <p class="voice-content" *ngIf="currentImage">{{ currentImage.voiceText }}</p>
            <div class="voice-actions" *ngIf="currentImage">
              <button (click)="ttsService.speak(currentImage.voiceText)" class="btn-icon" title="Speak">🔊</button>
              <button (click)="ttsService.stop()" class="btn-icon" title="Stop">🔇</button>
            </div>
          </div>

          <div class="glass-card data-panel">
            <h3 class="panel-title">Data Source ({{ totalImages }} items)</h3>
            <div class="data-list">
              @for (item of dataList; track item.uniqueName; let i = $index) {
                <div class="data-item" [class.active]="i === currentIndex" (click)="goToIndex(i)">
                  <span class="item-id">{{ i + 1 }}</span>
                  <span class="item-name">{{ item.uniqueName }}</span>
                </div>
              }
            </div>
          </div>
        </aside>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: var(--bg-deep, #0f172a);
      color: var(--text-primary, #f8fafc);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      overflow: hidden;
    }

    .navigator-container {
      padding: 20px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .glass-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }

    .toolbar {
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0;
    }

    .gradient-text {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .status-badge {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-tertiary, #94a3b8);
      margin-left: 12px;
    }

    .status-badge.active {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
    }

    .toolbar-right {
      display: flex;
      gap: 12px;
    }

    .content-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 20px;
      overflow: hidden;
    }

    .image-section {
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
    }

    .image-wrapper {
      flex: 1;
      position: relative;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: crosshair;
    }

    .image-wrapper img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      user-select: none;
    }

    .selection-box {
      position: absolute;
      border: 2px solid #6366f1;
      background: rgba(99, 102, 241, 0.25);
      pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.3);
    }

    .selection-label {
      position: absolute;
      top: -25px;
      left: 0;
      background: #6366f1;
      color: white;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .navigation-controls {
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      background: rgba(0,0,0,0.5);
    }

    .btn-nav {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-nav:hover {
      background: var(--accent-primary, #6366f1);
      transform: scale(1.1);
    }

    .img-counter {
      font-size: 0.9rem;
      font-weight: 600;
      color: #94a3b8;
    }

    .info-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
      padding-bottom: 20px;
    }

    .panel-title {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin: 0 0 12px;
    }

    .result-panel, .speech-panel, .data-panel {
      padding: 20px;
    }

    .extracted-text-box {
      background: rgba(15, 23, 42, 0.5);
      border: 1px dashed rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      min-height: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
      text-align: center;
    }

    .extracted-content {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fbbf24;
      margin: 0;
    }

    .placeholder-text {
      font-size: 0.85rem;
      color: #4b5563;
    }

    .voice-content {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #e2e8f0;
    }

    .voice-actions {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }

    .data-list {
      max-height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .data-item {
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(255,255,255,0.03);
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .data-item:hover {
      background: rgba(255,255,255,0.08);
    }

    .data-item.active {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .item-id {
      font-size: 0.75rem;
      font-weight: 800;
      color: #6366f1;
    }

    .item-name {
      font-size: 0.85rem;
      font-weight: 500;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      transition: all 0.2s;
    }

    .btn-sm { padding: 6px 12px; font-size: 0.85rem; }

    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    
    .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #f1f5f9; }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.2); }

    .btn-icon {
      background: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .loader-inline {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(99, 102, 241, 0.3);
      border-radius: 50%;
      border-top-color: #6366f1;
      animation: spin 1s linear infinite;
      margin-bottom: 8px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      text-align: center;
      padding: 40px;
    }

    .empty-icon {
      font-size: 4rem;
      display: block;
      margin-bottom: 20px;
      opacity: 0.2;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
  `]
})
export class ImageNavigatorComponent implements OnInit {
  @ViewChild('navigationImage') navigationImage!: ElementRef<HTMLImageElement>;
  @ViewChild('imageWrapper') imageWrapper!: ElementRef<HTMLDivElement>;

  dataList: ImageData[] = [];
  currentIndex: number = 0;
  extractedText: string = '';
  isProcessing: boolean = false;
  
  // Selection logic
  isSelecting: boolean = false;
  selectionStart = { x: 0, y: 0 };
  selectionRect: { left: number; top: number; width: number; height: number } | null = null;
  
  get currentImage(): ImageData | null {
    return this.dataList[this.currentIndex] || null;
  }

  get totalImages(): number {
    return this.dataList.length;
  }

  constructor(
    public excelService: ExcelDataService,
    private ocrService: OcrService,
    public ttsService: TtsService
  ) {}

  ngOnInit() {
    this.excelService.data$.subscribe(data => {
      this.dataList = data;
      this.currentIndex = 0;
      if (this.currentImage) {
        this.onImageChange();
      }
    });
  }

  loadSample() {
    this.excelService.loadSampleData();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      try {
        await this.excelService.parseExcelFile(file);
      } catch (err) {
        alert(err);
      }
    }
  }

  goToIndex(index: number) {
    this.currentIndex = index;
    this.onImageChange();
  }

  navigate(direction: 'next' | 'back') {
    if (direction === 'next') {
      this.currentIndex = (this.currentIndex + 1) % this.totalImages;
    } else {
      this.currentIndex = (this.currentIndex - 1 + this.totalImages) % this.totalImages;
    }
    this.onImageChange();
  }

  onImageChange() {
    this.selectionRect = null;
    this.extractedText = '';
    // Speak voice text
    if (this.currentImage) {
        this.ttsService.speak(this.currentImage.voiceText);
    }
  }

  onImageLoad() {
    // Optional: readjust anything on image load
  }

  startSelection(event: MouseEvent) {
    if (!this.currentImage) return;
    this.isSelecting = true;
    const rect = this.imageWrapper.nativeElement.getBoundingClientRect();
    this.selectionStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    this.selectionRect = {
      left: this.selectionStart.x,
      top: this.selectionStart.y,
      width: 0,
      height: 0
    };
  }

  updateSelection(event: MouseEvent) {
    if (!this.isSelecting) return;
    const rect = this.imageWrapper.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.selectionRect = {
      left: Math.min(this.selectionStart.x, currentX),
      top: Math.min(this.selectionStart.y, currentY),
      width: Math.abs(currentX - this.selectionStart.x),
      height: Math.abs(currentY - this.selectionStart.y)
    };
  }

  async endSelection(event: MouseEvent) {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    
    if (!this.selectionRect || this.selectionRect.width < 10 || this.selectionRect.height < 10) {
      this.selectionRect = null;
      return;
    }

    await this.processOCR();
  }

  async processOCR() {
    if (!this.selectionRect || !this.navigationImage) return;
    
    this.isProcessing = true;
    this.extractedText = '';

    try {
      const img = this.navigationImage.nativeElement;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Map selection from wrapper space to image actual pixels
      const wrapperRect = this.imageWrapper.nativeElement.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Calculate relative position within the image
      const relativeX = (this.selectionRect.left + (wrapperRect.left - imgRect.left));
      const relativeY = (this.selectionRect.top + (wrapperRect.top - imgRect.top));
      
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      const cropX = relativeX * scaleX;
      const cropY = relativeY * scaleY;
      const cropW = this.selectionRect.width * scaleX;
      const cropH = this.selectionRect.height * scaleY;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const text = await this.ocrService.extractText(canvas);
      this.extractedText = text;
      
      this.handleNavigationLogic(text);
    } catch (err) {
      console.error('OCR Error:', err);
      this.extractedText = 'Error reading text';
    } finally {
      this.isProcessing = false;
    }
  }

  handleNavigationLogic(text: string) {
    const rawText = text.toLowerCase().trim();
    
    // Command navigation
    if (rawText === 'back') {
      this.navigate('back');
      return;
    }
    if (['next', 'submit', 'finish'].includes(rawText)) {
      this.navigate('next');
      return;
    }

    // Matching logic
    // 1. Exact match
    const exactMatch = this.dataList.findIndex(item => item.uniqueName.toLowerCase() === rawText);
    if (exactMatch !== -1) {
      this.goToIndex(exactMatch);
      return;
    }

    // 2. Nearest match (contains or simple similarity)
    const nearestMatch = this.dataList.findIndex(item => 
      item.uniqueName.toLowerCase().includes(rawText) || rawText.includes(item.uniqueName.toLowerCase())
    );
    if (nearestMatch !== -1) {
      this.goToIndex(nearestMatch);
      return;
    }

    // 3. Fallback: If we are already on some image, stay there but show the extracted text.
    // Only go to index 0 if we weren't on any image (which shouldn't happen)
    if (this.currentIndex === -1) {
      this.goToIndex(0);
    }
  }
}

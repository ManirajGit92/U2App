import { Component, signal, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .card {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 20px;
      padding: 48px 56px;
      text-align: center;
      max-width: 420px;
    }
    h1 { font-size: 2rem; margin-bottom: 12px; }
    p  { opacity: 0.85; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>👋 Hello, World!</h1>
    <p>Edit the HTML on the left and see your changes here — live.</p>
  </div>
</body>
</html>`;

@Component({
  selector: 'app-html-viewer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './html-viewer.component.html',
  styleUrls: ['./html-viewer.component.scss'],
})
export class HtmlViewerComponent implements OnInit, AfterViewInit {
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  htmlCode = signal<string>(DEFAULT_HTML);
  wordCount = signal<number>(0);
  lineCount = signal<number>(0);
  isFullscreen = signal<boolean>(false);
  copied = signal<boolean>(false);

  ngOnInit(): void {
    this.updateStats(DEFAULT_HTML);
  }

  ngAfterViewInit(): void {
    this.renderPreview();
  }

  onCodeChange(value: string): void {
    this.htmlCode.set(value);
    this.updateStats(value);
    this.renderPreview();
  }

  private updateStats(code: string): void {
    const lines = code.split('\n').length;
    const words = code.split(/\s+/).filter(w => w.length > 0).length;
    this.lineCount.set(lines);
    this.wordCount.set(words);
  }

  private renderPreview(): void {
    const frame = this.previewFrame?.nativeElement;
    if (!frame) return;
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(this.htmlCode());
    doc.close();
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.htmlCode()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  clearCode(): void {
    this.htmlCode.set('');
    this.updateStats('');
    this.renderPreview();
  }

  getLineNumbers(): number[] {
    return Array.from({ length: this.lineCount() }, (_, i) => i + 1);
  }

  loadDefault(): void {
    this.htmlCode.set(DEFAULT_HTML);
    this.updateStats(DEFAULT_HTML);
    this.renderPreview();
  }

  toggleFullscreen(): void {
    this.isFullscreen.update(v => !v);
  }
}

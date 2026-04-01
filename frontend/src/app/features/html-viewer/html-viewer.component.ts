import { UpperCasePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

const DEFAULT_HTML = `<div class="hero-card">
  <span class="eyebrow">Live Playground</span>
  <h1>Build HTML, CSS, and JavaScript together</h1>
  <p>
    Edit the structure, style it with the CSS panel, and add interactions with JavaScript.
  </p>
  <button id="demo-btn" class="hero-btn">Click me</button>
  <p id="demo-output" class="hero-output">Waiting for interaction...</p>
</div>`;

const DEFAULT_CSS = `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.35), transparent 35%),
    linear-gradient(160deg, #07111f 0%, #0f172a 55%, #111827 100%);
  color: #e5eefb;
  font-family: "Segoe UI", sans-serif;
}

.hero-card {
  width: min(560px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45);
}

.eyebrow {
  display: inline-block;
  margin-bottom: 12px;
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #7dd3fc;
}

h1 {
  margin: 0 0 12px;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
}

p {
  margin: 0 0 16px;
  line-height: 1.6;
  color: #cbd5e1;
}

.hero-btn {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  color: #020617;
  font-weight: 700;
  cursor: pointer;
}

.hero-output {
  margin-top: 16px;
  font-weight: 600;
  color: #fef08a;
}`;

const DEFAULT_JS = `const button = document.getElementById('demo-btn');
const output = document.getElementById('demo-output');

if (button && output) {
  button.addEventListener('click', () => {
    output.textContent = 'Button clicked at ' + new Date().toLocaleTimeString();
  });
}`;

@Component({
  selector: 'app-html-viewer',
  standalone: true,
  imports: [FormsModule, UpperCasePipe],
  templateUrl: './html-viewer.component.html',
  styleUrls: ['./html-viewer.component.scss'],
})
export class HtmlViewerComponent implements OnInit, AfterViewInit {
  @ViewChild('previewFrame') previewFrame!: ElementRef<HTMLIFrameElement>;

  htmlCode = signal<string>(DEFAULT_HTML);
  cssCode = signal<string>(DEFAULT_CSS);
  jsCode = signal<string>(DEFAULT_JS);
  wordCount = signal<number>(0);
  lineCount = signal<number>(0);
  isFullscreen = signal<boolean>(false);
  copied = signal<boolean>(false);
  activePanel = signal<'html' | 'css' | 'js'>('html');

  ngOnInit(): void {
    this.updateStats();
  }

  ngAfterViewInit(): void {
    this.renderPreview();
  }

  onCodeChange(type: 'html' | 'css' | 'js', value: string): void {
    if (type === 'html') this.htmlCode.set(value);
    if (type === 'css') this.cssCode.set(value);
    if (type === 'js') this.jsCode.set(value);
    this.updateStats();
    this.renderPreview();
  }

  beautifyHtml(): void {
    const formatted = this.formatHtml(this.htmlCode());
    this.htmlCode.set(formatted);
    this.updateStats();
    this.renderPreview();
  }

  private updateStats(): void {
    const combinedCode = [this.htmlCode(), this.cssCode(), this.jsCode()]
      .filter(Boolean)
      .join('\n');
    const lines = combinedCode ? combinedCode.split('\n').length : 0;
    const words = combinedCode.split(/\s+/).filter((w) => w.length > 0).length;
    this.lineCount.set(lines);
    this.wordCount.set(words);
  }

  private renderPreview(): void {
    const frame = this.previewFrame?.nativeElement;
    if (!frame) return;
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(this.buildPreviewDocument());
    doc.close();
  }

  private buildPreviewDocument(): string {
    const css = this.cssCode().trim();
    const js = this.jsCode().trim();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HTML Viewer Preview</title>
  ${css ? `<style>\n${css}\n</style>` : ''}
</head>
<body>
${this.htmlCode()}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
  }

  private formatHtml(code: string): string {
    const trimmed = code.trim();
    if (!trimmed) return '';

    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
      'param', 'source', 'track', 'wbr',
    ]);
    const tokens = trimmed
      .replace(/>\s+</g, '><')
      .split(/(<[^>]+>)/g)
      .map((token) => token.trim())
      .filter(Boolean);

    const lines: string[] = [];
    let indent = 0;

    for (const token of tokens) {
      if (!token.startsWith('<')) {
        lines.push(`${'  '.repeat(indent)}${token}`);
        continue;
      }

      const tagNameMatch = token.match(/^<\/?\s*([^\s>/]+)/);
      const tagName = tagNameMatch?.[1]?.toLowerCase() ?? '';
      const isClosing = /^<\//.test(token);
      const isComment = /^<!--/.test(token);
      const isDeclaration = /^<![^-]/.test(token);
      const isSelfClosing = /\/>$/.test(token) || voidTags.has(tagName) || isComment || isDeclaration;

      if (isClosing) {
        indent = Math.max(indent - 1, 0);
      }

      lines.push(`${'  '.repeat(indent)}${token}`);

      if (!isClosing && !isSelfClosing) {
        indent += 1;
      }
    }

    return lines.join('\n');
  }

  copyCode(): void {
    const combinedCode = [
      `<!-- HTML -->\n${this.htmlCode()}`,
      this.cssCode().trim() ? `\n/* CSS */\n${this.cssCode()}` : '',
      this.jsCode().trim() ? `\n// JavaScript\n${this.jsCode()}` : '',
    ].join('\n');

    navigator.clipboard.writeText(combinedCode.trim()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  clearCode(): void {
    this.htmlCode.set('');
    this.cssCode.set('');
    this.jsCode.set('');
    this.updateStats();
    this.renderPreview();
  }

  getLineNumbers(code: string): number[] {
    const totalLines = code ? code.split('\n').length : 1;
    return Array.from({ length: totalLines }, (_, i) => i + 1);
  }

  loadDefault(): void {
    this.htmlCode.set(DEFAULT_HTML);
    this.cssCode.set(DEFAULT_CSS);
    this.jsCode.set(DEFAULT_JS);
    this.updateStats();
    this.renderPreview();
  }

  setActivePanel(panel: 'html' | 'css' | 'js'): void {
    this.activePanel.set(panel);
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
  }
}

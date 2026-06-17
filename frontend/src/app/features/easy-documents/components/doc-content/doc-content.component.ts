import { Component, inject, effect, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { EasyDocumentsService, DocSection } from '../../easy-documents.service';
import mermaid from 'mermaid';

@Component({
  selector: 'app-doc-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="content-wrapper" #contentWrapper>
      @if (currentPage()) {
        @for (section of currentPage().sections; track section.id) {
          <section [id]="section.uniqueId || section.id" class="doc-section">
            <div class="section-header">
              <div class="header-left-wrap">
                @if (section.category) {
                  <span class="sec-cat-badge">{{ section.category }}</span>
                }
                @if (section.subcategory) {
                  <span class="sec-subcat-badge">{{ section.subcategory }}</span>
                }
              </div>
              <button class="tts-btn" (click)="speak(section)" title="Speak Text">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              </button>
            </div>

            <div class="section-body">
              <!-- Rich Content Text rendering -->
              @if (section.content) {
                <div class="rich-content" [innerHTML]="sanitize(section.content)"></div>
              }

              <!-- Image Carousel Widget -->
              @if (section.carouselImage && getImages(section.carouselImage).length > 0) {
                <div class="carousel-container" 
                  (touchstart)="handleTouchStart($event)" 
                  (touchend)="handleTouchEnd($event, section.id, getImages(section.carouselImage).length)">
                  <div class="carousel-track">
                    <img 
                      loading="lazy"
                      [src]="getImages(section.carouselImage)[getSlideIndex(section.id)]" 
                      alt="Carousel content"
                      class="carousel-img"
                      (click)="openLightbox(getImages(section.carouselImage)[getSlideIndex(section.id)])"
                    >
                  </div>
                  <div class="carousel-controls">
                    <button class="nav-arrow" (click)="prevSlide(section.id, getImages(section.carouselImage).length)">◀</button>
                    <div class="dots-indicators">
                      <span *ngFor="let dot of getImages(section.carouselImage); let i = index" 
                        class="dot" 
                        [class.active]="getSlideIndex(section.id) === i"
                        (click)="setSlideIndex(section.id, i)"></span>
                    </div>
                    <button class="nav-arrow" (click)="nextSlide(section.id, getImages(section.carouselImage).length)">▶</button>
                  </div>
                </div>
              }

              <!-- Notes with custom variants (success, warning, error, info) -->
              @if (section.note) {
                <div [class]="'note-box ' + getNoteDetails(section.note).variant">
                  <span class="note-icon">{{ getNoteDetails(section.note).icon }}</span>
                  <p class="note-text" [innerHTML]="getNoteDetails(section.note).text"></p>
                </div>
              }

              <!-- Code Editor block with syntax highlighting and selection dropdown -->
              @if (section.code) {
                <div class="code-block-wrapper">
                  <div class="code-header-bar">
                    <select class="lang-select" 
                      [(ngModel)]="selectedLanguages[section.id]"
                      (ngModelChange)="onLanguageChange(section.id)">
                      <option value="plaintext">Plain Text</option>
                      <option value="javascript">JavaScript</option>
                      <option value="typescript">TypeScript</option>
                      <option value="html">HTML</option>
                      <option value="css">CSS</option>
                      <option value="python">Python</option>
                      <option value="json">JSON</option>
                    </select>
                    <button class="copy-btn" (click)="copyCode(section.code)">
                      {{ docService.t('Copy') }} 📋
                    </button>
                  </div>

                  <div class="code-editor-container" [class.collapsed]="codeCollapsed[section.id] && section.code.split('\n').length > 10">
                    <div class="line-numbers">
                      <div *ngFor="let line of section.code.split('\n'); let idx = index" class="line-num">{{ idx + 1 }}</div>
                    </div>
                    <pre class="code-pre"><code [innerHTML]="highlight(section.code, selectedLanguages[section.id] || 'plaintext')"></code></pre>
                  </div>

                  <div class="collapse-footer" *ngIf="section.code.split('\n').length > 10">
                    <button class="btn btn-secondary btn-sm" (click)="codeCollapsed[section.id] = !codeCollapsed[section.id]">
                      {{ codeCollapsed[section.id] ? 'Show More 🔽' : 'Show Less 🔼' }}
                    </button>
                  </div>
                </div>
              }

              <!-- Secured Sandboxed Iframe Embed -->
              @if (section.iframe && isValidUrl(section.iframe)) {
                <div class="iframe-wrapper">
                  <div class="iframe-spinner" *ngIf="iframeLoading[section.id]">
                    <div class="spinner-small"></div>
                  </div>
                  <iframe 
                    [src]="sanitizeUrl(section.iframe)" 
                    frameborder="0" 
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    allowfullscreen="true" 
                    referrerpolicy="no-referrer"
                    (load)="iframeLoading[section.id] = false"
                  ></iframe>
                </div>
              }

              @if (section.mermaid) {
                <div class="mermaid-container">
                  <pre class="mermaid">{{ section.mermaid }}</pre>
                </div>
              }
            </div>
          </section>
        }
      }
    </div>

    <!-- Lightbox Fullscreen Image Preview -->
    <div class="lightbox-overlay" *ngIf="lightboxImg" (click)="closeLightbox()">
      <div class="lightbox-body" (click)="$event.stopPropagation()">
        <img [src]="lightboxImg" alt="Lightbox Image" class="lightbox-img">
        <button class="lightbox-close" (click)="closeLightbox()">✕</button>
      </div>
    </div>
  `,
  styles: [`
    .content-wrapper {
      max-width: 100%;
      margin: 0 auto;
      padding: 32px 48px;
      display: flex;
      flex-direction: column;
      gap: 64px;
    }

    @media (max-width: 1024px) {
      .content-wrapper {
        padding: 24px 32px;
      }
    }

    @media (max-width: 640px) {
      .content-wrapper {
        padding: 16px 20px;
        gap: 40px;
      }
    }

    .doc-section {
      scroll-margin-top: 80px;
      animation: fadeInUp 0.5s ease-out both;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 12px;
    }

    .header-left-wrap {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .sec-cat-badge {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-primary);
    }

    .sec-subcat-badge {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent-primary, #6366f1);
      background: rgba(99, 102, 241, 0.08);
      padding: 4px 10px;
      border-radius: 6px;
    }

    .tts-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .tts-btn:hover {
      background: rgba(99, 102, 241, 0.08);
      color: var(--accent-primary, #6366f1);
      transform: scale(1.1);
    }

    .section-body {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .rich-content {
      font-size: 1.08rem;
      line-height: 1.7;
      color: var(--text-primary);
    }

    .rich-content b, .rich-content strong {
      font-weight: 700;
    }

    /* Carousels */
    .carousel-container {
      background: rgba(148, 163, 184, 0.04);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      user-select: none;
      width: 100%;
      box-sizing: border-box;
    }
    .carousel-track {
      width: 100%;
      display: flex;
      justify-content: center;
      border-radius: 10px;
      overflow: hidden;
      background: #000;
    }
    .carousel-img {
      max-height: 650px;
      width: auto;
      max-width: 100%;
      object-fit: contain;
      cursor: zoom-in;
      transition: transform 0.2s;
    }
    .carousel-img:hover {
      transform: scale(1.01);
    }
    .carousel-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 300px;
      gap: 12px;
    }
    .nav-arrow {
      background: rgba(148, 163, 184, 0.15);
      border: none;
      font-size: 1rem;
      padding: 8px 12px;
      border-radius: 50%;
      cursor: pointer;
      color: var(--text-primary);
      transition: background 0.2s;
    }
    .nav-arrow:hover {
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent-primary, #6366f1);
    }
    .dots-indicators {
      display: flex;
      gap: 6px;
    }
    .dots-indicators .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--border-color);
      cursor: pointer;
      transition: background 0.2s;
    }
    .dots-indicators .dot.active {
      background: var(--accent-primary, #6366f1);
      width: 18px;
      border-radius: 10px;
    }

    @media (max-width: 1024px) {
      .carousel-img {
        max-height: 500px;
      }
    }
    @media (max-width: 640px) {
      .carousel-img {
        max-height: 350px;
      }
    }

    /* Note Card Variants */
    .note-box {
      border-left: 4px solid var(--accent-primary);
      padding: 16px;
      border-radius: 10px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-top: 8px;
    }
    .note-box.info {
      background: rgba(99, 102, 241, 0.08);
      border-left-color: #6366f1;
    }
    .note-box.success {
      background: rgba(16, 185, 129, 0.08);
      border-left-color: #10b981;
    }
    .note-box.warning {
      background: rgba(245, 158, 11, 0.08);
      border-left-color: #f59e0b;
    }
    .note-box.error {
      background: rgba(239, 68, 68, 0.08);
      border-left-color: #ef4444;
    }
    .note-icon {
      font-size: 1.4rem;
    }
    .note-text {
      font-size: 0.95rem;
      margin: 0;
      line-height: 1.6;
      font-style: italic;
    }

    /* Code Block IDE-like Styling */
    .code-block-wrapper {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border-color);
      background: #0f172a;
    }
    .code-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      padding: 8px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .lang-select {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #e2e8f0;
      padding: 4px 10px;
      font-size: 0.8rem;
      outline: none;
    }
    .copy-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .code-editor-container {
      display: flex;
      font-family: 'Fira Code', monospace;
      font-size: 0.95rem;
      overflow-y: auto;
      max-height: 600px;
      transition: max-height 0.25s ease-out;
    }
    .code-editor-container.collapsed {
      max-height: 320px;
    }
    .line-numbers {
      background: #1e293b;
      color: #64748b;
      padding: 12px 10px;
      text-align: right;
      user-select: none;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      min-width: 32px;
    }
    .line-num {
      line-height: 1.6;
    }
    .code-pre {
      margin: 0;
      padding: 12px;
      flex: 1;
      overflow-x: auto;
      background: transparent;
    }
    .code-pre code {
      line-height: 1.6;
      display: block;
      color: #e2e8f0;
      white-space: pre;
    }
    .collapse-footer {
      background: #1e293b;
      padding: 8px;
      display: flex;
      justify-content: center;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* secured dynamic iframes */
    .iframe-wrapper {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      background: #000;
      aspect-ratio: 16/9;
      position: relative;
      min-height: 250px;
    }
    .iframe-wrapper iframe {
      width: 100%;
      height: 100%;
      display: block;
    }
    .iframe-spinner {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }
    .spinner-small {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(99, 102, 241, 0.15);
      border-top-color: var(--accent-primary, #6366f1);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .mermaid-container {
      display: flex;
      justify-content: center;
      background: white;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border-color);
      margin-top: 8px;
    }

    /* Lightbox */
    .lightbox-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(4px);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
    }
    .lightbox-body {
      position: relative;
      max-width: 90%;
      max-height: 90%;
    }
    .lightbox-img {
      max-width: 100%;
      max-height: 85vh;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    .lightbox-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: transparent;
      border: none;
      color: white;
      font-size: 2rem;
      cursor: pointer;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DocContentComponent implements AfterViewInit, OnDestroy {
  docService = inject(EasyDocumentsService);
  sanitizer = inject(DomSanitizer);

  @ViewChild('contentWrapper') contentWrapper!: ElementRef;

  selectedLanguages: Record<string, string> = {};
  codeCollapsed: Record<string, boolean> = {};
  
  // Carousel slide indexes
  carouselSlides: Record<string, number> = {};
  
  // Iframe states
  iframeLoading: Record<string, boolean> = {};

  // Touch swipe states
  touchStartX = 0;
  touchEndX = 0;

  // Lightbox
  lightboxImg: string | null = null;

  constructor() {
    effect(() => {
      const pages = this.docService.pages();
      if (pages.length > 0) {
        // Auto initialize carousel slides and languages
        pages.forEach((page) => {
          page.sections.forEach((sec) => {
            if (!this.selectedLanguages[sec.id]) {
              this.selectedLanguages[sec.id] = this.detectLanguage(sec.code || '');
            }
            if (this.codeCollapsed[sec.id] === undefined) {
              this.codeCollapsed[sec.id] = true;
            }
            if (this.carouselSlides[sec.id] === undefined) {
              this.carouselSlides[sec.id] = 0;
            }
            if (this.iframeLoading[sec.id] === undefined) {
              this.iframeLoading[sec.id] = true;
            }
          });
        });
        setTimeout(() => this.renderMermaid(), 150);
      }
    });

    const m = (mermaid as any).default || mermaid;
    if (m && typeof m.initialize === 'function') {
      m.initialize({ 
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });
    } else {
      console.warn('mermaid.initialize is not available', m);
    }
  }

  ngAfterViewInit() {
    this.renderMermaid();
  }

  ngOnDestroy() {
    this.docService.stopSpeaking();
  }

  currentPage(): any {
    return this.docService.filteredPages()[this.docService.currentPageIndex()];
  }

  sanitize(html: string) {
    if (this.docService.searchQuery()) {
      const query = this.docService.searchQuery();
      const regex = new RegExp(`(${query})`, 'gi');
      html = html.replace(regex, '<span class="highlight">$1</span>');
    }
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  sanitizeUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  isValidUrl(url: string): boolean {
    return /^(https?:\/\/)/i.test(url);
  }

  speak(section: DocSection) {
    const text = `${section.category || ''} ${section.subcategory || ''} ${section.content} ${section.note || ''}`;
    this.docService.speak(text, this.docService.currentLanguage());
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
    alert(this.docService.t('Code copied to clipboard!'));
  }

  async renderMermaid() {
    try {
      const m = (mermaid as any).default || mermaid;
      if (m && typeof m.run === 'function') {
        await m.run({
          nodes: document.querySelectorAll('.mermaid')
        });
      }
    } catch (e) {
      console.error('Mermaid render error', e);
    }
  }

  // --- Carousel slide management ---
  getImages(urlStr: string | undefined): string[] {
    if (!urlStr) return [];
    return urlStr.split(',').map(url => url.trim()).filter(url => url !== '');
  }

  getSlideIndex(secId: string): number {
    return this.carouselSlides[secId] || 0;
  }

  setSlideIndex(secId: string, idx: number) {
    this.carouselSlides[secId] = idx;
  }

  prevSlide(secId: string, total: number) {
    let current = this.carouselSlides[secId] || 0;
    current = current === 0 ? total - 1 : current - 1;
    this.carouselSlides[secId] = current;
  }

  nextSlide(secId: string, total: number) {
    let current = this.carouselSlides[secId] || 0;
    current = current === total - 1 ? 0 : current + 1;
    this.carouselSlides[secId] = current;
  }

  // Touch gestures for carousel swipe
  handleTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  handleTouchEnd(event: TouchEvent, secId: string, total: number) {
    this.touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.nextSlide(secId, total);
      } else {
        this.prevSlide(secId, total);
      }
    }
  }

  // --- Lightbox image preview ---
  openLightbox(url: string) {
    this.lightboxImg = url;
  }

  closeLightbox() {
    this.lightboxImg = null;
  }

  // --- Notes Variants ---
  getNoteDetails(noteText: string) {
    const text = noteText.trim();
    if (text.startsWith('[Success]') || text.toLowerCase().startsWith('success:')) {
      return {
        variant: 'success',
        icon: '✅',
        text: text.replace(/^\[Success\]\s*/i, '').replace(/^success:\s*/i, '')
      };
    }
    if (text.startsWith('[Warning]') || text.toLowerCase().startsWith('warning:')) {
      return {
        variant: 'warning',
        icon: '⚠️',
        text: text.replace(/^\[Warning\]\s*/i, '').replace(/^warning:\s*/i, '')
      };
    }
    if (text.startsWith('[Error]') || text.toLowerCase().startsWith('error:')) {
      return {
        variant: 'error',
        icon: '🛑',
        text: text.replace(/^\[Error\]\s*/i, '').replace(/^error:\s*/i, '')
      };
    }
    return {
      variant: 'info',
      icon: '💡',
      text: text.replace(/^\[Info\]\s*/i, '').replace(/^info:\s*/i, '')
    };
  }

  // --- Language detector & Custom Highlighter ---
  detectLanguage(code: string): string {
    if (!code) return 'plaintext';
    if (code.includes('import ') || code.includes('const ') || code.includes('let ') || code.includes('function ')) {
      return 'javascript';
    }
    if (code.includes('<html>') || code.includes('</div>') || code.includes('<!DOCTYPE')) {
      return 'html';
    }
    if (code.includes('def ') || code.includes('import sys') || code.includes('print(')) {
      return 'python';
    }
    if (code.includes('{') && code.includes('margin:') && code.includes('color:')) {
      return 'css';
    }
    if (code.startsWith('{') && code.endsWith('}') && code.includes('":')) {
      return 'json';
    }
    return 'plaintext';
  }

  onLanguageChange(secId: string) {
    // Force rerender by copying
    this.selectedLanguages = { ...this.selectedLanguages };
  }

  highlight(code: string, lang: string): string {
    if (!code) return '';
    
    // Escape HTML symbols first to protect against script execution
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (lang === 'javascript' || lang === 'typescript' || lang === 'js' || lang === 'ts') {
      // Keywords
      escaped = escaped.replace(
        /\b(const|let|var|function|return|import|export|from|class|extends|new|if|else|for|while|do|switch|case|break|try|catch|finally|async|await|this|true|false|null|undefined)\b/g,
        '<span style="color:#f43f5e;font-weight:bold;">$1</span>'
      );
      // Comments
      escaped = escaped.replace(/(\/\/.*)/g, '<span style="color:#64748b;font-style:italic;">$1</span>');
      escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#64748b;font-style:italic;">$1</span>');
      // Strings
      escaped = escaped.replace(/(["'`])(.*?)\1/g, '<span style="color:#10b981;">$1$2$1</span>');
      // Numbers
      escaped = escaped.replace(/\b(\d+)\b/g, '<span style="color:#f59e0b;">$1</span>');
    } else if (lang === 'html' || lang === 'xml') {
      // Tags
      escaped = escaped.replace(/(&lt;\/?[a-zA-Z0-9:-]+)/g, '<span style="color:#f43f5e;">$1</span>');
      escaped = escaped.replace(/(&gt;)/g, '<span style="color:#f43f5e;">$1</span>');
      // Attributes
      escaped = escaped.replace(/(\s[a-zA-Z0-9:-]+=)/g, '<span style="color:#f59e0b;">$1</span>');
      // Attribute values
      escaped = escaped.replace(/(["'])(.*?)\1/g, '<span style="color:#10b981;">$1$2$1</span>');
    } else if (lang === 'css') {
      // Selectors
      escaped = escaped.replace(/([a-zA-Z0-9_.-]+)\s*\{/g, '<span style="color:#f43f5e;font-weight:bold;">$1</span> {');
      // Properties
      escaped = escaped.replace(/([a-zA-Z-]+)\s*:/g, '<span style="color:#3b82f6;">$1</span>:');
      // Strings
      escaped = escaped.replace(/(["'])(.*?)\1/g, '<span style="color:#10b981;">$1$2$1</span>');
    } else if (lang === 'python' || lang === 'py') {
      // Keywords
      escaped = escaped.replace(
        /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|in|is|not|and|or|true|false|none|lambda|print)\b/g,
        '<span style="color:#f43f5e;font-weight:bold;">$1</span>'
      );
      // Comments
      escaped = escaped.replace(/(#.*)/g, '<span style="color:#64748b;font-style:italic;">$1</span>');
      // Strings
      escaped = escaped.replace(/(["'])(.*?)\1/g, '<span style="color:#10b981;">$1$2$1</span>');
    } else if (lang === 'json') {
      // Keys
      escaped = escaped.replace(/(["'])(.*?)\1\s*:/g, '<span style="color:#f43f5e;">$1$2$1</span>:');
      // Strings values
      escaped = escaped.replace(/:\s*(["'])(.*?)\1/g, ': <span style="color:#10b981;">$1$2$1</span>');
      // Values (numbers & booleans)
      escaped = escaped.replace(/:\s*\b(true|false|null|\d+)\b/g, ': <span style="color:#f59e0b;">$1</span>');
    }

    return escaped;
  }
}

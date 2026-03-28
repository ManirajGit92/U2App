import { Component, inject, effect, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { EasyDocumentsService, DocSection } from '../../easy-documents.service';
import * as mermaid from 'mermaid';

@Component({
  selector: 'app-doc-content',
  standalone: true,
  imports: [],
  template: `
    <div class="content-wrapper" #contentWrapper>
      @if (currentPage()) {
        @for (section of currentPage().sections; track section.id) {
          <section [id]="section.id" class="doc-section">
            <div class="section-header">
              @if (section.heading) {
                <h2 class="section-title">{{ section.heading }}</h2>
              }
              @if (section.subheading) {
                <h3 class="section-subtitle">{{ section.subheading }}</h3>
              }
              <button class="tts-btn" (click)="speak(section)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              </button>
            </div>

            <div class="section-body">
              @if (section.content) {
                <div class="rich-content" [innerHTML]="sanitize(section.content)"></div>
              }

              @if (section.notes) {
                <div class="note-box">
                  <span class="note-icon">💡</span>
                  <p class="note-text">{{ section.notes }}</p>
                </div>
              }

              @if (section.codeBlock) {
                <div class="code-block">
                  <button class="copy-btn" (click)="copyCode(section.codeBlock)">{{ docService.t('Copy') }}</button>
                  <pre><code>{{ section.codeBlock }}</code></pre>
                </div>
              }

              @if (section.mediaUrl) {
                <div class="media-container">
                  @if (isImage(section.mediaUrl)) {
                    <img [src]="section.mediaUrl" alt="Media content">
                  } @else if (isVideo(section.mediaUrl)) {
                    <video [src]="section.mediaUrl" controls></video>
                  } @else {
                    <iframe [src]="sanitizeUrl(section.mediaUrl)" frameborder="0" allowfullscreen></iframe>
                  }
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
  `,
  styles: [`
    .content-wrapper {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
      display: flex;
      flex-direction: column;
      gap: 64px;
    }

    .doc-section {
      scroll-margin-top: 100px;
      animation: fadeInUp 0.5s ease-out both;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      border-bottom: 2px solid var(--accent-surface);
      padding-bottom: 12px;
    }

    .section-title {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.05em;
      margin: 0;
    }

    .section-subtitle {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-secondary);
      margin: 0;
    }

    .tts-btn {
      background: transparent;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .tts-btn:hover {
      background: var(--accent-surface);
      color: var(--accent-primary);
      transform: scale(1.1);
    }

    .section-body {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .rich-content {
      font-size: 1.125rem;
      line-height: 1.7;
      color: var(--text-primary);
    }

    .rich-content b, .rich-content strong {
      font-weight: 700;
    }

    .note-box {
      background: rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1);
      border-left: 4px solid var(--accent-primary);
      padding: 20px;
      border-radius: 8px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .note-icon {
      font-size: 1.5rem;
    }

    .note-text {
      font-size: 1rem;
      font-style: italic;
      margin: 0;
      line-height: 1.6;
    }

    .code-block {
      position: relative;
      background: #1e293b;
      border-radius: 12px;
      padding: 24px;
      overflow: hidden;
    }

    .code-block pre {
      margin: 0;
    }

    .code-block code {
      color: #e2e8f0;
      font-family: 'Fira Code', monospace;
      font-size: 0.95rem;
    }

    ::ng-deep .highlight {
      background: rgba(245, 158, 11, 0.3);
      border-bottom: 2px solid #f59e0b;
      color: inherit;
    }

    .copy-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .copy-btn:hover {
      background: rgba(255,255,255,0.2);
    }

    .media-container {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      background: var(--bg-card);
    }

    .media-container img, .media-container video {
      width: 100%;
      height: auto;
      display: block;
    }

    .media-container iframe {
      width: 100%;
      aspect-ratio: 16/9;
    }

    .mermaid-container {
        display: flex;
        justify-content: center;
        background: white;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        margin-top: 12px;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class DocContentComponent implements AfterViewInit {
  docService = inject(EasyDocumentsService);
  sanitizer = inject(DomSanitizer);

  @ViewChild('contentWrapper') contentWrapper!: ElementRef;

  constructor() {
    effect(() => {
      if (this.docService.pages().length > 0) {
        setTimeout(() => this.renderMermaid(), 100);
      }
    });

    (mermaid as any).initialize({ 
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
    });
  }

  ngAfterViewInit() {
    this.renderMermaid();
  }

  currentPage() {
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

  isImage(url: string) {
    return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
  }

  isVideo(url: string) {
    return /\.(mp4|webm|ogg)$/i.test(url);
  }

  speak(section: DocSection) {
    const text = `${section.heading} ${section.subheading} ${section.content} ${section.notes || ''}`;
    this.docService.speak(text, this.docService.currentLanguage());
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code);
    alert(this.docService.t('Code copied to clipboard!'));
  }

  async renderMermaid() {
    try {
        await (mermaid as any).run({
            nodes: document.querySelectorAll('.mermaid')
        });
    } catch (e) {
        console.error('Mermaid render error', e);
    }
  }
}

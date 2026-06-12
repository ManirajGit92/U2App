import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { NavPreferencesService } from '../../core/services/nav-preferences.service';
import { HomeCarouselService, CarouselSlide } from '../../core/services/home-carousel.service';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string | null;
  available: boolean;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <!-- Hero Section Carousel -->
    <section class="hero-carousel"
             (mouseenter)="pauseAutoplay()"
             (mouseleave)="resumeAutoplay()"
             (touchstart)="onTouchStart($event)"
             (touchend)="onTouchEnd($event)">
      
      <div class="carousel-track">
        @for (slide of activeSlides; track slide.id; let idx = $index) {
          <div class="carousel-slide" 
               [class.active]="idx === currentSlideIndex"
               [class.overlay-light]="slide.overlayType === 'light'"
               [class.overlay-dark]="slide.overlayType === 'dark'"
               [style.background-image]="slide.bgImage && (idx === currentSlideIndex || isPreload(idx)) ? 'url(' + slide.bgImage + ')' : 'none'">
            
            <!-- Dynamic Overlay Shade & Opacity -->
            @if (slide.overlayType !== 'none') {
              <div class="carousel-overlay" 
                   [class.has-image]="!!slide.bgImage"
                   [style.background]="slide.overlayType === 'dark' ? 'linear-gradient(to bottom, rgba(15, 23, 42, ' + (slide.overlayOpacity ?? 75)/100 + ') 0%, rgba(15, 23, 42, ' + (slide.overlayOpacity ?? 75)/100 * 0.8 + ') 50%, rgba(15, 23, 42, ' + (slide.overlayOpacity ?? 75)/100 + ') 100%)' : 'linear-gradient(to bottom, rgba(255, 255, 255, ' + (slide.overlayOpacity ?? 75)/100 + ') 0%, rgba(255, 255, 255, ' + (slide.overlayOpacity ?? 75)/100 * 0.8 + ') 50%, rgba(255, 255, 255, ' + (slide.overlayOpacity ?? 75)/100 + ') 100%)'">
              </div>
            } @else if (!slide.bgImage) {
              <!-- Fallback overlay for default gradient background slider -->
              <div class="carousel-overlay"></div>
            }
            
            <div class="hero-content container">
              @if (slide.badgeText) {
                <span class="hero-badge">{{ slide.badgeText }}</span>
              }
              <h1 class="hero-title" [innerHTML]="slide.title"></h1>
              <p class="hero-subtitle">{{ slide.description }}</p>
              
              <div class="hero-actions">
                @if (slide.primaryBtnText) {
                  @if (isExternalRoute(slide.primaryBtnRoute)) {
                    <a [href]="slide.primaryBtnRoute" class="btn btn-primary btn-lg">
                      @if (slide.primaryBtnRoute === '/excel-mapper' || slide.primaryBtnRoute === 'excel-mapper') {
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 3v18m-7-7l7 7 7-7" />
                        </svg>
                      }
                      {{ slide.primaryBtnText }}
                    </a>
                  } @else {
                    <a [routerLink]="slide.primaryBtnRoute" class="btn btn-primary btn-lg">
                      @if (slide.primaryBtnRoute === '/excel-mapper' || slide.primaryBtnRoute === 'excel-mapper') {
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M12 3v18m-7-7l7 7 7-7" />
                        </svg>
                      }
                      {{ slide.primaryBtnText }}
                    </a>
                  }
                }
                
                @if (slide.secondaryBtnText) {
                  @if (isExternalRoute(slide.secondaryBtnRoute)) {
                    <a [href]="slide.secondaryBtnRoute" class="btn btn-secondary btn-lg">
                      {{ slide.secondaryBtnText }}
                    </a>
                  } @else {
                    <a [routerLink]="slide.secondaryBtnRoute" class="btn btn-secondary btn-lg">
                      {{ slide.secondaryBtnText }}
                    </a>
                  }
                }
              </div>
              
              @if (slide.statistics && slide.statistics.length > 0) {
                <div class="hero-stats">
                  @for (stat of slide.statistics; track $index; let sIdx = $index) {
                    @if (sIdx > 0) {
                      <div class="stat-divider"></div>
                    }
                    <div class="stat">
                      <span class="stat-number">{{ stat.number }}</span>
                      <span class="stat-label">{{ stat.label }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Arrow Controls -->
      @if (activeSlides.length > 1) {
        <button class="carousel-arrow prev" (click)="prevSlide()" aria-label="Previous Slide">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="carousel-arrow next" (click)="nextSlide()" aria-label="Next Slide">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- Pagination Indicators -->
        <div class="carousel-indicators">
          @for (slide of activeSlides; track slide.id; let idx = $index) {
            <button class="indicator-dot" 
                    [class.active]="idx === currentSlideIndex" 
                    (click)="goToSlide(idx)"
                    [attr.aria-label]="'Go to slide ' + (idx + 1)">
            </button>
          }
        </div>
      }
    </section>

    <!-- Tools Grid -->
    <section id="tools" class="tools-section container">
      <div class="section-header">
        <h2 class="section-title">Available Tools</h2>
        <p class="section-subtitle">Pick a tool to get started</p>
      </div>

      <div class="tools-grid">
        @for (tool of tools; track tool.id; let i = $index) {
          <div class="tool-card glass-card" [style.animation-delay]="i * 0.07 + 's'">
            <div class="tool-icon" [style.background]="tool.color">
              <span>{{ tool.icon }}</span>
            </div>
            <h3 class="tool-title">{{ tool.title }}</h3>
            <p class="tool-desc">{{ tool.description }}</p>
            <div class="tool-footer">
              @if (tool.available) {
                <a [routerLink]="tool.route" class="btn btn-primary btn-sm tool-btn">
                  Open Tool →
                </a>
              } @else {
                <span class="badge badge-coming-soon">Coming Soon</span>
              }
            </div>
          </div>
        }
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="container footer-inner">
        <span class="footer-logo">⚡ U2 Tools - Developed By Maniraj</span>
        <span class="footer-copy">© 2026 U2 Tools. All rights reserved.</span>
      </div>
    </footer>
  `,
  styles: [
    `
      /* ───── Hero Carousel ───── */
      .hero-carousel {
        position: relative;
        overflow: hidden;
        min-height: 75vh;
        width: 100%;
        display: flex;
        align-items: center;
        background: var(--bg-primary);
      }

      .carousel-track {
        position: relative;
        width: 100%;
        min-height: 75vh;
        display: flex;
        align-items: center;
      }

      .carousel-slide {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), 
                    visibility 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 0;
        padding: 4rem 2rem;
      }

      .carousel-slide.active {
        opacity: 1;
        visibility: visible;
        z-index: 1;
      }

      .carousel-overlay {
        position: absolute;
        inset: 0;
        background: var(--hero-gradient);
        opacity: 0.12;
        z-index: 1;
      }

      .carousel-overlay::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 30% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
          radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);
      }

      /* Dark gradient overlay for readability on custom images */
      .carousel-overlay.has-image {
        opacity: 1;
        background: linear-gradient(
          to bottom,
          rgba(15, 23, 42, 0.75) 0%,
          rgba(15, 23, 42, 0.6) 50%,
          rgba(15, 23, 42, 0.85) 100%
        );
      }
      .carousel-overlay.has-image::after {
        display: none;
      }

      .hero-content {
        position: relative;
        z-index: 2;
        text-align: center;
        max-width: 800px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }

      .hero-badge {
        display: inline-block;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent-primary);
        background: var(--accent-surface);
        border: 1px solid var(--accent-primary);
        border-radius: 50px;
        margin-bottom: 1rem;
        animation: fadeInUp 0.5s ease-out;
      }

      .hero-title {
        font-size: 3.5rem;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -1.5px;
        margin-bottom: 1rem;
      }

      .gradient-text {
        background: var(--accent-gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .hero-subtitle {
        font-size: 1.15rem;
        color: var(--text-secondary);
        max-width: 560px;
        margin: 0 auto 1.5rem;
        line-height: 1.7;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-bottom: 2rem;
      }

      .hero-stats {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 32px;
      }

      .stat {
        text-align: center;
      }

      .stat-number {
        display: block;
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--accent-primary);
      }

      .stat-label {
        font-size: 0.8rem;
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .stat-divider {
        width: 1px;
        height: 32px;
        background: var(--border-color-strong);
      }

      /* Force white text on custom background images with dark overlay */
      .carousel-slide.overlay-dark .hero-title,
      .carousel-slide.overlay-dark .hero-subtitle,
      .carousel-slide.overlay-dark .stat-label,
      .carousel-slide[style*="url"]:not(.overlay-light) .hero-title,
      .carousel-slide[style*="url"]:not(.overlay-light) .hero-subtitle,
      .carousel-slide[style*="url"]:not(.overlay-light) .stat-label {
        color: #f8fafc;
      }

      /* Force dark text on custom background images with light overlay */
      .carousel-slide.overlay-light .hero-title,
      .carousel-slide.overlay-light .hero-subtitle,
      .carousel-slide.overlay-light .stat-number,
      .carousel-slide.overlay-light .stat-label {
        color: #0f0f1a !important;
      }

      .carousel-slide.overlay-light .stat-divider {
        background: rgba(15, 15, 26, 0.15) !important;
      }

      .carousel-slide.overlay-light .hero-badge {
        background: rgba(99, 102, 241, 0.1) !important;
        border-color: var(--accent-primary) !important;
        color: var(--accent-primary) !important;
      }

      /* Micro-animations inside active slide */
      .carousel-slide.active .hero-badge {
        animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      
      .carousel-slide.active .hero-title {
        animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both;
      }
      
      .carousel-slide.active .hero-subtitle {
        animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
      }
      
      .carousel-slide.active .hero-actions {
        animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
      }
      
      .carousel-slide.active .hero-stats {
        animation: fadeInUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both;
      }

      /* Carousel Controls */
      .carousel-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(26, 26, 46, 0.5);
        border: 1px solid var(--border-color-strong);
        color: var(--text-primary);
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        transition: all var(--transition-fast);
        outline: none;
      }

      .carousel-arrow:hover {
        background: var(--accent-primary);
        color: #fff;
        border-color: var(--accent-primary);
        transform: translateY(-50%) scale(1.1);
        box-shadow: var(--shadow-glow);
      }

      .carousel-arrow.prev {
        left: 20px;
      }

      .carousel-arrow.next {
        right: 20px;
      }

      .carousel-indicators {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 8px;
        z-index: 10;
      }

      .indicator-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        border: none;
        cursor: pointer;
        transition: all var(--transition-normal);
        padding: 0;
      }

      .indicator-dot.active {
        background: var(--accent-primary);
        width: 24px;
        border-radius: 4px;
      }

      /* ───── Tools Section ───── */
      .tools-section {
        padding: 0.5rem 0.5rem 0.5rem;
      }

      .section-header {
        text-align: center;
        margin-bottom: 0.5rem;
      }

      .section-title {
        font-size: 2.2rem;
        font-weight: 800;
        letter-spacing: -0.5px;
        margin-bottom: 0.5rem;
      }

      .section-subtitle {
        font-size: 1.05rem;
        color: var(--text-secondary);
      }

      .tools-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
      }

      .tool-card {
        padding: 0.5rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: fadeInUp 0.5s ease-out both;
        cursor: default;
      }

      .tool-icon {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6rem;
        flex-shrink: 0;
      }

      .tool-title {
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: -0.3px;
      }

      .tool-desc {
        font-size: 0.88rem;
        color: var(--text-secondary);
        line-height: 1.6;
        flex-grow: 1;
      }

      .tool-footer {
        padding-top: 8px;
      }

      .tool-btn {
        text-decoration: none;
      }

      /* ───── Footer ───── */
      .footer {
        border-top: 1px solid var(--border-color);
        padding: 0.5rem 0;
      }

      .footer-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .footer-logo {
        font-weight: 700;
        font-size: 1rem;
        color: var(--text-primary);
      }

      .footer-copy {
        font-size: 0.82rem;
        color: var(--text-tertiary);
      }

      /* ───── Responsive ───── */
      @media (max-width: 768px) {
        .hero {
          padding: 0.5rem 0;
          min-height: auto;
        }
        .hero-title {
          font-size: 2.2rem;
        }
        .hero-subtitle {
          font-size: 1rem;
        }
        .hero-actions {
          flex-direction: column;
        }
        .tools-grid {
          grid-template-columns: 1fr;
        }
        .footer-inner {
          flex-direction: column;
          gap: 12px;
          text-align: center;
        }
      }
    `,
  ],
})
export class HomeComponent implements OnInit, OnDestroy {
  private navPreferencesService = inject(NavPreferencesService);
  private homeCarouselService = inject(HomeCarouselService);
  private readonly orderKey = 'u2app.navOrder';
  private readonly visibilityKey = 'u2app.navVisibility';
  private readonly defaultToolOrder = [
    'standup-note',
    'work-tracker',
    'unit-test-tracker',
    'compare',
    'html-viewer',
    'estimator',
  ];

  activeSlides: CarouselSlide[] = [];
  currentSlideIndex = 0;
  private autoplayIntervalId: any = null;
  private touchStartX = 0;
  private touchEndX = 0;

  private readonly allTools: Tool[] = [
    {
      id: 'excel-mapper',
      title: 'Excel-to-Excel Mapping Tool',
      description:
        'Upload a source workbook, map it into a target format, apply transformations and validations, preview results, and export a processed Excel file with reusable templates.',
      icon: '🧭',
      route: '/excel-mapper',
      available: true,
      color: 'linear-gradient(135deg, rgba(15,118,110,0.18), rgba(2,132,199,0.18))',
    },
    {
      id: 'compare',
      title: 'Text / JSON Compare',
      description:
        'Compare text or JSON side by side with highlighted differences, match percentage, and mismatch extraction.',
      icon: '🔍',
      route: '/compare',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
    },
    {
      id: 'tanglish-voice',
      title: 'Tanglish Voice Studio',
      description:
        'Convert English text into Tanglish with a reusable rule engine and generate natural AI voice playback with selectable voices and speed.',
      icon: 'TV',
      route: '/tanglish-voice',
      available: true,
      color: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(14,165,233,0.2))',
    },
    {
      id: 'tax-calculator',
      title: 'Tax Calculator',
      description:
        'Estimate old vs new tax regimes, import Form 16 Excel data, and get deduction ideas with real-time calculations.',
      icon: '🧾',
      route: '/tax-calculator',
      available: true,
      color: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(59,130,246,0.2))',
    },
    {
      id: 'html-viewer',
      title: 'HTML Viewer',
      description:
        'Preview and render HTML code instantly with live editing and responsive viewport testing.',
      icon: '🌐',
      route: '/html-viewer',
      available: true,
      color: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(14,165,233,0.2))',
    },
    // {
    //   id: 'bg-remover',
    //   title: 'Image BG Remover',
    //   description: 'Remove image backgrounds automatically with AI-powered edge detection.',
    //   icon: '🖼️',
    //   route: null,
    //   available: false,
    //   color: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(244,63,94,0.2))',
    // },
    // {
    //   id: 'excel-viewer',
    //   title: 'Excel to Web Viewer',
    //   description: 'Upload Excel or CSV files and view them as beautifully formatted interactive web tables.',
    //   icon: '📊',
    //   route: null,
    //   available: false,
    //   color: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.2))',
    // },
    // {
    //   id: 'broadcast-creator',
    //   title: 'Broadcast Creator',
    //   description: 'Transform your content into polished broadcast-ready messages for email, social, and newsletters.',
    //   icon: '📡',
    //   route: null,
    //   available: false,
    //   color: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))',
    // },
    {
      id: 'content-creator',
      title: 'Content Creator',
      description:
        'Transform Excel data into engaging video slideshows with AI voice-over and smooth animations.',
      icon: '🎬',
      route: '/content-creator',
      available: true,
      color: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(192,132,252,0.2))',
    },
    {
      id: 'work-tracker',
      title: 'Work Tracker',
      description:
        'Track developer statuses, monitor product release tracking, and manage data via local Excel sheets.',
      icon: '📈',
      route: '/work-tracker',
      available: true,
      color: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.2))',
    },
    {
      id: 'estimator',
      title: 'Estimater App',
      description:
        'Automatically estimate project effort with formula-based inputs, feature breakdowns, and Excel report generation.',
      icon: '⏱️',
      route: '/estimator',
      available: true,
      color: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(244,63,94,0.2))',
    },
    {
      id: 'real-life-steps',
      title: 'Real Life Steps Game',
      description:
        'Play a live multiplayer board game with 100 configured positive/negative life events, tokens, investing and robust dice rolling.',
      icon: '🎲',
      route: '/real-life-steps',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
    },
    {
      id: 'controls-to-excel',
      title: 'Controls to Excel',
      description:
        'Upload Excel files, dynamically generate form controls, search globally, alter cell data, and instantly visualize it into powerful dynamic charts.',
      icon: '🗂️',
      route: '/controls-to-excel',
      available: true,
      color: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(56,189,248,0.2))',
    },
    {
      id: 'unit-test-tracker',
      title: 'Unit Test Tracker',
      description:
        'Excel-driven test tracking system with full CRUD, execution logging, and bug management.',
      icon: '🧪',
      route: '/unit-test-tracker',
      available: true,
      color: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))',
    },
    {
      id: 'standup-note',
      title: 'Standup Note',
      description:
        'Manage daily standups, track employee work, project status, team reminders and timeline — powered by Excel.',
      icon: '📋',
      route: '/standup-note',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
    },
    {
      id: 'office-fun',
      title: 'Office Fun Activity',
      description:
        'Real-time SMS Pictionary game for the office! Show images, receive SMS answers, and crown a winner with a live leaderboard.',
      icon: '🎮',
      route: '/office-fun',
      available: true,
      color: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(245,158,11,0.2))',
    },
    {
      id: 'image-navigator',
      title: 'Image Navigator',
      description:
        'Navigate through images using Excel-driven data, select areas for OCR text extraction, and get voice descriptions.',
      icon: '🗺️',
      route: '/image-navigator',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
    },
    {
      id: 'life-tracker',
      title: 'Life Tracker',
      description:
        'Modern dashboard to track routines, expenses, diet, fitness, mental health, and future investments — all syncable with Excel.',
      icon: '🌱',
      route: '/life-tracker',
      available: true,
      color: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.2))',
    },
    {
      id: 'free-billing',
      title: 'Free Billing System',
      description:
        'Manage your products, customers, invoices, offline via an Excel-based database with a rich interactive dashboard.',
      icon: '💳',
      route: '/free-billing',
      available: true,
      color: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.2))',
    },
    {
      id: 'youtube-manager',
      title: 'YouTube Video Manager',
      description:
        'Offline Excel-driven YouTube manager with custom playlists, timed slice segments, and lyrics text editors.',
      icon: '▶️',
      route: '/youtube-manager',
      available: true,
      color: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2))',
    },
    {
      id: 'easy-documents',
      title: 'Easy Documents',
      description:
        'Transform Excel files into interactive, multilingual, multimedia-rich documentation with navigation and search.',
      icon: '📄',
      route: '/easy-documents',
      available: true,
      color: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
    },
    // {
    //   id: 'number-chess-battle',
    //   title: 'Number Chess Battle',
    //   description:
    //     'Strategic board game combining chess mechanics with mathematics. Move pieces, perform arithmetic attacks, and capture the enemy king to win!',
    //   icon: '♟️',
    //   route: '/real-life-steps/number-chess-battle',
    //   available: true,
    //   color: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.2))',
    // },
    {
      id: 'flip-book',
      title: 'Flip Book Viewer',
      description:
        'Create interactive animated flip books from an Excel template with automatic voice narration.',
      icon: '📖',
      route: '/flip-book',
      available: true,
      color: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(168,85,247,0.2))',
    },
  ];

  tools: Tool[];

  constructor() {
    this.tools = this.applyNavigationPreferences(
      this.navPreferencesService.order$.value,
      this.navPreferencesService.visibility$.value,
    );

    combineLatest([
      this.navPreferencesService.order$,
      this.navPreferencesService.visibility$,
    ]).subscribe(([order, visibility]) => {
      this.tools = this.applyNavigationPreferences(order, visibility);
    });

    this.homeCarouselService.slides$.subscribe(allSlides => {
      const active = allSlides.filter(s => s.isActive);
      if (active.length > 0) {
        this.activeSlides = active;
      } else {
        this.activeSlides = [{
          id: 'default-slide-1',
          bgImage: '',
          badgeText: '⚡ Multi-Purpose Toolkit',
          title: 'All Your <span class="gradient-text">Developer Tools</span><br />In One Place',
          description: 'Compare text, process images, create content, and more — powerful utilities designed for developers and creators.',
          primaryBtnText: 'Get Started',
          primaryBtnRoute: '/excel-mapper',
          secondaryBtnText: 'Explore Tools',
          secondaryBtnRoute: '#tools',
          statistics: [
            { number: '20+', label: 'Tools' },
            { number: 'Free', label: 'To Use' },
            { number: 'Fast', label: '& Secure' }
          ],
          displayOrder: 1,
          isActive: true
        }];
      }
      if (this.currentSlideIndex >= this.activeSlides.length) {
        this.currentSlideIndex = 0;
      }
      this.resetAutoplay();
    });
  }

  ngOnInit() {
    this.startAutoplay();
  }

  ngOnDestroy() {
    this.stopAutoplay();
  }

  startAutoplay() {
    this.stopAutoplay();
    if (this.activeSlides.length <= 1) return;

    const currentSlide = this.activeSlides[this.currentSlideIndex];
    const durationSec = currentSlide.duration || 6;

    if (typeof window !== 'undefined') {
      this.autoplayIntervalId = setTimeout(() => {
        this.nextSlide();
      }, durationSec * 1000);
    }
  }

  stopAutoplay() {
    if (this.autoplayIntervalId) {
      clearTimeout(this.autoplayIntervalId);
      this.autoplayIntervalId = null;
    }
  }

  resetAutoplay() {
    this.startAutoplay();
  }

  pauseAutoplay() {
    this.stopAutoplay();
  }

  resumeAutoplay() {
    this.startAutoplay();
  }

  nextSlide() {
    if (this.activeSlides.length <= 1) return;
    this.currentSlideIndex = (this.currentSlideIndex + 1) % this.activeSlides.length;
    this.startAutoplay();
  }

  prevSlide() {
    if (this.activeSlides.length <= 1) return;
    this.currentSlideIndex = (this.currentSlideIndex - 1 + this.activeSlides.length) % this.activeSlides.length;
    this.startAutoplay();
  }

  goToSlide(index: number) {
    this.currentSlideIndex = index;
    this.resetAutoplay();
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].clientX;
    this.handleSwipe();
  }

  private handleSwipe() {
    const swipeThreshold = 50;
    const deltaX = this.touchEndX - this.touchStartX;
    if (Math.abs(deltaX) > swipeThreshold) {
      if (deltaX > 0) {
        this.prevSlide();
      } else {
        this.nextSlide();
      }
      this.resetAutoplay();
    }
  }

  isPreload(idx: number): boolean {
    if (this.activeSlides.length <= 1) return false;
    const nextIdx = (this.currentSlideIndex + 1) % this.activeSlides.length;
    const prevIdx = (this.currentSlideIndex - 1 + this.activeSlides.length) % this.activeSlides.length;
    return idx === nextIdx || idx === prevIdx;
  }

  isExternalRoute(route: string): boolean {
    return !route || route.startsWith('http') || route.startsWith('#');
  }

  private applyNavigationPreferences(order: string[], visibility: Record<string, boolean>): Tool[] {
    return [...this.allTools]
      .sort((a, b) => this.compareToolOrder(a.id, b.id, order))
      .filter((tool) => !visibility[tool.id]);
  }

  private loadStoredOrder(): string[] {
    try {
      const stored = localStorage.getItem(this.orderKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private loadStoredVisibility(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(this.visibilityKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private compareToolOrder(idA: string, idB: string, storedOrder: string[]): number {
    const indexA = this.navIndex(idA, storedOrder);
    const indexB = this.navIndex(idB, storedOrder);
    return indexA - indexB;
  }

  private navIndex(id: string, storedOrder: string[]): number {
    const savedIndex = storedOrder.indexOf(id);
    if (savedIndex >= 0) {
      return savedIndex;
    }

    const defaultIndex = this.defaultToolOrder.indexOf(id);
    if (defaultIndex >= 0) {
      return defaultIndex;
    }

    const extras = this.allTools
      .map((tool) => tool.id)
      .filter((toolId) => !this.defaultToolOrder.includes(toolId));
    const extraIndex = extras.indexOf(id);
    return this.defaultToolOrder.length + (extraIndex >= 0 ? extraIndex : Number.MAX_SAFE_INTEGER);
  }
}

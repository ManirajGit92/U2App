import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="hero-content container">
        <span class="hero-badge">⚡ Multi-Purpose Toolkit</span>
        <h1 class="hero-title">
          All Your <span class="gradient-text">Developer Tools</span><br />
          In One Place
        </h1>
        <p class="hero-subtitle">
          Compare text, process images, create content, and more — powerful utilities
          designed for developers and creators.
        </p>
        <div class="hero-actions">
          <a routerLink="/compare" class="btn btn-primary btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18m-7-7l7 7 7-7"/></svg>
            Get Started
          </a>
          <a href="#tools" class="btn btn-secondary btn-lg">
            Explore Tools
          </a>
        </div>
        <div class="hero-stats">
          <div class="stat">
            <span class="stat-number">8+</span>
            <span class="stat-label">Tools</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-number">Free</span>
            <span class="stat-label">To Use</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <span class="stat-number">Fast</span>
            <span class="stat-label">& Secure</span>
          </div>
        </div>
      </div>
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
        <span class="footer-logo">⚡ U2 Tools</span>
        <span class="footer-copy">© 2026 U2 Tools. All rights reserved.</span>
      </div>
    </footer>
  `,
  styles: [`
    /* ───── Hero ───── */
    .hero {
      position: relative;
      padding: 100px 0 80px;
      overflow: hidden;
      min-height: 75vh;
      display: flex;
      align-items: center;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: var(--hero-gradient);
      opacity: 0.12;
      z-index: 0;
    }

    .hero-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 50%, rgba(99,102,241,0.15) 0%, transparent 60%),
                  radial-gradient(circle at 70% 80%, rgba(168,85,247,0.1) 0%, transparent 50%);
    }

    .hero-content {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 800px;
    }

    .hero-badge {
      display: inline-block;
      padding: 8px 20px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent-primary);
      background: var(--accent-surface);
      border: 1px solid var(--accent-primary);
      border-radius: 50px;
      margin-bottom: 28px;
      animation: fadeInUp 0.5s ease-out;
    }

    .hero-title {
      font-size: 3.5rem;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -1.5px;
      margin-bottom: 24px;
      animation: fadeInUp 0.5s ease-out 0.1s both;
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
      margin: 0 auto 36px;
      line-height: 1.7;
      animation: fadeInUp 0.5s ease-out 0.2s both;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 56px;
      animation: fadeInUp 0.5s ease-out 0.3s both;
    }

    .hero-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
      animation: fadeInUp 0.5s ease-out 0.4s both;
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

    /* ───── Tools Section ───── */
    .tools-section {
      padding: 80px 24px 100px;
    }

    .section-header {
      text-align: center;
      margin-bottom: 56px;
    }

    .section-title {
      font-size: 2.2rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
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
      padding: 32px 28px;
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
      padding: 32px 0;
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
        padding: 60px 0;
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
  `],
})
export class HomeComponent {
  tools: Tool[] = [
    {
      id: 'compare',
      title: 'Text / JSON Compare',
      description: 'Compare text or JSON side by side with highlighted differences, match percentage, and mismatch extraction.',
      icon: '🔍',
      route: '/compare',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
    },
    {
      id: 'html-viewer',
      title: 'HTML Viewer',
      description: 'Preview and render HTML code instantly with live editing and responsive viewport testing.',
      icon: '🌐',
      route: '/html-viewer',
      available: true,
      color: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(14,165,233,0.2))',
    },
    {
      id: 'bg-remover',
      title: 'Image BG Remover',
      description: 'Remove image backgrounds automatically with AI-powered edge detection.',
      icon: '🖼️',
      route: null,
      available: false,
      color: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(244,63,94,0.2))',
    },
    {
      id: 'excel-viewer',
      title: 'Excel to Web Viewer',
      description: 'Upload Excel or CSV files and view them as beautifully formatted interactive web tables.',
      icon: '📊',
      route: null,
      available: false,
      color: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.2))',
    },
    {
      id: 'broadcast-creator',
      title: 'Broadcast Creator',
      description: 'Transform your content into polished broadcast-ready messages for email, social, and newsletters.',
      icon: '📡',
      route: null,
      available: false,
      color: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))',
    },
    {
      id: 'video-creator',
      title: 'Content to Video',
      description: 'Convert text, articles, or scripts into engaging video presentations with AI.',
      icon: '🎬',
      route: '/content-video',
      available: true,
      color: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(192,132,252,0.2))',
    },
    {
      id: 'text-to-image',
      title: 'Text to Image',
      description: 'Generate stunning images from text prompts using state-of-the-art AI models.',
      icon: '🎨',
      route: null,
      available: false,
      color: 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(251,113,133,0.2))',
    },
    {
      id: 'mind-mapper',
      title: 'Mind Mapper',
      description: 'Transform your content into visual mind maps for brainstorming and organizing ideas.',
      icon: '🧠',
      route: null,
      available: false,
      color: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(56,189,248,0.2))',
    },
    {
      id: 'work-tracker',
      title: 'Work Tracker',
      description: 'Track developer statuses, monitor product release tracking, and manage data via local Excel sheets.',
      icon: '📈',
      route: '/work-tracker',
      available: true,
      color: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(52,211,153,0.2))',
    },
    {
      id: 'estimator',
      title: 'Estimater App',
      description: 'Automatically estimate project effort with formula-based inputs, feature breakdowns, and Excel report generation.',
      icon: '⏱️',
      route: '/estimator',
      available: true,
      color: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(244,63,94,0.2))',
    },
    {
      id: 'real-life-steps',
      title: 'Real Life Steps Game',
      description: 'Play a live multiplayer board game with 100 configured positive/negative life events, tokens, investing and robust dice rolling.',
      icon: '🎲',
      route: '/real-life-steps',
      available: true,
      color: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
    },
    {
      id: 'controls-to-excel',
      title: 'Controls to Excel',
      description: 'Upload Excel files, dynamically generate form controls, search globally, alter cell data, and instantly visualize it into powerful dynamic charts.',
      icon: '🗂️',
      route: '/controls-to-excel',
      available: true,
      color: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(56,189,248,0.2))',
    },
    {
      id: 'unit-test-tracker',
      title: 'Unit Test Tracker',
      description: 'Excel-driven test tracking system with full CRUD, execution logging, and bug management.',
      icon: '🧪',
      route: '/unit-test-tracker',
      available: true,
      color: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2))',
    },
  ];
}

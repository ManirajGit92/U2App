import { AiGeneratedSlide, SlideVisualStyle } from './flip-book-ai.models';

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'textarea',
  'select',
  'button',
  'link',
  'meta',
  'base',
  'noscript',
  'template',
  'foreignobject',
]);

const DANGEROUS_CSS_PATTERNS = [
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /@import/gi,
  /behavior\s*:/gi,
  /-moz-binding\s*:/gi,
  /url\s*\(\s*['"]?\s*data\s*:\s*text\/html/gi,
];

/**
 * Validates that an image URL uses an allowed safe protocol (https, http, or data:image).
 */
export function sanitizeImageUrl(url: string | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) {
    return trimmed;
  }

  if (
    /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);(base64|charset=utf-8|utf8),/i.test(trimmed)
  ) {
    return trimmed;
  }

  return '';
}

/**
 * Sanitizes inline CSS style strings so safe typography, colors, backgrounds,
 * and flexbox/grid layouts are preserved while blocking scriptable CSS expressions.
 */
function sanitizeInlineStyle(styleValue: string): string {
  let cleaned = styleValue;
  for (const pattern of DANGEROUS_CSS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

/**
 * Sanitizes a URL used in href/src attributes inside slide HTML.
 */
function isSafeUrl(url: string, allowRelativeHash: boolean): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (allowRelativeHash && trimmed.startsWith('#')) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);(base64|charset=utf-8|utf8),/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Sanitizes AI-generated HTML using the browser's DOMParser.
 * Removes scripts, event handlers, embeds, forms, and unsafe URLs while preserving
 * rich presentation markup and safe inline styles.
 */
export function sanitizeSlideHtml(rawHtml: string | undefined): string {
  if (!rawHtml || !rawHtml.trim()) return '';

  if (typeof DOMParser === 'undefined') {
    return rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Element) => {
    const children = Array.from(node.children);
    for (const child of children) {
      const tagName = child.tagName.toLowerCase();
      if (FORBIDDEN_TAGS.has(tagName)) {
        child.remove();
        continue;
      }

      const attrs = Array.from(child.attributes);
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        // Strip all inline event handlers and srcdoc
        if (name.startsWith('on') || name === 'srcdoc') {
          child.removeAttribute(attr.name);
          continue;
        }

        if (name === 'style') {
          const safeStyle = sanitizeInlineStyle(value);
          if (safeStyle) {
            child.setAttribute('style', safeStyle);
          } else {
            child.removeAttribute('style');
          }
          continue;
        }

        if (name === 'href' || name === 'xlink:href') {
          if (!isSafeUrl(value, true)) {
            child.removeAttribute(attr.name);
          } else if (tagName === 'a') {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          }
          continue;
        }

        if (name === 'src') {
          if (!isSafeUrl(value, false)) {
            child.removeAttribute(attr.name);
          }
        }
      }

      walk(child);
    }
  };

  walk(root);
  return root.innerHTML.trim();
}

/**
 * Escapes plain text for safe HTML interpolation.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds structured, visually polished HTML from a slide's fields when
 * the user edits structured fields or when AI output omits htmlContent.
 */
export function buildSlideHtmlFromFields(slide: {
  title: string;
  subtitle?: string;
  summary?: string;
  bulletPoints: string[];
  keyTakeaway?: string;
  style: SlideVisualStyle;
}): string {
  const s = slide.style;
  const bulletsHtml =
    slide.bulletPoints.length > 0
      ? `<ul style="margin: 14px 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: ${escapeHtml(s.bodyFontSize)}; line-height: 1.55;">
          ${slide.bulletPoints
            .map(
              (pt) =>
                `<li style="margin: 0;"><span style="color: ${escapeHtml(s.textColor)};">${escapeHtml(pt)}</span></li>`,
            )
            .join('')}
        </ul>`
      : '';

  const subtitleHtml = slide.subtitle
    ? `<p style="margin: 0 0 10px 0; font-size: 0.92rem; font-weight: 600; color: ${escapeHtml(s.accentColor)}; letter-spacing: 0.02em;">${escapeHtml(slide.subtitle)}</p>`
    : '';

  const summaryHtml = slide.summary
    ? `<p style="margin: 0 0 12px 0; font-size: ${escapeHtml(s.bodyFontSize)}; line-height: 1.6; opacity: 0.92;">${escapeHtml(slide.summary)}</p>`
    : '';

  const takeawayHtml = slide.keyTakeaway
    ? `<div style="margin-top: 14px; padding: 10px 14px; border-left: 4px solid ${escapeHtml(s.accentColor)}; background: rgba(99, 102, 241, 0.1); border-radius: 8px; font-size: 0.88rem; font-weight: 600;">
        <span style="color: ${escapeHtml(s.accentColor)};">Key Takeaway:</span> ${escapeHtml(slide.keyTakeaway)}
      </div>`
    : '';

  return `<div class="ai-slide-card" style="font-family: ${escapeHtml(s.fontFamily)}; color: ${escapeHtml(s.textColor)}; background: ${escapeHtml(s.background)}; padding: 20px 22px; border-radius: 14px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;">
  ${subtitleHtml}
  <h2 style="margin: 0 0 12px 0; font-size: ${escapeHtml(s.titleFontSize)}; font-weight: 800; line-height: 1.25; color: ${escapeHtml(s.textColor)};">${escapeHtml(slide.title)}</h2>
  ${summaryHtml}
  ${bulletsHtml}
  ${takeawayHtml}
</div>`;
}

/**
 * Ensures the slide HTML is sanitized and wrapped with its visual typography/background container
 * so Flipbook renders it faithfully with consistent fonts, colors, and readability.
 */
export function buildFinalSanitizedSlideHtml(slide: AiGeneratedSlide): string {
  const raw = slide.htmlContent?.trim()
    ? slide.htmlContent
    : buildSlideHtmlFromFields(slide);
  const sanitized = sanitizeSlideHtml(raw);
  if (!sanitized) return '';

  // If the HTML already includes our styled wrapper or a root container with background, return sanitized directly
  if (sanitized.includes('ai-slide-card')) {
    return sanitized;
  }

  const s = slide.style;
  return sanitizeSlideHtml(
    `<div class="ai-slide-card" style="font-family: ${escapeHtml(s.fontFamily)}; color: ${escapeHtml(s.textColor)}; background: ${escapeHtml(s.background)}; padding: 18px 20px; border-radius: 14px; min-height: 100%; box-sizing: border-box;">${sanitized}</div>`,
  );
}

/**
 * Generates a crisp, reliable inline SVG illustration data URI as a fallback
 * when an external image URL fails to load or is unavailable.
 */
export function buildFallbackSlideIllustration(
  title: string,
  accentColor: string = '#6366f1',
  slideIndex: number = 0,
): string {
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : '#6366f1';
  const palettes = [
    ['#6366f1', '#8b5cf6', '#eef2ff'],
    ['#0ea5e9', '#6366f1', '#e0f2fe'],
    ['#10b981', '#0ea5e9', '#d1fae5'],
    ['#f59e0b', '#ef4444', '#fef3c7'],
    ['#8b5cf6', '#ec4899', '#f3e8ff'],
  ];
  const [c1, c2, bg] = palettes[slideIndex % palettes.length];
  const primary = safeAccent || c1;
  const label = (title || 'Presentation Slide').slice(0, 34);
  const escapedLabel = escapeHtml(label);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
      <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="640" height="420" rx="24" fill="url(#g1)"/>
    <circle cx="520" cy="95" r="88" fill="${primary}" opacity="0.14"/>
    <circle cx="110" cy="340" r="110" fill="${c2}" opacity="0.12"/>
    <rect x="76" y="74" width="488" height="272" rx="20" fill="#ffffff" stroke="${primary}" stroke-opacity="0.22" stroke-width="2"/>
    <rect x="108" y="108" width="140" height="16" rx="8" fill="url(#g2)"/>
    <rect x="108" y="142" width="260" height="12" rx="6" fill="#cbd5e1"/>
    <rect x="108" y="166" width="220" height="12" rx="6" fill="#e2e8f0"/>
    <rect x="108" y="204" width="136" height="104" rx="14" fill="${bg}"/>
    <rect x="262" y="204" width="136" height="104" rx="14" fill="${bg}"/>
    <rect x="416" y="128" width="116" height="180" rx="16" fill="url(#g2)" opacity="0.9"/>
    <circle cx="474" cy="186" r="28" fill="#ffffff" opacity="0.28"/>
    <rect x="442" y="232" width="64" height="10" rx="5" fill="#ffffff" opacity="0.85"/>
    <rect x="450" y="252" width="48" height="8" rx="4" fill="#ffffff" opacity="0.6"/>
    <text x="108" y="330" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="${primary}">${escapedLabel}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

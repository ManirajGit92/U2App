import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import {
  AiAssistantService,
  AiConfig,
  AiModel,
  AiProvider,
} from '../../standup-note/ai-assistant/ai-assistant.service';
import {
  AiGeneratedDeck,
  AiGeneratedSlide,
  FlipBookChatMessage,
  FlipBookChatSession,
  FlipBookSlidePage,
  SlideVisualStyle,
} from './flip-book-ai.models';
import {
  buildFallbackSlideIllustration,
  buildFinalSanitizedSlideHtml,
  buildSlideHtmlFromFields,
  sanitizeImageUrl,
  sanitizeSlideHtml,
} from './slide-html-sanitizer';

const STORAGE_PREFIX = 'u2app.flipBookAiAssistant';

const CURATED_TOPIC_IMAGES: Array<{ keywords: RegExp; urls: string[] }> = [
  {
    keywords: /ai|artificial intelligence|machine learning|robot|education|tech|future|data/i,
    urls: [
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    keywords: /business|marketing|strategy|startup|finance|sales|growth|product/i,
    urls: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    keywords: /code|python|programming|software|developer|angular|cloud|devops|web/i,
    urls: [
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?auto=format&fit=crop&w=900&q=80',
    ],
  },
  {
    keywords: /green|sustainab|energy|climate|nature|environment|health|medical/i,
    urls: [
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=900&q=80',
    ],
  },
];

const DEFAULT_SLIDE_STYLE: SlideVisualStyle = {
  fontFamily: "'Inter', 'Poppins', sans-serif",
  titleFontSize: '1.55rem',
  bodyFontSize: '0.95rem',
  textColor: '#1e1b4b',
  accentColor: '#6366f1',
  background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
};

export const FLIPBOOK_AI_SYSTEM_INSTRUCTIONS = `You are an expert Presentation & Flipbook Slide Designer AI integrated into U2Tools Flipbook.
Your job is to create visually attractive, well-structured, readable, presentation-ready slides based on the user's topic, slide count, and style preferences.

CRITICAL RULES:
1. Respond ONLY with a valid, parseable JSON object (no markdown prose outside JSON, no trailing commas).
2. Honor the EXACT slide count requested by the user. If the user does not specify a count, generate 5 slides.
3. Choose cohesive, professional typography (Inter, Poppins, Montserrat, or Playfair Display), harmonious color palettes, readable contrast, and clean layouts.
4. Vary layouts naturally across slides using:
   - "full-html": for title slides, metric grids, timelines, comparison cards, or rich structured layouts
   - "split-html-image": for content slides paired with a relevant visual image
   - "full-image": only when the user specifically asks for a full-bleed image slide
5. For every slide, provide:
   - Clear "title" and optional "subtitle"
   - Concise "summary" and 3-5 impactful "bulletPoints"
   - Optional "keyTakeaway"
   - Rich, self-contained "htmlContent" with clean inline CSS (cards, badges, typography, bullet lists, grids). NEVER include <script>, <iframe>, <style> tags, or inline event handlers.
   - "voiceOver": a natural 1-3 sentence spoken narration script suitable for Text-to-Speech when the slide is displayed.
   - "imageUrl": when layout is "split-html-image" or "full-image", provide a real, relevant Unsplash image URL (https://images.unsplash.com/photo-...?auto=format&fit=crop&w=900&q=80) or leave empty if not needed.
6. If an existing draft presentation JSON is included in the user message, modify ONLY what the user asked to change while keeping the rest consistent, and return the complete updated JSON.

REQUIRED JSON SCHEMA:
{
  "assistantMessage": "Friendly 1-2 sentence reply confirming what was created or updated.",
  "deckTitle": "Presentation Title",
  "topic": "Core Topic",
  "themeStyle": "Modern Indigo",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "subtitle": "Optional concise subtitle or tag",
      "layout": "split-html-image",
      "summary": "1-2 sentence overview of the slide.",
      "bulletPoints": [
        "Clear, impactful point 1",
        "Clear, impactful point 2",
        "Clear, impactful point 3"
      ],
      "keyTakeaway": "Short memorable takeaway.",
      "htmlContent": "<div class=\\"ai-slide-card\\" style=\\"font-family:'Inter',sans-serif;color:#1e1b4b;background:linear-gradient(135deg,#f8faff,#eef2ff);padding:20px;border-radius:14px;\\">...</div>",
      "imageUrl": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=900&q=80",
      "imagePrompt": "Short description of the visual for this slide",
      "voiceOver": "Natural spoken narration for this slide.",
      "style": {
        "fontFamily": "'Inter', sans-serif",
        "titleFontSize": "1.55rem",
        "bodyFontSize": "0.95rem",
        "textColor": "#1e1b4b",
        "accentColor": "#6366f1",
        "background": "linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)"
      }
    }
  ]
}`;

const SINGLE_SLIDE_SYSTEM_INSTRUCTIONS = `You are an expert Presentation & Flipbook Slide Designer AI inside U2Tools Flipbook.
Regenerate ONLY ONE presentation slide based on the presentation context and user instructions.
Respond ONLY with a valid JSON object for the single slide matching:
{
  "title": "Slide Title",
  "subtitle": "Optional subtitle",
  "layout": "full-html | split-html-image | full-image",
  "summary": "Brief overview",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"],
  "keyTakeaway": "Key takeaway",
  "htmlContent": "<div class=\\"ai-slide-card\\" style=\\"...\\">...</div>",
  "imageUrl": "https://images.unsplash.com/...",
  "imagePrompt": "Visual description",
  "voiceOver": "Spoken narration for this slide",
  "style": {
    "fontFamily": "'Inter', sans-serif",
    "titleFontSize": "1.55rem",
    "bodyFontSize": "0.95rem",
    "textColor": "#1e1b4b",
    "accentColor": "#6366f1",
    "background": "linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)"
  }
}
Never include <script>, <iframe>, <style> tags, or inline event handlers.`;

@Injectable({ providedIn: 'root' })
export class FlipBookAiService {
  private readonly sharedAi = inject(AiAssistantService);
  private readonly authService = inject(FirebaseAuthService);

  private readonly sessionsSubject = new BehaviorSubject<FlipBookChatSession[]>(this.loadSessions());
  readonly sessions$ = this.sessionsSubject.asObservable();

  readonly isProcessing = signal(false);
  readonly error = signal<string | null>(null);

  private readonly _activeSessionId = signal<string | null>(null);
  readonly activeSessionId = this._activeSessionId.asReadonly();

  get config() {
    return this.sharedAi.config;
  }

  get sessions(): FlipBookChatSession[] {
    return this.sessionsSubject.value;
  }

  get activeSession(): FlipBookChatSession | null {
    const id = this._activeSessionId();
    return id ? this.sessions.find((s) => s.id === id) ?? null : null;
  }

  private get storageKey(): string {
    const uid = this.authService.user()?.uid;
    return uid ? `${STORAGE_PREFIX}.${uid}` : STORAGE_PREFIX;
  }

  updateSharedConfig(cfg: Partial<AiConfig>): void {
    this.sharedAi.updateConfig(cfg);
  }

  setModelAndProvider(model: AiModel, provider: AiProvider): void {
    this.sharedAi.updateConfig({ model, provider });
  }

  getSessionTotalTokens(session: FlipBookChatSession | null): number {
    if (!session) return 0;
    if (typeof session.totalTokens === 'number' && session.totalTokens > 0) {
      return session.totalTokens;
    }
    return session.messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  }

  createNewSession(): FlipBookChatSession {
    const id = `fb-chat-${Date.now()}`;
    const now = new Date().toISOString();
    const session: FlipBookChatSession = {
      id,
      title: 'New Presentation Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
      pinned: false,
      totalTokens: 0,
    };
    this.sessionsSubject.next([session, ...this.sessions]);
    this._activeSessionId.set(id);
    this.persistSessions();
    return session;
  }

  setActiveSession(id: string): void {
    this._activeSessionId.set(id);
  }

  togglePin(id: string): void {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)),
    );
    this.persistSessions();
  }

  renameSession(id: string, title: string): void {
    const clean = title.trim();
    if (!clean) return;
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === id ? { ...s, title: clean } : s)),
    );
    this.persistSessions();
  }

  deleteSession(id: string): void {
    const remaining = this.sessions.filter((s) => s.id !== id);
    this.sessionsSubject.next(remaining);
    if (this._activeSessionId() === id) {
      this._activeSessionId.set(remaining[0]?.id ?? null);
    }
    this.persistSessions();
  }

  clearAllSessions(): void {
    const id = `fb-chat-${Date.now()}`;
    const now = new Date().toISOString();
    const fresh: FlipBookChatSession = {
      id,
      title: 'New Presentation Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
      pinned: false,
      totalTokens: 0,
    };
    this.sessionsSubject.next([fresh]);
    this._activeSessionId.set(id);
    this.persistSessions();
  }

  searchSessions(query: string): FlipBookChatSession[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.sessions;
    return this.sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }

  /**
   * Sends a user prompt to generate a new presentation deck or refine the current draft deck.
   */
  async sendPrompt(
    userPrompt: string,
    attachment?: { fileName: string; content: string },
    forceFresh: boolean = false,
  ): Promise<void> {
    let session = this.activeSession;
    if (!session) {
      session = this.createNewSession();
    }

    const trimmedPrompt = userPrompt.trim();
    if (!trimmedPrompt && !attachment) return;

    const requestedCount = this.extractRequestedSlideCount(trimmedPrompt);
    const existingDeck = !forceFresh ? session.draftDeck : undefined;

    const userMsg: FlipBookChatMessage = {
      id: `fb-msg-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt || `Create slides from ${attachment?.fileName}`,
      timestamp: new Date().toISOString(),
      attachmentName: attachment?.fileName,
    };

    this.addMessage(session.id, userMsg);
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const historyExcludingLatest = (
        this.sessions.find((s) => s.id === session!.id)?.messages.slice(0, -1) ?? []
      )
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const promptParts: string[] = [];
      if (attachment?.content) {
        const clipped = attachment.content.slice(0, 12000);
        promptParts.push(`[Attached Reference Material: ${attachment.fileName}]\n${clipped}`);
      }
      if (existingDeck && existingDeck.slides.length > 0) {
        promptParts.push(
          `Current Draft Presentation JSON:\n${JSON.stringify({
            deckTitle: existingDeck.deckTitle,
            topic: existingDeck.topic,
            themeStyle: existingDeck.themeStyle,
            slides: existingDeck.slides.map((sl) => ({
              slideNumber: sl.slideNumber,
              title: sl.title,
              subtitle: sl.subtitle,
              layout: sl.layout,
              summary: sl.summary,
              bulletPoints: sl.bulletPoints,
              keyTakeaway: sl.keyTakeaway,
              imageUrl: sl.imageUrl,
              voiceOver: sl.voiceOver,
              style: sl.style,
            })),
          })}`,
        );
      }
      promptParts.push(`User Request: ${trimmedPrompt}`);
      if (requestedCount !== null) {
        promptParts.push(
          `STRICT REQUIREMENT: You MUST return EXACTLY ${requestedCount} slides in the "slides" array.`,
        );
      }

      const aiResult = await this.sharedAi.invokeCompletion(
        promptParts.join('\n\n'),
        historyExcludingLatest,
        FLIPBOOK_AI_SYSTEM_INSTRUCTIONS,
      );

      this.updateMessageTokens(
        session.id,
        userMsg.id,
        aiResult.promptTokens,
        aiResult.promptTokens === undefined,
      );

      const { assistantMessage, deck } = this.parseDeckResponse(
        aiResult.text,
        trimmedPrompt,
        requestedCount,
      );

      const assistantMsg: FlipBookChatMessage = {
        id: `fb-msg-${Date.now() + 1}`,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        tokens: aiResult.completionTokens,
        tokensUnavailable: aiResult.completionTokens === undefined,
        slideCount: deck.slides.length,
      };

      this.addMessage(session.id, assistantMsg);
      this.setSessionDraftDeck(session.id, deck);

      const latest = this.sessions.find((s) => s.id === session!.id);
      if (latest && (latest.title === 'New Presentation Chat' || latest.title === 'New Chat')) {
        const title = (deck.deckTitle || trimmedPrompt).slice(0, 46);
        this.renameSession(session.id, title);
      }
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error
          ? err.message
          : 'Failed to generate slides. Please check your AI configuration and try again.';
      this.error.set(errMessage);
      const errMsg: FlipBookChatMessage = {
        id: `fb-msg-err-${Date.now()}`,
        role: 'assistant',
        content: `I couldn't generate the slides right now: ${errMessage}`,
        timestamp: new Date().toISOString(),
        tokensUnavailable: true,
      };
      this.addMessage(session.id, errMsg);
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Regenerates the entire presentation from the active session's original prompt.
   */
  async regenerateAllSlides(): Promise<void> {
    const session = this.activeSession;
    if (!session?.draftDeck) return;
    const basePrompt =
      session.draftDeck.sourcePrompt ||
      `Create ${session.draftDeck.slides.length} slides on "${session.draftDeck.deckTitle}"`;
    await this.sendPrompt(
      `Regenerate the entire presentation with a fresh, engaging design: ${basePrompt}`,
      undefined,
      true,
    );
  }

  /**
   * Regenerates a single slide while keeping all other slides in the draft intact.
   */
  async regenerateSingleSlide(slideIndex: number, customInstruction?: string): Promise<void> {
    const session = this.activeSession;
    if (!session?.draftDeck) return;
    const targetSlide = session.draftDeck.slides[slideIndex];
    if (!targetSlide) return;

    this.setSlideRegenerating(session.id, slideIndex, true);
    this.error.set(null);

    try {
      const prompt = [
        `Presentation Title: "${session.draftDeck.deckTitle}"`,
        `Topic: "${session.draftDeck.topic}"`,
        `Total Slides: ${session.draftDeck.slides.length}`,
        `Target Slide Position: Slide ${slideIndex + 1} of ${session.draftDeck.slides.length}`,
        `Current Slide Title: "${targetSlide.title}"`,
        `Current Slide Layout: "${targetSlide.layout}"`,
        `Current Style Palette: ${JSON.stringify(targetSlide.style)}`,
        customInstruction
          ? `User Modification Request: ${customInstruction}`
          : 'Regenerate this slide with improved visual layout, fresh wording, strong bullet points, relevant image, and natural voiceover while matching the deck theme.',
      ].join('\n');

      const aiResult = await this.sharedAi.invokeCompletion(
        prompt,
        [],
        SINGLE_SLIDE_SYSTEM_INSTRUCTIONS,
      );

      const regenerated = this.parseSingleSlideResponse(
        aiResult.text,
        slideIndex,
        session.draftDeck.topic,
        targetSlide.style,
      );

      const updatedSlides = [...session.draftDeck.slides];
      updatedSlides[slideIndex] = {
        ...regenerated,
        id: targetSlide.id,
        slideNumber: slideIndex + 1,
        isRegenerating: false,
      };

      this.setSessionDraftDeck(session.id, {
        ...session.draftDeck,
        slides: updatedSlides,
      });
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : 'Failed to regenerate this slide. Please try again.';
      this.error.set(errMessage);
      this.setSlideRegenerating(session.id, slideIndex, false);
    }
  }

  updateSlide(slideIndex: number, updated: AiGeneratedSlide): void {
    const session = this.activeSession;
    if (!session?.draftDeck) return;
    const slides = [...session.draftDeck.slides];
    if (!slides[slideIndex]) return;
    slides[slideIndex] = {
      ...updated,
      slideNumber: slideIndex + 1,
      htmlContent: sanitizeSlideHtml(updated.htmlContent),
      imageUrl: sanitizeImageUrl(updated.imageUrl),
    };
    this.setSessionDraftDeck(session.id, { ...session.draftDeck, slides });
  }

  deleteSlide(slideIndex: number): void {
    const session = this.activeSession;
    if (!session?.draftDeck || session.draftDeck.slides.length <= 1) return;
    const slides = session.draftDeck.slides
      .filter((_, idx) => idx !== slideIndex)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    this.setSessionDraftDeck(session.id, { ...session.draftDeck, slides });
  }

  discardDraft(): void {
    const session = this.activeSession;
    if (!session) return;
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === session.id ? { ...s, draftDeck: undefined } : s)),
    );
    this.persistSessions();
  }

  /**
   * Converts approved AI slides into Flipbook PageContent objects with sanitized HTML,
   * validated image URLs, and voiceOver scripts.
   */
  convertDeckToFlipBookPages(deck: AiGeneratedDeck, startingSno: number): FlipBookSlidePage[] {
    return deck.slides.map((slide, idx) => {
      const safeImage = sanitizeImageUrl(slide.imageUrl);
      const safeHtml = buildFinalSanitizedSlideHtml(slide);
      let layout = slide.layout;

      if (layout === 'full-image' && !safeImage) {
        layout = 'full-html';
      } else if (layout === 'split-html-image' && !safeImage) {
        layout = 'full-html';
      }

      return {
        sno: startingSno + idx,
        title: slide.title || `Slide ${idx + 1}`,
        layout,
        htmlContent: layout === 'full-image' ? '' : safeHtml,
        imageUrl: layout.includes('image') ? safeImage : '',
        iframeUrl: '',
        voiceOver:
          slide.voiceOver?.trim() ||
          `${slide.title}. ${slide.summary || slide.bulletPoints.join('. ')}`.trim(),
      };
    });
  }

  // ── Parsing & Normalization ────────────────────────────────────────────────

  extractRequestedSlideCount(prompt: string): number | null {
    const match = prompt.match(/\b(\d{1,2})\s*(?:-|\s)?(?:slides?|pages?|cards?)\b/i);
    if (!match) return null;
    const count = Number(match[1]);
    if (!Number.isFinite(count) || count < 1) return null;
    return Math.min(20, Math.max(1, count));
  }

  private parseDeckResponse(
    rawText: string,
    sourcePrompt: string,
    requestedCount: number | null,
  ): { assistantMessage: string; deck: AiGeneratedDeck } {
    const parsedObj = this.extractJsonObject(rawText);
    const rawSlides = Array.isArray(parsedObj?.['slides'])
      ? (parsedObj['slides'] as Record<string, unknown>[])
      : [];

    if (rawSlides.length === 0) {
      throw new Error(
        'The AI response did not include structured slides. Try specifying your topic and slide count clearly.',
      );
    }

    const deckTitle = String(parsedObj['deckTitle'] || parsedObj['title'] || 'AI Presentation').trim();
    const topic = String(parsedObj['topic'] || deckTitle).trim();
    const themeStyle = String(parsedObj['themeStyle'] || 'Modern Professional').trim();

    let slides: AiGeneratedSlide[] = rawSlides.map((raw, idx) =>
      this.normalizeSlide(raw, idx, topic),
    );

    // Respect exact requested slide count if AI over-generated
    if (requestedCount !== null && slides.length > requestedCount) {
      slides = slides.slice(0, requestedCount);
    }

    // Re-number cleanly
    slides = slides.map((s, idx) => ({ ...s, slideNumber: idx + 1 }));

    const assistantMessage = String(
      parsedObj['assistantMessage'] ||
        parsedObj['summary'] ||
        `Created ${slides.length} presentation slides on "${deckTitle}". Review the preview below, edit or regenerate any slide, and click "Accept & Add to Flipbook" when ready.`,
    ).trim();

    return {
      assistantMessage,
      deck: {
        deckTitle,
        topic,
        themeStyle,
        slides,
        generatedAt: new Date().toISOString(),
        sourcePrompt,
      },
    };
  }

  private parseSingleSlideResponse(
    rawText: string,
    slideIndex: number,
    topic: string,
    fallbackStyle: SlideVisualStyle,
  ): AiGeneratedSlide {
    const parsedObj = this.extractJsonObject(rawText);
    const slideSource =
      Array.isArray(parsedObj['slides']) && parsedObj['slides'].length > 0
        ? (parsedObj['slides'][0] as Record<string, unknown>)
        : parsedObj;
    return this.normalizeSlide(slideSource, slideIndex, topic, fallbackStyle);
  }

  private normalizeSlide(
    raw: Record<string, unknown>,
    idx: number,
    topic: string,
    fallbackStyle: SlideVisualStyle = DEFAULT_SLIDE_STYLE,
  ): AiGeneratedSlide {
    const rawStyle = (raw['style'] as Record<string, unknown> | undefined) ?? {};
    const style: SlideVisualStyle = {
      fontFamily: String(rawStyle['fontFamily'] || fallbackStyle.fontFamily),
      titleFontSize: String(rawStyle['titleFontSize'] || fallbackStyle.titleFontSize),
      bodyFontSize: String(rawStyle['bodyFontSize'] || fallbackStyle.bodyFontSize),
      textColor: String(rawStyle['textColor'] || fallbackStyle.textColor),
      accentColor: String(rawStyle['accentColor'] || fallbackStyle.accentColor),
      background: String(rawStyle['background'] || fallbackStyle.background),
    };

    const title = String(raw['title'] || `Slide ${idx + 1}`).trim();
    const subtitle = raw['subtitle'] ? String(raw['subtitle']).trim() : '';
    const summary = raw['summary'] ? String(raw['summary']).trim() : '';
    const keyTakeaway = raw['keyTakeaway'] ? String(raw['keyTakeaway']).trim() : '';
    const bulletPoints = Array.isArray(raw['bulletPoints'])
      ? raw['bulletPoints'].map((b) => String(b).trim()).filter(Boolean)
      : [];

    const rawLayout = String(raw['layout'] || 'full-html').trim();
    let layout: AiGeneratedSlide['layout'] =
      rawLayout === 'split-html-image' || rawLayout === 'full-image' || rawLayout === 'full-html'
        ? rawLayout
        : 'full-html';

    let imageUrl = sanitizeImageUrl(typeof raw['imageUrl'] === 'string' ? raw['imageUrl'] : '');
    if (layout.includes('image') && !imageUrl) {
      imageUrl = this.pickTopicImageUrl(topic, title, idx, style.accentColor);
    }

    const rawHtml = typeof raw['htmlContent'] === 'string' ? raw['htmlContent'] : '';
    let htmlContent = sanitizeSlideHtml(rawHtml);
    if (!htmlContent && layout !== 'full-image') {
      htmlContent = sanitizeSlideHtml(
        buildSlideHtmlFromFields({ title, subtitle, summary, bulletPoints, keyTakeaway, style }),
      );
    }

    const voiceOver = String(
      raw['voiceOver'] ||
        `${title}. ${summary || bulletPoints.slice(0, 3).join('. ')}`.trim(),
    ).trim();

    return {
      id: `ai-slide-${Date.now()}-${idx + 1}`,
      slideNumber: idx + 1,
      title,
      subtitle,
      layout,
      summary,
      bulletPoints,
      keyTakeaway,
      htmlContent,
      imageUrl,
      imagePrompt: raw['imagePrompt'] ? String(raw['imagePrompt']).trim() : '',
      voiceOver,
      style,
    };
  }

  private pickTopicImageUrl(
    topic: string,
    title: string,
    idx: number,
    accentColor: string,
  ): string {
    const combined = `${topic} ${title}`;
    for (const group of CURATED_TOPIC_IMAGES) {
      if (group.keywords.test(combined)) {
        return group.urls[idx % group.urls.length];
      }
    }
    return buildFallbackSlideIllustration(title, accentColor, idx);
  }

  private extractJsonObject(rawText: string): Record<string, unknown> {
    let clean = rawText.trim();
    const fencedJson = clean.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fencedJson?.[1]) {
      clean = fencedJson[1].trim();
    } else {
      const fenced = clean.match(/```\s*([\s\S]*?)\s*```/);
      if (fenced?.[1]) {
        clean = fenced[1].trim();
      }
    }

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(clean) as Record<string, unknown>;
    } catch {
      throw new Error('Could not parse structured slides from AI response. Please try again.');
    }
  }

  // ── Session State Helpers ──────────────────────────────────────────────────

  private addMessage(sessionId: string, msg: FlipBookChatMessage): void {
    const now = new Date().toISOString();
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, msg];
        const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
        return { ...s, messages, updatedAt: now, totalTokens };
      }),
    );
    this.persistSessions();
  }

  private updateMessageTokens(
    sessionId: string,
    msgId: string,
    tokens: number | undefined,
    tokensUnavailable: boolean,
  ): void {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = s.messages.map((m) =>
          m.id === msgId ? { ...m, tokens, tokensUnavailable } : m,
        );
        const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
        return { ...s, messages, totalTokens };
      }),
    );
    this.persistSessions();
  }

  private setSessionDraftDeck(sessionId: string, deck: AiGeneratedDeck): void {
    const now = new Date().toISOString();
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === sessionId ? { ...s, draftDeck: deck, updatedAt: now } : s)),
    );
    this.persistSessions();
  }

  private setSlideRegenerating(sessionId: string, slideIndex: number, flag: boolean): void {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId || !s.draftDeck) return s;
        const slides = s.draftDeck.slides.map((sl, idx) =>
          idx === slideIndex ? { ...sl, isRegenerating: flag } : sl,
        );
        return { ...s, draftDeck: { ...s.draftDeck, slides } };
      }),
    );
  }

  private loadSessions(): FlipBookChatSession[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as FlipBookChatSession[];
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  }

  private persistSessions(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.sessions.slice(0, 30)));
    } catch {
      // Ignore quota errors
    }
  }
}

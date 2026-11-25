import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import {
  AiConfig,
  AiModel,
  AiProvider,
} from '../../standup-note/ai-assistant/ai-assistant.service';
import { FlipBookAiService } from './flip-book-ai.service';
import {
  AiGeneratedSlide,
  FlipBookChatSession,
  SlideAcceptPayload,
  SlideAcceptTarget,
} from './flip-book-ai.models';
import {
  buildFallbackSlideIllustration,
  buildFinalSanitizedSlideHtml,
  buildSlideHtmlFromFields,
  sanitizeImageUrl,
  sanitizeSlideHtml,
} from './slide-html-sanitizer';

type DetailViewMode = 'preview' | 'html';

@Component({
  selector: 'app-flip-book-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './flip-book-ai-assistant.component.html',
  styleUrl: './flip-book-ai-assistant.component.scss',
})
export class FlipBookAiAssistantComponent implements OnInit, OnDestroy {
  readonly aiSvc = inject(FlipBookAiService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input() activeBookName = '';
  @Input() existingPageCount = 0;

  @Output() closeAssistant = new EventEmitter<void>();
  @Output() slidesAccepted = new EventEmitter<SlideAcceptPayload>();

  @ViewChild('chatScrollArea') chatScrollArea?: ElementRef<HTMLDivElement>;
  @ViewChild('thumbCarousel') thumbCarousel?: ElementRef<HTMLDivElement>;

  private sessionsSub?: Subscription;
  sessions: FlipBookChatSession[] = [];
  searchQuery = '';
  chatSidebarOpen = true;
  renamingSessionId: string | null = null;

  // Chat input state
  messageText = '';
  currentAttachment: { fileName: string; content: string } | null = null;
  copiedMessageIds = new Set<string>();
  copiedHtml = false;

  // Slide preview & editing state
  selectedSlideIndex = 0;
  detailViewMode: DetailViewMode = 'preview';
  isEditingSlide = false;
  acceptTarget: SlideAcceptTarget = 'append';

  // Local editable buffer for active slide
  editBulletsText = '';

  // Modals & settings
  showHelpModal = false;
  showSettingsModal = false;
  showApiKey = false;
  selectedModel: AiModel = 'gpt-5.6-luna';
  settingsDraft: AiConfig = {
    provider: 'foundry',
    model: 'gpt-5.6-luna',
    apiKey: '',
    systemInstructions: '',
  };

  readonly toastMessage = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly starterPrompts: Array<{ icon: string; label: string; prompt: string }> = [
    {
      icon: '🎓',
      label: 'AI in Education (5 slides)',
      prompt:
        'Create 5 slides on "Impact of AI in Education" with modern design, key points, and relevant images.',
    },
    {
      icon: '📈',
      label: 'Digital Marketing Overview (5 slides)',
      prompt:
        'Create 5 slides on "Digital Marketing Overview" covering strategy, channels, analytics, and ROI with visuals.',
    },
    {
      icon: '🐍',
      label: 'Python Basics (6 slides)',
      prompt:
        'Create 6 slides on "Python Basics Presentation" with clear concepts, structured HTML layouts, and key takeaways.',
    },
    {
      icon: '🌱',
      label: 'Sustainability & Green Energy (4 slides)',
      prompt:
        'Create 4 slides on "Sustainability & Green Energy" with modern eco-friendly colors and relevant images.',
    },
  ];

  readonly fontOptions = [
    { label: 'Inter (Modern Sans)', value: "'Inter', sans-serif" },
    { label: 'Poppins (Geometric)', value: "'Poppins', sans-serif" },
    { label: 'Montserrat (Bold Display)', value: "'Montserrat', sans-serif" },
    { label: 'Playfair Display (Editorial Serif)', value: "'Playfair Display', serif" },
  ];

  readonly backgroundPresets = [
    {
      label: 'Soft Indigo',
      bg: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
      text: '#1e1b4b',
      accent: '#6366f1',
    },
    {
      label: 'Ocean Breeze',
      bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      text: '#0c4a6e',
      accent: '#0284c7',
    },
    {
      label: 'Emerald Fresh',
      bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      text: '#064e3b',
      accent: '#10b981',
    },
    {
      label: 'Midnight Slate',
      bg: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      text: '#f8fafc',
      accent: '#818cf8',
    },
    {
      label: 'Warm Sunset',
      bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      text: '#451a03',
      accent: '#d97706',
    },
  ];

  ngOnInit(): void {
    const cfg = this.aiSvc.config();
    this.selectedModel = cfg.model || 'gpt-5.6-luna';
    this.settingsDraft = { ...cfg };

    this.sessionsSub = this.aiSvc.sessions$.subscribe((list) => {
      this.sessions = this.searchQuery.trim()
        ? this.aiSvc.searchSessions(this.searchQuery)
        : list;

      // Clamp selected slide index when slides change
      const slideCount = this.draftSlides.length;
      if (slideCount === 0) {
        this.selectedSlideIndex = 0;
        this.isEditingSlide = false;
      } else if (this.selectedSlideIndex >= slideCount) {
        this.selectedSlideIndex = slideCount - 1;
      }
      this.syncEditBuffers();
    });

    if (this.aiSvc.sessions.length === 0) {
      this.aiSvc.createNewSession();
    } else if (!this.aiSvc.activeSessionId()) {
      this.aiSvc.setActiveSession(this.aiSvc.sessions[0].id);
    }

    if (typeof window !== 'undefined' && window.innerWidth < 960) {
      this.chatSidebarOpen = false;
    }
  }

  ngOnDestroy(): void {
    this.sessionsSub?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get currentSession(): FlipBookChatSession | null {
    return this.aiSvc.activeSession;
  }

  get draftDeck() {
    return this.currentSession?.draftDeck ?? null;
  }

  get draftSlides(): AiGeneratedSlide[] {
    return this.draftDeck?.slides ?? [];
  }

  get selectedSlide(): AiGeneratedSlide | null {
    return this.draftSlides[this.selectedSlideIndex] ?? null;
  }

  get pinnedSessions(): FlipBookChatSession[] {
    return this.sessions.filter((s) => s.pinned);
  }

  get recentSessions(): FlipBookChatSession[] {
    return this.sessions.filter((s) => !s.pinned);
  }

  get hasApiKey(): boolean {
    const cfg = this.aiSvc.config();
    return cfg.provider === 'foundry' || Boolean(cfg.apiKey?.trim());
  }

  // ── Sidebar Actions ────────────────────────────────────────────────────────

  newChat(): void {
    this.aiSvc.createNewSession();
    this.selectedSlideIndex = 0;
    this.isEditingSlide = false;
    this.detailViewMode = 'preview';
    this.messageText = '';
    this.currentAttachment = null;
  }

  selectSession(id: string): void {
    this.aiSvc.setActiveSession(id);
    this.selectedSlideIndex = 0;
    this.isEditingSlide = false;
    this.syncEditBuffers();
    this.scrollToBottom();
  }

  onSearchChange(): void {
    this.sessions = this.aiSvc.searchSessions(this.searchQuery);
  }

  startRename(id: string): void {
    this.renamingSessionId = id;
  }

  finishRename(event: Event, id: string): void {
    const input = event.target as HTMLInputElement;
    if (input?.value?.trim()) {
      this.aiSvc.renameSession(id, input.value.trim());
    }
    this.renamingSessionId = null;
  }

  confirmDeleteSession(id: string): void {
    if (confirm('Delete this conversation and its draft slides?')) {
      this.aiSvc.deleteSession(id);
    }
  }

  confirmClearAllHistory(): void {
    if (confirm('Clear all Flipbook AI Assistant conversations?')) {
      this.aiSvc.clearAllSessions();
      this.selectedSlideIndex = 0;
      this.isEditingSlide = false;
    }
  }

  // ── Chat & Generation ──────────────────────────────────────────────────────

  useStarterPrompt(prompt: string): void {
    this.messageText = prompt;
    void this.sendMessage();
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      this.aiSvc.error.set('Reference file must be under 2 MB.');
      input.value = '';
      return;
    }

    try {
      const content = await file.text();
      this.currentAttachment = { fileName: file.name, content: content.trim() };
    } catch {
      this.aiSvc.error.set(`Could not read ${file.name}. Please attach a text or markdown file.`);
    } finally {
      input.value = '';
    }
  }

  clearAttachment(): void {
    this.currentAttachment = null;
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText.trim();
    if ((!text && !this.currentAttachment) || this.aiSvc.isProcessing()) return;

    const attachment = this.currentAttachment ?? undefined;
    this.messageText = '';
    this.currentAttachment = null;
    this.isEditingSlide = false;

    this.scrollToBottom();
    await this.aiSvc.sendPrompt(text, attachment);
    this.selectedSlideIndex = 0;
    this.syncEditBuffers();
    this.scrollToBottom();
  }

  async regenerateAll(): Promise<void> {
    if (this.aiSvc.isProcessing()) return;
    this.isEditingSlide = false;
    await this.aiSvc.regenerateAllSlides();
    this.selectedSlideIndex = 0;
    this.syncEditBuffers();
    this.scrollToBottom();
  }

  async regenerateSelectedSlide(): Promise<void> {
    if (!this.selectedSlide || this.selectedSlide.isRegenerating || this.aiSvc.isProcessing()) {
      return;
    }
    this.isEditingSlide = false;
    await this.aiSvc.regenerateSingleSlide(this.selectedSlideIndex);
    this.syncEditBuffers();
    this.showToast(`Regenerated Slide ${this.selectedSlideIndex + 1}`);
  }

  // ── Slide Preview & Editing ────────────────────────────────────────────────

  selectSlide(index: number): void {
    this.selectedSlideIndex = index;
    this.syncEditBuffers();
  }

  scrollThumbs(direction: -1 | 1): void {
    const el = this.thumbCarousel?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 240, behavior: 'smooth' });
  }

  toggleEditMode(): void {
    this.isEditingSlide = !this.isEditingSlide;
    if (this.isEditingSlide) {
      this.syncEditBuffers();
    }
  }

  syncEditBuffers(): void {
    const slide = this.selectedSlide;
    this.editBulletsText = slide ? slide.bulletPoints.join('\n') : '';
  }

  onSlideFieldChanged(syncHtml: boolean = true): void {
    const slide = this.selectedSlide;
    if (!slide) return;

    const updatedBullets = this.editBulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const updated: AiGeneratedSlide = {
      ...slide,
      bulletPoints: updatedBullets,
    };

    if (syncHtml && updated.layout !== 'full-image') {
      updated.htmlContent = sanitizeSlideHtml(buildSlideHtmlFromFields(updated));
    }

    this.aiSvc.updateSlide(this.selectedSlideIndex, updated);
  }

  onDirectHtmlChanged(newHtml: string): void {
    const slide = this.selectedSlide;
    if (!slide) return;
    this.aiSvc.updateSlide(this.selectedSlideIndex, {
      ...slide,
      htmlContent: sanitizeSlideHtml(newHtml),
    });
  }

  applyBackgroundPreset(preset: { bg: string; text: string; accent: string }): void {
    const slide = this.selectedSlide;
    if (!slide) return;
    const updated: AiGeneratedSlide = {
      ...slide,
      style: {
        ...slide.style,
        background: preset.bg,
        textColor: preset.text,
        accentColor: preset.accent,
      },
    };
    updated.htmlContent = sanitizeSlideHtml(buildSlideHtmlFromFields(updated));
    this.aiSvc.updateSlide(this.selectedSlideIndex, updated);
  }

  onSlideImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const slide = this.selectedSlide;
    if (!file || !slide) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const safe = sanitizeImageUrl(result);
      if (safe) {
        this.aiSvc.updateSlide(this.selectedSlideIndex, {
          ...slide,
          imageUrl: safe,
          layout: slide.layout === 'full-html' ? 'split-html-image' : slide.layout,
        });
      }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeSelectedSlide(): void {
    if (this.draftSlides.length <= 1) return;
    this.aiSvc.deleteSlide(this.selectedSlideIndex);
    this.selectedSlideIndex = Math.max(0, this.selectedSlideIndex - 1);
    this.syncEditBuffers();
    this.showToast('Slide removed from preview');
  }

  getSafeSlideHtml(slide: AiGeneratedSlide): SafeHtml {
    const sanitized = buildFinalSanitizedSlideHtml(slide);
    return this.sanitizer.bypassSecurityTrustHtml(sanitized);
  }

  getDisplayImageUrl(slide: AiGeneratedSlide, idx: number): string {
    const safe = sanitizeImageUrl(slide.imageUrl);
    return safe || buildFallbackSlideIllustration(slide.title, slide.style.accentColor, idx);
  }

  onPreviewImageError(event: Event, slide: AiGeneratedSlide, idx: number): void {
    const img = event.target as HTMLImageElement;
    if (!img || img.dataset['fallbackApplied'] === '1') return;
    img.dataset['fallbackApplied'] = '1';
    img.src = buildFallbackSlideIllustration(slide.title, slide.style.accentColor, idx);
  }

  copySlideHtml(): void {
    const slide = this.selectedSlide;
    if (!slide) return;
    navigator.clipboard?.writeText(buildFinalSanitizedSlideHtml(slide)).then(() => {
      this.copiedHtml = true;
      setTimeout(() => (this.copiedHtml = false), 1800);
    });
  }

  copyMessage(id: string, content: string): void {
    navigator.clipboard?.writeText(content).then(() => {
      this.copiedMessageIds.add(id);
      setTimeout(() => this.copiedMessageIds.delete(id), 1800);
    });
  }

  // ── Approval & Flipbook Integration ────────────────────────────────────────

  cancelDraft(): void {
    if (confirm('Discard this generated slide preview?')) {
      this.aiSvc.discardDraft();
      this.isEditingSlide = false;
      this.selectedSlideIndex = 0;
    }
  }

  acceptAndAddToFlipbook(): void {
    const deck = this.draftDeck;
    if (!deck || deck.slides.length === 0) return;

    const startingSno = this.acceptTarget === 'append' ? this.existingPageCount + 1 : 1;
    const pages = this.aiSvc.convertDeckToFlipBookPages(deck, startingSno);

    this.slidesAccepted.emit({
      target: this.acceptTarget,
      deckTitle: deck.deckTitle,
      pages,
    });
  }

  // ── Model & Settings ───────────────────────────────────────────────────────

  onModelSelectChange(): void {
    const provider = this.inferProvider(this.selectedModel);
    this.aiSvc.setModelAndProvider(this.selectedModel, provider);
    this.settingsDraft = { ...this.aiSvc.config() };
  }

  openSettings(): void {
    this.settingsDraft = { ...this.aiSvc.config() };
    this.showSettingsModal = true;
  }

  onSettingsProviderChange(): void {
    const defaults: Record<AiProvider, AiModel> = {
      foundry: 'gpt-5.6-luna',
      openai: 'gpt-4o',
      gemini: 'gemini-2.0-flash',
      anthropic: 'claude-3-5-sonnet-20241022',
    };
    this.settingsDraft.model = defaults[this.settingsDraft.provider];
  }

  saveSettings(): void {
    this.aiSvc.updateSharedConfig({
      provider: this.settingsDraft.provider,
      model: this.settingsDraft.model,
      apiKey: this.settingsDraft.apiKey,
    });
    this.selectedModel = this.settingsDraft.model;
    this.showSettingsModal = false;
    this.showToast('AI settings saved');
  }

  private inferProvider(model: AiModel): AiProvider {
    if (model === 'gpt-5.6-luna') return 'foundry';
    if (model.startsWith('gemini')) return 'gemini';
    if (model.startsWith('claude')) return 'anthropic';
    return 'openai';
  }

  // ── Formatting & Utilities ─────────────────────────────────────────────────

  formatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  formatSessionDate(iso: string): string {
    try {
      const date = new Date(iso);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 2600);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatScrollArea?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 60);
  }
}

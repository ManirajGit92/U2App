import { Injectable, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService, Theme } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';
import { AiVoiceService } from './ai-voice.service';

export type AvatarPose = 'idle' | 'listening' | 'thinking' | 'speaking' | 'explaining' | 'pointing' | 'happy' | 'sad' | 'laugh';

export interface AssistantAction {
  id: string;
  name: string;
  image: string;
  pose: AvatarPose;
  actionLabel: string;
  reply: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  themePicker?: boolean;
  toolSuggestion?: { name: string; route: string; description: string };
  actionConfirmed?: string;
}

export interface AvailableTool {
  name: string;
  route: string;
  description: string;
  keywords: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiCharacterAssistantService {
  private router = inject(Router);
  public themeService = inject(ThemeService);
  public voiceService = inject(AiVoiceService);

  // Assistant UI State
  readonly isOpen = signal<boolean>(false);
  readonly isMinimized = signal<boolean>(false);
  readonly currentPose = signal<AvatarPose>('idle');
  readonly isSpeaking = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);
  readonly isThinking = signal<boolean>(false);
  readonly isMuted = signal<boolean>(false);
  readonly unreadCount = signal<number>(1);

  // Dynamic Character Action State
  readonly activeActionImage = signal<string | null>(null);
  readonly activeActionLabel = signal<string | null>(null);
  readonly actionDuration = signal<number>(4);
  private actionTimer?: any;
  private readonly durationStorageKey = 'u2_action_display_duration';

  // Message history
  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Hi! 👋 I'm your U2 Assistant.\nAsk me anything about this website or tell me what you want to do.",
      timestamp: new Date()
    }
  ]);

  // Speech synthesis
  private synth?: SpeechSynthesis;
  private currentUtterance?: SpeechSynthesisUtterance;

  // Available Tools Knowledge Base
  readonly tools: AvailableTool[] = [
    {
      name: 'Standup Note',
      route: '/standup-note',
      description: 'Manage daily standups, track employee work, project status, team reminders and timeline — powered by Excel.',
      keywords: ['standup', 'daily standup', 'scrum', 'employee', 'tasks', 'timeline', 'status note']
    },
    {
      name: 'Work Tracker',
      route: '/work-tracker',
      description: 'Track developer statuses, monitor product release tracking, and manage data via local Excel sheets.',
      keywords: ['work tracker', 'developer status', 'release tracking', 'releases', 'tickets']
    },
    {
      name: 'Unit Test Tracker',
      route: '/unit-test-tracker',
      description: 'Excel-driven test tracking system with complete CRUD, execution logging, and test coverage management.',
      keywords: ['unit test', 'test tracker', 'qa', 'test cases', 'testing', 'bugs']
    },
    {
      name: 'HTML Viewer',
      route: '/html-viewer',
      description: 'Preview and render HTML code instantly with live editing and responsive viewport testing.',
      keywords: ['html viewer', 'html preview', 'live code', 'html renderer', 'preview']
    },
    {
      name: 'Estimator App',
      route: '/estimator-app',
      description: 'Automatically estimate project effort with formula-based inputs, feature breakdowns, and Excel report generation.',
      keywords: ['estimator', 'project effort', 'cost estimation', 'estimation', 'budget', 'quotation']
    },
    {
      name: 'Lodge Booking',
      route: '/lodge-booking',
      description: 'Run a modern lodge front desk to handle room booking, guest management, amenities, housekeeping, reports, and Excel import/export.',
      keywords: ['lodge', 'hotel', 'booking', 'rooms', 'guest', 'housekeeping', 'check-in', 'checkout']
    },
    {
      name: 'Free Billing & GST',
      route: '/free-billing',
      description: 'Generate invoices, manage clients, calculate GST taxes, and export PDF billing statements.',
      keywords: ['billing', 'invoice', 'gst', 'tax invoice', 'bills', 'receipts']
    },
    {
      name: 'Easy Documents',
      route: '/easy-documents',
      description: 'Create and format structured professional documents, templates, and export to DOCX/PDF.',
      keywords: ['documents', 'doc builder', 'word', 'templates', 'easy documents']
    },
    {
      name: 'Text / JSON Compare',
      route: '/text-json-compare',
      description: 'Diff tool to compare JSON structures, code, and text side by side with highlighted differences.',
      keywords: ['compare', 'diff', 'json compare', 'difference', 'merge']
    },
    {
      name: 'Tax Calculator',
      route: '/tax-calculator',
      description: 'Calculate income tax, deductions, and tax regimes easily.',
      keywords: ['tax calculator', 'tax', 'income tax', 'old regime', 'new regime']
    },
    {
      name: 'YouTube Manager',
      route: '/youtube-manager',
      description: 'Loop YouTube videos, practice lyrics, control playback loops, and curate playlists.',
      keywords: ['youtube', 'video player', 'loop', 'lyrics', 'player']
    }
  ];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }

    this.loadActionDuration();

    // Connect voice interaction dispatcher: when wake word & speech are captured, send to LLM
    this.voiceService.registerMessageDispatcher(async (userPrompt: string) => {
      // Open chat automatically so user sees interaction
      this.openChat();
      await this.sendMessage(userPrompt);
    });

    // Reactive synchronization between voice service and avatar animations
    effect(() => {
      const spk = this.voiceService.isSpeaking();
      this.isSpeaking.set(spk);
      if (spk) {
        this.setPose('speaking');
      } else if (this.currentPose() === 'speaking') {
        this.setPose('idle');
      }
    });

    effect(() => {
      const lis = this.voiceService.isListening();
      this.isListening.set(lis);
      if (lis) {
        this.setPose('listening');
      } else if (this.currentPose() === 'listening') {
        this.setPose('idle');
      }
    });

    // Proactively wake the Render.com backend (free tier sleeps after inactivity).
    // This is fire-and-forget; errors are silently ignored.
    this.warmupBackend();
  }


  /** Sends a lightweight health-check ping so the backend is warm for the first real request. */
  private warmupBackend(): void {
    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const healthUrl = `${pythonBase}/health`;
    fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(30_000) }).catch(() => { });
  }

  // ── Action Display Duration & Dynamic Character Actions ──────────

  private loadActionDuration(): void {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(this.durationStorageKey);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1 && val <= 30) {
          this.actionDuration.set(val);
        }
      }
    } catch { }
  }

  setActionDuration(seconds: number): void {
    const clamped = Math.max(1, Math.min(30, Math.round(seconds)));
    this.actionDuration.set(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.durationStorageKey, clamped.toString());
      } catch { }
    }
  }

  triggerAction(imagePath: string, pose: AvatarPose = 'happy', label?: string): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = undefined;
    }

    this.activeActionImage.set(imagePath);
    this.activeActionLabel.set(label || null);
    this.setPose(pose);

    const durationMs = this.actionDuration() * 1000;
    this.actionTimer = setTimeout(() => {
      this.clearAction();
    }, durationMs);
  }

  clearAction(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = undefined;
    }
    this.activeActionImage.set(null);
    this.activeActionLabel.set(null);
    this.setPose('idle');
  }

  // ── Window Controls ──────────────────────────────────────────────

  openChat(): void {
    this.isOpen.set(true);
    this.isMinimized.set(false);
    this.unreadCount.set(0);
    this.triggerAction('assets/images/assistant/HandShake_Hi.gif', 'explaining', 'Here to help 👋');
  }

  closeChat(): void {
    this.isOpen.set(false);
    this.stopSpeaking();
    this.clearAction();
  }

  toggleChat(): void {
    if (this.isOpen()) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  minimizeChat(): void {
    this.isMinimized.update(v => !v);
  }

  setPose(pose: AvatarPose): void {
    this.currentPose.set(pose);
  }

  toggleMute(): void {
    this.isMuted.update(m => !m);
    if (this.isMuted()) {
      this.stopSpeaking();
    }
  }

  // ── Keyword-Based Action & Fast Intent Detection ──────────────────

  detectAction(input: string): AssistantAction | null {
    const raw = input.trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();

    // Clean up punctuation for consistent keyword matching
    const normalized = lower.replace(/[!?,.:;'"~`@#$%^&*()_+=/\\<>{}[\]]/g, ' ').replace(/\s+/g, ' ').trim();

    // Priority-ordered matching (ensures no conflicting actions for a single request)

    // 1. Thumbs-up / Approvals / Praise
    if (
      /\bthumbs?\s*[-_]?up\b/.test(normalized) ||
      /\b(well\s+done|good\s+job|great\s+job|nice\s+work|awesome\s+job|you\s+rock|youre?\s+awesome|kudos|superb|high\s+five)\b/.test(normalized) ||
      /^(thumbs?\s*up|thumb|cool|awesome|perfect|great|nice|like|approve|excellent)$/.test(normalized)
    ) {
      return {
        id: 'thumbs-up',
        name: 'Thumbs Up',
        image: 'assets/images/assistant/ThumbsUp.png',
        pose: 'happy',
        actionLabel: 'Thumbs Up 👍',
        reply: "👍 Thumbs up! You're doing great! Let me know if you need any assistance with your tasks."
      };
    }

    // 2. Handshake / Greeting Partner
    if (
      /\b(hand\s*[-_]?shake|shake\s+(my\s+)?hands?|give\s+me\s+a\s+hand)\b/.test(normalized) ||
      /\b(pleasure|nice|glad)\s+to\s+meet\s+you\b/.test(normalized)
    ) {
      return {
        id: 'handshake',
        name: 'Handshake',
        image: 'assets/images/assistant/HandShake_Hi.gif',
        pose: 'explaining',
        actionLabel: 'Handshake 🤝',
        reply: "🤝 It's a real pleasure to connect with you! Let's get things done together."
      };
    }

    // 3. Multiple Actions / Gestures / Dance
    if (
      /\b(multiple|multi)\s*[-_]?actions?\b/.test(normalized) ||
      /\bshow\s+(your\s+)?(actions?|moves|gestures|animations?)\b/.test(normalized) ||
      /\b(dance|do\s+a\s+dance|perform|celebrate|party)\b/.test(normalized) ||
      /^(actions|moves|gestures)$/.test(normalized)
    ) {
      return {
        id: 'multiple-actions',
        name: 'Multiple Actions',
        image: 'assets/images/assistant/MultipleActions.gif',
        pose: 'pointing',
        actionLabel: 'Multiple Actions 💃',
        reply: "Check out my moves! 💃 I can express greetings, explanations, thumbs-up, deep thoughts, and multiple animated gestures to keep you company while you work."
      };
    }

    // 4. Explaining / Overview / Guides
    if (
      /\b(explain(\s+(this|to\s+me|it|features|website))?|how\s+(does\s+(it|this)|do\s+you)\s+work|what\s+can\s+you\s+do|walk\s+me\s+through|guide\s+me|instructions|help\s+me\s+understand)\b/.test(normalized) ||
      /^(explain|features|help|guide|instructions)$/.test(normalized)
    ) {
      return {
        id: 'explaining',
        name: 'Explaining',
        image: 'assets/images/assistant/Explaining.png',
        pose: 'explaining',
        actionLabel: 'Explaining 💡',
        reply: "Here is an overview of U2 Tools:\n• **Excel-Powered Apps**: Standup Note, Work Tracker, Estimator App, and Lodge Booking\n• **Productivity Utilities**: HTML Viewer, Document Builder, Diff Compare, and Tax Calculator\n• **Personalization**: Change themes, adjust character speed, and configure action display duration anytime!"
      };
    }

    // 5. Welcome & Onboarding
    if (
      /\b(welcome(\s+(me|to\s+u2(\s*tools)?|aboard))?|who\s+are\s+you|introduce\s+yourself|meet\s+the\s+assistant|get\s+started|onboard(ing)?)\b/.test(normalized) ||
      /^(welcome|introduce|intro)$/.test(normalized)
    ) {
      return {
        id: 'welcome',
        name: 'Welcome',
        image: 'assets/images/assistant/Welcome.png',
        pose: 'happy',
        actionLabel: 'Welcome 🎉',
        reply: "Welcome to U2Tools! 🎉 I'm your dedicated AI assistant. I'm here to guide you through all our features, help you navigate tools, and personalize your experience."
      };
    }

    // 6. Hand in Chin / Hand in Chip / Pondering
    if (
      /\bhand\s+(in|on)\s+(chin|chip)\b/.test(normalized) ||
      /\b(curious|wondering|pondering)\b/.test(normalized) ||
      /\bwhat\s+do\s+you\s+think\b/.test(normalized) ||
      /^(chin|chip|curious|hmm+|wondering)$/.test(normalized)
    ) {
      return {
        id: 'hand-in-chin',
        name: 'Hand in Chin',
        image: 'assets/images/assistant/HandInChin.png',
        pose: 'thinking',
        actionLabel: 'Curious 🤔',
        reply: "That's an interesting question! 🤔 Let's look into that together and find the best way forward."
      };
    }

    // 7. Think / Deep Analysis / Problem Solving
    if (
      /\b(let\s+me\s+think|deep\s+thought|think\s+about\s+(it|this)|analyz(e|ing)|brainstorm|solve\s+this|figure\s+it\s+out)\b/.test(normalized) ||
      /^(think|thinking|ponder|analyze|brainstorm)$/.test(normalized)
    ) {
      return {
        id: 'think',
        name: 'Think',
        image: 'assets/images/assistant/Think.png',
        pose: 'thinking',
        actionLabel: 'Thinking 💭',
        reply: "Thinking deeply about this... 💭 Great problems require focused minds! Let's work out the best solution."
      };
    }

    // 8. Type / Coding / Working / Taking Notes
    if (
      /\b((start\s+)?typing|(take|taking)\s+notes|write\s+(code|notes?)|coding|draft(ing)?)\b/.test(normalized) ||
      /^(type|typing|write|code)$/.test(normalized)
    ) {
      return {
        id: 'type',
        name: 'Type',
        image: 'assets/images/assistant/Type.png',
        pose: 'explaining',
        actionLabel: 'Typing ⌨️',
        reply: "I'm on it! ⌨️ Typing away and keeping your notes, code, and documentation organized."
      };
    }

    // 9. Smile and Stand Idle
    if (
      /\b(smile\s+and\s+stand|stand\s+idle|smile|relax|stand\s+still|be\s+idle|reset\s+(pose|character|avatar))\b/.test(normalized) ||
      /^(smile|idle|stand|relax)$/.test(normalized)
    ) {
      return {
        id: 'smile-idle',
        name: 'Smile & Stand Idle',
        image: 'assets/images/assistant/SmileAndStandIdle.gif',
        pose: 'idle',
        actionLabel: 'Smile & Stand 😊',
        reply: "Standing by with a smile! 😊 Ready whenever you need assistance."
      };
    }

    // 10. Greetings
    if (
      /\b(hi|hello|hey|howdy|greetings)\b/.test(normalized) ||
      /\bgood\s+(morning|afternoon|evening|day)\b/.test(normalized) ||
      /\bwhat'?s\s+up\b/.test(normalized) ||
      /^(hi|hello|hey|yo|howdy)$/.test(normalized)
    ) {
      return {
        id: 'greeting',
        name: 'Greeting',
        image: 'assets/images/assistant/HandShake_Hi.gif',
        pose: 'happy',
        actionLabel: 'Hello! 👋',
        reply: "Hello there! 👋 Glad to see you! How can I help you with U2 Tools today?"
      };
    }
    // 11. Laugh
    if (
      /\b(laugh|laughing|laughter|giggle|giggling|chuckle|chuckling|lol|lmao|hilarious|funny|crack\s+me\s+up)\b/.test(normalized) ||
      /^(laugh|laughing|giggle|chuckle|lol|lmao|funny)$/.test(normalized)
    ) {
      return {
        id: 'laugh',
        name: 'Laugh',
        image: 'assets/images/assistant/Laugh.gif',
        pose: 'happy',
        actionLabel: 'Laugh 😂',
        reply: "😂 Haha! That's hilarious! A little laughter makes every day better. Keep smiling!"
      };
    }

    // 12. Sad
    if (
      /\b(sad|sadness|unhappy|upset|disappointed|depressed|cry|crying|tears|heartbroken|feeling\s+low|feeling\s+down|miss\s+you|sorry\s+to\s+hear)\b/.test(normalized) ||
      /^(sad|unhappy|upset|cry|crying|disappointed)$/.test(normalized)
    ) {
      return {
        id: 'sad',
        name: 'Sad',
        image: 'assets/images/assistant/Sad.gif',
        pose: 'sad',
        actionLabel: 'Sad 😢',
        reply: "😢 I'm sorry you're feeling this way. Remember, difficult moments don't last forever. I'm here if you need help or someone to talk to."
      };
    }

    return null;
  }

  private checkQuickTheme(input: string): { theme?: Theme } | null {
    const lower = input.toLowerCase().trim();
    const validThemes: Theme[] = ['light', 'dark', 'blue', 'green', 'pink'];
    if (validThemes.includes(lower as Theme)) {
      return { theme: lower as Theme };
    }

    const themeKeywords = ['theme', 'dark mode', 'light mode', 'change color', 'switch mode', 'night mode', 'appearance'];
    if (themeKeywords.some(k => lower.includes(k))) {
      const themeMap: Record<string, Theme> = {
        dark: 'dark',
        light: 'light',
        blue: 'blue',
        green: 'green',
        pink: 'pink',
        rose: 'pink',
        night: 'dark',
        day: 'light'
      };
      for (const [kw, thm] of Object.entries(themeMap)) {
        if (lower.includes(kw)) {
          return { theme: thm };
        }
      }
      return {};
    }
    return null;
  }

  private checkQuickNavigation(input: string): { name: string; route: string } | null {
    const lower = input.toLowerCase().trim();
    const navVerbs = ['open', 'go to', 'take me', 'navigate', 'launch', 'load', 'switch to', 'show me', 'i want to use', 'use'];
    const hasNavVerb = navVerbs.some(v => lower.includes(v));

    for (const tool of this.tools) {
      const nameMatch = lower.includes(tool.name.toLowerCase());
      const kwMatch = tool.keywords.some(k => lower.includes(k));
      if (nameMatch || (hasNavVerb && kwMatch)) {
        return { name: tool.name, route: tool.route };
      }
    }
    return null;
  }

  // ── Send User Message ─────────────────────────────────────────────

  async sendMessage(userInput: string): Promise<void> {
    const text = userInput.trim();
    if (!text) return;

    // Add user message to conversation history
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMsg]);

    // 1. Fast Keyword-Based Action Detection (Immediate frontend response)
    const detectedAction = this.detectAction(text);
    if (detectedAction) {
      this.triggerAction(detectedAction.image, detectedAction.pose, detectedAction.actionLabel);
      this.addAssistantResponse({
        text: detectedAction.reply,
        pose: detectedAction.pose
      });
      return;
    }

    // 2. Direct Theme Change
    const themeMatch = this.checkQuickTheme(text);
    if (themeMatch) {
      if (themeMatch.theme) {
        this.applyTheme(themeMatch.theme);
      } else {
        this.addAssistantResponse({
          text: 'Sure! Which theme would you like?',
          pose: 'pointing',
          themePicker: true
        });
      }
      return;
    }

    // 3. Direct Tool Navigation
    const navMatch = this.checkQuickNavigation(text);
    if (navMatch) {
      this.navigateTo(navMatch.route, navMatch.name);
      return;
    }

    // 4. Fallback: LLM Processing (retains default character)
    this.setPose('thinking');
    this.isThinking.set(true);

    try {
      const response = await this.processUserIntent(text);
      this.isThinking.set(false);
      this.addAssistantResponse(response);
    } catch (err) {
      this.isThinking.set(false);
      this.addAssistantResponse({
        text: "I'm right here! Feel free to ask me to change the theme (Light, Dark, Blue, Green, Pink) or open any of our tools.",
        pose: 'idle'
      });
    }
  }

  // ── Apply Theme Action ───────────────────────────────────────────

  applyTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    const capitalized = theme.charAt(0).toUpperCase() + theme.slice(1);

    // Confirmation message
    const confirmMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      text: `✅ Theme changed to ${capitalized}!\nHope you like it. Let me know if you need anything else.`,
      timestamp: new Date(),
      actionConfirmed: `Theme: ${capitalized}`
    };

    this.messages.update(msgs => [...msgs, confirmMsg]);
    this.triggerAction('assets/images/assistant/ThumbsUp.png', 'happy', 'Theme Updated 🎨');
    this.speakText(`Theme changed to ${capitalized}! Hope you like it.`);
  }

  // ── Navigate Action ──────────────────────────────────────────────

  navigateTo(route: string, toolName: string): void {
    this.router.navigateByUrl(route);
    const navMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      text: `Navigating to ${toolName}... 🚀 Here it is!`,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, navMsg]);
    this.triggerAction('assets/images/assistant/MultipleActions.gif', 'pointing', `Opening ${toolName} 🚀`);
    this.speakText(`Opening ${toolName}`);
  }

  // ── Process Intent & Backend Integration (LLM-powered) ───────────

  /** Builds the system prompt for the U2 Assistant intent classifier. */
  private buildIntentSystemPrompt(): string {
    const toolList = this.tools
      .map(t => `  - name: "${t.name}", route: "${t.route}", keywords: [${t.keywords.map(k => `"${k}"`).join(', ')}]`)
      .join('\n');

    return `You are the intelligent U2 Assistant for the U2 Tools website.

Your primary job is to understand what the user wants and respond with a structured JSON object so the application can act on it.

Available themes: "light", "dark", "blue", "green", "pink"

Available tools (name → route):
${toolList}

For every user message, analyse the intent and respond ONLY with a valid JSON object in exactly one of these shapes:

1. Theme change (user wants to switch the app theme):
   {"intent":"theme-change","theme":"<one of: light|dark|blue|green|pink>","reply":"<short friendly confirmation>"}
   If the user asks for a theme change but does NOT name a specific theme, use:
   {"intent":"theme-change","theme":null,"reply":"Sure! Which theme would you like?"}

2. Navigate to a tool (user wants to open / go to / launch / use one of the listed tools):
   {"intent":"navigate-tool","route":"<exact route from list>","toolName":"<exact name from list>","reply":"<short friendly message>"}

3. General question / conversation (anything else — greetings, how-to questions, app info):
   {"intent":"general-query","reply":"<natural, friendly, concise answer (max 3 sentences)>"}

4. Ambiguous request needing clarification:
   {"intent":"clarify","reply":"<a concise clarifying question>"}

Rules:
- Respond ONLY with the JSON. No markdown fences, no extra text.
- Be warm, concise, and helpful.
- If the user greets you, respond with intent "general-query" and a friendly greeting.
- For navigation, recognise synonyms: open, launch, show, take me to, navigate, go to, use, I want to use, switch to, load.
- For themes, recognise synonyms: dark mode, night mode, light mode, day mode, colour scheme, appearance.`;
  }

  /**
   * Sends the user message to the Foundry backend (same endpoint as Standup Note AI)
   * with a structured intent-classification system prompt, and returns parsed JSON.
   */
  private async callIntentLLM(userMessage: string): Promise<{
    intent: 'theme-change' | 'navigate-tool' | 'general-query' | 'clarify';
    theme?: string | null;
    route?: string;
    toolName?: string;
    reply: string;
  } | null> {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const endpoints = isLocal
      ? [
        'http://127.0.0.1:8000/api/standup-ai/chat',
        'http://localhost:8000/api/standup-ai/chat',
        'http://127.0.0.1:8000/api/chat',
        `${pythonBase}/api/standup-ai/chat`,
        `${pythonBase}/api/chat`,
        '/api/standup-ai/chat',
      ]
      : [
        `${pythonBase}/api/standup-ai/chat`,
        `${pythonBase}/api/chat`,
        '/api/standup-ai/chat',
        'http://127.0.0.1:8000/api/standup-ai/chat',
        'http://localhost:8000/api/standup-ai/chat',
      ];

    const recentHistory = this.messages()
      .slice(-6)
      .map(m => ({ role: m.sender === 'assistant' ? 'assistant' : 'user', content: m.text }));

    const body = {
      message: userMessage,
      history: recentHistory,
      system_instructions: this.buildIntentSystemPrompt(),
    };

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const data = await res.json();
        const raw: string = (data?.response ?? '').trim();

        // Strip possible markdown fences the model may add
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

        try {
          const parsed = JSON.parse(cleaned);
          if (parsed && typeof parsed.intent === 'string' && typeof parsed.reply === 'string') {
            return parsed;
          }
        } catch {
          // LLM returned free text instead of JSON — treat as general-query reply
          if (raw) {
            return { intent: 'general-query', reply: raw };
          }
        }
      } catch {
        // Connection failed — try next endpoint
      }
    }

    return null;
  }

  private async processUserIntent(input: string): Promise<{
    text: string;
    pose: AvatarPose;
    themePicker?: boolean;
    toolSuggestion?: { name: string; route: string; description: string };
  }> {
    // ── Step 1: Ask the LLM to classify and handle the intent ────────
    let llmUnreachable = false;
    try {
      const result = await this.callIntentLLM(input);

      if (result) {
        switch (result.intent) {

          // ── Theme Change ───────────────────────────────────────────
          case 'theme-change': {
            const requestedTheme = result.theme?.toLowerCase() ?? null;
            const validThemes = ['light', 'dark', 'blue', 'green', 'pink'];

            if (requestedTheme && validThemes.includes(requestedTheme)) {
              this.applyTheme(requestedTheme as Theme);
              return {
                text: result.reply || `✅ Theme changed to ${requestedTheme.charAt(0).toUpperCase() + requestedTheme.slice(1)}! Hope you like it.`,
                pose: 'happy',
              };
            }

            // Theme not specified — show picker
            return {
              text: result.reply || 'Sure! Which theme would you like?',
              pose: 'pointing',
              themePicker: true,
            };
          }

          // ── Navigate to Tool ───────────────────────────────────────
          case 'navigate-tool': {
            const route = result.route ?? '';
            const toolName = result.toolName ?? '';

            // Validate route exists in our tools list
            const matchedTool = this.tools.find(
              t => t.route === route || t.name.toLowerCase() === toolName.toLowerCase()
            );

            if (matchedTool) {
              this.navigateTo(matchedTool.route, matchedTool.name);
              return {
                text: result.reply || `Opening ${matchedTool.name} for you right away! 🚀`,
                pose: 'pointing',
              };
            }

            // Route not in our list — ask for clarification
            return {
              text: result.reply || `I couldn't find that tool. Ask me to open Standup Note, Work Tracker, Lodge Booking, and more!`,
              pose: 'explaining',
            };
          }

          // ── General Query / Conversation ───────────────────────────
          case 'general-query':
            return {
              text: result.reply,
              pose: 'speaking',
            };

          // ── Clarification Needed ───────────────────────────────────
          case 'clarify':
            return {
              text: result.reply,
              pose: 'explaining',
            };
        }
      } else {
        // callIntentLLM returned null — all endpoints unreachable
        llmUnreachable = true;
      }
    } catch {
      // LLM threw an exception — treat as unreachable
      llmUnreachable = true;
    }

    // ── Step 2: Local keyword fallback (offline / LLM unreachable) ───
    const lower = input.toLowerCase();

    // Greetings
    if (lower.startsWith('hi') || lower.startsWith('hello') || lower.startsWith('hey')) {
      return {
        text: "Hello there! 👋 I'm here to help you navigate U2 Tools, change themes, or answer questions about our applications.",
        pose: 'idle',
      };
    }

    // Help
    if (lower.includes('what can you do') || lower.includes('help') || lower.includes('features')) {
      return {
        text: "Here is what I can do for you:\n• **Change Themes**: Light, Dark, Blue, Green, or Pink\n• **Tool Navigation**: Open any U2 tool by asking\n• **Application Guidance**: Ask how any tool works\n• **Voice Interaction**: Use the microphone to talk to me!",
        pose: 'explaining',
      };
    }

    // Direct theme names
    if (['light', 'dark', 'blue', 'green', 'pink'].includes(lower)) {
      this.applyTheme(lower as Theme);
      return {
        text: `✅ Theme changed to ${lower.charAt(0).toUpperCase() + lower.slice(1)}! Hope you like it.`,
        pose: 'happy',
      };
    }

    // Theme keywords
    const themeKeywords = ['theme', 'dark mode', 'light mode', 'change color', 'switch mode', 'night mode', 'appearance'];
    if (themeKeywords.some(k => lower.includes(k))) {
      const themeMap: Record<string, Theme> = { dark: 'dark', light: 'light', blue: 'blue', green: 'green', pink: 'pink', rose: 'pink', night: 'dark', day: 'light' };
      for (const [keyword, theme] of Object.entries(themeMap)) {
        if (lower.includes(keyword)) {
          this.applyTheme(theme);
          return { text: `✅ Theme changed to ${theme.charAt(0).toUpperCase() + theme.slice(1)}!`, pose: 'happy' };
        }
      }
      return { text: 'Sure! Which theme would you like?', pose: 'pointing', themePicker: true };
    }

    // Navigation keywords
    const navVerbs = ['open', 'go to', 'take me', 'navigate', 'show me', 'launch', 'load', 'switch to', 'i want to use', 'use'];
    const wantsNav = navVerbs.some(v => lower.includes(v));
    for (const tool of this.tools) {
      const nameMatch = lower.includes(tool.name.toLowerCase());
      const keywordMatch = tool.keywords.some(k => lower.includes(k));
      if (nameMatch || keywordMatch) {
        if (wantsNav || nameMatch) {
          this.navigateTo(tool.route, tool.name);
          return { text: `Opening ${tool.name} for you right away! 🚀`, pose: 'pointing' };
        }
        return {
          text: `**${tool.name}**\n${tool.description}\n\nWould you like me to open it for you?`,
          pose: 'explaining',
          toolSuggestion: tool,
        };
      }
    }

    // ── Step 3: Honest fallback when LLM is unreachable ─────────────
    // At this point the query didn't match any local pattern. If the LLM
    // was unreachable (cold start / network), tell the user rather than
    // returning a misleading generic message.
    if (llmUnreachable) {
      return {
        text: "⏳ My AI service is still warming up (it can take up to 30 seconds after a period of inactivity). Please try your question again in a moment!\n\nWhile you wait, I can change the theme or open any U2 tool for you.",
        pose: 'explaining',
      };
    }

    // Generic fallback (LLM was reachable but returned an unrecognised shape)
    return {
      text: `I'm happy to assist! You can ask me to change the theme (Light, Dark, Blue, Green, Pink) or open tools like Standup Note, Lodge Booking, Estimator App, and more.`,
      pose: 'explaining',
    };
  }

  private addAssistantResponse(res: {
    text: string;
    pose: AvatarPose;
    themePicker?: boolean;
    toolSuggestion?: { name: string; route: string; description: string };
  }): void {
    const assistantMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      text: res.text,
      timestamp: new Date(),
      themePicker: res.themePicker,
      toolSuggestion: res.toolSuggestion
    };

    this.messages.update(msgs => [...msgs, assistantMsg]);
    this.setPose(res.pose);
    this.speakText(res.text);

    // Return to idle after speech finishes or a timer (only when no action is active)
    setTimeout(() => {
      if (!this.activeActionImage() && ['speaking', 'explaining', 'pointing'].includes(this.currentPose())) {
        this.setPose('idle');
      }
    }, 6000);
  }

  // ── Speech Synthesis (TTS with Microsoft Foundry) ────────────────

  speakText(text: string): void {
    if (this.isMuted()) return;
    this.voiceService.speak(text).catch(() => { });
  }

  stopSpeaking(): void {
    this.voiceService.stopSpeaking();
    if (this.currentPose() === 'speaking') {
      this.setPose('idle');
    }
  }
}


import { Injectable, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService, Theme } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';
import { AiVoiceService } from './ai-voice.service';

export type AvatarPose = 'idle' | 'listening' | 'thinking' | 'speaking' | 'explaining' | 'pointing' | 'happy';

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
    fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(30_000) }).catch(() => {});
  }

  // ── Window Controls ──────────────────────────────────────────────

  openChat(): void {
    this.isOpen.set(true);
    this.isMinimized.set(false);
    this.unreadCount.set(0);
    this.setPose('explaining');
    setTimeout(() => {
      if (this.currentPose() === 'explaining') {
        this.setPose('idle');
      }
    }, 3000);
  }

  closeChat(): void {
    this.isOpen.set(false);
    this.stopSpeaking();
    this.setPose('idle');
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

  // ── Send User Message ─────────────────────────────────────────────

  async sendMessage(userInput: string): Promise<void> {
    const text = userInput.trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, userMsg]);

    // Assistant switches to thinking state
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
    this.setPose('happy');
    this.speakText(`Theme changed to ${capitalized}! Hope you like it.`);

    setTimeout(() => {
      this.setPose('idle');
    }, 4500);
  }

  // ── Navigate Action ──────────────────────────────────────────────

  navigateTo(route: string, toolName: string): void {
    this.setPose('pointing');
    this.router.navigateByUrl(route);
    const navMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'assistant',
      text: `Navigating to ${toolName}... 🚀 Here it is!`,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, navMsg]);
    this.speakText(`Opening ${toolName}`);

    setTimeout(() => {
      this.setPose('idle');
    }, 3500);
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

    // Return to idle after speech finishes or a timer
    setTimeout(() => {
      if (['speaking', 'explaining', 'pointing'].includes(this.currentPose())) {
        this.setPose('idle');
      }
    }, 6000);
  }

  // ── Speech Synthesis (TTS with Microsoft Foundry) ────────────────

  speakText(text: string): void {
    if (this.isMuted()) return;
    this.voiceService.speak(text).catch(() => {});
  }

  stopSpeaking(): void {
    this.voiceService.stopSpeaking();
    if (this.currentPose() === 'speaking') {
      this.setPose('idle');
    }
  }
}


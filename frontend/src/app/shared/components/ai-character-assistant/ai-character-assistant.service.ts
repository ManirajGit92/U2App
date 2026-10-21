import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService, Theme } from '../../../core/services/theme.service';
import { environment } from '../../../../environments/environment';

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

  // ── Process Intent & Backend Integration ─────────────────────────

  private async processUserIntent(input: string): Promise<{
    text: string;
    pose: AvatarPose;
    themePicker?: boolean;
    toolSuggestion?: { name: string; route: string; description: string };
  }> {
    const lower = input.toLowerCase();

    // 1. Theme Change Request
    if (
      lower.includes('theme') ||
      lower.includes('dark mode') ||
      lower.includes('light mode') ||
      lower.includes('change color') ||
      lower.includes('switch mode')
    ) {
      // Check if specific theme is requested directly
      if (lower.includes('dark')) {
        this.applyTheme('dark');
        return {
          text: `✅ Theme changed to Dark!\nHope you like it. Let me know if you need anything else.`,
          pose: 'happy'
        };
      } else if (lower.includes('light')) {
        this.applyTheme('light');
        return {
          text: `✅ Theme changed to Light!\nHope you like it. Let me know if you need anything else.`,
          pose: 'happy'
        };
      } else if (lower.includes('blue')) {
        this.applyTheme('blue');
        return {
          text: `✅ Theme changed to Blue!\nHope you like it. Let me know if you need anything else.`,
          pose: 'happy'
        };
      } else if (lower.includes('green')) {
        this.applyTheme('green');
        return {
          text: `✅ Theme changed to Green!\nHope you like it. Let me know if you need anything else.`,
          pose: 'happy'
        };
      } else if (lower.includes('pink') || lower.includes('rose')) {
        this.applyTheme('pink');
        return {
          text: `✅ Theme changed to Pink!\nHope you like it. Let me know if you need anything else.`,
          pose: 'happy'
        };
      }

      // If user asks "Can you change the theme?", ask to select from 5 options
      return {
        text: 'Sure! Which theme would you like?',
        pose: 'pointing',
        themePicker: true
      };
    }

    // Direct theme names
    if (['light', 'dark', 'blue', 'green', 'pink'].includes(lower)) {
      this.applyTheme(lower as Theme);
      return {
        text: `✅ Theme changed to ${lower.charAt(0).toUpperCase() + lower.slice(1)}!\nHope you like it. Let me know if you need anything else.`,
        pose: 'happy'
      };
    }

    // 2. Navigation / Tool Request
    for (const tool of this.tools) {
      if (tool.keywords.some(k => lower.includes(k)) || lower.includes(tool.name.toLowerCase())) {
        if (lower.includes('open') || lower.includes('go to') || lower.includes('take me') || lower.includes('navigate')) {
          this.navigateTo(tool.route, tool.name);
          return {
            text: `Opening ${tool.name} for you right away! 🚀`,
            pose: 'pointing'
          };
        }

        return {
          text: `**${tool.name}**\n${tool.description}\n\nWould you like me to open it for you?`,
          pose: 'explaining',
          toolSuggestion: tool
        };
      }
    }

    // 3. Greetings
    if (
      lower.startsWith('hi') ||
      lower.startsWith('hello') ||
      lower.startsWith('hey') ||
      lower === 'hi' ||
      lower === 'hello'
    ) {
      return {
        text: "Hello there! 👋 I'm here to help you navigate U2 Tools, change themes, or answer any questions about our applications.",
        pose: 'idle'
      };
    }

    // 4. "What can you do?" / Help
    if (lower.includes('what can you do') || lower.includes('help') || lower.includes('features')) {
      return {
        text: "Here is what I can do for you:\n• **Change Themes**: Select between Light, Dark, Blue, Green, or Pink\n• **Tool Navigation**: Ask me to open Standup Note, Work Tracker, HTML Viewer, Lodge Booking, etc.\n• **Application Guidance**: Ask how any tool works or how to use Excel imports\n• **Voice Interaction**: Talk to me anytime using the microphone!",
        pose: 'explaining'
      };
    }

    // 5. Query Python backend LLM if available
    try {
      const pythonResponse = await this.queryBackendLLM(input);
      if (pythonResponse) {
        return {
          text: pythonResponse,
          pose: 'speaking'
        };
      }
    } catch {
      // Fallback to intelligent local response
    }

    // Fallback response
    return {
      text: `I'm happy to assist you with U2 Tools! You can ask me to change the theme (Light, Dark, Blue, Green, Pink) or open tools like Standup Note, Lodge Booking, Estimator App, and more.`,
      pose: 'explaining'
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

  // ── Speech Synthesis (TTS) with Lip-Sync ──────────────────────────

  speakText(text: string): void {
    if (this.isMuted() || !this.synth) return;

    try {
      this.synth.cancel();

      // Clean markdown tags for spoken voice
      const clean = text
        .replace(/[*_#`~[\]]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[✅🚀👋•]/g, '');

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.1;

      // Select natural female voice if available
      const voices = this.synth.getVoices();
      const femaleVoice = voices.find(
        v =>
          (v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google UK English Female')) &&
          v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en'));

      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking.set(true);
        if (this.currentPose() === 'idle') {
          this.setPose('speaking');
        }
      };

      utterance.onend = () => {
        this.isSpeaking.set(false);
        this.setPose('idle');
      };

      utterance.onerror = () => {
        this.isSpeaking.set(false);
      };

      this.synth.speak(utterance);
    } catch {
      this.isSpeaking.set(false);
    }
  }

  stopSpeaking(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking.set(false);
  }

  // ── Backend LLM Caller ───────────────────────────────────────────

  private async queryBackendLLM(prompt: string): Promise<string | null> {
    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const endpoints = [
      `${pythonBase}/api/standup-ai/chat`,
      '/api/standup-ai/chat',
      'http://127.0.0.1:8000/api/standup-ai/chat',
      'http://localhost:8000/api/standup-ai/chat'
    ];

    const body = {
      message: prompt,
      history: this.messages().slice(-6).map(m => ({
        role: m.sender === 'assistant' ? 'assistant' : 'user',
        content: m.text
      })),
      system_instructions:
        "You are the friendly, intelligent female U2 Assistant for the U2 Tools website. You help users navigate tools like Standup Note, Lodge Booking, Estimator, HTML Viewer, Work Tracker, and answer questions concisely and warmly. If users ask about themes, inform them that you can switch themes between Light, Dark, Blue, Green, and Pink."
    };

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.response) {
            return data.response;
          }
        }
      } catch {
        // Try next endpoint
      }
    }

    return null;
  }
}

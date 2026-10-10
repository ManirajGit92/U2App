import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';

export type AiProvider = 'openai' | 'gemini' | 'anthropic';
export type AiModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-haiku-20240307';

export interface AiConfig {
  provider: AiProvider;
  model: AiModel;
  apiKey: string;
  systemInstructions: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  extractionSummary?: ExtractionSummary;
  attachmentName?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pinned: boolean;
  extractedData?: ExtractedData;
}

export interface ExtractionSummary {
  standupNotes: number;
  employees: number;
  projects: number;
  tasks: number;
  leaves: number;
  reminders: number;
  meetings: number;
}

export interface ExtractedItem {
  id: string;
  category: 'standup' | 'employee' | 'project' | 'task' | 'leave' | 'reminder' | 'meeting';
  data: Record<string, any>;
  sourceContext: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  isExisting: boolean;
  existingId?: string;
  edited?: boolean;
}

export interface ExtractedData {
  items: ExtractedItem[];
  extractedAt: string;
  sourceText: string;
}

const AI_STORAGE_KEY_PREFIX = 'u2app.aiAssistant';

export const DEFAULT_SYSTEM_INSTRUCTIONS = `You are an AI assistant integrated with U2Tools Standup Note application.
Your job is to analyze meeting transcripts or standup summaries and extract structured data.

When analyzing a transcript or summary, extract:
1. Standup Notes: For each person mentioned, extract employee name, date, previous work done, today plan, and blockers.
2. Employees: Any new employees mentioned with name, position/role, team.
3. Projects: Any project names with status and description.
4. Tasks: Specific tasks or action items with assignee and deadline.
5. Leave: Any mentions of leave, time off, or absence with employee name, dates, reason.
6. Reminders: Any follow-ups or pending items that need to be tracked.
7. Meetings: Any upcoming meetings with title, date/time, attendees.

Respond ONLY with valid JSON in this structure:
{
  "summary": "Brief natural language summary",
  "items": [
    {
      "category": "standup",
      "data": { "employeeName": "...", "date": "YYYY-MM-DD", "previousWork": "...", "todayPlan": "...", "blockers": "...", "notes": "...", "projectName": "..." },
      "sourceContext": "quote from transcript",
      "confidence": 85
    }
  ]
}

Category data fields:
- standup: employeeName, date, previousWork, todayPlan, blockers, notes, projectName
- employee: name, position, team, email
- project: name, status (Active/On Hold/Completed), notes, lead
- task: title, employeeName, projectName, description, endDate, priority (important-urgent/important-not-urgent/urgent-not-important/not-important-not-urgent)
- leave: employeeName, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), reason, leaveType (planned/unplanned/sick/vacation/wfh), duration (full-day/half-day-first/half-day-second)
- reminder: title, description, deadline (YYYY-MM-DD), priority (High/Medium/Low), assignedTo
- meeting: title, description, date (YYYY-MM-DD), time (HH:MM), attendees`;

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private get storageKey(): string {
    const uid = this.authService.user()?.uid;
    return uid ? `${AI_STORAGE_KEY_PREFIX}.${uid}` : AI_STORAGE_KEY_PREFIX;
  }

  private get configKey(): string {
    return `${this.storageKey}.config`;
  }

  private sessionsSubject = new BehaviorSubject<ChatSession[]>(this.loadSessions());
  sessions$ = this.sessionsSubject.asObservable();

  readonly isProcessing = signal(false);
  readonly error = signal<string | null>(null);

  private _activeSessionId = signal<string | null>(null);
  readonly activeSessionId = this._activeSessionId.asReadonly();

  private _config = signal<AiConfig>(this.loadConfig());
  readonly config = this._config.asReadonly();

  get sessions(): ChatSession[] {
    return this.sessionsSubject.value;
  }

  get activeSession(): ChatSession | null {
    const id = this._activeSessionId();
    return id ? this.sessions.find((s) => s.id === id) ?? null : null;
  }

  getPinnedSessions(): ChatSession[] {
    return this.sessions
      .filter((s) => s.pinned)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getRecentSessions(): ChatSession[] {
    return this.sessions
      .filter((s) => !s.pinned)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  createNewSession(): ChatSession {
    const id = `chat-${Date.now()}`;
    const session: ChatSession = {
      id,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pinned: false,
    };
    this.sessionsSubject.next([session, ...this.sessions]);
    this._activeSessionId.set(id);
    this.persistSessions();
    return session;
  }

  setActiveSession(id: string) {
    this._activeSessionId.set(id);
  }

  deleteSession(id: string) {
    const remaining = this.sessions.filter((s) => s.id !== id);
    this.sessionsSubject.next(remaining);
    if (this._activeSessionId() === id) {
      this._activeSessionId.set(remaining[0]?.id ?? null);
    }
    this.persistSessions();
  }

  togglePin(id: string) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
    );
    this.persistSessions();
  }

  renameSession(id: string, title: string) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === id ? { ...s, title } : s))
    );
    this.persistSessions();
  }

  searchSessions(query: string): ChatSession[] {
    const q = query.toLowerCase();
    return this.sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }

  async sendMessage(content: string, attachmentName?: string): Promise<void> {
    let session = this.activeSession;
    if (!session) {
      session = this.createNewSession();
    }

    const cfg = this._config();
    if (!cfg.apiKey) {
      this.error.set('API key is not configured. Please add your API key in Settings.');
      return;
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachmentName,
    };

    this.addMessage(session.id, userMsg);
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const historyExcludingLatest = this.sessions
        .find((s) => s.id === session!.id)
        ?.messages.slice(0, -1) ?? [];
      const responseText = await this.callAI(content, historyExcludingLatest, cfg);
      const parsed = this.parseAIResponse(responseText);

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: parsed.summary || responseText,
        timestamp: new Date().toISOString(),
        extractionSummary:
          parsed.items && parsed.items.length > 0
            ? this.buildExtractionSummary(parsed.items)
            : undefined,
      };

      this.addMessage(session.id, assistantMsg);

      if (parsed.items && parsed.items.length > 0) {
        const extractedData: ExtractedData = {
          items: parsed.items.map((item: any, idx: number) => ({
            id: `ei-${Date.now()}-${idx}`,
            category: item.category,
            data: item.data || {},
            sourceContext: item.sourceContext || '',
            confidence: item.confidence || 75,
            status: 'pending' as const,
            isExisting: false,
          })),
          extractedAt: new Date().toISOString(),
          sourceText: content,
        };
        this.updateSessionExtractedData(session.id, extractedData);
      }

      const currentSession = this.sessions.find((s) => s.id === session!.id);
      if (currentSession && currentSession.title === 'New Chat') {
        const title = content.substring(0, 50).trim() + (content.length > 50 ? '...' : '');
        this.renameSession(session.id, title);
      }
    } catch (err: any) {
      this.error.set(err.message || 'Failed to get AI response.');
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get AI response. Please check your API key and try again.'}`,
        timestamp: new Date().toISOString(),
      };
      this.addMessage(session.id, errMsg);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async callAI(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    switch (cfg.provider) {
      case 'gemini':
        return this.callGemini(userMessage, history, cfg);
      case 'anthropic':
        return this.callAnthropic(userMessage, history, cfg);
      default:
        return this.callOpenAI(userMessage, history, cfg);
    }
  }

  private async callOpenAI(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    const messages = [
      { role: 'system', content: cfg.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2 }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as any)?.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  private async callGemini(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    const contents = [
      ...history.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: cfg.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS }],
        },
        contents,
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as any)?.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async callAnthropic(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 4096,
        system: cfg.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
        messages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        (errData as any)?.error?.message || `Anthropic API error: ${response.status}`
      );
    }

    const data = await response.json() as any;
    return data.content?.[0]?.text || '';
  }

  private parseAIResponse(text: string): { summary: string; items: any[] } {
    const jsonMatch =
      text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return { summary: parsed.summary || text, items: parsed.items || [] };
      } catch {
        // fall through
      }
    }
    try {
      const parsed = JSON.parse(text);
      return { summary: parsed.summary || text, items: parsed.items || [] };
    } catch {
      return { summary: text, items: [] };
    }
  }

  private buildExtractionSummary(items: any[]): ExtractionSummary {
    return {
      standupNotes: items.filter((i) => i.category === 'standup').length,
      employees: items.filter((i) => i.category === 'employee').length,
      projects: items.filter((i) => i.category === 'project').length,
      tasks: items.filter((i) => i.category === 'task').length,
      leaves: items.filter((i) => i.category === 'leave').length,
      reminders: items.filter((i) => i.category === 'reminder').length,
      meetings: items.filter((i) => i.category === 'meeting').length,
    };
  }

  updateItemStatus(sessionId: string, itemId: string, status: ExtractedItem['status']) {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId || !s.extractedData) return s;
        return {
          ...s,
          extractedData: {
            ...s.extractedData,
            items: s.extractedData.items.map((item) =>
              item.id === itemId ? { ...item, status } : item
            ),
          },
        };
      })
    );
    this.persistSessions();
  }

  updateItemData(sessionId: string, itemId: string, data: Record<string, any>) {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId || !s.extractedData) return s;
        return {
          ...s,
          extractedData: {
            ...s.extractedData,
            items: s.extractedData.items.map((item) =>
              item.id === itemId ? { ...item, data, edited: true } : item
            ),
          },
        };
      })
    );
    this.persistSessions();
  }

  markDuplicates(
    sessionId: string,
    existingData: { employees: any[]; projects: any[]; reminders: any[] }
  ) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session?.extractedData) return;

    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId || !s.extractedData) return s;
        return {
          ...s,
          extractedData: {
            ...s.extractedData,
            items: s.extractedData.items.map((item) => {
              if (item.category === 'employee') {
                const existing = existingData.employees.find(
                  (e) => e.name?.toLowerCase() === item.data['name']?.toLowerCase()
                );
                return existing ? { ...item, isExisting: true, existingId: existing.id } : item;
              }
              if (item.category === 'project') {
                const existing = existingData.projects.find(
                  (p) => p.name?.toLowerCase() === item.data['name']?.toLowerCase()
                );
                return existing ? { ...item, isExisting: true, existingId: existing.id } : item;
              }
              if (item.category === 'reminder') {
                const existing = existingData.reminders.find(
                  (r) => r.title?.toLowerCase() === item.data['title']?.toLowerCase()
                );
                return existing ? { ...item, isExisting: true, existingId: existing.id } : item;
              }
              return item;
            }),
          },
        };
      })
    );
    this.persistSessions();
  }

  updateConfig(config: Partial<AiConfig>) {
    const newConfig = { ...this._config(), ...config };
    this._config.set(newConfig);
    this.persistConfig(newConfig);
  }

  getDefaultSystemInstructions(): string {
    return DEFAULT_SYSTEM_INSTRUCTIONS;
  }

  private addMessage(sessionId: string, msg: ChatMessage) {
    this.sessionsSubject.next(
      this.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, msg], updatedAt: new Date().toISOString() }
          : s
      )
    );
    this.persistSessions();
  }

  private updateSessionExtractedData(sessionId: string, data: ExtractedData) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === sessionId ? { ...s, extractedData: data } : s))
    );
    this.persistSessions();
  }

  private persistSessions() {
    try {
      const toStore = this.sessions.slice(0, 50);
      localStorage.setItem(this.storageKey, JSON.stringify(toStore));
    } catch (e) {
      console.error('AiAssistantService: failed to persist sessions', e);
    }
  }

  private loadSessions(): ChatSession[] {
    try {
      const uid = this.authService.user()?.uid;
      const key = uid ? `${AI_STORAGE_KEY_PREFIX}.${uid}` : AI_STORAGE_KEY_PREFIX;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('AiAssistantService: failed to load sessions', e);
    }
    return [];
  }

  private persistConfig(config: AiConfig) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(config));
    } catch (e) {
      console.error('AiAssistantService: failed to persist config', e);
    }
  }

  private loadConfig(): AiConfig {
    try {
      const uid = this.authService.user()?.uid;
      const key = `${uid ? `${AI_STORAGE_KEY_PREFIX}.${uid}` : AI_STORAGE_KEY_PREFIX}.config`;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('AiAssistantService: failed to load config', e);
    }
    return {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: '',
      systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
    };
  }

  reloadForUser() {
    this.sessionsSubject.next(this.loadSessions());
    this._config.set(this.loadConfig());
  }
}

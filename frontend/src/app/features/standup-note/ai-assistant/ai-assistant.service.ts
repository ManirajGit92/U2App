import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { environment } from '../../../../environments/environment';

export type AiProvider = 'foundry' | 'openai' | 'gemini' | 'anthropic';
export type AiModel =
  | 'gpt-5.6-luna'
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
  weeklyStatus: number;
  projectStatus: number;
  workLogs: number;
  tasks: number;
  leaves: number;
  reminders: number;
  meetings: number;
}

export type ExtractedCategory =
  | 'standup'
  | 'employee'
  | 'project'
  | 'weekly-status'
  | 'project-status'
  | 'work-log'
  | 'task'
  | 'leave'
  | 'reminder'
  | 'meeting';

export interface ExtractedItem {
  id: string;
  category: ExtractedCategory;
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
  rawJson?: string;
}

const AI_STORAGE_KEY_PREFIX = 'u2app.aiAssistant';

export const DEFAULT_SYSTEM_INSTRUCTIONS = `You are an AI assistant integrated with U2Tools Work Tracker & Standup Note application.
Your job is to analyze weekly status updates, project status updates, work logs, transcripts, or tabular/Excel data and extract structured records.

When analyzing input, extract items belonging to these categories:
1. Weekly Status (category: "weekly-status"): Weekly developer tasks or sprint tracking items.
   Fields: taskId, week (e.g. W1, W2, W3), resourceName, projectName, module, taskTitle, taskDescription, taskType (Feature/Bug/Enhancement/Architecture/Documentation), status (Completed/In Progress/Pending/Blocked), priority (Critical/High/Medium/Low), size (XS/S/M/L/XL), hours (number), progress (0-100), startDate (YYYY-MM-DD), dueDate (YYYY-MM-DD), completedDate (YYYY-MM-DD), tags, comments
2. Project Status (category: "project-status"): Project/release tracks, milestones, or epic tracking.
   Fields: id, title, category, module, type (Feature/Enhancement/Refactor/Bugfix), priority (Critical/High/Medium/Low), status (Released/Testing/Development/Staging/Backlog), prdStatus (Approved/In Review/Draft/Pending), environment (Production/Beta/Staging/Dev/Alpha), assignedTo, createdDate (YYYY-MM-DD), targetDate (YYYY-MM-DD), completedDate (YYYY-MM-DD), progress (0-100), remarks, dependency, tags
3. Work Logs (category: "work-log"): Hourly work track updates or activity logs.
   Fields: id, date (YYYY-MM-DD), hour (e.g. 09:00 AM - 10:00 AM), taskDescription, status (Completed/In Progress/Pending), projectName
4. Standup Notes (category: "standup"): Daily standup updates.
   Fields: employeeName, date (YYYY-MM-DD), previousWork, todayPlan, blockers, notes, projectName
5. Employees (category: "employee"): Team members.
   Fields: name, position, team, email
6. Projects (category: "project"): Project portfolio.
   Fields: name, status (Active/On Hold/Completed), notes, lead
7. Tasks (category: "task"): Individual task assignments.
   Fields: title, employeeName, projectName, description, endDate (YYYY-MM-DD), priority
8. Leave (category: "leave"): Time off and absence records.
   Fields: employeeName, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), reason, leaveType (planned/unplanned/sick/vacation/wfh), duration (full-day/half-day-first/half-day-second)
9. Reminders (category: "reminder"): Follow-up action items.
   Fields: title, description, deadline (YYYY-MM-DD), priority (High/Medium/Low), assignedTo
10. Meetings (category: "meeting"): Upcoming meetings and calendar events.
   Fields: title, description, date (YYYY-MM-DD), time (HH:MM), attendees

Respond ONLY with valid JSON in this structure:
{
  "summary": "Brief natural language summary of the extracted records",
  "items": [
    {
      "category": "weekly-status",
      "data": { "taskId": "T-101", "week": "W1", "resourceName": "...", "projectName": "...", "taskTitle": "...", "status": "In Progress" },
      "sourceContext": "quote or row from input",
      "confidence": 95
    }
  ]
};`;


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

  clearAllSessions() {
    const id = `chat-${Date.now()}`;
    const freshSession: ChatSession = {
      id,
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pinned: false,
    };
    this.sessionsSubject.next([freshSession]);
    this._activeSessionId.set(id);
    this.persistSessions();
  }

  clearSessionExtractedData(sessionId: string) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === sessionId ? { ...s, extractedData: undefined } : s))
    );
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
    // Do not restrict if API key is not configured in frontend.
    // The backend Python service (standup_note/ai_assistent.py) handles the request with the backend API key.

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

    // Pre-parse tabular or Excel data if present
    const tabularResult = this.parseExcelOrTabularContent(content);

    try {
      const historyExcludingLatest = this.sessions
        .find((s) => s.id === session!.id)
        ?.messages.slice(0, -1) ?? [];

      let responseText = '';
      let parsed: { summary: string; items: any[] } = { summary: '', items: [] };

      try {
        responseText = await this.callAI(content, historyExcludingLatest, cfg);
        parsed = this.parseAIResponse(responseText);
      } catch (aiErr: any) {
        if (!tabularResult || tabularResult.items.length === 0) {
          throw aiErr;
        }
        responseText = tabularResult.summary;
        parsed = tabularResult;
      }

      // If AI returned no items or empty items, but tabular parser extracted items, use tabularResult!
      if ((!parsed.items || parsed.items.length === 0) && tabularResult && tabularResult.items.length > 0) {
        parsed = {
          summary: parsed.summary && parsed.summary !== responseText ? parsed.summary : tabularResult.summary,
          items: tabularResult.items,
        };
      }

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
            confidence: item.confidence || 90,
            status: 'pending' as const,
            isExisting: false,
          })),
          extractedAt: new Date().toISOString(),
          sourceText: content,
          rawJson: JSON.stringify({ summary: parsed.summary, items: parsed.items }, null, 2),
        };
        this.updateSessionExtractedData(session.id, extractedData);
      }

      const currentSession = this.sessions.find((s) => s.id === session!.id);
      if (currentSession && currentSession.title === 'New Chat') {
        const title = content.substring(0, 50).trim() + (content.length > 50 ? '...' : '');
        this.renameSession(session.id, title);
      }
    } catch (err: any) {
      if (tabularResult && tabularResult.items.length > 0) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: tabularResult.summary,
          timestamp: new Date().toISOString(),
          extractionSummary: this.buildExtractionSummary(tabularResult.items),
        };
        this.addMessage(session.id, assistantMsg);
        const extractedData: ExtractedData = {
          items: tabularResult.items.map((item: any, idx: number) => ({
            id: `ei-${Date.now()}-${idx}`,
            category: item.category,
            data: item.data || {},
            sourceContext: item.sourceContext || '',
            confidence: item.confidence || 95,
            status: 'pending' as const,
            isExisting: false,
          })),
          extractedAt: new Date().toISOString(),
          sourceText: content,
          rawJson: JSON.stringify({ summary: tabularResult.summary, items: tabularResult.items }, null, 2),
        };
        this.updateSessionExtractedData(session.id, extractedData);
      } else {
        this.error.set(err.message || 'Failed to get AI response.');
        const errMsg: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to get AI response. Please check your API key and try again.'}`,
          timestamp: new Date().toISOString(),
        };
        this.addMessage(session.id, errMsg);
      }
    } finally {
      this.isProcessing.set(false);
    }
  }


  private async callAI(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    // If provider is foundry, or if no frontend API key is set, route to backend Python service
    if (cfg.provider === 'foundry' || !cfg.apiKey) {
      return this.callFoundryBackend(userMessage, history, cfg);
    }

    switch (cfg.provider) {
      case 'gemini':
        return this.callGemini(userMessage, history, cfg);
      case 'anthropic':
        return this.callAnthropic(userMessage, history, cfg);
      default:
        return this.callOpenAI(userMessage, history, cfg);
    }
  }

  private async callFoundryBackend(
    userMessage: string,
    history: ChatMessage[],
    cfg: AiConfig
  ): Promise<string> {
    const payload = {
      message: userMessage,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      system_instructions: cfg.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
      model: cfg.model || 'gpt-5.6-luna',
      api_key: cfg.apiKey || undefined,
    };

    const pythonBase = (environment.pythonApiBaseUrl || 'https://u2tools.onrender.com').replace(/\/+$/, '');
    const endpoints = [
      `${pythonBase}/api/standup-ai/chat`,
      `${pythonBase}/api/chat`,
      `${pythonBase}/chat`,
      '/api/standup-ai/chat',
      '/api/chat',
      'http://127.0.0.1:8000/api/standup-ai/chat',
      'http://localhost:8000/api/standup-ai/chat',
      'http://127.0.0.1:8000/api/chat',
      'http://localhost:8000/api/chat',
    ];

    let lastError: any = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data && data.response) {
            return data.response;
          }
          if (typeof data === 'string') {
            return data;
          }
        } else {
          const errData = (await response.json().catch(() => ({}))) as any;
          lastError = new Error(
            errData?.detail || errData?.message || `Backend error: ${response.status}`
          );
          if (response.status !== 404) {
            throw lastError;
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw (
      lastError ||
      new Error(
        `Failed to connect to Python backend service at ${pythonBase} (or local http://127.0.0.1:8000). Please ensure standup_note/ai_assistent.py is running.`
      )
    );
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
      text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return { summary: text, items: parsed };
        }
        return { summary: parsed.summary || text, items: parsed.items || [] };
      } catch {
        // fall through
      }
    }
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return { summary: text, items: parsed };
      }
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
      weeklyStatus: items.filter((i) => i.category === 'weekly-status').length,
      projectStatus: items.filter((i) => i.category === 'project-status').length,
      workLogs: items.filter((i) => i.category === 'work-log').length,
      tasks: items.filter((i) => i.category === 'task').length,
      leaves: items.filter((i) => i.category === 'leave').length,
      reminders: items.filter((i) => i.category === 'reminder').length,
      meetings: items.filter((i) => i.category === 'meeting').length,
    };
  }

  /**
   * Automatically parses Excel-pasted text (TSV), CSV, or Markdown tables
   * into structured records and valid JSON.
   */
  parseExcelOrTabularContent(text: string): { summary: string; items: any[] } | null {
    if (!text || !text.trim()) return null;

    // Check if there are sheet markers: "=== Sheet: ..."
    const sheetRegex = /=== Sheet:\s*([^\n=]+)\s*===/gi;
    let match: RegExpExecArray | null;
    const sheetMatches: { name: string; index: number; fullLen: number }[] = [];
    while ((match = sheetRegex.exec(text)) !== null) {
      sheetMatches.push({ name: match[1].trim(), index: match.index, fullLen: match[0].length });
    }

    const allItems: any[] = [];

    if (sheetMatches.length > 0) {
      for (let i = 0; i < sheetMatches.length; i++) {
        const cur = sheetMatches[i];
        const start = cur.index + cur.fullLen;
        const end = i + 1 < sheetMatches.length ? sheetMatches[i + 1].index : text.length;
        const sheetBody = text.substring(start, end).trim();
        const sheetItems = this.parseSingleTabularText(sheetBody, cur.name);
        allItems.push(...sheetItems);
      }
    } else {
      const parsed = this.parseSingleTabularText(text, '');
      allItems.push(...parsed);
    }

    if (allItems.length === 0) return null;

    const catCounts = new Map<string, number>();
    for (const item of allItems) {
      catCounts.set(item.category, (catCounts.get(item.category) || 0) + 1);
    }
    const catBreakdown = Array.from(catCounts.entries())
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');

    return {
      summary: `Successfully parsed ${allItems.length} record${allItems.length === 1 ? '' : 's'} from Excel/tabular data (${catBreakdown}).`,
      items: allItems,
    };
  }

  private parseSingleTabularText(body: string, sheetContext: string): any[] {
    const rawLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('[File:') && !l.startsWith('#'));

    if (rawLines.length < 2) return [];

    let headerLineIndex = -1;
    let delimiter = '';

    for (let i = 0; i < Math.min(rawLines.length, 5); i++) {
      const line = rawLines[i];
      if (line.includes('\t')) {
        delimiter = '\t';
        headerLineIndex = i;
        break;
      } else if (line.includes('|')) {
        delimiter = '|';
        headerLineIndex = i;
        break;
      } else if (line.includes(',')) {
        delimiter = ',';
        headerLineIndex = i;
        break;
      } else if (line.includes(';')) {
        delimiter = ';';
        headerLineIndex = i;
        break;
      }
    }

    if (headerLineIndex === -1 || !delimiter) return [];

    const splitRow = (rowStr: string): string[] => {
      if (delimiter === '|') {
        return rowStr
          .split('|')
          .map((c) => c.trim())
          .filter((_, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2);
      }
      if (delimiter === ',') {
        const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
        const matches: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = regex.exec(rowStr)) !== null) {
          matches.push((m[1] !== undefined ? m[1] : m[2] || '').trim());
        }
        return matches;
      }
      return rowStr.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    };

    const headerCells = splitRow(rawLines[headerLineIndex]).map((h) =>
      h.toLowerCase().replace(/[\s_\-#]+/g, '')
    );
    if (headerCells.length < 2) return [];

    // Identify category
    const sContext = sheetContext.toLowerCase();
    let category: ExtractedCategory = 'weekly-status';

    const hasHeader = (...keys: string[]) => keys.some((k) => headerCells.some((h) => h.includes(k)));

    if (
      sContext.includes('weekly') ||
      sContext.includes('developer') ||
      hasHeader('taskid', 'week', 'resourcename', 'tasktitle', 'tasktype')
    ) {
      category = 'weekly-status';
    } else if (
      sContext.includes('release') ||
      sContext.includes('projectstatus') ||
      sContext.includes('prd') ||
      hasHeader('prdstatus', 'releasetrack', 'targetdate', 'environment')
    ) {
      category = 'project-status';
    } else if (
      sContext.includes('hourly') ||
      sContext.includes('hour') ||
      sContext.includes('worklog') ||
      hasHeader('hour', 'timeslot', 'hourly')
    ) {
      category = 'work-log';
    } else if (
      sContext.includes('standup') ||
      hasHeader('previouswork', 'todayplan', 'yesterday', 'today', 'blocker', 'blockers')
    ) {
      category = 'standup';
    } else if (
      sContext.includes('employee') ||
      hasHeader('position', 'team') ||
      (hasHeader('name', 'email') && !hasHeader('task'))
    ) {
      category = 'employee';
    } else if (
      sContext.includes('leave') ||
      hasHeader('leave', 'fromdate', 'todate', 'leavetype')
    ) {
      category = 'leave';
    } else if (
      sContext.includes('project') ||
      hasHeader('lead') ||
      (hasHeader('projectname', 'status') && !hasHeader('week', 'resource'))
    ) {
      category = 'project';
    } else if (hasHeader('assignedto', 'duedate', 'deadline')) {
      category = 'task';
    }

    const items: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let r = headerLineIndex + 1; r < rawLines.length; r++) {
      const line = rawLines[r];
      if (/^[|\-\s:]+$/.test(line)) continue;

      const cells = splitRow(line);
      if (cells.length === 0 || cells.every((c) => !c)) continue;

      const rowMap: Record<string, string> = {};
      headerCells.forEach((h, idx) => {
        if (cells[idx] !== undefined) {
          rowMap[h] = cells[idx];
        }
      });

      const getVal = (...keys: string[]): string => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[\s_\-#]+/g, '');
          for (const h of headerCells) {
            if (h === cleanK || h.includes(cleanK)) {
              if (rowMap[h]) return rowMap[h];
            }
          }
        }
        return '';
      };

      let itemData: Record<string, any> = {};

      if (category === 'weekly-status') {
        const rawProgress = parseFloat(getVal('progress', '%', 'pct')) || 0;
        const rawHours = parseFloat(getVal('hours', 'hrs', 'hour')) || 8;
        itemData = {
          taskId: getVal('taskid', 'id', 'task') || `T-${Date.now().toString().slice(-4)}-${items.length + 1}`,
          week: getVal('week', 'sprint') || 'W1',
          resourceName: getVal('resourcename', 'resource', 'employee', 'name', 'developer', 'assignee') || 'Team Member',
          projectName: getVal('projectname', 'project') || 'Main Project',
          module: getVal('module', 'feature', 'component') || 'General',
          taskTitle: getVal('tasktitle', 'title', 'task', 'description', 'summary') || 'Weekly Task',
          taskDescription: getVal('taskdescription', 'description', 'details') || getVal('tasktitle', 'title') || '',
          taskType: getVal('tasktype', 'type') || 'Feature',
          status: getVal('status', 'state') || 'In Progress',
          priority: getVal('priority') || 'Medium',
          size: getVal('size', 'sp') || 'M',
          hours: isNaN(rawHours) ? 8 : rawHours,
          progress: isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress)),
          startDate: getVal('startdate', 'start') || today,
          dueDate: getVal('duedate', 'due', 'targetdate', 'target') || today,
          completedDate: getVal('completeddate', 'completed') || '',
          tags: getVal('tags', 'tag') || '',
          comments: getVal('comments', 'comment', 'notes', 'remarks') || '',
        };
      } else if (category === 'project-status') {
        const rawProgress = parseFloat(getVal('progress', '%', 'pct')) || 0;
        itemData = {
          id: getVal('id', 'releaseid', 'trackid') || `R-${Date.now().toString().slice(-3)}-${items.length + 1}`,
          title: getVal('title', 'name', 'release', 'project') || 'Release Track',
          category: getVal('category', 'stream') || 'Platform',
          module: getVal('module', 'component') || 'Core',
          type: getVal('type', 'tracktype') || 'Feature',
          priority: getVal('priority') || 'High',
          status: getVal('status', 'state') || 'Development',
          prdStatus: getVal('prdstatus', 'prd') || 'Approved',
          environment: getVal('environment', 'env') || 'Staging',
          assignedTo: getVal('assignedto', 'lead', 'owner', 'resource') || 'Lead',
          createdDate: getVal('createddate', 'created') || today,
          targetDate: getVal('targetdate', 'target', 'duedate', 'due') || today,
          completedDate: getVal('completeddate', 'completed') || '',
          progress: isNaN(rawProgress) ? 0 : Math.min(100, Math.max(0, rawProgress)),
          remarks: getVal('remarks', 'notes', 'comment') || '',
          dependency: getVal('dependency', 'dependencies') || '',
          tags: getVal('tags', 'tag') || '',
        };
      } else if (category === 'work-log') {
        itemData = {
          id: getVal('id') || `HU-${Date.now().toString().slice(-4)}-${items.length + 1}`,
          date: getVal('date', 'day') || today,
          hour: getVal('hour', 'time', 'timeslot', 'slot') || '09:00 AM - 10:00 AM',
          taskDescription: getVal('taskdescription', 'description', 'task', 'activity', 'notes') || 'Development activity',
          status: (getVal('status') as any) || 'Completed',
          projectName: getVal('projectname', 'project') || 'Work Tracker',
        };
      } else if (category === 'employee') {
        itemData = {
          name: getVal('name', 'employeename', 'employee') || 'New Employee',
          position: getVal('position', 'role', 'title') || 'Engineer',
          team: getVal('team', 'department') || 'Engineering',
          email: getVal('email') || '',
        };
      } else if (category === 'project') {
        itemData = {
          name: getVal('name', 'projectname', 'title') || 'New Project',
          status: getVal('status') || 'Active',
          lead: getVal('lead', 'owner', 'manager') || '',
          notes: getVal('notes', 'description') || '',
        };
      } else if (category === 'leave') {
        itemData = {
          employeeName: getVal('employeename', 'employee', 'name') || 'Employee',
          fromDate: getVal('fromdate', 'from', 'startdate') || today,
          toDate: getVal('todate', 'to', 'enddate') || today,
          leaveType: getVal('leavetype', 'type') || 'planned',
          duration: getVal('duration') || 'full-day',
          reason: getVal('reason', 'notes') || 'Personal',
        };
      } else if (category === 'task') {
        itemData = {
          title: getVal('title', 'task', 'summary') || 'Task Item',
          employeeName: getVal('employeename', 'employee', 'assignee', 'name') || '',
          projectName: getVal('projectname', 'project') || '',
          description: getVal('description', 'details') || '',
          endDate: getVal('enddate', 'duedate', 'deadline') || today,
          priority: getVal('priority') || 'important-not-urgent',
        };
      } else {
        itemData = {
          employeeName: getVal('employeename', 'employee', 'name') || 'Team Member',
          date: getVal('date') || today,
          previousWork: getVal('previouswork', 'yesterday') || '',
          todayPlan: getVal('todayplan', 'today') || line,
          blockers: getVal('blockers', 'blocker') || 'None',
          notes: getVal('notes') || '',
          projectName: getVal('projectname', 'project') || '',
        };
      }

      items.push({
        category,
        data: itemData,
        sourceContext: line.length > 80 ? line.substring(0, 80) + '...' : line,
        confidence: 98,
      });
    }

    return items;
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
    existingData: {
      employees: any[];
      projects: any[];
      reminders: any[];
      developerTasks?: any[];
      releaseTracks?: any[];
      hourlyUpdates?: any[];
      tasks?: any[];
      leaveRecords?: any[];
    }
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
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'project') {
                const existing = existingData.projects.find(
                  (p) => p.name?.toLowerCase() === item.data['name']?.toLowerCase()
                );
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'weekly-status') {
                const existing = (existingData.developerTasks || []).find((t) => {
                  if (item.data['taskId'] && t.taskId?.toLowerCase() === item.data['taskId']?.toLowerCase()) {
                    return true;
                  }
                  const sameResource = t.resourceName?.toLowerCase() === item.data['resourceName']?.toLowerCase();
                  const sameTitle = t.taskTitle?.toLowerCase() === item.data['taskTitle']?.toLowerCase();
                  const sameWeek = !item.data['week'] || t.week?.toLowerCase() === item.data['week']?.toLowerCase();
                  return sameResource && sameTitle && sameWeek;
                });
                return existing ? { ...item, isExisting: true, existingId: existing.taskId } : { ...item, isExisting: false };
              }
              if (item.category === 'project-status') {
                const existing = (existingData.releaseTracks || []).find((r) => {
                  if (item.data['id'] && r.id?.toLowerCase() === item.data['id']?.toLowerCase()) {
                    return true;
                  }
                  const sameTitle = r.title?.toLowerCase() === item.data['title']?.toLowerCase();
                  const sameModule = !item.data['module'] || r.module?.toLowerCase() === item.data['module']?.toLowerCase();
                  return sameTitle && sameModule;
                });
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'work-log') {
                const existing = (existingData.hourlyUpdates || []).find((h) => {
                  if (item.data['id'] && h.id?.toLowerCase() === item.data['id']?.toLowerCase()) {
                    return true;
                  }
                  return (
                    h.date === item.data['date'] &&
                    h.hour === item.data['hour'] &&
                    h.taskDescription?.toLowerCase() === item.data['taskDescription']?.toLowerCase()
                  );
                });
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'task') {
                const existing = (existingData.tasks || []).find((t) => {
                  const sameTitle = t.title?.toLowerCase() === item.data['title']?.toLowerCase();
                  const sameEmp = !item.data['employeeName'] || t.employeeName?.toLowerCase() === item.data['employeeName']?.toLowerCase();
                  return sameTitle && sameEmp;
                });
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'leave') {
                const existing = (existingData.leaveRecords || []).find((l) => {
                  const emp = (existingData.employees || []).find((e) => e.id === l.employeeId);
                  const sameEmp = emp && emp.name?.toLowerCase() === item.data['employeeName']?.toLowerCase();
                  const sameDate = l.fromDate === item.data['fromDate'];
                  return sameEmp && sameDate;
                });
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
              }
              if (item.category === 'reminder') {
                const existing = existingData.reminders.find(
                  (r) => r.title?.toLowerCase() === item.data['title']?.toLowerCase()
                );
                return existing ? { ...item, isExisting: true, existingId: existing.id } : { ...item, isExisting: false };
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

  setSessionExtractedData(sessionId: string, data: ExtractedData) {
    this.updateSessionExtractedData(sessionId, data);
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
      if (data) {
        const parsed = JSON.parse(data);
        return {
          provider: parsed.provider || 'foundry',
          model: parsed.model || 'gpt-5.6-luna',
          apiKey: parsed.apiKey || '',
          systemInstructions: parsed.systemInstructions || DEFAULT_SYSTEM_INSTRUCTIONS,
        };
      }
    } catch (e) {
      console.error('AiAssistantService: failed to load config', e);
    }
    return {
      provider: 'foundry',
      model: 'gpt-5.6-luna',
      apiKey: '',
      systemInstructions: DEFAULT_SYSTEM_INSTRUCTIONS,
    };
  }

  reloadForUser() {
    this.sessionsSubject.next(this.loadSessions());
    this._config.set(this.loadConfig());
  }
}

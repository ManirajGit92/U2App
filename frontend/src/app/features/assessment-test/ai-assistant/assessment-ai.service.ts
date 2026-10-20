import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { environment } from '../../../../environments/environment';
import {
  AssessmentTestService,
  AssessmentQuestion,
  QuestionOption,
  QuestionSet,
  Category,
} from '../assessment-test.service';
import * as XLSX from 'xlsx';

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

export type QuestionDifficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface GeneratedQuestion {
  id: string;
  title: string;
  description?: string;
  type: 'radio' | 'checkbox';
  difficulty: QuestionDifficulty;
  category: string;
  weight: number;
  negativeMark: number;
  options: QuestionOption[];
  correctAnswer?: string;
  correctAnswers?: string[];
  correctAnswerReason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  isDuplicate?: boolean;
  duplicateReason?: string;
  validationErrors?: string[];
  edited?: boolean;
}

export interface GeneratedQuestionSet {
  setName: string;
  categoryName: string;
  description: string;
  difficulty: QuestionDifficulty;
  timerSeconds?: number;
  questions: GeneratedQuestion[];
  rawJson?: string;
  generatedAt: string;
}

export interface AssessmentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachmentName?: string;
  tokens?: number;
  tokensUnavailable?: boolean;
  questionSetSummary?: {
    totalQuestions: number;
    setName: string;
    categoryName: string;
    difficulty: string;
  };
}

export interface AssessmentChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssessmentChatMessage[];
  pinned: boolean;
  generatedSet?: GeneratedQuestionSet;
  totalTokens?: number;
}

export interface AiCallResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensUnavailable?: boolean;
}

const STORAGE_PREFIX = 'u2app.assessmentAiAssistant';
const SHARED_AI_STORAGE_KEY_PREFIX = 'u2app.aiAssistant';

export const DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS = `You are an expert AI Assessment & Exam Generation Assistant integrated into U2Tools Assessment Test.
Your primary mission is to generate high-quality, professional, realistic certification and skill assessment multiple-choice questions.

When given study materials (PDF, Word, documentation, lecture notes, textbook excerpts, syllabus) OR a direct request (e.g. "Create a Microsoft Azure AI-900 certification question set", "Create an expert-level Python question set with 10 questions"):
1. Design clear, unambiguous multiple-choice questions that thoroughly test knowledge, practical scenarios, and core concepts.
2. Provide 4 distinct options for each question (or 4-5 options if multiple choice). Avoid trivial or obviously false distractors.
3. Clearly identify the correct answer:
   - For single-choice questions, set "type" to "radio" and specify "correctAnswer" matching one option's value.
   - For multi-select questions, set "type" to "checkbox", specify "correctAnswers" as an array of matching option values.
4. Provide a rich, detailed, educational "correctAnswerReason" explaining WHY the correct option is right and why the other options are incorrect.
5. Assign an appropriate difficulty ("Beginner", "Intermediate", "Advanced", or "Expert") and a domain category.
6. Suggest a suitable Question Sheet name, Category name, description, and recommended exam duration in seconds (e.g. 60-90 seconds per question).

CRITICAL REQUIREMENT: Respond ONLY with a valid, parseable JSON object matching this exact schema:
{
  "summary": "Brief natural language summary of the generated questions, e.g. 'Generated 10 Microsoft Azure AI-900 certification practice questions covering Computer Vision, NLP, and Machine Learning.'",
  "setName": "Microsoft Azure AI-900 Certification",
  "categoryName": "Cloud & Artificial Intelligence",
  "description": "Comprehensive practice assessment for the Azure AI Fundamentals certification.",
  "difficulty": "Intermediate",
  "timerSeconds": 600,
  "questions": [
    {
      "id": "q1",
      "title": "Which Azure AI service should be used to detect anomalies in time-series data without machine learning expertise?",
      "description": "Select the single best answer.",
      "type": "radio",
      "difficulty": "Intermediate",
      "category": "Machine Learning & AI",
      "weight": 2,
      "negativeMark": 0,
      "options": [
        { "id": "o1", "label": "Azure AI Metrics Advisor", "value": "metrics_advisor" },
        { "id": "o2", "label": "Azure AI Vision", "value": "vision" },
        { "id": "o3", "label": "Azure AI Speech", "value": "speech" },
        { "id": "o4", "label": "Azure AI Document Intelligence", "value": "doc_intel" }
      ],
      "correctAnswer": "metrics_advisor",
      "correctAnswers": ["metrics_advisor"],
      "correctAnswerReason": "Azure AI Metrics Advisor monitors metrics and detects anomalies in time-series data with pre-built models and root-cause analysis."
    }
  ]
}`;

@Injectable({ providedIn: 'root' })
export class AssessmentAiService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private assessmentService = inject(AssessmentTestService);

  private get storageKey(): string {
    const uid = this.authService.user()?.uid;
    return uid ? `${STORAGE_PREFIX}.${uid}` : STORAGE_PREFIX;
  }

  private get configKey(): string {
    return `${this.storageKey}.config`;
  }

  private sessionsSubject = new BehaviorSubject<AssessmentChatSession[]>(this.loadSessions());
  sessions$ = this.sessionsSubject.asObservable();

  readonly isProcessing = signal(false);
  readonly error = signal<string | null>(null);

  private _activeSessionId = signal<string | null>(null);
  readonly activeSessionId = this._activeSessionId.asReadonly();

  private _config = signal<AiConfig>(this.loadConfig());
  readonly config = this._config.asReadonly();

  get sessions(): AssessmentChatSession[] {
    return this.sessionsSubject.value;
  }

  get activeSession(): AssessmentChatSession | null {
    const id = this._activeSessionId();
    return id ? this.sessions.find((s) => s.id === id) ?? null : null;
  }

  getPinnedSessions(): AssessmentChatSession[] {
    return this.sessions
      .filter((s) => s.pinned)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getRecentSessions(): AssessmentChatSession[] {
    return this.sessions
      .filter((s) => !s.pinned)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getSessionTotalTokens(session: AssessmentChatSession | null): number {
    if (!session) return 0;
    if (typeof session.totalTokens === 'number' && session.totalTokens > 0) {
      return session.totalTokens;
    }
    return session.messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  }

  createNewSession(): AssessmentChatSession {
    const id = `as-chat-${Date.now()}`;
    const session: AssessmentChatSession = {
      id,
      title: 'New Assessment Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pinned: false,
      totalTokens: 0,
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
    const id = `as-chat-${Date.now()}`;
    const freshSession: AssessmentChatSession = {
      id,
      title: 'New Assessment Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pinned: false,
      totalTokens: 0,
    };
    this.sessionsSubject.next([freshSession]);
    this._activeSessionId.set(id);
    this.persistSessions();
  }

  clearSessionGeneratedData(sessionId: string) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === sessionId ? { ...s, generatedSet: undefined } : s))
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

  searchSessions(query: string): AssessmentChatSession[] {
    const q = query.toLowerCase();
    return this.sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }

  updateConfig(cfg: Partial<AiConfig>) {
    const updated: AiConfig = { ...this._config(), ...cfg };
    this._config.set(updated);
    this.persistConfig(updated);
  }

  // ── Document Parsing (PDF, Word, Text, Excel) ──────────────────────────────

  /**
   * Extracts clean, readable text from uploaded study material files:
   * Supports: PDF, DOCX, TXT, MD, CSV, JSON, XLSX, XLS
   */
  async extractTextFromFile(file: File): Promise<{ text: string; fileName: string; fileType: string }> {
    const lowerName = file.name.toLowerCase();

    // 1. Plain text / Markdown / JSON / CSV
    if (
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv')
    ) {
      const text = await file.text();
      return { text: text.trim(), fileName: file.name, fileType: 'Text Document' };
    }

    // 2. Excel spreadsheets
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: '\t' });
        if (csv && csv.trim()) {
          sheetTexts.push(`=== Sheet: ${sheetName} ===\n${csv.trim()}`);
        }
      }
      return {
        text: sheetTexts.join('\n\n'),
        fileName: file.name,
        fileType: 'Excel Spreadsheet',
      };
    }

    // 3. Microsoft Word (.docx)
    if (lowerName.endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const docxText = await this.extractTextFromDocx(arrayBuffer);
        if (docxText && docxText.trim().length > 0) {
          return { text: docxText.trim(), fileName: file.name, fileType: 'Word Document (.docx)' };
        }
      } catch (e) {
        console.warn('Docx extraction fallback', e);
      }
    }

    // 4. PDF documents (.pdf)
    if (lowerName.endsWith('.pdf')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfText = await this.extractTextFromPdf(arrayBuffer);
        if (pdfText && pdfText.trim().length > 0) {
          return { text: pdfText.trim(), fileName: file.name, fileType: 'PDF Document' };
        }
      } catch (e) {
        console.warn('PDF extraction fallback', e);
      }
    }

    // Fallback: Attempt text reading
    try {
      const fallbackText = await file.text();
      return { text: fallbackText.trim(), fileName: file.name, fileType: 'Document' };
    } catch {
      throw new Error(`Unable to read text from file: ${file.name}. Please paste the study material directly.`);
    }
  }

  /**
   * Reads word/document.xml from DOCX (PKZip) using browser native DecompressionStream
   */
  private async extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(buffer);
    // Find local file headers starting with PK (0x50, 0x4B, 0x03, 0x04)
    let offset = 0;
    while (offset < bytes.length - 30) {
      if (
        bytes[offset] === 0x50 &&
        bytes[offset + 1] === 0x4b &&
        bytes[offset + 2] === 0x03 &&
        bytes[offset + 3] === 0x04
      ) {
        const compMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
        const compSize =
          bytes[offset + 18] |
          (bytes[offset + 19] << 8) |
          (bytes[offset + 20] << 16) |
          (bytes[offset + 21] << 24);
        const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
        const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);

        const nameStart = offset + 30;
        const nameBytes = bytes.slice(nameStart, nameStart + nameLen);
        const fileName = new TextDecoder().decode(nameBytes);

        const dataStart = nameStart + nameLen + extraLen;

        if (fileName === 'word/document.xml') {
          const compData = bytes.slice(dataStart, dataStart + compSize);
          let xml = '';
          if (compMethod === 0) {
            xml = new TextDecoder().decode(compData);
          } else if (compMethod === 8 && typeof DecompressionStream !== 'undefined') {
            try {
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(compData);
              writer.close();
              const decompressed = await new Response(ds.readable).arrayBuffer();
              xml = new TextDecoder().decode(decompressed);
            } catch (err) {
              console.warn('Decompress error', err);
            }
          }
          if (xml) {
            return this.parseDocxXmlText(xml);
          }
        }
        offset = dataStart + compSize;
      } else {
        offset++;
      }
    }

    // Fallback: scan for <w:t> tags directly in buffer
    const rawString = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return this.parseDocxXmlText(rawString);
  }

  private parseDocxXmlText(xml: string): string {
    // Replace paragraph endings with newlines
    const withNewlines = xml
      .replace(/<\/w:p>/gi, '\n')
      .replace(/<w:br[^>]*\/>/gi, '\n')
      .replace(/<w:tab[^>]*\/>/gi, '\t');
    // Extract text from <w:t> tags
    const matches = withNewlines.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi);
    if (matches && matches.length > 0) {
      return matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\n\s+/g, '\n')
        .replace(/ +/g, ' ')
        .trim();
    }
    // Clean all XML tags as second fallback
    return withNewlines.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extracts text from PDF documents:
   * Handles text object streams, standard string literals, and hex strings.
   */
  private async extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(buffer);
    const rawText = new TextDecoder('latin1').decode(bytes);

    const textPieces: string[] = [];

    // 1. Try to find and decompress Flate streams
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(rawText)) !== null) {
      const streamContent = match[1];
      // Check if it looks like decompressed text (contains BT and ET)
      if (streamContent.includes('BT') && streamContent.includes('ET')) {
        const extracted = this.extractPdfStreamText(streamContent);
        if (extracted) textPieces.push(extracted);
      } else if (typeof DecompressionStream !== 'undefined') {
        try {
          const streamBytes = new Uint8Array(streamContent.length);
          for (let i = 0; i < streamContent.length; i++) {
            streamBytes[i] = streamContent.charCodeAt(i) & 0xff;
          }
          // Test deflate stream
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          writer.write(streamBytes);
          writer.close();
          const decomp = await new Response(ds.readable).arrayBuffer();
          const decompText = new TextDecoder('latin1').decode(decomp);
          if (decompText.includes('BT') && decompText.includes('ET')) {
            const extracted = this.extractPdfStreamText(decompText);
            if (extracted) textPieces.push(extracted);
          }
        } catch {
          // Ignore decompression failures for binary or non-deflate streams
        }
      }
    }

    // 2. Also search for standard Tj / TJ operators in the full document if streams yielded little
    if (textPieces.join(' ').trim().length < 50) {
      const direct = this.extractPdfStreamText(rawText);
      if (direct) textPieces.push(direct);
    }

    const result = textPieces.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return result.length > 0 ? result : 'PDF text could not be extracted directly.';
  }

  private extractPdfStreamText(content: string): string {
    const output: string[] = [];

    // Extract (...) Tj
    const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(content)) !== null) {
      output.push(this.decodePdfString(m[1]));
    }

    // Extract [(...)...] TJ
    const arrayRegex = /\[(.*?)\]\s*TJ/g;
    while ((m = arrayRegex.exec(content)) !== null) {
      const inside = m[1];
      const partRegex = /\(((?:[^()\\]|\\.)*)\)/g;
      let pm: RegExpExecArray | null;
      const subParts: string[] = [];
      while ((pm = partRegex.exec(inside)) !== null) {
        subParts.push(this.decodePdfString(pm[1]));
      }
      if (subParts.length > 0) {
        output.push(subParts.join(''));
      }
    }

    return output.join(' ').trim();
  }

  private decodePdfString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  // ── Question Generation & AI Interaction ────────────────────────────────────

  async sendUserMessage(
    userPrompt: string,
    attachment?: { fileName: string; content: string }
  ): Promise<void> {
    let session = this.activeSession;
    if (!session) {
      session = this.createNewSession();
    }

    const cfg = this._config();

    let fullPrompt = userPrompt.trim();
    if (attachment && attachment.content) {
      fullPrompt = `[Study Material Attached: ${attachment.fileName}]\n\n${attachment.content}\n\n${userPrompt}`;
    }

    const userMsg: AssessmentChatMessage = {
      id: `as-msg-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString(),
      attachmentName: attachment?.fileName,
    };

    this.addMessage(session.id, userMsg);
    this.isProcessing.set(true);
    this.error.set(null);

    try {
      const historyExcludingLatest = this.sessions
        .find((s) => s.id === session!.id)
        ?.messages.slice(0, -1) ?? [];

      const aiResult = await this.callAI(fullPrompt, historyExcludingLatest, cfg);

      // Parse JSON from AI response
      const parsed = this.parseGeneratedQuestionsJson(aiResult.text);

      // Validate & detect duplicates
      this.validateAndEnrichQuestions(parsed.questions);

      // Update user tokens
      this.updateMessageTokens(
        session.id,
        userMsg.id,
        aiResult.promptTokens,
        aiResult.promptTokens === undefined
      );

      const assistantMsg: AssessmentChatMessage = {
        id: `as-msg-${Date.now() + 1}`,
        role: 'assistant',
        content: parsed.summary || 'Here are the generated assessment questions based on your request.',
        timestamp: new Date().toISOString(),
        tokens: aiResult.completionTokens,
        tokensUnavailable: aiResult.completionTokens === undefined,
        questionSetSummary: {
          totalQuestions: parsed.questions.length,
          setName: parsed.setName || 'Generated Assessment Set',
          categoryName: parsed.categoryName || 'General',
          difficulty: parsed.difficulty || 'Intermediate',
        },
      };

      this.addMessage(session.id, assistantMsg);

      const generatedSet: GeneratedQuestionSet = {
        setName: parsed.setName || 'Generated Assessment Set',
        categoryName: parsed.categoryName || 'General Assessments',
        description: parsed.description || 'AI-generated assessment test sheet.',
        difficulty: (parsed.difficulty as QuestionDifficulty) || 'Intermediate',
        timerSeconds: parsed.timerSeconds || parsed.questions.length * 60,
        questions: parsed.questions,
        rawJson: aiResult.text,
        generatedAt: new Date().toISOString(),
      };

      this.updateSessionGeneratedData(session.id, generatedSet);

      // Update session title if default
      const currentSession = this.sessions.find((s) => s.id === session!.id);
      if (currentSession && (currentSession.title === 'New Assessment Chat' || currentSession.title === 'New Chat')) {
        const title = parsed.setName
          ? parsed.setName.substring(0, 40)
          : userPrompt.substring(0, 40).trim() + (userPrompt.length > 40 ? '...' : '');
        this.renameSession(session.id, title);
      }
    } catch (err: any) {
      console.error('AssessmentAiService error', err);
      this.error.set(err.message || 'Failed to generate assessment questions.');
      const errMsg: AssessmentChatMessage = {
        id: `as-msg-err-${Date.now()}`,
        role: 'assistant',
        content: `Error generating questions: ${err.message || 'Please check your API key / AI configuration and try again.'}`,
        timestamp: new Date().toISOString(),
        tokensUnavailable: true,
      };
      this.addMessage(session.id, errMsg);
    } finally {
      this.isProcessing.set(false);
    }
  }

  // ── JSON Parsing & Resilient Extraction ────────────────────────────────────

  parseGeneratedQuestionsJson(rawText: string): {
    summary: string;
    setName: string;
    categoryName: string;
    description: string;
    difficulty: string;
    timerSeconds?: number;
    questions: GeneratedQuestion[];
  } {
    let clean = rawText.trim();

    // Strip markdown code fences if present
    if (clean.includes('```json')) {
      const match = clean.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1];
    } else if (clean.includes('```')) {
      const match = clean.match(/```\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1];
    }

    // Find JSON boundary { ... }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    let parsedObj: any = null;
    try {
      parsedObj = JSON.parse(clean);
    } catch (e) {
      // If direct parse fails, try extracting question array
      parsedObj = this.recoverPartialJson(rawText);
    }

    const questionsRaw = Array.isArray(parsedObj?.questions)
      ? parsedObj.questions
      : Array.isArray(parsedObj)
      ? parsedObj
      : [];

    const questions: GeneratedQuestion[] = questionsRaw.map((q: any, idx: number) => {
      const qId = q.id || `gen-q-${Date.now()}-${idx + 1}`;
      const qType: 'radio' | 'checkbox' = q.type === 'checkbox' ? 'checkbox' : 'radio';

      // Parse options
      let options: QuestionOption[] = [];
      if (Array.isArray(q.options)) {
        options = q.options.map((opt: any, oIdx: number) => {
          if (typeof opt === 'string') {
            const letter = String.fromCharCode(65 + oIdx);
            return {
              id: `opt-${oIdx + 1}`,
              label: opt,
              value: `option_${letter.toLowerCase()}`,
            };
          }
          return {
            id: opt.id || `opt-${oIdx + 1}`,
            label: opt.label || opt.text || `Option ${oIdx + 1}`,
            value: opt.value || opt.label || `opt_${oIdx + 1}`,
          };
        });
      }

      // If options are empty or less than 2, generate fallback options
      if (options.length < 2) {
        options = [
          { id: 'opt-1', label: 'Option A', value: 'opt_a' },
          { id: 'opt-2', label: 'Option B', value: 'opt_b' },
          { id: 'opt-3', label: 'Option C', value: 'opt_c' },
          { id: 'opt-4', label: 'Option D', value: 'opt_d' },
        ];
      }

      // Determine correct answer
      let correctAnswer = q.correctAnswer;
      let correctAnswers: string[] = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];

      if (!correctAnswer && correctAnswers.length > 0) {
        correctAnswer = correctAnswers[0];
      } else if (correctAnswer && correctAnswers.length === 0) {
        correctAnswers = [correctAnswer];
      }

      // If correctAnswer is letter like "A", "B", "C", map to option value
      if (correctAnswer && correctAnswer.length === 1 && /[A-Za-z]/.test(correctAnswer)) {
        const charCode = correctAnswer.toUpperCase().charCodeAt(0) - 65;
        if (options[charCode]) {
          correctAnswer = options[charCode].value;
          correctAnswers = [options[charCode].value];
        }
      }

      // Ensure correctAnswer matches an option value
      const matchingOpt = options.find((o) => o.value === correctAnswer || o.label === correctAnswer);
      if (matchingOpt) {
        correctAnswer = matchingOpt.value;
      } else if (options.length > 0 && !correctAnswer) {
        correctAnswer = options[0].value;
        correctAnswers = [options[0].value];
      }

      return {
        id: qId,
        title: q.title || q.question || `Question ${idx + 1}`,
        description: q.description || '',
        type: qType,
        difficulty: (q.difficulty as QuestionDifficulty) || parsedObj?.difficulty || 'Intermediate',
        category: q.category || parsedObj?.categoryName || 'General',
        weight: Number(q.weight) > 0 ? Number(q.weight) : 1,
        negativeMark: Number(q.negativeMark) || 0,
        options,
        correctAnswer,
        correctAnswers,
        correctAnswerReason: q.correctAnswerReason || q.explanation || 'Refer to documentation for detailed explanation.',
        status: 'pending' as const,
      };
    });

    return {
      summary: parsedObj?.summary || `Generated ${questions.length} questions successfully.`,
      setName: parsedObj?.setName || 'Custom Assessment Set',
      categoryName: parsedObj?.categoryName || 'General Assessments',
      description: parsedObj?.description || 'Custom generated assessment sheet.',
      difficulty: parsedObj?.difficulty || 'Intermediate',
      timerSeconds: parsedObj?.timerSeconds || questions.length * 60,
      questions,
    };
  }

  private recoverPartialJson(rawText: string): any {
    // Attempt relaxed recovery or regex extraction of question-like blocks
    try {
      const match = rawText.match(/"questions"\s*:\s*(\[[\s\S]*?\])/);
      if (match) {
        const questionsArray = JSON.parse(match[1]);
        return { questions: questionsArray };
      }
    } catch {
      // Ignore
    }
    return { summary: rawText, questions: [] };
  }

  // ── Duplicate Detection & Validation ──────────────────────────────────────

  validateAndEnrichQuestions(questions: GeneratedQuestion[], targetSetId?: string): void {
    const existingSets = this.assessmentService.questionSets();
    const targetSet = targetSetId
      ? existingSets.find((s) => s.id === targetSetId)
      : this.assessmentService.activeSet();

    const existingQuestions = targetSet ? targetSet.questions : existingSets.flatMap((s) => s.questions);

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const errors: string[] = [];

      // 1. Validation
      if (!q.title || !q.title.trim()) {
        errors.push('Question title cannot be empty.');
      }
      if (!q.options || q.options.length < 2) {
        errors.push('Question must have at least 2 options.');
      } else {
        const emptyOptions = q.options.some((o) => !o.label || !o.label.trim());
        if (emptyOptions) {
          errors.push('All option labels must be filled.');
        }
      }

      if (q.type === 'radio') {
        if (!q.correctAnswer) {
          errors.push('Single-choice question must have a correct answer selected.');
        } else {
          const validOpt = q.options.some((o) => o.value === q.correctAnswer);
          if (!validOpt) {
            errors.push('Selected correct answer does not match any available option.');
          }
        }
      } else {
        if (!q.correctAnswers || q.correctAnswers.length === 0) {
          errors.push('Multiple-choice question must have at least one correct option.');
        }
      }

      q.validationErrors = errors.length > 0 ? errors : undefined;

      // 2. Duplicate Detection (within batch)
      let duplicateFound = false;
      let dupReason = '';

      for (let j = 0; j < i; j++) {
        const other = questions[j];
        if (this.isSimilarTitle(q.title, other.title)) {
          duplicateFound = true;
          dupReason = `Duplicate of Question #${j + 1} in this generated batch`;
          break;
        }
      }

      // Duplicate Detection (against existing assessment database)
      if (!duplicateFound && existingQuestions && existingQuestions.length > 0) {
        for (const ex of existingQuestions) {
          if (this.isSimilarTitle(q.title, ex.title)) {
            duplicateFound = true;
            dupReason = `Matches existing question: "${ex.title.substring(0, 50)}..."`;
            break;
          }
        }
      }

      q.isDuplicate = duplicateFound;
      q.duplicateReason = dupReason || undefined;
    }
  }

  private isSimilarTitle(titleA: string, titleB: string): boolean {
    if (!titleA || !titleB) return false;
    const cleanA = titleA.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const cleanB = titleB.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanA === cleanB) return true;
    if (cleanA.length > 15 && cleanB.length > 15) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    }
    return false;
  }

  // ── Insertion into Assessment Test Tool ────────────────────────────────────

  insertApprovedQuestions(params: {
    targetSetId: string;
    newSetName?: string;
    newSetDescription?: string;
    targetCategoryId: string;
    newCategoryName?: string;
    newCategoryDescription?: string;
    timerSeconds?: number;
    questionsToInsert: GeneratedQuestion[];
  }): { success: boolean; setId: string; count: number; message: string } {
    const {
      targetSetId,
      newSetName,
      newSetDescription,
      targetCategoryId,
      newCategoryName,
      newCategoryDescription,
      timerSeconds,
      questionsToInsert,
    } = params;

    if (!questionsToInsert || questionsToInsert.length === 0) {
      return { success: false, setId: '', count: 0, message: 'No questions selected for insertion.' };
    }

    // Filter out invalid questions that have no title or fewer than 2 options
    const validQuestions = questionsToInsert.filter(
      (q) => q.title && q.title.trim() && q.options && q.options.length >= 2
    );

    if (validQuestions.length === 0) {
      return {
        success: false,
        setId: '',
        count: 0,
        message: 'All selected questions have validation errors. Ensure each has a title and at least 2 options.',
      };
    }

    // 1. Resolve or create category
    const isNewCat = targetCategoryId === '__NEW__' || targetCategoryId === 'new' || !targetCategoryId;
    let finalCategoryId = targetCategoryId;

    if (isNewCat) {
      const catName = (newCategoryName || 'AI Generated Assessments').trim();
      const existingCat = this.assessmentService.categories().find(
        (c) => c.name.toLowerCase() === catName.toLowerCase()
      );
      if (existingCat) {
        finalCategoryId = existingCat.id;
      } else {
        const catId = `cat_${Math.random().toString(36).slice(2, 11)}`;
        const newCat: Category = {
          id: catId,
          name: catName,
          description: newCategoryDescription || 'Category generated by AI Assessment Assistant',
        };
        this.assessmentService.categories.update((cats) => [...cats, newCat]);
        finalCategoryId = catId;
      }
    } else {
      const catExists = this.assessmentService.categories().some((c) => c.id === targetCategoryId);
      if (!catExists) {
        const firstCat = this.assessmentService.categories()[0];
        if (firstCat) {
          finalCategoryId = firstCat.id;
        } else {
          const catId = `cat_${Math.random().toString(36).slice(2, 11)}`;
          const fallbackCat: Category = {
            id: catId,
            name: 'AI Generated Assessments',
            description: 'Assessments created by AI Assistant',
          };
          this.assessmentService.categories.set([fallbackCat]);
          finalCategoryId = catId;
        }
      }
    }
    this.assessmentService.selectedCategoryId.set(finalCategoryId);

    // 2. Map GeneratedQuestion into AssessmentQuestion model
    const mappedQuestions: AssessmentQuestion[] = validQuestions.map((gq, idx) => {
      const qId = `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;

      // Map options ensuring each has a valid label and unique value
      const mappedOptions: QuestionOption[] = gq.options.map((opt, oIdx) => ({
        id: opt.id && opt.id.startsWith('opt_') ? opt.id : `opt_${Date.now()}_${oIdx}_${Math.random().toString(36).slice(2, 7)}`,
        label: (opt.label || `Option ${String.fromCharCode(65 + oIdx)}`).trim(),
        value: (opt.value || `option_${String.fromCharCode(97 + oIdx)}`).trim(),
      }));

      // Resolve correctAnswer for single-choice (radio)
      let resolvedCorrectAnswer: string | undefined = undefined;
      if (gq.type === 'radio') {
        const targetAns = (gq.correctAnswer || '').trim();
        const matchedOpt = mappedOptions.find(
          (o) => o.value === targetAns || o.label === targetAns || o.id === targetAns
        );
        resolvedCorrectAnswer = matchedOpt ? matchedOpt.value : mappedOptions[0]?.value;
      }

      // Resolve correctAnswers for multi-select (checkbox)
      let resolvedCorrectAnswers: string[] | undefined = undefined;
      if (gq.type === 'checkbox') {
        const rawAnswers = Array.isArray(gq.correctAnswers)
          ? gq.correctAnswers
          : gq.correctAnswer
          ? [gq.correctAnswer]
          : [];
        const ansSet = new Set<string>();
        for (const raw of rawAnswers) {
          const target = String(raw).trim();
          const matchedOpt = mappedOptions.find(
            (o) => o.value === target || o.label === target || o.id === target
          );
          if (matchedOpt) {
            ansSet.add(matchedOpt.value);
          }
        }
        if (ansSet.size === 0 && mappedOptions.length > 0) {
          ansSet.add(mappedOptions[0].value);
        }
        resolvedCorrectAnswers = Array.from(ansSet);
      }

      return {
        id: qId,
        title: gq.title.trim(),
        description: gq.description?.trim() || undefined,
        type: gq.type || 'radio',
        required: true,
        options: mappedOptions,
        correctAnswer: resolvedCorrectAnswer,
        correctAnswers: resolvedCorrectAnswers,
        correctAnswerReason: gq.correctAnswerReason?.trim() || undefined,
        weight: Number(gq.weight) > 0 ? Number(gq.weight) : 1,
        negativeMark: Number(gq.negativeMark) || 0,
        difficulty: gq.difficulty || 'Intermediate',
        category: gq.category || newCategoryName || 'General',
      };
    });

    // 3. Resolve or create question sheet
    const isNewSet = targetSetId === '__NEW__' || targetSetId === 'new' || !targetSetId;
    let finalSetId = targetSetId;
    let targetSetNameDisplay = (newSetName || 'AI Assessment Sheet').trim();

    if (isNewSet) {
      const setId = `set_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newSet: QuestionSet = {
        id: setId,
        categoryId: finalCategoryId,
        name: targetSetNameDisplay,
        description: newSetDescription || 'Generated by AI Assessment Assistant',
        timerSeconds: timerSeconds && timerSeconds > 0 ? timerSeconds : mappedQuestions.length * 60,
        questions: mappedQuestions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.assessmentService.questionSets.update((sets) => [...sets, newSet]);
      finalSetId = setId;
    } else {
      // Append to existing QuestionSet
      const existingSet = this.assessmentService.questionSets().find((s) => s.id === targetSetId);
      if (existingSet) {
        targetSetNameDisplay = existingSet.name;
        finalCategoryId = existingSet.categoryId;
        this.assessmentService.selectedCategoryId.set(finalCategoryId);
        this.assessmentService.questionSets.update((sets) =>
          sets.map((set) =>
            set.id === targetSetId
              ? {
                  ...set,
                  questions: [...set.questions, ...mappedQuestions],
                  updatedAt: new Date().toISOString(),
                }
              : set
          )
        );
      } else {
        // Fallback: create as new set if targetSetId is not in questionSets
        const setId = `set_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newSet: QuestionSet = {
          id: setId,
          categoryId: finalCategoryId,
          name: targetSetNameDisplay,
          description: newSetDescription || 'Generated by AI Assessment Assistant',
          timerSeconds: timerSeconds && timerSeconds > 0 ? timerSeconds : mappedQuestions.length * 60,
          questions: mappedQuestions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.assessmentService.questionSets.update((sets) => [...sets, newSet]);
        finalSetId = setId;
      }
    }

    // 4. Update selected active set and reset attempt state
    this.assessmentService.selectedSetId.set(finalSetId);
    this.assessmentService.activeQuestionIndex.set(0);
    this.assessmentService.resetAttemptState();

    // 5. Force synchronous state persistence into localStorage & trigger cloud sync
    this.assessmentService.saveLocalState();
    if (this.authService.user()?.uid || this.assessmentService.autoSyncEnabled()) {
      this.assessmentService.syncToFirebase().catch((err) => {
        console.warn('Background Firebase sync after question insert:', err);
      });
    }

    // 6. Mark inserted questions as 'applied' so they cannot be inserted twice
    const activeSession = this.activeSession;
    if (activeSession && activeSession.generatedSet) {
      const insertedIds = new Set(validQuestions.map((q) => q.id));
      const updatedQuestions = activeSession.generatedSet.questions.map((q) =>
        insertedIds.has(q.id) ? { ...q, status: 'applied' as const } : q
      );
      this.updateSessionGeneratedData(activeSession.id, {
        ...activeSession.generatedSet,
        questions: updatedQuestions,
      });
    }

    return {
      success: true,
      setId: finalSetId,
      count: mappedQuestions.length,
      message: `Successfully inserted ${mappedQuestions.length} question(s) into "${targetSetNameDisplay}".`,
    };
  }

  // ── AI Backend Call Handlers ───────────────────────────────────────────────

  private async callAI(
    userMessage: string,
    history: AssessmentChatMessage[],
    cfg: AiConfig
  ): Promise<AiCallResult> {
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
    history: AssessmentChatMessage[],
    cfg: AiConfig
  ): Promise<AiCallResult> {
    const payload = {
      message: userMessage,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      system_instructions: cfg.systemInstructions || DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS,
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          if (data && data.response) {
            const promptTokens =
              typeof data.prompt_tokens === 'number'
                ? data.prompt_tokens
                : typeof data.usage?.prompt_tokens === 'number'
                ? data.usage.prompt_tokens
                : undefined;
            const completionTokens =
              typeof data.completion_tokens === 'number'
                ? data.completion_tokens
                : typeof data.usage?.completion_tokens === 'number'
                ? data.usage.completion_tokens
                : undefined;
            const totalTokens =
              typeof data.total_tokens === 'number'
                ? data.total_tokens
                : typeof data.usage?.total_tokens === 'number'
                ? data.usage.total_tokens
                : typeof promptTokens === 'number' && typeof completionTokens === 'number'
                ? promptTokens + completionTokens
                : undefined;

            return {
              text: data.response,
              promptTokens,
              completionTokens,
              totalTokens,
              tokensUnavailable: promptTokens === undefined && completionTokens === undefined,
            };
          }
          if (typeof data === 'string') {
            return { text: data, tokensUnavailable: true };
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
        `Failed to connect to AI backend service at ${pythonBase}. Please check your internet connection or configure an API key in Settings.`
      )
    );
  }

  private async callOpenAI(
    userMessage: string,
    history: AssessmentChatMessage[],
    cfg: AiConfig
  ): Promise<AiCallResult> {
    const messages = [
      { role: 'system', content: cfg.systemInstructions || DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as any)?.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';
    const promptTokens = data.usage?.prompt_tokens;
    const completionTokens = data.usage?.completion_tokens;
    const totalTokens = data.usage?.total_tokens;

    return { text, promptTokens, completionTokens, totalTokens, tokensUnavailable: !promptTokens };
  }

  private async callGemini(
    userMessage: string,
    history: AssessmentChatMessage[],
    cfg: AiConfig
  ): Promise<AiCallResult> {
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
          parts: [{ text: cfg.systemInstructions || DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS }],
        },
        contents,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as any)?.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const promptTokens = data.usageMetadata?.promptTokenCount;
    const completionTokens = data.usageMetadata?.candidatesTokenCount;
    const totalTokens = data.usageMetadata?.totalTokenCount;

    return { text, promptTokens, completionTokens, totalTokens, tokensUnavailable: !promptTokens };
  }

  private async callAnthropic(
    userMessage: string,
    history: AssessmentChatMessage[],
    cfg: AiConfig
  ): Promise<AiCallResult> {
    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userMessage },
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
        system: cfg.systemInstructions || DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS,
        messages,
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error((errData as any)?.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const text = data.content?.[0]?.text || '';
    const promptTokens = data.usage?.input_tokens;
    const completionTokens = data.usage?.output_tokens;
    const totalTokens =
      typeof promptTokens === 'number' && typeof completionTokens === 'number'
        ? promptTokens + completionTokens
        : undefined;

    return { text, promptTokens, completionTokens, totalTokens, tokensUnavailable: !promptTokens };
  }

  // ── Session State Persistence ──────────────────────────────────────────────

  private addMessage(sessionId: string, msg: AssessmentChatMessage) {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = [...s.messages, msg];
        return {
          ...s,
          messages,
          updatedAt: new Date().toISOString(),
          totalTokens: this.calculateSessionTokens(messages),
        };
      })
    );
    this.persistSessions();
  }

  private updateMessageTokens(
    sessionId: string,
    msgId: string,
    tokens: number | undefined,
    tokensUnavailable: boolean
  ) {
    this.sessionsSubject.next(
      this.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const messages = s.messages.map((m) =>
          m.id === msgId ? { ...m, tokens, tokensUnavailable } : m
        );
        return {
          ...s,
          messages,
          totalTokens: this.calculateSessionTokens(messages),
        };
      })
    );
    this.persistSessions();
  }

  private updateSessionGeneratedData(sessionId: string, data: GeneratedQuestionSet) {
    this.sessionsSubject.next(
      this.sessions.map((s) => (s.id === sessionId ? { ...s, generatedSet: data } : s))
    );
    this.persistSessions();
  }

  private calculateSessionTokens(messages: AssessmentChatMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
  }

  private loadSessions(): AssessmentChatSession[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    const defaultSession: AssessmentChatSession = {
      id: `as-chat-${Date.now()}`,
      title: 'New Assessment Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      pinned: false,
      totalTokens: 0,
    };
    return [defaultSession];
  }

  private persistSessions() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
    } catch (e) {
      console.warn('Failed to persist assessment chat sessions', e);
    }
  }

  private loadConfig(): AiConfig {
    // 1. Try assessment-specific config
    try {
      const raw = localStorage.getItem(this.configKey);
      if (raw) return JSON.parse(raw);
    } catch {}

    // 2. Fallback to shared Work Tracker AI config if present!
    try {
      const uid = this.authService.user()?.uid;
      const sharedKey = uid
        ? `${SHARED_AI_STORAGE_KEY_PREFIX}.${uid}.config`
        : `${SHARED_AI_STORAGE_KEY_PREFIX}.config`;
      const sharedRaw = localStorage.getItem(sharedKey);
      if (sharedRaw) {
        const shared = JSON.parse(sharedRaw);
        return {
          provider: shared.provider || 'foundry',
          model: shared.model || 'gpt-5.6-luna',
          apiKey: shared.apiKey || '',
          systemInstructions: DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS,
        };
      }
    } catch {}

    return {
      provider: 'foundry',
      model: 'gpt-5.6-luna',
      apiKey: '',
      systemInstructions: DEFAULT_ASSESSMENT_SYSTEM_INSTRUCTIONS,
    };
  }

  private persistConfig(cfg: AiConfig) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(cfg));
    } catch (e) {
      console.warn('Failed to persist AI config', e);
    }
  }
}

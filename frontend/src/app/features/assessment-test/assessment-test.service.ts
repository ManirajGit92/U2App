import { Injectable, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { read, utils, writeFile, WorkBook } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';
import { FirestoreService } from '../../core/services/firestore.service';
import { ThemeService } from '../../core/services/theme.service';

export type QuestionInputType = 'radio' | 'checkbox' | 'textbox' | 'textarea' | 'mixed';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface AssessmentQuestion {
  id: string;
  title: string;
  description?: string;
  type: QuestionInputType;
  required: boolean;
  options?: QuestionOption[];
  correctAnswer?: string;
  correctAnswers?: string[];
  correctAnswerReason?: string;
  weight: number;
  negativeMark: number;
  controls?: AssessmentQuestion[];
}

export interface QuestionSet {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  timerSeconds?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  questions: AssessmentQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export type AssessmentResponseValue = string | string[] | Record<string, string | string[]>;
export type AssessmentResponses = Record<string, AssessmentResponseValue>;

export interface AssessmentResultDetail {
  questionId: string;
  questionTitle: string;
  correct: boolean;
  earned: number;
  possible: number;
  feedback: string;
  userAnswerText?: string;
  correctAnswerText?: string;
  correctAnswerReason?: string;
  status: 'correct' | 'incorrect' | 'unanswered';
}

export interface AssessmentResult {
  score: number;
  maxScore: number;
  percentage: number;
  badge: string;
  passed: boolean;
  passingScore: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  totalQuestions: number;
  totalMarks: number;
  timeTakenSeconds: number;
  totalDurationSeconds: number;
  submissionStatus: 'manual' | 'auto-time-over';
  details: AssessmentResultDetail[];
  completedAt: string;
}

export interface AssessmentHistoryItem {
  id: string;
  setId: string;
  setName: string;
  categoryName: string;
  result: AssessmentResult;
  durationSeconds: number;
}

export interface CertificateData {
  userName: string;
  assessmentName: string;
  category: string;
  score: number;
  percentage: number;
  badge: string;
  completedAt: string;
}

interface PersistedAssessmentState {
  categories: Category[];
  questionSets: QuestionSet[];
  selectedCategoryId: string | null;
  selectedSetId: string | null;
  activeQuestionIndex: number;
  responses: AssessmentResponses;
  lastResult: AssessmentResult | null;
  history: AssessmentHistoryItem[];
  autoSyncEnabled: boolean;
  testStarted?: boolean;
  testSubmitted?: boolean;
  testStartTimeIso?: string | null;
  remainingSeconds?: number;
  autoSubmitted?: boolean;
  interactionSoundsEnabled?: boolean;
  lastSyncedAt?: string;
}

const STORAGE_KEY = 'u2app.assessmentTestState';

@Injectable({ providedIn: 'root' })
export class AssessmentTestService implements OnDestroy {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private firestoreService = inject(FirestoreService);
  private themeService = inject(ThemeService);

  categories = signal<Category[]>([]);
  questionSets = signal<QuestionSet[]>([]);
  selectedCategoryId = signal<string | null>(null);
  selectedSetId = signal<string | null>(null);
  activeQuestionIndex = signal<number>(0);
  responses = signal<AssessmentResponses>({});
  lastResult = signal<AssessmentResult | null>(null);
  history = signal<AssessmentHistoryItem[]>([]);
  autoSyncEnabled = signal<boolean>(false);
  sideNavOpenMobile = signal<boolean>(false);
  isSyncing = signal<boolean>(false);
  syncMessage = signal<string | null>(null);
  importErrors = signal<string[]>([]);
  exportMessage = signal<string | null>(null);
  certificatePreview = signal<CertificateData | null>(null);
  errorMessage = signal<string | null>(null);
  testStarted = signal<boolean>(false);
  testSubmitted = signal<boolean>(false);
  testStartTimeIso = signal<string | null>(null);
  remainingSeconds = signal<number>(0);
  autoSubmitted = signal<boolean>(false);
  interactionSoundsEnabled = signal<boolean>(false);

  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  playSound(type: 'click' | 'start' | 'submit' | 'navigate' | 'action' = 'click'): void {
    if (!this.interactionSoundsEnabled()) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'start') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'submit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'navigate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (type === 'action') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch {
      // Ignore audio errors
    }
  }

  activeCategory = computed(() => {
    return this.categories().find((category) => category.id === this.selectedCategoryId()) || null;
  });

  activeSet = computed(() => {
    return this.questionSets().find((set) => set.id === this.selectedSetId()) || null;
  });

  activeQuestion = computed(() => {
    const set = this.activeSet();
    if (!set || set.questions.length === 0) {
      return null;
    }
    const index = Math.min(Math.max(this.activeQuestionIndex(), 0), set.questions.length - 1);
    return set.questions[index];
  });

  progress = computed(() => {
    const set = this.activeSet();
    if (!set) return 0;
    const answered = set.questions.filter((question) =>
      this.hasResponseForQuestion(question),
    ).length;
    return set.questions.length === 0 ? 0 : Math.round((answered / set.questions.length) * 100);
  });

  constructor() {
    this.loadLocalState();
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.syncMessage.set('Restoring assessment data from cloud...');
        this.loadFromFirestore(uid)
          .then(() => this.syncMessage.set('Assessment data restored.'))
          .catch((error) => {
            console.error('AssessmentTestService: cloud restore failed', error);
            this.syncMessage.set('Failed to restore cloud data.');
          });
      } else {
        this.syncMessage.set('Signed out. Local assessment data is available.');
      }
    });

    effect(() => {
      this.saveLocalState();
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private buildId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private defaultState(): void {
    const defaultCategory: Category = {
      id: this.buildId('cat'),
      name: 'General Assessments',
      description: 'Create question sheets by topics or departments.',
    };

    const defaultSet: QuestionSet = {
      id: this.buildId('set'),
      name: 'Sample Assessment',
      description:
        'This sample assessment includes radio, checkbox, textbox, textarea, and mixed questions.',
      categoryId: defaultCategory.id,
      timerSeconds: 420,
      questions: [
        {
          id: this.buildId('q'),
          title: 'Which planet is known as the Red Planet?',
          description: 'Choose the correct single answer.',
          type: 'radio',
          required: true,
          options: [
            { id: 'o1', label: 'Venus', value: 'venus' },
            { id: 'o2', label: 'Mars', value: 'mars' },
            { id: 'o3', label: 'Jupiter', value: 'jupiter' },
          ],
          correctAnswer: 'mars',
          weight: 2,
          negativeMark: 0,
        },
        {
          id: this.buildId('q'),
          title: 'Select the core U2 Tools principles.',
          description: 'Choose one or more valid principles.',
          type: 'checkbox',
          required: true,
          options: [
            { id: 'o4', label: 'Cloud sync support', value: 'cloud' },
            { id: 'o5', label: 'Manual-only state', value: 'manual' },
            { id: 'o6', label: 'Rich assessment builder', value: 'builder' },
          ],
          correctAnswers: ['cloud', 'builder'],
          weight: 3,
          negativeMark: 1,
        },
        {
          id: this.buildId('q'),
          title: 'Describe what makes a great assessment experience.',
          description: 'Type a short response in the textbox below.',
          type: 'textbox',
          required: false,
          correctAnswer: 'clear structure',
          weight: 2,
          negativeMark: 0,
        },
        {
          id: this.buildId('q'),
          title: 'Explain how automatic scoring helps learners.',
          description: 'Use the textarea field for a longer response.',
          type: 'textarea',
          required: false,
          correctAnswer: 'faster feedback',
          weight: 2,
          negativeMark: 0,
        },
        {
          id: this.buildId('q'),
          title: 'Mixed controls sample question',
          description: 'Answer both parts to complete this mixed question.',
          type: 'mixed',
          required: true,
          weight: 4,
          negativeMark: 1,
          controls: [
            {
              id: this.buildId('q'),
              title: 'Select the correct benefit of quizzes.',
              type: 'radio',
              required: true,
              options: [
                { id: 'o7', label: 'Helps measure understanding', value: 'measure' },
                { id: 'o8', label: 'Delays learning', value: 'delay' },
              ],
              correctAnswer: 'measure',
              weight: 2,
              negativeMark: 0,
            },
            {
              id: this.buildId('q'),
              title: 'Name one assessment feedback method.',
              type: 'textbox',
              required: true,
              correctAnswer: 'instant feedback',
              weight: 2,
              negativeMark: 0,
            },
          ],
        },
      ],
      createdAt: this.nowIso(),
      updatedAt: this.nowIso(),
    };

    this.categories.set([defaultCategory]);
    this.questionSets.set([defaultSet]);
    this.selectedCategoryId.set(defaultCategory.id);
    this.selectedSetId.set(defaultSet.id);
    this.activeQuestionIndex.set(0);
    this.responses.set({});
    this.lastResult.set(null);
    this.history.set([]);
    this.testStarted.set(false);
    this.testSubmitted.set(false);
    this.testStartTimeIso.set(null);
    this.remainingSeconds.set(defaultSet.timerSeconds || 0);
    this.autoSubmitted.set(false);
  }

  private loadLocalState(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.defaultState();
        return;
      }
      const parsed = JSON.parse(raw) as PersistedAssessmentState;
      this.categories.set(parsed.categories || []);
      this.questionSets.set(parsed.questionSets || []);
      this.selectedCategoryId.set(parsed.selectedCategoryId ?? null);
      this.selectedSetId.set(parsed.selectedSetId ?? null);
      this.activeQuestionIndex.set(parsed.activeQuestionIndex ?? 0);
      this.responses.set(parsed.responses || {});
      this.lastResult.set(parsed.lastResult || null);
      this.history.set(parsed.history || []);
      this.autoSyncEnabled.set(parsed.autoSyncEnabled || false);
      this.testStarted.set(parsed.testStarted || false);
      this.testSubmitted.set(parsed.testSubmitted || false);
      this.testStartTimeIso.set(parsed.testStartTimeIso ?? null);
      this.remainingSeconds.set(parsed.remainingSeconds ?? this.activeSet()?.timerSeconds ?? 0);
      this.autoSubmitted.set(parsed.autoSubmitted || false);
      this.interactionSoundsEnabled.set(parsed.interactionSoundsEnabled || false);
      if (this.testStarted() && !this.testSubmitted()) {
        this.startTimer();
      }
    } catch (error) {
      console.error('AssessmentTestService: failed to load local state', error);
      this.defaultState();
    }
  }

  private saveLocalState(): void {
    try {
      const state: PersistedAssessmentState = {
        categories: this.categories(),
        questionSets: this.questionSets(),
        selectedCategoryId: this.selectedCategoryId(),
        selectedSetId: this.selectedSetId(),
        activeQuestionIndex: this.activeQuestionIndex(),
        responses: this.responses(),
        lastResult: this.lastResult(),
        history: this.history(),
        autoSyncEnabled: this.autoSyncEnabled(),
        testStarted: this.testStarted(),
        testSubmitted: this.testSubmitted(),
        testStartTimeIso: this.testStartTimeIso(),
        remainingSeconds: this.remainingSeconds(),
        autoSubmitted: this.autoSubmitted(),
        interactionSoundsEnabled: this.interactionSoundsEnabled(),
        lastSyncedAt: this.syncMessage() ?? undefined,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('AssessmentTestService: failed to save local state', error);
    }
  }

  getCategoryName(categoryId: string | null): string {
    return this.categories().find((category) => category.id === categoryId)?.name ?? 'Unassigned';
  }

  setSelectedCategory(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    const firstSet = this.questionSets().find((set) => set.categoryId === categoryId);
    if (firstSet) {
      this.selectedSetId.set(firstSet.id);
      this.activeQuestionIndex.set(0);
    }
  }

  setSelectedSet(setId: string): void {
    this.selectedSetId.set(setId);
    this.activeQuestionIndex.set(0);
    this.resetAttemptState();
  }

  setActiveQuestionIndex(index: number): void {
    const set = this.activeSet();
    if (!set) return;
    const normalized = Math.min(Math.max(index, 0), set.questions.length - 1);
    this.activeQuestionIndex.set(normalized);
  }

  createCategory(name: string): void {
    if (!name.trim()) return;
    const category: Category = {
      id: this.buildId('cat'),
      name: name.trim(),
      description: '',
    };
    this.categories.update((current) => [...current, category]);
    this.selectedCategoryId.set(category.id);
  }

  updateCategory(categoryId: string, name: string, description: string): void {
    this.categories.update((categories) =>
      categories.map((category) =>
        category.id === categoryId ? { ...category, name: name.trim(), description } : category,
      ),
    );
  }

  deleteCategory(categoryId: string): void {
    this.categories.update((categories) =>
      categories.filter((category) => category.id !== categoryId),
    );
    this.questionSets.update((sets) => sets.filter((set) => set.categoryId !== categoryId));
    const remaining = this.categories();
    this.selectedCategoryId.set(remaining.length ? remaining[0].id : null);
    const remainingSet = this.questionSets().find(
      (set) => set.categoryId === this.selectedCategoryId(),
    );
    this.selectedSetId.set(remainingSet?.id ?? null);
  }

  createQuestionSet(name: string, description: string, timerSeconds?: number): void {
    const categoryId = this.selectedCategoryId() || this.categories()[0]?.id;
    if (!categoryId || !name.trim()) return;
    const questionSet: QuestionSet = {
      id: this.buildId('set'),
      categoryId,
      name: name.trim(),
      description: description.trim(),
      timerSeconds: timerSeconds || undefined,
      questions: [],
      createdAt: this.nowIso(),
      updatedAt: this.nowIso(),
    };
    this.questionSets.update((current) => [...current, questionSet]);
    this.selectedSetId.set(questionSet.id);
    this.activeQuestionIndex.set(0);
  }

  updateQuestionSet(
    setId: string,
    name: string,
    description: string,
    timerSeconds?: number,
    shuffleQuestions?: boolean,
    shuffleOptions?: boolean
  ): void {
    this.questionSets.update((sets) =>
      sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              name: name.trim(),
              description: description.trim(),
              timerSeconds,
              passingScore: set.passingScore,
              shuffleQuestions,
              shuffleOptions,
              updatedAt: this.nowIso(),
            }
          : set,
      ),
    );
  }

  deleteQuestionSet(setId: string): void {
    this.questionSets.update((sets) => sets.filter((set) => set.id !== setId));
    const remaining = this.questionSets().filter(
      (set) => set.categoryId === this.selectedCategoryId(),
    );
    this.selectedSetId.set(remaining.length ? remaining[0].id : null);
    this.activeQuestionIndex.set(0);
  }

  moveQuestionSetToCategory(setId: string, categoryId: string): void {
    const categoryExists = this.categories().some((category) => category.id === categoryId);
    if (!categoryExists) return;
    this.questionSets.update((sets) =>
      sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              categoryId,
              updatedAt: this.nowIso(),
            }
          : set,
      ),
    );
    this.selectedCategoryId.set(categoryId);
  }

  addQuestion(template?: Partial<AssessmentQuestion>): void {
    const set = this.activeSet();
    if (!set) return;
    const newQuestion: AssessmentQuestion = {
      id: this.buildId('q'),
      title: template?.title?.trim() || 'New Question',
      description: template?.description || '',
      type: template?.type || 'radio',
      required: template?.required ?? true,
      options: template?.options || [
        { id: this.buildId('o'), label: 'Option 1', value: 'option-1' },
        { id: this.buildId('o'), label: 'Option 2', value: 'option-2' },
      ],
      correctAnswer: template?.correctAnswer || '',
      correctAnswers: template?.correctAnswers || [],
      correctAnswerReason: template?.correctAnswerReason || '',
      weight: template?.weight ?? 1,
      negativeMark: template?.negativeMark ?? 0,
      controls: template?.controls || [],
    };
    this.questionSets.update((sets) =>
      sets.map((existing) =>
        existing.id === set.id
          ? {
              ...existing,
              questions: [...existing.questions, newQuestion],
              updatedAt: this.nowIso(),
            }
          : existing,
      ),
    );
  }

  saveQuestion(setId: string, question: AssessmentQuestion): void {
    this.questionSets.update((sets) =>
      sets.map((set) => {
        if (set.id !== setId) return set;
        return {
          ...set,
          questions: set.questions.map((item) =>
            item.id === question.id ? { ...question } : item,
          ),
          updatedAt: this.nowIso(),
        };
      }),
    );
  }

  duplicateQuestion(setId: string, questionId: string): void {
    const set = this.questionSets().find((item) => item.id === setId);
    if (!set) return;
    const question = set.questions.find((item) => item.id === questionId);
    if (!question) return;
    const clone: AssessmentQuestion = {
      ...JSON.parse(JSON.stringify(question)),
      id: this.buildId('q'),
      title: question.title + ' (Copy)',
      options: question.options?.map((option) => ({ ...option, id: this.buildId('o') })),
      controls: question.controls?.map((control) => ({ ...control, id: this.buildId('q') })),
    };
    this.questionSets.update((sets) =>
      sets.map((existing) =>
        existing.id === setId
          ? { ...existing, questions: [...existing.questions, clone], updatedAt: this.nowIso() }
          : existing,
      ),
    );
  }

  removeQuestion(setId: string, questionId: string): void {
    this.questionSets.update((sets) =>
      sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              questions: set.questions.filter((item) => item.id !== questionId),
              updatedAt: this.nowIso(),
            }
          : set,
      ),
    );
    const currentIndex = this.activeQuestionIndex();
    this.setActiveQuestionIndex(currentIndex > 0 ? currentIndex - 1 : 0);
  }

  updateResponse(questionId: string, value: AssessmentResponseValue): void {
    if (this.testSubmitted()) return;
    this.responses.update((current) => ({ ...current, [questionId]: value }));
  }

  hasResponseForQuestion(question: AssessmentQuestion): boolean {
    const value = this.responses()[question.id];
    if (question.type === 'checkbox') {
      return Array.isArray(value) && (value as string[]).length > 0;
    }
    if (question.type === 'mixed') {
      return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
    }
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  valueForQuestion(question: AssessmentQuestion): AssessmentResponseValue {
    return this.responses()[question.id] ?? (question.type === 'checkbox' ? [] : '');
  }

  nextQuestion(): void {
    const set = this.activeSet();
    if (!set) return;
    const nextIndex = Math.min(this.activeQuestionIndex() + 1, set.questions.length - 1);
    this.activeQuestionIndex.set(nextIndex);
  }

  previousQuestion(): void {
    const prevIndex = Math.max(this.activeQuestionIndex() - 1, 0);
    this.activeQuestionIndex.set(prevIndex);
  }

  jumpToQuestion(index: number): void {
    this.activeQuestionIndex.set(index);
  }

  resetAttemptState(): void {
    this.stopTimer();
    this.testStarted.set(false);
    this.testSubmitted.set(false);
    this.testStartTimeIso.set(null);
    this.autoSubmitted.set(false);
    this.remainingSeconds.set(this.activeSet()?.timerSeconds || 0);
  }

  startOrResumeAssessment(): void {
    const set = this.activeSet();
    if (!set || set.questions.length === 0) return;
    if (this.testSubmitted()) {
      this.responses.set({});
      this.lastResult.set(null);
      this.activeQuestionIndex.set(0);
      this.testSubmitted.set(false);
      this.autoSubmitted.set(false);
    }
    if (!this.testStarted()) {
      const shouldShuffleQuestions = set.shuffleQuestions;
      const shouldShuffleOptions = set.shuffleOptions;
      if (shouldShuffleQuestions || shouldShuffleOptions) {
        this.questionSets.update((sets) =>
          sets.map((s) => {
            if (s.id !== set.id) return s;
            let questions = [...s.questions];
            if (shouldShuffleQuestions) {
              questions = this.shuffleArray(questions);
            }
            if (shouldShuffleOptions) {
              questions = questions.map((q) => ({
                ...q,
                options: q.options ? this.shuffleArray(q.options) : q.options,
              }));
            }
            return { ...s, questions };
          }),
        );
      }
      this.testStarted.set(true);
      this.testStartTimeIso.set(this.nowIso());
      this.remainingSeconds.set(set.timerSeconds || 0);
    }
    this.startTimer();
  }

  private startTimer(): void {
    this.stopTimer();
    if (!this.testStarted() || this.testSubmitted()) return;
    const duration = this.activeSet()?.timerSeconds || 0;
    if (duration <= 0) return;
    this.timerHandle = setInterval(() => {
      const next = Math.max(0, this.remainingSeconds() - 1);
      this.remainingSeconds.set(next);
      if (next <= 0) {
        this.submitAssessment(true);
      }
    }, 1000);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  private stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private findMatchingOption(
    options: QuestionOption[] | undefined,
    val: string | number | undefined | null,
  ): QuestionOption | undefined {
    if (!options || !options.length || val === undefined || val === null) return undefined;
    const target = String(val).trim().toLowerCase();
    if (!target) return undefined;
    return options.find(
      (opt) =>
        opt.value.trim().toLowerCase() === target ||
        opt.label.trim().toLowerCase() === target ||
        opt.id.trim().toLowerCase() === target,
    );
  }

  private getHumanReadableOptionLabel(
    options: QuestionOption[] | undefined,
    val: string | number | undefined | null,
  ): string {
    if (val === undefined || val === null) return '';
    const match = this.findMatchingOption(options, val);
    return match ? match.label : String(val).trim();
  }

  private areAnswersMatching(
    options: QuestionOption[] | undefined,
    userVal: string | number | undefined | null,
    expectedVal: string | number | undefined | null,
  ): boolean {
    const u = String(userVal ?? '').trim().toLowerCase();
    const e = String(expectedVal ?? '').trim().toLowerCase();
    if (!u || !e) return false;
    if (u === e) return true;
    if (options && options.length > 0) {
      const uOpt = this.findMatchingOption(options, u);
      const eOpt = this.findMatchingOption(options, e);
      if (uOpt && eOpt && uOpt.id === eOpt.id) return true;
      if (uOpt && (uOpt.label.trim().toLowerCase() === e || uOpt.value.trim().toLowerCase() === e)) {
        return true;
      }
      if (eOpt && (eOpt.label.trim().toLowerCase() === u || eOpt.value.trim().toLowerCase() === u)) {
        return true;
      }
    }
    return false;
  }

  submitAssessment(autoTimeOver = false): void {
    const set = this.activeSet();
    if (!set) return;
    if (this.testSubmitted()) return;
    this.stopTimer();

    const details: AssessmentResultDetail[] = [];
    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let skippedCount = 0;

    const computeQuestionScore = (
      q: AssessmentQuestion,
      value: AssessmentResponseValue,
    ): AssessmentResultDetail => {
      let earned = 0;
      let possible = q.weight;
      let correct = false;
      let feedback = 'No response provided.';
      let userAnswerText = '';
      let correctAnswerText = '';
      let status: 'correct' | 'incorrect' | 'unanswered' = 'unanswered';

      if (q.type === 'mixed' && q.controls?.length) {
        let subEarned = 0;
        let subMax = 0;
        const subDetails: string[] = [];
        const subUserAnswers: string[] = [];
        const subCorrectAnswers: string[] = [];
        const responseObject = (
          value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        ) as Record<string, AssessmentResponseValue>;

        let allSubCorrect = true;
        let anyAnswered = false;

        for (const control of q.controls) {
          const controlResponse = responseObject?.[control.id];
          if (
            controlResponse !== undefined &&
            controlResponse !== null &&
            controlResponse !== '' &&
            (!Array.isArray(controlResponse) || controlResponse.length > 0)
          ) {
            anyAnswered = true;
          }
          const detail = this.computeSingleControlScore(control, controlResponse);
          subEarned += detail.earned;
          subMax += detail.possible;
          subDetails.push(detail.feedback);
          if (!detail.correct) allSubCorrect = false;
          if (detail.userAnswerText) {
            subUserAnswers.push(`${control.title}: ${detail.userAnswerText}`);
          }
          if (detail.correctAnswerText) {
            subCorrectAnswers.push(`${control.title}: ${detail.correctAnswerText}`);
          }
        }

        earned = Math.max(0, Math.min(subEarned, q.weight));
        possible = q.weight;
        correct = allSubCorrect;
        feedback = subDetails.join(' ');
        userAnswerText = subUserAnswers.join(' | ');
        correctAnswerText = subCorrectAnswers.join(' | ');
        status = correct ? 'correct' : anyAnswered ? 'incorrect' : 'unanswered';
      } else {
        const detail = this.computeSingleControlScore(q, value);
        earned = detail.earned;
        possible = detail.possible;
        correct = detail.correct;
        feedback = detail.feedback;
        userAnswerText = detail.userAnswerText;
        correctAnswerText = detail.correctAnswerText;
        status = detail.status;
      }

      if (status === 'correct') {
        correctCount += 1;
      } else if (status === 'unanswered') {
        skippedCount += 1;
      } else {
        incorrectCount += 1;
      }

      return {
        questionId: q.id,
        questionTitle: q.title,
        correct,
        earned,
        possible,
        feedback,
        userAnswerText,
        correctAnswerText,
        correctAnswerReason: q.correctAnswerReason,
        status,
      };
    };

    for (const question of set.questions) {
      const value = this.responses()[question.id];
      const detail = computeQuestionScore(question, value);
      details.push(detail);
      score += detail.earned;
      maxScore += detail.possible;
    }

    const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const badge = this.getBadge(percentage);
    const passingScore = set.passingScore ?? 60;
    const duration = set.timerSeconds || 0;
    const timeTakenSeconds = duration
      ? Math.max(0, duration - this.remainingSeconds())
      : this.testStartTimeIso()
        ? Math.max(0, Math.round((Date.now() - new Date(this.testStartTimeIso()!).getTime()) / 1000))
        : 0;

    const result: AssessmentResult = {
      score,
      maxScore,
      percentage,
      badge,
      passed: percentage >= passingScore,
      passingScore,
      correctCount,
      incorrectCount,
      skippedCount,
      totalQuestions: set.questions.length,
      totalMarks: maxScore,
      timeTakenSeconds,
      totalDurationSeconds: duration,
      submissionStatus: autoTimeOver ? 'auto-time-over' : 'manual',
      details,
      completedAt: this.nowIso(),
    };

    this.lastResult.set(result);
    this.testSubmitted.set(true);
    this.testStarted.set(false);
    this.autoSubmitted.set(autoTimeOver);
    this.history.update((items) => [
      {
        id: this.buildId('hist'),
        setId: set.id,
        setName: set.name,
        categoryName: this.getCategoryName(set.categoryId),
        result,
        durationSeconds: timeTakenSeconds,
      },
      ...items,
    ]);
  }

  private computeSingleControlScore(
    question: AssessmentQuestion,
    response: AssessmentResponseValue,
  ): {
    earned: number;
    possible: number;
    correct: boolean;
    feedback: string;
    userAnswerText: string;
    correctAnswerText: string;
    status: 'correct' | 'incorrect' | 'unanswered';
  } {
    const possible = question.weight;
    const required = question.required;
    const emptyResponse =
      response === undefined ||
      response === null ||
      (typeof response === 'string' && response.trim() === '') ||
      (Array.isArray(response) && response.length === 0) ||
      (typeof response === 'object' && !Array.isArray(response) && Object.keys(response).length === 0);

    // Extract expected answers
    const expectedList: string[] = [];
    if (question.correctAnswers && question.correctAnswers.length > 0) {
      expectedList.push(...question.correctAnswers.filter(Boolean));
    } else if (question.correctAnswer) {
      expectedList.push(
        ...question.correctAnswer
          .split(/[;,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }

    // Format human readable expected answer text
    const expectedLabels = expectedList.map((exp) =>
      this.getHumanReadableOptionLabel(question.options, exp),
    );
    const correctAnswerText = expectedLabels.join(', ');

    if (emptyResponse) {
      return {
        earned: 0,
        possible,
        correct: false,
        feedback: required ? 'Required question not answered.' : 'No answer provided.',
        userAnswerText: '',
        correctAnswerText,
        status: 'unanswered',
      };
    }

    if (question.type === 'checkbox') {
      const selectedArray: string[] = Array.isArray(response)
        ? (response as string[]).map((item) => String(item).trim()).filter(Boolean)
        : typeof response === 'string' && response.trim()
          ? [response.trim()]
          : [];

      const userLabels = selectedArray.map((item) =>
        this.getHumanReadableOptionLabel(question.options, item),
      );
      const userAnswerText = userLabels.join(', ');

      const matchedExpected = expectedList.filter((exp) =>
        selectedArray.some((sel) => this.areAnswersMatching(question.options, sel, exp)),
      );
      const missedExpected = expectedList.filter(
        (exp) => !selectedArray.some((sel) => this.areAnswersMatching(question.options, sel, exp)),
      );
      const incorrectSelected = selectedArray.filter(
        (sel) => !expectedList.some((exp) => this.areAnswersMatching(question.options, sel, exp)),
      );

      const correct =
        missedExpected.length === 0 &&
        incorrectSelected.length === 0 &&
        selectedArray.length > 0;
      const earned = correct
        ? possible
        : Math.max(0, matchedExpected.length - incorrectSelected.length) *
          (possible / Math.max(expectedList.length, 1));

      return {
        earned: Number(earned.toFixed(2)),
        possible,
        correct,
        feedback: correct
          ? 'Correct selection.'
          : `Selected ${selectedArray.length} choice(s). ${missedExpected.length ? `${missedExpected.length} correct answer(s) missing.` : ''} ${incorrectSelected.length ? `${incorrectSelected.length} incorrect answer(s).` : ''}`.trim(),
        userAnswerText,
        correctAnswerText,
        status: correct ? 'correct' : 'incorrect',
      };
    }

    if (question.type === 'radio') {
      const selected = String(response).trim();
      const userAnswerText = this.getHumanReadableOptionLabel(question.options, selected);
      const correct = expectedList.some((exp) =>
        this.areAnswersMatching(question.options, selected, exp),
      );

      return {
        earned: correct ? possible : question.negativeMark ? -question.negativeMark : 0,
        possible,
        correct,
        feedback: correct ? 'Correct.' : 'Incorrect choice.',
        userAnswerText,
        correctAnswerText,
        status: correct ? 'correct' : 'incorrect',
      };
    }

    if (question.type === 'textbox' || question.type === 'textarea') {
      const answer = String(response).trim();
      const userAnswerText = answer;
      const answerLower = answer.toLowerCase();

      const correct =
        expectedList.length > 0
          ? expectedList.some((exp) => {
              const expLower = exp.trim().toLowerCase();
              return answerLower === expLower || answerLower.includes(expLower);
            })
          : !!answer;

      return {
        earned: correct ? possible : question.negativeMark ? -question.negativeMark : 0,
        possible,
        correct,
        feedback: correct
          ? 'Answer matches expected keywords.'
          : 'Answer does not match expected response.',
        userAnswerText,
        correctAnswerText,
        status: correct ? 'correct' : 'incorrect',
      };
    }

    return {
      earned: 0,
      possible,
      correct: false,
      feedback: 'Unable to grade this question type automatically.',
      userAnswerText: String(response ?? ''),
      correctAnswerText,
      status: 'incorrect',
    };
  }

  private getBadge(percentage: number): string {
    if (percentage >= 90) return 'Gold Champion';
    if (percentage >= 75) return 'Silver Achiever';
    if (percentage >= 60) return 'Bronze Performer';
    return 'Participant';
  }

  generateCertificate(userName: string): CertificateData | null {
    const result = this.lastResult();
    const set = this.activeSet();
    if (!result || !set) return null;
    const certificate: CertificateData = {
      userName: userName.trim() || 'Anonymous Learner',
      assessmentName: set.name,
      category: this.getCategoryName(set.categoryId),
      score: result.score,
      percentage: result.percentage,
      badge: result.badge,
      completedAt: result.completedAt,
    };
    this.certificatePreview.set(certificate);
    return certificate;
  }

  async downloadCertificatePdf(userName: string): Promise<void> {
    const certificateData = this.generateCertificate(userName);
    if (!certificateData) return;

    const isJarvis = this.themeService.isJarvis();

    // ── Theme Palettes ────────────────────────────────────────────────────────
    const theme = isJarvis
      ? {
          bgPage:       '#020c18',
          bgCard:       '#041525',
          accent1:      '#00c8ff',
          accent2:      '#0055aa',
          accent3:      '#003366',
          gold:         '#00e5ff',
          goldLight:    '#80f0ff',
          textPrimary:  '#c8eeff',
          textSecondary:'#5fb4d8',
          textMuted:    '#2d7a9a',
          borderOuter:  '#00c8ff',
          borderInner:  '#003a5c',
          tableHead:    '#00182e',
          tableRow1:    '#041525',
          tableRow2:    '#021020',
          sealBg:       '#003366',
          sealRing:     '#00c8ff',
          ribbonTop:    '#0044aa',
          ribbonBot:    '#002255',
          title:        'J.A.R.V.I.S. INTELLIGENCE SYSTEMS',
        }
      : {
          bgPage:       '#0f172a',
          bgCard:       '#1e293b',
          accent1:      '#818cf8',
          accent2:      '#4f46e5',
          accent3:      '#312e81',
          gold:         '#f59e0b',
          goldLight:    '#fde68a',
          textPrimary:  '#f1f5f9',
          textSecondary:'#94a3b8',
          textMuted:    '#475569',
          borderOuter:  '#6366f1',
          borderInner:  '#312e81',
          tableHead:    '#1e1b4b',
          tableRow1:    '#1e293b',
          tableRow2:    '#0f172a',
          sealBg:       '#1e1b4b',
          sealRing:     '#f59e0b',
          ribbonTop:    '#4338ca',
          ribbonBot:    '#312e81',
          title:        'U2 TOOLS ACADEMY',
        };

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, H = 210;
    const cx = W / 2;

    // ── Background ────────────────────────────────────────────────────────────
    doc.setFillColor(theme.bgPage);
    doc.rect(0, 0, W, H, 'F');

    // ── Outer decorative border (double line) ─────────────────────────────────
    doc.setDrawColor(theme.borderOuter);
    doc.setLineWidth(1.5);
    doc.rect(6, 6, W - 12, H - 12);
    doc.setLineWidth(0.4);
    doc.rect(9, 9, W - 18, H - 18);

    // ── Corner accent squares ─────────────────────────────────────────────────
    const corners = [[6, 6], [W - 14, 6], [6, H - 14], [W - 14, H - 14]];
    doc.setFillColor(theme.accent1);
    for (const [x, y] of corners) {
      doc.rect(x, y, 8, 8, 'F');
    }

    // ── Header band ───────────────────────────────────────────────────────────
    doc.setFillColor(theme.accent3);
    doc.rect(9, 9, W - 18, 26, 'F');
    // subtle accent stripe
    doc.setFillColor(theme.accent2);
    doc.rect(9, 9, W - 18, 3, 'F');

    // ── Issuer label ──────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(theme.accent1);
    doc.text(theme.title, cx, 17, { align: 'center', charSpace: 1.5 });

    // ── Main title ────────────────────────────────────────────────────────────
    doc.setFontSize(26);
    doc.setTextColor(theme.gold);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF ACHIEVEMENT', cx, 28, { align: 'center', charSpace: 0.8 });

    // ── Gold divider line ─────────────────────────────────────────────────────
    doc.setDrawColor(theme.gold);
    doc.setLineWidth(0.8);
    doc.line(30, 39, W - 30, 39);
    doc.setLineWidth(0.25);
    doc.line(35, 41, W - 35, 41);

    // ── Seal circle (right side) ──────────────────────────────────────────────
    const sealX = W - 38, sealY = 75, sealR = 22;
    doc.setFillColor(theme.sealBg);
    doc.circle(sealX, sealY, sealR, 'F');
    doc.setDrawColor(theme.sealRing);
    doc.setLineWidth(1.2);
    doc.circle(sealX, sealY, sealR);
    doc.setLineWidth(0.4);
    doc.circle(sealX, sealY, sealR - 3);
    // star in seal
    doc.setFontSize(18);
    doc.setTextColor(theme.gold);
    doc.text('★', sealX, sealY - 4, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setTextColor(theme.accent1);
    doc.setFont('helvetica', 'bold');
    doc.text('VERIFIED', sealX, sealY + 4, { align: 'center', charSpace: 1 });
    doc.text('ACHIEVEMENT', sealX, sealY + 9, { align: 'center', charSpace: 0.5 });

    // ── "This certifies that" ─────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(theme.textSecondary);
    doc.text('This is to certify that', cx - 18, 53, { align: 'center' });

    // ── Recipient name ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(24);
    doc.setTextColor(theme.goldLight);
    doc.text(certificateData.userName, cx - 18, 68, { align: 'center' });
    // underline
    doc.setDrawColor(theme.gold);
    doc.setLineWidth(0.5);
    const nameWidth = doc.getTextWidth(certificateData.userName);
    doc.line(cx - 18 - nameWidth / 2, 71, cx - 18 + nameWidth / 2, 71);

    // ── Body text ─────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(theme.textSecondary);
    doc.text('has successfully completed the assessment', cx - 18, 80, { align: 'center' });

    // ── Assessment name ───────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(theme.accent1);
    doc.text(certificateData.assessmentName, cx - 18, 91, { align: 'center' });

    // ── Category ─────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(theme.textSecondary);
    doc.text(`Category: ${certificateData.category}`, cx - 18, 99, { align: 'center' });

    // ── Score badge band ──────────────────────────────────────────────────────
    doc.setFillColor(theme.accent3);
    doc.roundedRect(cx - 60, 104, 120, 18, 4, 4, 'F');
    doc.setDrawColor(theme.accent1);
    doc.setLineWidth(0.5);
    doc.roundedRect(cx - 60, 104, 120, 18, 4, 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(theme.gold);
    doc.text(
      `Score: ${certificateData.score} pts  |  ${certificateData.percentage}%  |  Badge: ${certificateData.badge}`,
      cx - 18, 115, { align: 'center' }
    );

    // ── Divider ───────────────────────────────────────────────────────────────
    doc.setDrawColor(theme.borderInner);
    doc.setLineWidth(0.3);
    doc.line(20, 128, W - 20, 128);

    // ── Details table ─────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 132,
      margin: { left: 20, right: 20 },
      theme: 'plain',
      head: [['DETAIL', 'VALUE']],
      body: [
        ['Assessment', certificateData.assessmentName],
        ['Category', certificateData.category],
        ['Score', `${certificateData.score} points (${certificateData.percentage}%)`],
        ['Badge Earned', certificateData.badge],
        ['Completed On', new Date(certificateData.completedAt).toLocaleString()],
      ],
      headStyles: {
        fillColor: theme.tableHead,
        textColor: theme.accent1,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: theme.textPrimary,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: theme.tableRow2,
      },
      styles: {
        fillColor: theme.tableRow1,
        lineColor: theme.borderInner,
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: theme.textSecondary, cellWidth: 45 },
      },
    });

    // ── Footer bar ────────────────────────────────────────────────────────────
    doc.setFillColor(theme.accent3);
    doc.rect(9, H - 18, W - 18, 9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(theme.textMuted);
    doc.text(
      `Generated by U2 Tools  •  ${new Date().toLocaleDateString()}  •  This certificate is digitally issued and is valid.`,
      cx, H - 12, { align: 'center' }
    );

    doc.save(
      `${certificateData.assessmentName.replace(/\s+/g, '_')}-${certificateData.userName.replace(/\s+/g, '_')}.pdf`,
    );
  }

  exportToExcel(): void {
    try {
      const workbook: WorkBook = utils.book_new();
      const categoryRows = [
        ['Category ID', 'Name', 'Description'],
        ...this.categories().map((category) => [
          category.id,
          category.name,
          category.description || '',
        ]),
      ];
      const categorySheet = utils.aoa_to_sheet(categoryRows);
      utils.book_append_sheet(workbook, categorySheet, 'Categories');

      const questionRows: Array<Array<string | number>> = [
        [
          'Category Name',
          'Question Set Name',
          'Question Set Description',
          'Question Set Timer',
          'Question ID',
          'Title',
          'Description',
          'Type',
          'Options',
          'Correct Answer',
          'Correct Answers',
          'Weight',
          'Negative Mark',
          'Required',
          'Reason for Correction',
          'Controls',
        ],
      ];

      let questionSerial = 0;
      for (const set of this.questionSets()) {
        const category = this.categories().find((item) => item.id === set.categoryId);
        for (const question of set.questions) {
          questionSerial++;
          questionRows.push([
            category?.name || 'Unknown',
            set.name,
            set.description || '',
            set.timerSeconds || '',
            `Q${questionSerial}`,
            question.title,
            question.description || '',
            question.type,
            question.options?.map((option) => `${option.label}:${option.value}`).join('; ') || '',
            question.correctAnswer || '',
            question.correctAnswers?.join(', ') || '',
            question.weight,
            question.negativeMark,
            question.required ? 'TRUE' : 'FALSE',
            question.correctAnswerReason || '',
            question.controls
              ?.map((control) => `${control.type}|${control.title}|${control.correctAnswer || ''}`)
              .join('||') || '',
          ]);
        }
      }

      const questionSheet = utils.aoa_to_sheet(questionRows);
      utils.book_append_sheet(workbook, questionSheet, 'Questions');
      writeFile(workbook, 'assessment-test-export.xlsx');
      this.exportMessage.set('Export completed successfully.');
      setTimeout(() => this.exportMessage.set(null), 3000);
    } catch (error) {
      console.error('AssessmentTestService: export failed', error);
      this.exportMessage.set('Export failed. Please try again.');
    }
  }

  async importFromExcel(file: File): Promise<void> {
    this.importErrors.set([]);
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { type: 'array' });
      const errors: string[] = [];
      const categories: Category[] = [];
      const sets: QuestionSet[] = [];

      const categorySheet =
        workbook.Sheets['Categories'] || workbook.Sheets[workbook.SheetNames[0]];
      if (!categorySheet) {
        errors.push('Categories sheet is missing.');
      } else {
        const rows = utils.sheet_to_json<string[]>(categorySheet, { header: 1, defval: '' });
        const header = rows[0] as string[];
        const expected = ['Category ID', 'Name', 'Description'];
        if (!expected.every((label, index) => label === String(header[index]).trim())) {
          errors.push('Categories sheet header does not match expected columns.');
        } else {
          for (let i = 1; i < rows.length; i += 1) {
            const row = rows[i];
            if (!row || !row[0]?.toString().trim() || !row[1]?.toString().trim()) continue;
            categories.push({
              id: row[0].toString().trim(),
              name: row[1].toString().trim(),
              description: row[2]?.toString().trim() || '',
            });
          }
        }
      }

      const questionSheet = workbook.Sheets['Questions'] || workbook.Sheets[workbook.SheetNames[1]];
      if (!questionSheet) {
        errors.push('Questions sheet is missing.');
      } else {
        const rows = utils.sheet_to_json<string[]>(questionSheet, { header: 1, defval: '' });
        const header = rows[0] as string[];
        const expected = [
          'Category Name',
          'Question Set Name',
          'Question Set Description',
          'Question Set Timer',
          'Question ID',
          'Title',
          'Description',
          'Type',
          'Options',
          'Correct Answer',
          'Correct Answers',
          'Weight',
          'Negative Mark',
          'Required',
          'Reason for Correction',
          'Controls',
        ];
        if (!expected.every((label, index) => label === String(header[index]).trim())) {
          errors.push('Questions sheet header does not match expected columns.');
        } else {
          const setsByName = new Map<string, QuestionSet>();
          for (let i = 1; i < rows.length; i += 1) {
            const row = rows[i];
            if (!row || !row[1]?.toString().trim() || !row[5]?.toString().trim()) {
              continue;
            }
            const categoryName = row[0].toString().trim();
            const setName = row[1].toString().trim();
            const category = categories.find((item) => item.name === categoryName) || categories[0];
            if (!category) {
              errors.push(`Row ${i + 1}: Category ${categoryName} not found.`);
              continue;
            }
            const setKey = `${category.id}:${setName}`;
            let set = setsByName.get(setKey);
            if (!set) {
              set = {
                id: this.buildId('set'),
                categoryId: category.id,
                name: setName,
                description: row[2]?.toString().trim() || '',
                timerSeconds: Number(row[3]) || undefined,
                questions: [],
                createdAt: this.nowIso(),
                updatedAt: this.nowIso(),
              };
              setsByName.set(setKey, set);
            }

            const type = (row[7] || 'radio').toString().trim() as QuestionInputType;
            const options = row[8]
              .toString()
              .split(';')
              .map((item) => item.trim())
              .filter(Boolean)
              .map((text, index) => {
                const [label, value] = text.includes(':')
                  ? text.split(':').map((entry) => entry.trim())
                  : [text, `option-${index + 1}`];
                return {
                  id: this.buildId('o'),
                  label,
                  value: value || label.toLowerCase().replace(/\s+/g, '-'),
                };
              });

            const controlsText = row[15]?.toString().trim() || '';
            const controls: AssessmentQuestion[] = controlsText
              ? controlsText.split('||').map((controlText) => {
                  const [controlType, controlTitle, controlCorrect] = controlText
                    .split('|')
                    .map((value) => value.trim());
                  return {
                    id: this.buildId('q'),
                    title: controlTitle || 'Sub question',
                    description: '',
                    type: (controlType || 'textbox') as QuestionInputType,
                    required: true,
                    options: [],
                    correctAnswer: controlCorrect || '',
                    correctAnswers: [],
                    weight: 1,
                    negativeMark: 0,
                  };
                })
              : [];

            const question: AssessmentQuestion = {
              id: row[4]?.toString().trim() || this.buildId('q'),
              title: row[5]?.toString().trim(),
              description: row[6]?.toString().trim() || '',
              type,
              required: row[13]?.toString().trim().toLowerCase() === 'true',
              options: options.length ? options : undefined,
              correctAnswer: row[9]?.toString().trim() || undefined,
              correctAnswers: row[10]
                ?.toString()
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              weight: Number(row[11]) || 1,
              negativeMark: Number(row[12]) || 0,
              correctAnswerReason: row[14]?.toString().trim() || undefined,
              controls: controls.length ? controls : undefined,
            };
            set.questions.push(question);
          }

          sets.push(...setsByName.values());
        }
      }

      if (errors.length > 0) {
        this.importErrors.set(errors);
        return;
      }

      if (categories.length === 0 || sets.length === 0) {
        this.importErrors.set(['Imported workbook contains no valid categories or questions.']);
        return;
      }

      this.categories.set(categories);
      this.questionSets.set(sets);
      this.selectedCategoryId.set(categories[0].id);
      this.selectedSetId.set(sets[0].id);
      this.activeQuestionIndex.set(0);
      this.responses.set({});
      this.lastResult.set(null);
      this.importErrors.set([]);
      this.errorMessage.set('Import completed successfully.');
      setTimeout(() => this.errorMessage.set(null), 3000);
    } catch (error) {
      console.error('AssessmentTestService: import failed', error);
      this.importErrors.set(['Failed to read Excel file. Please upload a valid workbook.']);
    }
  }

  clearAllData(): void {
    this.stopTimer();
    this.categories.set([]);
    this.questionSets.set([]);
    this.selectedCategoryId.set(null);
    this.selectedSetId.set(null);
    this.activeQuestionIndex.set(0);
    this.responses.set({});
    this.lastResult.set(null);
    this.history.set([]);
    this.testStarted.set(false);
    this.testSubmitted.set(false);
    this.testStartTimeIso.set(null);
    this.remainingSeconds.set(0);
    this.autoSubmitted.set(false);
    this.importErrors.set([]);
    this.exportMessage.set(null);
    this.syncMessage.set(null);
    this.errorMessage.set(null);
    this.certificatePreview.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  async syncToFirebase(): Promise<void> {
    const uid = this.authService.user()?.uid;
    if (!uid) {
      this.syncMessage.set('Sign in to sync assessment data with Firebase.');
      return;
    }

    this.isSyncing.set(true);
    this.syncMessage.set('Syncing assessment data...');

    try {
      await this.syncService.pushDocumentToFirestore('assessment-test', {
        lastUpdated: this.nowIso(),
        categories: this.categories(),
        selectedCategoryId: this.selectedCategoryId(),
        selectedSetId: this.selectedSetId(),
        activeQuestionIndex: this.activeQuestionIndex(),
        lastResult: this.lastResult(),
        history: this.history(),
        autoSyncEnabled: this.autoSyncEnabled(),
        testStarted: this.testStarted(),
        testSubmitted: this.testSubmitted(),
        testStartTimeIso: this.testStartTimeIso(),
        remainingSeconds: this.remainingSeconds(),
        autoSubmitted: this.autoSubmitted(),
        interactionSoundsEnabled: this.interactionSoundsEnabled(),
      });
      await this.syncService.pushToFirestore(
        'assessment-test',
        'question-sets',
        this.questionSets().map((set) => ({ ...set })),
      );
      await this.syncService.pushToFirestore('assessment-test', 'responses', [
        { id: uid, responses: this.responses() },
      ]);
      this.syncMessage.set('Assessment data synced successfully.');
    } catch (error) {
      console.error('AssessmentTestService: sync failed', error);
      this.syncMessage.set('Cloud sync failed.');
    } finally {
      this.isSyncing.set(false);
    }
  }

  async loadFromFirestore(uid: string): Promise<void> {
    try {
      const appDoc = await this.firestoreService.getDocument<any>(
        this.firestoreService.getUserAppPath(uid, 'assessment-test'),
      );
      if (appDoc?.lastUpdated) {
        const cloudSet = appDoc;
        const questionSets = await this.syncService.pullFromFirestore<QuestionSet>(
          'assessment-test',
          'question-sets',
        );
        const responseDocs = await this.syncService.pullFromFirestore<any>(
          'assessment-test',
          'responses',
        );
        const userResponse = responseDocs.find((item) => item.id === uid)?.responses || {};

        if (questionSets.length > 0) {
          this.questionSets.set(questionSets);
        }
        if (cloudSet.categories?.length) {
          this.categories.set(cloudSet.categories);
        }
        if (cloudSet.selectedCategoryId) {
          this.selectedCategoryId.set(cloudSet.selectedCategoryId);
        }
        if (cloudSet.selectedSetId) {
          this.selectedSetId.set(cloudSet.selectedSetId);
        }
        this.activeQuestionIndex.set(cloudSet.activeQuestionIndex || 0);
        this.lastResult.set(cloudSet.lastResult || null);
        this.history.set(cloudSet.history || []);
        this.autoSyncEnabled.set(cloudSet.autoSyncEnabled ?? false);
        this.testStarted.set(cloudSet.testStarted || false);
        this.testSubmitted.set(cloudSet.testSubmitted || false);
        this.testStartTimeIso.set(cloudSet.testStartTimeIso ?? null);
        this.remainingSeconds.set(cloudSet.remainingSeconds ?? this.activeSet()?.timerSeconds ?? 0);
        this.autoSubmitted.set(cloudSet.autoSubmitted || false);
        this.interactionSoundsEnabled.set(cloudSet.interactionSoundsEnabled || false);
        this.responses.set(userResponse);
        if (this.testStarted() && !this.testSubmitted()) {
          this.startTimer();
        }
        this.syncMessage.set('Cloud assessment data loaded.');
      }
    } catch (error) {
      console.error('AssessmentTestService: load from firestore failed', error);
      this.syncMessage.set('Cloud data load failed.');
    }
  }
}

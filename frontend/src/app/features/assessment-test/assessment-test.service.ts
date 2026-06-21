import { Injectable, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { read, utils, writeFile, WorkBook } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';
import { FirestoreService } from '../../core/services/firestore.service';

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
}

export interface AssessmentResult {
  score: number;
  maxScore: number;
  percentage: number;
  badge: string;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
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
  lastSyncedAt?: string;
}

const STORAGE_KEY = 'u2app.assessmentTestState';

@Injectable({ providedIn: 'root' })
export class AssessmentTestService implements OnDestroy {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);
  private firestoreService = inject(FirestoreService);

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
    // no subscriptions to clean up
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

  updateQuestionSet(setId: string, name: string, description: string, timerSeconds?: number): void {
    this.questionSets.update((sets) =>
      sets.map((set) =>
        set.id === setId
          ? {
              ...set,
              name: name.trim(),
              description: description.trim(),
              timerSeconds,
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

  submitAssessment(): void {
    const set = this.activeSet();
    if (!set) return;

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

      const normalizeAnswer = (input: AssessmentResponseValue): string[] => {
        if (Array.isArray(input)) return input.map((item) => String(item).trim().toLowerCase());
        if (typeof input === 'object' && input !== null) {
          return Object.values(input)
            .flatMap((inner) => (Array.isArray(inner) ? inner : [String(inner)]))
            .map((item) => item.trim().toLowerCase());
        }
        return [String(input).trim().toLowerCase()];
      };

      const responseValues = normalizeAnswer(value);
      if (q.type === 'mixed' && q.controls?.length) {
        let subEarned = 0;
        let subMax = 0;
        const subDetails: string[] = [];
        const responseObject = value as Record<string, AssessmentResponseValue>;

        for (const control of q.controls) {
          const controlResponse = responseObject?.[control.id];
          const detail = this.computeSingleControlScore(control, controlResponse);
          subEarned += detail.earned;
          subMax += detail.possible;
          subDetails.push(detail.feedback);
        }

        earned = Math.max(0, Math.min(subEarned, q.weight));
        possible = q.weight;
        correct = subDetails.every((text) => text.startsWith('Correct'));
        feedback = subDetails.join(' ');
      } else {
        const detail = this.computeSingleControlScore(q, value);
        earned = detail.earned;
        possible = detail.possible;
        correct = detail.correct;
        feedback = detail.feedback;
      }

      if (correct) correctCount += 1;
      if (!correct && !this.hasResponseForQuestion(q)) skippedCount += 1;
      if (!correct && this.hasResponseForQuestion(q) && q.required) incorrectCount += 1;

      return {
        questionId: q.id,
        questionTitle: q.title,
        correct,
        earned,
        possible,
        feedback,
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

    const result: AssessmentResult = {
      score,
      maxScore,
      percentage,
      badge,
      correctCount,
      incorrectCount,
      skippedCount,
      details,
      completedAt: this.nowIso(),
    };

    this.lastResult.set(result);
    this.history.update((items) => [
      {
        id: this.buildId('hist'),
        setId: set.id,
        setName: set.name,
        categoryName: this.getCategoryName(set.categoryId),
        result,
        durationSeconds: 0,
      },
      ...items,
    ]);
  }

  private computeSingleControlScore(
    question: AssessmentQuestion,
    response: AssessmentResponseValue,
  ): { earned: number; possible: number; correct: boolean; feedback: string } {
    const possible = question.weight;
    const required = question.required;
    const emptyResponse =
      response === undefined ||
      response === null ||
      (typeof response === 'string' && response.trim() === '') ||
      (Array.isArray(response) && response.length === 0);

    if (emptyResponse) {
      return {
        earned: 0,
        possible,
        correct: false,
        feedback: required ? 'Required question not answered.' : 'No answer provided.',
      };
    }

    if (question.type === 'checkbox') {
      const selected = Array.isArray(response)
        ? response.map((item) => String(item).trim().toLowerCase())
        : [];
      const expected = (question.correctAnswers ?? []).map((item) => item.trim().toLowerCase());
      const matched = expected.filter((value) => selected.includes(value));
      const missed = expected.filter((value) => !selected.includes(value));
      const incorrect = selected.filter((value) => !expected.includes(value));
      const earned =
        Math.max(0, matched.length - incorrect.length) * (possible / Math.max(expected.length, 1));
      const correct = missed.length === 0 && incorrect.length === 0;
      return {
        earned: Number(earned.toFixed(2)),
        possible,
        correct,
        feedback: correct
          ? 'Correct selection.'
          : `Selected ${selected.length} choice(s). ${missed.length ? `${missed.length} correct answer(s) missing.` : ''} ${incorrect.length ? `${incorrect.length} incorrect answer(s).` : ''}`,
      };
    }

    if (question.type === 'radio') {
      const selected = String(response).trim().toLowerCase();
      const expected = String(question.correctAnswer ?? '')
        .trim()
        .toLowerCase();
      const correct = selected === expected;
      return {
        earned: correct ? possible : -question.negativeMark,
        possible,
        correct,
        feedback: correct ? 'Correct.' : 'Incorrect choice.',
      };
    }

    if (question.type === 'textbox' || question.type === 'textarea') {
      const answer = String(response).trim().toLowerCase();
      const expected = String(question.correctAnswer ?? '')
        .trim()
        .toLowerCase();
      const correct = expected.length > 0 ? answer.includes(expected) : !!answer;
      return {
        earned: correct ? possible : -question.negativeMark,
        possible,
        correct,
        feedback: correct
          ? 'Answer matches expected keywords.'
          : 'Answer does not match expected response.',
      };
    }

    return {
      earned: 0,
      possible,
      correct: false,
      feedback: 'Unable to grade this question type automatically.',
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

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor('#1f2937');
    doc.rect(0, 0, 297, 210, 'F');
    doc.setTextColor('#f8fafc');
    doc.setFontSize(32);
    doc.text('Certificate of Completion', 148, 35, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`This certifies that`, 148, 52, { align: 'center' });
    doc.setFontSize(28);
    doc.text(certificateData.userName, 148, 72, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`has completed the assessment`, 148, 85, { align: 'center' });
    doc.setFontSize(22);
    doc.text(certificateData.assessmentName, 148, 100, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`Category: ${certificateData.category}`, 148, 115, { align: 'center' });
    doc.text(`Score: ${certificateData.score} (${certificateData.percentage}%)`, 148, 124, {
      align: 'center',
    });
    doc.text(`Badge earned: ${certificateData.badge}`, 148, 133, { align: 'center' });
    doc.text(`Date: ${new Date(certificateData.completedAt).toLocaleDateString()}`, 148, 142, {
      align: 'center',
    });
    autoTable(doc, {
      startY: 155,
      theme: 'grid',
      body: [
        ['Assessment', certificateData.assessmentName],
        ['Category', certificateData.category],
        ['Badge', certificateData.badge],
        ['Date', new Date(certificateData.completedAt).toLocaleString()],
      ],
    });
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
          'Controls',
        ],
      ];

      for (const set of this.questionSets()) {
        const category = this.categories().find((item) => item.id === set.categoryId);
        for (const question of set.questions) {
          questionRows.push([
            category?.name || 'Unknown',
            set.name,
            set.description || '',
            set.timerSeconds || '',
            question.id,
            question.title,
            question.description || '',
            question.type,
            question.options?.map((option) => `${option.label}:${option.value}`).join('; ') || '',
            question.correctAnswer || '',
            question.correctAnswers?.join(', ') || '',
            question.weight,
            question.negativeMark,
            question.required ? 'TRUE' : 'FALSE',
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

            const controlsText = row[14]?.toString().trim() || '';
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
        this.responses.set(userResponse);
        this.syncMessage.set('Cloud assessment data loaded.');
      }
    } catch (error) {
      console.error('AssessmentTestService: load from firestore failed', error);
      this.syncMessage.set('Cloud data load failed.');
    }
  }
}

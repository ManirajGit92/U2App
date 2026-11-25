import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import {
  AssessmentQuestionAdmin,
  AssessmentSession,
  CashTransaction,
  CharacterItem,
  Checkpoint,
  CheckpointStatus,
  DashboardSummary,
  GoalDetail,
  GoalPriority,
  GoalQuestExcelImportResponse,
  GoalQuestTab,
  GoalStatus,
  GoalSummary,
  IntervalUnit,
  QuestionType,
  ReportsData,
  ShopItem,
  SubmitAssessmentResponse,
  ThemeItem,
} from './models/goal-quest.models';
import { GoalQuestApiService } from './services/goal-quest-api.service';
import { GoalQuestExcelService } from './services/goal-quest-excel.service';
import { AvatarRendererComponent } from './components/avatar-renderer/avatar-renderer.component';
import { ExcelImportModalComponent } from './components/excel-import-modal/excel-import-modal.component';
import { AssessmentModalComponent } from './components/assessment-modal/assessment-modal.component';
import { OnboardingWalkthroughComponent } from './components/onboarding-walkthrough/onboarding-walkthrough.component';
import { SnakeLadderBoardComponent } from './components/snake-ladder-board/snake-ladder-board.component';

@Component({
  selector: 'app-goal-quest',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    AvatarRendererComponent,
    ExcelImportModalComponent,
    AssessmentModalComponent,
    OnboardingWalkthroughComponent,
    SnakeLadderBoardComponent,
  ],
  templateUrl: './goal-quest.component.html',
  styleUrl: './goal-quest.component.scss',
})
export class GoalQuestComponent implements OnInit {
  readonly api = inject(GoalQuestApiService);
  readonly excel = inject(GoalQuestExcelService);
  private readonly toast = inject(ToastService);

  // Navigation & UI state
  readonly activeTab = signal<GoalQuestTab>('roadmap');
  readonly roadmapMode = signal<'default' | 'snake-ladder'>(this.loadRoadmapMode());
  readonly showRoadmapModeMenu = signal(false);
  readonly isLoading = signal(true);
  private readonly roadmapModeKey = 'u2app.goalquest.roadmapMode';
  readonly showExportMenu = signal(false);
  readonly showImportModal = signal(false);
  readonly showBackgroundModal = signal(false);
  readonly showWalkthrough = signal(false);
  readonly isResettingDemo = signal(false);
  bgUrlInput = '';
  bgPreviewUrl = signal<string>('');
  readonly activeAssessmentSession = signal<AssessmentSession | null>(null);
  private readonly tourSeenKey = 'u2app.goalquest.tourSeen';
  readonly shopCategoryFilter = signal<string>('All');
  readonly notificationOpen = signal(false);

  // Domain state
  readonly dashboard = signal<DashboardSummary | null>(null);
  readonly goals = signal<GoalSummary[]>([]);
  readonly selectedGoal = signal<GoalDetail | null>(null);
  readonly selectedCheckpoint = signal<Checkpoint | null>(null);
  readonly questions = signal<AssessmentQuestionAdmin[]>([]);
  readonly shopItems = signal<ShopItem[]>([]);
  readonly characters = signal<CharacterItem[]>([]);
  readonly themes = signal<ThemeItem[]>([]);
  readonly transactions = signal<CashTransaction[]>([]);
  readonly reports = signal<ReportsData | null>(null);

  // Goal Form Modal
  readonly showGoalForm = signal(false);
  readonly editingGoalId = signal<number | null>(null);
  goalForm = {
    title: '',
    description: '',
    category: 'Certification',
    priority: 'High' as GoalPriority,
    targetDateUtc: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    status: 'InProgress' as GoalStatus,
    themeCode: 'THEME-KINGDOM',
  };

  // Checkpoint Form Modal
  readonly showCheckpointForm = signal(false);
  readonly editingCheckpointId = signal<number | null>(null);
  cpForm = {
    sequenceOrder: 1,
    title: '',
    description: '',
    dueDateUtc: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    intervalValue: 7,
    intervalUnit: 'Days' as IntervalUnit,
    rewardCash: 100,
    earlyBonusCash: 100,
    latePenaltyCash: 50,
    passingPercentage: 90,
    timeLimitMinutes: 15,
    maxAttempts: 0,
    shuffleQuestions: false,
    status: 'Locked' as CheckpointStatus,
  };

  // Question Form (Assessment Tab)
  readonly editingQuestionId = signal<number | null>(null);
  qForm = {
    questionText: '',
    questionType: 'MultipleChoice' as QuestionType,
    optionsText: 'Option A | Option B | Option C | Option D',
    correctAnswerText: 'Option A',
    points: 1,
    explanation: '',
    orderIndex: 1,
  };

  // Settings Form
  settingsForm = {
    displayName: 'Quest Hero',
    defaultPassPercentage: 90,
    defaultTimeLimitMinutes: 15,
    defaultRewardCash: 100,
    earlyBonusMultiplier: 2.0,
    defaultLatePenaltyCash: 50,
    soundEnabled: true,
    animationsEnabled: true,
  };

  // Computed helpers
  readonly profile = computed(() => this.dashboard()?.profile ?? null);

  readonly activeThemeClass = computed(() => {
    const code = this.selectedGoal()?.themeCode ?? this.profile()?.activeThemeCode ?? 'THEME-FANTASY';
    if (code.includes('JUNGLE')) return 'theme-jungle';
    if (code.includes('SPACE') || code.includes('GALAXY')) return 'theme-space';
    if (code.includes('MOUNTAIN') || code.includes('VOLCANO')) return 'theme-mountain';
    return 'theme-fantasy';
  });

  readonly filteredShopItems = computed(() => {
    const cat = this.shopCategoryFilter();
    const all = this.shopItems();
    return cat === 'All' ? all : all.filter((i) => i.category === cat);
  });

  readonly shopCategories = [
    'All',
    'Costume',
    'Accessory',
    'Hairstyle',
    'Character',
    'Effect',
    'Badge',
    'Skin',
    'Theme',
  ];

  readonly ownedCostumes = computed(() =>
    this.shopItems().filter((i) => i.category === 'Costume' && i.isOwned),
  );
  readonly ownedAccessories = computed(() =>
    this.shopItems().filter((i) => i.category === 'Accessory' && i.isOwned),
  );
  readonly ownedHairstyles = computed(() =>
    this.shopItems().filter((i) => i.category === 'Hairstyle' && i.isOwned),
  );
  readonly ownedEffects = computed(() =>
    this.shopItems().filter((i) => i.category === 'Effect' && i.isOwned),
  );
  readonly ownedBadges = computed(() =>
    this.shopItems().filter((i) => i.category === 'Badge' && i.isOwned),
  );

  async ngOnInit(): Promise<void> {
    try {
      const status = await this.api.getModeStatus();
      if (!this.api.hasSavedModePreference()) {
        this.api.setWorkspaceMode(status.recommendedMode);
      }
      if (!status.hasPersonalData && this.api.isDemoMode() && !this.hasSeenTour()) {
        this.showWalkthrough.set(true);
      }
    } catch {
      // Proceed with default mode if API is offline
    }
    await this.refreshAll();
  }

  private hasSeenTour(): boolean {
    try {
      return localStorage.getItem(this.tourSeenKey) === 'true';
    } catch {
      return false;
    }
  }

  dismissWalkthrough(): void {
    this.showWalkthrough.set(false);
    try {
      localStorage.setItem(this.tourSeenKey, 'true');
    } catch {
      // ignore
    }
  }

  async resetDemoData(): Promise<void> {
    if (!this.api.isDemoMode()) return;
    this.isResettingDemo.set(true);
    try {
      await this.api.resetDemoData();
      this.toast.show(
        'Demo Reset Complete',
        'Practice Mode has been restored to fresh default quests, wallet, and themes.',
        'success',
      );
      await this.refreshAll();
    } catch {
      this.toast.show('Error', 'Could not reset demo data.', 'error');
    } finally {
      this.isResettingDemo.set(false);
    }
  }

  async startMyOwnJourney(): Promise<void> {
    this.dismissWalkthrough();
    this.api.setWorkspaceMode('live');
    await this.refreshAll();
    this.toast.show(
      'Personal Journey Started!',
      'You are now in your clean personal workspace. Demo data stays completely separate.',
      'success',
    );
    if (this.goals().length === 0) {
      this.openNewGoalModal();
    }
  }

  async enterPracticeMode(): Promise<void> {
    this.api.setWorkspaceMode('demo');
    await this.refreshAll();
    this.toast.show(
      'Practice Mode Active',
      'Explore freely! Your personal goals and transactions are safely untouched.',
      'info',
    );
  }

  async refreshAll(preferredGoalId?: number): Promise<void> {
    this.isLoading.set(true);
    try {
      const [dash, goalsList, shop, chars, themesList] = await Promise.all([
        this.api.getDashboard(),
        this.api.getGoals(),
        this.api.getShopItems(),
        this.api.getCharacters(),
        this.api.getThemes(),
      ]);

      this.dashboard.set(dash);
      this.goals.set(goalsList);
      this.shopItems.set(shop);
      this.characters.set(chars);
      this.themes.set(themesList);
      this.syncSettingsForm(dash);

      const targetGoalId =
        preferredGoalId ??
        this.selectedGoal()?.id ??
        dash.featuredGoal?.id ??
        goalsList[0]?.id ??
        null;

      if (targetGoalId) {
        await this.selectGoal(targetGoalId);
      } else {
        this.selectedGoal.set(null);
        this.selectedCheckpoint.set(null);
      }
    } catch {
      this.toast.show(
        'Backend Unavailable',
        'Start U2Tools.Api on port 5110 to connect GoalQuest to SQL Server.',
        'warning',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private syncSettingsForm(dash: DashboardSummary): void {
    const p = dash.profile;
    this.settingsForm = {
      displayName: p.displayName,
      defaultPassPercentage: p.defaultPassPercentage,
      defaultTimeLimitMinutes: p.defaultTimeLimitMinutes,
      defaultRewardCash: p.defaultRewardCash,
      earlyBonusMultiplier: p.earlyBonusMultiplier,
      defaultLatePenaltyCash: p.defaultLatePenaltyCash,
      soundEnabled: p.soundEnabled,
      animationsEnabled: p.animationsEnabled,
    };
  }

  private loadRoadmapMode(): 'default' | 'snake-ladder' {
    try {
      const saved = localStorage.getItem('u2app.goalquest.roadmapMode');
      return saved === 'snake-ladder' ? 'snake-ladder' : 'default';
    } catch {
      return 'default';
    }
  }

  setRoadmapMode(mode: 'default' | 'snake-ladder'): void {
    this.roadmapMode.set(mode);
    this.showRoadmapModeMenu.set(false);
    this.activeTab.set('roadmap');
    try {
      localStorage.setItem(this.roadmapModeKey, mode);
    } catch {
      // ignore storage errors
    }
  }

  async setTab(tab: GoalQuestTab): Promise<void> {
    this.activeTab.set(tab);
    this.showExportMenu.set(false);
    this.showRoadmapModeMenu.set(false);

    if (tab === 'reports') {
      await this.loadReports();
    } else if (tab === 'assessment' && this.selectedCheckpoint()) {
      await this.loadQuestions(this.selectedCheckpoint()!.id);
    } else if (tab === 'rewards') {
      const [items, txs] = await Promise.all([
        this.api.getShopItems(),
        this.api.getTransactions(),
      ]);
      this.shopItems.set(items);
      this.transactions.set(txs);
    }
  }

  async selectGoal(goalId: number): Promise<void> {
    try {
      const detail = await this.api.getGoalDetail(goalId);
      this.selectedGoal.set(detail);

      const activeCp =
        detail.checkpoints.find((c) => c.status === 'InProgress') ??
        detail.checkpoints[0] ??
        null;
      this.selectedCheckpoint.set(activeCp);

      if (activeCp && this.activeTab() === 'assessment') {
        await this.loadQuestions(activeCp.id);
      }
    } catch {
      this.toast.show('Error', 'Could not load goal details.', 'error');
    }
  }

  async selectCheckpoint(cp: Checkpoint): Promise<void> {
    this.selectedCheckpoint.set(cp);
    if (this.activeTab() === 'assessment') {
      await this.loadQuestions(cp.id);
    }
  }

  // ─── Roadmap Background Image (Local Browse + Image URL) ───
  openBackgroundModal(): void {
    const goal = this.selectedGoal();
    if (!goal) {
      this.toast.show('Select a Goal', 'Create or select a goal first.', 'warning');
      return;
    }
    const existing = goal.backgroundImageUrl ?? '';
    this.bgUrlInput = existing.startsWith('http') ? existing : '';
    this.bgPreviewUrl.set(existing);
    this.showBackgroundModal.set(true);
  }

  onBgUrlInputChange(val: string): void {
    this.bgUrlInput = val;
    const trimmed = val.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      this.bgPreviewUrl.set(trimmed);
    }
  }

  onLocalBgFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.show('Invalid File', 'Please select a valid image file (PNG, JPG, WebP, GIF).', 'warning');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      this.toast.show('Image Too Large', 'Please choose an image smaller than 4 MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        this.bgUrlInput = '';
        this.bgPreviewUrl.set(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  async saveBackgroundImage(): Promise<void> {
    const goal = this.selectedGoal();
    if (!goal) return;

    const urlToSave = this.bgUrlInput.trim() || this.bgPreviewUrl().trim();
    if (urlToSave && !urlToSave.startsWith('http://') && !urlToSave.startsWith('https://') && !urlToSave.startsWith('data:image/')) {
      this.toast.show('Invalid URL', 'Enter a valid http:// or https:// image URL, or browse a local image.', 'warning');
      return;
    }

    try {
      await this.api.updateGoal(goal.id, {
        title: goal.title,
        description: goal.description,
        category: goal.category,
        priority: goal.priority,
        targetDateUtc: goal.targetDateUtc,
        status: goal.status,
        themeCode: goal.themeCode,
        backgroundImageUrl: urlToSave,
      });
      this.showBackgroundModal.set(false);
      this.toast.show(
        'Background Updated',
        urlToSave.startsWith('http')
          ? 'Custom background URL saved and will be included in Excel exports!'
          : 'Local background image applied to your roadmap!',
        'success',
      );
      await this.refreshAll(goal.id);
    } catch {
      this.toast.show('Error', 'Failed to save roadmap background.', 'error');
    }
  }

  async resetBackgroundImage(): Promise<void> {
    this.bgUrlInput = '';
    this.bgPreviewUrl.set('');
    await this.saveBackgroundImage();
  }

  // ─── Goal CRUD ───
  openNewGoalModal(): void {
    this.editingGoalId.set(null);
    this.goalForm = {
      title: '',
      description: '',
      category: 'Certification',
      priority: 'High',
      targetDateUtc: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      status: 'InProgress',
      themeCode: this.profile()?.activeThemeCode ?? 'THEME-KINGDOM',
    };
    this.showGoalForm.set(true);
  }

  openEditGoalModal(goal: GoalDetail | GoalSummary): void {
    this.editingGoalId.set(goal.id);
    this.goalForm = {
      title: goal.title,
      description: goal.description,
      category: goal.category,
      priority: goal.priority,
      targetDateUtc: goal.targetDateUtc.slice(0, 10),
      status: goal.status,
      themeCode: goal.themeCode,
    };
    this.showGoalForm.set(true);
  }

  async saveGoal(): Promise<void> {
    if (!this.goalForm.title.trim()) {
      this.toast.show('Validation', 'Please enter a goal title.', 'warning');
      return;
    }

    const payload = {
      title: this.goalForm.title.trim(),
      description: this.goalForm.description.trim(),
      category: this.goalForm.category,
      priority: this.goalForm.priority,
      targetDateUtc: new Date(this.goalForm.targetDateUtc).toISOString(),
      status: this.goalForm.status,
      themeCode: this.goalForm.themeCode,
    };

    try {
      const editId = this.editingGoalId();
      const saved = editId
        ? await this.api.updateGoal(editId, payload)
        : await this.api.createGoal(payload);

      this.showGoalForm.set(false);
      this.toast.show('Success', editId ? 'Goal updated!' : 'New quest goal created!', 'success');
      await this.refreshAll(saved.id);
    } catch {
      this.toast.show('Error', 'Failed to save goal.', 'error');
    }
  }

  async deleteGoal(goalId: number): Promise<void> {
    try {
      await this.api.deleteGoal(goalId);
      this.toast.show('Deleted', 'Goal removed.', 'info');
      await this.refreshAll();
    } catch {
      this.toast.show('Error', 'Failed to delete goal.', 'error');
    }
  }

  async createSampleQuest(): Promise<void> {
    try {
      const sample = await this.api.createSampleGoal();
      this.toast.show('Quest Loaded', 'Sample Azure AI Certification quest created!', 'success');
      await this.refreshAll(sample.id);
      this.activeTab.set('roadmap');
    } catch {
      this.toast.show('Error', 'Failed to create sample quest.', 'error');
    }
  }

  // ─── Checkpoint CRUD ───
  openNewCheckpointModal(): void {
    const goal = this.selectedGoal();
    if (!goal) {
      this.toast.show('Select a Goal', 'Create or select a goal first.', 'warning');
      return;
    }
    const p = this.profile();
    this.editingCheckpointId.set(null);
    this.cpForm = {
      sequenceOrder: goal.checkpoints.length + 1,
      title: '',
      description: '',
      dueDateUtc: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      intervalValue: 7,
      intervalUnit: 'Days',
      rewardCash: p?.defaultRewardCash ?? 100,
      earlyBonusCash: Math.round((p?.defaultRewardCash ?? 100) * ((p?.earlyBonusMultiplier ?? 2) - 1)),
      latePenaltyCash: p?.defaultLatePenaltyCash ?? 50,
      passingPercentage: p?.defaultPassPercentage ?? 90,
      timeLimitMinutes: p?.defaultTimeLimitMinutes ?? 15,
      maxAttempts: 0,
      shuffleQuestions: false,
      status: goal.checkpoints.length === 0 ? 'InProgress' : 'Locked',
    };
    this.showCheckpointForm.set(true);
  }

  openEditCheckpointModal(cp: Checkpoint): void {
    this.editingCheckpointId.set(cp.id);
    this.cpForm = {
      sequenceOrder: cp.sequenceOrder,
      title: cp.title,
      description: cp.description,
      dueDateUtc: cp.dueDateUtc.slice(0, 10),
      intervalValue: cp.intervalValue,
      intervalUnit: cp.intervalUnit,
      rewardCash: cp.rewardCash,
      earlyBonusCash: cp.earlyBonusCash,
      latePenaltyCash: cp.latePenaltyCash,
      passingPercentage: cp.passingPercentage,
      timeLimitMinutes: cp.timeLimitMinutes,
      maxAttempts: cp.maxAttempts,
      shuffleQuestions: cp.shuffleQuestions,
      status: cp.status,
    };
    this.showCheckpointForm.set(true);
  }

  async saveCheckpoint(): Promise<void> {
    const goal = this.selectedGoal();
    if (!goal || !this.cpForm.title.trim()) {
      this.toast.show('Validation', 'Checkpoint title is required.', 'warning');
      return;
    }

    const payload = {
      ...this.cpForm,
      title: this.cpForm.title.trim(),
      description: this.cpForm.description.trim(),
      dueDateUtc: new Date(this.cpForm.dueDateUtc).toISOString(),
    };

    try {
      const editId = this.editingCheckpointId();
      if (editId) {
        await this.api.updateCheckpoint(editId, payload);
      } else {
        await this.api.createCheckpoint(goal.id, payload);
      }
      this.showCheckpointForm.set(false);
      this.toast.show('Saved', 'Checkpoint configuration saved.', 'success');
      await this.refreshAll(goal.id);
    } catch {
      this.toast.show('Error', 'Failed to save checkpoint.', 'error');
    }
  }

  async deleteCheckpoint(cpId: number): Promise<void> {
    const goalId = this.selectedGoal()?.id;
    try {
      await this.api.deleteCheckpoint(cpId);
      this.toast.show('Deleted', 'Checkpoint removed.', 'info');
      await this.refreshAll(goalId);
    } catch {
      this.toast.show('Error', 'Failed to delete checkpoint.', 'error');
    }
  }

  // ─── Assessment Questions CRUD ───
  async loadQuestions(checkpointId: number): Promise<void> {
    try {
      const list = await this.api.getQuestions(checkpointId);
      this.questions.set(list);
    } catch {
      this.questions.set([]);
    }
  }

  resetQuestionForm(): void {
    this.editingQuestionId.set(null);
    this.qForm = {
      questionText: '',
      questionType: 'MultipleChoice',
      optionsText: 'Option A | Option B | Option C | Option D',
      correctAnswerText: 'Option A',
      points: 1,
      explanation: '',
      orderIndex: this.questions().length + 1,
    };
  }

  editQuestion(q: AssessmentQuestionAdmin): void {
    this.editingQuestionId.set(q.id);
    this.qForm = {
      questionText: q.questionText,
      questionType: q.questionType,
      optionsText: q.options.join(' | '),
      correctAnswerText: q.correctAnswers.join(' | '),
      points: q.points,
      explanation: q.explanation,
      orderIndex: q.orderIndex,
    };
  }

  async saveQuestion(): Promise<void> {
    const cp = this.selectedCheckpoint();
    if (!cp || !this.qForm.questionText.trim()) {
      this.toast.show('Validation', 'Select a checkpoint and enter question text.', 'warning');
      return;
    }

    const options =
      this.qForm.questionType === 'TrueFalse'
        ? ['True', 'False']
        : this.qForm.questionType === 'ShortAnswer'
          ? []
          : this.qForm.optionsText
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);

    const correctAnswers = this.qForm.correctAnswerText
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    if (correctAnswers.length === 0) {
      this.toast.show('Validation', 'Specify at least one correct answer.', 'warning');
      return;
    }

    const payload = {
      questionText: this.qForm.questionText.trim(),
      questionType: this.qForm.questionType,
      options,
      correctAnswers,
      points: this.qForm.points,
      explanation: this.qForm.explanation.trim(),
      orderIndex: this.qForm.orderIndex,
    };

    try {
      const editId = this.editingQuestionId();
      if (editId) {
        await this.api.updateQuestion(cp.id, editId, payload);
      } else {
        await this.api.createQuestion(cp.id, payload);
      }
      this.resetQuestionForm();
      await this.loadQuestions(cp.id);
      if (this.selectedGoal()) {
        await this.selectGoal(this.selectedGoal()!.id);
      }
      this.toast.show('Saved', 'Assessment question saved.', 'success');
    } catch {
      this.toast.show('Error', 'Failed to save question.', 'error');
    }
  }

  async deleteQuestion(questionId: number): Promise<void> {
    const cp = this.selectedCheckpoint();
    if (!cp) return;
    try {
      await this.api.deleteQuestion(questionId);
      await this.loadQuestions(cp.id);
      this.toast.show('Deleted', 'Question removed.', 'info');
    } catch {
      this.toast.show('Error', 'Failed to delete question.', 'error');
    }
  }

  // ─── Start & Complete Assessment ───
  async launchAssessment(cp: Checkpoint): Promise<void> {
    if (cp.status === 'Locked') {
      this.toast.show('Locked Stage', 'Complete previous checkpoints first to unlock this stage.', 'warning');
      return;
    }
    try {
      const session = await this.api.startAssessment(cp.id);
      this.activeAssessmentSession.set(session);
    } catch {
      this.toast.show('Error', 'Could not start assessment session.', 'error');
    }
  }

  async onAssessmentCompleted(res: SubmitAssessmentResponse): Promise<void> {
    this.activeAssessmentSession.set(null);
    if (res.passed) {
      this.toast.show(
        'Victory!',
        `Passed with ${res.scorePercent}%! Net Game Cash: ${res.netCashDelta >= 0 ? '+' : ''}${res.netCashDelta} G`,
        'success',
      );
    } else {
      this.toast.show(
        'Keep Going!',
        `Scored ${res.scorePercent}%. Need ${res.passingPercentage}% to clear this checkpoint.`,
        'warning',
      );
    }
    await this.refreshAll(this.selectedGoal()?.id);
  }

  // ─── Shop & Customization ───
  async buyShopItem(item: ShopItem): Promise<void> {
    try {
      const res = await this.api.purchaseItem(item.itemCode);
      if (res.success) {
        this.toast.show('Unlocked!', res.message, 'success');
        await this.refreshAll(this.selectedGoal()?.id);
      } else {
        this.toast.show('Not Enough Gold', res.message, 'warning');
      }
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Purchase failed.';
      this.toast.show('Purchase Failed', msg, 'warning');
    }
  }

  async equipItem(slot: string, code: string): Promise<void> {
    const payload: Record<string, string> = {};
    payload[slot] = code;
    try {
      await this.api.equipCustomization(payload);
      this.toast.show('Equipped!', 'Your hero appearance has been updated.', 'success');
      await this.refreshAll(this.selectedGoal()?.id);
    } catch {
      this.toast.show('Error', 'Could not equip item.', 'error');
    }
  }

  async unlockAndSelectTheme(theme: ThemeItem): Promise<void> {
    if (!theme.isOwned && theme.price > 0) {
      try {
        const res = await this.api.purchaseItem(theme.themeCode);
        if (!res.success) {
          this.toast.show('Not Enough Gold', res.message, 'warning');
          return;
        }
      } catch {
        this.toast.show('Error', 'Could not unlock theme.', 'warning');
        return;
      }
    }
    await this.equipItem('themeCode', theme.themeCode);
  }

  async unlockAndSelectCharacter(ch: CharacterItem): Promise<void> {
    if (!ch.isOwned && ch.price > 0) {
      try {
        const res = await this.api.purchaseItem(ch.characterCode);
        if (!res.success) {
          this.toast.show('Not Enough Gold', res.message, 'warning');
          return;
        }
      } catch {
        this.toast.show('Error', 'Could not unlock character.', 'warning');
        return;
      }
    }
    await this.equipItem('characterCode', ch.characterCode);
  }

  // ─── Reports & Settings ───
  async loadReports(): Promise<void> {
    try {
      const data = await this.api.getReports();
      this.reports.set(data);
    } catch {
      this.toast.show('Error', 'Failed to load reports.', 'error');
    }
  }

  async saveSettings(): Promise<void> {
    try {
      await this.api.updateSettings({ ...this.settingsForm });
      this.toast.show('Settings Saved', 'Your GoalQuest preferences have been updated.', 'success');
      await this.refreshAll(this.selectedGoal()?.id);
    } catch {
      this.toast.show('Error', 'Failed to save settings.', 'error');
    }
  }

  // ─── Excel Export & Import ───
  async exportCurrentData(): Promise<void> {
    this.showExportMenu.set(false);
    try {
      const wb = await this.api.exportExcelData();
      await this.excel.exportWorkbookToExcel(wb);
      this.toast.show('Export Complete', 'Multi-sheet GoalQuest workbook downloaded!', 'success');
    } catch {
      this.toast.show('Export Failed', 'Could not export workbook from backend.', 'error');
    }
  }

  async onExcelImported(res: GoalQuestExcelImportResponse): Promise<void> {
    this.showImportModal.set(false);
    this.toast.show(
      'Import Successful',
      `Inserted ${res.totalInserted}, updated ${res.totalUpdated}, skipped ${res.totalSkipped} rows.`,
      'success',
    );
    await this.refreshAll();
  }

  // Helper for RPG map node coordinates (curved trail)
  getNodePosition(index: number, total: number): { left: string; bottom: string } {
    const safeTotal = Math.max(total, 1);
    const ratio = (index + 1) / (safeTotal + 1);
    const leftPct = 14 + ratio * 70;
    const wave = Math.sin(ratio * Math.PI * 1.4) * 16;
    const bottomPct = 20 + ratio * 46 + wave;
    return {
      left: `${leftPct.toFixed(1)}%`,
      bottom: `${Math.min(72, Math.max(16, bottomPct)).toFixed(1)}%`,
    };
  }
}

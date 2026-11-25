import { Injectable } from '@angular/core';
import {
  Achievement,
  AssessmentQuestionAdmin,
  AssessmentScoreReportItem,
  AssessmentSession,
  CashTransaction,
  CharacterItem,
  Checkpoint,
  CheckpointStatus,
  DashboardSummary,
  EquipCustomizationRequest,
  ExcelSheetPreviewSummary,
  ExcelValidationError,
  GoalDetail,
  GoalPriority,
  GoalProgressReportItem,
  GoalQuestExcelImportRequest,
  GoalQuestExcelImportResponse,
  GoalQuestExcelWorkbook,
  GoalQuestProfile,
  GoalStatus,
  GoalSummary,
  GradedQuestionFeedback,
  IntervalUnit,
  ModeStatus,
  PurchaseItemResponse,
  QuestionType,
  ReportsData,
  SaveAssessmentQuestionRequest,
  SaveCheckpointRequest,
  SaveGoalRequest,
  ShopItem,
  SubmitAssessmentRequest,
  SubmitAssessmentResponse,
  ThemeItem,
  UpdateSettingsRequest,
  WorkspaceMode,
} from '../models/goal-quest.models';

interface StoredAttempt {
  id: number;
  checkpointId: number;
  goalTitle: string;
  checkpointTitle: string;
  startedAtUtc: string;
  submittedAtUtc: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  passed: boolean;
  completionTiming: 'Early' | 'OnTime' | 'Late';
  cashDelta: number;
}

interface StoredInventoryItem {
  itemCode: string;
  category: string;
  purchasePrice: number;
  isEquipped: boolean;
}

interface StoredWorkspaceState {
  nextId: number;
  profile: GoalQuestProfile;
  goals: GoalDetail[];
  questions: AssessmentQuestionAdmin[];
  attempts: StoredAttempt[];
  transactions: CashTransaction[];
  idempotencyKeys: string[];
  shopItems: ShopItem[];
  characters: CharacterItem[];
  themes: ThemeItem[];
  inventory: StoredInventoryItem[];
  achievements: Achievement[];
}

const VALID_PRIORITIES = new Set(['Low', 'Medium', 'High', 'Critical']);
const VALID_GOAL_STATUSES = new Set(['NotStarted', 'InProgress', 'Completed', 'Archived']);
const VALID_CP_STATUSES = new Set(['Locked', 'InProgress', 'Completed']);
const VALID_INTERVAL_UNITS = new Set(['Minutes', 'Hours', 'Days', 'Weeks']);
const VALID_QUESTION_TYPES = new Set(['MultipleChoice', 'MultipleSelect', 'TrueFalse', 'ShortAnswer']);
const VALID_SHOP_CATEGORIES = new Set(['Costume', 'Accessory', 'Character', 'Skin', 'Effect', 'Badge', 'Theme', 'Hairstyle']);
const VALID_RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary']);

@Injectable({ providedIn: 'root' })
export class GoalQuestLocalStoreService {
  private readonly storagePrefix = 'u2app.goalquest.store.v1';

  private storageKey(userId: string, mode: WorkspaceMode): string {
    return `${this.storagePrefix}.${mode}.${userId}`;
  }

  hasPersonalData(userId: string): boolean {
    try {
      const raw = localStorage.getItem(this.storageKey(userId, 'live'));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as StoredWorkspaceState;
      return Array.isArray(parsed.goals) && parsed.goals.length > 0;
    } catch {
      return false;
    }
  }

  getModeStatus(userId: string, currentMode: WorkspaceMode): ModeStatus {
    const hasPersonal = this.hasPersonalData(userId);
    return {
      isDemoMode: currentMode === 'demo',
      hasPersonalData: hasPersonal,
      recommendedMode: hasPersonal ? 'live' : 'demo',
    };
  }

  private loadState(userId: string, displayName: string, mode: WorkspaceMode): StoredWorkspaceState {
    const key = this.storageKey(userId, mode);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as StoredWorkspaceState;
      }
    } catch {
      // fall through to seed
    }

    const seeded =
      mode === 'demo'
        ? this.buildDemoWorkspace(userId, displayName)
        : this.buildPersonalWorkspace(userId, displayName);
    this.saveState(userId, mode, seeded);
    return seeded;
  }

  private saveState(userId: string, mode: WorkspaceMode, state: StoredWorkspaceState): void {
    try {
      localStorage.setItem(this.storageKey(userId, mode), JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }

  resetDemoWorkspace(userId: string, displayName: string): DashboardSummary {
    const fresh = this.buildDemoWorkspace(userId, displayName);
    this.saveState(userId, 'demo', fresh);
    return this.getDashboard(userId, displayName, 'demo');
  }

  // ─── Dashboard & Settings ───
  getDashboard(userId: string, displayName: string, mode: WorkspaceMode): DashboardSummary {
    const state = this.loadState(userId, displayName, mode);
    const summaries = state.goals.map((g) => this.toGoalSummary(g));
    const allCps = state.goals.flatMap((g) => g.checkpoints);
    const completedCps = allCps.filter((c) => c.status === 'Completed').length;
    const activeCps = allCps.filter((c) => c.status === 'InProgress').length;
    const overallProgress =
      allCps.length === 0 ? 0 : Math.round((completedCps / allCps.length) * 1000) / 10;

    const totalRewards = state.transactions
      .filter((t) => t.amount > 0 && t.transactionType !== 'InitialGrant')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPenalties = Math.abs(
      state.transactions
        .filter((t) => t.transactionType === 'LatePenalty')
        .reduce((sum, t) => sum + t.amount, 0),
    );

    const featured = summaries.find((g) => g.status === 'InProgress') ?? summaries[0] ?? null;

    return {
      profile: { ...state.profile },
      totalGoals: summaries.length,
      completedGoals: summaries.filter((g) => g.status === 'Completed').length,
      activeGoals: summaries.filter((g) => g.status !== 'Completed' && g.status !== 'Archived').length,
      totalCheckpoints: allCps.length,
      completedCheckpoints: completedCps,
      activeCheckpoints: activeCps,
      overallProgressPercent: overallProgress,
      totalRewardsEarned: totalRewards,
      totalPenaltiesDeducted: totalPenalties,
      totalAchievements: state.achievements.length,
      recentRewards: state.transactions
        .filter((t) => t.amount > 0 && t.transactionType !== 'InitialGrant')
        .slice(0, 5),
      recentPenalties: state.transactions
        .filter((t) => t.transactionType === 'LatePenalty')
        .slice(0, 5),
      achievements: [...state.achievements],
      featuredGoal: featured,
    };
  }

  updateSettings(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    req: UpdateSettingsRequest,
  ): GoalQuestProfile {
    const state = this.loadState(userId, displayName, mode);
    if (req.displayName?.trim()) state.profile.displayName = req.displayName.trim();
    if (req.defaultPassPercentage !== undefined)
      state.profile.defaultPassPercentage = Math.min(100, Math.max(1, req.defaultPassPercentage));
    if (req.defaultTimeLimitMinutes !== undefined)
      state.profile.defaultTimeLimitMinutes = Math.min(240, Math.max(1, req.defaultTimeLimitMinutes));
    if (req.defaultRewardCash !== undefined)
      state.profile.defaultRewardCash = Math.max(0, req.defaultRewardCash);
    if (req.earlyBonusMultiplier !== undefined)
      state.profile.earlyBonusMultiplier = Math.min(10, Math.max(1, req.earlyBonusMultiplier));
    if (req.defaultLatePenaltyCash !== undefined)
      state.profile.defaultLatePenaltyCash = Math.max(0, req.defaultLatePenaltyCash);
    if (req.soundEnabled !== undefined) state.profile.soundEnabled = req.soundEnabled;
    if (req.animationsEnabled !== undefined) state.profile.animationsEnabled = req.animationsEnabled;
    if (req.activeThemeCode) state.profile.activeThemeCode = req.activeThemeCode;

    this.saveState(userId, mode, state);
    return { ...state.profile };
  }

  // ─── Goals CRUD ───
  getGoals(userId: string, displayName: string, mode: WorkspaceMode): GoalSummary[] {
    const state = this.loadState(userId, displayName, mode);
    return state.goals.map((g) => this.toGoalSummary(g));
  }

  getGoalDetail(userId: string, displayName: string, mode: WorkspaceMode, goalId: number): GoalDetail {
    const state = this.loadState(userId, displayName, mode);
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error('Goal not found');
    return this.hydrateGoalDetail(state, goal);
  }

  createGoal(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    req: SaveGoalRequest,
  ): GoalDetail {
    const state = this.loadState(userId, displayName, mode);
    const now = new Date().toISOString();
    const id = state.nextId++;
    const code = req.goalCode?.trim().toUpperCase() || `GOAL-${id}`;

    const goal: GoalDetail = {
      id,
      goalCode: code,
      title: req.title.trim(),
      description: req.description?.trim() ?? '',
      category: req.category?.trim() || 'General',
      priority: req.priority || 'Medium',
      targetDateUtc: req.targetDateUtc || new Date(Date.now() + 60 * 86400000).toISOString(),
      status: req.status || 'InProgress',
      themeCode: req.themeCode || state.profile.activeThemeCode,
      progressPercent: 0,
      checkpoints: [],
      createdAtUtc: now,
      updatedAtUtc: now,
    };

    state.goals.unshift(goal);
    this.saveState(userId, mode, state);
    return this.hydrateGoalDetail(state, goal);
  }

  createSampleGoal(userId: string, displayName: string, mode: WorkspaceMode): GoalDetail {
    const state = this.loadState(userId, displayName, mode);
    const goal = this.appendAzureAiQuest(state, mode === 'demo');
    this.saveState(userId, mode, state);
    return this.hydrateGoalDetail(state, goal);
  }

  updateGoal(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    goalId: number,
    req: SaveGoalRequest,
  ): GoalDetail {
    const state = this.loadState(userId, displayName, mode);
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error('Goal not found');

    goal.title = req.title.trim();
    goal.description = req.description?.trim() ?? '';
    goal.category = req.category?.trim() || 'General';
    goal.priority = req.priority || 'Medium';
    if (req.targetDateUtc) goal.targetDateUtc = req.targetDateUtc;
    if (req.status) goal.status = req.status;
    if (req.themeCode) goal.themeCode = req.themeCode;
    goal.updatedAtUtc = new Date().toISOString();

    this.saveState(userId, mode, state);
    return this.hydrateGoalDetail(state, goal);
  }

  deleteGoal(userId: string, displayName: string, mode: WorkspaceMode, goalId: number): void {
    const state = this.loadState(userId, displayName, mode);
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;
    const cpIds = new Set(goal.checkpoints.map((c) => c.id));
    state.questions = state.questions.filter((q) => !cpIds.has(q.checkpointId));
    state.goals = state.goals.filter((g) => g.id !== goalId);
    this.saveState(userId, mode, state);
  }

  // ─── Checkpoints CRUD ───
  createCheckpoint(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    goalId: number,
    req: SaveCheckpointRequest,
  ): Checkpoint {
    const state = this.loadState(userId, displayName, mode);
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error('Goal not found');

    const id = state.nextId++;
    const hasActive = goal.checkpoints.some((c) => c.status === 'InProgress');
    const defaultStatus: CheckpointStatus =
      !hasActive && goal.checkpoints.every((c) => c.status === 'Completed') ? 'InProgress' : 'Locked';

    const cp: Checkpoint = {
      id,
      checkpointCode: req.checkpointCode?.trim().toUpperCase() || `CP-${goalId}-${id}`,
      goalId,
      sequenceOrder: req.sequenceOrder || goal.checkpoints.length + 1,
      title: req.title.trim(),
      description: req.description?.trim() ?? '',
      dueDateUtc: req.dueDateUtc || new Date(Date.now() + 7 * 86400000).toISOString(),
      intervalValue: Math.max(1, req.intervalValue || 7),
      intervalUnit: req.intervalUnit || 'Days',
      rewardCash: Math.max(0, req.rewardCash ?? 100),
      earlyBonusCash: Math.max(0, req.earlyBonusCash ?? 100),
      latePenaltyCash: Math.max(0, req.latePenaltyCash ?? 50),
      passingPercentage: Math.min(100, Math.max(1, req.passingPercentage || 90)),
      timeLimitMinutes: Math.min(240, Math.max(1, req.timeLimitMinutes || 15)),
      maxAttempts: Math.max(0, req.maxAttempts || 0),
      shuffleQuestions: !!req.shuffleQuestions,
      status: req.status || defaultStatus,
      completedAtUtc: null,
      bestScorePercent: null,
      questionCount: 0,
    };

    goal.checkpoints.push(cp);
    goal.checkpoints.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    goal.updatedAtUtc = new Date().toISOString();
    this.recomputeGoalProgress(goal);
    this.saveState(userId, mode, state);
    return { ...cp };
  }

  updateCheckpoint(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
    req: SaveCheckpointRequest,
  ): Checkpoint {
    const state = this.loadState(userId, displayName, mode);
    const found = this.findCheckpoint(state, checkpointId);
    if (!found) throw new Error('Checkpoint not found');

    const { goal, cp } = found;
    cp.sequenceOrder = Math.max(1, req.sequenceOrder);
    cp.title = req.title.trim();
    cp.description = req.description?.trim() ?? '';
    if (req.dueDateUtc) cp.dueDateUtc = req.dueDateUtc;
    cp.intervalValue = Math.max(1, req.intervalValue);
    cp.intervalUnit = req.intervalUnit;
    cp.rewardCash = Math.max(0, req.rewardCash);
    cp.earlyBonusCash = Math.max(0, req.earlyBonusCash);
    cp.latePenaltyCash = Math.max(0, req.latePenaltyCash);
    cp.passingPercentage = Math.min(100, Math.max(1, req.passingPercentage));
    cp.timeLimitMinutes = Math.min(240, Math.max(1, req.timeLimitMinutes));
    cp.maxAttempts = Math.max(0, req.maxAttempts);
    cp.shuffleQuestions = !!req.shuffleQuestions;
    if (req.status) cp.status = req.status;

    goal.checkpoints.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    this.recomputeGoalProgress(goal);
    this.saveState(userId, mode, state);
    return { ...cp, questionCount: state.questions.filter((q) => q.checkpointId === cp.id).length };
  }

  deleteCheckpoint(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
  ): void {
    const state = this.loadState(userId, displayName, mode);
    const found = this.findCheckpoint(state, checkpointId);
    if (!found) return;
    found.goal.checkpoints = found.goal.checkpoints.filter((c) => c.id !== checkpointId);
    state.questions = state.questions.filter((q) => q.checkpointId !== checkpointId);
    this.recomputeGoalProgress(found.goal);
    this.saveState(userId, mode, state);
  }

  // ─── Assessment Questions CRUD ───
  getQuestions(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
  ): AssessmentQuestionAdmin[] {
    const state = this.loadState(userId, displayName, mode);
    return state.questions
      .filter((q) => q.checkpointId === checkpointId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  saveQuestion(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
    questionId: number | null,
    req: SaveAssessmentQuestionRequest,
  ): AssessmentQuestionAdmin {
    const state = this.loadState(userId, displayName, mode);
    let q: AssessmentQuestionAdmin | undefined;

    if (questionId !== null) {
      q = state.questions.find((x) => x.id === questionId && x.checkpointId === checkpointId);
    }

    if (!q) {
      const id = state.nextId++;
      q = {
        id,
        questionCode: req.questionCode?.trim().toUpperCase() || `Q-${checkpointId}-${id}`,
        checkpointId,
        questionText: req.questionText.trim(),
        questionType: req.questionType,
        options: req.options ?? [],
        correctAnswers: req.correctAnswers ?? [],
        points: Math.max(1, req.points || 1),
        explanation: req.explanation?.trim() ?? '',
        orderIndex: Math.max(1, req.orderIndex || 1),
      };
      state.questions.push(q);
    } else {
      q.questionText = req.questionText.trim();
      q.questionType = req.questionType;
      q.options = req.options ?? [];
      q.correctAnswers = req.correctAnswers ?? [];
      q.points = Math.max(1, req.points || 1);
      q.explanation = req.explanation?.trim() ?? '';
      q.orderIndex = Math.max(1, req.orderIndex || 1);
    }

    this.saveState(userId, mode, state);
    return { ...q };
  }

  deleteQuestion(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    questionId: number,
  ): void {
    const state = this.loadState(userId, displayName, mode);
    state.questions = state.questions.filter((q) => q.id !== questionId);
    this.saveState(userId, mode, state);
  }

  // ─── Assessment Engine ───
  startAssessment(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
  ): AssessmentSession {
    const state = this.loadState(userId, displayName, mode);
    const found = this.findCheckpoint(state, checkpointId);
    if (!found) throw new Error('Checkpoint not found');
    const { cp } = found;

    const qs = state.questions
      .filter((q) => q.checkpointId === checkpointId)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => ({
        id: q.id,
        questionCode: q.questionCode,
        questionText: q.questionText,
        questionType: q.questionType,
        options: [...q.options],
        points: q.points,
        orderIndex: q.orderIndex,
      }));

    if (cp.shuffleQuestions && qs.length > 1) {
      qs.sort(() => Math.random() - 0.5);
    }

    return {
      checkpointId: cp.id,
      checkpointCode: cp.checkpointCode,
      checkpointTitle: cp.title,
      passingPercentage: cp.passingPercentage,
      timeLimitMinutes: cp.timeLimitMinutes,
      rewardCash: cp.rewardCash,
      earlyBonusCash: cp.earlyBonusCash,
      latePenaltyCash: cp.latePenaltyCash,
      dueDateUtc: cp.dueDateUtc,
      previousAttempts: state.attempts.filter((a) => a.checkpointId === checkpointId).length,
      maxAttempts: cp.maxAttempts,
      questions: qs,
    };
  }

  submitAssessment(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    checkpointId: number,
    req: SubmitAssessmentRequest,
  ): SubmitAssessmentResponse {
    const state = this.loadState(userId, displayName, mode);
    const found = this.findCheckpoint(state, checkpointId);
    if (!found) throw new Error('Checkpoint not found');
    const { goal, cp } = found;

    const qs = state.questions
      .filter((q) => q.checkpointId === checkpointId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const ansMap = new Map<number, string[]>();
    for (const a of req.answers ?? []) {
      ansMap.set(a.questionId, a.selectedAnswers ?? []);
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;
    const feedback: GradedQuestionFeedback[] = [];

    for (const q of qs) {
      const pts = Math.max(1, q.points);
      totalPoints += pts;
      const submitted = ansMap.get(q.id) ?? [];
      const isCorrect = this.gradeQuestion(q.questionType, submitted, q.correctAnswers);
      if (isCorrect) {
        earnedPoints += pts;
        correctCount++;
      }
      feedback.push({
        questionId: q.id,
        questionText: q.questionText,
        isCorrect,
        submittedAnswers: submitted,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation,
      });
    }

    const scorePercent =
      totalPoints === 0 ? 100 : Math.round((earnedPoints / totalPoints) * 1000) / 10;
    const passed = scorePercent >= cp.passingPercentage;

    const nowMs = Date.now();
    const dueMs = new Date(cp.dueDateUtc).getTime();
    const earlyWindowMs =
      cp.intervalUnit === 'Minutes' || cp.intervalUnit === 'Hours'
        ? Math.max(15, cp.timeLimitMinutes) * 60000
        : 24 * 3600000;
    const timing: 'Early' | 'OnTime' | 'Late' =
      nowMs > dueMs ? 'Late' : nowMs <= dueMs - earlyWindowMs ? 'Early' : 'OnTime';

    let normalReward = 0;
    let earlyBonus = 0;
    let latePenalty = 0;
    let alreadyRewarded = false;
    let goalCompleted = false;
    const newlyUnlocked: Achievement[] = [];

    if (cp.bestScorePercent === null || scorePercent > cp.bestScorePercent) {
      cp.bestScorePercent = scorePercent;
    }

    const nowIso = new Date().toISOString();
    if (passed) {
      const wasCompleted = cp.status === 'Completed';
      cp.status = 'Completed';
      cp.completedAtUtc ??= nowIso;

      const ordered = [...goal.checkpoints].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const nextCp = ordered.find((x) => x.sequenceOrder > cp.sequenceOrder && x.status === 'Locked');
      if (nextCp) {
        nextCp.status = 'InProgress';
      } else if (ordered.every((x) => x.status === 'Completed')) {
        goal.status = 'Completed';
        goalCompleted = true;
      }
      this.recomputeGoalProgress(goal);

      const rewardKey = `cp-reward:${cp.id}`;
      alreadyRewarded = state.idempotencyKeys.includes(rewardKey);

      if (!alreadyRewarded && !wasCompleted) {
        if (cp.rewardCash > 0) {
          normalReward = cp.rewardCash;
          this.recordTx(state, rewardKey, 'CheckpointReward', normalReward, cp.checkpointCode, `${cp.checkpointCode} Completed (${cp.title})`, nowIso);
        }
        if (timing === 'Early' && cp.earlyBonusCash > 0) {
          earlyBonus = cp.earlyBonusCash;
          this.recordTx(state, `cp-early:${cp.id}`, 'EarlyBonus', earlyBonus, cp.checkpointCode, `Early Bonus (${cp.checkpointCode})`, nowIso);
        } else if (timing === 'Late' && cp.latePenaltyCash > 0) {
          latePenalty = cp.latePenaltyCash;
          this.recordTx(state, `cp-late:${cp.id}`, 'LatePenalty', -latePenalty, cp.checkpointCode, `Late Penalty (${cp.checkpointCode})`, nowIso);
        }
      }

      const tryAch = (code: string, title: string, desc: string, icon: string, reward: number) => {
        if (state.achievements.some((a) => a.achievementCode === code)) return;
        const ach: Achievement = {
          id: state.nextId++,
          achievementCode: code,
          title,
          description: desc,
          icon,
          rewardCash: reward,
          unlockedAtUtc: nowIso,
        };
        state.achievements.unshift(ach);
        newlyUnlocked.push(ach);
        if (reward > 0) {
          this.recordTx(state, `ach:${code}`, 'AchievementBonus', reward, code, `Achievement Unlocked: ${title}`, nowIso);
        }
      };

      tryAch('ACH-FIRST-CP', 'First Milestone', 'Complete your first checkpoint assessment.', '🏁', 50);
      if (scorePercent >= 100) {
        tryAch('ACH-PERFECT-100', 'Flawless Victory', 'Score 100% on a checkpoint assessment.', '🎯', 100);
      }
      if (timing === 'Early') {
        tryAch('ACH-EARLY-BIRD', 'Speedrunner', 'Finish a checkpoint early for a 2x bonus.', '⚡', 75);
      }
      if (goalCompleted) {
        tryAch('ACH-GOAL-CONQUEROR', 'Quest Conqueror', 'Complete all checkpoints of a goal!', '🏆', 250);
      }
    }

    const netDelta =
      normalReward + earlyBonus - latePenalty + newlyUnlocked.reduce((s, a) => s + a.rewardCash, 0);

    const attemptId = state.nextId++;
    state.attempts.unshift({
      id: attemptId,
      checkpointId: cp.id,
      goalTitle: goal.title,
      checkpointTitle: cp.title,
      startedAtUtc: req.startedAtUtc || nowIso,
      submittedAtUtc: nowIso,
      totalQuestions: qs.length,
      correctAnswers: correctCount,
      scorePercent,
      passed,
      completionTiming: timing,
      cashDelta: netDelta,
    });

    this.saveState(userId, mode, state);

    return {
      attemptId,
      checkpointId: cp.id,
      totalQuestions: qs.length,
      correctAnswers: correctCount,
      scorePercent,
      passingPercentage: cp.passingPercentage,
      passed,
      completionTiming: timing,
      normalRewardAwarded: normalReward,
      earlyBonusAwarded: earlyBonus,
      latePenaltyDeducted: latePenalty,
      netCashDelta: netDelta,
      newBalance: state.profile.gameCashBalance,
      alreadyRewarded,
      goalCompleted,
      newlyUnlockedAchievements: newlyUnlocked,
      feedback,
    };
  }

  // ─── Shop, Characters, Themes, Customization ───
  getShopItems(userId: string, displayName: string, mode: WorkspaceMode): ShopItem[] {
    const state = this.loadState(userId, displayName, mode);
    const owned = new Set(state.inventory.map((i) => i.itemCode));
    const equipped = this.getEquippedSet(state.profile);
    return state.shopItems.map((i) => ({
      ...i,
      isOwned: i.isOwned || owned.has(i.itemCode),
      isEquipped: equipped.has(i.itemCode),
    }));
  }

  purchaseItem(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    itemCode: string,
  ): PurchaseItemResponse {
    const state = this.loadState(userId, displayName, mode);
    const item = state.shopItems.find((s) => s.itemCode === itemCode);
    if (!item) throw new Error(`Item ${itemCode} not found`);

    const owned = state.inventory.some((i) => i.itemCode === itemCode) || item.isOwned;
    if (owned) {
      return {
        success: true,
        message: 'Item is already in your inventory.',
        itemCode,
        newBalance: state.profile.gameCashBalance,
        item: { ...item, isOwned: true },
      };
    }

    if (state.profile.gameCashBalance < item.price) {
      return {
        success: false,
        message: `Insufficient Game Cash. Need ${item.price} G, have ${state.profile.gameCashBalance} G.`,
        itemCode,
        newBalance: state.profile.gameCashBalance,
        item: { ...item, isOwned: false },
      };
    }

    const now = new Date().toISOString();
    this.recordTx(state, `shop-buy:${item.itemCode}`, 'ShopPurchase', -item.price, item.itemCode, `Purchased ${item.name} (${item.category})`, now);
    state.inventory.push({
      itemCode: item.itemCode,
      category: item.category,
      purchasePrice: item.price,
      isEquipped: false,
    });
    item.isOwned = true;
    this.saveState(userId, mode, state);

    return {
      success: true,
      message: `Successfully unlocked ${item.name}!`,
      itemCode: item.itemCode,
      newBalance: state.profile.gameCashBalance,
      item: { ...item, isOwned: true },
    };
  }

  getCharacters(userId: string, displayName: string, mode: WorkspaceMode): CharacterItem[] {
    const state = this.loadState(userId, displayName, mode);
    const owned = new Set(state.inventory.map((i) => i.itemCode));
    return state.characters.map((c) => ({
      ...c,
      isOwned: c.isOwned || owned.has(c.characterCode),
      isSelected: state.profile.selectedCharacterCode === c.characterCode,
    }));
  }

  getThemes(userId: string, displayName: string, mode: WorkspaceMode): ThemeItem[] {
    const state = this.loadState(userId, displayName, mode);
    const owned = new Set(state.inventory.map((i) => i.itemCode));
    return state.themes.map((t) => ({
      ...t,
      isOwned: t.isOwned || owned.has(t.themeCode),
      isActive: state.profile.activeThemeCode === t.themeCode,
    }));
  }

  equipCustomization(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    req: EquipCustomizationRequest,
  ): GoalQuestProfile {
    const state = this.loadState(userId, displayName, mode);
    if (req.characterCode) state.profile.selectedCharacterCode = req.characterCode;
    if (req.costumeCode) state.profile.equippedCostumeCode = req.costumeCode;
    if (req.accessoryCode) state.profile.equippedAccessoryCode = req.accessoryCode;
    if (req.hairstyleCode) state.profile.equippedHairstyleCode = req.hairstyleCode;
    if (req.effectCode) state.profile.equippedEffectCode = req.effectCode;
    if (req.badgeCode) state.profile.equippedBadgeCode = req.badgeCode;
    if (req.themeCode) state.profile.activeThemeCode = req.themeCode;

    const eqSet = this.getEquippedSet(state.profile);
    for (const inv of state.inventory) {
      inv.isEquipped = eqSet.has(inv.itemCode);
    }

    this.saveState(userId, mode, state);
    return { ...state.profile };
  }

  getTransactions(userId: string, displayName: string, mode: WorkspaceMode): CashTransaction[] {
    return [...this.loadState(userId, displayName, mode).transactions];
  }

  getReports(userId: string, displayName: string, mode: WorkspaceMode): ReportsData {
    const state = this.loadState(userId, displayName, mode);
    const allCps = state.goals.flatMap((g) => g.checkpoints);
    const passed = state.attempts.filter((a) => a.passed);
    const avgScore =
      state.attempts.length === 0
        ? 0
        : Math.round((state.attempts.reduce((s, a) => s + a.scorePercent, 0) / state.attempts.length) * 10) / 10;

    const totalRewards = state.transactions
      .filter((t) => t.amount > 0 && t.transactionType !== 'InitialGrant')
      .reduce((s, t) => s + t.amount, 0);
    const totalPenalties = Math.abs(
      state.transactions
        .filter((t) => t.transactionType === 'LatePenalty')
        .reduce((s, t) => s + t.amount, 0),
    );

    const goalProgress: GoalProgressReportItem[] = state.goals.map((g) => {
      const done = g.checkpoints.filter((c) => c.status === 'Completed').length;
      const pct = g.checkpoints.length === 0 ? 0 : Math.round((done / g.checkpoints.length) * 1000) / 10;
      const cpIds = new Set(g.checkpoints.map((c) => c.id));
      const gAttempts = state.attempts.filter((a) => cpIds.has(a.checkpointId));
      const gAvg =
        gAttempts.length === 0
          ? 0
          : Math.round((gAttempts.reduce((s, a) => s + a.scorePercent, 0) / gAttempts.length) * 10) / 10;

      return {
        goalCode: g.goalCode,
        title: g.title,
        category: g.category,
        priority: g.priority,
        status: g.status,
        totalCheckpoints: g.checkpoints.length,
        completedCheckpoints: done,
        progressPercent: pct,
        averageScorePercent: gAvg,
        targetDateUtc: g.targetDateUtc,
      };
    });

    const assessmentHistory: AssessmentScoreReportItem[] = state.attempts.map((a) => ({
      attemptId: a.id,
      goalTitle: a.goalTitle,
      checkpointTitle: a.checkpointTitle,
      scorePercent: a.scorePercent,
      passed: a.passed,
      completionTiming: a.completionTiming,
      cashDelta: a.cashDelta,
      submittedAtUtc: a.submittedAtUtc,
    }));

    return {
      totalGoals: state.goals.length,
      completedGoals: state.goals.filter((g) => g.status === 'Completed').length,
      totalCheckpoints: allCps.length,
      completedCheckpoints: allCps.filter((c) => c.status === 'Completed').length,
      totalAttempts: state.attempts.length,
      passedAttempts: passed.length,
      averageScorePercent: avgScore,
      earlyCompletions: passed.filter((a) => a.completionTiming === 'Early').length,
      onTimeCompletions: passed.filter((a) => a.completionTiming === 'OnTime').length,
      lateCompletions: passed.filter((a) => a.completionTiming === 'Late').length,
      totalRewardsEarned: totalRewards,
      totalPenaltiesDeducted: totalPenalties,
      netCashEarned: totalRewards - totalPenalties,
      currentBalance: state.profile.gameCashBalance,
      goalProgress,
      assessmentHistory,
      transactions: [...state.transactions],
      achievements: [...state.achievements],
    };
  }

  // ─── 10-Sheet Excel Export & Validation/Import Engine (100% Client-Side) ───
  exportWorkbook(userId: string, displayName: string, mode: WorkspaceMode): GoalQuestExcelWorkbook {
    const state = this.loadState(userId, displayName, mode);
    const goalCodeById = new Map(state.goals.map((g) => [g.id, g.goalCode]));
    const allCps = state.goals.flatMap((g) => g.checkpoints);
    const cpCodeById = new Map(allCps.map((c) => [c.id, c.checkpointCode]));

    return {
      goals: state.goals.map((g, i) => ({
        rowNumber: i + 2,
        goalCode: g.goalCode,
        title: g.title,
        description: g.description,
        category: g.category,
        priority: g.priority,
        targetDate: g.targetDateUtc.slice(0, 10),
        status: g.status,
        themeCode: g.themeCode,
      })),
      checkpoints: allCps.map((c, i) => ({
        rowNumber: i + 2,
        checkpointCode: c.checkpointCode,
        goalCode: goalCodeById.get(c.goalId) ?? '',
        sequenceOrder: c.sequenceOrder,
        title: c.title,
        description: c.description,
        dueDate: c.dueDateUtc.slice(0, 10),
        intervalValue: c.intervalValue,
        intervalUnit: c.intervalUnit,
        rewardCash: c.rewardCash,
        earlyBonusCash: c.earlyBonusCash,
        latePenaltyCash: c.latePenaltyCash,
        passingPercentage: c.passingPercentage,
        timeLimitMinutes: c.timeLimitMinutes,
        status: c.status,
      })),
      assessmentQuestions: state.questions.map((q, i) => ({
        rowNumber: i + 2,
        questionCode: q.questionCode,
        checkpointCode: cpCodeById.get(q.checkpointId) ?? '',
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options.join(' | '),
        correctAnswer: q.correctAnswers.join(' | '),
        points: q.points,
        explanation: q.explanation,
        orderIndex: q.orderIndex,
      })),
      assessmentSettings: allCps.map((c, i) => ({
        rowNumber: i + 2,
        checkpointCode: c.checkpointCode,
        passingPercentage: c.passingPercentage,
        timeLimitMinutes: c.timeLimitMinutes,
        maxAttempts: c.maxAttempts,
        shuffleQuestions: c.shuffleQuestions,
      })),
      rewards: allCps.map((c, i) => ({
        rowNumber: i + 2,
        checkpointCode: c.checkpointCode,
        rewardCash: c.rewardCash,
        earlyBonusCash: c.earlyBonusCash,
        latePenaltyCash: c.latePenaltyCash,
      })),
      characters: state.characters.map((c, i) => ({
        rowNumber: i + 2,
        characterCode: c.characterCode,
        name: c.name,
        title: c.title,
        description: c.description,
        avatarStyle: c.avatarStyle,
        primaryColor: c.primaryColor,
        secondaryColor: c.secondaryColor,
        defaultCostume: c.defaultCostume,
        defaultHairstyle: c.defaultHairstyle,
        price: c.price,
        isUnlockedByDefault: c.isOwned && c.price === 0,
      })),
      inventory: state.inventory.map((inv, i) => ({
        rowNumber: i + 2,
        itemCode: inv.itemCode,
        category: inv.category,
        purchasePrice: inv.purchasePrice,
        isEquipped: inv.isEquipped,
      })),
      shopItems: state.shopItems.map((s, i) => ({
        rowNumber: i + 2,
        itemCode: s.itemCode,
        name: s.name,
        category: s.category,
        description: s.description,
        price: s.price,
        rarity: s.rarity,
        previewAsset: s.previewAsset,
        accentColor: s.accentColor,
        isDefaultUnlocked: s.isOwned && s.price === 0,
      })),
      themes: state.themes.map((t, i) => ({
        rowNumber: i + 2,
        themeCode: t.themeCode,
        name: t.name,
        description: t.description,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        accentColor: t.accentColor,
        backgroundStyle: t.backgroundStyle,
        mapStyle: t.mapStyle,
        price: t.price,
        isUnlockedByDefault: t.isOwned && t.price === 0,
      })),
      userSettings: [
        {
          rowNumber: 2,
          displayName: state.profile.displayName,
          initialCurrency: state.profile.initialCurrency,
          defaultPassPercentage: state.profile.defaultPassPercentage,
          defaultTimeLimitMinutes: state.profile.defaultTimeLimitMinutes,
          defaultRewardCash: state.profile.defaultRewardCash,
          earlyBonusMultiplier: state.profile.earlyBonusMultiplier,
          defaultLatePenaltyCash: state.profile.defaultLatePenaltyCash,
          activeThemeCode: state.profile.activeThemeCode,
          selectedCharacterCode: state.profile.selectedCharacterCode,
          soundEnabled: state.profile.soundEnabled,
          animationsEnabled: state.profile.animationsEnabled,
        },
      ],
    };
  }

  importWorkbook(
    userId: string,
    displayName: string,
    mode: WorkspaceMode,
    req: GoalQuestExcelImportRequest,
  ): GoalQuestExcelImportResponse {
    const state = this.loadState(userId, displayName, mode);
    const importMode = req.mode ?? 'Upsert';
    const wb = req.workbook;
    const errors: ExcelValidationError[] = [];
    const summaries: ExcelSheetPreviewSummary[] = [];

    const existingGoals = new Map(state.goals.map((g) => [g.goalCode.toUpperCase(), g]));
    const existingCps = new Map(
      state.goals.flatMap((g) => g.checkpoints).map((c) => [c.checkpointCode.toUpperCase(), c]),
    );
    const existingQs = new Map(state.questions.map((q) => [q.questionCode.toUpperCase(), q]));
    const existingChars = new Map(state.characters.map((c) => [c.characterCode.toUpperCase(), c]));
    const existingThemes = new Map(state.themes.map((t) => [t.themeCode.toUpperCase(), t]));
    const existingShop = new Map(state.shopItems.map((s) => [s.itemCode.toUpperCase(), s]));
    const existingInv = new Map(state.inventory.map((i) => [i.itemCode.toUpperCase(), i]));

    const validGoalCodes = new Set(existingGoals.keys());
    const validCpCodes = new Set(existingCps.keys());

    const tally = (
      exists: boolean,
      counts: { ins: number; upd: number; skip: number },
    ): void => {
      if (exists) {
        if (importMode === 'InsertOnly') counts.skip++;
        else counts.upd++;
      } else {
        if (importMode === 'UpdateOnly') counts.skip++;
        else counts.ins++;
      }
    };

    const shouldApply = (exists: boolean): boolean =>
      importMode === 'InsertOnly' ? !exists : importMode === 'UpdateOnly' ? exists : true;

    // 1. Validate Goals
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      const seen = new Set<string>();
      for (const r of wb.goals ?? []) {
        const before = errors.length;
        const code = (r.goalCode ?? '').trim().toUpperCase();
        if (!code) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'GoalCode', code: 'REQUIRED', message: 'GoalCode is required.' });
        else if (seen.has(code)) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'GoalCode', code: 'DUPLICATE', message: `Duplicate GoalCode '${code}'.` });
        else seen.add(code);

        if (!r.title?.trim()) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'Title', code: 'REQUIRED', message: 'Title is required.' });
        if (!VALID_PRIORITIES.has(r.priority)) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'Priority', code: 'INVALID_ENUM', message: `Priority '${r.priority}' must be Low, Medium, High, or Critical.` });
        if (!VALID_GOAL_STATUSES.has(r.status)) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'Status', code: 'INVALID_ENUM', message: `Invalid Status '${r.status}'.` });
        if (!r.targetDate || Number.isNaN(Date.parse(r.targetDate))) errors.push({ sheetName: 'Goals', rowNumber: r.rowNumber, column: 'TargetDate', code: 'INVALID_DATE', message: `TargetDate '${r.targetDate}' is invalid (use YYYY-MM-DD).` });

        if (errors.length > before) { c.err += errors.length - before; continue; }
        const exists = existingGoals.has(code);
        tally(exists, c);
        if (!exists && importMode !== 'UpdateOnly') validGoalCodes.add(code);
      }
      summaries.push({ sheetName: 'Goals', totalRows: (wb.goals ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }

    // 2. Validate Checkpoints
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      const seen = new Set<string>();
      for (const r of wb.checkpoints ?? []) {
        const before = errors.length;
        const code = (r.checkpointCode ?? '').trim().toUpperCase();
        const gCode = (r.goalCode ?? '').trim().toUpperCase();
        if (!code) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'CheckpointCode', code: 'REQUIRED', message: 'CheckpointCode is required.' });
        else if (seen.has(code)) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'CheckpointCode', code: 'DUPLICATE', message: `Duplicate CheckpointCode '${code}'.` });
        else seen.add(code);

        if (!gCode || !validGoalCodes.has(gCode)) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'GoalCode', code: 'INVALID_FK', message: `GoalCode '${gCode}' does not match an existing or imported goal.` });
        if (!r.title?.trim()) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'Title', code: 'REQUIRED', message: 'Title is required.' });
        if (!r.dueDate || Number.isNaN(Date.parse(r.dueDate))) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'DueDate', code: 'INVALID_DATE', message: `DueDate '${r.dueDate}' is invalid.` });
        if (!VALID_INTERVAL_UNITS.has(r.intervalUnit)) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'IntervalUnit', code: 'INVALID_ENUM', message: `IntervalUnit '${r.intervalUnit}' must be Minutes, Hours, Days, or Weeks.` });
        if (!VALID_CP_STATUSES.has(r.status)) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'Status', code: 'INVALID_ENUM', message: `Status '${r.status}' must be Locked, InProgress, or Completed.` });
        if (r.passingPercentage < 1 || r.passingPercentage > 100) errors.push({ sheetName: 'Checkpoints', rowNumber: r.rowNumber, column: 'PassingPercentage', code: 'INVALID_RANGE', message: 'PassingPercentage must be 1-100.' });

        if (errors.length > before) { c.err += errors.length - before; continue; }
        const exists = existingCps.has(code);
        tally(exists, c);
        if (!exists && importMode !== 'UpdateOnly') validCpCodes.add(code);
      }
      summaries.push({ sheetName: 'Checkpoints', totalRows: (wb.checkpoints ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }

    // 3. Validate AssessmentQuestions
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      for (const r of wb.assessmentQuestions ?? []) {
        const before = errors.length;
        const code = (r.questionCode ?? '').trim().toUpperCase();
        const cpCode = (r.checkpointCode ?? '').trim().toUpperCase();
        if (!code) errors.push({ sheetName: 'AssessmentQuestions', rowNumber: r.rowNumber, column: 'QuestionCode', code: 'REQUIRED', message: 'QuestionCode is required.' });
        if (!cpCode || !validCpCodes.has(cpCode)) errors.push({ sheetName: 'AssessmentQuestions', rowNumber: r.rowNumber, column: 'CheckpointCode', code: 'INVALID_FK', message: `CheckpointCode '${cpCode}' not found.` });
        if (!r.questionText?.trim()) errors.push({ sheetName: 'AssessmentQuestions', rowNumber: r.rowNumber, column: 'QuestionText', code: 'REQUIRED', message: 'QuestionText is required.' });
        if (!VALID_QUESTION_TYPES.has(r.questionType)) errors.push({ sheetName: 'AssessmentQuestions', rowNumber: r.rowNumber, column: 'QuestionType', code: 'INVALID_ENUM', message: `Invalid QuestionType '${r.questionType}'.` });
        if (!r.correctAnswer?.trim()) errors.push({ sheetName: 'AssessmentQuestions', rowNumber: r.rowNumber, column: 'CorrectAnswer', code: 'REQUIRED', message: 'CorrectAnswer is required.' });

        if (errors.length > before) { c.err += errors.length - before; continue; }
        tally(existingQs.has(code), c);
      }
      summaries.push({ sheetName: 'AssessmentQuestions', totalRows: (wb.assessmentQuestions ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }

    // 4. Validate AssessmentSettings & Rewards
    {
      let upd = 0, err = 0;
      for (const r of wb.assessmentSettings ?? []) {
        const cpCode = (r.checkpointCode ?? '').trim().toUpperCase();
        if (!validCpCodes.has(cpCode)) { errors.push({ sheetName: 'AssessmentSettings', rowNumber: r.rowNumber, column: 'CheckpointCode', code: 'INVALID_FK', message: `CheckpointCode '${cpCode}' not found.` }); err++; }
        else upd++;
      }
      summaries.push({ sheetName: 'AssessmentSettings', totalRows: (wb.assessmentSettings ?? []).length, toInsert: 0, toUpdate: upd, toSkip: 0, errorCount: err });
    }
    {
      let upd = 0, err = 0;
      for (const r of wb.rewards ?? []) {
        const cpCode = (r.checkpointCode ?? '').trim().toUpperCase();
        if (!validCpCodes.has(cpCode)) { errors.push({ sheetName: 'Rewards', rowNumber: r.rowNumber, column: 'CheckpointCode', code: 'INVALID_FK', message: `CheckpointCode '${cpCode}' not found.` }); err++; }
        else upd++;
      }
      summaries.push({ sheetName: 'Rewards', totalRows: (wb.rewards ?? []).length, toInsert: 0, toUpdate: upd, toSkip: 0, errorCount: err });
    }

    // 5-10. Characters, Themes, ShopItems, Inventory, UserSettings
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      for (const r of wb.characters ?? []) {
        const code = (r.characterCode ?? '').trim().toUpperCase();
        if (!code || !r.name?.trim()) { errors.push({ sheetName: 'Characters', rowNumber: r.rowNumber, column: 'CharacterCode', code: 'REQUIRED', message: 'CharacterCode and Name are required.' }); c.err++; continue; }
        tally(existingChars.has(code), c);
      }
      summaries.push({ sheetName: 'Characters', totalRows: (wb.characters ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      for (const r of wb.themes ?? []) {
        const code = (r.themeCode ?? '').trim().toUpperCase();
        if (!code || !r.name?.trim()) { errors.push({ sheetName: 'Themes', rowNumber: r.rowNumber, column: 'ThemeCode', code: 'REQUIRED', message: 'ThemeCode and Name are required.' }); c.err++; continue; }
        tally(existingThemes.has(code), c);
      }
      summaries.push({ sheetName: 'Themes', totalRows: (wb.themes ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      for (const r of wb.shopItems ?? []) {
        const code = (r.itemCode ?? '').trim().toUpperCase();
        if (!code || !r.name?.trim() || !VALID_SHOP_CATEGORIES.has(r.category) || (r.rarity && !VALID_RARITIES.has(r.rarity))) {
          errors.push({ sheetName: 'ShopItems', rowNumber: r.rowNumber, column: 'ItemCode', code: 'INVALID', message: `Invalid ShopItem row '${code}'.` });
          c.err++;
          continue;
        }
        tally(existingShop.has(code), c);
      }
      summaries.push({ sheetName: 'ShopItems', totalRows: (wb.shopItems ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }
    {
      const c = { ins: 0, upd: 0, skip: 0, err: 0 };
      for (const r of wb.inventory ?? []) {
        const code = (r.itemCode ?? '').trim().toUpperCase();
        if (!code) { errors.push({ sheetName: 'Inventory', rowNumber: r.rowNumber, column: 'ItemCode', code: 'REQUIRED', message: 'ItemCode is required.' }); c.err++; continue; }
        tally(existingInv.has(code), c);
      }
      summaries.push({ sheetName: 'Inventory', totalRows: (wb.inventory ?? []).length, toInsert: c.ins, toUpdate: c.upd, toSkip: c.skip, errorCount: c.err });
    }
    summaries.push({
      sheetName: 'UserSettings',
      totalRows: (wb.userSettings ?? []).length,
      toInsert: 0,
      toUpdate: (wb.userSettings ?? []).length,
      toSkip: 0,
      errorCount: 0,
    });

    const totalInserted = summaries.reduce((s, x) => s + x.toInsert, 0);
    const totalUpdated = summaries.reduce((s, x) => s + x.toUpdate, 0);
    const totalSkipped = summaries.reduce((s, x) => s + x.toSkip, 0);

    if (req.dryRun || errors.length > 0) {
      return {
        success: errors.length === 0,
        dryRun: req.dryRun,
        mode: importMode,
        totalErrors: errors.length,
        totalInserted,
        totalUpdated,
        totalSkipped,
        sheetSummaries: summaries,
        errors,
      };
    }

    // Apply all sheets to local state and persist!
    const now = new Date().toISOString();
    for (const r of wb.goals ?? []) {
      const code = r.goalCode.trim().toUpperCase();
      const existing = existingGoals.get(code);
      if (!shouldApply(!!existing)) continue;

      if (existing) {
        existing.title = r.title.trim();
        existing.description = r.description?.trim() ?? '';
        existing.category = r.category?.trim() || 'General';
        existing.priority = r.priority as GoalPriority;
        existing.targetDateUtc = new Date(r.targetDate).toISOString();
        existing.status = r.status as GoalStatus;
        existing.themeCode = r.themeCode?.trim() || 'THEME-FANTASY';
        existing.updatedAtUtc = now;
      } else {
        const created: GoalDetail = {
          id: state.nextId++,
          goalCode: code,
          title: r.title.trim(),
          description: r.description?.trim() ?? '',
          category: r.category?.trim() || 'General',
          priority: r.priority as GoalPriority,
          targetDateUtc: new Date(r.targetDate).toISOString(),
          status: r.status as GoalStatus,
          themeCode: r.themeCode?.trim() || 'THEME-FANTASY',
          progressPercent: 0,
          checkpoints: [],
          createdAtUtc: now,
          updatedAtUtc: now,
        };
        state.goals.push(created);
        existingGoals.set(code, created);
      }
    }

    for (const r of wb.checkpoints ?? []) {
      const code = r.checkpointCode.trim().toUpperCase();
      const parent = existingGoals.get(r.goalCode.trim().toUpperCase());
      if (!parent) continue;
      const existing = existingCps.get(code);
      if (!shouldApply(!!existing)) continue;

      if (existing) {
        existing.sequenceOrder = r.sequenceOrder;
        existing.title = r.title.trim();
        existing.description = r.description?.trim() ?? '';
        existing.dueDateUtc = new Date(r.dueDate).toISOString();
        existing.intervalValue = Math.max(1, r.intervalValue);
        existing.intervalUnit = r.intervalUnit as IntervalUnit;
        existing.rewardCash = Math.max(0, r.rewardCash);
        existing.earlyBonusCash = Math.max(0, r.earlyBonusCash);
        existing.latePenaltyCash = Math.max(0, r.latePenaltyCash);
        existing.passingPercentage = Math.min(100, Math.max(1, r.passingPercentage));
        existing.timeLimitMinutes = Math.min(240, Math.max(1, r.timeLimitMinutes));
        existing.status = r.status as CheckpointStatus;
      } else {
        const cp: Checkpoint = {
          id: state.nextId++,
          checkpointCode: code,
          goalId: parent.id,
          sequenceOrder: r.sequenceOrder,
          title: r.title.trim(),
          description: r.description?.trim() ?? '',
          dueDateUtc: new Date(r.dueDate).toISOString(),
          intervalValue: Math.max(1, r.intervalValue),
          intervalUnit: r.intervalUnit as IntervalUnit,
          rewardCash: Math.max(0, r.rewardCash),
          earlyBonusCash: Math.max(0, r.earlyBonusCash),
          latePenaltyCash: Math.max(0, r.latePenaltyCash),
          passingPercentage: Math.min(100, Math.max(1, r.passingPercentage)),
          timeLimitMinutes: Math.min(240, Math.max(1, r.timeLimitMinutes)),
          maxAttempts: 0,
          shuffleQuestions: false,
          status: r.status as CheckpointStatus,
          completedAtUtc: r.status === 'Completed' ? now : null,
          bestScorePercent: null,
          questionCount: 0,
        };
        parent.checkpoints.push(cp);
        existingCps.set(code, cp);
      }
      parent.checkpoints.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      this.recomputeGoalProgress(parent);
    }

    for (const r of wb.assessmentQuestions ?? []) {
      const code = r.questionCode.trim().toUpperCase();
      const cp = existingCps.get(r.checkpointCode.trim().toUpperCase());
      if (!cp) continue;
      const existing = existingQs.get(code);
      if (!shouldApply(!!existing)) continue;

      const options = r.options ? r.options.split('|').map((s) => s.trim()).filter(Boolean) : [];
      const correctAnswers = r.correctAnswer.split('|').map((s) => s.trim()).filter(Boolean);

      if (existing) {
        existing.checkpointId = cp.id;
        existing.questionText = r.questionText.trim();
        existing.questionType = r.questionType as QuestionType;
        existing.options = options;
        existing.correctAnswers = correctAnswers;
        existing.points = Math.max(1, r.points || 1);
        existing.explanation = r.explanation?.trim() ?? '';
        existing.orderIndex = Math.max(1, r.orderIndex || 1);
      } else {
        const q: AssessmentQuestionAdmin = {
          id: state.nextId++,
          questionCode: code,
          checkpointId: cp.id,
          questionText: r.questionText.trim(),
          questionType: r.questionType as QuestionType,
          options,
          correctAnswers,
          points: Math.max(1, r.points || 1),
          explanation: r.explanation?.trim() ?? '',
          orderIndex: Math.max(1, r.orderIndex || 1),
        };
        state.questions.push(q);
        existingQs.set(code, q);
      }
    }

    for (const r of wb.assessmentSettings ?? []) {
      const cp = existingCps.get(r.checkpointCode.trim().toUpperCase());
      if (!cp) continue;
      cp.passingPercentage = Math.min(100, Math.max(1, r.passingPercentage));
      cp.timeLimitMinutes = Math.min(240, Math.max(1, r.timeLimitMinutes));
      cp.maxAttempts = Math.max(0, r.maxAttempts);
      cp.shuffleQuestions = !!r.shuffleQuestions;
    }

    for (const r of wb.rewards ?? []) {
      const cp = existingCps.get(r.checkpointCode.trim().toUpperCase());
      if (!cp) continue;
      cp.rewardCash = Math.max(0, r.rewardCash);
      cp.earlyBonusCash = Math.max(0, r.earlyBonusCash);
      cp.latePenaltyCash = Math.max(0, r.latePenaltyCash);
    }

    for (const r of wb.characters ?? []) {
      const code = r.characterCode.trim().toUpperCase();
      const existing = existingChars.get(code);
      if (!shouldApply(!!existing)) continue;
      if (existing) {
        existing.name = r.name.trim();
        existing.title = r.title?.trim() ?? '';
        existing.description = r.description?.trim() ?? '';
        existing.price = Math.max(0, r.price);
      } else {
        state.characters.push({
          id: state.nextId++,
          characterCode: code,
          name: r.name.trim(),
          title: r.title?.trim() ?? '',
          description: r.description?.trim() ?? '',
          avatarStyle: r.avatarStyle || 'adventurer',
          primaryColor: r.primaryColor || '#3b82f6',
          secondaryColor: r.secondaryColor || '#f59e0b',
          defaultCostume: r.defaultCostume || 'COST-CYBER-JACKET',
          defaultHairstyle: r.defaultHairstyle || 'HAIR-SPIKY-AZURE',
          price: Math.max(0, r.price),
          isOwned: r.isUnlockedByDefault,
          isSelected: false,
        });
      }
    }

    for (const r of wb.themes ?? []) {
      const code = r.themeCode.trim().toUpperCase();
      const existing = existingThemes.get(code);
      if (!shouldApply(!!existing)) continue;
      if (existing) {
        existing.name = r.name.trim();
        existing.description = r.description?.trim() ?? '';
        existing.primaryColor = r.primaryColor || '#7c3aed';
        existing.secondaryColor = r.secondaryColor || '#2563eb';
        existing.accentColor = r.accentColor || '#f59e0b';
        existing.price = Math.max(0, r.price);
      } else {
        state.themes.push({
          id: state.nextId++,
          themeCode: code,
          name: r.name.trim(),
          description: r.description?.trim() ?? '',
          primaryColor: r.primaryColor || '#7c3aed',
          secondaryColor: r.secondaryColor || '#2563eb',
          accentColor: r.accentColor || '#f59e0b',
          backgroundStyle: r.backgroundStyle || 'fantasy',
          mapStyle: r.mapStyle || 'fantasy-valley',
          price: Math.max(0, r.price),
          isOwned: r.isUnlockedByDefault,
          isActive: false,
        });
      }
    }

    for (const r of wb.shopItems ?? []) {
      const code = r.itemCode.trim().toUpperCase();
      const existing = existingShop.get(code);
      if (!shouldApply(!!existing)) continue;
      if (existing) {
        existing.name = r.name.trim();
        existing.category = r.category.trim();
        existing.description = r.description?.trim() ?? '';
        existing.price = Math.max(0, r.price);
        existing.rarity = r.rarity || 'Common';
        existing.previewAsset = r.previewAsset || '🎁';
      } else {
        state.shopItems.push({
          id: state.nextId++,
          itemCode: code,
          name: r.name.trim(),
          category: r.category.trim(),
          description: r.description?.trim() ?? '',
          price: Math.max(0, r.price),
          rarity: r.rarity || 'Common',
          previewAsset: r.previewAsset || '🎁',
          accentColor: r.accentColor || '#8b5cf6',
          isOwned: r.isDefaultUnlocked,
          isEquipped: false,
        });
      }
    }

    for (const r of wb.inventory ?? []) {
      const code = r.itemCode.trim().toUpperCase();
      const existing = existingInv.get(code);
      if (!shouldApply(!!existing)) continue;
      if (existing) {
        existing.category = r.category || existing.category;
        existing.purchasePrice = Math.max(0, r.purchasePrice);
        existing.isEquipped = r.isEquipped;
      } else {
        state.inventory.push({
          itemCode: code,
          category: r.category || 'Costume',
          purchasePrice: Math.max(0, r.purchasePrice),
          isEquipped: r.isEquipped,
        });
      }
    }

    const uSet = wb.userSettings?.[0];
    if (uSet) {
      if (uSet.displayName?.trim()) state.profile.displayName = uSet.displayName.trim();
      state.profile.initialCurrency = Math.max(0, uSet.initialCurrency);
      state.profile.defaultPassPercentage = Math.min(100, Math.max(1, uSet.defaultPassPercentage));
      state.profile.defaultTimeLimitMinutes = Math.min(240, Math.max(1, uSet.defaultTimeLimitMinutes));
      state.profile.defaultRewardCash = Math.max(0, uSet.defaultRewardCash);
      state.profile.earlyBonusMultiplier = Math.min(10, Math.max(1, uSet.earlyBonusMultiplier));
      state.profile.defaultLatePenaltyCash = Math.max(0, uSet.defaultLatePenaltyCash);
      if (uSet.activeThemeCode) state.profile.activeThemeCode = uSet.activeThemeCode;
      if (uSet.selectedCharacterCode) state.profile.selectedCharacterCode = uSet.selectedCharacterCode;
      state.profile.soundEnabled = uSet.soundEnabled;
      state.profile.animationsEnabled = uSet.animationsEnabled;
    }

    this.saveState(userId, mode, state);
    return {
      success: true,
      dryRun: false,
      mode: importMode,
      totalErrors: 0,
      totalInserted,
      totalUpdated,
      totalSkipped,
      sheetSummaries: summaries,
      errors: [],
    };
  }

  // ─── Internal Helpers & Predefined Seed Builders ───
  private recordTx(
    state: StoredWorkspaceState,
    idempotencyKey: string,
    type: string,
    amount: number,
    refCode: string,
    desc: string,
    nowIso: string,
  ): void {
    if (state.idempotencyKeys.includes(idempotencyKey)) return;
    state.idempotencyKeys.push(idempotencyKey);
    state.profile.gameCashBalance = Math.max(0, state.profile.gameCashBalance + amount);
    state.transactions.unshift({
      id: state.nextId++,
      transactionType: type,
      amount,
      balanceAfter: state.profile.gameCashBalance,
      referenceCode: refCode,
      description: desc,
      createdAtUtc: nowIso,
    });
  }

  private gradeQuestion(type: QuestionType, submitted: string[], expected: string[]): boolean {
    const cleanSub = submitted.map((s) => s.trim()).filter(Boolean);
    const cleanExp = expected.map((s) => s.trim()).filter(Boolean);
    if (!cleanSub.length || !cleanExp.length) return false;

    if (type === 'MultipleSelect') {
      if (cleanSub.length !== cleanExp.length) return false;
      const expSet = new Set(cleanExp.map((s) => s.toLowerCase()));
      return cleanSub.every((s) => expSet.has(s.toLowerCase()));
    }
    if (type === 'ShortAnswer') {
      return cleanExp.some((e) => e.toLowerCase() === cleanSub[0].toLowerCase());
    }
    return cleanExp[0].toLowerCase() === cleanSub[0].toLowerCase();
  }

  private findCheckpoint(state: StoredWorkspaceState, checkpointId: number): { goal: GoalDetail; cp: Checkpoint } | null {
    for (const goal of state.goals) {
      const cp = goal.checkpoints.find((c) => c.id === checkpointId);
      if (cp) return { goal, cp };
    }
    return null;
  }

  private recomputeGoalProgress(goal: GoalDetail): void {
    const total = goal.checkpoints.length;
    const done = goal.checkpoints.filter((c) => c.status === 'Completed').length;
    goal.progressPercent = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
  }

  private hydrateGoalDetail(state: StoredWorkspaceState, goal: GoalDetail): GoalDetail {
    this.recomputeGoalProgress(goal);
    return {
      ...goal,
      checkpoints: [...goal.checkpoints]
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
        .map((c) => ({
          ...c,
          questionCount: state.questions.filter((q) => q.checkpointId === c.id).length,
        })),
    };
  }

  private toGoalSummary(g: GoalDetail): GoalSummary {
    const total = g.checkpoints.length;
    const done = g.checkpoints.filter((c) => c.status === 'Completed').length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
    return {
      id: g.id,
      goalCode: g.goalCode,
      title: g.title,
      description: g.description,
      category: g.category,
      priority: g.priority,
      targetDateUtc: g.targetDateUtc,
      status: g.status,
      themeCode: g.themeCode,
      totalCheckpoints: total,
      completedCheckpoints: done,
      progressPercent: pct,
      createdAtUtc: g.createdAtUtc,
      updatedAtUtc: g.updatedAtUtc,
    };
  }

  private getEquippedSet(p: GoalQuestProfile): Set<string> {
    return new Set([
      p.selectedCharacterCode,
      p.equippedCostumeCode,
      p.equippedAccessoryCode,
      p.equippedHairstyleCode,
      p.equippedEffectCode,
      p.equippedBadgeCode,
      p.activeThemeCode,
    ]);
  }

  private buildPersonalWorkspace(userId: string, displayName: string): StoredWorkspaceState {
    const now = new Date().toISOString();
    return {
      nextId: 100,
      profile: {
        userId,
        displayName: displayName || 'Quest Hero',
        gameCashBalance: 500,
        initialCurrency: 500,
        selectedCharacterCode: 'CHAR-HERO',
        equippedCostumeCode: 'COST-CYBER-JACKET',
        equippedAccessoryCode: 'ACC-NEON-HEADSET',
        equippedHairstyleCode: 'HAIR-SPIKY-AZURE',
        equippedEffectCode: 'EFF-STARLIGHT',
        equippedBadgeCode: 'BADGE-EXPLORER',
        activeThemeCode: 'THEME-FANTASY',
        defaultPassPercentage: 90,
        defaultTimeLimitMinutes: 15,
        defaultRewardCash: 100,
        earlyBonusMultiplier: 2.0,
        defaultLatePenaltyCash: 50,
        soundEnabled: true,
        animationsEnabled: true,
      },
      goals: [],
      questions: [],
      attempts: [],
      transactions: [
        {
          id: 1,
          transactionType: 'InitialGrant',
          amount: 500,
          balanceAfter: 500,
          referenceCode: 'WELCOME',
          description: 'Welcome Quest Starter Gold',
          createdAtUtc: now,
        },
      ],
      idempotencyKeys: ['init-grant'],
      shopItems: this.defaultShopItems(),
      characters: this.defaultCharacters(),
      themes: this.defaultThemes(),
      inventory: this.starterInventory(),
      achievements: [],
    };
  }

  private buildDemoWorkspace(userId: string, displayName: string): StoredWorkspaceState {
    const days = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const state: StoredWorkspaceState = {
      nextId: 500,
      profile: {
        userId: `demo::${userId}`,
        displayName: displayName ? `${displayName} (Demo)` : 'Practice Hero',
        gameCashBalance: 1250,
        initialCurrency: 500,
        selectedCharacterCode: 'CHAR-HERO',
        equippedCostumeCode: 'COST-CYBER-JACKET',
        equippedAccessoryCode: 'ACC-NEON-HEADSET',
        equippedHairstyleCode: 'HAIR-SPIKY-AZURE',
        equippedEffectCode: 'EFF-STARLIGHT',
        equippedBadgeCode: 'BADGE-EXPLORER',
        activeThemeCode: 'THEME-FANTASY',
        defaultPassPercentage: 90,
        defaultTimeLimitMinutes: 15,
        defaultRewardCash: 100,
        earlyBonusMultiplier: 2.0,
        defaultLatePenaltyCash: 50,
        soundEnabled: true,
        animationsEnabled: true,
      },
      goals: [],
      questions: [],
      attempts: [
        {
          id: 901,
          checkpointId: 101,
          goalTitle: 'Complete Azure AI Certification (AI-900)',
          checkpointTitle: 'Learn Basics',
          startedAtUtc: days(-9),
          submittedAtUtc: days(-9),
          totalQuestions: 2,
          correctAnswers: 2,
          scorePercent: 100,
          passed: true,
          completionTiming: 'OnTime',
          cashDelta: 100,
        },
        {
          id: 902,
          checkpointId: 102,
          goalTitle: 'Complete Azure AI Certification (AI-900)',
          checkpointTitle: 'Build Mini Project',
          startedAtUtc: days(-6),
          submittedAtUtc: days(-6),
          totalQuestions: 1,
          correctAnswers: 1,
          scorePercent: 100,
          passed: true,
          completionTiming: 'Early',
          cashDelta: 300,
        },
      ],
      transactions: [
        { id: 7, transactionType: 'AchievementBonus', amount: 250, balanceAfter: 1250, referenceCode: 'ACH-DEMO', description: '[DEMO] Achievement Rewards (Trailblazer & Speedrunner)', createdAtUtc: days(-1) },
        { id: 6, transactionType: 'CheckpointReward', amount: 150, balanceAfter: 1000, referenceCode: 'CP-PY-01', description: '[DEMO] Python Syntax Completed', createdAtUtc: days(-3) },
        { id: 5, transactionType: 'LatePenalty', amount: -50, balanceAfter: 850, referenceCode: 'CP-FIT-01', description: '[DEMO] Late Penalty (Fitness CP1)', createdAtUtc: days(-4) },
        { id: 4, transactionType: 'EarlyBonus', amount: 150, balanceAfter: 900, referenceCode: 'CP-AI-02', description: '[DEMO] Early Bonus (CP2)', createdAtUtc: days(-6) },
        { id: 3, transactionType: 'CheckpointReward', amount: 150, balanceAfter: 750, referenceCode: 'CP-AI-02', description: '[DEMO] CP2 Completed (Build Mini Project)', createdAtUtc: days(-6) },
        { id: 2, transactionType: 'CheckpointReward', amount: 100, balanceAfter: 600, referenceCode: 'CP-AI-01', description: '[DEMO] CP1 Completed (Learn Basics)', createdAtUtc: days(-9) },
        { id: 1, transactionType: 'InitialGrant', amount: 500, balanceAfter: 500, referenceCode: 'DEMO-START', description: '[DEMO] Initial Practice Wallet', createdAtUtc: days(-12) },
      ],
      idempotencyKeys: ['demo-1', 'demo-2', 'demo-3', 'demo-4', 'demo-5', 'demo-6', 'demo-7'],
      shopItems: this.defaultShopItems(),
      characters: this.defaultCharacters(),
      themes: this.defaultThemes(),
      inventory: this.starterInventory(),
      achievements: [
        { id: 1, achievementCode: 'ACH-FIRST-CP', title: 'First Milestone', description: '[DEMO] Completed your first RPG checkpoint assessment.', icon: '🏁', rewardCash: 50, unlockedAtUtc: days(-9) },
        { id: 2, achievementCode: 'ACH-EARLY-BIRD', title: 'Speedrunner', description: '[DEMO] Finished a checkpoint early for a 2x bonus!', icon: '⚡', rewardCash: 75, unlockedAtUtc: days(-6) },
        { id: 3, achievementCode: 'ACH-SCHOLAR', title: 'Knowledge Seeker', description: '[DEMO] Passed 3 checkpoint assessments with 90%+ accuracy.', icon: '🎓', rewardCash: 125, unlockedAtUtc: days(-3) },
      ],
    };

    // 1. Azure AI Certification (AI-900) — Fantasy Theme
    this.appendAzureAiQuest(state, true);

    // 2. Learn Python — Jungle Theme
    const pyGoalId = 200;
    state.goals.push({
      id: pyGoalId,
      goalCode: 'GOAL-PYTHON',
      title: 'Learn Python',
      description: 'Go from Python fundamentals to building FastAPI services and automation scripts.',
      category: 'Programming',
      priority: 'High',
      targetDateUtc: days(60),
      status: 'InProgress',
      themeCode: 'THEME-JUNGLE',
      progressPercent: 25,
      createdAtUtc: days(-8),
      updatedAtUtc: days(-2),
      checkpoints: [
        { id: 201, checkpointCode: 'CP-PY-01', goalId: pyGoalId, sequenceOrder: 1, title: 'Python Syntax & Data Types', description: 'Variables, lists, dicts, loops, and functions.', dueDateUtc: days(-2), intervalValue: 5, intervalUnit: 'Days', rewardCash: 150, earlyBonusCash: 150, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: 'Completed', completedAtUtc: days(-3), bestScorePercent: 100, questionCount: 1 },
        { id: 202, checkpointCode: 'CP-PY-02', goalId: pyGoalId, sequenceOrder: 2, title: 'OOP & Virtual Environments', description: 'Classes, dataclasses, and modular packages.', dueDateUtc: days(10), intervalValue: 1, intervalUnit: 'Weeks', rewardCash: 175, earlyBonusCash: 175, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: 'InProgress', completedAtUtc: null, bestScorePercent: null, questionCount: 3 },
        { id: 203, checkpointCode: 'CP-PY-03', goalId: pyGoalId, sequenceOrder: 3, title: 'FastAPI & Async Python', description: 'Typed REST APIs with Pydantic and async/await.', dueDateUtc: days(25), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 225, earlyBonusCash: 225, latePenaltyCash: 75, passingPercentage: 90, timeLimitMinutes: 20, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 1 },
        { id: 204, checkpointCode: 'CP-PY-04', goalId: pyGoalId, sequenceOrder: 4, title: 'Capstone Automation Project', description: 'Ship an end-to-end tested Python tool.', dueDateUtc: days(45), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 300, earlyBonusCash: 300, latePenaltyCash: 100, passingPercentage: 90, timeLimitMinutes: 20, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 0 },
      ],
    });
    state.questions.push(
      { id: 251, questionCode: 'Q-PY-101', checkpointId: 201, questionText: 'Which Python data structure stores unique unordered elements?', questionType: 'MultipleChoice', options: ['list', 'tuple', 'set', 'string'], correctAnswers: ['set'], points: 1, explanation: 'A set stores unique unordered elements.', orderIndex: 1 },
      { id: 252, questionCode: 'Q-PY-201', checkpointId: 202, questionText: 'Which method initializes a newly created Python class instance?', questionType: 'MultipleChoice', options: ['__init__', '__start__', '__create__', '__main__'], correctAnswers: ['__init__'], points: 1, explanation: '__init__ is Python\'s instance initializer.', orderIndex: 1 },
      { id: 253, questionCode: 'Q-PY-202', checkpointId: 202, questionText: 'Select all mutable built-in Python types.', questionType: 'MultipleSelect', options: ['list', 'dict', 'set', 'tuple'], correctAnswers: ['list', 'dict', 'set'], points: 1, explanation: 'Tuples are immutable; lists, dicts, and sets are mutable.', orderIndex: 2 },
      { id: 254, questionCode: 'Q-PY-203', checkpointId: 202, questionText: 'Python virtual environments isolate project dependencies from the global interpreter.', questionType: 'TrueFalse', options: ['True', 'False'], correctAnswers: ['True'], points: 1, explanation: 'Virtual environments prevent dependency conflicts.', orderIndex: 3 },
      { id: 255, questionCode: 'Q-PY-301', checkpointId: 203, questionText: 'Which keyword defines an asynchronous coroutine function in Python?', questionType: 'ShortAnswer', options: [], correctAnswers: ['async', 'async def'], points: 1, explanation: 'Coroutines are declared with async def.', orderIndex: 1 },
    );

    // 3. Improve Fitness — Mountain Theme
    const fitGoalId = 300;
    state.goals.push({
      id: fitGoalId,
      goalCode: 'GOAL-FITNESS',
      title: 'Improve Fitness',
      description: 'Build a sustainable strength, cardio, and mobility routine over 8 weeks.',
      category: 'Health & Fitness',
      priority: 'Medium',
      targetDateUtc: days(56),
      status: 'InProgress',
      themeCode: 'THEME-MOUNTAIN',
      progressPercent: 33.3,
      createdAtUtc: days(-7),
      updatedAtUtc: days(-3),
      checkpoints: [
        { id: 301, checkpointCode: 'CP-FIT-01', goalId: fitGoalId, sequenceOrder: 1, title: '7-Day Mobility & Walk Streak', description: '8,000 daily steps + 10 min mobility.', dueDateUtc: days(-5), intervalValue: 7, intervalUnit: 'Days', rewardCash: 100, earlyBonusCash: 100, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 10, maxAttempts: 0, shuffleQuestions: false, status: 'Completed', completedAtUtc: days(-4), bestScorePercent: 100, questionCount: 0 },
        { id: 302, checkpointCode: 'CP-FIT-02', goalId: fitGoalId, sequenceOrder: 2, title: 'Strength Foundation (3x/Week)', description: 'Complete 6 full-body strength sessions.', dueDateUtc: days(12), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 150, earlyBonusCash: 150, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 10, maxAttempts: 0, shuffleQuestions: false, status: 'InProgress', completedAtUtc: null, bestScorePercent: null, questionCount: 2 },
        { id: 303, checkpointCode: 'CP-FIT-03', goalId: fitGoalId, sequenceOrder: 3, title: '5K Endurance Milestone', description: 'Run or brisk-walk 5km nonstop.', dueDateUtc: days(30), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 200, earlyBonusCash: 200, latePenaltyCash: 75, passingPercentage: 90, timeLimitMinutes: 10, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 0 },
      ],
    });
    state.questions.push(
      { id: 351, questionCode: 'Q-FIT-201', checkpointId: 302, questionText: 'Why is progressive overload important in strength training?', questionType: 'MultipleChoice', options: ['Gradually increases stimulus so muscles adapt', 'Eliminates the need for rest', 'Replaces hydration', 'Only works for cardio'], correctAnswers: ['Gradually increases stimulus so muscles adapt'], points: 1, explanation: 'Progressive overload drives steady strength gains.', orderIndex: 1 },
      { id: 352, questionCode: 'Q-FIT-202', checkpointId: 302, questionText: 'Adequate sleep and rest days are essential for muscle recovery.', questionType: 'TrueFalse', options: ['True', 'False'], correctAnswers: ['True'], points: 1, explanation: 'Muscles repair and grow during recovery and sleep.', orderIndex: 2 },
    );

    // 4. Read 5 Books — Space Theme
    const bkGoalId = 400;
    state.goals.push({
      id: bkGoalId,
      goalCode: 'GOAL-BOOKS5',
      title: 'Read 5 Books',
      description: 'Read 5 high-impact technology and personal growth books with chapter summaries.',
      category: 'Personal Growth',
      priority: 'Medium',
      targetDateUtc: days(75),
      status: 'InProgress',
      themeCode: 'THEME-SPACE',
      progressPercent: 0,
      createdAtUtc: days(-6),
      updatedAtUtc: days(-4),
      checkpoints: [
        { id: 401, checkpointCode: 'CP-BK-01', goalId: bkGoalId, sequenceOrder: 1, title: 'Book 1: Atomic Habits', description: 'Master the 4 laws of behavior change.', dueDateUtc: days(8), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 120, earlyBonusCash: 120, latePenaltyCash: 40, passingPercentage: 90, timeLimitMinutes: 10, maxAttempts: 0, shuffleQuestions: false, status: 'InProgress', completedAtUtc: null, bestScorePercent: null, questionCount: 2 },
        { id: 402, checkpointCode: 'CP-BK-02', goalId: bkGoalId, sequenceOrder: 2, title: 'Book 2: Deep Work', description: 'Apply distraction-free focus blocks.', dueDateUtc: days(24), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 120, earlyBonusCash: 120, latePenaltyCash: 40, passingPercentage: 90, timeLimitMinutes: 10, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 0 },
        { id: 403, checkpointCode: 'CP-BK-03', goalId: bkGoalId, sequenceOrder: 3, title: 'Book 3: Clean Architecture', description: 'Review SOLID boundaries & clean modularity.', dueDateUtc: days(40), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 150, earlyBonusCash: 150, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 0 },
        { id: 404, checkpointCode: 'CP-BK-04', goalId: bkGoalId, sequenceOrder: 4, title: 'Books 4 & 5: Final Sprint', description: 'Complete the final two books and takeaways.', dueDateUtc: days(70), intervalValue: 4, intervalUnit: 'Weeks', rewardCash: 250, earlyBonusCash: 250, latePenaltyCash: 75, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 0 },
      ],
    });
    state.questions.push(
      { id: 451, questionCode: 'Q-BK-101', checkpointId: 401, questionText: 'Select the Four Laws of Behavior Change from Atomic Habits.', questionType: 'MultipleSelect', options: ['Make it Obvious', 'Make it Attractive', 'Make it Easy', 'Make it Satisfying'], correctAnswers: ['Make it Obvious', 'Make it Attractive', 'Make it Easy', 'Make it Satisfying'], points: 1, explanation: 'All four laws reinforce positive habit loops.', orderIndex: 1 },
      { id: 452, questionCode: 'Q-BK-102', checkpointId: 401, questionText: 'Improving by 1% every day compounds into dramatic long-term growth.', questionType: 'TrueFalse', options: ['True', 'False'], correctAnswers: ['True'], points: 1, explanation: 'Small daily improvements compound exponentially.', orderIndex: 2 },
    );

    return state;
  }

  private appendAzureAiQuest(state: StoredWorkspaceState, preCompletedTwo: boolean): GoalDetail {
    const days = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
    const goalId = preCompletedTwo ? 100 : state.nextId++;
    const cp1Id = preCompletedTwo ? 101 : state.nextId++;
    const cp2Id = preCompletedTwo ? 102 : state.nextId++;
    const cp3Id = preCompletedTwo ? 103 : state.nextId++;
    const cp4Id = preCompletedTwo ? 104 : state.nextId++;
    const cp5Id = preCompletedTwo ? 105 : state.nextId++;
    const codeSuffix = state.goals.some((g) => g.goalCode === 'GOAL-AI900') ? `-${goalId}` : '';

    const goal: GoalDetail = {
      id: goalId,
      goalCode: `GOAL-AI900${codeSuffix}`,
      title: 'Complete Azure AI Certification (AI-900)',
      description: 'Master Azure AI Fundamentals through interactive checkpoints, mini projects, and timed 90%-pass assessments.',
      category: 'Certification',
      priority: 'Critical',
      targetDateUtc: days(90),
      status: 'InProgress',
      themeCode: 'THEME-FANTASY',
      progressPercent: preCompletedTwo ? 40 : 0,
      createdAtUtc: days(-10),
      updatedAtUtc: days(0),
      checkpoints: [
        { id: cp1Id, checkpointCode: `CP-AI${codeSuffix}-01`, goalId, sequenceOrder: 1, title: 'Learn Basics', description: 'Core AI workloads, machine learning, and responsible AI.', dueDateUtc: days(-5), intervalValue: 7, intervalUnit: 'Days', rewardCash: 100, earlyBonusCash: 100, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: preCompletedTwo ? 'Completed' : 'InProgress', completedAtUtc: preCompletedTwo ? days(-9) : null, bestScorePercent: preCompletedTwo ? 100 : null, questionCount: 2 },
        { id: cp2Id, checkpointCode: `CP-AI${codeSuffix}-02`, goalId, sequenceOrder: 2, title: 'Build Mini Project', description: 'Computer vision and sentiment analysis prototype on Azure.', dueDateUtc: days(-1), intervalValue: 10, intervalUnit: 'Days', rewardCash: 150, earlyBonusCash: 150, latePenaltyCash: 50, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: preCompletedTwo ? 'Completed' : 'Locked', completedAtUtc: preCompletedTwo ? days(-6) : null, bestScorePercent: preCompletedTwo ? 100 : null, questionCount: 1 },
        { id: cp3Id, checkpointCode: `CP-AI${codeSuffix}-03`, goalId, sequenceOrder: 3, title: 'Practice + Assessment', description: 'NLP, Document Intelligence, and Generative AI mastery.', dueDateUtc: days(14), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 200, earlyBonusCash: 200, latePenaltyCash: 75, passingPercentage: 90, timeLimitMinutes: 15, maxAttempts: 0, shuffleQuestions: false, status: preCompletedTwo ? 'InProgress' : 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 4 },
        { id: cp4Id, checkpointCode: `CP-AI${codeSuffix}-04`, goalId, sequenceOrder: 4, title: 'Mock Test', description: 'Full-length AI-900 simulation exam under timed conditions.', dueDateUtc: days(35), intervalValue: 2, intervalUnit: 'Weeks', rewardCash: 250, earlyBonusCash: 250, latePenaltyCash: 100, passingPercentage: 90, timeLimitMinutes: 20, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 1 },
        { id: cp5Id, checkpointCode: `CP-AI${codeSuffix}-05`, goalId, sequenceOrder: 5, title: 'Final Preparation', description: 'Review weak domains and claim your AI-900 Crown!', dueDateUtc: days(60), intervalValue: 3, intervalUnit: 'Weeks', rewardCash: 400, earlyBonusCash: 400, latePenaltyCash: 100, passingPercentage: 90, timeLimitMinutes: 20, maxAttempts: 0, shuffleQuestions: false, status: 'Locked', completedAtUtc: null, bestScorePercent: null, questionCount: 1 },
      ],
    };

    state.goals.unshift(goal);
    const qPrefix = `Q-AI${codeSuffix}`;
    state.questions.push(
      { id: state.nextId++, questionCode: `${qPrefix}-101`, checkpointId: cp1Id, questionText: 'Which type of machine learning predicts a continuous numerical value such as house price?', questionType: 'MultipleChoice', options: ['Classification', 'Regression', 'Clustering', 'Anomaly Detection'], correctAnswers: ['Regression'], points: 1, explanation: 'Regression models predict continuous numeric values.', orderIndex: 1 },
      { id: state.nextId++, questionCode: `${qPrefix}-102`, checkpointId: cp1Id, questionText: 'Select all pillars of Microsoft\'s Responsible AI framework.', questionType: 'MultipleSelect', options: ['Fairness', 'Reliability and Safety', 'Transparency', 'Unlimited Data Collection'], correctAnswers: ['Fairness', 'Reliability and Safety', 'Transparency'], points: 1, explanation: 'Responsible AI includes Fairness, Reliability & Safety, Privacy, Inclusiveness, Transparency, and Accountability.', orderIndex: 2 },
      { id: state.nextId++, questionCode: `${qPrefix}-201`, checkpointId: cp2Id, questionText: 'Which Azure AI service extracts printed and handwritten text from images?', questionType: 'MultipleChoice', options: ['Azure AI Vision (OCR)', 'Azure AI Translator', 'Azure AI Bot Service', 'Azure Data Factory'], correctAnswers: ['Azure AI Vision (OCR)'], points: 1, explanation: 'Azure AI Vision provides OCR text extraction.', orderIndex: 1 },
      { id: state.nextId++, questionCode: `${qPrefix}-301`, checkpointId: cp3Id, questionText: 'Which Azure service hosts GPT and DALL-E generative AI models with enterprise security?', questionType: 'MultipleChoice', options: ['Azure OpenAI Service', 'Azure Functions', 'Azure Monitor', 'Azure Key Vault'], correctAnswers: ['Azure OpenAI Service'], points: 1, explanation: 'Azure OpenAI Service hosts OpenAI foundation models.', orderIndex: 1 },
      { id: state.nextId++, questionCode: `${qPrefix}-302`, checkpointId: cp3Id, questionText: 'Which two tasks are supported by Azure AI Language?', questionType: 'MultipleSelect', options: ['Sentiment Analysis', 'Key Phrase Extraction', '3D Mesh Rendering', 'SQL Partitioning'], correctAnswers: ['Sentiment Analysis', 'Key Phrase Extraction'], points: 1, explanation: 'Azure AI Language handles sentiment, key phrases, NER, and summarization.', orderIndex: 2 },
      { id: state.nextId++, questionCode: `${qPrefix}-303`, checkpointId: cp3Id, questionText: 'Clustering is an unsupervised machine learning technique that groups similar data without labels.', questionType: 'TrueFalse', options: ['True', 'False'], correctAnswers: ['True'], points: 1, explanation: 'Clustering discovers natural groupings in unlabeled data.', orderIndex: 3 },
      { id: state.nextId++, questionCode: `${qPrefix}-304`, checkpointId: cp3Id, questionText: 'What acronym stands for Retrieval-Augmented Generation?', questionType: 'ShortAnswer', options: [], correctAnswers: ['RAG'], points: 1, explanation: 'RAG grounds LLM responses with retrieved domain documents.', orderIndex: 4 },
      { id: state.nextId++, questionCode: `${qPrefix}-401`, checkpointId: cp4Id, questionText: 'AutoML automatically evaluates multiple algorithms and hyperparameters to find the best model.', questionType: 'TrueFalse', options: ['True', 'False'], correctAnswers: ['True'], points: 1, explanation: 'AutoML automates model selection and tuning.', orderIndex: 1 },
      { id: state.nextId++, questionCode: `${qPrefix}-501`, checkpointId: cp5Id, questionText: 'What acronym describes AI systems that interpret and generate human language?', questionType: 'ShortAnswer', options: [], correctAnswers: ['NLP', 'Natural Language Processing'], points: 1, explanation: 'NLP = Natural Language Processing.', orderIndex: 1 },
    );

    return goal;
  }

  private starterInventory(): StoredInventoryItem[] {
    return [
      { itemCode: 'CHAR-HERO', category: 'Character', purchasePrice: 0, isEquipped: true },
      { itemCode: 'COST-CYBER-JACKET', category: 'Costume', purchasePrice: 0, isEquipped: true },
      { itemCode: 'ACC-NEON-HEADSET', category: 'Accessory', purchasePrice: 0, isEquipped: true },
      { itemCode: 'HAIR-SPIKY-AZURE', category: 'Hairstyle', purchasePrice: 0, isEquipped: true },
      { itemCode: 'EFF-STARLIGHT', category: 'Effect', purchasePrice: 0, isEquipped: true },
      { itemCode: 'BADGE-EXPLORER', category: 'Badge', purchasePrice: 0, isEquipped: true },
      { itemCode: 'THEME-FANTASY', category: 'Theme', purchasePrice: 0, isEquipped: true },
    ];
  }

  private defaultCharacters(): CharacterItem[] {
    return [
      { id: 1, characterCode: 'CHAR-HERO', name: 'Kai Strider', title: 'Cyber Explorer', description: 'Fearless goal adventurer equipped for long quest trails.', avatarStyle: 'adventurer', primaryColor: '#3b82f6', secondaryColor: '#f59e0b', defaultCostume: 'COST-CYBER-JACKET', defaultHairstyle: 'HAIR-SPIKY-AZURE', price: 0, isOwned: true, isSelected: true },
      { id: 2, characterCode: 'CHAR-MAGE', name: 'Lyra Nova', title: 'Arcane Scholar', description: 'Master of knowledge assessments and glowing starlight spells.', avatarStyle: 'mage', primaryColor: '#8b5cf6', secondaryColor: '#ec4899', defaultCostume: 'COST-ARCANE-ROBE', defaultHairstyle: 'HAIR-NEBULA-WAVE', price: 300, isOwned: false, isSelected: false },
      { id: 3, characterCode: 'CHAR-KNIGHT', name: 'Aegis Vance', title: 'Golden Paladin', description: 'Unstoppable deadline defender clad in royal titanium armor.', avatarStyle: 'paladin', primaryColor: '#f59e0b', secondaryColor: '#0ea5e9', defaultCostume: 'COST-PALADIN-ARMOR', defaultHairstyle: 'HAIR-SILVER-BLADE', price: 450, isOwned: false, isSelected: false },
      { id: 4, characterCode: 'CHAR-NINJA', name: 'Kuro Shadow', title: 'Speedrunner Shinobi', description: 'Specializes in early completions and double bonus streaks.', avatarStyle: 'shinobi', primaryColor: '#10b981', secondaryColor: '#6366f1', defaultCostume: 'COST-SHADOW-CLOAK', defaultHairstyle: 'HAIR-SILVER-BLADE', price: 600, isOwned: false, isSelected: false },
    ];
  }

  private defaultThemes(): ThemeItem[] {
    return [
      { id: 1, themeCode: 'THEME-FANTASY', name: 'Fantasy Kingdom', description: 'Lush enchanted highlands with a golden winding trail to the Royal Castle.', primaryColor: '#7c3aed', secondaryColor: '#2563eb', accentColor: '#f59e0b', backgroundStyle: 'fantasy', mapStyle: 'fantasy-valley', price: 0, isOwned: true, isActive: true },
      { id: 2, themeCode: 'THEME-JUNGLE', name: 'Emerald Jungle', description: 'Ancient emerald temple ruins surrounded by glowing tropical waterfalls.', primaryColor: '#059669', secondaryColor: '#0d9488', accentColor: '#fbbf24', backgroundStyle: 'jungle', mapStyle: 'emerald-jungle', price: 200, isOwned: false, isActive: false },
      { id: 3, themeCode: 'THEME-SPACE', name: 'Deep Space Odyssey', description: 'Cosmic starlight highway hopping across luminous planetary warp gates.', primaryColor: '#6366f1', secondaryColor: '#ec4899', accentColor: '#38bdf8', backgroundStyle: 'space', mapStyle: 'cosmic-trail', price: 300, isOwned: false, isActive: false },
      { id: 4, themeCode: 'THEME-MOUNTAIN', name: 'Summit Mountain Peak', description: 'Alpine snow-capped ridges ascending to the Golden Summit Citadel.', primaryColor: '#0284c7', secondaryColor: '#4f46e5', accentColor: '#f59e0b', backgroundStyle: 'mountain', mapStyle: 'alpine-summit', price: 350, isOwned: false, isActive: false },
    ];
  }

  private defaultShopItems(): ShopItem[] {
    return [
      { id: 1, itemCode: 'COST-CYBER-JACKET', name: 'Cyber Adventurer Jacket', category: 'Costume', description: 'Blue-and-gold neon street armor for everyday quests.', price: 0, rarity: 'Common', previewAsset: '🧥', accentColor: '#3b82f6', isOwned: true, isEquipped: true },
      { id: 2, itemCode: 'COST-ARCANE-ROBE', name: 'Starlight Mage Coat', category: 'Costume', description: 'Royal violet mantle trimmed with glowing constellations.', price: 200, rarity: 'Rare', previewAsset: '👘', accentColor: '#8b5cf6', isOwned: false, isEquipped: false },
      { id: 3, itemCode: 'COST-PALADIN-ARMOR', name: 'Aegis Gold Plate', category: 'Costume', description: 'Radiant ceremonial armor forged for top achievers.', price: 350, rarity: 'Epic', previewAsset: '🛡️', accentColor: '#f59e0b', isOwned: false, isEquipped: false },
      { id: 4, itemCode: 'COST-SHADOW-CLOAK', name: 'Phantom Tech Cloak', category: 'Costume', description: 'Sleek emerald-edged stealth suit for early finishers.', price: 420, rarity: 'Legendary', previewAsset: '🥷', accentColor: '#10b981', isOwned: false, isEquipped: false },
      { id: 5, itemCode: 'ACC-NEON-HEADSET', name: 'Pulse Gaming Headset', category: 'Accessory', description: 'Glowing blue studio headset for deep focus sessions.', price: 0, rarity: 'Common', previewAsset: '🎧', accentColor: '#38bdf8', isOwned: true, isEquipped: true },
      { id: 6, itemCode: 'ACC-GOLD-CROWN', name: 'Sovereign Gold Crown', category: 'Accessory', description: 'Worn by heroes who conquer high-priority goals.', price: 280, rarity: 'Epic', previewAsset: '👑', accentColor: '#fbbf24', isOwned: false, isEquipped: false },
      { id: 7, itemCode: 'ACC-CYBER-VISOR', name: 'Holo-HUD Visor', category: 'Accessory', description: 'Projects real-time checkpoint metrics onto your visor.', price: 180, rarity: 'Rare', previewAsset: '🕶️', accentColor: '#a855f7', isOwned: false, isEquipped: false },
      { id: 8, itemCode: 'HAIR-SPIKY-AZURE', name: 'Adventurer Spikes', category: 'Hairstyle', description: 'Signature windswept hero cut.', price: 0, rarity: 'Common', previewAsset: '💇', accentColor: '#60a5fa', isOwned: true, isEquipped: true },
      { id: 9, itemCode: 'HAIR-NEBULA-WAVE', name: 'Nebula Violet Waves', category: 'Hairstyle', description: 'Shimmering cosmic violet locks.', price: 120, rarity: 'Rare', previewAsset: '✨', accentColor: '#c084fc', isOwned: false, isEquipped: false },
      { id: 10, itemCode: 'HAIR-SILVER-BLADE', name: 'Silver Blade Cut', category: 'Hairstyle', description: 'Sharp platinum anime-inspired style.', price: 160, rarity: 'Epic', previewAsset: '⚡', accentColor: '#e2e8f0', isOwned: false, isEquipped: false },
      { id: 11, itemCode: 'EFF-STARLIGHT', name: 'Starlight Pedestal', category: 'Effect', description: 'Soft neon cyan pedestal glow beneath your avatar.', price: 0, rarity: 'Common', previewAsset: '🌟', accentColor: '#38bdf8', isOwned: true, isEquipped: true },
      { id: 12, itemCode: 'EFF-PHOENIX-WINGS', name: 'Phoenix Flame Wings', category: 'Effect', description: 'Blazing golden-magenta wings radiating behind your hero.', price: 400, rarity: 'Legendary', previewAsset: '🪽', accentColor: '#f43f5e', isOwned: false, isEquipped: false },
      { id: 13, itemCode: 'EFF-LIGHTNING-AURA', name: 'Volt Surge Aura', category: 'Effect', description: 'Crackling neon purple energy rings.', price: 260, rarity: 'Epic', previewAsset: '⚡', accentColor: '#a855f7', isOwned: false, isEquipped: false },
      { id: 14, itemCode: 'BADGE-EXPLORER', name: 'Trailblazer Crest', category: 'Badge', description: 'Starter crest awarded to new GoalQuest adventurers.', price: 0, rarity: 'Common', previewAsset: '🧭', accentColor: '#34d399', isOwned: true, isEquipped: true },
      { id: 15, itemCode: 'BADGE-GRANDMASTER', name: 'Grandmaster Emblem', category: 'Badge', description: 'Prestigious gold emblem for elite scholars.', price: 300, rarity: 'Legendary', previewAsset: '🏅', accentColor: '#fbbf24', isOwned: false, isEquipped: false },
      { id: 16, itemCode: 'SKIN-HOLO-GOLD', name: 'Holographic Gold Skin', category: 'Skin', description: 'Luminous metallic gold finish for your avatar card.', price: 500, rarity: 'Legendary', previewAsset: '💎', accentColor: '#f59e0b', isOwned: false, isEquipped: false },
      { id: 17, itemCode: 'CHAR-MAGE', name: 'Lyra Nova (Arcane Scholar)', category: 'Character', description: 'Unlock Lyra Nova as a playable hero.', price: 300, rarity: 'Rare', previewAsset: '🧙', accentColor: '#8b5cf6', isOwned: false, isEquipped: false },
      { id: 18, itemCode: 'CHAR-KNIGHT', name: 'Aegis Vance (Golden Paladin)', category: 'Character', description: 'Unlock Aegis Vance as a playable hero.', price: 450, rarity: 'Epic', previewAsset: '⚔️', accentColor: '#f59e0b', isOwned: false, isEquipped: false },
      { id: 19, itemCode: 'CHAR-NINJA', name: 'Kuro Shadow (Shinobi)', category: 'Character', description: 'Unlock Kuro Shadow as a playable hero.', price: 600, rarity: 'Legendary', previewAsset: '🗡️', accentColor: '#10b981', isOwned: false, isEquipped: false },
      { id: 20, itemCode: 'THEME-JUNGLE', name: 'Emerald Jungle Theme', category: 'Theme', description: 'Unlock the lush Emerald Jungle roadmap theme.', price: 200, rarity: 'Rare', previewAsset: '🌴', accentColor: '#10b981', isOwned: false, isEquipped: false },
      { id: 21, itemCode: 'THEME-SPACE', name: 'Deep Space Odyssey Theme', category: 'Theme', description: 'Unlock the cosmic Deep Space roadmap theme.', price: 300, rarity: 'Epic', previewAsset: '🌌', accentColor: '#6366f1', isOwned: false, isEquipped: false },
      { id: 22, itemCode: 'THEME-MOUNTAIN', name: 'Summit Mountain Peak Theme', category: 'Theme', description: 'Unlock the alpine Summit Mountain roadmap theme.', price: 350, rarity: 'Legendary', previewAsset: '🏔️', accentColor: '#0284c7', isOwned: false, isEquipped: false },
    ];
  }
}

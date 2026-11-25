export type WorkspaceMode = 'demo' | 'live';

export interface ModeStatus {
  isDemoMode: boolean;
  hasPersonalData: boolean;
  recommendedMode: WorkspaceMode;
}

export type GoalPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type GoalStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Archived';
export type CheckpointStatus = 'Locked' | 'InProgress' | 'Completed';
export type IntervalUnit = 'Minutes' | 'Hours' | 'Days' | 'Weeks';
export type QuestionType = 'MultipleChoice' | 'MultipleSelect' | 'TrueFalse' | 'ShortAnswer';
export type ImportMode = 'InsertOnly' | 'UpdateOnly' | 'Upsert';

export type GoalQuestTab =
  | 'dashboard'
  | 'goals'
  | 'roadmap'
  | 'assessment'
  | 'rewards'
  | 'customize'
  | 'themes'
  | 'reports'
  | 'settings';

export interface GoalQuestProfile {
  userId: string;
  displayName: string;
  gameCashBalance: number;
  initialCurrency: number;
  selectedCharacterCode: string;
  equippedCostumeCode: string;
  equippedAccessoryCode: string;
  equippedHairstyleCode: string;
  equippedEffectCode: string;
  equippedBadgeCode: string;
  activeThemeCode: string;
  defaultPassPercentage: number;
  defaultTimeLimitMinutes: number;
  defaultRewardCash: number;
  earlyBonusMultiplier: number;
  defaultLatePenaltyCash: number;
  soundEnabled: boolean;
  animationsEnabled: boolean;
}

export interface UpdateSettingsRequest {
  displayName?: string;
  defaultPassPercentage?: number;
  defaultTimeLimitMinutes?: number;
  defaultRewardCash?: number;
  earlyBonusMultiplier?: number;
  defaultLatePenaltyCash?: number;
  soundEnabled?: boolean;
  animationsEnabled?: boolean;
  activeThemeCode?: string;
}

export interface CashTransaction {
  id: number;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  referenceCode: string;
  description: string;
  createdAtUtc: string;
}

export interface Achievement {
  id: number;
  achievementCode: string;
  title: string;
  description: string;
  icon: string;
  rewardCash: number;
  unlockedAtUtc: string;
}

export interface GoalSummary {
  id: number;
  goalCode: string;
  title: string;
  description: string;
  category: string;
  priority: GoalPriority;
  targetDateUtc: string;
  status: GoalStatus;
  themeCode: string;
  totalCheckpoints: number;
  completedCheckpoints: number;
  progressPercent: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface Checkpoint {
  id: number;
  checkpointCode: string;
  goalId: number;
  sequenceOrder: number;
  title: string;
  description: string;
  dueDateUtc: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
  passingPercentage: number;
  timeLimitMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  status: CheckpointStatus;
  completedAtUtc: string | null;
  bestScorePercent: number | null;
  questionCount: number;
}

export interface GoalDetail {
  id: number;
  goalCode: string;
  title: string;
  description: string;
  category: string;
  priority: GoalPriority;
  targetDateUtc: string;
  status: GoalStatus;
  themeCode: string;
  progressPercent: number;
  checkpoints: Checkpoint[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SaveGoalRequest {
  goalCode?: string;
  title: string;
  description: string;
  category: string;
  priority: GoalPriority;
  targetDateUtc: string;
  status?: GoalStatus;
  themeCode?: string;
}

export interface SaveCheckpointRequest {
  checkpointCode?: string;
  sequenceOrder: number;
  title: string;
  description: string;
  dueDateUtc: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
  passingPercentage: number;
  timeLimitMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  status?: CheckpointStatus;
}

export interface AssessmentQuestionAdmin {
  id: number;
  questionCode: string;
  checkpointId: number;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswers: string[];
  points: number;
  explanation: string;
  orderIndex: number;
}

export interface SaveAssessmentQuestionRequest {
  questionCode?: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswers: string[];
  points: number;
  explanation: string;
  orderIndex: number;
}

export interface AssessmentSessionQuestion {
  id: number;
  questionCode: string;
  questionText: string;
  questionType: QuestionType;
  options: string[];
  points: number;
  orderIndex: number;
}

export interface AssessmentSession {
  checkpointId: number;
  checkpointCode: string;
  checkpointTitle: string;
  passingPercentage: number;
  timeLimitMinutes: number;
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
  dueDateUtc: string;
  previousAttempts: number;
  maxAttempts: number;
  questions: AssessmentSessionQuestion[];
}

export interface SubmitAssessmentAnswer {
  questionId: number;
  selectedAnswers: string[];
}

export interface SubmitAssessmentRequest {
  startedAtUtc: string;
  answers: SubmitAssessmentAnswer[];
}

export interface GradedQuestionFeedback {
  questionId: number;
  questionText: string;
  isCorrect: boolean;
  submittedAnswers: string[];
  correctAnswers: string[];
  explanation: string;
}

export interface SubmitAssessmentResponse {
  attemptId: number;
  checkpointId: number;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  passingPercentage: number;
  passed: boolean;
  completionTiming: 'Early' | 'OnTime' | 'Late';
  normalRewardAwarded: number;
  earlyBonusAwarded: number;
  latePenaltyDeducted: number;
  netCashDelta: number;
  newBalance: number;
  alreadyRewarded: boolean;
  goalCompleted: boolean;
  newlyUnlockedAchievements: Achievement[];
  feedback: GradedQuestionFeedback[];
}

export interface ShopItem {
  id: number;
  itemCode: string;
  name: string;
  category: string;
  description: string;
  price: number;
  rarity: string;
  previewAsset: string;
  accentColor: string;
  isOwned: boolean;
  isEquipped: boolean;
}

export interface PurchaseItemResponse {
  success: boolean;
  message: string;
  itemCode: string;
  newBalance: number;
  item: ShopItem;
}

export interface CharacterItem {
  id: number;
  characterCode: string;
  name: string;
  title: string;
  description: string;
  avatarStyle: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCostume: string;
  defaultHairstyle: string;
  price: number;
  isOwned: boolean;
  isSelected: boolean;
}

export interface ThemeItem {
  id: number;
  themeCode: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundStyle: string;
  mapStyle: string;
  price: number;
  isOwned: boolean;
  isActive: boolean;
}

export interface EquipCustomizationRequest {
  characterCode?: string;
  costumeCode?: string;
  accessoryCode?: string;
  hairstyleCode?: string;
  effectCode?: string;
  badgeCode?: string;
  themeCode?: string;
}

export interface DashboardSummary {
  profile: GoalQuestProfile;
  totalGoals: number;
  completedGoals: number;
  activeGoals: number;
  totalCheckpoints: number;
  completedCheckpoints: number;
  activeCheckpoints: number;
  overallProgressPercent: number;
  totalRewardsEarned: number;
  totalPenaltiesDeducted: number;
  totalAchievements: number;
  recentRewards: CashTransaction[];
  recentPenalties: CashTransaction[];
  achievements: Achievement[];
  featuredGoal: GoalSummary | null;
}

export interface GoalProgressReportItem {
  goalCode: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  totalCheckpoints: number;
  completedCheckpoints: number;
  progressPercent: number;
  averageScorePercent: number;
  targetDateUtc: string;
}

export interface AssessmentScoreReportItem {
  attemptId: number;
  goalTitle: string;
  checkpointTitle: string;
  scorePercent: number;
  passed: boolean;
  completionTiming: string;
  cashDelta: number;
  submittedAtUtc: string;
}

export interface ReportsData {
  totalGoals: number;
  completedGoals: number;
  totalCheckpoints: number;
  completedCheckpoints: number;
  totalAttempts: number;
  passedAttempts: number;
  averageScorePercent: number;
  earlyCompletions: number;
  onTimeCompletions: number;
  lateCompletions: number;
  totalRewardsEarned: number;
  totalPenaltiesDeducted: number;
  netCashEarned: number;
  currentBalance: number;
  goalProgress: GoalProgressReportItem[];
  assessmentHistory: AssessmentScoreReportItem[];
  transactions: CashTransaction[];
  achievements: Achievement[];
}

// ─── Excel Workbook DTOs ───
export interface ExcelGoalRow {
  rowNumber: number;
  goalCode: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  targetDate: string;
  status: string;
  themeCode: string;
}

export interface ExcelCheckpointRow {
  rowNumber: number;
  checkpointCode: string;
  goalCode: string;
  sequenceOrder: number;
  title: string;
  description: string;
  dueDate: string;
  intervalValue: number;
  intervalUnit: string;
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
  passingPercentage: number;
  timeLimitMinutes: number;
  status: string;
}

export interface ExcelQuestionRow {
  rowNumber: number;
  questionCode: string;
  checkpointCode: string;
  questionText: string;
  questionType: string;
  options: string;
  correctAnswer: string;
  points: number;
  explanation: string;
  orderIndex: number;
}

export interface ExcelAssessmentSettingRow {
  rowNumber: number;
  checkpointCode: string;
  passingPercentage: number;
  timeLimitMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
}

export interface ExcelRewardRow {
  rowNumber: number;
  checkpointCode: string;
  rewardCash: number;
  earlyBonusCash: number;
  latePenaltyCash: number;
}

export interface ExcelCharacterRow {
  rowNumber: number;
  characterCode: string;
  name: string;
  title: string;
  description: string;
  avatarStyle: string;
  primaryColor: string;
  secondaryColor: string;
  defaultCostume: string;
  defaultHairstyle: string;
  price: number;
  isUnlockedByDefault: boolean;
}

export interface ExcelInventoryRow {
  rowNumber: number;
  itemCode: string;
  category: string;
  purchasePrice: number;
  isEquipped: boolean;
}

export interface ExcelShopItemRow {
  rowNumber: number;
  itemCode: string;
  name: string;
  category: string;
  description: string;
  price: number;
  rarity: string;
  previewAsset: string;
  accentColor: string;
  isDefaultUnlocked: boolean;
}

export interface ExcelThemeRow {
  rowNumber: number;
  themeCode: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundStyle: string;
  mapStyle: string;
  price: number;
  isUnlockedByDefault: boolean;
}

export interface ExcelUserSettingRow {
  rowNumber: number;
  displayName: string;
  initialCurrency: number;
  defaultPassPercentage: number;
  defaultTimeLimitMinutes: number;
  defaultRewardCash: number;
  earlyBonusMultiplier: number;
  defaultLatePenaltyCash: number;
  activeThemeCode: string;
  selectedCharacterCode: string;
  soundEnabled: boolean;
  animationsEnabled: boolean;
}

export interface GoalQuestExcelWorkbook {
  goals: ExcelGoalRow[];
  checkpoints: ExcelCheckpointRow[];
  assessmentQuestions: ExcelQuestionRow[];
  assessmentSettings: ExcelAssessmentSettingRow[];
  rewards: ExcelRewardRow[];
  characters: ExcelCharacterRow[];
  inventory: ExcelInventoryRow[];
  shopItems: ExcelShopItemRow[];
  themes: ExcelThemeRow[];
  userSettings: ExcelUserSettingRow[];
}

export interface GoalQuestExcelImportRequest {
  mode: ImportMode;
  dryRun: boolean;
  workbook: GoalQuestExcelWorkbook;
}

export interface ExcelValidationError {
  sheetName: string;
  rowNumber: number;
  column: string;
  code: string;
  message: string;
}

export interface ExcelSheetPreviewSummary {
  sheetName: string;
  totalRows: number;
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  errorCount: number;
}

export interface GoalQuestExcelImportResponse {
  success: boolean;
  dryRun: boolean;
  mode: ImportMode;
  totalErrors: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  sheetSummaries: ExcelSheetPreviewSummary[];
  errors: ExcelValidationError[];
}

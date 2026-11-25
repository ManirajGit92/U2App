import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import {
  AssessmentQuestionAdmin,
  AssessmentSession,
  CashTransaction,
  CharacterItem,
  Checkpoint,
  DashboardSummary,
  EquipCustomizationRequest,
  GoalDetail,
  GoalQuestExcelImportRequest,
  GoalQuestExcelImportResponse,
  GoalQuestExcelWorkbook,
  GoalQuestProfile,
  GoalSummary,
  ModeStatus,
  PurchaseItemResponse,
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
import { GoalQuestLocalStoreService } from './goal-quest-local-store.service';

@Injectable({ providedIn: 'root' })
export class GoalQuestApiService {
  private readonly http = inject(HttpClient);
  private readonly firebaseAuth = inject(FirebaseAuthService);
  private readonly localStore = inject(GoalQuestLocalStoreService);

  /**
   * Standalone Angular mode: uses predefined default data & localStorage + Excel import/export.
   * Set to false when connecting to the live .NET 10 U2Tools.Api backend.
   */
  private readonly useLocalStore = true;

  private readonly baseUrl = '/api/goalquest';
  private readonly localUserKey = 'u2app.goalquest.localUserId';
  private readonly modePrefKey = 'u2app.goalquest.workspaceMode';

  readonly apiOffline = signal(false);
  readonly workspaceMode = signal<WorkspaceMode>(this.loadSavedMode());
  readonly isDemoMode = computed(() => this.workspaceMode() === 'demo');

  setWorkspaceMode(mode: WorkspaceMode): void {
    this.workspaceMode.set(mode);
    try {
      localStorage.setItem(this.modePrefKey, mode);
    } catch {
      // ignore storage errors
    }
  }

  hasSavedModePreference(): boolean {
    try {
      const saved = localStorage.getItem(this.modePrefKey);
      return saved === 'demo' || saved === 'live';
    } catch {
      return false;
    }
  }

  private loadSavedMode(): WorkspaceMode {
    try {
      const saved = localStorage.getItem(this.modePrefKey);
      if (saved === 'live' || saved === 'demo') return saved;
    } catch {
      // ignore
    }
    return 'demo';
  }

  private getCurrentIdentity(): { userId: string; displayName: string } {
    const fbUser = this.firebaseAuth.user();
    if (fbUser) {
      return {
        userId: fbUser.uid,
        displayName: fbUser.displayName ?? fbUser.email ?? 'Quest Hero',
      };
    }
    return {
      userId: this.getOrCreateLocalUserId(),
      displayName: 'Quest Hero',
    };
  }

  private async buildHeaders(): Promise<HttpHeaders> {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-GoalQuest-Mode': this.workspaceMode(),
    });
    const fbUser = this.firebaseAuth.user();

    if (fbUser) {
      try {
        const token = await fbUser.getIdToken();
        headers = headers.set('Authorization', `Bearer ${token}`);
      } catch {
        // Fallback to UID header
      }
      headers = headers.set('X-GoalQuest-User-Id', fbUser.uid);
      if (fbUser.displayName || fbUser.email) {
        headers = headers.set(
          'X-GoalQuest-User-Name',
          fbUser.displayName ?? fbUser.email ?? 'Quest Hero',
        );
      }
      return headers;
    }

    const localUid = this.getOrCreateLocalUserId();
    return headers.set('X-GoalQuest-User-Id', localUid).set('X-GoalQuest-User-Name', 'Quest Hero');
  }

  private getOrCreateLocalUserId(): string {
    try {
      const existing = localStorage.getItem(this.localUserKey);
      if (existing) return existing;
      const generated = `gq-user-${crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Date.now()}`;
      localStorage.setItem(this.localUserKey, generated);
      return generated;
    } catch {
      return 'goalquest-local-hero';
    }
  }

  private async request<T>(fn: (headers: HttpHeaders) => Promise<T>): Promise<T> {
    const headers = await this.buildHeaders();
    try {
      const res = await fn(headers);
      this.apiOffline.set(false);
      return res;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 0 || status === 502 || status === 504) {
        this.apiOffline.set(true);
      }
      throw err;
    }
  }

  async getModeStatus(): Promise<ModeStatus> {
    if (this.useLocalStore) {
      const { userId } = this.getCurrentIdentity();
      return this.localStore.getModeStatus(userId, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<ModeStatus>(`${this.baseUrl}/mode-status`, { headers })),
    );
  }

  async resetDemoData(): Promise<DashboardSummary> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.resetDemoWorkspace(userId, displayName);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.post<DashboardSummary>(`${this.baseUrl}/demo/reset`, {}, { headers })),
    );
  }

  async getDashboard(): Promise<DashboardSummary> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getDashboard(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard`, { headers })),
    );
  }

  async updateSettings(payload: UpdateSettingsRequest): Promise<GoalQuestProfile> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.updateSettings(userId, displayName, this.workspaceMode(), payload);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.put<GoalQuestProfile>(`${this.baseUrl}/settings`, payload, { headers })),
    );
  }

  async getGoals(): Promise<GoalSummary[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getGoals(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<GoalSummary[]>(`${this.baseUrl}/goals`, { headers })),
    );
  }

  async getGoalDetail(goalId: number): Promise<GoalDetail> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getGoalDetail(userId, displayName, this.workspaceMode(), goalId);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<GoalDetail>(`${this.baseUrl}/goals/${goalId}`, { headers })),
    );
  }

  async createGoal(payload: SaveGoalRequest): Promise<GoalDetail> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.createGoal(userId, displayName, this.workspaceMode(), payload);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.post<GoalDetail>(`${this.baseUrl}/goals`, payload, { headers })),
    );
  }

  async createSampleGoal(): Promise<GoalDetail> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.createSampleGoal(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.post<GoalDetail>(`${this.baseUrl}/goals/sample`, {}, { headers })),
    );
  }

  async updateGoal(goalId: number, payload: SaveGoalRequest): Promise<GoalDetail> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.updateGoal(userId, displayName, this.workspaceMode(), goalId, payload);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.put<GoalDetail>(`${this.baseUrl}/goals/${goalId}`, payload, { headers })),
    );
  }

  async deleteGoal(goalId: number): Promise<void> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      this.localStore.deleteGoal(userId, displayName, this.workspaceMode(), goalId);
      return;
    }
    return this.request((headers) =>
      firstValueFrom(this.http.delete<void>(`${this.baseUrl}/goals/${goalId}`, { headers })),
    );
  }

  async createCheckpoint(goalId: number, payload: SaveCheckpointRequest): Promise<Checkpoint> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.createCheckpoint(userId, displayName, this.workspaceMode(), goalId, payload);
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.post<Checkpoint>(`${this.baseUrl}/goals/${goalId}/checkpoints`, payload, { headers }),
      ),
    );
  }

  async updateCheckpoint(checkpointId: number, payload: SaveCheckpointRequest): Promise<Checkpoint> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.updateCheckpoint(
        userId,
        displayName,
        this.workspaceMode(),
        checkpointId,
        payload,
      );
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.put<Checkpoint>(`${this.baseUrl}/checkpoints/${checkpointId}`, payload, { headers }),
      ),
    );
  }

  async deleteCheckpoint(checkpointId: number): Promise<void> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      this.localStore.deleteCheckpoint(userId, displayName, this.workspaceMode(), checkpointId);
      return;
    }
    return this.request((headers) =>
      firstValueFrom(this.http.delete<void>(`${this.baseUrl}/checkpoints/${checkpointId}`, { headers })),
    );
  }

  async getQuestions(checkpointId: number): Promise<AssessmentQuestionAdmin[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getQuestions(userId, displayName, this.workspaceMode(), checkpointId);
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.get<AssessmentQuestionAdmin[]>(`${this.baseUrl}/checkpoints/${checkpointId}/questions`, {
          headers,
        }),
      ),
    );
  }

  async createQuestion(
    checkpointId: number,
    payload: SaveAssessmentQuestionRequest,
  ): Promise<AssessmentQuestionAdmin> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.saveQuestion(
        userId,
        displayName,
        this.workspaceMode(),
        checkpointId,
        null,
        payload,
      );
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.post<AssessmentQuestionAdmin>(
          `${this.baseUrl}/checkpoints/${checkpointId}/questions`,
          payload,
          { headers },
        ),
      ),
    );
  }

  async updateQuestion(
    checkpointId: number,
    questionId: number,
    payload: SaveAssessmentQuestionRequest,
  ): Promise<AssessmentQuestionAdmin> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.saveQuestion(
        userId,
        displayName,
        this.workspaceMode(),
        checkpointId,
        questionId,
        payload,
      );
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.put<AssessmentQuestionAdmin>(
          `${this.baseUrl}/checkpoints/${checkpointId}/questions/${questionId}`,
          payload,
          { headers },
        ),
      ),
    );
  }

  async deleteQuestion(questionId: number): Promise<void> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      this.localStore.deleteQuestion(userId, displayName, this.workspaceMode(), questionId);
      return;
    }
    return this.request((headers) =>
      firstValueFrom(this.http.delete<void>(`${this.baseUrl}/questions/${questionId}`, { headers })),
    );
  }

  async startAssessment(checkpointId: number): Promise<AssessmentSession> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.startAssessment(userId, displayName, this.workspaceMode(), checkpointId);
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.get<AssessmentSession>(`${this.baseUrl}/checkpoints/${checkpointId}/assessment/start`, {
          headers,
        }),
      ),
    );
  }

  async submitAssessment(
    checkpointId: number,
    payload: SubmitAssessmentRequest,
  ): Promise<SubmitAssessmentResponse> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.submitAssessment(
        userId,
        displayName,
        this.workspaceMode(),
        checkpointId,
        payload,
      );
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.post<SubmitAssessmentResponse>(
          `${this.baseUrl}/checkpoints/${checkpointId}/assessment/submit`,
          payload,
          { headers },
        ),
      ),
    );
  }

  async getShopItems(): Promise<ShopItem[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getShopItems(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<ShopItem[]>(`${this.baseUrl}/shop`, { headers })),
    );
  }

  async purchaseItem(itemCode: string): Promise<PurchaseItemResponse> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.purchaseItem(userId, displayName, this.workspaceMode(), itemCode);
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.post<PurchaseItemResponse>(
          `${this.baseUrl}/shop/purchase/${encodeURIComponent(itemCode)}`,
          {},
          { headers },
        ),
      ),
    );
  }

  async getCharacters(): Promise<CharacterItem[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getCharacters(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<CharacterItem[]>(`${this.baseUrl}/characters`, { headers })),
    );
  }

  async getThemes(): Promise<ThemeItem[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getThemes(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<ThemeItem[]>(`${this.baseUrl}/themes`, { headers })),
    );
  }

  async equipCustomization(payload: EquipCustomizationRequest): Promise<GoalQuestProfile> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.equipCustomization(userId, displayName, this.workspaceMode(), payload);
    }
    return this.request((headers) =>
      firstValueFrom(this.http.put<GoalQuestProfile>(`${this.baseUrl}/customize`, payload, { headers })),
    );
  }

  async getTransactions(): Promise<CashTransaction[]> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getTransactions(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<CashTransaction[]>(`${this.baseUrl}/transactions`, { headers })),
    );
  }

  async getReports(): Promise<ReportsData> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.getReports(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<ReportsData>(`${this.baseUrl}/reports`, { headers })),
    );
  }

  async exportExcelData(): Promise<GoalQuestExcelWorkbook> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.exportWorkbook(userId, displayName, this.workspaceMode());
    }
    return this.request((headers) =>
      firstValueFrom(this.http.get<GoalQuestExcelWorkbook>(`${this.baseUrl}/excel/export`, { headers })),
    );
  }

  async importExcelData(
    payload: GoalQuestExcelImportRequest,
  ): Promise<GoalQuestExcelImportResponse> {
    if (this.useLocalStore) {
      const { userId, displayName } = this.getCurrentIdentity();
      return this.localStore.importWorkbook(userId, displayName, this.workspaceMode(), payload);
    }
    return this.request((headers) =>
      firstValueFrom(
        this.http.post<GoalQuestExcelImportResponse>(`${this.baseUrl}/excel/import`, payload, {
          headers,
        }),
      ),
    );
  }
}

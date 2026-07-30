import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as XLSX from 'xlsx';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';
import {
  MentalWellnessEntry,
  MoodDistribution,
  PositiveThoughtStats,
  WellnessInsight,
  WellnessStreak,
  MOTIVATIONAL_QUOTES,
  createBlankEntry,
} from './mental-wellness.models';

const APP_NAME = 'life-tracker';
const COLLECTION = 'mentalWellness';
const DRAFT_KEY = 'life-tracker-wellness-draft';

@Injectable({ providedIn: 'root' })
export class MentalWellnessService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private entriesSubject = new BehaviorSubject<MentalWellnessEntry[]>([]);
  entries$ = this.entriesSubject.asObservable();

  constructor() {
    this.loadSampleData();
    this.syncService.onAuthChange((uid) => {
      if (uid) this.loadFromFirestore();
      else this.loadSampleData();
    });
  }

  // ───────────── CRUD ─────────────

  getEntries(): MentalWellnessEntry[] {
    return this.entriesSubject.value;
  }

  getEntryByDate(date: string): MentalWellnessEntry | undefined {
    return this.entriesSubject.value.find((e) => e.date === date);
  }

  getLatestEntry(): MentalWellnessEntry | undefined {
    const entries = this.entriesSubject.value;
    return entries.length ? entries[entries.length - 1] : undefined;
  }

  addEntry(entry: MentalWellnessEntry): void {
    const scored = { ...entry, id: Date.now().toString(), overallWellnessScore: this.computeScore(entry) };
    this.entriesSubject.next([...this.entriesSubject.value, scored]);
    this.syncToFirestore();
  }

  updateEntry(id: string, entry: MentalWellnessEntry): void {
    const data = this.entriesSubject.value.map((e) =>
      e.id === id ? { ...entry, id, overallWellnessScore: this.computeScore(entry) } : e,
    );
    this.entriesSubject.next(data);
    this.syncToFirestore();
  }

  removeEntry(id: string): void {
    this.entriesSubject.next(this.entriesSubject.value.filter((e) => e.id !== id));
    this.syncToFirestore();
  }

  // ───────────── Score Computation ─────────────

  computeScore(entry: MentalWellnessEntry): number {
    const happinessWeight = (entry.happinessScore / 10) * 25;
    const anxietyWeight = ((10 - entry.anxietyLevel) / 10) * 20;
    const stressWeight = ((10 - entry.stressLevel) / 10) * 15;
    const emotionalWeight = entry.emotionalControl === 'Excellent' ? 15 : entry.emotionalControl === 'Good' ? 11 : entry.emotionalControl === 'Moderate' ? 7 : 3;
    const practiceWeight = Math.min((entry.meditationMinutes / 30) * 10, 10);
    const positiveWeight = Math.min((entry.positiveThoughts.length / 3) * 8, 8);
    const gratitudeWeight = Math.min((entry.gratitudeEntries.length / 3) * 7, 7);
    return Math.round(Math.min(happinessWeight + anxietyWeight + stressWeight + emotionalWeight + practiceWeight + positiveWeight + gratitudeWeight, 100));
  }

  getWellnessStatus(score: number): string {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Moderate';
    return 'Needs Attention';
  }

  getScoreColor(score: number): string {
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#3b82f6';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  // ───────────── Mood Distribution ─────────────

  getMoodDistribution(days = 30): MoodDistribution {
    const entries = this.getRecentEntries(days);
    if (!entries.length) return { happy: 40, calm: 25, neutral: 20, anxious: 10, sad: 5 };
    const total = entries.length;
    const counts = { happy: 0, calm: 0, neutral: 0, anxious: 0, sad: 0 };
    entries.forEach((e) => {
      const key = e.mood.toLowerCase() as keyof MoodDistribution;
      if (key in counts) counts[key]++;
    });
    return {
      happy: Math.round((counts.happy / total) * 100),
      calm: Math.round((counts.calm / total) * 100),
      neutral: Math.round((counts.neutral / total) * 100),
      anxious: Math.round((counts.anxious / total) * 100),
      sad: Math.round((counts.sad / total) * 100),
    };
  }

  getOverallMoodLabel(): string {
    const dist = this.getMoodDistribution(7);
    const max = Math.max(dist.happy, dist.calm, dist.neutral, dist.anxious, dist.sad);
    if (max === dist.happy) return 'Happy';
    if (max === dist.calm) return 'Calm';
    if (max === dist.anxious) return 'Anxious';
    if (max === dist.sad) return 'Sad';
    return 'Neutral';
  }

  // ───────────── Positive Thoughts Stats ─────────────

  getPositiveThoughtStats(): PositiveThoughtStats {
    const latest = this.getLatestEntry();
    const positive = latest?.positiveThoughts.length || 3;
    const neutral = Math.max(1, Math.floor(positive * 0.15));
    const negative = Math.max(0, Math.floor(positive * 0.05));
    const total = positive + neutral + negative;
    return { positive, neutral, negative, percentage: Math.round((positive / Math.max(total, 1)) * 100) };
  }

  // ───────────── Streaks ─────────────

  getStreaks(): WellnessStreak[] {
    const entries = [...this.entriesSubject.value].sort((a, b) => b.date.localeCompare(a.date));
    return [
      {
        label: 'Meditation Streak',
        icon: 'pi pi-moon',
        days: this.countStreak(entries, (e) => e.meditationMinutes > 0),
        status: 'Keep it up!',
        color: '#7c3aed',
      },
      {
        label: 'Gratitude Streak',
        icon: 'pi pi-heart',
        days: this.countStreak(entries, (e) => e.gratitudeEntries.length > 0),
        status: 'Amazing!',
        color: '#f43f5e',
      },
      {
        label: 'No Screen After 9 PM',
        icon: 'pi pi-mobile',
        days: this.countStreak(entries, (e) => e.screenTimeHours < 5),
        status: 'Great job!',
        color: '#0ea5e9',
      },
      {
        label: 'Daily Reflection Streak',
        icon: 'pi pi-book',
        days: this.countStreak(entries, (e) => !!e.dailyReflection),
        status: 'Consistent!',
        color: '#10b981',
      },
    ];
  }

  private countStreak(entries: MentalWellnessEntry[], predicate: (e: MentalWellnessEntry) => boolean): number {
    let streak = 0;
    for (const entry of entries) {
      if (predicate(entry)) streak++;
      else break;
    }
    return Math.max(streak, 1);
  }

  // ───────────── AI Insights ─────────────

  getInsights(): WellnessInsight[] {
    const entries = this.getRecentEntries(7);
    const insights: WellnessInsight[] = [];
    if (!entries.length) {
      insights.push({ icon: 'pi pi-info-circle', title: 'Start Tracking', text: 'Add your first wellness entry to get personalized insights!', type: 'info' });
      return insights;
    }

    const avgStress = entries.reduce((s, e) => s + e.stressLevel, 0) / entries.length;
    const avgAnxiety = entries.reduce((s, e) => s + e.anxietyLevel, 0) / entries.length;
    const avgHappiness = entries.reduce((s, e) => s + e.happinessScore, 0) / entries.length;
    const totalMeditation = entries.reduce((s, e) => s + e.meditationMinutes, 0);
    const avgScreenTime = entries.reduce((s, e) => s + e.screenTimeHours + e.screenTimeMinutes / 60, 0) / entries.length;
    const totalBooks = entries.reduce((s, e) => s + e.booksRead, 0);

    if (avgStress < 4) {
      insights.push({ icon: 'pi pi-check-circle', title: 'Low Stress', text: 'Your stress level is lower than last week. Keep meditating!', type: 'success' });
    } else if (avgStress >= 6) {
      insights.push({ icon: 'pi pi-exclamation-triangle', title: 'High Stress Detected', text: 'Try deep breathing exercises and reduce screen time before bed.', type: 'warning' });
    }

    if (avgScreenTime > 5) {
      insights.push({ icon: 'pi pi-mobile', title: 'Screen Time Alert', text: `Try reducing screen time by 30 mins to improve sleep.`, type: 'warning' });
    }

    if (totalMeditation > 100) {
      insights.push({ icon: 'pi pi-star', title: 'Meditation Champion', text: `You meditated ${totalMeditation} minutes this week. Excellent!`, type: 'success' });
    } else if (totalMeditation < 30) {
      insights.push({ icon: 'pi pi-moon', title: 'Meditate More', text: 'Try adding 5 more minutes of breathing exercise before sleep for better rest.', type: 'info' });
    }

    if (totalBooks > 0) {
      insights.push({ icon: 'pi pi-book', title: 'Great Reader', text: `You have read ${totalBooks} books this month. Keep learning!`, type: 'success' });
    }

    if (avgHappiness >= 7) {
      insights.push({ icon: 'pi pi-face-smile', title: 'Positive Mindset', text: 'Your happiness score is consistently high. Your positive thinking is paying off!', type: 'success' });
    }

    if (avgAnxiety >= 5) {
      insights.push({ icon: 'pi pi-heart', title: 'Manage Anxiety', text: 'Practice mindfulness meditation and gratitude journaling to reduce anxiety levels.', type: 'info' });
    }

    return insights.slice(0, 4);
  }

  // ───────────── Trends ─────────────

  getWeeklyTrend(metric: keyof MentalWellnessEntry): number[] {
    const entries = this.getRecentEntries(7);
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = new Date(today.getTime() - (6 - i) * 86400000).toISOString().split('T')[0];
      const entry = entries.find((e) => e.date === dateStr);
      const val = entry ? (entry as any)[metric] : 0;
      return typeof val === 'number' ? val : 0;
    });
  }

  getWeekdayLabels(): string[] {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) =>
      new Date(today.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
    );
  }

  // ───────────── Quote ─────────────

  getDailyQuote(): { text: string; author: string } {
    const dayIndex = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[dayIndex];
  }

  // ───────────── Draft ─────────────

  saveDraft(entry: MentalWellnessEntry): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(entry));
  }

  loadDraft(): MentalWellnessEntry | null {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
  }

  // ───────────── Excel ─────────────

  exportExcel(): void {
    const wb = XLSX.utils.book_new();
    const flat = this.entriesSubject.value.map((e) => ({
      ...e,
      gratitudeEntries: e.gratitudeEntries.join('; '),
      positiveThoughts: e.positiveThoughts.join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(flat);
    XLSX.utils.book_append_sheet(wb, ws, 'MentalWellness');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Mental_Wellness_Data.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importExcel(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          if (wb.SheetNames.includes('MentalWellness')) {
            const data = XLSX.utils.sheet_to_json<any>(wb.Sheets['MentalWellness']);
            const entries: MentalWellnessEntry[] = data.map((row: any) => ({
              ...createBlankEntry(row.date),
              ...row,
              gratitudeEntries: typeof row.gratitudeEntries === 'string' ? row.gratitudeEntries.split('; ').filter(Boolean) : [],
              positiveThoughts: typeof row.positiveThoughts === 'string' ? row.positiveThoughts.split('; ').filter(Boolean) : [],
            }));
            this.entriesSubject.next(entries);
            this.syncToFirestore();
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // ───────────── Firebase ─────────────

  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    await this.syncService.pushToFirestore(APP_NAME, COLLECTION, this.entriesSubject.value as any[]);
  }

  private async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const data = await this.syncService.pullFromFirestore<MentalWellnessEntry>(APP_NAME, COLLECTION);
      if (data.length > 0) this.entriesSubject.next(data);
    } catch (e) {
      console.error('MentalWellnessService: failed to load from Firestore', e);
    }
  }

  // ───────────── Helpers ─────────────

  private getRecentEntries(days: number): MentalWellnessEntry[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return this.entriesSubject.value.filter((e) => e.date >= cutoffStr);
  }

  private loadSampleData(): void {
    const today = new Date();
    const samples: MentalWellnessEntry[] = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today.getTime() - (13 - i) * 86400000).toISOString().split('T')[0];
      const base = createBlankEntry(date);
      return {
        ...base,
        id: `sample-mw-${i}`,
        happinessScore: 6 + Math.round(Math.random() * 3),
        anxietyLevel: 2 + Math.round(Math.random() * 3),
        stressLevel: 2 + Math.round(Math.random() * 4),
        mood: (['Happy', 'Calm', 'Neutral', 'Happy', 'Calm'] as const)[i % 5],
        emotionalControl: (['Good', 'Excellent', 'Good', 'Moderate', 'Good'] as const)[i % 5],
        selfConfidence: 6 + Math.round(Math.random() * 3),
        motivation: 6 + Math.round(Math.random() * 3),
        energyLevel: 5 + Math.round(Math.random() * 4),
        meditationMinutes: 15 + Math.round(Math.random() * 30),
        meditationType: 'Mindfulness Meditation',
        breathingExerciseSessions: 1 + Math.round(Math.random() * 3),
        breathingDuration: 10 + Math.round(Math.random() * 10),
        screenTimeHours: 3 + Math.round(Math.random() * 3),
        screenTimeMinutes: Math.round(Math.random() * 59),
        screenTimeMostUsedFor: 'Work & Productivity',
        digitalDetoxHours: 1 + Math.round(Math.random() * 2),
        digitalDetoxMinutes: Math.round(Math.random() * 30),
        detoxActivities: 'Reading, Walking, Family Time',
        booksRead: i % 4 === 0 ? 1 : 0,
        learningHours: Math.round(Math.random() * 2),
        learningMinutes: Math.round(Math.random() * 30),
        learningTopics: 'AI, Angular, Wellness',
        gratitudeEntries: [
          'Grateful for good health and family',
          'Amazing sunrise this morning',
          'Productive work and learning',
        ],
        dailyReflection: 'Completed important tasks, exercised, and spent quality time with family.',
        positiveThoughts: [
          'I am getting better every day',
          'I choose calm and peace',
          'I trust the process',
          'I am strong and capable',
        ],
        personalNotes: '',
        overallWellnessScore: 0,
        isDraft: false,
      };
    });

    // Compute scores
    samples.forEach((s) => {
      s.overallWellnessScore = this.computeScore(s);
    });

    this.entriesSubject.next(samples);
  }
}

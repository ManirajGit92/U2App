// ────────────────────────────────────────────────────────────
// Mental Wellness — Data Models
// ────────────────────────────────────────────────────────────

export interface MentalWellnessEntry {
  id: string;
  date: string;

  // ── Emotional Well-being ──
  happinessScore: number;        // 0-10
  anxietyLevel: number;          // 0-10
  stressLevel: number;           // 0-10
  mood: MoodType;
  emotionalControl: EmotionalControlLevel;
  selfConfidence: number;        // 0-10
  motivation: number;            // 0-10
  energyLevel: number;           // 0-10

  // ── Wellness Practices ──
  meditationMinutes: number;
  meditationType: string;
  breathingExerciseSessions: number;
  breathingDuration: number;     // minutes

  // ── Digital Wellness ──
  screenTimeHours: number;
  screenTimeMinutes: number;
  screenTimeMostUsedFor: string;
  digitalDetoxHours: number;
  digitalDetoxMinutes: number;
  detoxActivities: string;

  // ── Growth & Learning ──
  booksRead: number;
  learningHours: number;
  learningMinutes: number;
  learningTopics: string;

  // ── Journal & Reflection ──
  gratitudeEntries: string[];
  dailyReflection: string;
  positiveThoughts: string[];
  personalNotes: string;

  // ── Computed / Meta ──
  overallWellnessScore: number;  // 0-100
  isDraft: boolean;
}

export type MoodType = 'Happy' | 'Calm' | 'Neutral' | 'Anxious' | 'Sad';

export type EmotionalControlLevel = 'Excellent' | 'Good' | 'Moderate' | 'Low';

export interface WellnessStreak {
  label: string;
  icon: string;
  days: number;
  status: string;
  color: string;
}

export interface WellnessInsight {
  icon: string;
  title: string;
  text: string;
  type: 'success' | 'info' | 'warning';
}

export interface MoodDistribution {
  happy: number;
  calm: number;
  neutral: number;
  anxious: number;
  sad: number;
}

export interface PositiveThoughtStats {
  positive: number;
  neutral: number;
  negative: number;
  percentage: number;
}

export interface WellnessTrend {
  label: string;
  values: number[];
  labels: string[];
}

export const MOOD_OPTIONS: { label: string; value: MoodType; emoji: string }[] = [
  { label: 'Happy', value: 'Happy', emoji: '😊' },
  { label: 'Calm', value: 'Calm', emoji: '😌' },
  { label: 'Neutral', value: 'Neutral', emoji: '😐' },
  { label: 'Anxious', value: 'Anxious', emoji: '😰' },
  { label: 'Sad', value: 'Sad', emoji: '😢' },
];

export const EMOTIONAL_CONTROL_OPTIONS: { label: string; value: EmotionalControlLevel; description: string }[] = [
  { label: 'Excellent', value: 'Excellent', description: 'Full control of emotions' },
  { label: 'Good', value: 'Good', description: 'Handled emotions well today' },
  { label: 'Moderate', value: 'Moderate', description: 'Some ups and downs' },
  { label: 'Low', value: 'Low', description: 'Struggled with emotions today' },
];

export const MEDITATION_TYPES = [
  'Mindfulness Meditation',
  'Guided Meditation',
  'Breathing Meditation',
  'Body Scan',
  'Loving Kindness',
  'Transcendental',
  'Yoga Nidra',
  'Walking Meditation',
  'Other',
];

export const SCREEN_TIME_CATEGORIES = [
  'Work & Productivity',
  'Social Media',
  'Entertainment',
  'Learning & Education',
  'Communication',
  'Gaming',
  'News & Reading',
  'Other',
];

export const DETOX_ACTIVITIES = [
  'Reading',
  'Walking',
  'Family Time',
  'Meditation',
  'Exercise',
  'Cooking',
  'Nature',
  'Journaling',
  'Music',
  'Art & Creativity',
  'Other',
];

export const MOTIVATIONAL_QUOTES = [
  { text: 'A calm mind is a creative mind.', author: 'Eckhart Tolle' },
  { text: 'You can\'t stop the waves, but you can learn to surf.', author: 'Jon Kabat-Zinn' },
  { text: 'The greatest weapon against stress is our ability to choose one thought over another.', author: 'William James' },
  { text: 'Almost everything will work again if you unplug it for a few minutes, including you.', author: 'Anne Lamott' },
  { text: 'Your calm mind is the ultimate weapon against your challenges.', author: 'Bryant McGill' },
  { text: 'Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure.', author: 'Oprah Winfrey' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'Happiness is not something ready-made. It comes from your own actions.', author: 'Dalai Lama' },
  { text: 'Peace comes from within. Do not seek it without.', author: 'Buddha' },
  { text: 'Small steps every day. Big results one day.', author: 'Unknown' },
  { text: 'Mental health is not a destination, but a process.', author: 'Noam Shpancer' },
  { text: 'Self-care is how you take your power back.', author: 'Lalah Delia' },
];

/** Create a blank MentalWellnessEntry for a given date */
export function createBlankEntry(date?: string): MentalWellnessEntry {
  return {
    id: '',
    date: date || new Date().toISOString().split('T')[0],
    happinessScore: 7,
    anxietyLevel: 3,
    stressLevel: 4,
    mood: 'Calm',
    emotionalControl: 'Good',
    selfConfidence: 7,
    motivation: 7,
    energyLevel: 7,
    meditationMinutes: 0,
    meditationType: '',
    breathingExerciseSessions: 0,
    breathingDuration: 0,
    screenTimeHours: 0,
    screenTimeMinutes: 0,
    screenTimeMostUsedFor: '',
    digitalDetoxHours: 0,
    digitalDetoxMinutes: 0,
    detoxActivities: '',
    booksRead: 0,
    learningHours: 0,
    learningMinutes: 0,
    learningTopics: '',
    gratitudeEntries: [],
    dailyReflection: '',
    positiveThoughts: [],
    personalNotes: '',
    overallWellnessScore: 0,
    isDraft: false,
  };
}

export type GirlEmotion =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'excited'
  | 'confused'
  | 'shy'
  | 'romantic'
  | 'neutral'
  | 'thinking'
  | 'laughing'
  | 'crying'
  | 'worried'
  | 'curious'
  | 'playful';

export type GirlAction =
  | 'smile_shyly'
  | 'look_romantically'
  | 'talk_angrily'
  | 'smile_while_talking'
  | 'laugh_naturally'
  | 'show_embarrassment'
  | 'look_surprised'
  | 'shake_head_disagree'
  | 'nod_head_agree'
  | 'look_confused_question'
  | 'close_eyes_and_smile'
  | 'show_disappointment'
  | 'express_excitement'
  | 'welcoming_greeting'
  | 'wave_hand'
  | 'listen_attentively'
  | 'look_directly_talking'
  | 'thinking_pose';

export type VoiceStyle =
  | 'natural'
  | 'cheerful'
  | 'soft_happy'
  | 'soft_shy'
  | 'affectionate'
  | 'angry'
  | 'sad'
  | 'excited'
  | 'empathetic'
  | 'friendly'
  | 'curious'
  | 'calm';

export type SupportedLanguage = 'en' | 'en-IN' | 'ta' | 'auto';

export type VideoSourceType = 'youtube' | 'direct';

export interface GirlVideoItem {
  id: string;
  name: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  sourceType: VideoSourceType;
  emotion: GirlEmotion;
  action: GirlAction;
  description: string;
  videoAudioEnabled: boolean;
  voiceEnabled: boolean;
  loopVideo: boolean;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
  isFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredGirlResponse {
  responseText: string;
  emotion: GirlEmotion;
  action: GirlAction;
  videoId: string;
  voiceEnabled: boolean;
  videoAudioEnabled: boolean;
  loopVideo: boolean;
  language: 'en' | 'ta';
  voiceStyle: VoiceStyle;
  model?: string;
  fallbackUsed?: boolean;
}

export interface GirlChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  emotion?: GirlEmotion;
  action?: GirlAction;
  videoId?: string;
  voiceStyle?: VoiceStyle;
  language?: 'en' | 'ta';
  audioUrl?: string | null;
  audioDurationSec?: number;
  voiceEnabled?: boolean;
  videoAudioEnabled?: boolean;
  loopVideo?: boolean;
}

export interface GirlConversation {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messages: GirlChatMessage[];
}

export interface VoiceSettings {
  enabled: boolean;
  voiceName: string;
  tamilVoiceName: string;
  speed: number; // 0.7 - 1.4
  pitch: number; // -20 to +20 (percentage)
  volume: number; // 0.0 - 1.0
  language: SupportedLanguage;
  voiceStyle: VoiceStyle | 'auto';
  handsFreeMode: boolean;
}

export interface CharacterSettings {
  name: string;
  personality: string;
  blendWhiteBackground: boolean;
  overrideVideoAudio: boolean;
  overrideLoopVideo: boolean;
  showEmotionBadge: boolean;
  fallbackImageUrl: string;
  avatarImageUrl: string;
}

export interface FemaleVoiceOption {
  name: string;
  displayName: string;
  locale: string;
  language: 'en' | 'ta';
  accent: string;
  supportsStyles: boolean;
}

export interface EmotionMeta {
  value: GirlEmotion;
  label: string;
  emoji: string;
  color: string;
  defaultAction: GirlAction;
  defaultVoiceStyle: VoiceStyle;
}

export interface ActionMeta {
  value: GirlAction;
  label: string;
}

export const GIRL_CHARACTER_IMAGE = 'assets/images/girl-chat/girl-character.png';
export const GIRL_AVATAR_IMAGE = 'assets/images/girl-chat/girl-avatar.png';

export const EMOTION_CATALOG: EmotionMeta[] = [
  { value: 'happy', label: 'Happy', emoji: '😊', color: '#10b981', defaultAction: 'smile_while_talking', defaultVoiceStyle: 'cheerful' },
  { value: 'shy', label: 'Shy', emoji: '🤭', color: '#ec4899', defaultAction: 'smile_shyly', defaultVoiceStyle: 'soft_shy' },
  { value: 'romantic', label: 'Romantic', emoji: '🥰', color: '#f43f5e', defaultAction: 'look_romantically', defaultVoiceStyle: 'affectionate' },
  { value: 'excited', label: 'Excited', emoji: '🤩', color: '#f59e0b', defaultAction: 'express_excitement', defaultVoiceStyle: 'excited' },
  { value: 'laughing', label: 'Laughing', emoji: '😄', color: '#eab308', defaultAction: 'laugh_naturally', defaultVoiceStyle: 'cheerful' },
  { value: 'playful', label: 'Playful', emoji: '😜', color: '#a855f7', defaultAction: 'smile_shyly', defaultVoiceStyle: 'cheerful' },
  { value: 'neutral', label: 'Neutral', emoji: '🙂', color: '#64748b', defaultAction: 'look_directly_talking', defaultVoiceStyle: 'natural' },
  { value: 'thinking', label: 'Thinking', emoji: '🤔', color: '#6366f1', defaultAction: 'thinking_pose', defaultVoiceStyle: 'calm' },
  { value: 'curious', label: 'Curious', emoji: '🧐', color: '#3b82f6', defaultAction: 'look_confused_question', defaultVoiceStyle: 'curious' },
  { value: 'surprised', label: 'Surprised', emoji: '😮', color: '#8b5cf6', defaultAction: 'look_surprised', defaultVoiceStyle: 'excited' },
  { value: 'confused', label: 'Confused', emoji: '😕', color: '#0ea5e9', defaultAction: 'look_confused_question', defaultVoiceStyle: 'curious' },
  { value: 'worried', label: 'Worried', emoji: '😟', color: '#f97316', defaultAction: 'listen_attentively', defaultVoiceStyle: 'empathetic' },
  { value: 'sad', label: 'Sad', emoji: '😢', color: '#3b82f6', defaultAction: 'show_disappointment', defaultVoiceStyle: 'sad' },
  { value: 'crying', label: 'Crying', emoji: '😭', color: '#2563eb', defaultAction: 'show_disappointment', defaultVoiceStyle: 'sad' },
  { value: 'angry', label: 'Angry', emoji: '😠', color: '#ef4444', defaultAction: 'talk_angrily', defaultVoiceStyle: 'angry' },
];

export const ACTION_CATALOG: ActionMeta[] = [
  { value: 'smile_while_talking', label: 'Smile while talking' },
  { value: 'smile_shyly', label: 'Smile shyly' },
  { value: 'look_romantically', label: 'Look romantically' },
  { value: 'talk_angrily', label: 'Talk angrily' },
  { value: 'laugh_naturally', label: 'Laugh naturally' },
  { value: 'show_embarrassment', label: 'Show a little embarrassment' },
  { value: 'look_surprised', label: 'Look surprised' },
  { value: 'shake_head_disagree', label: 'Shake head while disagreeing' },
  { value: 'nod_head_agree', label: 'Nod head while agreeing' },
  { value: 'look_confused_question', label: 'Look confused while asking' },
  { value: 'close_eyes_and_smile', label: 'Close eyes and smile' },
  { value: 'show_disappointment', label: 'Show disappointment' },
  { value: 'express_excitement', label: 'Express excitement' },
  { value: 'welcoming_greeting', label: 'Give a welcoming greeting' },
  { value: 'wave_hand', label: 'Wave hand' },
  { value: 'listen_attentively', label: 'Listen attentively' },
  { value: 'look_directly_talking', label: 'Look directly while talking' },
  { value: 'thinking_pose', label: 'Thinking pose' },
];

export const FEMALE_VOICE_OPTIONS: FemaleVoiceOption[] = [
  {
    name: 'en-IN-NeerjaExpressiveNeural',
    displayName: 'Neerja Expressive (Indian English - Emotional)',
    locale: 'en-IN',
    language: 'en',
    accent: 'Indian English',
    supportsStyles: true,
  },
  {
    name: 'en-IN-NeerjaNeural',
    displayName: 'Neerja (Indian English - Friendly)',
    locale: 'en-IN',
    language: 'en',
    accent: 'Indian English',
    supportsStyles: false,
  },
  {
    name: 'en-IN-KavyaNeural',
    displayName: 'Kavya (Indian English - Warm)',
    locale: 'en-IN',
    language: 'en',
    accent: 'Indian English',
    supportsStyles: false,
  },
  {
    name: 'ta-IN-PallaviNeural',
    displayName: 'Pallavi (Tamil - Natural Female)',
    locale: 'ta-IN',
    language: 'ta',
    accent: 'Tamil (India)',
    supportsStyles: false,
  },
  {
    name: 'en-US-JennyNeural',
    displayName: 'Jenny (US English - Warm & Expressive)',
    locale: 'en-US',
    language: 'en',
    accent: 'US English',
    supportsStyles: true,
  },
  {
    name: 'en-US-AvaNeural',
    displayName: 'Ava (US English - Natural)',
    locale: 'en-US',
    language: 'en',
    accent: 'US English',
    supportsStyles: true,
  },
  {
    name: 'en-US-AriaNeural',
    displayName: 'Aria (US English - Expressive)',
    locale: 'en-US',
    language: 'en',
    accent: 'US English',
    supportsStyles: true,
  },
  {
    name: 'en-GB-SoniaNeural',
    displayName: 'Sonia (UK English - Cheerful)',
    locale: 'en-GB',
    language: 'en',
    accent: 'UK English',
    supportsStyles: true,
  },
];

export const QUICK_PROMPT_SUGGESTIONS: Array<{ label: string; prompt: string; icon: string }> = [
  { label: 'Tell me a joke', prompt: 'Tell me something funny to make me laugh!', icon: 'pi pi-sparkles' },
  { label: 'Motivate me', prompt: 'Give me some warm motivation for my day!', icon: 'pi pi-heart' },
  { label: 'Teach me something', prompt: 'Teach me one fascinating fact in simple words.', icon: 'pi pi-book' },
  { label: "Let's chat casually", prompt: 'Hey! How are you doing today? Let us chat casually.', icon: 'pi pi-comments' },
];

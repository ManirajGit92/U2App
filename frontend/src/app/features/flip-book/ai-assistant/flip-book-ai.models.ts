export type FlipBookPageLayout =
  | 'full-html'
  | 'full-image'
  | 'full-iframe'
  | 'split-html-image'
  | 'split-image-iframe'
  | 'split-html-iframe';

export interface FlipBookSlidePage {
  sno: number;
  voiceOver: string;
  layout: FlipBookPageLayout;
  title?: string;
  htmlContent?: string;
  imageUrl?: string;
  iframeUrl?: string;
}

export interface SlideVisualStyle {
  fontFamily: string;
  titleFontSize: string;
  bodyFontSize: string;
  textColor: string;
  accentColor: string;
  background: string;
}

export interface AiGeneratedSlide {
  id: string;
  slideNumber: number;
  title: string;
  subtitle?: string;
  layout: 'full-html' | 'full-image' | 'split-html-image';
  summary?: string;
  bulletPoints: string[];
  keyTakeaway?: string;
  htmlContent: string;
  imageUrl?: string;
  imagePrompt?: string;
  voiceOver: string;
  style: SlideVisualStyle;
  isRegenerating?: boolean;
}

export interface AiGeneratedDeck {
  deckTitle: string;
  topic: string;
  themeStyle: string;
  slides: AiGeneratedSlide[];
  generatedAt: string;
  sourcePrompt: string;
}

export interface FlipBookChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachmentName?: string;
  tokens?: number;
  tokensUnavailable?: boolean;
  slideCount?: number;
}

export interface FlipBookChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: FlipBookChatMessage[];
  pinned: boolean;
  draftDeck?: AiGeneratedDeck;
  totalTokens?: number;
}

export type SlideAcceptTarget = 'append' | 'new-book';

export interface SlideAcceptPayload {
  target: SlideAcceptTarget;
  deckTitle: string;
  pages: FlipBookSlidePage[];
}

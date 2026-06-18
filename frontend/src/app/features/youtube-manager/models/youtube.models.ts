export interface SliceTiming {
  start: number; // in seconds
  end: number;   // in seconds
}

export interface Bookmark {
  id: string;
  label: string;
  timestamp: number; // in seconds
  createdAt: number;
}

export interface CustomFieldInstance {
  fieldId: string;
  value: string;
}

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'dropdown';
  dropdownOptions?: string[];
}

export interface YouTubeVideoData {
  id: string; // Typically generated locally or extracted from URL
  videoName: string;
  youtubeUrl: string;
  youtubeVideoId: string; // Extracted ID
  category: string;
  subcategory: string;
  tags: string[]; // parsed from comma separated
  lyrics: string;
  sliceTimings: SliceTiming[]; // parsed from `10-20, 50-60`
  loopCount: number;

  // New Default Fields
  songName: string;
  singerName: string;
  musicianName: string;
  songType: string; // Melody, Sad, Love, Motivational, Energetic, Devotional, etc.
  actor: string;
  actress: string;
  songWriter: string;
  movieName: string;
  directorName: string;
  releaseYear: number | null;

  // Dynamic Metadata
  customFields?: CustomFieldInstance[];

  // Bookmarks
  bookmarks?: Bookmark[];
}


export interface SliceTiming {
  start: number; // in seconds
  end: number;   // in seconds
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
}

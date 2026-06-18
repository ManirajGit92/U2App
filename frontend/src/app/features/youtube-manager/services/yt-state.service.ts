import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { YouTubeVideoData, CustomFieldDefinition, CustomFieldInstance, Bookmark } from '../models/youtube.models';

@Injectable({
  providedIn: 'root'
})
export class YouTubeStateService {
  // Main video list
  private videosSub = new BehaviorSubject<YouTubeVideoData[]>([]);
  videos$ = this.videosSub.asObservable();

  // Custom Categories list
  private categoriesSub = new BehaviorSubject<string[]>(['Music', 'Education', 'Entertainment', 'Uncategorized']);
  categories$ = this.categoriesSub.asObservable();

  // Custom field definitions
  private customFieldDefsSub = new BehaviorSubject<CustomFieldDefinition[]>([]);
  customFieldDefs$ = this.customFieldDefsSub.asObservable();

  // Filtering state
  private filterCategorySub = new BehaviorSubject<string>(''); // e.g. 'category', 'singerName', custom field ID
  filterCategory$ = this.filterCategorySub.asObservable();

  private filterSelectedValuesSub = new BehaviorSubject<string[]>([]);
  filterSelectedValues$ = this.filterSelectedValuesSub.asObservable();

  // Sorting state: 'songName-asc' | 'songName-desc' | 'random'
  private sortOrderSub = new BehaviorSubject<string>('songName-asc');
  sortOrder$ = this.sortOrderSub.asObservable();

  // Currently playing video
  private currentVideoSub = new BehaviorSubject<YouTubeVideoData | null>(null);
  currentVideo$ = this.currentVideoSub.asObservable();

  // Show/Hide bottom player bar
  private showPlayerBarSub = new BehaviorSubject<boolean>(true);
  showPlayerBar$ = this.showPlayerBarSub.asObservable();

  // Player Command & Feedback Subjects
  playerCommand$ = new Subject<{ command: string; arg?: any }>();

  private playerStateSub = new BehaviorSubject<{
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    volume: number;
    speed: number;
    loopMode: 'off' | 'one' | 'all';
  }>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 100,
    speed: 1,
    loopMode: 'all'
  });
  playerState$ = this.playerStateSub.asObservable();

  updatePlayerState(state: Partial<{
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    volume: number;
    speed: number;
    loopMode: 'off' | 'one' | 'all';
  }>) {
    this.playerStateSub.next({ ...this.playerStateSub.getValue(), ...state });
  }

  sendCommand(command: string, arg?: any) {
    this.playerCommand$.next({ command, arg });
  }

  // For random order stability during playback/render
  private randomSeedMap = new Map<string, number>();

  constructor() {
    this.loadFromLocalStorage();
  }

  get videos() { return this.videosSub.getValue(); }
  get currentVideo() { return this.currentVideoSub.getValue(); }
  get categories() { return this.categoriesSub.getValue(); }
  get customFieldDefs() { return this.customFieldDefsSub.getValue(); }
  get filterCategory() { return this.filterCategorySub.getValue(); }
  get filterSelectedValues() { return this.filterSelectedValuesSub.getValue(); }
  get sortOrder() { return this.sortOrderSub.getValue(); }
  get showPlayerBar() { return this.showPlayerBarSub.getValue(); }

  // Seed / set video data
  initializeVideos(vids: YouTubeVideoData[]) {
    const migrated = vids.map(v => this.migrateVideo(v));
    this.videosSub.next(migrated);
    this.saveToLocalStorage();
  }

  // Set currently playing video
  setCurrentVideo(v: YouTubeVideoData | null) {
    this.currentVideoSub.next(v);
  }

  // Bottom player bar toggle
  setShowPlayerBar(show: boolean) {
    this.showPlayerBarSub.next(show);
    localStorage.setItem('youtube-manager-show-playerbar', JSON.stringify(show));
  }

  // Filter actions
  setFilterCategory(cat: string) {
    this.filterCategorySub.next(cat);
    this.filterSelectedValuesSub.next([]); // reset values
  }

  setFilterSelectedValues(values: string[]) {
    this.filterSelectedValuesSub.next(values);
  }

  setSortOrder(order: string) {
    if (order === 'random') {
      // Re-generate random weights to keep sorting stable
      this.randomSeedMap.clear();
      this.videos.forEach(v => {
        this.randomSeedMap.set(v.id, Math.random());
      });
    }
    this.sortOrderSub.next(order);
  }

  // Get available filter values for the selected category
  getAvailableFilterValues(): string[] {
    const cat = this.filterCategory;
    if (!cat) return [];
    
    const valuesSet = new Set<string>();
    
    this.videos.forEach(v => {
      let val = '';
      if (cat === 'category') val = v.category;
      else if (cat === 'subcategory') val = v.subcategory;
      else if (cat === 'songType') val = v.songType;
      else if (cat === 'singerName') val = v.singerName;
      else if (cat === 'actor') val = v.actor;
      else if (cat === 'actress') val = v.actress;
      else if (cat === 'movieName') val = v.movieName;
      else if (cat === 'musicianName') val = v.musicianName;
      else if (cat === 'songWriter') val = v.songWriter;
      else if (cat === 'directorName') val = v.directorName;
      else if (cat === 'releaseYear') val = v.releaseYear ? String(v.releaseYear) : '';
      else if (cat === 'tags') {
        v.tags.forEach(t => { if (t) valuesSet.add(t); });
        return;
      } else {
        // Custom field ID
        const custom = v.customFields?.find(cf => cf.fieldId === cat);
        if (custom) val = custom.value;
      }
      
      if (val && val.trim()) {
        valuesSet.add(val.trim());
      }
    });

    return Array.from(valuesSet).sort((a, b) => a.localeCompare(b));
  }

  // Get filtered and sorted list of videos
  getFilteredAndSortedVideos(): YouTubeVideoData[] {
    let list = [...this.videos];

    // Filter
    const cat = this.filterCategory;
    const selected = this.filterSelectedValues;
    if (cat && selected.length > 0) {
      list = list.filter(v => {
        if (cat === 'category') return selected.includes(v.category);
        if (cat === 'subcategory') return selected.includes(v.subcategory);
        if (cat === 'songType') return selected.includes(v.songType);
        if (cat === 'singerName') return selected.includes(v.singerName);
        if (cat === 'actor') return selected.includes(v.actor);
        if (cat === 'actress') return selected.includes(v.actress);
        if (cat === 'movieName') return selected.includes(v.movieName);
        if (cat === 'musicianName') return selected.includes(v.musicianName);
        if (cat === 'songWriter') return selected.includes(v.songWriter);
        if (cat === 'directorName') return selected.includes(v.directorName);
        if (cat === 'releaseYear') return selected.includes(String(v.releaseYear));
        if (cat === 'tags') return v.tags.some(t => selected.includes(t));
        
        // Custom field ID
        const custom = v.customFields?.find(cf => cf.fieldId === cat);
        return custom ? selected.includes(custom.value) : false;
      });
    }

    // Sort
    const order = this.sortOrder;
    if (order === 'songName-asc') {
      list.sort((a, b) => {
        const nameA = (a.songName || a.videoName || '').toLowerCase();
        const nameB = (b.songName || b.videoName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (order === 'songName-desc') {
      list.sort((a, b) => {
        const nameA = (a.songName || a.videoName || '').toLowerCase();
        const nameB = (b.songName || b.videoName || '').toLowerCase();
        return nameB.localeCompare(nameA);
      });
    } else if (order === 'random') {
      list.sort((a, b) => {
        const weightA = this.randomSeedMap.get(a.id) ?? 0;
        const weightB = this.randomSeedMap.get(b.id) ?? 0;
        return weightA - weightB;
      });
    }

    return list;
  }

  // Observable of the filtered/sorted videos
  getFilteredAndSortedVideos$(): Observable<YouTubeVideoData[]> {
    return combineLatest([
      this.videos$,
      this.filterCategory$,
      this.filterSelectedValues$,
      this.sortOrder$
    ]).pipe(
      map(() => this.getFilteredAndSortedVideos())
    );
  }

  // CRUD for Videos
  addVideo(video: YouTubeVideoData) {
    const list = [...this.videos, this.migrateVideo(video)];
    this.videosSub.next(list);
    this.saveToLocalStorage();
  }

  updateVideo(id: string, updated: YouTubeVideoData) {
    const list = this.videos.map(v => v.id === id ? this.migrateVideo(updated) : v);
    this.videosSub.next(list);
    if (this.currentVideo?.id === id) {
      this.setCurrentVideo(list.find(v => v.id === id) || null);
    }
    this.saveToLocalStorage();
  }

  deleteVideo(id: string) {
    const list = this.videos.filter(v => v.id !== id);
    this.videosSub.next(list);
    if (this.currentVideo?.id === id) {
      this.setCurrentVideo(null);
    }
    this.saveToLocalStorage();
  }

  updateVideoLyrics(id: string, lyrics: string) {
    const list = this.videos.map(v => v.id === id ? { ...v, lyrics } : v);
    this.videosSub.next(list);
    if (this.currentVideo?.id === id) {
      this.setCurrentVideo({ ...this.currentVideo, lyrics });
    }
    this.saveToLocalStorage();
  }

  playNextVideo() {
    const currentList = this.getFilteredAndSortedVideos();
    if (!currentList.length) return;

    if (!this.currentVideo) {
      this.setCurrentVideo(currentList[0]);
      return;
    }

    const idx = currentList.findIndex(v => v.id === this.currentVideo!.id);
    if (idx !== -1 && idx < currentList.length - 1) {
      this.setCurrentVideo(currentList[idx + 1]);
    } else {
      this.setCurrentVideo(currentList[0]); // loop around
    }
  }

  playPrevVideo() {
    const currentList = this.getFilteredAndSortedVideos();
    if (!currentList.length) return;

    if (!this.currentVideo) {
      this.setCurrentVideo(currentList[currentList.length - 1]);
      return;
    }

    const idx = currentList.findIndex(v => v.id === this.currentVideo!.id);
    if (idx > 0) {
      this.setCurrentVideo(currentList[idx - 1]);
    } else {
      this.setCurrentVideo(currentList[currentList.length - 1]); // loop to end
    }
  }

  playFirstVideo() {
    const currentList = this.getFilteredAndSortedVideos();
    if (currentList.length > 0) {
      this.setCurrentVideo(currentList[0]);
    }
  }

  playLastVideo() {
    const currentList = this.getFilteredAndSortedVideos();
    if (currentList.length > 0) {
      this.setCurrentVideo(currentList[currentList.length - 1]);
    }
  }

  // Bookmarks Management
  addBookmark(videoId: string, label: string, timestamp: number) {
    const bookmark: Bookmark = {
      id: 'BM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      label: label.trim() || `Bookmark @ ${this.formatTime(timestamp)}`,
      timestamp,
      createdAt: Date.now()
    };

    const list = this.videos.map(v => {
      if (v.id === videoId) {
        const bookmarks = [...(v.bookmarks || []), bookmark];
        return { ...v, bookmarks };
      }
      return v;
    });

    this.videosSub.next(list);
    if (this.currentVideo?.id === videoId) {
      this.setCurrentVideo(list.find(v => v.id === videoId) || null);
    }
    this.saveToLocalStorage();
  }

  deleteBookmark(videoId: string, bookmarkId: string) {
    const list = this.videos.map(v => {
      if (v.id === videoId) {
        const bookmarks = (v.bookmarks || []).filter(b => b.id !== bookmarkId);
        return { ...v, bookmarks };
      }
      return v;
    });

    this.videosSub.next(list);
    if (this.currentVideo?.id === videoId) {
      this.setCurrentVideo(list.find(v => v.id === videoId) || null);
    }
    this.saveToLocalStorage();
  }

  // CRUD for Categories
  addCategory(cat: string) {
    const clean = cat.trim();
    if (!clean || this.categories.includes(clean)) return;
    const list = [...this.categories, clean];
    this.categoriesSub.next(list);
    this.saveToLocalStorage();
  }

  updateCategory(oldCat: string, newCat: string) {
    const cleanOld = oldCat.trim();
    const cleanNew = newCat.trim();
    if (!cleanNew || cleanNew === cleanOld) return;

    // Update category list
    const list = this.categories.map(c => c === cleanOld ? cleanNew : c);
    this.categoriesSub.next(list);

    // Update videos using this category
    const updatedVids = this.videos.map(v => v.category === cleanOld ? { ...v, category: cleanNew } : v);
    this.videosSub.next(updatedVids);
    if (this.currentVideo?.category === cleanOld) {
      this.setCurrentVideo({ ...this.currentVideo, category: cleanNew });
    }

    this.saveToLocalStorage();
  }

  deleteCategory(cat: string) {
    const clean = cat.trim();
    const list = this.categories.filter(c => c !== clean);
    this.categoriesSub.next(list);

    // Reset video category if they had this category
    const updatedVids = this.videos.map(v => v.category === clean ? { ...v, category: 'Uncategorized' } : v);
    this.videosSub.next(updatedVids);
    if (this.currentVideo?.category === clean) {
      this.setCurrentVideo({ ...this.currentVideo, category: 'Uncategorized' });
    }

    this.saveToLocalStorage();
  }

  // CRUD for Custom Field Definitions
  addCustomFieldDef(def: CustomFieldDefinition) {
    const list = [...this.customFieldDefs, def];
    this.customFieldDefsSub.next(list);
    this.saveToLocalStorage();
  }

  updateCustomFieldDef(id: string, updated: CustomFieldDefinition) {
    const list = this.customFieldDefs.map(d => d.id === id ? updated : d);
    this.customFieldDefsSub.next(list);
    this.saveToLocalStorage();
  }

  deleteCustomFieldDef(id: string) {
    // Delete field definition
    const list = this.customFieldDefs.filter(d => d.id !== id);
    this.customFieldDefsSub.next(list);

    // Remove this custom field value from all videos
    const updatedVids = this.videos.map(v => {
      if (v.customFields) {
        return {
          ...v,
          customFields: v.customFields.filter(cf => cf.fieldId !== id)
        };
      }
      return v;
    });
    this.videosSub.next(updatedVids);
    if (this.currentVideo) {
      const currentUpdated = updatedVids.find(v => v.id === this.currentVideo!.id);
      this.setCurrentVideo(currentUpdated || null);
    }

    this.saveToLocalStorage();
  }

  // Format timestamp helper
  private formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Load and save state
  private loadFromLocalStorage() {
    // Load videos
    const data = localStorage.getItem('youtube-manager-data');
    if (data) {
      try {
        const parsed = JSON.parse(data) as any[];
        this.videosSub.next(parsed.map(v => this.migrateVideo(v)));
      } catch (e) {
        console.error('Failed parsing YT data', e);
      }
    }

    // Load categories
    const cats = localStorage.getItem('youtube-manager-categories');
    if (cats) {
      try {
        this.categoriesSub.next(JSON.parse(cats));
      } catch (e) {
        console.error('Failed parsing categories', e);
      }
    }

    // Load custom fields definitions
    const defs = localStorage.getItem('youtube-manager-custom-field-defs');
    if (defs) {
      try {
        this.customFieldDefsSub.next(JSON.parse(defs));
      } catch (e) {
        console.error('Failed parsing custom field defs', e);
      }
    }

    // Load bottom player bar display state
    const barState = localStorage.getItem('youtube-manager-show-playerbar');
    if (barState !== null) {
      try {
        this.showPlayerBarSub.next(JSON.parse(barState));
      } catch (e) {}
    }
  }

  private saveToLocalStorage() {
    localStorage.setItem('youtube-manager-data', JSON.stringify(this.videos));
    localStorage.setItem('youtube-manager-categories', JSON.stringify(this.categories));
    localStorage.setItem('youtube-manager-custom-field-defs', JSON.stringify(this.customFieldDefs));
  }

  // Migrate older video structures to ensure new fields exist
  private migrateVideo(v: any): YouTubeVideoData {
    return {
      id: v.id || ('YT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)),
      videoName: v.videoName || '',
      youtubeUrl: v.youtubeUrl || '',
      youtubeVideoId: v.youtubeVideoId || '',
      category: v.category || 'Uncategorized',
      subcategory: v.subcategory || 'General',
      tags: Array.isArray(v.tags) ? v.tags : [],
      lyrics: v.lyrics || '',
      sliceTimings: Array.isArray(v.sliceTimings) ? v.sliceTimings : [],
      loopCount: typeof v.loopCount === 'number' ? v.loopCount : 0,

      // Expanded metadata default values
      songName: v.songName || '',
      singerName: v.singerName || '',
      musicianName: v.musicianName || '',
      songType: v.songType || '',
      actor: v.actor || '',
      actress: v.actress || '',
      songWriter: v.songWriter || '',
      movieName: v.movieName || '',
      directorName: v.directorName || '',
      releaseYear: typeof v.releaseYear === 'number' ? v.releaseYear : (v.releaseYear ? parseInt(v.releaseYear, 10) : null),

      // Custom dynamic fields
      customFields: Array.isArray(v.customFields) ? v.customFields : [],

      // Bookmarks
      bookmarks: Array.isArray(v.bookmarks) ? v.bookmarks : []
    };
  }
}

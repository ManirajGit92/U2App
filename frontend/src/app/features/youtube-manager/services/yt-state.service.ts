import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { YouTubeVideoData } from '../models/youtube.models';

@Injectable({
  providedIn: 'root'
})
export class YouTubeStateService {
  private videosSub = new BehaviorSubject<YouTubeVideoData[]>([]);
  videos$ = this.videosSub.asObservable();

  private activeTagsSub = new BehaviorSubject<string[]>([]);
  activeTags$ = this.activeTagsSub.asObservable();

  private currentVideoSub = new BehaviorSubject<YouTubeVideoData | null>(null);
  currentVideo$ = this.currentVideoSub.asObservable();

  constructor() {
    this.loadFromLocalStorage();
  }

  get videos() { return this.videosSub.getValue(); }
  get currentVideo() { return this.currentVideoSub.getValue(); }
  get activeTags() { return this.activeTagsSub.getValue(); }

  initializeVideos(vids: YouTubeVideoData[]) {
    this.videosSub.next(vids);
    this.saveToLocalStorage();
  }

  setTags(tags: string[]) {
    this.activeTagsSub.next(tags);
  }

  setCurrentVideo(v: YouTubeVideoData | null) {
    this.currentVideoSub.next(v);
  }

  updateVideoLyrics(id: string, lyrics: string) {
    const list = this.videos.map(v => v.id === id ? { ...v, lyrics } : v);
    this.videosSub.next(list);
    
    if (this.currentVideo?.id === id) {
      this.setCurrentVideo({ ...this.currentVideo, lyrics });
    }
    
    this.saveToLocalStorage();
  }

  addVideo(video: YouTubeVideoData) {
    const list = [...this.videos, video];
    this.videosSub.next(list);
    this.saveToLocalStorage();
  }

  playNextVideo() {
    const currentList = this.getFilteredVideos();
    if (!currentList.length) return;

    if (!this.currentVideo) {
      this.setCurrentVideo(currentList[0]);
      return;
    }

    const idx = currentList.findIndex(v => v.id === this.currentVideo!.id);
    if (idx !== -1 && idx < currentList.length - 1) {
      this.setCurrentVideo(currentList[idx + 1]);
    } else {
      // Reached the end, loop back to start or stop
      this.setCurrentVideo(currentList[0]); // looping playlist by default
    }
  }

  private getFilteredVideos(): YouTubeVideoData[] {
    const all = this.videos;
    const tags = this.activeTags;
    if (tags.length === 0) return all;
    return all.filter(v => tags.some(t => v.tags.includes(t)));
  }

  private loadFromLocalStorage() {
    const data = localStorage.getItem('youtube-manager-data');
    if (data) {
      try {
        this.videosSub.next(JSON.parse(data));
      } catch (e) {
        console.error('Failed parsing YT data', e);
      }
    }
  }

  private saveToLocalStorage() {
    localStorage.setItem('youtube-manager-data', JSON.stringify(this.videos));
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as XLSX from 'xlsx';

export interface ContentEntry {
  imageUrl: string;
  voiceContent: string;
  duration: number; // in ms
  animation: string; // 'fade' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out'
}

export interface VoiceSettings {
  pitch: number;
  rate: number;
  volume: number;
  voiceURI?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContentCreatorService {
  private defaultEntries: ContentEntry[] = [
    {
      imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1000',
      voiceContent: 'Welcome to the Content Creator. Transform your ideas into stunning videos.',
      duration: 5000,
      animation: 'zoom-in'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=1000',
      voiceContent: 'Upload your Excel data to generate automated slideshows with AI voice-over.',
      duration: 6000,
      animation: 'slide-left'
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000',
      voiceContent: 'Customize animations, subtitles, and export your final creation as a high-quality video.',
      duration: 5500,
      animation: 'fade'
    }
  ];

  private entriesSubject = new BehaviorSubject<ContentEntry[]>(this.defaultEntries);
  public entries$: Observable<ContentEntry[]> = this.entriesSubject.asObservable();

  private voiceSettingsSubject = new BehaviorSubject<VoiceSettings>({
    pitch: 1,
    rate: 1,
    volume: 1
  });
  public voiceSettings$: Observable<VoiceSettings> = this.voiceSettingsSubject.asObservable();

  constructor() {}

  // --- Entries Management ---
  setEntries(entries: ContentEntry[]) {
    this.entriesSubject.next(entries);
  }

  addEntry(entry: ContentEntry) {
    this.entriesSubject.next([...this.entriesSubject.value, entry]);
  }

  updateEntry(index: number, entry: ContentEntry) {
    const entries = [...this.entriesSubject.value];
    entries[index] = entry;
    this.entriesSubject.next(entries);
  }

  removeEntry(index: number) {
    const entries = [...this.entriesSubject.value];
    entries.splice(index, 1);
    this.entriesSubject.next(entries);
  }

  // --- Voice Settings ---
  updateVoiceSettings(settings: Partial<VoiceSettings>) {
    this.voiceSettingsSubject.next({ ...this.voiceSettingsSubject.value, ...settings });
  }

  // --- Excel Integration ---
  async parseExcel(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const entries: ContentEntry[] = jsonData.map(row => ({
            imageUrl: row['Image URL'] || row['imageUrl'] || '',
            voiceContent: row['Voice Content (text-to-speech)'] || row['Voice Content'] || row['voiceContent'] || '',
            duration: Number(row['Display Duration'] || row['Duration'] || row['duration'] || 5000),
            animation: row['Animation Type'] || row['Animation'] || row['animation'] || 'fade'
          }));

          this.setEntries(entries);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  exportToExcel() {
    const data = this.entriesSubject.value.map(e => ({
      'Image URL': e.imageUrl,
      'Voice Content (text-to-speech)': e.voiceContent,
      'Display Duration': e.duration,
      'Animation Type': e.animation
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Content');
    XLSX.writeFile(workbook, 'Content_Creator_Data.xlsx');
  }

  // --- TTS ---
  speak(text: string, onStart?: () => void, onEnd?: () => void, onBoundary?: (event: SpeechSynthesisEvent) => void): SpeechSynthesisUtterance {
    window.speechSynthesis.cancel(); // Stop current speech
    const settings = this.voiceSettingsSubject.value;
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.pitch = settings.pitch;
    utterance.rate = settings.rate;
    utterance.volume = settings.volume;

    if (settings.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(v => v.voiceURI === settings.voiceURI) || null;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onBoundary) utterance.onboundary = onBoundary;

    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  stopSpeaking() {
    window.speechSynthesis.cancel();
  }
}

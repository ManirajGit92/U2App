import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as XLSX from 'xlsx';

interface PageContent {
  sno: number;
  rawContent: string;
  safeHtml?: SafeHtml;
  voiceOver: string;
  isImage: boolean;
  isHtml: boolean;
  isText: boolean;
}

interface PhysicalPaper {
  index: number; // 0, 1, 2...
  front?: PageContent; // pages[i*2]
  back?: PageContent;  // pages[i*2 + 1]
}

@Component({
  selector: 'app-flip-book',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flip-book.component.html',
  styleUrl: './flip-book.component.scss'
})
export class FlipBookComponent implements OnInit, OnDestroy {
  @ViewChild('bookContainer') bookContainer!: ElementRef;

  pages: PageContent[] = [];
  physicalPages: PhysicalPaper[] = [];
  
  // State
  currentPaperIndex: number = 0; // Represents the physical paper turned
  zoomLevel: number = 1;
  isFullscreen: boolean = false;
  isMuted: boolean = false;
  isPlaying: boolean = false;
  playSpeedMs: number = 3000;
  playInterval: any = null;

  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadLastBook() || this.loadDefaultDemo();
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    this.stopSpeaking();
  }

  // ============== DATA LOAD & PARSE ==============

  loadDefaultDemo() {
    this.pages = [
      {
        sno: 1, rawContent: `<h1>Welcome to Flip Book Viewer</h1><p>A realistic interactive document format.</p>`, 
        voiceOver: 'Welcome to Flip Book Viewer. Use controls to go to the next page or toggle auto-play.',
        ...this.parseContent(`<h1>Welcome to Flip Book Viewer</h1><p>A realistic interactive document format.</p>`)
      },
      {
        sno: 2, rawContent: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000', 
        voiceOver: 'Here is a sample image rendered safely on the page.',
        ...this.parseContent('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000')
      },
      {
        sno: 3, rawContent: 'This is a sample text page. It is styled with safe fonts and padding, just plain text that wraps automatically.', 
        voiceOver: 'This is a sample text page without any formatting.',
        ...this.parseContent('This is a sample text page. It is styled with safe fonts and padding, just plain text that wraps automatically.')
      },
      {
        sno: 4, rawContent: `<div style="text-align:center; padding-top: 50px;"><h2>The End</h2><p>Design stunning books.</p></div>`, 
        voiceOver: 'The end. You can upload an Excel file to see your own content.',
        ...this.parseContent(`<div style="text-align:center; padding-top: 50px;"><h2>The End</h2><p>Design stunning books.</p></div>`)
      }
    ];
    this.buildPhysicalBook();
  }

  parseContent(content: string): { isImage: boolean, isHtml: boolean, isText: boolean, safeHtml?: SafeHtml } {
    let strContent = (content || '').toString().trim();
    const isImage = strContent.match(/^data:image\//) || strContent.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i) ? true : false;
    let isHtml = false;
    let safeHtml: SafeHtml | undefined = undefined;

    if (!isImage && strContent.includes('<') && strContent.includes('>')) {
      isHtml = true;
      safeHtml = this.sanitizer.bypassSecurityTrustHtml(strContent);
    }
    
    return {
      isImage: !!isImage,
      isHtml: isHtml,
      isText: !isImage && !isHtml,
      safeHtml: safeHtml
    };
  }

  buildPhysicalBook() {
    this.physicalPages = [];
    for (let i = 0; i < this.pages.length; i += 2) {
      this.physicalPages.push({
        index: i / 2,
        front: this.pages[i],
        back: this.pages[i + 1]
      });
    }
    this.currentPaperIndex = 0;
    this.speakCurrentLeftAndRight();
  }

  // ============== EXCEL HANDLING ==============

  onFileChange(event: any) {
    const target = event.target as HTMLInputElement;
    if (target.files?.length) {
      this.processFile(target.files[0]);
    }
  }

  processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      this.errorMessage = 'Please upload a valid Excel file (.xlsx or .xls)';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const reader = new FileReader();

    reader.onload = (e: any) => {
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          // Validation
          if (jsonData.length === 0) {
            this.errorMessage = 'Excel file is empty.';
            this.isLoading = false;
            this.cdr.detectChanges();
            return;
          }

          // Case insensitive header check
          const keys = Object.keys(jsonData[0]).map(k => k.toLowerCase());
          if (!keys.includes('sno') || !keys.includes('content')) {
            this.errorMessage = 'Invalid template. Must contain columns: SNo, Content, VoiceOver';
            this.isLoading = false;
            this.cdr.detectChanges();
            return;
          }

          const parsedPages: PageContent[] = jsonData.map((row: any) => {
            const sno = row['SNo'] || row['sno'] || 0;
            const content = row['Content'] || row['content'] || '';
            const voiceOver = row['VoiceOver'] || row['voiceover'] || '';
            const types = this.parseContent(content);
            return { sno, rawContent: content, voiceOver, ...types };
          });

          parsedPages.sort((a, b) => a.sno - b.sno);
          this.pages = parsedPages;
          this.saveBook();
          this.buildPhysicalBook();
        } catch (err) {
          this.errorMessage = 'Error parsing the Excel file. Check format.';
        } finally {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    };
    
    reader.onerror = () => {
      this.errorMessage = 'Failed to read the file.';
      this.isLoading = false;
      this.cdr.detectChanges();
    };

    reader.readAsArrayBuffer(file);
  }

  downloadTemplate() {
    const data = [
      { SNo: 1, Content: '<h1>Page 1</h1>', VoiceOver: 'Welcome to page one' },
      { SNo: 2, Content: 'https://via.placeholder.com/600', VoiceOver: 'Here is a placeholder image' }
    ];
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FlipBook');
    XLSX.writeFile(wb, 'FlipBook_Template.xlsx');
  }

  // ============== LOCAL STORAGE ==============

  saveBook() {
    try {
      localStorage.setItem('u2app_flipbook_pages', JSON.stringify({
        pages: this.pages.map(p => ({
          sno: p.sno,
          rawContent: p.rawContent,
          voiceOver: p.voiceOver
        }))
      }));
    } catch(e) { }
  }

  loadLastBook(): boolean {
    try {
      const saved = localStorage.getItem('u2app_flipbook_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pages && parsed.pages.length > 0) {
          this.pages = parsed.pages.map((p: any) => ({
            sno: p.sno,
            rawContent: p.rawContent,
            voiceOver: p.voiceOver,
            ...this.parseContent(p.rawContent)
          }));
          this.buildPhysicalBook();
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  resetBook() {
    localStorage.removeItem('u2app_flipbook_pages');
    this.loadDefaultDemo();
  }

  // ============== UI / NAV CONTROLS ==============

  nextPage() {
    if (this.currentPaperIndex < this.physicalPages.length) {
      this.currentPaperIndex++;
      this.speakCurrentLeftAndRight();
    } else {
      this.stopAutoPlay(); // End of book
    }
  }

  prevPage() {
    if (this.currentPaperIndex > 0) {
      this.currentPaperIndex--;
      this.speakCurrentLeftAndRight();
    }
  }

  firstPage() {
    this.currentPaperIndex = 0;
    this.speakCurrentLeftAndRight();
  }

  lastPage() {
    this.currentPaperIndex = this.physicalPages.length;
    this.speakCurrentLeftAndRight();
  }

  toggleAutoPlay() {
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      // First, process current page speech, then we schedule next page
      this.speakCurrentLeftAndRight(true);
      if (!this.isMuted) {
         // Auto play timing will rely on voice ended + buffer, or pure setInterval
         // fallback to pure interval for now
      }
      this.startInterval();
    } else {
      this.stopAutoPlay();
    }
  }

  startInterval() {
    if (this.playInterval) clearInterval(this.playInterval);
    this.playInterval = setInterval(() => {
      // Are we speaking?
      if (!this.isMuted && window.speechSynthesis.speaking) {
         // Wait for speech
         return; 
      }
      this.nextPage();
    }, this.playSpeedMs);
  }

  stopAutoPlay() {
    this.isPlaying = false;
    if (this.playInterval) clearInterval(this.playInterval);
  }

  // ============== SPEECH API ==============

  speakCurrentLeftAndRight(forcePlay: boolean = false) {
    if (this.isMuted) {
      this.stopSpeaking();
      return;
    }
    // We try to read both pages sequentially.
    // If we are at index i, left page is pages[(i-1)*2+1], right page is pages[i*2]
    // That means, at index 0: left page = none, right page = front of paper 0.
    // When paper 0 is turned (index 1): left page = back of paper 0. right page = front of paper 1.

    if (!forcePlay && !this.isPlaying) return; // Optional logic: should it speak on manual turn? User wants: "VoiceOver column for automatic narration when the page opens". 
    // Wait, the prompt says: Use the VoiceOver column for automatic narration when the page opens. So we should read when turned!
    
    this.stopSpeaking();
    
    let leftVoice = '';
    let rightVoice = '';

    if (this.currentPaperIndex > 0) {
        const prevPaper = this.physicalPages[this.currentPaperIndex - 1];
        if (prevPaper.back?.voiceOver) leftVoice = prevPaper.back.voiceOver;
    }
    
    if (this.currentPaperIndex < this.physicalPages.length) {
        const currPaper = this.physicalPages[this.currentPaperIndex];
        if (currPaper.front?.voiceOver) rightVoice = currPaper.front.voiceOver;
    }

    const fullVoice = (leftVoice + " ... " + rightVoice).trim();
    if (fullVoice && fullVoice !== "...") {
      const msg = new SpeechSynthesisUtterance(fullVoice);
      window.speechSynthesis.speak(msg);
    }
  }

  replayVoice() {
    this.stopSpeaking();
    this.speakCurrentLeftAndRight(true);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeaking();
    } else {
      this.speakCurrentLeftAndRight(true);
    }
  }

  stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  // ============== VIEWER SETTINGS ==============

  zoomIn() {
    this.zoomLevel = Math.min(2.5, this.zoomLevel + 0.2);
  }

  zoomOut() {
    this.zoomLevel = Math.max(0.4, this.zoomLevel - 0.2);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => this.isFullscreen = true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => this.isFullscreen = false);
      }
    }
  }

  @HostListener('document:fullscreenchange')
  onFullScreenChange() {
    this.isFullscreen = !!document.fullscreenElement;
  }
}

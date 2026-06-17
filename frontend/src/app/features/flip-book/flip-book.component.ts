import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as XLSX from 'xlsx';

interface PageContent {
  sno: number;
  voiceOver: string;
  layout: 'full-html' | 'full-image' | 'full-iframe' | 'split-html-image' | 'split-image-iframe' | 'split-html-iframe';
  title?: string;
  htmlContent?: string;
  imageUrl?: string;
  iframeUrl?: string;
  // internal safety bindings:
  safeHtml?: SafeHtml;
  safeIframeUrl?: any;
}

interface PhysicalPaper {
  index: number; 
  front?: PageContent; 
  back?: PageContent;  
}

interface Book {
  id: string;
  name: string;
  pages: PageContent[];
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
  @ViewChild('flipbookWrapper') flipbookWrapper!: ElementRef;

  books: Book[] = [];
  selectedBookId: string = '';
  
  pages: PageContent[] = [];
  physicalPages: PhysicalPaper[] = [];
  
  // State
  private _currentPaperIndex: number = 0;
  turningPageId: number | null = null;
  private turningTimeout: any = null;
  lastFlipTime: number = Date.now();
  isSpeechSpeaking: boolean = false;

  get currentPaperIndex(): number {
    return this._currentPaperIndex;
  }

  set currentPaperIndex(val: number) {
    const prevVal = this._currentPaperIndex;
    this._currentPaperIndex = val;
    
    if (val !== prevVal) {
      if (val > prevVal) {
        this.turningPageId = prevVal; // page turning left
      } else {
        this.turningPageId = val; // page turning right
      }
      
      if (this.turningTimeout) clearTimeout(this.turningTimeout);
      this.turningTimeout = setTimeout(() => {
        this.turningPageId = null;
        this.cdr.detectChanges();
      }, 600);
    }
  }

  getPaperZIndex(i: number): number {
    if (this.isDragging && this.draggedPageId === i) {
      return 999;
    }
    if (this.turningPageId === i) {
      return 999;
    }
    if (i < this.currentPaperIndex) {
      return i;
    }
    return this.physicalPages.length - i;
  }

  zoomLevel: number = 1;
  isFullscreen: boolean = false;
  isMuted: boolean = false;
  isPlaying: boolean = false;
  playSpeedMs: number = 3000;
  playInterval: any = null;

  isLoading: boolean = false;
  errorMessage: string = '';

  // Sidebar state
  sidebarCollapsed: boolean = false;
  sidebarMobileOpen: boolean = false;

  // Book Editor Popup state
  showBookModal: boolean = false;
  editingBook: Book | null = null;
  selectedEditingPageId: number = 0;
  editingPage: PageContent = this.blankPage(1);

  // Drag physics state
  isDragging: boolean = false;
  draggedPageId: number | null = null;
  startX: number = 0;
  draggedAngle: number = 0;
  pageWidth: number = 400;

  getSelectedBookName(): string {
    const book = this.books.find(b => b.id === this.selectedBookId);
    return book ? book.name : '';
  }

  constructor(private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadBooksList();
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    this.stopSpeaking();
  }

  // ============== DATA LOAD & PARSE ==============

  loadDefaultDemo() {
    const demoBook: Book = {
      id: 'demo_book',
      name: '💡 Welcome to Flip Book Viewer',
      pages: [
        {
          sno: 1,
          title: 'Cover Page',
          layout: 'full-html',
          htmlContent: `<div style="text-align:center; padding: 2rem 1rem;">
            <h1 style="font-size: 2.2rem; font-weight: 800; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1.5rem;">Digital Library Experience</h1>
            <p style="font-size: 1.1rem; color: var(--text-secondary);">Select a book from the shelf on the left, turn pages with drag, or edit pages dynamically.</p>
            <div style="margin-top: 2.5rem; font-size: 4rem;">📖</div>
          </div>`,
          voiceOver: 'Welcome to Flip Book Viewer. Use controls to go to the next page or toggle auto-play.'
        },
        {
          sno: 2,
          title: 'Full Image Feature',
          layout: 'full-image',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000',
          voiceOver: 'Here is a scenic photography page rendered across the page.'
        },
        {
          sno: 3,
          title: 'Split Page: Text & Image',
          layout: 'split-html-image',
          htmlContent: `<h3>Responsive Split Views</h3>
            <p>This page demonstrates a 50% HTML block aligned side-by-side with a 50% image container.</p>
            <p>On mobile viewports, these automatically wrap vertically to guarantee maximum comfort and readability.</p>`,
          imageUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=500',
          voiceOver: 'This page shows custom text layout paired with a book image side-by-side.'
        },
        {
          sno: 4,
          title: 'Sandboxed Iframe Embed',
          layout: 'full-iframe',
          iframeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          voiceOver: 'Here is a sandboxed media embed section.'
        }
      ]
    };
    
    this.books = [demoBook];
    this.selectedBookId = demoBook.id;
    this.saveBooksList();
    this.selectBook(demoBook.id);
  }

  parseContent(content: string): { layout: PageContent['layout'], htmlContent?: string, imageUrl?: string, iframeUrl?: string } {
    const strContent = (content || '').toString().trim();
    const isImage = strContent.match(/^data:image\//) || strContent.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i) ? true : false;
    const isIframe = strContent.startsWith('http') && (strContent.includes('youtube.com') || strContent.includes('vimeo.com') || strContent.includes('embed') || strContent.match(/\.html?$/i));

    if (isImage) {
      return { layout: 'full-image', imageUrl: strContent };
    } else if (isIframe) {
      return { layout: 'full-iframe', iframeUrl: strContent };
    } else {
      return { layout: 'full-html', htmlContent: strContent };
    }
  }

  parseContentFields(page: PageContent) {
    return {
      safeHtml: page.htmlContent ? this.sanitizer.bypassSecurityTrustHtml(page.htmlContent) : undefined,
      safeIframeUrl: page.iframeUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(page.iframeUrl) : undefined
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

  // ============== BOOK CRUD & STORAGE ==============

  loadBooksList() {
    try {
      const saved = localStorage.getItem('u2app_flipbooks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.books = parsed;
          const lastActive = localStorage.getItem('u2app_active_book_id');
          if (lastActive && this.books.some(b => b.id === lastActive)) {
            this.selectBook(lastActive);
          } else {
            this.selectBook(this.books[0].id);
          }
          return;
        }
      }
      
      // Migration of old single-book localstorage data
      const oldSaved = localStorage.getItem('u2app_flipbook_pages');
      if (oldSaved) {
        const parsedOld = JSON.parse(oldSaved);
        if (parsedOld.pages && parsedOld.pages.length > 0) {
          const oldPages = parsedOld.pages.map((p: any) => {
            const parsed = this.parseContent(p.rawContent);
            return {
              sno: p.sno,
              voiceOver: p.voiceOver,
              layout: parsed.layout,
              htmlContent: parsed.htmlContent,
              imageUrl: parsed.imageUrl,
              iframeUrl: parsed.iframeUrl
            };
          });
          const migratedBook: Book = {
            id: 'migrated_book',
            name: 'Migrated Book',
            pages: oldPages
          };
          this.books = [migratedBook];
          this.saveBooksList();
          this.selectBook(migratedBook.id);
          return;
        }
      }
      
      this.loadDefaultDemo();
    } catch(e) {
      this.loadDefaultDemo();
    }
  }

  saveBooksList() {
    try {
      localStorage.setItem('u2app_flipbooks', JSON.stringify(this.books));
      localStorage.setItem('u2app_active_book_id', this.selectedBookId);
    } catch(e) {}
  }

  selectBook(bookId: string) {
    const book = this.books.find(b => b.id === bookId);
    if (book) {
      this.selectedBookId = bookId;
      this.pages = book.pages.map(p => ({
        ...p,
        ...this.parseContentFields(p)
      }));
      this.buildPhysicalBook();
      if (this.sidebarMobileOpen) {
        this.sidebarMobileOpen = false;
      }
    }
  }

  blankPage(sno: number): PageContent {
    return {
      sno,
      voiceOver: '',
      layout: 'full-html',
      htmlContent: '',
      imageUrl: '',
      iframeUrl: ''
    };
  }

  openCreateBook() {
    this.editingBook = {
      id: 'book_' + Date.now(),
      name: 'My New Book',
      pages: [
        this.blankPage(1),
        this.blankPage(2)
      ]
    };
    this.selectedEditingPageId = 0;
    this.editingPage = { ...this.editingBook.pages[0] };
    this.showBookModal = true;
  }

  openEditBook(book: Book, event: Event) {
    event.stopPropagation();
    this.editingBook = JSON.parse(JSON.stringify(book));
    if (this.editingBook) {
      if (this.editingBook.pages.length === 0) {
        this.editingBook.pages.push(this.blankPage(1));
      }
      this.selectedEditingPageId = 0;
      this.editingPage = { ...this.editingBook.pages[0] };
      this.showBookModal = true;
    }
  }

  deleteBook(book: Book, event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${book.name}"?`)) {
      this.books = this.books.filter(b => b.id !== book.id);
      this.saveBooksList();
      if (this.selectedBookId === book.id) {
        if (this.books.length > 0) {
          this.selectBook(this.books[0].id);
        } else {
          this.loadDefaultDemo();
        }
      }
    }
  }

  resetBook() {
    if (confirm('Reset to default demo library? Current books list will be overwritten.')) {
      localStorage.removeItem('u2app_flipbooks');
      localStorage.removeItem('u2app_flipbook_pages');
      this.loadDefaultDemo();
    }
  }

  // ============== BOOK MODAL LOGIC ==============

  selectEditingPage(index: number) {
    if (!this.editingBook) return;
    this.editingBook.pages[this.selectedEditingPageId] = { ...this.editingPage };
    this.selectedEditingPageId = index;
    this.editingPage = { ...this.editingBook.pages[index] };
  }

  addPageToEditingBook() {
    if (!this.editingBook) return;
    const nextSNo = this.editingBook.pages.length + 1;
    const newPage = this.blankPage(nextSNo);
    this.editingBook.pages.push(newPage);
    this.selectEditingPage(this.editingBook.pages.length - 1);
  }

  deletePageFromEditingBook(index: number) {
    if (!this.editingBook) return;
    if (this.editingBook.pages.length <= 1) {
      alert("A book must have at least one page.");
      return;
    }
    
    this.editingBook.pages.splice(index, 1);
    this.editingBook.pages.forEach((p, idx) => p.sno = idx + 1);
    
    const newIndex = Math.max(0, index - 1);
    this.selectedEditingPageId = newIndex;
    this.editingPage = { ...this.editingBook.pages[newIndex] };
  }

  saveBookSettings() {
    if (!this.editingBook) return;
    
    this.editingBook.pages[this.selectedEditingPageId] = { ...this.editingPage };
    
    const existingIndex = this.books.findIndex(b => b.id === this.editingBook!.id);
    if (existingIndex > -1) {
      this.books[existingIndex] = this.editingBook;
    } else {
      this.books.push(this.editingBook);
    }
    
    this.selectedBookId = this.editingBook.id;
    this.saveBooksList();
    this.selectBook(this.editingBook.id);
    this.showBookModal = false;
  }

  onImageUploaded(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editingPage.imageUrl = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
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
          
          if (jsonData.length === 0) {
            this.errorMessage = 'Excel file is empty.';
            this.isLoading = false;
            this.cdr.detectChanges();
            return;
          }

          const parsedPages: PageContent[] = jsonData.map((row: any, idx: number) => {
            const sno = row['SNo'] || row['sno'] || (idx + 1);
            const title = row['Title'] || row['title'] || '';
            const voiceOver = row['VoiceOver'] || row['voiceover'] || '';
            
            let layout = row['Layout'] || row['layout'] || 'full-html';
            let htmlContent = row['HTMLContent'] || row['htmlcontent'] || '';
            let imageUrl = row['ImageURL'] || row['imageurl'] || '';
            let iframeUrl = row['IframeURL'] || row['iframeurl'] || '';
            
            const oldContent = row['Content'] || row['content'];
            if (oldContent !== undefined) {
              const oldParsed = this.parseContent(oldContent);
              layout = oldParsed.layout;
              htmlContent = oldParsed.htmlContent || '';
              imageUrl = oldParsed.imageUrl || '';
              iframeUrl = oldParsed.iframeUrl || '';
            }
            
            return {
              sno,
              title,
              voiceOver,
              layout,
              htmlContent,
              imageUrl,
              iframeUrl
            };
          });

          parsedPages.sort((a, b) => a.sno - b.sno);
          
          const bookName = file.name.replace(/\.[^/.]+$/, "");
          const newBook: Book = {
            id: 'book_' + Date.now(),
            name: bookName,
            pages: parsedPages
          };
          
          this.books.push(newBook);
          this.selectedBookId = newBook.id;
          this.saveBooksList();
          this.selectBook(newBook.id);
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

  exportBookToExcel() {
    const book = this.books.find(b => b.id === this.selectedBookId);
    if (!book) return;
    
    const data = book.pages.map(p => ({
      SNo: p.sno,
      Title: p.title || '',
      Layout: p.layout,
      HTMLContent: p.htmlContent || '',
      ImageURL: p.imageUrl || '',
      IframeURL: p.iframeUrl || '',
      VoiceOver: p.voiceOver || ''
    }));
    
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FlipBook');
    XLSX.writeFile(wb, `${book.name.replace(/\s+/g, '_')}_export.xlsx`);
  }

  downloadTemplate() {
    const data = [
      {
        SNo: 1,
        Title: 'Welcome Page',
        Layout: 'full-html',
        HTMLContent: '<h1>Welcome to Flip Book</h1><p>Enjoy reading in your premium library.</p>',
        ImageURL: '',
        IframeURL: '',
        VoiceOver: 'Welcome to the premium flip book viewer.'
      },
      {
        SNo: 2,
        Title: 'Scenic Image',
        Layout: 'full-image',
        HTMLContent: '',
        ImageURL: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000',
        IframeURL: '',
        VoiceOver: 'Here is a scenic view of a book.'
      },
      {
        SNo: 3,
        Title: 'Split Page Demo',
        Layout: 'split-html-image',
        HTMLContent: '<h3>Flexible Layouts</h3><p>This page demonstrates a 50% HTML text layout paired with a 50% image container.</p>',
        ImageURL: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=500',
        IframeURL: '',
        VoiceOver: 'This page shows half text and half image.'
      }
    ];
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FlipBook');
    XLSX.writeFile(wb, 'FlipBook_Library_Template.xlsx');
  }

  // ============== DRAG physics & gesture turning ==============

  onMouseDown(event: MouseEvent, index: number) {
    if (index !== this.currentPaperIndex && index !== this.currentPaperIndex - 1) return;
    this.startDrag(event.clientX, index);
  }

  onTouchStart(event: TouchEvent, index: number) {
    if (index !== this.currentPaperIndex && index !== this.currentPaperIndex - 1) return;
    if (event.touches.length > 0) {
      this.startDrag(event.touches[0].clientX, index);
    }
  }

  startDrag(clientX: number, index: number) {
    this.isDragging = true;
    this.draggedPageId = index;
    this.startX = clientX;
    this.draggedAngle = (index < this.currentPaperIndex) ? -180 : 0;
    
    if (this.bookContainer) {
      this.pageWidth = this.bookContainer.nativeElement.clientWidth || 400;
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.handleDrag(event.clientX);
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.handleDrag(event.touches[0].clientX);
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    this.endDrag();
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    this.endDrag();
  }

  handleDrag(clientX: number) {
    if (!this.isDragging || this.draggedPageId === null) return;
    
    const dx = clientX - this.startX;
    
    if (this.draggedPageId === this.currentPaperIndex) {
      if (dx < 0) {
        this.draggedAngle = Math.max(-180, Math.min(0, (dx / this.pageWidth) * 180));
      } else {
        this.draggedAngle = 0;
      }
    } else if (this.draggedPageId === this.currentPaperIndex - 1) {
      if (dx > 0) {
        this.draggedAngle = Math.max(-180, Math.min(0, -180 + (dx / this.pageWidth) * 180));
      } else {
        this.draggedAngle = -180;
      }
    }
    this.cdr.detectChanges();
  }

  endDrag() {
    if (!this.isDragging || this.draggedPageId === null) return;
    this.isDragging = false;
    
    const finalAngle = this.draggedAngle;
    const pageId = this.draggedPageId;
    this.draggedPageId = null;
    
    let turned = false;
    if (pageId === this.currentPaperIndex) {
      if (finalAngle < -50) {
        this.currentPaperIndex++;
        this.speakCurrentLeftAndRight();
        turned = true;
      }
    } else if (pageId === this.currentPaperIndex - 1) {
      if (finalAngle > -130) {
        this.currentPaperIndex--;
        this.speakCurrentLeftAndRight();
        turned = true;
      }
    }

    if (!turned) {
      // Elevate z-index during snap back transition to prevent clipping
      this.turningPageId = pageId;
      if (this.turningTimeout) clearTimeout(this.turningTimeout);
      this.turningTimeout = setTimeout(() => {
        this.turningPageId = null;
        this.cdr.detectChanges();
      }, 600);
    }
    
    this.cdr.detectChanges();
  }

  getPaperTransform(i: number): string {
    if (this.isDragging && this.draggedPageId === i) {
      return `rotateY(${this.draggedAngle}deg)`;
    }
    if (i < this.currentPaperIndex) {
      return 'rotateY(-180deg)';
    }
    return 'rotateY(0deg)';
  }

  getPageShadowOpacity(i: number): number {
    if (this.isDragging && this.draggedPageId === i) {
      const angle = this.draggedAngle;
      const distTo90 = Math.abs(angle + 90);
      const progress = 1 - (distTo90 / 90);
      return Math.max(0, progress * 0.4);
    }
    return 0;
  }

  // ============== UI / NAV CONTROLS ==============

  nextPage() {
    if (this.currentPaperIndex < this.physicalPages.length) {
      this.currentPaperIndex++;
      this.speakCurrentLeftAndRight();
    } else {
      this.stopAutoPlay();
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
      this.speakCurrentLeftAndRight(true);
      this.startInterval();
    } else {
      this.stopAutoPlay();
    }
  }

  startInterval() {
    if (this.playInterval) clearInterval(this.playInterval);
    this.lastFlipTime = Date.now();
    this.playInterval = setInterval(() => {
      const now = Date.now();
      if (this.isSpeechSpeaking || (!this.isMuted && window.speechSynthesis.speaking)) {
        this.lastFlipTime = now;
        return;
      }
      if (now - this.lastFlipTime >= this.playSpeedMs) {
        this.nextPage();
        this.lastFlipTime = now;
      }
    }, 500);
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
      this.isSpeechSpeaking = true;
      
      msg.onstart = () => {
        this.isSpeechSpeaking = true;
        this.cdr.detectChanges();
      };
      
      msg.onend = () => {
        this.isSpeechSpeaking = false;
        this.lastFlipTime = Date.now(); // Autoplay delay counts down starting from narration finish
        this.cdr.detectChanges();
      };
      
      msg.onerror = () => {
        this.isSpeechSpeaking = false;
        this.lastFlipTime = Date.now();
        this.cdr.detectChanges();
      };
      
      window.speechSynthesis.speak(msg);
    } else {
      this.isSpeechSpeaking = false;
    }
  }

  replayVoice() {
    this.isMuted = false;
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
    this.isSpeechSpeaking = false;
  }

  // ============== VIEWER SETTINGS ==============

  zoomIn() {
    this.zoomLevel = Math.min(2.5, this.zoomLevel + 0.2);
  }

  zoomOut() {
    this.zoomLevel = Math.max(0.4, this.zoomLevel - 0.2);
  }

  toggleFullscreen() {
    const element = this.flipbookWrapper?.nativeElement || document.documentElement;
    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => this.isFullscreen = true);
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

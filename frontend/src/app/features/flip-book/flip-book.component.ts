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

type VoiceTone = 'natural' | 'warm' | 'clear' | 'deep';

interface VoicePreferences {
  rate: number;
  pitch: number;
  tone: VoiceTone;
  voiceURI: string;
}

interface SpeechSegment {
  text: string;
  lang: string;
}

const VOICE_PREFERENCES_KEY = 'u2app_flipbook_voice_preferences_v1';

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
  isVoicePreviewing: boolean = false;
  availableVoices: SpeechSynthesisVoice[] = [];
  voiceRate: number = 1;
  voicePitch: number = 1;
  voiceTone: VoiceTone = 'natural';
  selectedVoiceURI: string = '';
  voiceAvailabilityMessage: string = '';
  private speechRunId = 0;
  private narrationAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly voicesChangedHandler = () => this.loadAvailableVoices();

  // Presentation & Autoplay state
  viewEffect: string = localStorage.getItem('u2app_view_effect') || 'flipbook';
  autoplayMode: 'duration' | 'narration' = (localStorage.getItem('u2app_autoplay_mode') as any) || 'duration';
  autoplayDurationMode: string = localStorage.getItem('u2app_autoplay_duration_mode') || '5s';
  customAutoplaySeconds: number = Number(localStorage.getItem('u2app_custom_autoplay_seconds')) || 7;

  private _currentPageIndex: number = 0;
  get currentPageIndex(): number {
    return this._currentPageIndex;
  }
  set currentPageIndex(val: number) {
    if (this.pages.length === 0) {
      this._currentPageIndex = 0;
      this.currentPaperIndex = 0;
      return;
    }
    const safeVal = Math.max(0, Math.min(this.pages.length - 1, val));
    this._currentPageIndex = safeVal;
    
    // Sync flip book index
    const paperIdx = Math.floor((safeVal + 1) / 2);
    if (this.currentPaperIndex !== paperIdx) {
      this.currentPaperIndex = paperIdx;
    }
  }

  // Touch Swipe state
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private isSwiping: boolean = false;

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

      // Sync currentPageIndex:
      const targetPageIdx = Math.max(0, val * 2 - 1);
      if (this._currentPageIndex !== targetPageIdx) {
        this._currentPageIndex = targetPageIdx;
      }
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

  // Bottom bar state
  showBottomBar: boolean = localStorage.getItem('u2app_show_bottom_bar') !== 'false';

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
    this.updatePlaySpeed();
    this.loadVoicePreferences();
    this.loadAvailableVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', this.voicesChangedHandler);
    }
  }

  ngOnDestroy() {
    this.stopAutoPlay();
    this.stopSpeaking();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.removeEventListener('voiceschanged', this.voicesChangedHandler);
    }
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
    this._currentPageIndex = 0;
    this._currentPaperIndex = 0;
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
    if (this.viewEffect === 'flipbook') {
      if (this.currentPaperIndex < this.physicalPages.length) {
        this.currentPaperIndex++;
        this.speakCurrentLeftAndRight();
      } else {
        this.stopAutoPlay();
      }
    } else {
      if (this.currentPageIndex < this.pages.length - 1) {
        this.currentPageIndex++;
        this.speakCurrentLeftAndRight();
      } else {
        this.stopAutoPlay();
      }
    }
  }

  prevPage() {
    if (this.viewEffect === 'flipbook') {
      if (this.currentPaperIndex > 0) {
        this.currentPaperIndex--;
        this.speakCurrentLeftAndRight();
      }
    } else {
      if (this.currentPageIndex > 0) {
        this.currentPageIndex--;
        this.speakCurrentLeftAndRight();
      }
    }
  }

  firstPage() {
    if (this.viewEffect === 'flipbook') {
      this.currentPaperIndex = 0;
    } else {
      this.currentPageIndex = 0;
    }
    this.speakCurrentLeftAndRight();
  }

  lastPage() {
    if (this.viewEffect === 'flipbook') {
      this.currentPaperIndex = this.physicalPages.length;
    } else {
      this.currentPageIndex = this.pages.length - 1;
    }
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
      
      if (this.autoplayMode === 'narration') {
        return; 
      }
      
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
    
    let fullVoice = '';
    if (this.viewEffect === 'flipbook') {
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
      fullVoice = (leftVoice + " ... " + rightVoice).trim();
    } else {
      if (this.currentPageIndex >= 0 && this.currentPageIndex < this.pages.length) {
        const page = this.pages[this.currentPageIndex];
        if (page.voiceOver) {
          fullVoice = page.voiceOver.trim();
        }
      }
    }

    if (fullVoice && fullVoice !== "...") {
      this.speakSegments(this.segmentByLanguage(fullVoice), false, () => {
        this.lastFlipTime = Date.now();
        if (this.isPlaying && this.autoplayMode === 'narration') {
          this.scheduleNarrationAdvance(500);
        }
      });
    } else {
      this.isSpeechSpeaking = false;
      
      // Fallback if autoplay is narration-based and page has no narration
      if (this.isPlaying && this.autoplayMode === 'narration') {
        this.scheduleNarrationAdvance(this.playSpeedMs);
      }
    }
  }

  previewVoiceSettings() {
    this.stopSpeaking();
    const sample = 'இது தமிழ் குரல் முன்னோட்டம். This is an English voice preview.';
    this.speakSegments(this.segmentByLanguage(sample), true);
  }

  onVoicePreferenceChange() {
    this.voiceRate = this.clamp(Number(this.voiceRate), 0.5, 2);
    this.voicePitch = this.clamp(Number(this.voicePitch), 0.5, 1.5);
    this.saveVoicePreferences();
  }

  private speakSegments(
    segments: SpeechSegment[],
    preview: boolean,
    onComplete?: () => void,
  ) {
    if (!('speechSynthesis' in window) || segments.length === 0) {
      onComplete?.();
      return;
    }
    if (this.availableVoices.length === 0) this.loadAvailableVoices();

    const runId = ++this.speechRunId;
    window.speechSynthesis.cancel();
    this.isSpeechSpeaking = true;
    this.isVoicePreviewing = preview;
    this.cdr.detectChanges();

    const speakAt = (index: number) => {
      if (runId !== this.speechRunId) return;
      if (index >= segments.length) {
        this.isSpeechSpeaking = false;
        this.isVoicePreviewing = false;
        this.cdr.detectChanges();
        onComplete?.();
        return;
      }

      const segment = segments[index];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = segment.lang;
      utterance.voice = this.selectVoiceForLanguage(segment.lang);
      const tone = this.getToneAdjustments();
      utterance.rate = this.clamp(this.voiceRate * tone.rate, 0.5, 2);
      utterance.pitch = this.clamp(this.voicePitch + tone.pitch, 0.5, 1.5);
      utterance.volume = 1;
      utterance.onend = () => speakAt(index + 1);
      utterance.onerror = (event) => {
        if (runId !== this.speechRunId || event.error === 'canceled' || event.error === 'interrupted') {
          return;
        }
        speakAt(index + 1);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakAt(0);
  }

  private segmentByLanguage(text: string): SpeechSegment[] {
    const segments: SpeechSegment[] = [];
    let activeLanguage = '';
    let buffer = '';

    for (const character of text) {
      const characterLanguage = this.detectCharacterLanguage(character);
      if (characterLanguage && activeLanguage && characterLanguage !== activeLanguage) {
        this.pushSpeechSegment(segments, buffer, activeLanguage);
        buffer = '';
      }
      if (characterLanguage) activeLanguage = characterLanguage;
      buffer += character;
    }
    this.pushSpeechSegment(segments, buffer, activeLanguage || 'en-IN');
    return segments;
  }

  private detectCharacterLanguage(character: string): string | null {
    const codePoint = character.codePointAt(0) || 0;
    const scriptRanges: Array<[number, number, string]> = [
      [0x0b80, 0x0bff, 'ta-IN'],
      [0x0900, 0x097f, 'hi-IN'],
      [0x0980, 0x09ff, 'bn-IN'],
      [0x0a00, 0x0a7f, 'pa-IN'],
      [0x0a80, 0x0aff, 'gu-IN'],
      [0x0b00, 0x0b7f, 'or-IN'],
      [0x0c00, 0x0c7f, 'te-IN'],
      [0x0c80, 0x0cff, 'kn-IN'],
      [0x0d00, 0x0d7f, 'ml-IN'],
      [0x0d80, 0x0dff, 'si-LK'],
      [0x0600, 0x06ff, 'ar-SA'],
      [0x0400, 0x04ff, 'ru-RU'],
      [0x3040, 0x30ff, 'ja-JP'],
      [0x4e00, 0x9fff, 'zh-CN'],
      [0xac00, 0xd7af, 'ko-KR'],
    ];
    const range = scriptRanges.find(([start, end]) => codePoint >= start && codePoint <= end);
    if (range) return range[2];
    return /\p{L}/u.test(character) ? 'en-IN' : null;
  }

  private pushSpeechSegment(
    segments: SpeechSegment[],
    text: string,
    lang: string,
  ) {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText || !/[\p{L}\p{N}]/u.test(cleanText)) return;

    let remaining = cleanText;
    while (remaining.length > 220) {
      const candidate = remaining.slice(0, 220);
      const sentenceBreak = Math.max(
        candidate.lastIndexOf('.'),
        candidate.lastIndexOf('!'),
        candidate.lastIndexOf('?'),
        candidate.lastIndexOf('।'),
      );
      const wordBreak = candidate.lastIndexOf(' ');
      const splitAt = sentenceBreak >= 80 ? sentenceBreak + 1 : wordBreak >= 80 ? wordBreak : 220;
      segments.push({ text: remaining.slice(0, splitAt).trim(), lang });
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) segments.push({ text: remaining, lang });
  }

  private selectVoiceForLanguage(lang: string): SpeechSynthesisVoice | null {
    const language = lang.split('-')[0].toLowerCase();
    const matchingVoices = this.availableVoices.filter((voice) =>
      voice.lang.toLowerCase().startsWith(language),
    );
    const preferred = this.availableVoices.find(
      (voice) => voice.voiceURI === this.selectedVoiceURI && voice.lang.toLowerCase().startsWith(language),
    );
    if (preferred) return preferred;

    return matchingVoices.sort((a, b) => this.voiceQualityScore(b, lang) - this.voiceQualityScore(a, lang))[0] || null;
  }

  private voiceQualityScore(voice: SpeechSynthesisVoice, lang: string): number {
    const descriptor = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    let score = voice.lang.toLowerCase() === lang.toLowerCase() ? 20 : 0;
    if (/natural|neural|premium|enhanced|google|microsoft|apple/.test(descriptor)) score += 10;
    if (!voice.localService) score += 2;
    return score;
  }

  private getToneAdjustments(): { rate: number; pitch: number } {
    const tones: Record<VoiceTone, { rate: number; pitch: number }> = {
      natural: { rate: 1, pitch: 0 },
      warm: { rate: 0.94, pitch: 0.08 },
      clear: { rate: 0.9, pitch: 0.03 },
      deep: { rate: 0.92, pitch: -0.18 },
    };
    return tones[this.voiceTone];
  }

  private loadAvailableVoices() {
    if (!('speechSynthesis' in window)) {
      this.voiceAvailabilityMessage = 'Voice narration is not supported in this browser.';
      return;
    }
    this.availableVoices = [...window.speechSynthesis.getVoices()].sort((a, b) =>
      `${a.lang} ${a.name}`.localeCompare(`${b.lang} ${b.name}`),
    );
    const hasTamilVoice = this.availableVoices.some((voice) => voice.lang.toLowerCase().startsWith('ta'));
    this.voiceAvailabilityMessage = hasTamilVoice
      ? 'Tamil voice available. Languages are selected automatically.'
      : 'No Tamil voice is installed. Add a Tamil system voice for natural Tamil narration.';
    if (this.selectedVoiceURI && !this.availableVoices.some((voice) => voice.voiceURI === this.selectedVoiceURI)) {
      this.selectedVoiceURI = '';
      this.saveVoicePreferences();
    }
    this.cdr.detectChanges();
  }

  private loadVoicePreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(VOICE_PREFERENCES_KEY) || '{}') as Partial<VoicePreferences>;
      this.voiceRate = this.clamp(Number(saved.rate ?? 1), 0.5, 2);
      this.voicePitch = this.clamp(Number(saved.pitch ?? 1), 0.5, 1.5);
      this.voiceTone = ['natural', 'warm', 'clear', 'deep'].includes(saved.tone || '')
        ? saved.tone as VoiceTone
        : 'natural';
      this.selectedVoiceURI = saved.voiceURI || '';
    } catch {
      localStorage.removeItem(VOICE_PREFERENCES_KEY);
    }
  }

  private saveVoicePreferences() {
    const preferences: VoicePreferences = {
      rate: this.voiceRate,
      pitch: this.voicePitch,
      tone: this.voiceTone,
      voiceURI: this.selectedVoiceURI,
    };
    localStorage.setItem(VOICE_PREFERENCES_KEY, JSON.stringify(preferences));
  }

  private scheduleNarrationAdvance(delay: number) {
    if (this.narrationAdvanceTimer) clearTimeout(this.narrationAdvanceTimer);
    this.narrationAdvanceTimer = setTimeout(() => {
      this.narrationAdvanceTimer = null;
      if (this.isPlaying && this.autoplayMode === 'narration') this.nextPage();
    }, delay);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
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
    this.speechRunId++;
    if (this.narrationAdvanceTimer) {
      clearTimeout(this.narrationAdvanceTimer);
      this.narrationAdvanceTimer = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.isSpeechSpeaking = false;
    this.isVoicePreviewing = false;
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

  toggleBottomBar() {
    this.showBottomBar = !this.showBottomBar;
    localStorage.setItem('u2app_show_bottom_bar', String(this.showBottomBar));
  }

  setViewEffect(effect: string) {
    this.viewEffect = effect;
    localStorage.setItem('u2app_view_effect', effect);
    this.cdr.detectChanges();
  }

  setAutoplayMode(mode: 'duration' | 'narration') {
    this.autoplayMode = mode;
    localStorage.setItem('u2app_autoplay_mode', mode);
    if (this.isPlaying) {
      this.startInterval();
    }
  }

  setAutoplayDurationMode(mode: string) {
    this.autoplayDurationMode = mode;
    localStorage.setItem('u2app_autoplay_duration_mode', mode);
    this.updatePlaySpeed();
  }

  setCustomAutoplaySeconds(sec: number) {
    this.customAutoplaySeconds = sec;
    localStorage.setItem('u2app_custom_autoplay_seconds', String(sec));
    this.updatePlaySpeed();
  }

  updatePlaySpeed() {
    if (this.autoplayDurationMode === 'custom') {
      this.playSpeedMs = this.customAutoplaySeconds * 1000;
    } else {
      this.playSpeedMs = parseInt(this.autoplayDurationMode) * 1000;
    }
    if (this.isPlaying) {
      this.startInterval();
    }
  }

  onSwipeStart(event: MouseEvent | TouchEvent) {
    if (this.viewEffect === 'flipbook') return;
    this.isSwiping = true;
    const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;
    this.swipeStartX = clientX;
    this.swipeStartY = clientY;
  }

  onSwipeEnd(event: MouseEvent | TouchEvent) {
    if (!this.isSwiping) return;
    this.isSwiping = false;

    let clientX = 0;
    let clientY = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      return;
    }

    const dx = clientX - this.swipeStartX;
    const dy = clientY - this.swipeStartY;
    const threshold = 50;

    if (this.viewEffect === 'vertical-scroll') {
      if (dy < -threshold) {
        this.nextPage();
      } else if (dy > threshold) {
        this.prevPage();
      }
    } else {
      if (dx < -threshold) {
        this.nextPage();
      } else if (dx > threshold) {
        this.prevPage();
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      this.nextPage();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      this.prevPage();
    } else if (event.key === 'Home') {
      this.firstPage();
    } else if (event.key === 'End') {
      this.lastPage();
    }
  }
}

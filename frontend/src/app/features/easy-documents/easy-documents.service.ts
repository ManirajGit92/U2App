import { Injectable, inject, signal, effect } from '@angular/core';
import { read, utils, writeFile } from 'xlsx';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FirebaseAuthService } from '../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../core/services/firebase-sync.service';

export interface DocSection {
  id: string;
  uniqueId: string;
  heading?: string;
  subheading?: string;
  category?: string;
  subcategory?: string;
  content: string;
  carouselImage?: string;
  code?: string;
  note?: string;
  iframe?: string;
  
  // Legacy support
  codeBlock?: string;
  notes?: string;
  mediaUrl?: string;
  mermaid?: string;
}

export interface DocPage {
  name: string;
  sections: DocSection[];
}

export interface DocConfig {
  title: string;
  purpose: string;
  author?: string;
  version?: string;
  lastUpdated?: string;
}

export interface ColumnMapping {
  uniqueId: string;
  category: string;
  subcategory: string;
  content: string;
  carouselImage: string;
  code: string;
  note: string;
  iframe: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  uniqueId: 'uniqueId',
  category: 'category',
  subcategory: 'subcategory',
  content: 'content',
  carouselImage: 'carouselImage',
  code: 'code',
  note: 'note',
  iframe: 'iframe'
};

@Injectable({
  providedIn: 'root',
})
export class EasyDocumentsService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  config = signal<DocConfig | null>(null);
  pages = signal<DocPage[]>([]);
  currentPageIndex = signal<number>(0);
  currentLanguage = signal<'en' | 'ta'>('en');
  isDarkMode = signal<boolean>(false);
  searchQuery = signal<string>('');

  filteredPages = signal<DocPage[]>([]);
  isSidebarOpenMobile = signal<boolean>(false);

  // States
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  parsingErrors = signal<string[]>([]);
  syncStatus = signal<'offline' | 'syncing' | 'synced' | 'failed'>('offline');

  private translations: Record<string, Record<'en' | 'ta', string>> = {
    'Search...': { en: 'Search...', ta: 'தேடல்...' },
    'Upload 📤': { en: 'Upload 📤', ta: 'பதிவேற்று 📤' },
    'Export ⬇️': { en: 'Export ⬇️', ta: 'ஏற்றுமதி ⬇️' },
    'PDF': { en: 'PDF', ta: 'பிடிஎஃப்' },
    'Word': { en: 'Word', ta: 'வேர்ட்' },
    'Documentation': { en: 'Documentation', ta: 'ஆவணம்' },
    'Navigation': { en: 'Navigation', ta: 'வழிசெலுத்தல்' },
    'Welcome to Easy Documents': { en: 'Welcome to Easy Documents', ta: 'ஈஸி டாக்குமென்ட்ஸிற்கு வரவேற்கிறோம்' },
    'Download Template': { en: 'Download Template', ta: 'மாதிரியைப் பதிவிறக்கவும்' },
    'Select Excel File': { en: 'Select Excel File', ta: 'எக்செல் கோப்பைத் தேர்ந்தெடுக்கவும்' },
    'Copy': { en: 'Copy', ta: 'நகலெடு' },
    'Code copied to clipboard!': { en: 'Code copied to clipboard!', ta: 'குறியீடு நகலெடுக்கப்பட்டது!' },
    'Note:': { en: 'Note:', ta: 'குறிப்பு:' },
  };

  t(key: string): string {
    const lang = this.currentLanguage();
    return this.translations[key]?.[lang] || key;
  }

  private synth = window.speechSynthesis;

  constructor() {
    // 1. Initial Load: Load local storage if present
    const loadedLocal = this.loadLocalState();
    if (!loadedLocal) {
      this.loadDefaultContent();
    }

    // 2. Auth state reactions
    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.syncStatus.set('syncing');
        this.loadFromFirestore(uid).catch((err) => {
          console.error('EasyDocumentsService: Failed to pull cloud sync', err);
          this.syncStatus.set('failed');
        });
      } else {
        this.syncStatus.set('offline');
      }
    });

    // 3. Save local changes automatically
    effect(() => {
      this.saveLocalState();
    });
  }

  loadDefaultContent() {
    const defaultPage: DocPage = {
      name: 'Welcome',
      sections: [
        {
          id: 'welcome-1',
          uniqueId: 'welcome-1',
          heading: 'Welcome to Easy Documents',
          category: 'Welcome to Easy Documents',
          subheading: 'Get Started with your documentation',
          subcategory: 'Get Started',
          content: 'This application allows you to transform Excel files into interactive, high-quality documentation. <br><br> To begin, <b>Download the Template</b> from the upload screen, fill in your content, and upload it back!',
          note: 'You can also export your documentation to PDF and Word anytime.',
          notes: 'You can also export your documentation to PDF and Word anytime.',
          mermaid: 'graph TD\nA[Excel File] -->|Upload| B(Easy Docs)\nB --> C[Interactive UI]\nB --> D[PDF/Word Export]'
        },
        {
          id: 'welcome-2',
          uniqueId: 'welcome-2',
          heading: 'Core Features',
          category: 'Core Features',
          subheading: 'What you can do',
          subcategory: 'Features',
          content: 'The application supports rich text, code snippets, diagrams, and multimedia embeds.',
          codeBlock: '// Example Code Snippet\nfunction helloWorld() {\n  console.log("Welcome to Easy Docs!");\n}',
          code: '// Example Code Snippet\nfunction helloWorld() {\n  console.log("Welcome to Easy Docs!");\n}',
        }
      ]
    };

    this.config.set({
      title: 'Easy Documents',
      purpose: 'Generate professional documentation from Excel files',
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    });
    this.pages.set([defaultPage]);
    this.filteredPages.set([defaultPage]);
    this.currentPageIndex.set(0);
  }

  private loadLocalState(): boolean {
    try {
      const data = localStorage.getItem('u2app.easyDocsState');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.config) this.config.set(parsed.config);
        if (parsed.pages) {
          this.pages.set(parsed.pages);
          this.filteredPages.set(parsed.pages);
        }
        if (parsed.currentPageIndex !== undefined) this.currentPageIndex.set(parsed.currentPageIndex);
        if (parsed.currentLanguage) this.currentLanguage.set(parsed.currentLanguage);
        if (parsed.isDarkMode !== undefined) this.isDarkMode.set(parsed.isDarkMode);
        return true;
      }
    } catch (e) {
      console.error('Failed to load local storage state', e);
    }
    return false;
  }

  saveLocalState() {
    try {
      const state = {
        config: this.config(),
        pages: this.pages(),
        currentPageIndex: this.currentPageIndex(),
        currentLanguage: this.currentLanguage(),
        isDarkMode: this.isDarkMode()
      };
      localStorage.setItem('u2app.easyDocsState', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  async syncToFirebase() {
    const uid = this.syncService.getUid();
    if (!uid) {
      this.syncStatus.set('offline');
      return;
    }
    this.syncStatus.set('syncing');
    try {
      const appDoc = {
        config: this.config(),
        currentPageIndex: this.currentPageIndex(),
        currentLanguage: this.currentLanguage(),
        isDarkMode: this.isDarkMode(),
        lastUpdated: new Date().toISOString()
      };
      await this.syncService.pushDocumentToFirestore('easy-documents', appDoc as any);
      await this.syncService.pushToFirestore('easy-documents', 'pages', this.pages() as any);
      this.syncStatus.set('synced');
    } catch (e) {
      console.error('EasyDocumentsService: pushToFirestore failed', e);
      this.syncStatus.set('failed');
    }
  }

  async loadFromFirestore(uid: string) {
    try {
      const appDocPath = `users/${uid}/apps/easy-documents`;
      const cloudAppDoc = await this.syncService.pullFromFirestore<any>('easy-documents', 'config_meta') as any; // fallback check or direct
      const cloudConfig = await this.authService['firestoreService'].getDocument<any>(appDocPath);

      if (cloudConfig) {
        // Resolve potential conflicts using timestamp merge
        const localLastUpdated = this.config()?.lastUpdated ? new Date(this.config()!.lastUpdated!).getTime() : 0;
        const cloudLastUpdated = cloudConfig.lastUpdated ? new Date(cloudConfig.lastUpdated).getTime() : 0;

        if (cloudLastUpdated >= localLastUpdated) {
          const pages = await this.syncService.pullFromFirestore<DocPage>('easy-documents', 'pages');
          if (pages.length > 0) {
            this.config.set(cloudConfig.config);
            this.pages.set(pages);
            this.filteredPages.set(pages);
            this.currentPageIndex.set(cloudConfig.currentPageIndex || 0);
            this.currentLanguage.set(cloudConfig.currentLanguage || 'en');
            this.isDarkMode.set(cloudConfig.isDarkMode || false);
            this.saveLocalState();
            this.syncStatus.set('synced');
            console.log('EasyDocumentsService: restored cloud state');
            return;
          }
        }
      }

      // If cloud is empty/older but we have local pages, push them to Firestore
      if (this.pages().length > 0) {
        await this.syncToFirebase();
      } else {
        this.syncStatus.set('synced');
      }
    } catch (err) {
      console.error('EasyDocumentsService: Failed to pull cloud data', err);
      this.syncStatus.set('failed');
    }
  }

  async parseExcel(file: File): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.parsingErrors.set([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);

      if (workbook.SheetNames.length === 0) {
        throw new Error('Excel workbook is empty.');
      }

      const errors: string[] = [];

      // The first sheet is configuration
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const configJson = utils.sheet_to_json(firstSheet) as any[];

      const firstRow = configJson[0] || {};
      const config: DocConfig = {
        title: firstSheetName,
        purpose: this.getRowVal(firstRow, ['Sheet purpose', 'purpose', 'description']) || 'Documentation',
        author: this.getRowVal(firstRow, ['Author']),
        version: this.getRowVal(firstRow, ['Version']),
        lastUpdated: new Date().toISOString()
      };

      // Extract referenced sheet mappings and list
      const mappings: Record<string, ColumnMapping> = {};
      const referencedSheets: string[] = [];

      configJson.forEach((row, i) => {
        let sheetNameVal = '';
        Object.keys(row).forEach(k => {
          const val = String(row[k]).trim();
          if (workbook.SheetNames.includes(val) && val !== firstSheetName) {
            sheetNameVal = val;
          }
        });

        if (sheetNameVal) {
          if (!referencedSheets.includes(sheetNameVal)) {
            referencedSheets.push(sheetNameVal);
          }
          mappings[sheetNameVal] = {
            uniqueId: this.getRowVal(row, ['uniqueId', 'id_col', 'id']),
            category: this.getRowVal(row, ['category', 'category_col', 'cat']),
            subcategory: this.getRowVal(row, ['subcategory', 'subcategory_col', 'subcat']),
            content: this.getRowVal(row, ['content', 'content_col', 'text']),
            carouselImage: this.getRowVal(row, ['carouselImage', 'images_col', 'images', 'carousel']),
            code: this.getRowVal(row, ['code', 'code_col', 'codeBlock']),
            note: this.getRowVal(row, ['note', 'notes_col', 'notes', 'highlights']),
            iframe: this.getRowVal(row, ['iframe', 'iframe_col', 'url', 'mediaUrl'])
          };
        }
      });

      // Default sheets to process
      const sheetsToProcess = referencedSheets.length > 0 ? referencedSheets : workbook.SheetNames.slice(1);

      const pages: DocPage[] = [];

      sheetsToProcess.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          errors.push(`Referenced sheet "${sheetName}" does not exist in the workbook.`);
          return;
        }

        const jsonData = utils.sheet_to_json(sheet) as any[];
        const mapping = mappings[sheetName] || DEFAULT_MAPPING;
        const ids = new Set<string>();

        // Validate structure
        jsonData.forEach((row, rowIndex) => {
          const rowNum = rowIndex + 2; // 1-indexed header + 1
          const uniqueId = this.getMappedVal(row, mapping, 'uniqueId', ['uniqueId', 'id']);
          
          if (!uniqueId) {
            errors.push(`Sheet "${sheetName}", Row ${rowNum}: Missing required "uniqueId" value.`);
          } else if (ids.has(uniqueId)) {
            errors.push(`Sheet "${sheetName}", Row ${rowNum}: Duplicate "uniqueId" value "${uniqueId}" found.`);
          } else {
            ids.add(uniqueId);
          }
        });

        if (errors.length === 0) {
          const sections: DocSection[] = jsonData.map((row, i) => {
            const uniqueId = this.getMappedVal(row, mapping, 'uniqueId', ['uniqueId', 'id']);
            const category = this.getMappedVal(row, mapping, 'category', ['category', 'heading']);
            const subcategory = this.getMappedVal(row, mapping, 'subcategory', ['subcategory', 'subheading']);
            const content = this.getMappedVal(row, mapping, 'content', ['content']);
            const carouselImage = this.getMappedVal(row, mapping, 'carouselImage', ['carouselImage', 'images']);
            const code = this.getMappedVal(row, mapping, 'code', ['code', 'codeBlock']);
            const note = this.getMappedVal(row, mapping, 'note', ['note', 'notes', 'highlights']);
            const iframe = this.getMappedVal(row, mapping, 'iframe', ['iframe', 'url', 'mediaUrl']);

            return {
              id: uniqueId,
              uniqueId,
              heading: category,
              subheading: subcategory,
              category,
              subcategory,
              content,
              carouselImage,
              code,
              note,
              iframe,
              codeBlock: code,
              notes: note,
              mediaUrl: iframe
            };
          });

          pages.push({
            name: sheetName,
            sections
          });
        }
      });

      if (errors.length > 0) {
        this.parsingErrors.set(errors);
        throw new Error('Workbook structure validation failed.');
      }

      if (pages.length > 0) {
        this.config.set(config);
        this.pages.set(pages);
        this.filteredPages.set(pages);
        this.currentPageIndex.set(0);
        this.saveLocalState();
        await this.syncToFirebase();
        console.log('Excel parsed and synced successfully.');
      } else {
        throw new Error('No valid content sheets found in Excel file.');
      }
    } catch (error: any) {
      console.error('Error parsing Excel file:', error);
      this.errorMessage.set(error.message || 'Failed to parse Excel file.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private getRowVal(row: any, targetKeys: string[]): string {
    const keys = Object.keys(row);
    const foundKey = keys.find(k =>
      targetKeys.some(tk => k.toLowerCase().trim() === tk.toLowerCase())
    );
    return foundKey ? String(row[foundKey]).trim() : '';
  }

  private getMappedVal(row: any, mapping: ColumnMapping, field: keyof ColumnMapping, fallbacks: string[]): string {
    const customKey = mapping[field];
    if (customKey && row[customKey] !== undefined) {
      return String(row[customKey]).trim();
    }
    return this.getRowVal(row, fallbacks);
  }

  setSearchQuery(query: string) {
    this.searchQuery.set(query.toLowerCase());
    if (!query) {
      this.filteredPages.set(this.pages());
      return;
    }

    const filtered = this.pages().map(page => ({
      ...page,
      sections: page.sections.filter(s =>
        (s.category && s.category.toLowerCase().includes(query.toLowerCase())) ||
        (s.subcategory && s.subcategory.toLowerCase().includes(query.toLowerCase())) ||
        (s.content && s.content.toLowerCase().includes(query.toLowerCase())) ||
        (s.note && s.note.toLowerCase().includes(query.toLowerCase()))
      )
    })).filter(p => p.sections.length > 0);

    this.filteredPages.set(filtered);
  }

  downloadTemplate() {
    const wb = utils.book_new();

    // Configuration sheet with custom mapping schema
    const configWS = utils.json_to_sheet([
      {
        'Sheet purpose': 'Demo Dynamic Website Generator',
        'Author': 'Administrator',
        'Version': '1.0',
        'Last Updated': new Date().toLocaleDateString(),
        'Page Reference': 'Website View',
        'uniqueId': 'ID',
        'category': 'Section',
        'subcategory': 'Sub-Section',
        'content': 'Page Content',
        'carouselImage': 'Carousel Images',
        'code': 'Code Snippet',
        'note': 'Highlight Notes',
        'iframe': 'Media Frame'
      },
      {
        'Sheet purpose': 'Demo Dynamic Website Generator',
        'Author': 'Administrator',
        'Version': '1.0',
        'Last Updated': new Date().toLocaleDateString(),
        'Page Reference': 'API Docs',
        'uniqueId': 'uniqueId',
        'category': 'category',
        'subcategory': 'subcategory',
        'content': 'content',
        'carouselImage': 'carouselImage',
        'code': 'code',
        'note': 'note',
        'iframe': 'iframe'
      }
    ]);
    utils.book_append_sheet(wb, configWS, 'Configuration');

    // Dynamic Sheet 1: Website View (uses custom mappings from Configuration Row 1)
    const viewWS = utils.json_to_sheet([
      {
        'ID': 'id-1',
        'Section': 'Overview',
        'Sub-Section': 'Introduction',
        'Page Content': 'Welcome to the <b>Excel-Driven Dynamic Portal</b>. This site is completely configured by the Excel sheets.',
        'Carousel Images': 'https://picsum.photos/id/1/800/400,https://picsum.photos/id/2/800/400',
        'Code Snippet': 'const app = "Dynamic App";',
        'Highlight Notes': '[Success] Dynamic Website successfully parsed from Excel sheets!',
        'Media Frame': 'https://www.youtube.com/embed/dQw4w9WgXcQ'
      }
    ]);
    utils.book_append_sheet(wb, viewWS, 'Website View');

    // Dynamic Sheet 2: API Docs (uses standard mapping columns)
    const apiWS = utils.json_to_sheet([
      {
        'uniqueId': 'api-auth',
        'category': 'Authentication',
        'subcategory': 'API Key',
        'content': 'To authenticate requests, pass the <code>X-API-Key</code> header with your requests.',
        'carouselImage': '',
        'code': 'curl -H "X-API-Key: custom_key" https://api.site.com/docs',
        'note': '[Warning] Keep your API Key secure. Do not share it.',
        'iframe': ''
      }
    ]);
    utils.book_append_sheet(wb, apiWS, 'API Docs');

    writeFile(wb, `EasyDocs_Config_Template.xlsx`);
  }

  toggleSidebarMobile() {
    this.isSidebarOpenMobile.update(s => !s);
  }

  async exportToPDF() {
    const doc = new jsPDF();
    const config = this.config();
    const pages = this.pages();

    doc.setFontSize(22);
    doc.text(config?.title || 'Documentation', 20, 20);
    doc.setFontSize(12);
    doc.text(`Author: ${config?.author || 'N/A'}`, 20, 30);
    doc.text(`Version: ${config?.version || '1.0'}`, 20, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 40);

    let yOffset = 50;

    pages.forEach((page) => {
      doc.addPage();
      doc.setFontSize(18);
      doc.text(page.name, 20, 20);

      page.sections.forEach((section) => {
        const bodyContent = [
          [section.category || section.heading || ''],
          [section.subcategory || section.subheading || ''],
          [section.content.replace(/<[^>]*>/g, '') || ''],
          [section.note ? `Note: ${section.note}` : '']
        ].filter(r => r[0] !== '');

        autoTable(doc, {
          startY: yOffset,
          body: bodyContent,
          margin: { left: 20 },
          styles: { fontSize: 10 },
          theme: 'plain'
        });

        yOffset = (doc as any).lastAutoTable.finalY + 10;
        if (yOffset > 250) {
          doc.addPage();
          yOffset = 20;
        }
      });
      yOffset = 20;
    });

    doc.save(`${config?.title || 'Documentation'}.pdf`);
  }

  async exportToWord() {
    const pages = this.pages();
    const sections: any[] = [];

    pages.forEach(page => {
      sections.push(
        new Paragraph({
          text: page.name,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      page.sections.forEach(sec => {
        const title = sec.category || sec.heading;
        const sub = sec.subcategory || sec.subheading;
        if (title) {
          sections.push(new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }));
        }
        if (sub) {
          sections.push(new Paragraph({
            text: sub,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 100, after: 100 }
          }));
        }
        sections.push(new Paragraph({
          children: [
            new TextRun({
              text: sec.content.replace(/<[^>]*>/g, ''),
              size: 24,
            }),
          ],
          spacing: { after: 200 }
        }));
        if (sec.note) {
          sections.push(new Paragraph({
            children: [
              new TextRun({
                text: `Note: ${sec.note}`,
                italics: true,
                color: '666666'
              })
            ],
            spacing: { after: 200 }
          }));
        }
        if (sec.code) {
          sections.push(new Paragraph({
            children: [
              new TextRun({
                text: sec.code,
                font: 'Courier New',
                size: 20,
              })
            ],
            shading: { fill: 'EEEEEE' },
            spacing: { before: 100, after: 200 }
          }));
        }
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: sections,
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.href = url;
    a.download = `${this.config()?.title || 'Documentation'}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  speak(text: string, lang: 'en' | 'ta' = 'en') {
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    this.synth.speak(utterance);
  }

  stopSpeaking() {
    this.synth.cancel();
  }

  toggleLanguage() {
    this.currentLanguage.update(l => l === 'en' ? 'ta' : 'en');
  }

  toggleDarkMode() {
    this.isDarkMode.update(d => !d);
  }
}

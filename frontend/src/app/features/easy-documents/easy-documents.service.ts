
import { Injectable, signal } from '@angular/core';
import { read, utils, writeFile } from 'xlsx';
import { Packer, Document, Paragraph, TextRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DocSection {
  id: string;
  heading: string;
  subheading: string;
  content: string;
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

@Injectable({
  providedIn: 'root',
})
export class EasyDocumentsService {
  config = signal<DocConfig | null>(null);
  pages = signal<DocPage[]>([]);
  currentPageIndex = signal<number>(0);
  currentLanguage = signal<'en' | 'ta'>('en');
  isDarkMode = signal<boolean>(false);
  searchQuery = signal<string>('');

  filteredPages = signal<DocPage[]>([]);
  isSidebarOpenMobile = signal<boolean>(false);

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
    this.loadDefaultContent();
  }

  loadDefaultContent() {
    const defaultPage: DocPage = {
      name: 'Welcome',
      sections: [
        {
          id: 'welcome-1',
          heading: 'Welcome to Easy Documents',
          subheading: 'Get Started with your documentation',
          content: 'This application allows you to transform Excel files into interactive, high-quality documentation. <br><br> To begin, <b>Download the Template</b> from the upload screen, fill in your content, and upload it back!',
          notes: 'You can also export your documentation to PDF and Word anytime.',
          mermaid: 'graph TD\nA[Excel File] -->|Upload| B(Easy Docs)\nB --> C[Interactive UI]\nB --> D[PDF/Word Export]'
        },
        {
          id: 'welcome-2',
          heading: 'Core Features',
          subheading: 'What you can do',
          content: 'The application supports rich text, code snippets, diagrams, and multimedia embeds.',
          codeBlock: '// Example Code Snippet\nfunction helloWorld() {\n  console.log("Welcome to Easy Docs!");\n}',
        }
      ]
    };

    this.config.set({
      title: 'Easy Documents',
      purpose: 'Generate professional documentation from Excel files',
      version: '1.0.0'
    });
    this.pages.set([defaultPage]);
    this.filteredPages.set([defaultPage]);
    this.currentPageIndex.set(0);
  }

  async parseExcel(file: File): Promise<void> {
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);

      const pages: DocPage[] = [];
      let config: DocConfig | null = null;

      workbook.SheetNames.forEach((sheetName, index) => {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(sheet) as any[];

        if (index === 0) {
          // First sheet is Config
          const firstRow = jsonData[0] || {};
          config = {
            title: sheetName,
            purpose: this.getRowVal(firstRow, ['Sheet purpose', 'purpose']) || 'Documentation',
            author: this.getRowVal(firstRow, ['Author']),
            version: this.getRowVal(firstRow, ['Version']),
            lastUpdated: this.getRowVal(firstRow, ['Last Updated']),
          };
        } else {
          // Other sheets are documentation pages
          const sections: DocSection[] = jsonData.map((row, i) => ({
            id: `sec-${index}-${i}`,
            heading: this.getRowVal(row, ['Heading']),
            subheading: this.getRowVal(row, ['Subheading']),
            content: this.getRowVal(row, ['Content']),
            codeBlock: this.getRowVal(row, ['Code block']),
            notes: this.getRowVal(row, ['Notes', 'Highlights']),
            mediaUrl: this.getRowVal(row, ['Image', 'Video', 'URL']),
            mermaid: this.getRowVal(row, ['Flowchart', 'Mind Map', 'Mermaid']),
          }));

          const filteredSections = sections.filter(s => s.heading || s.subheading || s.content);
          if (filteredSections.length > 0) {
            pages.push({
              name: sheetName,
              sections: filteredSections,
            });
          }
        }
      });

      if (pages.length > 0) {
        this.config.set(config);
        this.pages.set(pages);
        this.filteredPages.set(pages);
        this.currentPageIndex.set(0);
        console.log('Excel parsed successfully:', pages.length, 'pages found');
      } else {
        console.warn('No valid pages found in Excel file');
        alert('No valid content found in the Excel file. Please ensure you are using the correct template.');
      }
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      alert('Failed to parse Excel file. Please check if the file is corrupted.');
    }
  }

  private getRowVal(row: any, targetKeys: string[]): string {
    const keys = Object.keys(row);
    const foundKey = keys.find(k =>
      targetKeys.some(tk => k.toLowerCase().trim() === tk.toLowerCase())
    );
    return foundKey ? String(row[foundKey]).trim() : '';
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
        s.heading.toLowerCase().includes(query.toLowerCase()) ||
        s.subheading.toLowerCase().includes(query.toLowerCase()) ||
        s.content.toLowerCase().includes(query.toLowerCase())
      )
    })).filter(p => p.sections.length > 0);

    this.filteredPages.set(filtered);
  }

  downloadTemplate() {
    const wb = utils.book_new();

    // Instructions Sheet
    const instructionsWS = utils.json_to_sheet([
      { 'Column': 'Heading', 'Requirement': 'Required', 'Description': 'Main section title' },
      { 'Column': 'Subheading', 'Requirement': 'Optional', 'Description': 'Small title under heading' },
      { 'Column': 'Content', 'Requirement': 'Recommended', 'Description': 'Main text (supports HTML like <b>)' },
      { 'Column': 'Code block', 'Requirement': 'Optional', 'Description': 'Technical code snippets' },
      { 'Column': 'Mermaid', 'Requirement': 'Optional', 'Description': 'Diagram code (graph TD...)' },
      { 'Column': 'URL', 'Requirement': 'Optional', 'Description': 'Image or YouTube embed link' },
      { 'Column': 'Notes', 'Requirement': 'Optional', 'Description': 'Highlights or tips' }
    ]);
    utils.book_append_sheet(wb, instructionsWS, 'Instructions');

    // Config Sheet
    const configWS = utils.json_to_sheet([
      {
        'Sheet purpose': 'Easy Documents Template',
        'Author': 'User',
        'Version': '1.0',
        'Last Updated': new Date().toLocaleDateString()
      }
    ]);
    utils.book_append_sheet(wb, configWS, 'Config');

    // Sample Content Sheet
    const contentWS = utils.json_to_sheet([
      {
        'Heading': 'Getting Started',
        'Subheading': 'Introduction',
        'Content': 'Welcome to <b>Easy Documents</b>. This is a sample documentation row.',
        'Code block': 'console.log("Hello World");',
        'Notes': 'You can use rich text in the content column.',
        'URL': 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'Mermaid': 'graph TD\nA[Start] --> B[Implementation]\nB --> C[Export]'
      }
    ]);
    utils.book_append_sheet(wb, contentWS, 'Module 1');

    writeFile(wb, `EasyDocs_Template_${new Date().toLocaleDateString()}.xlsx`);
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
          [section.heading || ''],
          [section.subheading || ''],
          [section.content.replace(/<[^>]*>/g, '') || ''],
          [section.notes ? `Note: ${section.notes}` : '']
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
        if (sec.heading) {
          sections.push(new Paragraph({
            text: sec.heading,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 }
          }));
        }
        if (sec.subheading) {
          sections.push(new Paragraph({
            text: sec.subheading,
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
        if (sec.notes) {
          sections.push(new Paragraph({
            children: [
              new TextRun({
                text: `Note: ${sec.notes}`,
                italics: true,
                color: '666666'
              })
            ],
            spacing: { after: 200 }
          }));
        }
        if (sec.codeBlock) {
          sections.push(new Paragraph({
            children: [
              new TextRun({
                text: sec.codeBlock,
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

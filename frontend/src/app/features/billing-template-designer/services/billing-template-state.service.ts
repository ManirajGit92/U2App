import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  InvoiceTemplate,
  TemplateCategory,
  InvoiceTotals,
  DefaultInformationPreset,
} from '../models/billing-template.models';
import {
  DEFAULT_TEMPLATES,
  DEFAULT_CATEGORIES,
} from '../data/default-templates.data';
import { FirebaseAuthService } from '../../../core/services/firebase-auth.service';
import { FirebaseSyncService } from '../../../core/services/firebase-sync.service';

const STORAGE_TEMPLATES_KEY = 'u2app.billing_templates.v1';
const STORAGE_CATEGORIES_KEY = 'u2app.billing_categories.v1';
const STORAGE_DEFAULT_INFO_KEY = 'u2app.billing_default_preset.v1';
const STORAGE_ACTIVE_ID_KEY = 'u2app.billing_active_id.v1';
const FIRESTORE_APP_NAME = 'billing-templates';

@Injectable({
  providedIn: 'root',
})
export class BillingTemplateStateService {
  private authService = inject(FirebaseAuthService);
  private syncService = inject(FirebaseSyncService);

  private templatesSub = new BehaviorSubject<InvoiceTemplate[]>([]);
  private activeTemplateSub = new BehaviorSubject<InvoiceTemplate | null>(null);
  private categoriesSub = new BehaviorSubject<TemplateCategory[]>([]);
  private activeCategorySub = new BehaviorSubject<string>('Mahal Templates');
  private searchQuerySub = new BehaviorSubject<string>('');
  private defaultPresetSub = new BehaviorSubject<DefaultInformationPreset | null>(null);

  templates$ = this.templatesSub.asObservable();
  activeTemplate$ = this.activeTemplateSub.asObservable();
  categories$ = this.categoriesSub.asObservable();
  activeCategory$ = this.activeCategorySub.asObservable();
  searchQuery$ = this.searchQuerySub.asObservable();
  defaultPreset$ = this.defaultPresetSub.asObservable();

  constructor() {
    this.loadInitialData();

    this.syncService.onAuthChange((uid) => {
      if (uid) {
        this.loadFromFirestore();
      }
    });
  }

  // --- Getters for current snapshot values ---
  get templates(): InvoiceTemplate[] {
    return this.templatesSub.getValue();
  }

  get activeTemplate(): InvoiceTemplate | null {
    return this.activeTemplateSub.getValue();
  }

  get categories(): TemplateCategory[] {
    return this.categoriesSub.getValue();
  }

  get activeCategory(): string {
    return this.activeCategorySub.getValue();
  }

  get searchQuery(): string {
    return this.searchQuerySub.getValue();
  }

  get defaultPreset(): DefaultInformationPreset | null {
    return this.defaultPresetSub.getValue();
  }

  // --- Initial Load ---
  private loadInitialData(): void {
    let savedTemplates: InvoiceTemplate[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_TEMPLATES_KEY);
      if (stored) {
        savedTemplates = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse saved templates from localStorage', e);
    }

    if (!savedTemplates || savedTemplates.length === 0) {
      savedTemplates = [...DEFAULT_TEMPLATES];
      localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(savedTemplates));
    }

    this.templatesSub.next(savedTemplates);

    // Categories
    let savedCategories: TemplateCategory[] = [];
    try {
      const storedCat = localStorage.getItem(STORAGE_CATEGORIES_KEY);
      if (storedCat) {
        savedCategories = JSON.parse(storedCat);
      }
    } catch (e) {
      console.warn('Failed to parse categories', e);
    }

    if (!savedCategories || savedCategories.length === 0) {
      savedCategories = [...DEFAULT_CATEGORIES];
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(savedCategories));
    }
    this.updateCategoryCounts(savedTemplates, savedCategories);

    // Default preset
    try {
      const storedPreset = localStorage.getItem(STORAGE_DEFAULT_INFO_KEY);
      if (storedPreset) {
        this.defaultPresetSub.next(JSON.parse(storedPreset));
      } else if (savedTemplates.length > 0) {
        const first = savedTemplates[0];
        const defaultPreset: DefaultInformationPreset = {
          businessInfo: { ...first.businessInfo },
          paymentDetails: { ...first.paymentDetails },
          termsAndConditions: [...first.termsAndConditions],
          notesRemarks: first.notesRemarks,
        };
        this.defaultPresetSub.next(defaultPreset);
        localStorage.setItem(STORAGE_DEFAULT_INFO_KEY, JSON.stringify(defaultPreset));
      }
    } catch (e) {
      console.warn('Failed to parse default preset', e);
    }

    // Active template
    const lastActiveId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
    let initialActive = savedTemplates.find((t) => t.id === lastActiveId);
    if (!initialActive) {
      initialActive = savedTemplates.find((t) => t.isDefault) || savedTemplates[0];
    }
    this.activeTemplateSub.next(initialActive ? JSON.parse(JSON.stringify(initialActive)) : null);
  }

  private updateCategoryCounts(templates: InvoiceTemplate[], categories: TemplateCategory[]): void {
    const updated = categories.map((cat) => {
      const count = templates.filter(
        (t) => t.category.toLowerCase().trim() === cat.name.toLowerCase().trim()
      ).length;
      return { ...cat, count };
    });
    this.categoriesSub.next(updated);
    try {
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(updated));
    } catch {}
  }

  // --- Filtering & Selection ---
  setActiveCategory(categoryName: string): void {
    this.activeCategorySub.next(categoryName);
  }

  setSearchQuery(query: string): void {
    this.searchQuerySub.next(query);
  }

  selectTemplate(templateId: string): void {
    const found = this.templates.find((t) => t.id === templateId);
    if (found) {
      this.activeTemplateSub.next(JSON.parse(JSON.stringify(found)));
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, templateId);
    }
  }

  // --- CRUD Operations ---
  saveTemplate(template: InvoiceTemplate): void {
    const currentList = this.templates;
    const exists = currentList.some((t) => t.id === template.id);
    const updatedTemplate = {
      ...template,
      updatedAt: new Date().toISOString(),
    };

    let newList: InvoiceTemplate[];
    if (exists) {
      newList = currentList.map((t) => (t.id === template.id ? updatedTemplate : t));
    } else {
      newList = [updatedTemplate, ...currentList];
    }

    this.templatesSub.next(newList);
    this.activeTemplateSub.next(JSON.parse(JSON.stringify(updatedTemplate)));
    this.saveToLocalStorage(newList);
    this.updateCategoryCounts(newList, this.categories);
    this.syncToFirestore();
  }

  createTemplate(category: string = 'Custom Templates', name?: string): InvoiceTemplate {
    const base = this.activeTemplate || DEFAULT_TEMPLATES[0];
    const newId = 'tpl-' + Date.now();
    const newTemplate: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(base)),
      id: newId,
      name: name || `New ${category.replace('Templates', '').trim()} Template`,
      category: category,
      description: 'Custom tailored invoice template for specific billing needs.',
      isFavorite: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      badge: 'Custom',
    };

    const updatedList = [newTemplate, ...this.templates];
    this.templatesSub.next(updatedList);
    this.activeTemplateSub.next(JSON.parse(JSON.stringify(newTemplate)));
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, newId);
    this.saveToLocalStorage(updatedList);
    this.updateCategoryCounts(updatedList, this.categories);
    this.syncToFirestore();
    return newTemplate;
  }

  duplicateTemplate(templateId: string): InvoiceTemplate | null {
    const target = this.templates.find((t) => t.id === templateId) || this.activeTemplate;
    if (!target) return null;

    const newId = 'tpl-' + Date.now();
    const cloned: InvoiceTemplate = {
      ...JSON.parse(JSON.stringify(target)),
      id: newId,
      name: `${target.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedList = [cloned, ...this.templates];
    this.templatesSub.next(updatedList);
    this.activeTemplateSub.next(JSON.parse(JSON.stringify(cloned)));
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, newId);
    this.saveToLocalStorage(updatedList);
    this.updateCategoryCounts(updatedList, this.categories);
    this.syncToFirestore();
    return cloned;
  }

  deleteTemplate(templateId: string): boolean {
    const currentList = this.templates;
    if (currentList.length <= 1) {
      return false; // Prevent deleting the very last template
    }

    const filtered = currentList.filter((t) => t.id !== templateId);
    this.templatesSub.next(filtered);
    this.saveToLocalStorage(filtered);
    this.updateCategoryCounts(filtered, this.categories);

    if (this.activeTemplate?.id === templateId) {
      const nextActive = filtered[0];
      this.activeTemplateSub.next(JSON.parse(JSON.stringify(nextActive)));
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, nextActive.id);
    }
    this.syncToFirestore();
    return true;
  }

  toggleFavorite(templateId: string): void {
    const list = this.templates.map((t) => {
      if (t.id === templateId) {
        return { ...t, isFavorite: !t.isFavorite };
      }
      return t;
    });
    this.templatesSub.next(list);

    if (this.activeTemplate?.id === templateId) {
      this.activeTemplateSub.next({
        ...this.activeTemplate,
        isFavorite: !this.activeTemplate.isFavorite,
      });
    }

    this.saveToLocalStorage(list);
    this.syncToFirestore();
  }

  setAsDefault(templateId: string): void {
    const list = this.templates.map((t) => ({
      ...t,
      isDefault: t.id === templateId,
    }));
    this.templatesSub.next(list);

    if (this.activeTemplate) {
      this.activeTemplateSub.next({
        ...this.activeTemplate,
        isDefault: this.activeTemplate.id === templateId,
      });
    }

    this.saveToLocalStorage(list);
    this.syncToFirestore();
  }

  addCategory(categoryName: string, icon: string = '📁'): void {
    const trimmed = categoryName.trim();
    if (!trimmed) return;

    const exists = this.categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return;

    const id = trimmed.toLowerCase().replace(/\s+/g, '-');
    const newCategory: TemplateCategory = {
      id,
      name: trimmed,
      icon,
      count: 0,
    };

    const updated = [...this.categories, newCategory];
    this.categoriesSub.next(updated);
    try {
      localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(updated));
    } catch {}
    this.syncToFirestore();
  }

  // --- Default Business Preset ---
  saveDefaultPreset(preset: DefaultInformationPreset): void {
    this.defaultPresetSub.next(preset);
    try {
      localStorage.setItem(STORAGE_DEFAULT_INFO_KEY, JSON.stringify(preset));
    } catch {}
    this.syncToFirestore();
  }

  applyDefaultPresetToActiveTemplate(): void {
    const preset = this.defaultPreset;
    const active = this.activeTemplate;
    if (!preset || !active) return;

    const updated: InvoiceTemplate = {
      ...active,
      businessInfo: { ...preset.businessInfo },
      paymentDetails: { ...preset.paymentDetails },
      termsAndConditions: [...preset.termsAndConditions],
      notesRemarks: preset.notesRemarks,
    };

    this.activeTemplateSub.next(updated);
    this.saveTemplate(updated);
  }

  // --- Calculations ---
  calculateTotals(template: InvoiceTemplate): InvoiceTotals {
    const subTotal = (template.items || []).reduce((acc, item) => {
      const amt = Number(item.amount) || (Number(item.rate) || 0) * (parseFloat(item.qtyDuration) || 1);
      return acc + amt;
    }, 0);

    const taxSettings = template.taxSettings || {
      taxMode: 'gst',
      cgstRate: 9,
      sgstRate: 9,
      igstRate: 18,
      discountType: 'flat',
      discountValue: 0,
      additionalCharges: 0,
      roundOff: true,
    };

    let discountAmount = 0;
    if (taxSettings.discountType === 'percentage') {
      discountAmount = (subTotal * (Number(taxSettings.discountValue) || 0)) / 100;
    } else {
      discountAmount = Number(taxSettings.discountValue) || 0;
    }
    if (discountAmount > subTotal) discountAmount = subTotal;

    const taxableAmount = Math.max(0, subTotal - discountAmount);

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (taxSettings.taxMode === 'gst') {
      cgstAmount = (taxableAmount * (Number(taxSettings.cgstRate) || 0)) / 100;
      sgstAmount = (taxableAmount * (Number(taxSettings.sgstRate) || 0)) / 100;
    } else if (taxSettings.taxMode === 'igst') {
      igstAmount = (taxableAmount * (Number(taxSettings.igstRate) || 0)) / 100;
    }

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const additionalCharges = Number(taxSettings.additionalCharges) || 0;

    let grandTotal = taxableAmount + totalTax + additionalCharges;
    if (taxSettings.roundOff) {
      grandTotal = Math.round(grandTotal);
    }

    const amountInWords = this.numberToWordsIndian(grandTotal);

    return {
      subTotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      additionalCharges,
      grandTotal,
      amountInWords,
    };
  }

  // Indian Number to Words converter (Crores, Lakhs, Thousands, Hundreds, Rupees)
  numberToWordsIndian(amount: number): string {
    if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

    const units = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen',
    ];
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
    ];

    const convertChunk = (num: number): string => {
      let str = '';
      if (num >= 100) {
        str += units[Math.floor(num / 100)] + ' Hundred ';
        num %= 100;
      }
      if (num > 0) {
        if (num < 20) {
          str += units[num] + ' ';
        } else {
          str += tens[Math.floor(num / 10)] + ' ';
          if (num % 10 > 0) {
            str += units[num % 10] + ' ';
          }
        }
      }
      return str.trim();
    };

    const integerPart = Math.floor(Math.abs(amount));
    const fractionPart = Math.round((Math.abs(amount) - integerPart) * 100);

    let crore = Math.floor(integerPart / 10000000);
    let remainder = integerPart % 10000000;
    let lakh = Math.floor(remainder / 100000);
    remainder = remainder % 100000;
    let thousand = Math.floor(remainder / 1000);
    remainder = remainder % 1000;
    let hundred = remainder;

    let res = '';
    if (crore > 0) {
      res += convertChunk(crore) + ' Crore ';
    }
    if (lakh > 0) {
      res += convertChunk(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
      res += convertChunk(thousand) + ' Thousand ';
    }
    if (hundred > 0) {
      res += convertChunk(hundred) + ' ';
    }

    res = res.trim();
    if (!res) res = 'Zero';

    let output = 'Rupees ' + res;
    if (fractionPart > 0) {
      output += ' and ' + convertChunk(fractionPart) + ' Paise';
    }
    output += ' Only';
    return output;
  }

  // --- Import / Export ---
  exportTemplateAsJson(template: InvoiceTemplate): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${template.name.toLowerCase().replace(/\s+/g, '_')}_template.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importTemplateFromJson(jsonString: string): InvoiceTemplate {
    const parsed = JSON.parse(jsonString) as InvoiceTemplate;
    if (!parsed.name || !parsed.businessInfo) {
      throw new Error('Invalid template JSON format');
    }

    parsed.id = 'tpl-' + Date.now();
    parsed.createdAt = new Date().toISOString();
    parsed.updatedAt = new Date().toISOString();
    parsed.isDefault = false;

    const list = [parsed, ...this.templates];
    this.templatesSub.next(list);
    this.activeTemplateSub.next(parsed);
    this.saveToLocalStorage(list);
    this.updateCategoryCounts(list, this.categories);
    this.syncToFirestore();
    return parsed;
  }

  // --- Reset to Factory Defaults ---
  resetToDefaultTemplates(): void {
    const defaults = [...DEFAULT_TEMPLATES];
    this.templatesSub.next(defaults);
    this.activeTemplateSub.next(JSON.parse(JSON.stringify(defaults[0])));
    this.saveToLocalStorage(defaults);
    this.updateCategoryCounts(defaults, DEFAULT_CATEGORIES);
    this.syncToFirestore();
  }

  private saveToLocalStorage(list: InvoiceTemplate[]): void {
    try {
      localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save templates to localStorage', e);
    }
  }

  // --- Firestore Sync ---
  private async syncToFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      await Promise.all([
        this.syncService.pushToFirestore(
          FIRESTORE_APP_NAME,
          'templates',
          this.templates as unknown as Record<string, unknown>[]
        ),
        this.syncService.pushToFirestore(
          FIRESTORE_APP_NAME,
          'categories',
          this.categories as unknown as Record<string, unknown>[]
        ),
      ]);
    } catch (e) {
      console.error('BillingTemplateStateService: Firestore push failed', e);
    }
  }

  private async loadFromFirestore(): Promise<void> {
    if (!this.authService.isAuthenticated()) return;
    try {
      const templates = await this.syncService.pullFromFirestore<InvoiceTemplate>(
        FIRESTORE_APP_NAME,
        'templates'
      );
      if (templates && templates.length > 0) {
        this.templatesSub.next(templates);
        this.saveToLocalStorage(templates);
        if (!this.activeTemplate || !templates.some((t) => t.id === this.activeTemplate?.id)) {
          this.activeTemplateSub.next(JSON.parse(JSON.stringify(templates[0])));
        }
      }

      const categories = await this.syncService.pullFromFirestore<TemplateCategory>(
        FIRESTORE_APP_NAME,
        'categories'
      );
      if (categories && categories.length > 0) {
        this.categoriesSub.next(categories);
        try {
          localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
        } catch {}
      }
    } catch (e) {
      console.error('BillingTemplateStateService: Firestore pull failed', e);
    }
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoiceTemplate, TemplateCategory } from '../../models/billing-template.models';

/* --- 1. ADD CATEGORY MODAL --- */
@Component({
  selector: 'app-add-category-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">Add New Template Category</h3>
          <button class="modal-close" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Category Name <span class="required">*</span></label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="categoryName"
              placeholder="e.g. Photography, Decor, Jewellery, Resort..."
            />
          </div>
          <div class="form-group">
            <label class="form-label">Category Icon</label>
            <div class="icon-selector">
              <button
                *ngFor="let icon of iconOptions"
                class="icon-btn"
                [class.selected]="selectedIcon === icon"
                (click)="selectedIcon = icon"
              >
                {{ icon }}
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" (click)="onSave()">Create Category</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 1060; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-dialog { background: #ffffff; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); overflow: hidden; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .modal-title { margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; }
    .modal-close { background: none; border: none; font-size: 1.4rem; color: #64748b; cursor: pointer; }
    .modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 0.8rem; font-weight: 600; color: #475569; }
    .required { color: #ef4444; }
    .form-input { width: 100%; padding: 8px 10px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .icon-selector { display: flex; gap: 8px; flex-wrap: wrap; }
    .icon-btn { width: 38px; height: 38px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .icon-btn:hover { background: #eff6ff; border-color: #3b82f6; }
    .icon-btn.selected { background: #2563eb; border-color: #2563eb; transform: scale(1.08); }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; cursor: pointer; }
    .btn-secondary { background: #ffffff; border: 1px solid #cbd5e1; color: #475569; }
    .btn-primary { background: #2563eb; border: none; color: #ffffff; }
  `]
})
export class AddCategoryModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() saveCategory = new EventEmitter<{ name: string; icon: string }>();

  categoryName = '';
  selectedIcon = '📁';
  iconOptions = ['📁', '🏛️', '🍽️', '🛏️', '📅', '📋', '⚙️', '📸', '🎵', '🚗', '💍', '💐'];

  onSave(): void {
    if (!this.categoryName.trim()) {
      alert('Please enter a category name');
      return;
    }
    const finalName = this.categoryName.trim().endsWith('Templates') ? this.categoryName.trim() : `${this.categoryName.trim()} Templates`;
    this.saveCategory.emit({ name: finalName, icon: this.selectedIcon });
    this.categoryName = '';
    this.close.emit();
  }
}

/* --- 2. CREATE TEMPLATE MODAL --- */
@Component({
  selector: 'app-create-template-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">Create New Template</h3>
          <button class="modal-close" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Template Title <span class="required">*</span></label>
            <input
              type="text"
              class="form-input"
              [(ngModel)]="templateName"
              placeholder="e.g. Luxury Banquet Invoice, Deluxe Stay Bill..."
            />
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" [(ngModel)]="selectedCategory">
              <option *ngFor="let cat of categories" [value]="cat.name">{{ cat.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea
              rows="2"
              class="form-input"
              [(ngModel)]="description"
              placeholder="Template purpose and layout notes..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Cancel</button>
          <button class="btn btn-primary" (click)="onCreate()">Create Template</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 1060; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-dialog { background: #ffffff; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); overflow: hidden; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .modal-title { margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; }
    .modal-close { background: none; border: none; font-size: 1.4rem; color: #64748b; cursor: pointer; }
    .modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 0.8rem; font-weight: 600; color: #475569; }
    .required { color: #ef4444; }
    .form-input, .form-select { width: 100%; padding: 8px 10px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; cursor: pointer; }
    .btn-secondary { background: #ffffff; border: 1px solid #cbd5e1; color: #475569; }
    .btn-primary { background: #2563eb; border: none; color: #ffffff; }
  `]
})
export class CreateTemplateModalComponent {
  @Input() isOpen = false;
  @Input() categories: TemplateCategory[] = [];
  @Input() defaultCategory = 'Custom Templates';

  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<{ name: string; category: string; description: string }>();

  templateName = '';
  selectedCategory = 'Custom Templates';
  description = '';

  onCreate(): void {
    if (!this.templateName.trim()) {
      alert('Please enter a template name.');
      return;
    }
    this.create.emit({
      name: this.templateName.trim(),
      category: this.selectedCategory || this.defaultCategory,
      description: this.description.trim(),
    });
    this.templateName = '';
    this.description = '';
    this.close.emit();
  }
}

/* --- 3. PAGE SETUP MODAL --- */
@Component({
  selector: 'app-page-setup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-dialog" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">Page & Print Setup</h3>
          <button class="modal-close" (click)="close.emit()">×</button>
        </div>
        <div class="modal-body" *ngIf="template">
          <div class="form-group">
            <label class="form-label">Paper Size</label>
            <select class="form-select" [(ngModel)]="template.pageSize">
              <option value="A4">A4 (210 x 297 mm) - Standard Indian GST</option>
              <option value="Letter">US Letter (8.5 x 11 in)</option>
              <option value="Legal">US Legal (8.5 x 14 in)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Orientation</label>
            <div class="radio-row">
              <label class="radio-label">
                <input type="radio" name="orientation" value="portrait" [(ngModel)]="template.pageOrientation" />
                <span>Portrait</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="orientation" value="landscape" [(ngModel)]="template.pageOrientation" />
                <span>Landscape</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Spacing & Margins</label>
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="template.design.compactSpacing" />
              <span>Compact Spacing (Fit on single page)</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" (click)="close.emit()">Done</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 1060; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-dialog { background: #ffffff; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2); overflow: hidden; display: flex; flex-direction: column; }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .modal-title { margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b; }
    .modal-close { background: none; border: none; font-size: 1.4rem; color: #64748b; cursor: pointer; }
    .modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 0.8rem; font-weight: 600; color: #475569; }
    .form-select { width: 100%; padding: 8px 10px; font-size: 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .radio-row { display: flex; gap: 20px; }
    .radio-label, .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 0.84rem; color: #334155; cursor: pointer; }
    .modal-footer { display: flex; justify-content: flex-end; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 0.84rem; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #2563eb; border: none; color: #ffffff; }
  `]
})
export class PageSetupModalComponent {
  @Input() isOpen = false;
  @Input() template: InvoiceTemplate | null = null;
  @Output() close = new EventEmitter<void>();
}

/* --- 4. FULLSCREEN PREVIEW MODAL --- */
@Component({
  selector: 'app-fullscreen-preview-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fullscreen-backdrop" *ngIf="isOpen" (click)="close.emit()">
      <div class="fullscreen-topbar" (click)="$event.stopPropagation()">
        <span class="preview-mode-title">Full Invoice Print Preview</span>
        <div class="topbar-actions">
          <button class="btn-top" (click)="print.emit()">🖨️ Print</button>
          <button class="btn-top close-btn" (click)="close.emit()">✕ Close</button>
        </div>
      </div>
      <div class="fullscreen-content" (click)="$event.stopPropagation()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .fullscreen-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      z-index: 2000;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .fullscreen-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: #1e293b;
      color: #ffffff;
      position: sticky;
      top: 0;
      z-index: 2001;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    .preview-mode-title {
      font-weight: 700;
      font-size: 1rem;
    }
    .topbar-actions {
      display: flex;
      gap: 12px;
    }
    .btn-top {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: #3b82f6;
      color: #ffffff;
      transition: background 0.15s;
    }
    .btn-top:hover { background: #2563eb; }
    .close-btn { background: #475569; }
    .close-btn:hover { background: #334155; }
    .fullscreen-content {
      padding: 30px;
      display: flex;
      justify-content: center;
    }
  `]
})
export class FullscreenPreviewModalComponent {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();
}

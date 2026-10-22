import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvoiceTemplate, TemplateCategory } from '../../models/billing-template.models';

@Component({
  selector: 'app-template-gallery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="gallery-wrapper">
      <!-- Categories Bar -->
      <div class="categories-bar">
        <button
          *ngFor="let cat of categories"
          class="category-card"
          [class.active]="selectedCategory === cat.name"
          (click)="onSelectCategory(cat.name)"
        >
          <div class="cat-icon-box">{{ cat.icon }}</div>
          <div class="cat-info">
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-count">{{ cat.count }} {{ cat.count === 1 ? 'template' : 'templates' }}</span>
          </div>
        </button>

        <button class="add-cat-btn" (click)="addCategoryClicked.emit()">
          <span class="plus-icon">+</span>
          <span>Add Category</span>
        </button>
      </div>

      <!-- Templates Cards Horizontal Carousel -->
      <div class="templates-scroll-container">
        <div class="templates-track">
          <!-- Template Preview Card -->
          <div
            *ngFor="let tpl of filteredTemplates"
            class="template-card"
            [class.active]="activeTemplate?.id === tpl.id"
            (click)="selectTemplate.emit(tpl.id)"
          >
            <!-- Favorite Heart Button -->
            <button
              class="favorite-btn"
              [class.favorited]="tpl.isFavorite"
              (click)="$event.stopPropagation(); toggleFavorite.emit(tpl.id)"
              [title]="tpl.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" [attr.fill]="tpl.isFavorite ? '#ef4444' : 'none'" [attr.stroke]="tpl.isFavorite ? '#ef4444' : '#64748b'" stroke-width="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>

            <!-- Default Badge -->
            <span class="default-badge" *ngIf="tpl.isDefault">Default</span>

            <!-- Mini Invoice Thumbnail Preview -->
            <div class="thumbnail-wrapper" [style.border-top-color]="tpl.colorTheme">
              <div class="mini-sheet">
                <!-- Mini Header -->
                <div class="mini-header" [style.border-bottom-color]="tpl.colorTheme">
                  <div class="mini-logo-dots">
                    <span class="mini-dot" [style.background]="tpl.colorTheme"></span>
                    <span class="mini-bar"></span>
                  </div>
                  <div class="mini-lines">
                    <span class="mini-line w-60"></span>
                    <span class="mini-line w-40"></span>
                  </div>
                </div>

                <!-- Mini Banner -->
                <div class="mini-banner" [style.background]="tpl.colorTheme">
                  <span class="mini-banner-text">TAX INVOICE</span>
                </div>

                <!-- Mini Two Columns -->
                <div class="mini-grid">
                  <div class="mini-col">
                    <span class="mini-line w-80"></span>
                    <span class="mini-line w-50"></span>
                  </div>
                  <div class="mini-col align-right">
                    <span class="mini-line w-60"></span>
                    <span class="mini-line w-40"></span>
                  </div>
                </div>

                <!-- Mini Table -->
                <div class="mini-table">
                  <div class="mini-table-header" [style.background]="tpl.colorTheme + '20'"></div>
                  <div class="mini-row"><span class="mini-line w-70"></span><span class="mini-line w-20"></span></div>
                  <div class="mini-row"><span class="mini-line w-60"></span><span class="mini-line w-20"></span></div>
                  <div class="mini-row"><span class="mini-line w-80"></span><span class="mini-line w-20"></span></div>
                </div>

                <!-- Mini Total -->
                <div class="mini-total">
                  <span class="mini-total-pill" [style.background]="tpl.colorTheme"></span>
                </div>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="card-footer">
              <span class="template-title" [title]="tpl.name">{{ tpl.name }}</span>
            </div>
          </div>

          <!-- Create Custom Template Card -->
          <div class="create-card" (click)="createNewClicked.emit()">
            <div class="create-inner">
              <div class="plus-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <span class="create-title">Create</span>
              <span class="create-subtitle">Custom Template</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .gallery-wrapper {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 20px;
    }

    /* Categories Bar */
    .categories-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 6px;
      scrollbar-width: thin;
    }

    .category-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 18px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      color: #1e293b;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .category-card:hover {
      border-color: #93c5fd;
      background: #f8fafc;
      transform: translateY(-1px);
    }

    .category-card.active {
      border-color: #2563eb;
      background: #eff6ff;
      color: #1d4ed8;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
    }

    .cat-icon-box {
      font-size: 1.35rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cat-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.25;
    }

    .cat-name {
      font-weight: 600;
      font-size: 0.88rem;
    }

    .cat-count {
      font-size: 0.74rem;
      color: #64748b;
    }

    .category-card.active .cat-count {
      color: #2563eb;
    }

    .add-cat-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      color: #475569;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .add-cat-btn:hover {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #2563eb;
    }

    .plus-icon {
      font-size: 1.1rem;
      font-weight: bold;
    }

    /* Templates Scroll Track */
    .templates-scroll-container {
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-width: thin;
    }

    .templates-track {
      display: flex;
      gap: 16px;
      align-items: stretch;
      min-width: min-content;
    }

    /* Template Card */
    .template-card {
      width: 146px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      position: relative;
      transition: all 0.25s ease;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    }

    .template-card:hover {
      border-color: #3b82f6;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
      transform: translateY(-2px);
    }

    .template-card.active {
      border: 2px solid #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }

    .favorite-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(226, 232, 240, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s;
    }

    .favorite-btn:hover {
      background: #ffffff;
      transform: scale(1.15);
    }

    .default-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: #2563eb;
      color: #ffffff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      z-index: 10;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Mini Invoice Thumbnail Preview */
    .thumbnail-wrapper {
      background: #f8fafc;
      padding: 10px 8px;
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-top: 3px solid #2563eb;
    }

    .mini-sheet {
      width: 100%;
      height: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      pointer-events: none;
    }

    .mini-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }

    .mini-logo-dots {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .mini-bar {
      width: 16px;
      height: 4px;
      background: #94a3b8;
      border-radius: 2px;
    }

    .mini-lines {
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: flex-end;
    }

    .mini-line {
      height: 3px;
      background: #cbd5e1;
      border-radius: 1px;
      display: inline-block;
    }

    .w-20 { width: 14px; }
    .w-40 { width: 22px; }
    .w-50 { width: 28px; }
    .w-60 { width: 34px; }
    .w-70 { width: 40px; }
    .w-80 { width: 48px; }

    .mini-banner {
      padding: 2px 4px;
      border-radius: 2px;
      text-align: center;
    }

    .mini-banner-text {
      color: #ffffff;
      font-size: 5px;
      font-weight: bold;
      letter-spacing: 0.4px;
    }

    .mini-grid {
      display: flex;
      justify-content: space-between;
      gap: 4px;
    }

    .mini-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .align-right {
      align-items: flex-end;
    }

    .mini-table {
      border: 0.5px solid #e2e8f0;
      border-radius: 2px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-grow: 1;
    }

    .mini-table-header {
      height: 7px;
      width: 100%;
    }

    .mini-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 4px;
      border-bottom: 0.5px solid #f1f5f9;
    }

    .mini-total {
      display: flex;
      justify-content: flex-end;
    }

    .mini-total-pill {
      width: 32px;
      height: 6px;
      border-radius: 2px;
    }

    /* Card Footer */
    .card-footer {
      padding: 8px 10px;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      text-align: center;
    }

    .template-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }

    /* Create Custom Template Card */
    .create-card {
      width: 146px;
      background: #f8fafc;
      border: 2px dashed #94a3b8;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 200px;
    }

    .create-card:hover {
      border-color: #2563eb;
      background: #eff6ff;
      transform: translateY(-2px);
    }

    .create-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      text-align: center;
      padding: 12px;
    }

    .plus-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .create-card:hover .plus-circle {
      background: #2563eb;
      color: #ffffff;
      transform: rotate(90deg);
    }

    .create-title {
      font-weight: 700;
      font-size: 0.85rem;
      color: #1e293b;
    }

    .create-subtitle {
      font-size: 0.72rem;
      color: #64748b;
    }
  `]
})
export class TemplateGalleryComponent {
  @Input() categories: TemplateCategory[] = [];
  @Input() templates: InvoiceTemplate[] = [];
  @Input() activeTemplate: InvoiceTemplate | null = null;
  @Input() selectedCategory: string = 'Mahal Templates';
  @Input() searchQuery: string = '';

  @Output() selectCategory = new EventEmitter<string>();
  @Output() selectTemplate = new EventEmitter<string>();
  @Output() toggleFavorite = new EventEmitter<string>();
  @Output() addCategoryClicked = new EventEmitter<void>();
  @Output() createNewClicked = new EventEmitter<void>();

  get filteredTemplates(): InvoiceTemplate[] {
    let list = this.templates;

    // Filter by Category
    if (this.selectedCategory && this.selectedCategory !== 'All') {
      list = list.filter(
        (t) => t.category.toLowerCase().trim() === this.selectedCategory.toLowerCase().trim()
      );
    }

    // Filter by Search Query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.businessInfo.name.toLowerCase().includes(q)
      );
    }

    return list;
  }

  onSelectCategory(name: string): void {
    this.selectCategory.emit(name);
  }
}

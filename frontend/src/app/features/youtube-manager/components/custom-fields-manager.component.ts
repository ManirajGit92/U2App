import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YouTubeStateService } from '../services/yt-state.service';
import { CustomFieldDefinition } from '../models/youtube.models';

@Component({
  selector: 'app-custom-fields-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Manage Custom Fields</h2>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>

        <div class="modal-body">
          <!-- Create New Field -->
          <div class="new-field-section">
            <h3>Add New Custom Field</h3>
            <div class="form-grid">
              <div class="form-group">
                <label for="field-label">Field Label</label>
                <input id="field-label" type="text" [(ngModel)]="newLabel" placeholder="e.g. Spotify Link, Mood">
              </div>

              <div class="form-group">
                <label for="field-type">Field Type</label>
                <select id="field-type" [(ngModel)]="newType">
                  <option value="text">Textbox (Free-form)</option>
                  <option value="dropdown">Dropdown (Predefined)</option>
                </select>
              </div>
            </div>

            <!-- Predefined options input (only for dropdown type) -->
            <div class="form-group" *ngIf="newType === 'dropdown'" style="margin-top: 12px;">
              <label for="field-options">Dropdown Options (Comma separated)</label>
              <input id="field-options" type="text" [(ngModel)]="newOptionsStr" placeholder="e.g. Happy, Energetic, Sad">
            </div>

            <button class="btn btn-primary" (click)="addField()" style="margin-top: 12px; width: 100%;">
              ➕ Create Field
            </button>
          </div>

          <!-- Existing Fields List -->
          <div class="existing-fields-section" style="margin-top: 24px;">
            <h3>Existing Custom Fields</h3>
            
            <div class="fields-list" *ngIf="state.customFieldDefs.length > 0; else noFields">
              <div class="field-item" *ngFor="let def of state.customFieldDefs">
                <div class="field-info">
                  <span class="field-name">{{ def.label }}</span>
                  <span class="field-badge" [class.badge-dropdown]="def.type === 'dropdown'">
                    {{ def.type }}
                  </span>
                  <div class="field-options-preview" *ngIf="def.type === 'dropdown' && def.dropdownOptions">
                    Options: {{ def.dropdownOptions.join(', ') }}
                  </div>
                </div>
                
                <div class="field-actions">
                  <button class="btn-icon btn-danger" (click)="deleteField(def.id)" title="Delete Field">🗑️</button>
                </div>
              </div>
            </div>

            <ng-template #noFields>
              <p class="empty-state">No custom fields defined yet. Create one above!</p>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.25s ease-out;
    }
    
    .modal-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 500px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .modal-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.02);
    }
    
    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text-primary);
    }
    
    .close-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 1.25rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: all var(--transition-fast);
    }
    .close-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
    
    .modal-body {
      padding: 1rem;
      overflow-y: auto;
      flex: 1;
    }

    h3 {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin: 0 0 12px 0;
      border-left: 3px solid var(--accent-primary);
      padding-left: 8px;
    }

    .new-field-section {
      background: var(--bg-primary);
      padding: 1rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-color);
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .form-group input, .form-group select {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color-strong);
      color: var(--text-primary);
      padding: 8px 0.5rem;
      border-radius: var(--radius-sm);
      outline: none;
      font-size: 0.88rem;
    }

    .form-group input:focus, .form-group select:focus {
      border-color: var(--accent-primary);
    }

    .fields-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.5rem;
      border-radius: var(--radius-md);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
    }

    .field-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .field-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .field-badge {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--accent-primary);
      background: var(--accent-surface);
      padding: 1px 6px;
      border-radius: 4px;
      width: fit-content;
    }
    .badge-dropdown {
      color: var(--success);
      background: rgba(16, 185, 129, 0.1);
    }

    .field-options-preview {
      font-size: 0.75rem;
      color: var(--text-tertiary);
    }

    .field-actions {
      display: flex;
      gap: 4px;
    }

    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .empty-state {
      text-align: center;
      color: var(--text-tertiary);
      font-size: 0.85rem;
      padding: 1rem 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class CustomFieldsManagerComponent {
  state = inject(YouTubeStateService);

  @Output() close = new EventEmitter<void>();

  newLabel = '';
  newType: 'text' | 'dropdown' = 'text';
  newOptionsStr = '';

  addField() {
    const label = this.newLabel.trim();
    if (!label) {
      alert('Field Label is required!');
      return;
    }

    const id = 'custom_' + Date.now();
    let dropdownOptions: string[] = [];

    if (this.newType === 'dropdown') {
      dropdownOptions = this.newOptionsStr
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      
      if (dropdownOptions.length === 0) {
        alert('Please specify at least one dropdown option!');
        return;
      }
    }

    this.state.addCustomFieldDef({
      id,
      label,
      type: this.newType,
      dropdownOptions: this.newType === 'dropdown' ? dropdownOptions : undefined
    });

    // Reset
    this.newLabel = '';
    this.newType = 'text';
    this.newOptionsStr = '';
  }

  deleteField(id: string) {
    if (confirm('Are you sure you want to delete this custom field? This will delete the field values from all videos too.')) {
      this.state.deleteCustomFieldDef(id);
    }
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIConversationService } from '../../services/ai-conversation.service';

@Component({
  selector: 'app-girl-character-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-section">
      <h4 class="section-title">
        <i class="pi pi-user"></i> Character &amp; Display
      </h4>

      <div class="character-preview-row">
        <img
          [src]="aiService.characterSettings().avatarImageUrl"
          alt="Character Avatar"
          class="char-thumb"
        />
        <div class="char-meta">
          <strong>{{ aiService.characterSettings().name }}</strong>
          <span>Virtual AI Companion</span>
        </div>
      </div>

      <div class="field-group">
        <label>Character Name</label>
        <input
          type="text"
          [ngModel]="aiService.characterSettings().name"
          (ngModelChange)="aiService.updateCharacterSettings({ name: $event })"
          placeholder="e.g., Aanya"
        />
      </div>

      <div class="field-group">
        <label>Personality Style</label>
        <textarea
          rows="2"
          [ngModel]="aiService.characterSettings().personality"
          (ngModelChange)="aiService.updateCharacterSettings({ personality: $event })"
          placeholder="Describe her conversational tone..."
        ></textarea>
      </div>

      <div class="toggle-row">
        <span>Seamless White Background Blend</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="aiService.characterSettings().blendWhiteBackground"
            (ngModelChange)="aiService.updateCharacterSettings({ blendWhiteBackground: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <span>Show Emotion Indicator Pill</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="aiService.characterSettings().showEmotionBadge"
            (ngModelChange)="aiService.updateCharacterSettings({ showEmotionBadge: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <span>Force Original Video Audio</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="aiService.characterSettings().overrideVideoAudio"
            (ngModelChange)="aiService.updateCharacterSettings({ overrideVideoAudio: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <span>Force Loop All Videos</span>
        <label class="switch">
          <input
            type="checkbox"
            [ngModel]="aiService.characterSettings().overrideLoopVideo"
            (ngModelChange)="aiService.updateCharacterSettings({ overrideLoopVideo: $event })"
          />
          <span class="slider"></span>
        </label>
      </div>
    </div>
  `,
  styleUrl: './character-settings.component.scss',
})
export class CharacterSettingsComponent {
  readonly aiService = inject(AIConversationService);
}

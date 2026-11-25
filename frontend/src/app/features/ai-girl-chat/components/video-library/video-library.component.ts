import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ACTION_CATALOG,
  EMOTION_CATALOG,
  GirlAction,
  GirlEmotion,
  GirlVideoItem,
} from '../../models/girl-chat.models';
import { GirlVideoMappingService } from '../../services/girl-video-mapping.service';
import { EmotionDetectionService } from '../../services/emotion-detection.service';
import { VideoPlaybackService } from '../../services/video-playback.service';

interface VideoFormModel {
  name: string;
  youtubeUrl: string;
  emotion: GirlEmotion;
  action: GirlAction;
  description: string;
  videoAudioEnabled: boolean;
  voiceEnabled: boolean;
  loopVideo: boolean;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
  isFallback: boolean;
}

@Component({
  selector: 'app-girl-video-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="library-panel">
      <div class="library-header">
        <div>
          <h3>Video Library</h3>
          <p class="subtitle">
            {{ videoService.configuredCount() }} of {{ videoService.videos().length }} videos linked
          </p>
        </div>
        <button type="button" class="btn-add" (click)="openAddForm()">
          <i class="pi pi-plus"></i> Add
        </button>
      </div>

      <!-- Search & Emotion Filter -->
      <div class="filter-bar">
        <div class="search-box">
          <i class="pi pi-search"></i>
          <input
            type="text"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
            placeholder="Search videos..."
          />
        </div>
        <select
          class="emotion-filter"
          [ngModel]="selectedEmotion()"
          (ngModelChange)="selectedEmotion.set($event)"
          aria-label="Filter by emotion"
        >
          <option value="all">All emotions</option>
          @for (em of emotions; track em.value) {
            <option [value]="em.value">{{ em.emoji }} {{ em.label }}</option>
          }
        </select>
      </div>

      <!-- Add / Edit Video Form -->
      @if (showForm()) {
        <div class="video-form-card">
          <div class="form-header">
            <h4>{{ editingId() ? 'Edit Video Mapping' : 'Add YouTube / Video Mapping' }}</h4>
            <button type="button" class="icon-close" (click)="closeForm()" aria-label="Close form">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="form-group">
            <label>Video Name</label>
            <input
              type="text"
              [(ngModel)]="form.name"
              placeholder="e.g., Shy Smile Reaction"
            />
          </div>

          <div class="form-group">
            <label>YouTube URL (or direct .mp4 URL)</label>
            <input
              type="text"
              [(ngModel)]="form.youtubeUrl"
              placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
            />
            @if (previewYtId()) {
              <div class="yt-preview-strip">
                <img
                  [src]="'https://img.youtube.com/vi/' + previewYtId() + '/mqdefault.jpg'"
                  alt="YouTube preview"
                />
                <span class="yt-id-ok"><i class="pi pi-check-circle"></i> ID: {{ previewYtId() }}</span>
              </div>
            }
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Emotion</label>
              <select [(ngModel)]="form.emotion">
                @for (em of emotions; track em.value) {
                  <option [value]="em.value">{{ em.emoji }} {{ em.label }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Action</label>
              <select [(ngModel)]="form.action">
                @for (act of actions; track act.value) {
                  <option [value]="act.value">{{ act.label }}</option>
                }
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea
              rows="2"
              [(ngModel)]="form.description"
              placeholder="When should she perform this reaction?"
            ></textarea>
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label>Priority (1–10)</label>
              <input type="number" min="1" max="10" [(ngModel)]="form.priority" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <label class="checkbox-inline">
                <input type="checkbox" [(ngModel)]="form.isActive" /> Active
              </label>
            </div>
          </div>

          <div class="toggles-grid">
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="form.voiceEnabled" /> AI Voice
            </label>
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="form.videoAudioEnabled" /> Original Audio
            </label>
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="form.loopVideo" /> Loop Video
            </label>
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="form.isDefault" /> Default Video
            </label>
            <label class="checkbox-inline">
              <input type="checkbox" [(ngModel)]="form.isFallback" /> Fallback Video
            </label>
          </div>

          <div class="form-actions">
            <button type="button" class="btn-cancel" (click)="closeForm()">Cancel</button>
            <button type="button" class="btn-save" (click)="saveForm()">
              {{ editingId() ? 'Save Changes' : 'Add Video' }}
            </button>
          </div>
        </div>
      }

      <!-- Video Cards List -->
      <div class="video-list">
        @for (item of filteredVideos(); track item.id) {
          <div class="video-card" [class.inactive]="!item.isActive" [class.unlinked]="!hasSource(item)">
            <div class="card-top">
              <div class="thumb-box">
                @if (getThumb(item)) {
                  <img [src]="getThumb(item)" [alt]="item.name" />
                } @else {
                  <div class="thumb-placeholder">
                    <span>{{ getEmotionEmoji(item.emotion) }}</span>
                  </div>
                }
              </div>

              <div class="card-info">
                <div class="card-title-row">
                  <span class="card-title">{{ item.name }}</span>
                  @if (item.isDefault) {
                    <span class="pill pill-default">Default</span>
                  }
                  @if (item.isFallback) {
                    <span class="pill pill-fallback">Fallback</span>
                  }
                </div>

                <div class="card-tags">
                  <span class="tag-emotion">
                    {{ getEmotionEmoji(item.emotion) }} {{ item.emotion }}
                  </span>
                  <span class="tag-meta">{{ item.loopVideo ? 'Loop' : 'Once' }}</span>
                  <span class="tag-meta">{{ item.videoAudioEnabled ? 'Vid Audio' : 'Muted' }}</span>
                </div>

                @if (!hasSource(item)) {
                  <span class="unlinked-hint">No URL set yet — click Edit to add YouTube URL</span>
                }
              </div>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="action-btn test-btn"
                [disabled]="!hasSource(item)"
                (click)="testSync(item)"
                title="Preview video & voice sync on stage"
              >
                <i class="pi pi-play"></i> Test Sync
              </button>
              <button
                type="button"
                class="action-btn"
                (click)="openEditForm(item)"
                title="Edit video mapping"
              >
                <i class="pi pi-pencil"></i> Edit
              </button>
              <button
                type="button"
                class="action-btn"
                (click)="videoService.toggleVideoActive(item.id)"
                [title]="item.isActive ? 'Disable video' : 'Enable video'"
              >
                <i [class]="item.isActive ? 'pi pi-eye' : 'pi pi-eye-slash'"></i>
              </button>
              <button
                type="button"
                class="action-btn danger"
                (click)="videoService.deleteVideo(item.id)"
                title="Delete video"
              >
                <i class="pi pi-trash"></i>
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-list">No videos match your filter.</div>
        }
      </div>
    </div>
  `,
  styleUrl: './video-library.component.scss',
})
export class VideoLibraryComponent {
  readonly videoService = inject(GirlVideoMappingService);
  private readonly emotionService = inject(EmotionDetectionService);
  private readonly playback = inject(VideoPlaybackService);

  readonly emotions = EMOTION_CATALOG;
  readonly actions = ACTION_CATALOG;

  readonly searchTerm = signal<string>('');
  readonly selectedEmotion = signal<string>('all');
  readonly showForm = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);

  form: VideoFormModel = this.createEmptyForm();

  readonly filteredVideos = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const em = this.selectedEmotion();

    return this.videoService.videos().filter((v) => {
      if (em !== 'all' && v.emotion !== em) return false;
      if (!query) return true;
      return (
        v.name.toLowerCase().includes(query) ||
        v.emotion.toLowerCase().includes(query) ||
        v.action.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query)
      );
    });
  });

  previewYtId(): string {
    return this.videoService.extractYouTubeVideoId(this.form.youtubeUrl);
  }

  hasSource(item: GirlVideoItem): boolean {
    return this.videoService.hasPlayableSource(item);
  }

  getThumb(item: GirlVideoItem): string {
    return this.videoService.getThumbnailUrl(item);
  }

  getEmotionEmoji(emotion: GirlEmotion): string {
    return this.emotionService.getEmotionMeta(emotion).emoji;
  }

  openAddForm(): void {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
    this.showForm.set(true);
  }

  openEditForm(item: GirlVideoItem): void {
    this.editingId.set(item.id);
    this.form = {
      name: item.name,
      youtubeUrl: item.youtubeUrl,
      emotion: item.emotion,
      action: item.action,
      description: item.description,
      videoAudioEnabled: item.videoAudioEnabled,
      voiceEnabled: item.voiceEnabled,
      loopVideo: item.loopVideo,
      priority: item.priority,
      isActive: item.isActive,
      isDefault: item.isDefault,
      isFallback: item.isFallback,
    };
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  saveForm(): void {
    const cleanName = this.form.name.trim() || `${this.form.emotion} reaction`;
    const id = this.editingId();
    if (id) {
      this.videoService.updateVideo(id, {
        ...this.form,
        name: cleanName,
      });
    } else {
      this.videoService.addVideo({
        ...this.form,
        name: cleanName,
      });
    }
    this.closeForm();
  }

  testSync(item: GirlVideoItem): void {
    const sampleLine = `Testing my ${item.emotion} reaction with synchronized voice and video!`;
    void this.playback.testVideoAndVoiceSync(item, sampleLine);
  }

  private createEmptyForm(): VideoFormModel {
    return {
      name: '',
      youtubeUrl: '',
      emotion: 'happy',
      action: 'smile_while_talking',
      description: '',
      videoAudioEnabled: false,
      voiceEnabled: true,
      loopVideo: true,
      priority: 8,
      isActive: true,
      isDefault: false,
      isFallback: false,
    };
  }
}

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  AiDocumentAssistantService,
  DocumentItem,
  ChatMessage,
  SourceReference,
} from './ai-document-assistant.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-ai-document-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-document-assistant.component.html',
  styleUrls: ['./ai-document-assistant.component.scss'],
})
export class AiDocumentAssistantComponent implements OnInit, OnDestroy {
  assistantService = inject(AiDocumentAssistantService);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  userInput = '';
  isDragOver = false;

  // Modals
  showHowItWorksModal = false;
  showSettingsModal = false;
  previewDoc = signal<DocumentItem | null>(null);

  // Settings
  modelDeployment = 'gpt-5.2';
  backendEndpoint = '';
  temperature = 0.2;

  ngOnInit(): void {
    this.backendEndpoint = this.assistantService.getPythonBase();
    this.assistantService.fetchRagStatus();
  }

  ngOnDestroy(): void {
    this.assistantService.stopRagPolling();
  }

  // ── Tab Management ────────────────────────────────────────────────────────

  setTab(tab: 'chat' | 'documents' | 'extracted' | 'references'): void {
    this.assistantService.activeTab.set(tab);
    if (tab === 'extracted') {
      this.assistantService.fetchExtractedInfo();
    } else if (tab === 'references') {
      this.assistantService.fetchReferences();
    }
  }

  // ── Chat Actions ──────────────────────────────────────────────────────────

  onSendMessage(): void {
    if (!this.userInput.trim() || this.assistantService.isGenerating()) return;
    const q = this.userInput;
    this.userInput = '';
    this.assistantService.sendMessage(q);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  onNewChat(): void {
    this.assistantService.createNewChat();
  }

  onSelectConversation(id: string): void {
    this.assistantService.selectConversation(id);
  }

  onDeleteConversation(event: MouseEvent, id: string): void {
    event.stopPropagation();
    if (confirm('Delete this conversation?')) {
      this.assistantService.deleteConversation(id);
    }
  }

  onClearActiveChat(): void {
    if (confirm('Are you sure you want to clear the messages in this chat?')) {
      this.assistantService.clearActiveChat();
    }
  }

  onClearAllHistory(): void {
    if (confirm('Are you sure you want to clear ALL conversation history?')) {
      this.assistantService.clearAllConversations();
    }
  }

  copyMessage(text: string): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      this.toast.show('Copied', 'Message copied to clipboard.', 'success');
    }
  }

  onLikeMessage(msg: ChatMessage): void {
    this.assistantService.setMessageFeedback(msg.id, 'like');
  }

  onDislikeMessage(msg: ChatMessage): void {
    this.assistantService.setMessageFeedback(msg.id, 'dislike');
  }

  // ── File Upload & Dropzone ────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.assistantService.uploadFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.assistantService.uploadFiles(Array.from(event.dataTransfer.files));
    }
  }

  // ── Document Actions ──────────────────────────────────────────────────────

  onViewDocument(doc: DocumentItem): void {
    this.previewDoc.set(doc);
  }

  onSelectDoc(doc: DocumentItem): void {
    this.assistantService.toggleSelectDoc(doc);
  }

  getSafePreviewUrl(doc: DocumentItem): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.assistantService.getViewDocumentUrl(doc)
    );
  }

  onClosePreview(): void {
    this.previewDoc.set(null);
  }

  formatContent(text: string): string {
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    let inCard = false;

    for (let line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('###') || (trimmed.startsWith('📄') && !trimmed.startsWith('📄 Leaves:'))) {
        if (inCard) html += '</div>';
        inCard = true;
        const title = trimmed.replace(/^###\s*/, '');
        html += `<div class="content-policy-card"><div class="card-title">${title}</div>`;
        continue;
      }

      if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = trimmed.replace(/^[•\-\*]\s*/, '');
        const formattedBullet = bulletText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<div class="bullet-line"><span class="bullet-symbol">•</span><span>${formattedBullet}</span></div>`;
        continue;
      }

      if (trimmed.toLowerCase().startsWith('sources:') || trimmed.toLowerCase().startsWith('source:')) {
        if (inCard) {
          html += '</div>';
          inCard = false;
        }
        continue;
      }

      if (trimmed.match(/^\[?[\w\-_]+\.(?:pdf|docx|pptx|txt)/i)) {
        continue;
      }

      if (trimmed === '') {
        if (!inCard) html += '<div class="spacer-line"></div>';
        continue;
      }

      const formattedLine = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html += `<p class="prose-line">${formattedLine}</p>`;
    }

    if (inCard) html += '</div>';
    return html;
  }

  onDownloadDocument(doc: DocumentItem): void {
    this.assistantService.downloadDocument(doc);
  }

  onRemoveDocument(docId: string): void {
    if (confirm('Are you sure you want to remove this document?')) {
      this.assistantService.removeDocument(docId);
    }
  }

  onRetryDocument(docId: string): void {
    this.assistantService.retryDocument(docId);
  }

  onSourceClick(src: SourceReference): void {
    const doc = this.assistantService.documents().find((d) => d.name === src.document);
    if (doc) {
      this.onViewDocument(doc);
    } else {
      this.toast.show('Source Document', `${src.document} (Page ${src.page || 1})`, 'info');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  getFileIconClass(ext?: string): string {
    switch (ext?.toLowerCase()) {
      case 'pdf':
        return 'badge-pdf';
      case 'docx':
      case 'doc':
        return 'badge-docx';
      case 'pptx':
      case 'ppt':
        return 'badge-pptx';
      case 'txt':
      default:
        return 'badge-txt';
    }
  }

  getFileBadgeLabel(ext?: string): string {
    switch (ext?.toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'docx':
      case 'doc':
        return 'DOCX';
      case 'pptx':
      case 'ppt':
        return 'PPT';
      case 'txt':
      default:
        return 'TXT';
    }
  }

  saveSettings(): void {
    this.showSettingsModal = false;
    this.toast.show('Settings Saved', 'AI Document Assistant preferences updated.', 'success');
  }
}

import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-content-video',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './content-video.component.html',
  styleUrls: ['./content-video.component.scss']
})
export class ContentVideoComponent {
  content = signal<string>('');
  
  // Voice Controls
  voiceDeep = signal<number>(50);
  voiceStability = signal<number>(50);
  voiceSpeed = signal<number>(1.0);
  voicePitch = signal<number>(0);

  // Slide Controls
  slideSpeed = signal<string>('normal');
  animationType = signal<string>('fade');

  isGenerating = signal<boolean>(false);
  generatedVideoUrl = signal<string | null>(null);

  async generateVideo(): Promise<void> {
    if (!this.content().trim()) return;

    this.isGenerating.set(true);
    this.generatedVideoUrl.set(null);

    try {
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: this.content(),
          voiceDeep: this.voiceDeep(),
          voiceStability: this.voiceStability(),
          voiceSpeed: this.voiceSpeed(),
          voicePitch: this.voicePitch(),
          slideSpeed: this.slideSpeed(),
          animationType: this.animationType()
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        this.generatedVideoUrl.set(data.videoUrl);
      } else {
        alert(data.error || 'Failed to generate video');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while calling the video API.');
    } finally {
      this.isGenerating.set(false);
    }
  }

  downloadVideo(): void {
    if (!this.generatedVideoUrl()) return;
    alert('Video download will start shortly...');
  }
}

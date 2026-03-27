import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TtsService {
  private synth = window.speechSynthesis;

  speak(text: string) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }

    if (text !== '') {
      const utterThis = new SpeechSynthesisUtterance(text);
      utterThis.onend = (event) => {
        console.log('SpeechSynthesisUtterance.onend');
      };
      utterThis.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
      };
      this.synth.speak(utterThis);
    }
  }

  stop() {
    this.synth.cancel();
  }
}

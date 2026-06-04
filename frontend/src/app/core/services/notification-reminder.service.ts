import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface NotificationReminder {
  id: string;
  title: string;
  body: string;
  triggerAt: Date;
  alarmUrl?: string;
  speechText?: string;
  useSpeech?: boolean;
  metadata?: Record<string, string>;
}

type ReminderNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class NotificationReminderService implements OnDestroy {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private audioContext?: AudioContext;
  private alarmBuffers = new Map<string, AudioBuffer>();
  private reminderTriggeredSubject = new Subject<NotificationReminder>();
  readonly reminderTriggered$: Observable<NotificationReminder> = this.reminderTriggeredSubject.asObservable();

  get permission(): NotificationPermission | 'unsupported' {
    if (!this.isNotificationSupported()) {
      return 'unsupported';
    }

    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isNotificationSupported()) {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    try {
      return await Notification.requestPermission();
    } catch (e) {
      return 'default';
    }
  }

  async prepareAlarm(alarmUrl: string): Promise<void> {
    const audioContext = this.getAudioContext();
    if (!audioContext) {
      await this.unlockHtmlAudio(alarmUrl);
      return;
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    this.playSilentUnlock(audioContext);

    const absoluteUrl = this.toAbsoluteUrl(alarmUrl);
    if (this.alarmBuffers.has(absoluteUrl)) {
      return;
    }

    const response = await fetch(absoluteUrl);
    const alarmData = await response.arrayBuffer();
    const alarmBuffer = await audioContext.decodeAudioData(alarmData);
    this.alarmBuffers.set(absoluteUrl, alarmBuffer);
  }

  schedule(reminder: NotificationReminder): void {
    this.cancel(reminder.id);

    // Ensure we have requested permission early so background notifications can show
    if (this.isNotificationSupported() && Notification.permission !== 'granted') {
      // fire-and-forget — user gesture might be required in some browsers
      this.requestPermission().catch(() => undefined);
    }

    const delay = reminder.triggerAt.getTime() - Date.now();
    if (delay <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.trigger(reminder);
      this.timers.delete(reminder.id);
    }, delay);

    this.timers.set(reminder.id, timer);
  }

  scheduleAll(reminders: NotificationReminder[]): void {
    this.cancelAll();
    reminders.forEach(reminder => this.schedule(reminder));
  }

  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(id);
  }

  cancelAll(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  ngOnDestroy(): void {
    this.cancelAll();
  }

  private trigger(reminder: NotificationReminder): void {
    this.reminderTriggeredSubject.next(reminder);

    if (this.isNotificationSupported()) {
      const show = async () => {
        if (Notification.permission !== 'granted') {
          const p = await this.requestPermission();
          if (p !== 'granted') {
            return;
          }
        }

        const options: ReminderNotificationOptions = {
          body: reminder.body,
          tag: reminder.id,
          renotify: true,
          requireInteraction: true,
          data: reminder.metadata,
        };

        // Prefer showing notification via Service Worker registration when available.
        try {
          const reg = await navigator.serviceWorker?.getRegistration?.();
          if (reg && typeof reg.showNotification === 'function') {
            reg.showNotification(reminder.title, options).catch(() => {
              // fallback to Notification constructor
              try {
                // eslint-disable-next-line no-new
                new Notification(reminder.title, options);
              } catch (e) {
                /* ignore */
              }
            });
          } else {
            // Fallback: use the Notification constructor (should show even if tab hidden)
            // eslint-disable-next-line no-new
            new Notification(reminder.title, options);
          }
        } catch (e) {
          try {
            // eslint-disable-next-line no-new
            new Notification(reminder.title, options);
          } catch (err) {
            /* ignore */
          }
        }
      };

      // fire and forget
      void show();
    }

    this.playAlarm(reminder.alarmUrl);

    if (reminder.useSpeech && reminder.speechText) {
      this.speak(reminder.speechText);
    }
  }

  private playAlarm(alarmUrl?: string): void {
    if (!alarmUrl) {
      return;
    }

    if (this.playBufferedAlarm(alarmUrl)) {
      return;
    }

    const audio = new Audio(this.toAbsoluteUrl(alarmUrl));
    audio.play().catch(error => console.warn('Unable to play reminder alarm', error));
  }

  private playBufferedAlarm(alarmUrl: string): boolean {
    const audioContext = this.audioContext;
    const alarmBuffer = this.alarmBuffers.get(this.toAbsoluteUrl(alarmUrl));
    if (!audioContext || !alarmBuffer) {
      return false;
    }

    const source = audioContext.createBufferSource();
    source.buffer = alarmBuffer;
    source.connect(audioContext.destination);
    source.start();
    return true;
  }

  private speak(text: string): void {
    if (!('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  private isNotificationSupported(): boolean {
    return 'Notification' in window;
  }

  private getAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }

  private playSilentUnlock(audioContext: AudioContext): void {
    const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  }

  private async unlockHtmlAudio(alarmUrl: string): Promise<void> {
    const audio = new Audio(this.toAbsoluteUrl(alarmUrl));
    audio.muted = true;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
  }

  private toAbsoluteUrl(url: string): string {
    return new URL(url, document.baseURI).toString();
  }
}

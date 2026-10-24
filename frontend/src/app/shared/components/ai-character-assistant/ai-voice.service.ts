import { Injectable, inject, signal, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface VoiceOption {
  name: string;
  displayName: string;
  locale: string;
  gender: string;
}

export type WakeWordStatus =
  | 'idle'
  | 'listening-for-wake'
  | 'capturing-speech'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'permission-denied';

@Injectable({
  providedIn: 'root'
})
export class AiVoiceService {
  private ngZone = inject(NgZone);

  // Storage keys
  private readonly STORAGE_NAME_KEY = 'u2_agent_voice_name';
  private readonly STORAGE_ENABLED_KEY = 'u2_agent_voice_enabled';
  private readonly STORAGE_VOICE_KEY = 'u2_agent_voice_selection';

  // Configurable Agent Name
  readonly agentName = signal<string>('Maya');

  // Voice Interaction Enabled State
  readonly isVoiceEnabled = signal<boolean>(false);

  // Selected Azure TTS Voice
  readonly selectedVoice = signal<string>('en-US-JennyNeural');

  // Available Voices
  readonly availableVoices = signal<VoiceOption[]>([
    {
      name: 'en-US-JennyNeural',
      displayName: 'Jenny (US - Female, Warm & Natural)',
      locale: 'en-US',
      gender: 'Female'
    },
    {
      name: 'en-US-AvaNeural',
      displayName: 'Ava (US - Female, Expressive)',
      locale: 'en-US',
      gender: 'Female'
    },
    {
      name: 'en-US-EmmaNeural',
      displayName: 'Emma (US - Female, Friendly)',
      locale: 'en-US',
      gender: 'Female'
    },
    {
      name: 'en-US-AriaNeural',
      displayName: 'Aria (US - Female, Confident)',
      locale: 'en-US',
      gender: 'Female'
    },
    {
      name: 'en-US-GuyNeural',
      displayName: 'Guy (US - Male, Natural)',
      locale: 'en-US',
      gender: 'Male'
    },
    {
      name: 'en-US-AndrewNeural',
      displayName: 'Andrew (US - Male, Conversational)',
      locale: 'en-US',
      gender: 'Male'
    },
    {
      name: 'en-US-BrianNeural',
      displayName: 'Brian (US - Male, Professional)',
      locale: 'en-US',
      gender: 'Male'
    },
    {
      name: 'en-GB-SoniaNeural',
      displayName: 'Sonia (UK - Female, Cheerful)',
      locale: 'en-GB',
      gender: 'Female'
    },
    {
      name: 'en-GB-RyanNeural',
      displayName: 'Ryan (UK - Male, Natural)',
      locale: 'en-GB',
      gender: 'Male'
    },
    {
      name: 'en-IN-NeerjaNeural',
      displayName: 'Neerja (India - Female, Friendly)',
      locale: 'en-IN',
      gender: 'Female'
    },
    {
      name: 'en-IN-PrabhatNeural',
      displayName: 'Prabhat (India - Male, Natural)',
      locale: 'en-IN',
      gender: 'Male'
    }
  ]);

  // Voice State Signals
  readonly wakeWordStatus = signal<WakeWordStatus>('idle');
  readonly statusMessage = signal<string>('Voice interaction ready.');
  readonly isSpeaking = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);
  readonly isMicRecording = signal<boolean>(false);
  readonly liveTranscript = signal<string>('');
  readonly hasPermission = signal<boolean>(true);

  // Audio Playback
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  // Speech Recognition (Wake Word)
  private recognition: any = null;
  private isCapturingSpeech = false;
  private capturedSegments: string[] = [];
  private restartTimeoutId: any = null;
  private isProcessingPrompt = false;
  private silenceTimer: any = null;

  // Dedicated Microphone Input (STT.py / Speech-to-Text integration)
  private micMediaRecorder: MediaRecorder | null = null;
  private micAudioChunks: Blob[] = [];
  private micStream: MediaStream | null = null;
  private micRecognition: any = null;
  private micTranscript = '';
  private wasWakeWordActiveBeforeMic = false;
  private micSilenceTimer: any = null;

  // Callback hook to send speech to the AI Assistant LLM
  private onUserSpokenMessageCallback: ((text: string) => Promise<void>) | null = null;

  constructor() {
    this.loadSettings();
    this.initSpeechRecognition();
    this.fetchRemoteVoices();
  }

  // ── Settings Persistence ──────────────────────────────────────────

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedName = localStorage.getItem(this.STORAGE_NAME_KEY);
      if (savedName && savedName.trim()) {
        this.agentName.set(savedName.trim());
      }

      const savedEnabled = localStorage.getItem(this.STORAGE_ENABLED_KEY);
      if (savedEnabled === 'true') {
        this.isVoiceEnabled.set(true);
      }

      const savedVoice = localStorage.getItem(this.STORAGE_VOICE_KEY);
      if (savedVoice && savedVoice.trim()) {
        this.selectedVoice.set(savedVoice.trim());
      }
    } catch (e) {
      console.warn('Could not load voice settings from localStorage', e);
    }
  }

  setAgentName(name: string): void {
    const clean = (name || '').trim();
    if (!clean) return;
    this.agentName.set(clean);
    try {
      localStorage.setItem(this.STORAGE_NAME_KEY, clean);
    } catch {}
    this.updateStatusMessage();
  }

  setSelectedVoice(voiceName: string): void {
    if (!voiceName) return;
    this.selectedVoice.set(voiceName);
    try {
      localStorage.setItem(this.STORAGE_VOICE_KEY, voiceName);
    } catch {}
  }

  toggleVoiceEnabled(): void {
    const next = !this.isVoiceEnabled();
    this.isVoiceEnabled.set(next);
    try {
      localStorage.setItem(this.STORAGE_ENABLED_KEY, String(next));
    } catch {}

    if (next) {
      this.startWakeWordListening();
    } else {
      this.stopWakeWordListening();
    }
  }

  setVoiceEnabled(enabled: boolean): void {
    if (this.isVoiceEnabled() === enabled) return;
    this.isVoiceEnabled.set(enabled);
    try {
      localStorage.setItem(this.STORAGE_ENABLED_KEY, String(enabled));
    } catch {}

    if (enabled) {
      this.startWakeWordListening();
    } else {
      this.stopWakeWordListening();
    }
  }

  registerMessageDispatcher(callback: (text: string) => Promise<void>): void {
    this.onUserSpokenMessageCallback = callback;
  }

  // ── Fetch Voices from Backend ─────────────────────────────────────

  private async fetchRemoteVoices(): Promise<void> {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const endpoints = isLocal
      ? [
          'http://127.0.0.1:8000/api/voice/voices',
          'http://localhost:8000/api/voice/voices',
          `${pythonBase}/api/voice/voices`,
          '/api/voice/voices'
        ]
      : [
          `${pythonBase}/api/voice/voices`,
          '/api/voice/voices',
          'http://127.0.0.1:8000/api/voice/voices',
          'http://localhost:8000/api/voice/voices'
        ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.voices) && data.voices.length > 0) {
            this.ngZone.run(() => {
              this.availableVoices.set(data.voices);
            });
            return;
          }
        }
      } catch {
        // try next endpoint
      }
    }
  }

  // ── Speech Recognition Engine (Wake Word & Speech Capture) ─────────

  private initSpeechRecognition(): void {
    if (typeof window === 'undefined') return;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      this.wakeWordStatus.set('error');
      this.statusMessage.set('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.ngZone.run(() => {
          this.hasPermission.set(true);
          if (this.isCapturingSpeech) {
            this.wakeWordStatus.set('capturing-speech');
            this.isListening.set(true);
            this.statusMessage.set(`Listening to you... Say "That's it, ${this.agentName()}" when finished.`);
          } else {
            this.wakeWordStatus.set('listening-for-wake');
            this.isListening.set(false);
            this.statusMessage.set(`Listening for "Hi ${this.agentName()}"...`);
          }
        });
      };

      this.recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          this.handleSpeechRecognitionResult(event);
        });
      };

      this.recognition.onerror = (event: any) => {
        this.ngZone.run(() => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this.hasPermission.set(false);
            this.wakeWordStatus.set('permission-denied');
            this.statusMessage.set('Microphone permission required for voice interaction.');
            this.isCapturingSpeech = false;
            this.isListening.set(false);
          } else if (event.error === 'no-speech') {
            // expected when quiet
          } else {
            console.warn('Speech recognition warning/error:', event.error);
          }
        });
      };

      this.recognition.onend = () => {
        this.ngZone.run(() => {
          if (this.isVoiceEnabled() && !this.isProcessingPrompt && this.wakeWordStatus() !== 'permission-denied') {
            this.scheduleRestart(300);
          } else if (!this.isVoiceEnabled()) {
            this.wakeWordStatus.set('idle');
            this.statusMessage.set('Voice interaction paused.');
            this.isListening.set(false);
          }
        });
      };

      if (this.isVoiceEnabled()) {
        this.startWakeWordListening();
      }
    } catch (e) {
      console.warn('Error setting up speech recognition:', e);
      this.wakeWordStatus.set('error');
      this.statusMessage.set('Voice recognition error.');
    }
  }

  private scheduleRestart(delayMs = 300): void {
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
    }
    this.restartTimeoutId = setTimeout(() => {
      if (this.isVoiceEnabled() && !this.isSpeaking() && !this.isProcessingPrompt) {
        try {
          this.recognition?.start();
        } catch {
          // Ignore already started errors
        }
      }
    }, delayMs);
  }

  startWakeWordListening(): void {
    if (!this.recognition) {
      this.initSpeechRecognition();
      if (!this.recognition) return;
    }

    this.isCapturingSpeech = false;
    this.capturedSegments = [];
    this.liveTranscript.set('');
    this.updateStatusMessage();

    try {
      this.recognition.start();
    } catch (e) {
      // recognition may already be started
    }
  }

  stopWakeWordListening(): void {
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }
    this.isCapturingSpeech = false;
    this.capturedSegments = [];
    this.liveTranscript.set('');
    this.isListening.set(false);
    this.wakeWordStatus.set('idle');
    this.statusMessage.set('Voice interaction paused.');

    try {
      this.recognition?.stop();
    } catch {}
  }

  async requestMicPermission(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      this.hasPermission.set(true);
      this.startWakeWordListening();
    } catch (err) {
      this.hasPermission.set(false);
      this.wakeWordStatus.set('permission-denied');
      this.statusMessage.set('Microphone permission was denied. Please allow it in browser settings.');
    }
  }

  // ── Speech Stream Parser & Pattern Matcher ────────────────────────

  private handleSpeechRecognitionResult(event: any): void {
    // Collect all transcript pieces
    let fullFinal = '';
    let currentInterim = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        fullFinal += ' ' + transcript;
      } else {
        currentInterim += ' ' + transcript;
      }
    }

    const currentSpoken = (fullFinal + ' ' + currentInterim).trim();
    if (!currentSpoken) return;

    this.liveTranscript.set(currentSpoken);

    const name = this.agentName().toLowerCase();

    // ── STAGE 1: Listening for Wake Word ("Hi <agentname>") ──────────
    if (!this.isCapturingSpeech) {
      // Regex matches: "Hi Maya", "Hey Maya", "Hello Maya"
      const wakePattern = new RegExp(`\\b(?:hi|hey|hello)\\s+${this.escapeRegex(name)}\\b`, 'i');
      const match = currentSpoken.match(wakePattern);

      if (match && match.index !== undefined) {
        this.triggerWakeWordActivated(currentSpoken, match.index + match[0].length);
      }
      return;
    }

    // ── STAGE 2: Capturing Speech Until End Phrase ("That's it, <agentname>") OR Silence ──
    if (this.isCapturingSpeech) {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }

      // Regex matches: "That's it, Maya", "Thats it Maya", "That is it Maya", or "That's it"
      const endPatternWithName = new RegExp(
        `\\b(?:that's\\s+it|thats\\s+it|that\\s+is\\s+it)[,\\s]+${this.escapeRegex(name)}\\b`,
        'i'
      );
      const endPatternGeneral = /\b(?:that's\\s+it|thats\\s+it|that\\s+is\\s+it)\b/i;

      let endMatch = currentSpoken.match(endPatternWithName) || currentSpoken.match(endPatternGeneral);

      if (endMatch && endMatch.index !== undefined) {
        // Cut out the final user query up to the end phrase
        const speechBeforeEnd = currentSpoken.substring(0, endMatch.index);
        this.finishCapturingAndProcess(speechBeforeEnd);
        return;
      }

      // Auto-finalize capture if the user paused speaking for 2.4 seconds after uttering a question
      this.silenceTimer = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.isCapturingSpeech && !this.isProcessingPrompt) {
            const captured = this.liveTranscript().trim();
            if (captured.length >= 2) {
              this.finishCapturingAndProcess(captured);
            }
          }
        });
      }, 2400);
    }
  }

  private triggerWakeWordActivated(currentSpoken: string, speechStartIndex: number): void {
    this.isCapturingSpeech = true;
    this.isListening.set(true);
    this.wakeWordStatus.set('capturing-speech');
    this.statusMessage.set(`Listening to you... Say "That's it, ${this.agentName()}" or pause when finished.`);

    // Play subtle pleasant wake chime
    this.playChime(true);

    // If user already started speaking prompt in the same phrase after "Hi Maya":
    const remainingText = currentSpoken.substring(speechStartIndex).trim();
    if (remainingText) {
      this.capturedSegments = [remainingText];
      this.liveTranscript.set(remainingText);
    } else {
      this.capturedSegments = [];
      this.liveTranscript.set('');
    }
  }

  private async finishCapturingAndProcess(capturedText: string): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.isProcessingPrompt) return;
    this.isProcessingPrompt = true;

    this.isCapturingSpeech = false;
    this.isListening.set(false);
    this.wakeWordStatus.set('processing');
    this.statusMessage.set('Processing your voice request...');

    // Play subtle soft processing chime
    this.playChime(false);

    // Clean transcript: strip any residual wake word or punctuation
    const name = this.agentName().toLowerCase();
    const cleanPattern = new RegExp(`^\\s*(?:hi|hey|hello)?\\s*${this.escapeRegex(name)}[,\\s]*`, 'i');
    let prompt = capturedText.replace(cleanPattern, '').trim();

    // Also strip trailing punctuation or residual end markers
    prompt = prompt.replace(/(?:that's\s+it|thats\s+it|that\s+is\s+it).*$/i, '').trim();

    try {
      // Temporarily stop recognition so AI speech isn't heard as user input
      try {
        this.recognition?.stop();
      } catch {}

      if (!prompt || prompt.length < 2) {
        // Nothing was captured between wake word and end phrase
        await this.speak(
          `I heard you say hi! How can I help you today? Ask me any question or tell me what to do.`
        );
      } else {
        // Dispatch to AI Assistant LLM
        if (this.onUserSpokenMessageCallback) {
          await this.onUserSpokenMessageCallback(prompt);
        }
      }
    } catch (e) {
      console.warn('Error processing voice query:', e);
      this.statusMessage.set('Error processing voice request.');
    } finally {
      this.isProcessingPrompt = false;
      this.liveTranscript.set('');
      if (this.isVoiceEnabled()) {
        this.wakeWordStatus.set('listening-for-wake');
        this.updateStatusMessage();
        this.scheduleRestart(600);
      } else {
        this.wakeWordStatus.set('idle');
      }
    }
  }

  // ── Dedicated Microphone Input (STT.py / Speech-to-Text) ──────────

  async toggleMicrophoneInput(): Promise<void> {
    if (this.isMicRecording()) {
      await this.stopMicrophoneInput();
    } else {
      await this.startMicrophoneInput();
    }
  }

  async startMicrophoneInput(): Promise<void> {
    if (this.isSpeaking()) {
      this.stopSpeaking();
    }

    // Pause wake-word recognition if running to avoid microphone lock contention
    this.wasWakeWordActiveBeforeMic = this.isVoiceEnabled();
    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }
    try {
      this.recognition?.stop();
    } catch {}

    this.isCapturingSpeech = false;
    this.micTranscript = '';
    this.liveTranscript.set('');
    this.micAudioChunks = [];

    try {
      // Request mic stream for audio recording (STT.py)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      this.hasPermission.set(true);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      this.micMediaRecorder = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.micAudioChunks.push(event.data);
        }
      };

      mediaRecorder.start(250);
    } catch (err) {
      console.warn('MediaRecorder not available or permission denied:', err);
    }

    // Simultaneously initialize high-precision live browser speech recognition for real-time preview & fallback
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const micRec = new SpeechRec();
        micRec.continuous = false;
        micRec.interimResults = true;
        micRec.lang = 'en-US';

        micRec.onresult = (event: any) => {
          this.ngZone.run(() => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const text = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                this.micTranscript = text;
              } else {
                interim += ' ' + text;
              }
            }
            const full = (this.micTranscript || interim).trim();
            if (full) {
              this.liveTranscript.set(full);
            }

            // Auto-stop after 2.4s silence if something was transcribed
            if (this.micSilenceTimer) {
              clearTimeout(this.micSilenceTimer);
            }
            this.micSilenceTimer = setTimeout(() => {
              if (this.isMicRecording() && (this.micTranscript || full)) {
                this.stopMicrophoneInput();
              }
            }, 2400);
          });
        };

        micRec.onerror = (e: any) => {
          console.warn('Mic speech recognition event:', e.error);
        };

        micRec.onend = () => {
          // If browser recognition ended with transcript, finish input
          if (this.isMicRecording() && this.liveTranscript().trim()) {
            this.stopMicrophoneInput();
          }
        };

        micRec.start();
        this.micRecognition = micRec;
      } catch (e) {
        console.warn('SpeechRecognition start failed:', e);
      }
    }

    this.ngZone.run(() => {
      this.isMicRecording.set(true);
      this.isListening.set(true);
      this.wakeWordStatus.set('capturing-speech');
      this.statusMessage.set('Listening... Speak your question, then click mic or pause to finish.');
      this.playChime(true);
    });
  }

  async stopMicrophoneInput(): Promise<void> {
    if (!this.isMicRecording()) return;

    if (this.micSilenceTimer) {
      clearTimeout(this.micSilenceTimer);
      this.micSilenceTimer = null;
    }

    this.ngZone.run(() => {
      this.isMicRecording.set(false);
      this.isListening.set(false);
      this.wakeWordStatus.set('processing');
      this.statusMessage.set('Processing your voice request...');
      this.playChime(false);
    });

    // Stop speech recognition
    try {
      this.micRecognition?.stop();
    } catch {}
    this.micRecognition = null;

    // Stop MediaRecorder and grab audio blob
    let recordedBlob: Blob | null = null;
    if (this.micMediaRecorder && this.micMediaRecorder.state !== 'inactive') {
      try {
        const blobPromise = new Promise<Blob>((resolve) => {
          if (!this.micMediaRecorder) return resolve(new Blob());
          this.micMediaRecorder.onstop = () => {
            const blob = new Blob(this.micAudioChunks, { type: this.micMediaRecorder?.mimeType || 'audio/webm' });
            resolve(blob);
          };
        });
        this.micMediaRecorder.stop();
        recordedBlob = await blobPromise;
      } catch {
        // ignore
      }
    }

    // Stop tracks
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }

    let finalPrompt = (this.micTranscript || this.liveTranscript()).trim();

    // Try Azure STT backend (STT.py) if recorded audio blob is valid
    if (recordedBlob && recordedBlob.size > 500) {
      const serverTranscript = await this.transcribeAudioWithBackendSTT(recordedBlob);
      if (serverTranscript && serverTranscript.length > 0) {
        finalPrompt = serverTranscript;
      }
    }

    if (!finalPrompt || finalPrompt.length < 2) {
      this.ngZone.run(() => {
        this.wakeWordStatus.set(this.wasWakeWordActiveBeforeMic ? 'listening-for-wake' : 'idle');
        this.updateStatusMessage();
        if (this.wasWakeWordActiveBeforeMic) {
          this.scheduleRestart(400);
        }
      });
      return;
    }

    // Dispatch to AI Assistant LLM & Chat
    try {
      if (this.onUserSpokenMessageCallback) {
        await this.onUserSpokenMessageCallback(finalPrompt);
      }
    } catch (e) {
      console.warn('Error handling spoken message:', e);
    } finally {
      this.ngZone.run(() => {
        this.liveTranscript.set('');
        if (this.wasWakeWordActiveBeforeMic && this.isVoiceEnabled()) {
          this.wakeWordStatus.set('listening-for-wake');
          this.updateStatusMessage();
          this.scheduleRestart(600);
        } else {
          this.wakeWordStatus.set('idle');
          this.updateStatusMessage();
        }
      });
    }
  }

  /**
   * Calls the existing STT.py backend endpoint (/api/voice/stt) to transcribe recorded speech.
   */
  private async transcribeAudioWithBackendSTT(audioBlob: Blob): Promise<string | null> {
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const endpoints = isLocal
      ? [
          'http://127.0.0.1:8000/api/voice/stt',
          'http://localhost:8000/api/voice/stt',
          `${pythonBase}/api/voice/stt`,
          '/api/voice/stt'
        ]
      : [
          `${pythonBase}/api/voice/stt`,
          '/api/voice/stt',
          'http://127.0.0.1:8000/api/voice/stt',
          'http://localhost:8000/api/voice/stt'
        ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
          body: audioBlob,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'success' && data.text) {
            return data.text.trim();
          }
        }
      } catch {
        // try next endpoint
      }
    }
    return null;
  }

  private updateStatusMessage(): void {
    if (!this.isVoiceEnabled()) {
      this.statusMessage.set('Voice interaction paused.');
    } else if (this.isCapturingSpeech) {
      this.statusMessage.set(`Listening to you... Say "That's it, ${this.agentName()}" when finished.`);
    } else {
      this.statusMessage.set(`Say "Hi ${this.agentName()}" to talk`);
    }
  }

  // ── Microsoft Foundry Azure TTS (Text-to-Speech) ──────────────────

  /**
   * Speaks the response aloud using Microsoft Foundry Azure Text-to-Speech (TTS.py).
   * Automatically synchronizes avatar animation poses while speaking.
   */
  async speak(text: string, voiceName?: string): Promise<void> {
    const raw = (text || '').trim();
    if (!raw) return;

    // Clean up markdown fences, links, and emojis
    const clean = raw
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[✅🚀👋💡⭐🎉•\-\—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    this.stopSpeaking();
    this.isSpeaking.set(true);
    this.wakeWordStatus.set('speaking');

    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const voice = voiceName || this.selectedVoice();
    const pythonBase = (environment.pythonApiBaseUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    const endpoints = isLocal
      ? [
          'http://127.0.0.1:8000/api/voice/tts',
          'http://localhost:8000/api/voice/tts',
          `${pythonBase}/api/voice/tts`,
          '/api/voice/tts'
        ]
      : [
          `${pythonBase}/api/voice/tts`,
          '/api/voice/tts',
          'http://127.0.0.1:8000/api/voice/tts',
          'http://localhost:8000/api/voice/tts'
        ];

    let audioBlob: Blob | null = null;

    // Try Azure TTS backend endpoints (Microsoft Foundry TTS.py)
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, voice }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          audioBlob = await res.blob();
          break;
        }
      } catch {
        // try next endpoint
      }
    }

    if (audioBlob && audioBlob.size > 200) {
      await this.playAudioBlob(audioBlob);
    } else {
      // Seamless browser Web Speech fallback if backend is offline
      await this.fallbackBrowserSpeech(clean);
    }
  }

  private playAudioBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
        }
        const url = URL.createObjectURL(blob);
        this.currentAudioUrl = url;
        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.onplay = () => {
          this.ngZone.run(() => {
            this.isSpeaking.set(true);
          });
        };

        audio.onended = () => {
          this.ngZone.run(() => {
            this.isSpeaking.set(false);
            if (this.isVoiceEnabled() && !this.isProcessingPrompt) {
              this.wakeWordStatus.set('listening-for-wake');
              this.updateStatusMessage();
              this.scheduleRestart(400);
            } else {
              this.wakeWordStatus.set('idle');
            }
            this.cleanupAudio();
            resolve();
          });
        };

        audio.onerror = () => {
          this.ngZone.run(() => {
            this.isSpeaking.set(false);
            this.cleanupAudio();
            resolve();
          });
        };

        audio.play().catch(() => {
          this.isSpeaking.set(false);
          this.cleanupAudio();
          resolve();
        });
      } catch {
        this.isSpeaking.set(false);
        this.cleanupAudio();
        resolve();
      }
    });
  }

  private fallbackBrowserSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.isSpeaking.set(false);
        resolve();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find(v => v.name.includes('Natural') || v.name.includes('Jenny') || v.name.includes('Female')) ||
          voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => {
          this.ngZone.run(() => this.isSpeaking.set(true));
        };

        utterance.onend = () => {
          this.ngZone.run(() => {
            this.isSpeaking.set(false);
            if (this.isVoiceEnabled() && !this.isProcessingPrompt) {
              this.wakeWordStatus.set('listening-for-wake');
              this.updateStatusMessage();
              this.scheduleRestart(400);
            }
            resolve();
          });
        };

        utterance.onerror = () => {
          this.ngZone.run(() => {
            this.isSpeaking.set(false);
            resolve();
          });
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        this.isSpeaking.set(false);
        resolve();
      }
    });
  }

  stopSpeaking(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.cleanupAudio();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking.set(false);
  }

  private cleanupAudio(): void {
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.currentAudio = null;
  }

  previewSelectedVoice(): void {
    const voice = this.selectedVoice();
    const name = this.agentName();
    this.speak(`Hi! I'm ${name}, your U2 Assistant voice powered by Microsoft Foundry.`, voice);
  }

  // ── Audio Feedback Chime (Web Audio API) ─────────────────────────

  private playChime(isWake: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (isWake) {
        // Two-tone rising chime (wake word detected)
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Soft single chime (captured)
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext may be restricted by browser policy before first interaction
    }
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

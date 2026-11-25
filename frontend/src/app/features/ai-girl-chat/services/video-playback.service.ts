import { Injectable, inject, signal } from '@angular/core';
import {
  GirlAction,
  GirlEmotion,
  GirlVideoItem,
  StructuredGirlResponse,
} from '../models/girl-chat.models';
import { GirlVideoMappingService } from './girl-video-mapping.service';
import { SynthesizedSpeech, TextToSpeechService } from './text-to-speech.service';

export interface ActiveVideoCommand {
  video: GirlVideoItem | null;
  emotion: GirlEmotion;
  action: GirlAction;
  muteVideo: boolean;
  loopVideo: boolean;
  playNonce: number;
}

@Injectable({
  providedIn: 'root',
})
export class VideoPlaybackService {
  private readonly videoMapping = inject(GirlVideoMappingService);
  private readonly tts = inject(TextToSpeechService);

  private nonceCounter = 0;

  readonly currentCommand = signal<ActiveVideoCommand>({
    video: null,
    emotion: 'neutral',
    action: 'look_directly_talking',
    muteVideo: true,
    loopVideo: true,
    playNonce: 0,
  });

  readonly isVideoPlaying = signal<boolean>(false);
  readonly isSynchronizing = signal<boolean>(false);

  /**
   * Coordinates simultaneous reaction video + generated female voice playback.
   * Pre-synthesizes speech first, resolves the matched video, then launches both together.
   */
  async playSynchronizedReaction(
    response: StructuredGirlResponse,
    messageId: string,
    overrides: {
      overrideVideoAudio: boolean;
      overrideLoopVideo: boolean;
    },
  ): Promise<SynthesizedSpeech> {
    this.isSynchronizing.set(true);
    this.tts.stop();

    const matchedVideo = this.videoMapping.resolveVideo(
      response.emotion,
      response.action,
      response.videoId,
    );

    const videoAudioEnabled = overrides.overrideVideoAudio
      ? true
      : matchedVideo
        ? matchedVideo.videoAudioEnabled
        : response.videoAudioEnabled;

    const loopVideo = overrides.overrideLoopVideo
      ? true
      : matchedVideo
        ? matchedVideo.loopVideo
        : response.loopVideo;

    const shouldSpeak =
      response.voiceEnabled &&
      this.tts.settings().enabled &&
      (matchedVideo ? matchedVideo.voiceEnabled : true);

    // Pre-synthesize speech audio BEFORE starting the video so both begin together
    const speech = shouldSpeak
      ? await this.tts.synthesize(response.responseText, response.language, response.voiceStyle)
      : {
          audioUrl: null,
          durationSec: 0,
          usedFallbackBrowserTts: false,
          text: response.responseText,
          language: response.language,
          voiceStyle: response.voiceStyle,
        };

    this.isSynchronizing.set(false);

    // Launch video and voice simultaneously
    this.triggerVideo(matchedVideo, response.emotion, response.action, !videoAudioEnabled, loopVideo);

    if (shouldSpeak) {
      void this.tts.playSpeech(speech, messageId, () => {
        // When speech finishes, smoothly settle on default/neutral if we were in a non-looping reaction
        const cmd = this.currentCommand();
        if (!cmd.loopVideo) {
          this.settleToIdle();
        }
      });
    }

    return speech;
  }

  /**
   * Preview a specific video (and optionally test synchronized voice) from the Video Library.
   */
  async testVideoAndVoiceSync(video: GirlVideoItem, sampleText: string): Promise<void> {
    this.tts.stop();
    const shouldSpeak = video.voiceEnabled && this.tts.settings().enabled;
    const speech = shouldSpeak
      ? await this.tts.synthesize(sampleText, 'en', 'cheerful')
      : null;

    this.triggerVideo(
      video,
      video.emotion,
      video.action,
      !video.videoAudioEnabled,
      video.loopVideo,
    );

    if (speech && shouldSpeak) {
      void this.tts.playSpeech(speech, null);
    }
  }

  /**
   * Called by GirlVideoPlayerComponent when a non-looping video reaches ENDED state.
   * If AI voice is still speaking, seamlessly transition to the default/neutral talking video.
   */
  handleVideoEnded(): void {
    const cmd = this.currentCommand();
    if (cmd.loopVideo) {
      // Re-trigger loop
      this.triggerVideo(cmd.video, cmd.emotion, cmd.action, cmd.muteVideo, true);
      return;
    }

    if (this.tts.isSpeaking()) {
      const neutralFallback = this.videoMapping.getDefaultVideo();
      if (neutralFallback && neutralFallback.id !== cmd.video?.id) {
        this.triggerVideo(
          neutralFallback,
          neutralFallback.emotion,
          neutralFallback.action,
          true,
          true,
        );
        return;
      }
    }

    this.isVideoPlaying.set(false);
  }

  settleToIdle(): void {
    const defaultVideo = this.videoMapping.getDefaultVideo();
    if (defaultVideo) {
      this.triggerVideo(defaultVideo, defaultVideo.emotion, defaultVideo.action, true, true);
    } else {
      this.isVideoPlaying.set(false);
    }
  }

  stopAll(): void {
    this.tts.stop();
    this.isVideoPlaying.set(false);
  }

  private triggerVideo(
    video: GirlVideoItem | null,
    emotion: GirlEmotion,
    action: GirlAction,
    muteVideo: boolean,
    loopVideo: boolean,
  ): void {
    this.nonceCounter += 1;
    this.currentCommand.set({
      video,
      emotion,
      action,
      muteVideo,
      loopVideo,
      playNonce: this.nonceCounter,
    });
  }
}

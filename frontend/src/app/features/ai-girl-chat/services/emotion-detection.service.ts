import { Injectable } from '@angular/core';
import {
  ACTION_CATALOG,
  EMOTION_CATALOG,
  EmotionMeta,
  GirlAction,
  GirlEmotion,
  StructuredGirlResponse,
  VoiceStyle,
} from '../models/girl-chat.models';

@Injectable({
  providedIn: 'root',
})
export class EmotionDetectionService {
  private readonly emotionMap = new Map<GirlEmotion, EmotionMeta>(
    EMOTION_CATALOG.map((item) => [item.value, item]),
  );

  private readonly actionLabels = new Map<GirlAction, string>(
    ACTION_CATALOG.map((item) => [item.value, item.label]),
  );

  getEmotionMeta(emotion: GirlEmotion | string | undefined): EmotionMeta {
    const normalized = (emotion || 'neutral').toLowerCase() as GirlEmotion;
    return this.emotionMap.get(normalized) ?? this.emotionMap.get('neutral')!;
  }

  getActionLabel(action: GirlAction | string | undefined): string {
    if (!action) {
      return 'Talking naturally';
    }
    return this.actionLabels.get(action as GirlAction) ?? action.replace(/_/g, ' ');
  }

  getVoiceStyleForEmotion(emotion: GirlEmotion): VoiceStyle {
    return this.getEmotionMeta(emotion).defaultVoiceStyle;
  }

  /**
   * Local contextual response fallback used only when the Python AI backend is unreachable.
   */
  generateOfflineFallback(
    userMessage: string,
    language: 'en' | 'en-IN' | 'ta' | 'auto',
    voiceEnabled: boolean,
  ): StructuredGirlResponse {
    const text = userMessage.trim();
    const low = text.toLowerCase();
    const hasTamilScript = /[\u0B80-\u0BFF]/.test(text);
    const isTamil = language === 'ta' || hasTamilScript;

    let emotion: GirlEmotion = 'happy';
    let action: GirlAction = 'smile_while_talking';
    let voiceStyle: VoiceStyle = 'friendly';
    let responseText = '';

    if (/\b(hi|hello|hey|good morning|good evening|vanakkam)\b|வணக்கம்/.test(low)) {
      emotion = 'happy';
      action = 'wave_hand';
      voiceStyle = 'cheerful';
      responseText = isTamil
        ? 'வணக்கம்! உங்களைப் பார்த்ததில் ரொம்ப சந்தோஷம். இன்று எப்படி இருக்கீங்க?'
        : 'Hi! It is so nice to see you. How are you doing today?';
    } else if (/\b(miss you|missed you|love|sweet|cute|beautiful|pretty)\b/.test(low)) {
      emotion = 'shy';
      action = 'smile_shyly';
      voiceStyle = 'soft_shy';
      responseText = isTamil
        ? 'அச்சச்சோ, ரொம்ப ஸ்வீட்டா சொல்றீங்க! நானும் உங்ககூட பேச ரொம்ப ஆசையா இருந்தேன்.'
        : 'Aww, that is so sweet! You are really making me smile shyly right now.';
    } else if (/\b(angry|mad|upset|annoyed)\b/.test(low)) {
      emotion = 'playful';
      action = 'shake_head_disagree';
      voiceStyle = 'friendly';
      responseText = isTamil
        ? 'ஐயோ, நான் கோபமா இல்லையே! அப்படி ஏன் நினைச்சீங்க?'
        : 'I am not angry at all! Why would you think that? Tell me what is on your mind.';
    } else if (/\b(sad|lonely|tired|stressed|hurt|bad day|cry)\b/.test(low)) {
      emotion = 'worried';
      action = 'listen_attentively';
      voiceStyle = 'empathetic';
      responseText = isTamil
        ? 'கவலைப்படாதீங்க, நான் உங்ககூட இருக்கேன். என்ன ஆச்சுன்னு என்கிட்ட சொல்லுங்க.'
        : 'I am really sorry you are feeling that way. Take a deep breath—I am right here listening.';
    } else if (/\b(joke|funny|laugh|humor)\b/.test(low)) {
      emotion = 'laughing';
      action = 'laugh_naturally';
      voiceStyle = 'cheerful';
      responseText = isTamil
        ? 'ஹாஹா! கம்ப்யூட்டருக்கு ஏன் எப்பவும் குளிரும்? ஏன்னா அதுல நிறைய விண்டோஸ் திறந்திருக்கும்!'
        : 'Haha, here is a fun one! Why do programmers prefer dark mode? Because light attracts bugs!';
    } else if (/\b(motivate|inspire|goal|encourage|success)\b/.test(low)) {
      emotion = 'excited';
      action = 'express_excitement';
      voiceStyle = 'excited';
      responseText = isTamil
        ? 'உங்களால கண்டிப்பா முடியும்! ஒவ்வொரு சின்ன முயற்சியும் பெரிய வெற்றிக்கு வழி வகுக்கும்.'
        : 'You have got this! Every small step you take today builds toward something wonderful—I believe in you!';
    } else if (/\b(teach|fact|interesting|learn|explain|how|why|what)\b|\?/.test(low)) {
      emotion = 'curious';
      action = 'thinking_pose';
      voiceStyle = 'curious';
      responseText = isTamil
        ? 'அருமையான கேள்வி! உங்களுக்குத் தெரியுமா, நாம ஆர்வமா புது விஷயங்களைக் கத்துக்கும்போது மூளை இன்னும் சுறுசுறுப்பா வேலை செய்யும்!'
        : 'Did you know your brain becomes more active and creative whenever you are curious? Asking great questions actually makes learning feel effortless!';
    } else {
      emotion = 'happy';
      action = 'look_directly_talking';
      voiceStyle = 'natural';
      responseText = isTamil
        ? 'நீங்க சொல்றது ரொம்ப சுவாரஸ்யமா இருக்கு! இன்னும் கொஞ்சம் சொல்லுங்க, நான் கேட்கிறேன்.'
        : 'I really enjoy talking with you! Tell me more about that—I am all ears.';
    }

    return {
      responseText,
      emotion,
      action,
      videoId: `${emotion}_${action}`,
      voiceEnabled,
      videoAudioEnabled: false,
      loopVideo: true,
      language: isTamil ? 'ta' : 'en',
      voiceStyle,
      model: 'offline-fallback',
      fallbackUsed: true,
    };
  }
}

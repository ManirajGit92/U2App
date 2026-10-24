
import os
from dotenv import load_dotenv
import azure.cognitiveservices.speech as speechsdk

load_dotenv(override=True)

speech_key = os.getenv("AZURE_TEXT_TO_SPEECH_KEY")
endpoint_url = os.getenv("AZURE_TEXT_TO_SPEECH_ENDPOINT")

if not speech_key or not endpoint_url:
    raise ValueError("Missing Azure Text-to-Speech key or endpoint in .env")

speech_config = speechsdk.SpeechConfig(
    subscription=speech_key,
    endpoint=endpoint_url
)

# speech_config.speech_synthesis_voice_name = (
#     "en-US-Ava:DragonHDLatestNeural"
# )
speech_config.speech_synthesis_voice_name = (
    "en-US-JennyNeural"
)

speech_synthesizer = speechsdk.SpeechSynthesizer(
    speech_config=speech_config
)

text = "Hi, dear , How can i help you!"
result = speech_synthesizer.speak_text_async(text).get()

if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
    print(f"Speech synthesized successfully: {text}")
elif result.reason == speechsdk.ResultReason.Canceled:
    details = result.cancellation_details
    print(f"Reason: {details.reason}")
    print(f"Error details: {details.error_details}")

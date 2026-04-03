namespace Tanglish.Api.Configuration;

public sealed class OpenAiSpeechOptions
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; init; } = string.Empty;

    public string SpeechModel { get; init; } = "gpt-4o-mini-tts";

    public string DefaultVoice { get; init; } = "coral";

    public string BaseUrl { get; init; } = "https://api.openai.com/v1/";
}

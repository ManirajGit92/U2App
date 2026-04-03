namespace Tanglish.Api.Models;

public sealed class SpeakRequest
{
    public string Text { get; init; } = string.Empty;

    public string Voice { get; init; } = "coral";

    public double Speed { get; init; } = 1.0;

    public string Format { get; init; } = "mp3";

    public string? Instructions { get; init; } =
        "Speak naturally in a warm Tanglish style with clear pronunciation.";
}

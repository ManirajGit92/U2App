namespace Tanglish.Api.Models;

public sealed record SpeechResult(
    byte[] AudioBytes,
    string ContentType,
    string FileName);

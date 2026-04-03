using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Tanglish.Api.Configuration;
using Tanglish.Api.Contracts;
using Tanglish.Api.Models;

namespace Tanglish.Api.Services;

public sealed class OpenAiSpeechSynthesisService : ISpeechSynthesisService
{
    public static readonly string[] SupportedVoices =
    [
        "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova",
        "sage", "shimmer", "verse", "marin", "cedar"
    ];

    public static readonly string[] SupportedFormats = ["mp3", "opus", "aac", "flac", "wav", "pcm"];

    private readonly HttpClient _httpClient;
    private readonly OpenAiSpeechOptions _options;

    public OpenAiSpeechSynthesisService(
        HttpClient httpClient,
        IOptions<OpenAiSpeechOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;

        if (Uri.TryCreate(_options.BaseUrl, UriKind.Absolute, out var baseUri))
        {
            _httpClient.BaseAddress = baseUri;
        }
    }

    public async Task<SpeechResult> GenerateSpeechAsync(
        SpeakRequest request,
        CancellationToken cancellationToken)
    {
        var apiKey = ResolveApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException(
                "Set OPENAI_API_KEY or OpenAI:ApiKey before calling /speak.");
        }

        using var message = new HttpRequestMessage(HttpMethod.Post, "audio/speech")
        {
            Content = JsonContent.Create(new
            {
                model = _options.SpeechModel,
                input = request.Text,
                voice = request.Voice,
                speed = request.Speed,
                response_format = request.Format,
                instructions = request.Instructions
            })
        };

        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await _httpClient.SendAsync(
            message,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException(
                $"OpenAI speech request failed with {(int)response.StatusCode}: {detail}",
                null,
                response.StatusCode);
        }

        var contentType = response.Content.Headers.ContentType?.MediaType
            ?? GetContentType(request.Format);

        var audioBytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        var extension = request.Format.ToLowerInvariant();

        return new SpeechResult(
            AudioBytes: audioBytes,
            ContentType: contentType,
            FileName: $"tanglish-speech.{extension}");
    }

    private string ResolveApiKey()
    {
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            return _options.ApiKey;
        }

        return Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? string.Empty;
    }

    private static string GetContentType(string format) => format.ToLowerInvariant() switch
    {
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "opus" => "audio/opus",
        "pcm" => "audio/pcm",
        _ => "audio/mpeg"
    };
}

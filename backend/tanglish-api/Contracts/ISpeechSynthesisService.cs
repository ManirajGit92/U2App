using Tanglish.Api.Models;

namespace Tanglish.Api.Contracts;

public interface ISpeechSynthesisService
{
    Task<SpeechResult> GenerateSpeechAsync(SpeakRequest request, CancellationToken cancellationToken);
}

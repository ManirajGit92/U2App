namespace Tanglish.Api.Models;

public sealed class ConvertRequest
{
    public string Text { get; init; } = string.Empty;

    public string Engine { get; init; } = "rule-based";

    public bool PreserveUnknownWords { get; init; } = true;
}

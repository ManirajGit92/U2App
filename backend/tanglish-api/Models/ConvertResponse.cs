namespace Tanglish.Api.Models;

public sealed record ConvertResponse(
    string SourceText,
    string TanglishText,
    string Engine,
    bool FullyMatched,
    IReadOnlyList<string> AppliedRules,
    string? Note = null);

using System.Text.RegularExpressions;
using Tanglish.Api.Contracts;
using Tanglish.Api.Models;

namespace Tanglish.Api.Services;

public sealed class RuleBasedTanglishTransliterationEngine : ITransliterationEngine
{
    private static readonly IReadOnlyDictionary<string, string> PhraseMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["how are you"] = "epdi irukka",
            ["what are you doing"] = "enna panra",
            ["where are you"] = "enga irukka",
            ["see you later"] = "apparam paakalam",
            ["thank you very much"] = "romba nandri",
            ["thank you"] = "nandri",
            ["good morning"] = "kalai vanakkam",
            ["good evening"] = "maalai vanakkam",
            ["good night"] = "iravu vanakkam",
            ["excuse me"] = "konjam kelu",
            ["please wait"] = "konjam wait pannunga",
            ["come here"] = "inga vaa",
            ["go there"] = "anga po",
            ["i am fine"] = "naan nalla irukken",
            ["take care"] = "paathukko",
            ["well done"] = "super-aa pannirukka",
            ["i do not know"] = "enakku theriyala",
            ["i don't know"] = "enakku theriyala",
            ["what happened"] = "enna aachu",
            ["please help"] = "dhayavu senju help pannunga"
        };

    private static readonly IReadOnlyDictionary<string, string> WordMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["hello"] = "vanakkam",
            ["hi"] = "hi",
            ["welcome"] = "varaverkiren",
            ["yes"] = "aama",
            ["no"] = "illa",
            ["please"] = "dhayavu senju",
            ["sorry"] = "mannichidungo",
            ["thanks"] = "nandri",
            ["today"] = "innikku",
            ["tomorrow"] = "naalaikku",
            ["yesterday"] = "netru",
            ["now"] = "ippo",
            ["later"] = "apparam",
            ["water"] = "thanni",
            ["food"] = "saapadu",
            ["home"] = "veedu",
            ["office"] = "office",
            ["friend"] = "nanban",
            ["friends"] = "nanbargal",
            ["work"] = "velai",
            ["meeting"] = "meeting",
            ["project"] = "project",
            ["report"] = "report",
            ["send"] = "anuppu",
            ["share"] = "share pannu",
            ["call"] = "koopdu",
            ["come"] = "vaa",
            ["go"] = "po",
            ["wait"] = "wait pannu",
            ["start"] = "start pannu",
            ["stop"] = "niruthu",
            ["open"] = "open pannu",
            ["close"] = "close pannu",
            ["help"] = "help pannu",
            ["check"] = "check pannu",
            ["finish"] = "mudichidu",
            ["done"] = "mudinjudhu",
            ["ready"] = "ready",
            ["beautiful"] = "azhagaana",
            ["super"] = "super",
            ["quickly"] = "seekiram",
            ["slowly"] = "medhuva",
            ["big"] = "periya",
            ["small"] = "chinna"
        };

    private static readonly Regex PunctuationRegex = new(@"([,.!?;:])", RegexOptions.Compiled);
    private static readonly Regex MultiSpaceRegex = new(@"\s{2,}", RegexOptions.Compiled);

    public ConvertResponse Convert(ConvertRequest request)
    {
        var input = request.Text.Trim();
        var appliedRules = new List<string>();
        var output = input;

        foreach (var phrase in PhraseMap.OrderByDescending(entry => entry.Key.Length))
        {
            var pattern = $@"\b{Regex.Escape(phrase.Key)}\b";
            var replacementCount = 0;

            output = Regex.Replace(
                output,
                pattern,
                _ =>
                {
                    replacementCount++;
                    return phrase.Value;
                },
                RegexOptions.IgnoreCase);

            if (replacementCount > 0)
            {
                appliedRules.Add($"phrase:{phrase.Key}");
            }
        }

        output = TranslateSentencePatterns(output, appliedRules);
        output = TranslateWordByWord(output, request.PreserveUnknownWords, appliedRules);
        output = CleanupSpacing(output);

        return new ConvertResponse(
            SourceText: input,
            TanglishText: output,
            Engine: request.Engine,
            FullyMatched: !ContainsResidualEnglishWords(output),
            AppliedRules: appliedRules,
            Note: "Rule-based starter engine. Unknown terms are preserved so a future Python or AI transliterator can replace them cleanly.");
    }

    private static string TranslateSentencePatterns(string text, ICollection<string> appliedRules)
    {
        var patterns = new (Regex Pattern, Func<Match, string> Transform, string Rule)[]
        {
            (
                new Regex(@"^\s*i need (?<value>.+)$", RegexOptions.IgnoreCase),
                match => $"enakku {match.Groups["value"].Value.Trim()} venum",
                "pattern:i need"
            ),
            (
                new Regex(@"^\s*i want (?<value>.+)$", RegexOptions.IgnoreCase),
                match => $"enakku {match.Groups["value"].Value.Trim()} venum",
                "pattern:i want"
            ),
            (
                new Regex(@"^\s*where is (?<value>.+)$", RegexOptions.IgnoreCase),
                match => $"{match.Groups["value"].Value.Trim()} enga irukku",
                "pattern:where is"
            ),
            (
                new Regex(@"^\s*can you (?<value>.+)\??$", RegexOptions.IgnoreCase),
                match => $"{match.Groups["value"].Value.Trim()} panna mudiyuma?",
                "pattern:can you"
            ),
            (
                new Regex(@"^\s*please (?<value>.+)$", RegexOptions.IgnoreCase),
                match => $"dhayavu senju {match.Groups["value"].Value.Trim()}",
                "pattern:please"
            )
        };

        foreach (var pattern in patterns)
        {
            if (!pattern.Pattern.IsMatch(text))
            {
                continue;
            }

            appliedRules.Add(pattern.Rule);
            return pattern.Pattern.Replace(text, match => pattern.Transform(match), 1);
        }

        return text;
    }

    private static string TranslateWordByWord(
        string text,
        bool preserveUnknownWords,
        ICollection<string> appliedRules)
    {
        var tokens = PunctuationRegex.Replace(text, " $1 ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var result = new List<string>(tokens.Length);

        foreach (var token in tokens)
        {
            if (PunctuationRegex.IsMatch(token))
            {
                result.Add(token);
                continue;
            }

            if (WordMap.TryGetValue(token, out var mapped))
            {
                appliedRules.Add($"word:{token.ToLowerInvariant()}");
                result.Add(MatchTokenCase(token, mapped));
                continue;
            }

            result.Add(preserveUnknownWords ? ApplyPhoneticFallback(token) : string.Empty);
        }

        return string.Join(' ', result.Where(token => !string.IsNullOrWhiteSpace(token)));
    }

    private static string ApplyPhoneticFallback(string token)
    {
        var transformed = token;

        transformed = Regex.Replace(transformed, "tion$", "shan", RegexOptions.IgnoreCase);
        transformed = Regex.Replace(transformed, "the", "dha", RegexOptions.IgnoreCase);
        transformed = Regex.Replace(transformed, "th", "dh", RegexOptions.IgnoreCase);
        transformed = Regex.Replace(transformed, "oo", "u", RegexOptions.IgnoreCase);
        transformed = Regex.Replace(transformed, "ph", "f", RegexOptions.IgnoreCase);
        transformed = Regex.Replace(transformed, "w", "v", RegexOptions.IgnoreCase);

        return transformed;
    }

    private static string CleanupSpacing(string text)
    {
        var cleaned = MultiSpaceRegex.Replace(text, " ").Trim();
        cleaned = Regex.Replace(cleaned, @"\s+([,.!?;:])", "$1");
        return cleaned;
    }

    private static string MatchTokenCase(string source, string target)
    {
        if (source.All(char.IsUpper))
        {
            return target.ToUpperInvariant();
        }

        if (char.IsUpper(source[0]))
        {
            return char.ToUpperInvariant(target[0]) + target[1..];
        }

        return target;
    }

    private static bool ContainsResidualEnglishWords(string text)
    {
        return text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(token => token.Any(char.IsLetter))
            .Any(token =>
            {
                var lowered = token.Trim().Trim(',', '.', '!', '?', ';', ':').ToLowerInvariant();
                return lowered.Length > 2
                    && !WordMap.ContainsKey(lowered)
                    && !PhraseMap.Values.Any(value => value.Contains(lowered, StringComparison.OrdinalIgnoreCase));
            });
    }
}

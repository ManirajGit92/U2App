using Tanglish.Api.Models;

namespace Tanglish.Api.Contracts;

public interface ITransliterationEngine
{
    ConvertResponse Convert(ConvertRequest request);
}

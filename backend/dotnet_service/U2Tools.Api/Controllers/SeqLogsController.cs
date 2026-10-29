using Microsoft.AspNetCore.Mvc;
using Seq.Api;

namespace U2Tools.Api.Controllers;

[ApiController]
[Route("api/seqlogs")]
public class SeqLogsController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public SeqLogsController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] string? filter = null,
        [FromQuery] int count = 100)
    {
        try
        {
            var serverUrl =
                _configuration["Seq:ServerUrl"]
                ?? "http://localhost:5341";

            var apiKey = _configuration["Seq:ApiKey"];

            var connection = new SeqConnection(
                serverUrl,
                apiKey: string.IsNullOrWhiteSpace(apiKey)
                    ? null
                    : apiKey);

            var events = connection.Events.EnumerateAsync(
                filter: string.IsNullOrWhiteSpace(filter)
                    ? null
                    : filter,
                render: true,
                count: Math.Clamp(count, 1, 500));

            var results = new List<object>();

            await foreach (var logEvent in events)
            {
                results.Add(logEvent);
            }

            return Ok(results);
        }
        catch (Exception ex)
        {
            return Problem(
                title: "Unable to retrieve logs from SEQ.",
                detail: ex.Message,
                statusCode: StatusCodes.Status502BadGateway);
        }
    }
}

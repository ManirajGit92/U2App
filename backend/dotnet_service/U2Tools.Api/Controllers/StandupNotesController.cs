
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using U2Tools.Api.Data;
using U2Tools.Api.Models;

namespace U2Tools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StandupNotesController : ControllerBase
{
    private readonly U2ToolsDbContext _dbContext;
    private readonly ILogger<StandupNotesController> _logger;
    public StandupNotesController(U2ToolsDbContext dbContext, ILogger<StandupNotesController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StandupNote>>> GetAll()
    {
        var notes = await _dbContext.StandupNotes
            .AsNoTracking()
            .OrderByDescending(note => note.CreatedAt)
            .ToListAsync();

        return Ok(notes);
    }

    [HttpPost]
    public async Task<ActionResult<StandupNote>> Create(
        [FromBody] StandupNote note)
    {
        note.Id = 0;
        note.CreatedAt = DateTime.UtcNow;
        note.UpdatedAt = note.CreatedAt;

        _dbContext.StandupNotes.Add(note);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetAll),
            new { id = note.Id },
            note);
    }

    [HttpGet("test-logs")]
    public IActionResult TestLogs()
    {
        _logger.LogTrace("TRACE: Detailed diagnostic information.");

        _logger.LogDebug("DEBUG: Debugging the Standup Notes API.");

        _logger.LogInformation(
            "INFO: Standup Notes API was tested at {TestTime}",
            DateTime.UtcNow);

        _logger.LogWarning(
            "WARNING: This is a sample warning.");

        _logger.LogError(
            "ERROR: This is a sample error.");

        return Ok(new
        {
            message = "Sample logs generated successfully.",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpGet("test-exception")]
    public IActionResult TestException()
    {
        try
        {
            throw new InvalidOperationException(
                "Sample exception for Seq testing.");
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "An exception occurred while testing Seq.");

            return Problem(
                title: "Sample exception",
                detail: "An exception was logged in Seq.",
                statusCode: 500);
        }
    }
}

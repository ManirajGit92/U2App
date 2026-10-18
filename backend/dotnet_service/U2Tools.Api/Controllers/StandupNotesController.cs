
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

    public StandupNotesController(U2ToolsDbContext dbContext)
    {
        _dbContext = dbContext;
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
}

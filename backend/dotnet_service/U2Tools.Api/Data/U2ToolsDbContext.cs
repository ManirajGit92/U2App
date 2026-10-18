
using Microsoft.EntityFrameworkCore;
using U2Tools.Api.Models;

namespace U2Tools.Api.Data;

public class U2ToolsDbContext : DbContext
{
    public U2ToolsDbContext(DbContextOptions<U2ToolsDbContext> options)
        : base(options)
    {
    }

    public DbSet<StandupNote> StandupNotes => Set<StandupNote>();
}

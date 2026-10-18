
namespace U2Tools.Api.Models;

public class StandupNote
{
    public int Id { get; set; }

    public string EmployeeId { get; set; } = string.Empty;

    public string? EmployeeName { get; set; }

    public string? ProjectName { get; set; }

    public string YesterdayWork { get; set; } = string.Empty;

    public string TodayWork { get; set; } = string.Empty;

    public string? Blockers { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}


using Microsoft.EntityFrameworkCore;
using U2Tools.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Register Entity Framework Core and SQL Server.
builder.Services.AddDbContext<U2ToolsDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// Register API services.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

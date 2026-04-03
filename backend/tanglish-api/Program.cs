using System.Net.Mime;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics;
using Tanglish.Api.Configuration;
using Tanglish.Api.Contracts;
using Tanglish.Api.Models;
using Tanglish.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
});

builder.Services.Configure<OpenAiSpeechOptions>(
    builder.Configuration.GetSection(OpenAiSpeechOptions.SectionName));

builder.Services.AddCors(options =>
{
    options.AddPolicy("TanglishFrontend", policy =>
    {
        var origins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>();

        if (origins is { Length: > 0 })
        {
            policy.WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod();
            return;
        }

        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddHttpClient<ISpeechSynthesisService, OpenAiSpeechSynthesisService>(client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/v1/");
    client.Timeout = TimeSpan.FromSeconds(90);
});

builder.Services.AddSingleton<ITransliterationEngine, RuleBasedTanglishTransliterationEngine>();

var app = builder.Build();

app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        var exceptionFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Tanglish.Api.Unhandled");

        if (exceptionFeature?.Error is not null)
        {
            logger.LogError(
                exceptionFeature.Error,
                "Unhandled exception for {Method} {Path}",
                context.Request.Method,
                context.Request.Path);
        }

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = MediaTypeNames.Application.Json;

        await context.Response.WriteAsJsonAsync(new
        {
            title = "Tanglish API request failed",
            detail = exceptionFeature?.Error.Message ?? "Unknown server error."
        });
    });
});

app.UseCors("TanglishFrontend");

app.MapGet("/", () => Results.Ok(new
{
    name = "Tanglish API",
    status = "ok",
    endpoints = new[] { "/convert", "/speak" }
}));

app.MapPost("/convert", (
    ConvertRequest request,
    ITransliterationEngine engine,
    ILoggerFactory loggerFactory) =>
{
    var logger = loggerFactory.CreateLogger("Tanglish.Api.Convert");
    logger.LogInformation(
        "Received convert request. Engine={Engine}, PreserveUnknownWords={PreserveUnknownWords}, TextLength={TextLength}",
        request.Engine,
        request.PreserveUnknownWords,
        request.Text?.Length ?? 0);

    var validationError = ValidateConvertRequest(request);
    if (validationError is not null)
    {
        logger.LogWarning("Convert request validation failed: {ValidationKeys}", string.Join(", ", validationError.Keys));
        return Results.ValidationProblem(validationError);
    }

    var result = engine.Convert(request);
    logger.LogInformation(
        "Convert request completed. AppliedRules={AppliedRules}, OutputLength={OutputLength}",
        result.AppliedRules.Count,
        result.TanglishText.Length);

    return Results.Ok(result);
})
.WithName("ConvertToTanglish")
.Produces<ConvertResponse>(StatusCodes.Status200OK, MediaTypeNames.Application.Json)
.ProducesValidationProblem();

app.MapPost("/speak", async Task<IResult> (
    SpeakRequest request,
    ISpeechSynthesisService speechService,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    var logger = loggerFactory.CreateLogger("Tanglish.Api.Speak");
    logger.LogInformation(
        "Received speak request. Voice={Voice}, Speed={Speed}, Format={Format}, TextLength={TextLength}",
        request.Voice,
        request.Speed,
        request.Format,
        request.Text?.Length ?? 0);

    var validationError = ValidateSpeakRequest(request);
    if (validationError is not null)
    {
        logger.LogWarning("Speak request validation failed: {ValidationKeys}", string.Join(", ", validationError.Keys));
        return Results.ValidationProblem(validationError);
    }

    try
    {
        var audio = await speechService.GenerateSpeechAsync(request, cancellationToken);

        return Results.File(
            fileContents: audio.AudioBytes,
            contentType: audio.ContentType,
            fileDownloadName: audio.FileName);
    }
    catch (InvalidOperationException exception)
    {
        logger.LogError(exception, "Speech synthesis configuration error");
        return Results.Problem(
            title: "Speech synthesis is unavailable",
            detail: exception.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch (HttpRequestException exception)
    {
        logger.LogError(exception, "Speech generation upstream error");
        return Results.Problem(
            title: "Speech generation failed",
            detail: exception.Message,
            statusCode: StatusCodes.Status502BadGateway);
    }
})
.WithName("SpeakTanglish")
.Produces(StatusCodes.Status200OK)
.ProducesProblem(StatusCodes.Status502BadGateway)
.ProducesProblem(StatusCodes.Status503ServiceUnavailable)
.ProducesValidationProblem();

app.Run();

static Dictionary<string, string[]>? ValidateConvertRequest(ConvertRequest request)
{
    if (string.IsNullOrWhiteSpace(request.Text))
    {
        return new Dictionary<string, string[]>
        {
            [nameof(request.Text)] = new[] { "Text is required." }
        };
    }

    return null;
}

static Dictionary<string, string[]>? ValidateSpeakRequest(SpeakRequest request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.Text))
    {
        errors[nameof(request.Text)] = new[] { "Text is required." };
    }

    if (request.Speed is < 0.25 or > 4.0)
    {
        errors[nameof(request.Speed)] = new[] { "Speed must be between 0.25 and 4.0." };
    }

    if (!OpenAiSpeechSynthesisService.SupportedVoices.Contains(request.Voice, StringComparer.OrdinalIgnoreCase))
    {
        errors[nameof(request.Voice)] = new[]
        {
            $"Voice must be one of: {string.Join(", ", OpenAiSpeechSynthesisService.SupportedVoices)}."
        };
    }

    if (!OpenAiSpeechSynthesisService.SupportedFormats.Contains(request.Format, StringComparer.OrdinalIgnoreCase))
    {
        errors[nameof(request.Format)] = new[]
        {
            $"Format must be one of: {string.Join(", ", OpenAiSpeechSynthesisService.SupportedFormats)}."
        };
    }

    return errors.Count > 0 ? errors : null;
}

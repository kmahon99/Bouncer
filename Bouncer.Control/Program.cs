using Microsoft.AspNetCore.SignalR;
using Bouncer.Control;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHub<BouncerHub>("/bouncer");

app.MapPost("/lock", async (IHubContext<BouncerHub> hub) =>
{
    await hub.Clients.All.SendAsync(
        "Lock",
        "Emergency lockdown activated"
    );

    return Results.Ok();
});

app.Run();
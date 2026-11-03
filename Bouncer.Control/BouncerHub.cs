using Microsoft.AspNetCore.SignalR;

namespace Bouncer.Control;

public class BouncerHub : Hub
{
    public async Task LockAll()
    {
        await Clients.All.SendAsync(
            "Lock",
            "Emergency lockdown activated"
        );
    }
}
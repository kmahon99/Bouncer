using System.Collections.Generic;
using Avalonia.Controls;

namespace Bouncer;

public class OverlayService
{
    private readonly List<OverlayWindow> _windows = new();

    public void Show(Screens screens)
    {
        foreach (var screen in screens.All)
        {
            var window = new OverlayWindow(
                screen.Bounds.Width,
                screen.Bounds.Height
            );

            window.Show();

            window.Position = screen.Bounds.Position;

            _windows.Add(window);
        }
    }

    public void Hide()
    {
        foreach (var window in _windows)
            window.Close();

        _windows.Clear();
    }
}
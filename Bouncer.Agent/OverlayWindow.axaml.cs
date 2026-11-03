using Avalonia.Controls;

namespace Bouncer;

public partial class OverlayWindow : Window
{
    public OverlayWindow()
    {
        InitializeComponent();

        SystemDecorations = SystemDecorations.None;
        Topmost = true;
        CanResize = false;
    }

    public OverlayWindow(double width, double height) : this()
    {
        Width = width;
        Height = height;
    }
}
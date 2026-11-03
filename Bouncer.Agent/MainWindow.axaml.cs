using System;
using Avalonia.Controls;

namespace Bouncer;

public partial class MainWindow : Window
{
    private readonly OverlayService _overlayService = new();
    private bool _opened;

    public MainWindow()
    {
        InitializeComponent();

        Opened += (_, _) =>
        {
            if (_opened)
                return;

            _opened = true;

            _overlayService.Show(Screens);

            Hide(); // remove the main window completely
        };
    }
}
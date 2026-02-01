package main

import (
	"embed"
	_ "embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/out
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	// 1. Create the Service (App logic)
	appService := NewApp()

	// 2. Create the Application
	app := application.New(application.Options{
		Name:        "Super Characters",
		Description: "Speech-to-Text Transcription",
		Services: []application.Service{
			application.NewService(appService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// 3. Inject App Dependencies
	appService.SetApp(app)

	// 4. Create the Main Window — native Liquid Glass on macOS 26+
	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:           "main",
		Title:          "Super Characters",
		Width:          900,
		Height:         700,
		MinWidth:       400,
		MinHeight:      300,
		Frameless:      true,
		BackgroundType: application.BackgroundTypeTranslucent,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropLiquidGlass,
			TitleBar: application.MacTitleBar{
				AppearsTransparent: true,
				Hide:               false,
				HideTitle:          true,
				FullSizeContent:    true,
			},
			LiquidGlass: application.MacLiquidGlass{
				Style:        application.LiquidGlassStyleAutomatic,
				Material:     application.NSVisualEffectMaterialAuto,
				CornerRadius: 20.0,
			},
		},
		DevToolsEnabled: true,
	})

	// 5. Create the Overlay Window (3D character, always-on-top, transparent)
	overlayWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:           "overlay",
		Title:          "Super Characters Overlay",
		Width:          300,
		Height:         350,
		Frameless:      true,
		AlwaysOnTop:    true,
		BackgroundType: application.BackgroundTypeTransparent,
		URL:            "/overlay/",
		Hidden:         true,
		Mac: application.MacWindow{
			TitleBar: application.MacTitleBar{
				Hide: true,
			},
			Backdrop:      application.MacBackdropTransparent,
			DisableShadow: true,
			// Allow overlay to appear over fullscreen apps and on all Spaces
			CollectionBehavior: application.MacWindowCollectionBehaviorFullScreenAuxiliary |
				application.MacWindowCollectionBehaviorCanJoinAllSpaces |
				application.MacWindowCollectionBehaviorIgnoresCycle,
		},
		DevToolsEnabled: true,
	})

	// 6. Register Windows
	appService.SetWindow(mainWindow)
	appService.SetOverlayWindow(overlayWindow)

	// 7. Create System Tray
	systray := app.SystemTray.New()
	systray.SetIcon(icon)

	menu := app.NewMenu()
	menu.Add("Show Super Characters").OnClick(func(ctx *application.Context) {
		mainWindow.Show()
		mainWindow.Focus()
	})
	menu.AddSeparator()
	menu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	systray.SetMenu(menu)

	// 8. Run the Application (hotkeys are registered in ServiceStartup)
	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}


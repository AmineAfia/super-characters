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
		Name:        "super-characters",
		Description: "Super Characters",
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

	// 4. Create the Main Window
	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:           "main",
		Title:          "Super Characters",
		Width:          1024,
		Height:         768,
		MinWidth:       400,
		MinHeight:      300,
		Frameless:      true,
		BackgroundType: application.BackgroundTypeTransparent,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropNormal,
			TitleBar: application.MacTitleBar{
				Hide: true,
			},
		},
		DevToolsEnabled: true,
	})

	// 5. Register Window
	appService.SetWindow(mainWindow)

	// 6. Create System Tray
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

	// 7. Run the Application
	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}

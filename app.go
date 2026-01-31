package main

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// App struct holds application state and dependencies
type App struct {
	app    *application.App
	window *application.WebviewWindow
}

// NewApp creates a new App instance
func NewApp() *App {
	return &App{}
}

// SetApp injects the Wails application reference
func (a *App) SetApp(app *application.App) {
	a.app = app
}

// SetWindow registers the main window
func (a *App) SetWindow(window *application.WebviewWindow) {
	a.window = window
}

// Greet returns a greeting message - example method exposed to frontend
func (a *App) Greet(name string) string {
	if name == "" {
		return "Hello, World!"
	}
	return "Hello, " + name + "!"
}

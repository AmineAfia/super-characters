#!/bin/bash

# Development script for Super Characters
# This script builds and runs the application in development mode (Wails v3)

set -e

echo "🚀 Starting Super Characters development build..."
echo

# Generate TypeScript bindings
echo "🔗 Generating Wails v3 bindings..."
wails3 generate bindings -ts

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build the Go application
echo "🏗️  Building Go application..."
mkdir -p bin
CGO_ENABLED=1 GOOS=darwin go build -o bin/super-characters

# Run the application
echo "🚀 Starting Super Characters..."
echo
./bin/super-characters

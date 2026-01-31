#!/bin/bash

# Build script for Super Characters - Speech-to-Text Transcription App
# Updated for Wails v3

set -e

# Use production bundle settings in CI, dev settings for local builds.
# macOS shows the .app folder name in System Settings > Accessibility,
# so local builds use "Super Characters Dev.app" to distinguish from the installed production app.
if [ "$CI" = "true" ]; then
    BUNDLE_ID="app.supercharacters"
    BUNDLE_NAME="Super Characters"
    APP_BUNDLE="supercharacters.app"
else
    BUNDLE_ID="app.supercharacters.dev"
    BUNDLE_NAME="Super Characters Dev"
    APP_BUNDLE="Super Characters Dev.app"
fi

echo "🔧 Building Super Characters - Wails v3 (${BUNDLE_NAME})"
echo

# Check if we're in the right directory
if [ ! -f "go.mod" ] || [ ! -d "whisper.cpp" ]; then
    echo "❌ Error: Please run this script from the super-characters project root directory"
    exit 1
fi

# Build whisper.cpp libraries (skip if SKIP_WHISPER_BUILD is set and build exists)
if [ -z "$SKIP_WHISPER_BUILD" ] || [ ! -d "whisper.cpp/build_go" ]; then
    echo "📦 Building whisper.cpp static libraries..."
    cd whisper.cpp/bindings/go
    make whisper
    cd ../../..
else
    echo "📦 Using cached whisper.cpp build..."
fi

# Install Go dependencies
echo "📦 Installing Go dependencies..."
go mod tidy

# Set environment variables for C compilation
export C_INCLUDE_PATH="$(pwd)/whisper.cpp/include:$(pwd)/whisper.cpp/ggml/include"

# Dynamically construct LIBRARY_PATH based on what exists
LIB_PATHS=""
for path in "$(pwd)/whisper.cpp/build_go/src" \
            "$(pwd)/whisper.cpp/build_go/ggml/src" \
            "$(pwd)/whisper.cpp/build_go/ggml/src/ggml-metal" \
            "$(pwd)/whisper.cpp/build_go/ggml/src/ggml-blas"; do
    if [ -d "$path" ]; then
        if [ -z "$LIB_PATHS" ]; then
            LIB_PATHS="$path"
        else
            LIB_PATHS="$LIB_PATHS:$path"
        fi
    fi
done
export LIBRARY_PATH="$LIB_PATHS"

# Generate Wails TypeScript bindings
echo "🔗 Generating Wails v3 bindings..."
C_INCLUDE_PATH="$C_INCLUDE_PATH" LIBRARY_PATH="$LIBRARY_PATH" wails3 generate bindings -ts

# Fix generated bindings import extensions (.js -> .ts)
echo "🔧 Fixing binding import extensions..."
find frontend/bindings -name "*.ts" -exec sed -i '' 's/from "\(.*\)\.js"/from "\1.ts"/g' {} \;

# Add @ts-nocheck to generated bindings (avoid TypeScript strict mode errors)
find frontend/bindings -name "*.ts" ! -exec grep -q '@ts-nocheck' {} \; -exec sed -i '' '1s/^/\/\/ @ts-nocheck\n/' {} \;

# Build frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build the application
echo "🏗️  Building application..."
mkdir -p bin
CGO_ENABLED=1 GOOS=darwin C_INCLUDE_PATH="$C_INCLUDE_PATH" LIBRARY_PATH="$LIBRARY_PATH" \
    go build -o bin/supercharacters

# Create app bundle (remove old bundle first to avoid com.apple.provenance blocking cp)
echo "📦 Creating app bundle (${APP_BUNDLE})..."
rm -rf "bin/${APP_BUNDLE}"
mkdir -p "bin/${APP_BUNDLE}/Contents/"{MacOS,Resources}
cp bin/supercharacters "bin/${APP_BUNDLE}/Contents/MacOS/"
cp build/appicon.png "bin/${APP_BUNDLE}/Contents/Resources/" 2>/dev/null || true

# Create Info.plist if it doesn't exist
if [ ! -f "bin/${APP_BUNDLE}/Contents/Info.plist" ]; then
    cat > "bin/${APP_BUNDLE}/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>supercharacters</string>
    <key>CFBundleIconFile</key>
    <string>appicon</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>${BUNDLE_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.0.1</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>Super Characters needs access to the microphone for speech-to-text transcription</string>
    <key>NSAccessibilityUsageDescription</key>
    <string>Super Characters needs accessibility access to capture global hotkeys for transcription</string>
</dict>
</plist>
PLIST
fi

# Ad-hoc sign the app bundle so macOS can track accessibility permissions.
# Without this, AXIsProcessTrusted() always returns false because the binary
# identity is "a.out" and the Info.plist isn't bound to the signature.
# This is NOT Developer ID signing — no certificates needed.
# CI builds get proper Developer ID signing in the workflow.
if [ "$CI" != "true" ]; then
    echo "🔏 Ad-hoc signing app bundle..."
    codesign --force --deep --sign - "bin/${APP_BUNDLE}"
fi

echo
echo "✅ Build completed successfully!"
echo "📍 App bundle: bin/${APP_BUNDLE}"

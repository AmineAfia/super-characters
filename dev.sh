#!/bin/bash

# Development script for Super Characters
# This script builds and runs the application in development mode (Wails v3)

set -e

echo "🚀 Starting Super Characters development build..."
echo

# Set environment variables for C compilation (whisper.cpp)
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

echo "Environment variables set:"
echo "  C_INCLUDE_PATH=$C_INCLUDE_PATH"
echo "  LIBRARY_PATH=$LIBRARY_PATH"
echo

# Generate TypeScript bindings
echo "🔗 Generating Wails v3 bindings..."
wails3 generate bindings -ts

# Fix generated bindings import extensions (.js -> .ts)
echo "🔧 Fixing binding import extensions..."
find frontend/bindings -name "*.ts" -exec sed -i '' 's/from "\(.*\)\.js"/from "\1.ts"/g' {} \;

# Add @ts-nocheck to generated bindings (avoid TypeScript strict mode errors)
find frontend/bindings -name "*.ts" ! -exec grep -q '@ts-nocheck' {} \; -exec sed -i '' '1s/^/\/\/ @ts-nocheck\n/' {} \;

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build the Go application
echo "🏗️  Building Go application..."
mkdir -p bin
CGO_ENABLED=1 GOOS=darwin go build -o bin/supercharacters

# Re-sign with a stable identity so macOS TCC (accessibility permissions) persists across rebuilds.
# Without this, each rebuild produces a new ad-hoc signature and macOS invalidates the event tap trust.
echo "🔏 Signing binary for accessibility permissions..."
codesign --force --sign "Apple Development" --identifier "com.supercharacters.dev" bin/supercharacters 2>/dev/null || true

# Run the application
echo "🚀 Starting Super Characters..."
echo
./bin/supercharacters

#!/bin/bash
cd "$(dirname "$0")"

claude --dangerously-skip-permissions -p "Read flags/task-deploy-b46.md and execute the FULL deployment to TestFlight right now. Follow every step exactly: bump build to 46 in app.json, expo prebuild --clean, fix hermesc path, pod install, xcodebuild archive, export, upload. Do NOT stop to ask. Diagnose and fix errors automatically. After upload, commit and tag v1.0-b46."

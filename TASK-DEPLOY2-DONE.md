# Task: Deploy to TestFlight

Follow these steps EXACTLY. Read ~/repos/agent-hub/global-constraints.md for full details.

1. Run tests: `npx vitest run` — must pass
2. Bump buildNumber in app.json (increment by 1 from current)
3. Commit the bump
4. Tag: `git tag -a v2.0.0-b<BUILD> -m "TestFlight build <BUILD>"`
5. CRITICAL: `npx expo prebuild --platform ios --clean` — WITHOUT THIS THE BUILD NUMBER WON'T UPDATE
6. `cd ios && pod install && cd ..`
7. Archive to /tmp: `xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic`
8. Export + upload: `xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates`
9. If export fails with "No accounts with App Store Connect access" — tell Tanmay to open Xcode GUI > Settings > Accounts > sign in, then retry
10. `git push origin main --tags`
11. Rename this file to TASK-DEPLOY2-DONE.md

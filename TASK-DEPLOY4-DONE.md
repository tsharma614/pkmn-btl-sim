# Task: Deploy to TestFlight

1. `npx vitest run` — must pass
2. Bump buildNumber in app.json (increment from current)
3. Commit + tag `v2.0.0-b<BUILD>`
4. `npx expo prebuild --platform ios --clean`
5. `cd ios && pod install && cd ..`
6. Fix hermesc: `sed -i '' "s|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g" ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig`
7. `xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic`
8. `xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 -authenticationKeyID 6DZ8G8Z994 -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f`
9. `git push origin main --tags`
10. Rename to TASK-DEPLOY4-DONE.md

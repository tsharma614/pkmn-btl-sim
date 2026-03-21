# Task: Deploy to TestFlight

Follow the deploy steps from CLAUDE.md and global-constraints.md EXACTLY.

1. Run tests: `npx vitest run` — must pass
2. Bump buildNumber in app.json (increment from current)
3. Commit the bump
4. Tag: `git tag -a v2.0.0-b<BUILD> -m "TestFlight build <BUILD>"`
5. `npx expo prebuild --platform ios --clean`
6. `cd ios && pod install && cd ..`
7. Fix hermesc path: `sed -i '' "s|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g" ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig`
8. Archive: `xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic`
9. Export + upload: `xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 -authenticationKeyID 6DZ8G8Z994 -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f`
10. `git push origin main --tags`
11. Rename to TASK-DEPLOY3-DONE.md

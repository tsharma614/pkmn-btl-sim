# Deploy Build 46 to TestFlight

The audit fixes from commit 10a6cd0 need to be deployed. Follow these steps EXACTLY:

## Pre-flight
1. Run tests first
2. Increment build number in app.json to 46
3. Commit the version bump
4. Tag: `git tag -a v1.0-b46 -m "TestFlight build 46"`

## Build & Deploy
Follow the React Native deployment steps exactly:

1. `npx expo prebuild --platform ios --clean`
2. Fix hermesc path: `sed -i '' "s|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g" ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig`
3. `cd ios && pod install && cd ..`
4. Archive:
   ```
   xcodebuild archive \
     -workspace ios/PBSim.xcworkspace \
     -scheme PBSim \
     -configuration Release \
     -archivePath /tmp/PBSim.xcarchive \
     -destination 'generic/platform=iOS' \
     CODE_SIGN_STYLE=Automatic
   ```
5. Export + Upload:
   ```
   xcodebuild -exportArchive \
     -archivePath /tmp/PBSim.xcarchive \
     -exportOptionsPlist ios/ExportOptions.plist \
     -exportPath /tmp/PBSim-export \
     -allowProvisioningUpdates \
     -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 \
     -authenticationKeyID 6DZ8G8Z994 \
     -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f
   ```

## Critical
- NEVER use `rm -rf ios/build` — use `xcodebuild clean` instead
- Archive path MUST be /tmp/ (not ./build/)
- If step fails, diagnose and fix — do NOT bail out

After successful upload, commit and report back.

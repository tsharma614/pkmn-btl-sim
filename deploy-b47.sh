#!/bin/bash
cd "$(dirname "$0")"

claude --dangerously-skip-permissions -p "Deploy build 47 to TestFlight. Steps:
1. Bump build number to 47 in app.json
2. Commit: git commit -am 'bump build to 47'
3. Tag: git tag -a v1.0-b47 -m 'TestFlight build 47 - fix gym career crash'
4. npx expo prebuild --platform ios --clean
5. Fix hermesc path: sed -i '' 's|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g' ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig
6. cd ios && pod install && cd ..
7. xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic
8. xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 -authenticationKeyID 6DZ8G8Z994 -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f
9. After upload, notify via: python3 ~/repos/agent-hub/scripts/telegram.py 'Build 47 deployed to TestFlight with gym crash fix. Check it your highness.'
Do NOT use rm -rf ios/build. Use xcodebuild clean if needed. Diagnose and fix errors automatically."

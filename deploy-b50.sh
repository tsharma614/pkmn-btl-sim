#!/bin/bash
cd "$(dirname "$0")"

claude --dangerously-skip-permissions -p "Deploy build 50 to TestFlight. Steps:
1. git config user.email sharma.tanmay2000@gmail.com
2. Bump build number to 50 in app.json
3. git commit -am 'bump build to 50'
4. git tag -a v1.0-b50 -m 'TestFlight build 50 - fix expo-image TurboModule crash on iOS 26'
5. npx expo prebuild --platform ios --clean
6. Fix hermesc: sed -i '' 's|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g' ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig
7. cd ios && pod install && cd ..
8. xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic
9. xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 -authenticationKeyID 6DZ8G8Z994 -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f
10. python3 ~/repos/agent-hub/scripts/telegram.py 'Build 50 deployed! Fixed expo-image TurboModule crash — animated={false} on all static sprites. Test gym career mode your highness.'
Diagnose and fix errors. Do NOT use rm -rf ios/build."

#!/bin/bash
cd "$(dirname "$0")"

claude --dangerously-skip-permissions -p "Deploy build 52 to TestFlight. Steps:
1. git config user.email sharma.tanmay2000@gmail.com
2. Bump build number to 52 in app.json
3. npm install (to update node_modules after expo-image removal from package.json)
4. git commit -am 'bump build to 52 - remove expo-image package entirely'
5. git tag -a v1.0-b52 -m 'TestFlight build 52 - remove expo-image native module to fix iOS 26 TurboModule crash'
6. npx expo prebuild --platform ios --clean
7. Fix hermesc: sed -i '' 's|/Users/tanmaysharma/pkmn-btl-sim/|/Users/tanmaysharma/repos/pkmn-btl-sim/|g' ios/Pods/Target\ Support\ Files/Pods-PBSim/Pods-PBSim.*.xcconfig
8. cd ios && pod install && cd ..
9. xcodebuild archive -workspace ios/PBSim.xcworkspace -scheme PBSim -configuration Release -archivePath /tmp/PBSim.xcarchive -destination 'generic/platform=iOS' CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=U9782HGY2C
10. xcodebuild -exportArchive -archivePath /tmp/PBSim.xcarchive -exportOptionsPlist ios/ExportOptions.plist -exportPath /tmp/PBSim-export -allowProvisioningUpdates -authenticationKeyPath ~/.private_keys/AuthKey_6DZ8G8Z994.p8 -authenticationKeyID 6DZ8G8Z994 -authenticationKeyIssuerID 1ca8bcd8-09c7-4628-acc8-fcba0c68957f
11. python3 ~/repos/agent-hub/scripts/telegram.py 'Build 52 deployed! Removed expo-image package entirely - no more TurboModule crash. GIF sprites will show as static for now. Test gym career mode your highness.'
Diagnose and fix errors. Do NOT use rm -rf ios/build. IMPORTANT: run npm install BEFORE expo prebuild to ensure expo-image is removed from node_modules."

# Task: Deploy v2.0 to TestFlight

Follow global-constraints.md deployment steps exactly. This has been deployed many times from this machine before — automatic signing works.

## Steps

1. **Run tests**: `npx vitest run` — must all pass (1 flaky timeout in p1-p2-consistency is ok to skip if it's just a timeout)
2. **Bump build number** in `app.json`: change `"buildNumber": "1"` to `"buildNumber": "20"` (last TestFlight was build 19)
3. **Commit**: `git add -A && git commit -m "bump build to 20 for TestFlight"`
4. **Tag**: `git tag -a v2.0.0-b20 -m "TestFlight build 20"`
5. **Deploy via xcodebuild**:
   ```bash
   cd ios
   pod install
   xcodebuild clean -workspace PBSim.xcworkspace -scheme PBSim -configuration Release
   xcodebuild archive \
     -workspace PBSim.xcworkspace \
     -scheme PBSim \
     -configuration Release \
     -archivePath ./build/PBSim.xcarchive \
     -destination 'generic/platform=iOS' \
     CODE_SIGN_STYLE=Automatic
   xcodebuild -exportArchive \
     -archivePath ./build/PBSim.xcarchive \
     -exportOptionsPlist ExportOptions.plist \
     -exportPath ./build/export
   ```
6. **Upload**: `xcrun altool --upload-app -f ./build/export/PBSim.ipa -t ios -u sharma.tanmay2000@gmail.com -p @keychain:AC_PASSWORD`
   - If keychain doesn't have it, try: `xcrun notarytool store-credentials` or ask Tanmay for the app-specific password
7. **Push**: `git push origin main --tags`

## Important
- Use CODE_SIGN_STYLE=Automatic (not Manual) — cloud signing handles distribution cert
- If altool fails with auth, ask Tanmay for credentials — don't skip upload
- ExportOptions.plist is already in ios/ directory

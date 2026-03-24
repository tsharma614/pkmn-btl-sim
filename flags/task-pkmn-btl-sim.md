# Task: Deploy to TestFlight

Battle stats feature has been reviewed line-by-line and approved. Ship it.

## Steps

Follow the deployment steps EXACTLY from global-constraints.md for React Native (pkmn-btl-sim):

1. Run all tests first — make sure all 1223+ still pass
2. Increment build number in app.json (should be build 45 next)
3. Commit the version bump
4. Tag the commit: `git tag -a v<version>-b45 -m "TestFlight build 45"`
5. Run the full deploy pipeline:
   - `npx expo prebuild --platform ios --clean`
   - Fix hermesc path with sed
   - `cd ios && pod install && cd ..`
   - Archive with xcodebuild
   - Export + upload with API key
6. Confirm upload succeeded

## CRITICAL
- Do NOT skip any step
- Do NOT use Xcode GUI
- Do NOT use EAS (costs money)
- Use API key auth (AuthKey_6DZ8G8Z994.p8), NOT altool
- Archive to /tmp/ path, NOT ./build/

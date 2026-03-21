# Task: Add E2E Tests (Detox)

DO NOT start until TASK-CRASH-AUDIT is complete.

Add E2E UI tests using Detox (React Native E2E framework).

## Setup
1. `npm install --save-dev detox @types/detox jest-circus`
2. Create `.detoxrc.js` config for iOS simulator
3. Create `e2e/` directory with test files
4. Add `testID` props to all interactive elements that need them

## Test Flows

### 1. App Launch & Main Menu
- App launches without crash
- Pokeball logo visible
- "CPU Battle" button tappable
- "Campaign" button tappable
- "Online" button tappable
- Stats button navigates to stats screen

### 2. CPU Battle Flow
- Tap CPU Battle → setup screen
- Enter name → start game
- Draft screen shows Pokemon pool
- Pick 6 Pokemon → confirm
- Move selection screen (if enabled) → pick moves → confirm
- Item selection screen → pick items → confirm
- Battle screen loads with both Pokemon visible
- Can tap a move to attack
- HP bars update after attack
- Can switch Pokemon
- Battle completes (win or lose) → end overlay shows

### 3. Campaign — Gym Career
- Tap Campaign → campaign menu
- Start new gym career → budget draft
- Pick 6 Pokemon within budget → confirm
- Gym map shows 8 gyms
- Tap a gym → battle starts
- Win battle → shop screen shows with balance
- Shop: swap move flow works (pick Pokemon → pick slot → pick new move)
- Shop: swap item flow works
- Shop: done → back to gym map
- Gym marked as beaten on map

### 4. Item Selection
- All items display with sprites
- Tap item → selects (highlights)
- Tap same item → deselects
- Long press item → detail modal with description
- All team members assigned → confirm button enables
- Navigate between Pokemon with prev/next

### 5. Move Selection
- Move filter buttons work (All/Physical/Special/Status)
- Tap move → selects
- Long press move → detail popup with type, power, accuracy, PP
- Can pick 4 moves per Pokemon
- Navigate between Pokemon

### 6. Stats Screen
- Shows profile name
- Shows win/loss record
- Shows top Pokemon by KOs
- Campaign history visible

### 7. Crash Resilience
- Rapid navigation between screens doesn't crash
- Start battle → immediately go back → no crash
- Open shop → close immediately → no crash
- Background app during battle → resume → no crash

## Guidelines
- Add `testID` to all Touchable/Button/View elements that tests interact with
- Do NOT modify game logic or UI layout
- Tests run against iOS simulator
- Each test independent
- Use `device.reloadReactNative()` between test suites

## After
- All E2E tests pass on simulator
- Commit
- Rename to TASK-E2E-TESTS-DONE.md

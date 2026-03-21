# Task: Critical Bugs — Shop Not Showing + Crash + Missing Sprites

## 1. Shop Doesn't Appear After Gym Win
Player beat the Water gym (shows CLEARED ✓ on gym map) but the shop screen NEVER appeared. The flow should be: gym win → shop → gym map. The shop is being skipped entirely.

Check the GYM_WIN_ADVANCE reducer action — does it set phase to 'shop'? Or is it going straight to gym_map?

## 2. STILL CRASHING After Gym Win (Build 31)
SIGABRT on Thread 5 in CALayer/CATransaction — this is a Core Animation crash during the screen transition. Different from the Hermes crash in build 30 but same trigger (gym win transition).

The atomic dispatch fix may have moved the crash from JS thread to the UI thread. The root cause is still the screen transition — React Native is trying to update UI elements that are being removed.

## 3. Team Preview Missing Sprites
On the "Choose Your Lead" screen, Pokemon cards at the bottom show "?" instead of sprites. Only the selected Pokemon shows its sprite. The other 5 show question marks.

## After
- Fix all 3
- `npx vitest run` — all pass
- Deploy
- Rename to TASK-CRITICAL2-DONE.md

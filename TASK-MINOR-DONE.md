# Task: Add missing Safety Goggles powder move test

In tests/engine/item-audit.test.ts, add a test that verifies Safety Goggles blocks powder/spore moves (Sleep Powder, Stun Spore, etc.). The logic exists in battle.ts but there's no test for it.

After: `npx vitest run` — all pass. Commit. Rename to TASK-MINOR-DONE.md.

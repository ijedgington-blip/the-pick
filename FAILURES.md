# Failure Log & Maintenance Notes

## 2026-04-30: Node Version Mismatch in Cron

### Issue
The script failed with `SyntaxError: Invalid regular expression flags` even after using absolute paths for `gemini`.

### Root Cause
- The `gemini` executable uses `#!/usr/bin/env node` in its shebang.
- In the cron environment, `env node` was finding the system Node v18.19.1 instead of the required v20.20.0.
- Node v18 does not support some regex flags used by the Gemini CLI.

### Fix
- Updated `run-pick.sh` to explicitly `export PATH="/home/edge/.nvm/versions/node/v20.20.0/bin:$PATH"`.
- Updated `scripts/fetch-data.ts` to call `gemini` directly, relying on the environment `PATH`.
- Verified that `run-pick.sh` now executes correctly and triggers the Gemini analysis as expected.

### Lessons for Future Agents
- Absolute paths to binaries are not enough if those binaries use `env` in their shebang.
- Setting the `PATH` in the entry point (crontab or wrapper script) is the most reliable way to ensure the entire execution tree uses the correct Node version.

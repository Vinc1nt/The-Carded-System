# The Carded System — Real-Time Turn Tracker

A lightweight Node + vanilla JS control surface for your custom D&D-adjacent system. The tracker keeps the GM and every player window synchronized in real time, enforces your AP-centric core loop, and gives quick buttons for the standard tactical actions (Move, Disengage, Slip, Guard, Interact, Manual Swap, and the difficult-terrain toggle).

> **State is in-memory.** Restarting the server clears the encounter.

## Requirements

- Node.js 18+ (uses native ES modules and `EventSource`).

## Quick start

1. From this folder run `npm install` (no dependencies, but it creates `package-lock.json` if you want).
2. Start the tracker with `npm start` (or `PORT=4000 npm start`).
3. Visit `http://localhost:3000/` in your browser for the GM console.
4. Open `http://localhost:3000/player` in a second window or on another machine for each player dashboard.

### Double-click launcher (macOS)

- Double-click `start-tracker.command` in the project root. It auto-installs dependencies if needed, then runs `npm start` inside a Terminal window (leave that window open while playing).

The sandbox used while developing this project blocks listening on ports, so the server was syntax-checked with `node --check server.js` but not executed end-to-end inside the sandbox.

## Encounter Console tour

- **Turn Order:** Add combatants with initiative, HP/Shield/AP caps, and set focus. Click any row to edit full details (stats, tags, notes, cards, and statuses).
- **Active Combatant panel:** Update AP/HP/Shield, ability scores, tags, and mastery. Add/remove card entries with the structured form so cards show set/tier/AP-/Range/Tags text for the player view. Statuses are tracked with severity + stack counts.
- **Standard Actions:** Buttons send the proper AP spend + log line. The “Difficult terrain” checkbox converts Move into the 5-ft version. Guard enforces the once/turn cap and automatically restores 3 Shield. Manual Swap spends 2 AP, matching your core rules.
- **Short/Long Rest:** Buttons now call the `/api/rest/short|long` endpoints. Short Rest auto-heals `5 + CON` and clears one minor condition; Long Rest restores HP/Shield/AP and wipes conditions—fixing the “long and short rest don’t work” problem from the baseline.
- **Custom log entries:** Free-form textarea for rulings, condition saves, etc.
- **Action Log:** Streams every entry with timestamps so everyone can replay the turn.

## Player Dashboard

Each player can pop `/player?id=<combatantId>` (or pick themselves from the dropdown) to see:

- Live HP/Shield/AP totals, ability scores, statuses, notes, and the default action reference.
- Their full card list with set, tier, AP cost, ranges, tags, mastery track, fusion notes, and set bonuses.
- A filtered action log that only shows their own turns/resolutions.
- A banner reminding them when it’s their turn (based on the shared initiative order).

## Mechanics baked in

- **AP economy:** Default max AP = 6; each turn resets AP and Guard availability. Manual swaps cost 2 AP and enter “readied” state per your rules (not playable until next turn).
- **Standard action costs:**

  | Action | AP | Effect |
  | --- | --- | --- |
  | Move | 1 | 10 ft (Difficult Terrain checkbox toggles to 5 ft) |
  | Disengage | 2 | Movement ignores OAs this turn |
  | Slip | 1 | 5 ft without provoking |
  | Interact/Use | 1 | Simple interactions |
  | Guard | 2 | Restore 3 persistent Shield (once/turn) |
  | Manual Swap | 2 | Swap a card; the new card readies next turn |

- **Short Rest:** Heals `5 + CON`, clears one minor condition, logs the event.
- **Long Rest:** Restores HP/Shield/AP, clears all statuses, and logs the rest.
- **Status rules:** UI nudges you to capture Severity (Minor/Moderate/Severe), stack counts, and any notes so they align with your tiered Resist mechanics.
- **Card structure:** Cards store set, type, tier, HP bonus, AP cost, range, tags, free-text effect, mastery track, fusion notes, and set bonuses—matching the specification in your document.

## API / integration notes

All routes accept/return JSON:

- `GET /api/state` — snapshot used by the UI + SSE clients.
- `POST /api/participants` — add a new combatant.
- `PATCH /api/participants/:id` — update stats/cards/statuses.
- `DELETE /api/participants/:id` — remove a combatant.
- `POST /api/participants/:id/adjust` — targeted numeric tweaks (AP, HP, Shield, etc.).
- `POST /api/turn/start|next|previous` — manage initiative order.
- `POST /api/actions/standard` — invoked by the buttons; enforces AP + guard limits.
- `POST /api/actions/custom` — push arbitrary log text.
- `POST /api/rest/short|long` — implements the refreshed rest mechanics.
- `GET /events` — SSE stream; every browser tab stays in sync without polling.

## Limitations & next steps

- No persistence yet — state resets on restart. You can serialize `trackerState` to disk or add a lightweight database if desired.
- Authentication/permissions are out of scope. Anyone on the LAN can mutate state if they can reach the server.
- Cards & statuses are free-form strings; future work could provide validation, quick-tag buttons, or import/export utilities for your card library.
- The combat math helpers (DPA targets, set bonuses) are reference-only; enforcing them automatically would require deeper game-logic modeling.

Feel free to iterate on the UI, add persistence, or hook into a VTT—everything is plain Node/JS, so it’s easy to extend.

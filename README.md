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
- **Active Combatant panel:** Update AP/HP/Shield, ability scores, tags, and mastery. Card management, statuses, automation, and standard actions each live in collapsible drawers so you can keep the cards near the top of the viewport and pop open the area you need.
- **Standard Actions:** Buttons send the proper AP spend + log line. The “Difficult terrain” checkbox converts Move into the 5-ft version. Guard enforces the once/turn cap and automatically restores 3 Shield. Manual Swap spends 2 AP, matching your core rules.
- **Short/Long Rest:** Buttons now call the `/api/rest/short|long` endpoints. Short Rest auto-heals `5 + CON` and clears one minor condition; Long Rest restores HP/Shield/AP and wipes conditions—fixing the “long and short rest don’t work” problem from the baseline.
- **Custom log entries:** Free-form textarea for rulings, condition saves, etc.
- **Action Log:** Streams every entry with timestamps so everyone can replay the turn.
- **Card automation:** Each card can optionally add flat bonuses to Max HP, Max Shield, AP, Guard restore, or damage. The tracker aggregates these plus the built-in set library (Machine/Goblinoid/Elemental/Human starters) and applies the resulting derived stats automatically.
- **Card management drawer:** Cards live directly under the active combatant with quick add/remove tools so you can swap loadouts between turns without leaving the page.

## Automation workflow

- **Base stats vs derived:** The “Advanced Stats” drawer tracks the base HP/Shield/AP (and base Guard/Damage bonuses). Derived values apply card modifiers plus any active set bonuses, so Max HP/AP/Shield update automatically when cards are added/removed.
- **Card modifiers:** When creating a card, fill in the “Max HP Bonus”, “Max Shield Bonus”, “AP Max Bonus”, “Guard Bonus”, and “Damage Bonus” fields as needed. These stack with every copy of the card equipped.
- **Set library:** Choose a Set while creating the card. The starter `Machine` set includes the Hardened Plating/Servo Stride/etc. bonuses from the reference doc; as players collect 3+/5+/7+/10+ cards from a set, those bonuses auto-apply. You can extend the `SET_LIBRARY` map in `server.js` to capture more sets or bespoke effects.
- **Automation summary panel:** The Active Combatant view shows the current guard restore amount, total damage bonus, and a breakdown of every card/set modifier that’s active—making it easy to audit why a combatant’s stats changed.

## Player Dashboard

Each player can pop `/player?id=<combatantId>` (or pick themselves from the dropdown) to see:

- Live HP/Shield/AP totals plus Guard restore and damage bonus, a printable-style character sheet (ability scores, saving throws, skills), a set tracker, statuses, and notes.
- Ability scores, proficiency bonus, saving throws, and skills are editable in-place; totals auto-calc using the D&D mod/proficiency rules so players can manage level-ups without touching the GM console.
- Their full card list with set, tier, AP cost, ranges, tags, mastery track, fusion notes, and the automation bonuses that card contributes.
- A relics/artifacts section lets players add/remove custom items (with HP/AP/ability notes) to track narrative power-ups alongside cards.
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
- **Card structure:** Cards store set, type, tier, AP cost, range, tags, free-text effect, mastery track, fusion notes, plus the automation fields mentioned above so you can model HP/AP/Guard/Damage bonuses right in the UI.

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
- The combat math helpers (DPA targets, set bonus riders like Servo Stride’s free movement) are reference-only; anything more complex than flat stat bonuses still needs a GM ruling or future automation work.

Feel free to iterate on the UI, add persistence, or hook into a VTT—everything is plain Node/JS, so it’s easy to extend.

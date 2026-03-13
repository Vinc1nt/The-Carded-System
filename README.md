# The Carded System - Real-Time Turn Tracker

Node + vanilla JS encounter tracker for a card-based tactical system. GM and player windows stay synchronized via Server-Sent Events.

> State is in-memory. Restarting the server clears the encounter unless you export/import.

## Requirements

- Node.js 18+

## Quick Start

1. Run `npm install`.
2. Run `npm start` (or `PORT=4000 npm start`).
3. Open `http://localhost:3000/` for GM.
4. Open `http://localhost:3000/player` for player dashboards.

### macOS Launcher

- Double-click `start-tracker.command` to auto-start in Terminal.

## Current Gameplay Features

- Real-time turn order with participant turns plus zone turns.
- Standard actions with AP enforcement:
  - Move, Move (Difficult Terrain), Disengage, Slip, Interact/Use, Guard, Recover, Manual Swap.
- Card actions with mastery scaling and automation fields.
- Construct deployment/retarget/remove/move APIs.
- Zone creation from cards, zone turns in initiative, and target management from GM/player dashboards.
- Max active zone cap per participant (currently 2). Casting beyond cap is blocked with an error.
- Max active card cap per participant (currently 10).
- Short/Long rest (single participant and all-participants).
- Journal entries (quests/achievements), player ack flow.
- Card import/export, encounter import/export, participant import.
- End Encounter button/API to reset encounter turn state.
- All collapsible UI sections default to closed for GM/player/library.
- GM Help Menu with popup tabs for Statuses, Combat Rules, Out of Combat, and Cards.

## Card Bonus Rules

- `healthBonus` and `shieldBonus` are card-level bonuses that feed derived stats.
- `shieldBonus` defaults by tier when not explicitly set:
  - Common +1
  - Uncommon +1
  - Rare +2
  - Very Rare +3
  - Epic +4
  - Legendary +5
- Tier bonus logic is centralized so existing and future cards stay consistent.

## Config You Will Edit Most

- Global limits: [lib/game-config.js](lib/game-config.js)
  - `maxActiveCards`
  - `maxActiveZones`
- Server tier rules: [lib/card-rules.js](lib/card-rules.js)
- Frontend shared tier rules: [public/shared/card-rules.js](public/shared/card-rules.js)
- Frontend UI limits: [public/shared/game-config.js](public/shared/game-config.js)

## API Summary

All routes accept/return JSON.

- State and sync
  - `GET /api/state`
  - `GET /events`
- Encounter import/export
  - `GET /api/export/encounter`
  - `POST /api/import/encounter`
- Participants
  - `POST /api/participants`
  - `PATCH /api/participants/:id`
  - `DELETE /api/participants/:id`
  - `POST /api/participants/:id/adjust`
  - `POST /api/import/participant`
- Turn flow
  - `POST /api/turn/start`
  - `POST /api/turn/end`
  - `POST /api/turn/next`
  - `POST /api/turn/previous`
- Actions
  - `POST /api/actions/standard`
  - `POST /api/actions/card`
  - `POST /api/actions/custom`
- Constructs
  - `POST /api/constructs/remove`
  - `POST /api/constructs/target`
  - `POST /api/constructs/move`
- Zones
  - `POST /api/zones/target/add`
  - `POST /api/zones/target/remove`
- Set actions
  - `POST /api/set/activate`
- Rest
  - `POST /api/rest/short`
  - `POST /api/rest/long`
  - `POST /api/rest/short/all`
  - `POST /api/rest/long/all`
- Journal
  - `POST /api/journal/entry`
  - `DELETE /api/journal/entry`
  - `POST /api/journal/ack`

## Code Structure (Ongoing Refactor)

- `server.js`
  - Route table and core runtime state.
  - Domain wrappers that call extracted modules.
- `lib/`
  - `game-config.js`: shared server limits.
  - `card-rules.js`: server card tier rules/helpers.
  - `encounter-lifecycle.js`: start/end encounter behavior.
  - `turn-order.js`: turn entry/index helpers.
  - `rest.js`: short/long rest mechanics.
  - `actions/custom.js`: custom action log handling.
  - `actions/card-preflight.js`: card-action actor/card validation.
  - `actions/standard.js`: standard action handling.
  - `actions/construct.js`: construct remove/retarget/move handling.
  - `actions/zone-targets.js`: add/remove zone target handling.
- `public/`
  - `app.js`: GM client.
  - `player.js`: player client.
  - `cards.js`: preset card library client.
  - `shared/game-config.js`: frontend UI limits.
  - `shared/card-rules.js`: frontend tier shield rule helper.

## Notes

- No auth/permissions currently.
- Data model is flexible and mostly free-form for cards/statuses to keep table iteration fast.
- Refactor strategy is incremental extraction with behavior-preserving wrappers plus smoke tests.

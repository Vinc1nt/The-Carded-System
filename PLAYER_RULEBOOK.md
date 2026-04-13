# The Carded System

## Player Rulebook

This document explains the current player-facing rules used by the tracker.

If a card, set bonus, or scenario rule directly contradicts a general rule in this document, the more specific rule wins.

## 1. Core Combat Loop

- Combat runs on turn order.
- On your turn, you spend Action Points (`AP`) on standard actions, card actions, weapon attacks, and some special effects.
- Attacks auto-hit unless positioning, cover, immunity, or a specific effect says otherwise.
- Ranges are literal. If a card says `5 ft`, `20 ft`, `Radius 10 ft`, or `Self`, use that exact distance.
- Characters on the same team are treated as allies.

## 2. Action Points

- `AP` is your action economy for the turn.
- If an action says it costs `2 AP`, you must spend 2 AP to use it.
- If a card or effect grants AP, it is added immediately unless the effect says it applies next turn.
- Some debuffs reduce your effective AP on a later turn.

## 3. Standard Actions

### Move

- Default movement is `10 ft` for `1 AP`.
- `DEX` changes movement by `5 ft` per modifier.
- You may repeat Move as long as you still have AP.

### Move in Difficult Terrain

- Difficult terrain starts at `5 ft` for `1 AP`.
- `DEX` still modifies that distance.

### Disengage

- `2 AP`.
- Your movement this turn does not provoke opportunity attacks.

### Duck

- `1 AP`.
- Gain `Half Cover` until the start of your next turn.

### Interact / Use

- Usually `1 AP`.
- Use this for objects, levers, doors, items, or other contextual interactions.

### Guard

- `2 AP`.
- Restore Shield equal to your `Guard Restore`.
- Guard cannot raise you above your `Max Shield`.

### Recover

- `2 AP`.
- Remove `1` stack of `Bleeding`, `Poisoned`, or `Burning`.

### Cleanse

- `4 AP`.
- Remove `1` eligible control or debuff status.

## 4. Ability Scores And Scaling

Ability modifiers use the standard formula:

- `floor((score - 10) / 2)`

Current scaling rules:

- `STR`: `+1` melee damage per modifier.
- `DEX`: `+5 ft` movement per modifier.
- `CON`: `+4` max HP per modifier.
- `WIS`: `+4` base Shield per modifier.
- `INT`: `+1` direct magic damage per modifier.
- `CHA`: `+1` status-effect damage per modifier.

Scaling applies as follows:

- `STR` applies to melee physical attacks.
- `DEX` applies to standard movement, difficult-terrain movement, and card-based movement.
- `INT` applies to direct magic attacks.
- `CHA` applies to damaging statuses and other status-based damage.

Direct magic damage types are:

- `Acid`
- `Cold`
- `Fire`
- `Force`
- `Lightning`
- `Necrotic`
- `Poison`
- `Psychic`
- `Radiant`
- `Thunder`

Melee physical damage types are:

- `Bludgeoning`
- `Piercing`
- `Slashing`

## 5. HP, Shield, And Damage

- Damage hits `Shield` first unless a rule says it bypasses Shield.
- When Shield is reduced to `0`, remaining damage spills into `HP`.
- If your `HP` reaches `0`, you are defeated.
- Your `Max Shield` is affected by `WIS`, card bonuses, armour, and shields.

## 6. Resistances, Vulnerabilities, And Immunities

- `Resistance` halves matching incoming damage.
- `Vulnerability` doubles matching incoming damage.
- `Immunity` prevents matching damage or matching status effects.
- If you resist a matching status effect, its timed decay improves from `1` per turn to `2` per turn.

## 7. Status Effects

### Damaging Statuses

#### Bleeding

- Bypasses Shield.
- At the start of your turn, take damage equal to stacks.
- Then Bleeding loses `1` stack.
- If Bleeding is still `5+`, gain `Weakened 1` and reset Bleeding to `1` once that turn.
- `Recover` removes `1` stack.

#### Poisoned

- Bypasses Shield.
- At the start of your turn, take damage equal to stacks.
- Then Poisoned loses `1` stack.
- If Poisoned is still `5+`, gain `Fatigued 1` and reset Poisoned to `1` once that turn.
- `Recover` removes `1` stack.

#### Burning

- Hits Shield first.
- At the start of your turn, take damage equal to stacks.
- Then Burning loses `1` stack.
- Burning does not escalate.
- `Recover` removes `1` stack.

### Common Debuffs And Control

#### Blinded

- Cannot target beyond `5 ft`.
- Your attacks deal `-2` damage.
- Usually clears at the end of your next turn or with `1 AP` if allowed.

#### Weakened

- Your attacks deal `-2` damage.

#### Fatigued

- You lose `1 AP` on your next turn, minimum `1 AP`.

#### Rooted

- Your speed becomes `0`.
- You can still act.
- If Rooted reaches `5+`, it escalates to `Restrained`.

#### Restrained

- Speed becomes `0`.
- Attacks against you deal `+2` damage.

#### Stunned

- You lose your next turn.
- Stunned replaces Rooted and Restrained.

#### Silenced

- You cannot use verbal or speech-dependent abilities.

#### Charmed

- Mental influence effect.
- Exact behavior depends on the card or scenario.

#### Frightened

- Fear effect.
- Exact movement or targeting restrictions depend on the card or scenario.

#### Suppressed

- You cannot play cards while active.

### Timed / Card-Specific Effects

Some cards create unique timed effects, including:

- `Infernal Brand`
- `Blood Curse`
- `Curse of Weakness`
- `Mind Shield`
- `Enlarge`
- `Reduce`
- `Two Step`
- `Haste Matrix`
- `Haste Crash`
- `Polymorphed`
- `Sight Unseen`
- `Toiling Flames`

Read the card text and status note together. These effects often add a rule beyond basic damage or stacks.

## 8. Cards

Each card has:

- a `Set`
- a `Type`
- a `Tier`
- an `AP Cost`
- optional `Charges`
- a `Range`
- a `Health Bonus`
- a `Shield Bonus`
- tags
- an effect

If a card has charges, it cannot be used when its charges are depleted.

Card effects may do any of the following:

- deal direct damage
- apply statuses
- heal
- restore Shield
- move, push, or pull
- summon constructs
- create zones
- grant AP
- create timed buffs or debuffs

## 9. Card Tiers And Shield Bonus

Default Shield bonus by tier:

- `Common`: `+1`
- `Uncommon`: `+1`
- `Rare`: `+2`
- `Very Rare`: `+3`
- `Epic`: `+4`
- `Legendary`: `+5`

## 10. Card Mastery

Cards improve as you use them.

### Mastery Levels

- `Level 1`: Basic
- `Level 2`: Mastered
- `Level 3`: Refined
- `Level 4`: Fusion-Ready

### Default Mastery Thresholds By Tier

#### Common

- Level 2: `10` uses
- Level 3: `25` uses
- Level 4: `50` uses

#### Uncommon

- Level 2: `13` uses
- Level 3: `35` uses
- Level 4: `70` uses

#### Rare

- Level 2: `15` uses
- Level 3: `45` uses
- Level 4: `100` uses

#### Very Rare

- Level 2: `20` uses
- Level 3: `50` uses
- Level 4: `120` uses

#### Epic

- Level 2: `25` uses
- Level 3: `65` uses
- Level 4: `140` uses

#### Legendary

- Level 2: `30` uses
- Level 3: `85` uses
- Level 4: `190` uses

### Mastery Notes

- Many cards gain a numeric improvement at Level 2.
- Some cards offer a choice at Level 2 and grant the other option later.
- At Level 4, a card becomes fusion-eligible.

## 11. Weapons

Weapons do two things:

- some weapons provide a `basic attack`
- equipped weapons can grant a `card bonus damage` bonus to matching cards

### Weapon Types

- `Melee Weapon`
- `Ranged Weapon`
- `Arcane Implement`
- `Staff`

### Basic Attacks

- Melee and ranged weapons can have a basic attack.
- Arcane implements and staffs currently do not have a basic attack by default.

### Weapon Card Matching

#### Melee Weapons

- Affect `5 ft` damage cards, including `5 ft` magic damage cards.

#### Ranged Weapons

- Affect ranged cards and damaging magic cards.

#### Arcane Implements / Staffs

- Affect damaging magic cards.

### Weapon Penalties

If you do not meet a weapon requirement or proficiency:

- the weapon adds AP penalty to matching card use
- the combined requirement and non-proficiency penalty is currently capped at `+3 AP`

Ranged weapons also require ammo for basic attacks.

## 12. Armour And Shields

Armour and shields are a shared equipment layer and stack with your base stats.

### Light Armour

- `+2 Max Shield`
- `+1 Shield Regen`
- no Strength requirement
- no armour drawback

### Medium Armour

- `+4 Max Shield`
- `+2 Shield Regen`
- `STR 12` requirement
- `DEX -1`
- if the Strength requirement is unmet, movement costs `2 AP per 10 ft`

### Heavy Armour

- `+6 Max Shield`
- `+3 Shield Regen`
- `STR 14` requirement
- `DEX -2`
- `Stealth disadvantage`
- if the Strength requirement is unmet, movement costs `2 AP per 10 ft`

### Shield

- `+3 Max Shield`
- `+1 Shield Regen`
- uses `1 hand`

### Armour Notes

- Armour STR penalties change movement cost; they are not a separate stacked AP tax.
- Heavy armour no longer means you cannot become Hidden by default.
- Heavy armour does mean your stealth should be treated at disadvantage.

## 13. Shield Regen

- Shield regen is tracked from your current equipment and effects.
- Armour and shields both contribute to total Shield regen.
- Card and set effects can add more Shield restoration.

## 14. Zones

Some cards create zones.

Zones:

- have their own duration
- may deal damage each turn
- may apply statuses each turn
- may heal or restore Shield
- may affect only enemies, only allies, or both depending on the card

Current tracker limits:

- max active zones per participant: `2`

## 15. Constructs

Constructs are separate combat entities controlled by their owner.

Construct rules:

- constructs use the owner's team
- constructs have their own HP, AP, statuses, and turns
- construct AP refreshes when the construct acts
- constructs do not act on the turn they are summoned
- a 2-turn construct summoned now gets 2 full later turns before expiring
- construct timing is suspended during `Pause Button`

If a summon card gives a construct cards:

- it only has the listed construct cards
- those cards default to `Mastery 1` unless the summon says otherwise

Construct limits:

- normal cap: `1` active construct
- `Machine 5`: cap becomes `2`
- `Machine 10`: cap becomes `3`
- if a new summon exceeds your cap, the oldest active construct is replaced

## 16. Current Summon Notes

### Summon Hellhound

- summons a construct with `4 AP`
- base `14 HP`
- Mastery 2 increases it to `20 HP`
- linked card: `Flame Bite`

### Summon Void Demon

- summons a construct with `5 AP`
- base `18 HP`
- Mastery 2 increases it to `24 HP`
- linked card: `Void Slash`

### Linked Construct Attacks

#### Flame Bite

- melee (`5 ft`)
- deals Fire damage
- applies `Burning 1`

#### Void Slash

- melee (`5 ft`)
- deals Necrotic damage
- deals extra damage to targets below half HP

## 17. Toiling Flames

`Toiling Flames` is an active self-buff.

While it is active:

- melee attackers that hit you take Necrotic retaliation damage
- Level 1 retaliation is `5 Necrotic`
- Level 2 retaliation is `7 Necrotic`
- ranged attacks do not trigger it

## 18. Set Bonuses

Set bonuses unlock when you equip enough active cards from the same set.

### Arcane

#### 3 Pieces

- once per turn, when you play a card, you may change its damage type
- `INT +1`

#### 5 Pieces

- once per turn, you may split a card's damage between two targets no more than `5 ft` apart
- `WIS +1`

#### 7 Pieces

- once per encounter, you may copy a card temporarily for the rest of the encounter
- `INT +1`

#### 10 Pieces

- once per encounter, modify a card for the rest of the encounter:
- `+10 ft range`
- `+5 ft radius`
- `+2 damage`
- `-1 AP cost` minimum `1`
- `INT +2`

### Beast

#### 3 Pieces

- when you apply Bleeding, apply `+1` extra stack once per turn
- `STR +1`

#### 5 Pieces

- deal `+2` damage to Bleeding enemies
- `CON +1`

#### 7 Pieces

- when Bleeding deals damage, restore `2 Shield`
- `STR +1`

#### 10 Pieces

- once per turn when you attack a Bleeding enemy, gain `+1 AP`
- `STR +2`

### Demonic

#### 3 Pieces

- when you apply Burning, Bleeding, or Poison, deal `+2` damage
- `STR +1`

#### 5 Pieces

- once per turn when you damage an enemy with a status, restore `2 HP`
- `CHA +1`

#### 7 Pieces

- once per turn when you take `5+` damage, gain `+1 AP` next turn
- `STR +1`

#### 10 Pieces

- once per turn when an enemy dies within `5 ft`, gain `+1 AP`
- `CHA +2`

### Divine

#### 3 Pieces

- when you restore HP to an ally, grant `2 Shield`
- `WIS +1`

#### 5 Pieces

- when you remove a status from an ally, restore `4 HP`
- `CON +1`

#### 7 Pieces

- once per encounter, reverse one instance of damage
- `WIS +1`

#### 10 Pieces

- once per long rest, grant all allies `1.5x` max HP, max Shield, and max AP
- cost: all current HP and Shield
- `WIS +2`

### Elemental

#### 3 Pieces

- when you apply Burning, Rooted, or Shock, apply `+1` stack once per turn
- `INT +1`

#### 5 Pieces

- Elemental attacks deal `+2` damage to enemies inside zones
- `DEX +1`

#### 7 Pieces

- zones you create deal `+2` damage
- `INT +1`

#### 10 Pieces

- once per turn when you apply a status, create a `5 ft` elemental burst dealing `3` damage
- `INT +2`

### Machine

#### 3 Pieces

- when you restore Shield, restore `+2` extra Shield
- `CON +1`

#### 5 Pieces

- once per turn after playing a Machine card, your next Machine Attack this turn costs `1` less AP, minimum `1`
- you may also have `2` constructs active
- `INT +1`

#### 7 Pieces

- constructs and turrets gain `+2` damage and last `1` turn longer
- `CON +1`

#### 10 Pieces

- you may have `3` constructs active
- `CON +2`

### Nature

#### 3 Pieces

- healing effects restore `+2 HP`
- `WIS +1`

#### 5 Pieces

- allies do not take damage from zones you create
- `DEX +1`

#### 7 Pieces

- allies inside your zones restore `+4 Shield` each turn
- `WIS +1`

#### 10 Pieces

- once per turn when you heal an ally, remove all stacks from one status effect
- `WIS +2`

### Shadow

#### 3 Pieces

- gain `+2` damage when attacking enemies that have not acted yet
- `DEX +1`

#### 5 Pieces

- when you move `15 ft` or more, your next attack deals `+3` damage
- `CHA +1`

#### 7 Pieces

- attacks against enemies with `Blinded`, `Weakened`, `Fatigued`, `Rooted`, `Restrained`, or `Stunned` deal `+3` damage and apply `Bleeding 1`
- `DEX +1`

#### 10 Pieces

- once per turn after attacking, move `10 ft`
- `DEX +2`

## 19. Active Deck Limits

Current tracker limits:

- max active cards per participant: `10`
- max active zones per participant: `2`

## 20. Rest

### Short Rest

- used to refresh short-rest resources and recover according to current rest rules

### Long Rest

- refreshes long-rest resources, refills all card charges, and clears once-per-long-rest limits

## 21. What The Tracker Automates vs What The Table Still Decides

### Mostly Automated

- AP spending
- standard action costs
- direct damage
- Shield and HP changes
- damaging status ticking
- most timed statuses
- card mastery progression
- zone duration and many zone effects
- construct duration and construct AP
- weapon and armour derived stats
- Toiling Flames retaliation

### Still Commonly GM-Adjudicated

- line of sight
- exact map positioning
- cover
- opportunity attack triggers
- hidden / stealth outcomes
- contested checks
- polymorph form details
- custom card text that describes behavior more specifically than the engine currently enforces
- some summon target priorities such as “nearest enemy” or “enemy closest to death”

## 22. Best Practices For Players

- Track your AP out loud so the turn stays readable.
- Check whether your equipped weapon boosts the card you are about to cast.
- Remember that `Recover` only handles `Bleeding`, `Poisoned`, and `Burning`.
- Use `Cleanse` for control and debuff problems.
- Pay attention to armour Strength requirements before building around movement-heavy turns.
- When using constructs or zones, state the intended targets clearly.
- Read the card text first, then apply these general rules second.

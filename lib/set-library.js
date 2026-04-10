function createSetBonus({
  id,
  pieces,
  effect,
  modifiers = {},
  abilityBonuses = {},
  proficiencies = [],
  languages = [],
  activatable
}) {
  return {
    id,
    pieces,
    effect,
    modifiers,
    abilityBonuses,
    proficiencies,
    languages,
    activatable
  };
}

export const SET_LIBRARY = Object.freeze({
  Arcane: [
    createSetBonus({
      id: 'arcane_3_damage_type_shift',
      pieces: 3,
      effect:
        'Once per turn when you play a card, you may change its damage type (Fire, Lightning, Acid, Cold, Necrotic, etc.).',
      abilityBonuses: { intelligence: 1 },
      proficiencies: ['Arcane Implements']
    }),
    createSetBonus({
      id: 'arcane_5_split_damage',
      pieces: 5,
      effect:
        "Once per turn you may split a card's damage between two targets no more than 5 ft apart.",
      abilityBonuses: { wisdom: 1 },
      proficiencies: ['Staff'],
      languages: ['Draconic']
    }),
    createSetBonus({
      id: 'arcane_7_temp_copy',
      pieces: 7,
      effect:
        'Once per encounter you may copy a card temporarily for the rest of the encounter. You must have an open slot in your active card deck when using this ability, or the copied card is lost.',
      abilityBonuses: { intelligence: 1 },
      proficiencies: ["Calligrapher's Supplies"],
      languages: ['Deep Speech'],
      activatable: {
        id: 'arcane_7_temp_copy'
      }
    }),
    createSetBonus({
      id: 'arcane_10_modify_card',
      pieces: 10,
      effect:
        'Once per encounter you may modify a card for the rest of the encounter: +10 ft range, +5 ft radius, +2 damage, or -1 AP cost (minimum 1).',
      abilityBonuses: { intelligence: 2 },
      proficiencies: ["Alchemist's Supplies"],
      languages: ['Primordial'],
      activatable: {
        id: 'arcane_10_modify_card'
      }
    })
  ],
  Beast: [
    createSetBonus({
      id: 'beast_3_bleed_extra_stack',
      pieces: 3,
      effect: 'When you apply Bleeding, apply +1 stack once per turn.',
      abilityBonuses: { strength: 1 },
      proficiencies: ['Club', 'Hand Axe']
    }),
    createSetBonus({
      id: 'beast_5_bleed_damage_bonus',
      pieces: 5,
      effect: 'Deal +2 damage to Bleeding enemies.',
      abilityBonuses: { constitution: 1 },
      proficiencies: ['Spear'],
      languages: ['Goblin']
    }),
    createSetBonus({
      id: 'beast_7_bleed_restore_shield',
      pieces: 7,
      effect: 'When Bleeding deals damage, restore 2 Shield.',
      abilityBonuses: { strength: 1 },
      proficiencies: ['Greataxe'],
      languages: ['Orc']
    }),
    createSetBonus({
      id: 'beast_10_bleed_ap_gain',
      pieces: 10,
      effect: 'Once per turn when you attack a Bleeding enemy, gain +1 AP.',
      abilityBonuses: { strength: 2 },
      proficiencies: ['Survival Tools'],
      languages: ['Giant']
    })
  ],
  Demonic: [
    createSetBonus({
      id: 'demonic_3_status_apply_damage',
      pieces: 3,
      effect: 'When you apply Burning, Bleeding, or Poison, deal +2 damage.',
      abilityBonuses: { strength: 1 },
      proficiencies: ['Dagger'],
      languages: ['Infernal']
    }),
    createSetBonus({
      id: 'demonic_5_status_damage_lifesteal',
      pieces: 5,
      effect: 'When you damage an enemy with a status, restore 2 HP once per turn.',
      abilityBonuses: { charisma: 1 },
      proficiencies: ['Arcane Implements'],
      languages: ['Abyssal']
    }),
    createSetBonus({
      id: 'demonic_7_damage_ap_next_turn',
      pieces: 7,
      effect: 'Once per turn when you take 5+ damage, gain +1 AP next turn.',
      abilityBonuses: { strength: 1 },
      proficiencies: ['Staff'],
      languages: ['Deep Speech']
    }),
    createSetBonus({
      id: 'demonic_10_nearby_kill_ap',
      pieces: 10,
      effect: 'Once per turn when an enemy dies within 5 ft, gain +1 AP.',
      abilityBonuses: { charisma: 2 },
      proficiencies: ['Ritual / Forgery Tools'],
      languages: ['Undercommon']
    })
  ],
  Divine: [
    createSetBonus({
      id: 'divine_3_heal_grant_shield',
      pieces: 3,
      effect: 'When you restore HP to an ally, grant 2 Shield.',
      abilityBonuses: { wisdom: 1 },
      proficiencies: ['Mace', 'Light Armour'],
      languages: ['Celestial']
    }),
    createSetBonus({
      id: 'divine_5_cleanse_heal',
      pieces: 5,
      effect: 'When you remove a status from an ally, restore 4 HP.',
      abilityBonuses: { constitution: 1 },
      proficiencies: ['Shield'],
      languages: ['Common'],
      activatable: {
        id: 'divine_5_cleanse_heal'
      }
    }),
    createSetBonus({
      id: 'divine_7_reverse_damage',
      pieces: 7,
      effect: 'Once per encounter, reverse one instance of damage.',
      abilityBonuses: { wisdom: 1 },
      proficiencies: ['Staff'],
      languages: ['Elvish']
    }),
    createSetBonus({
      id: 'divine_10_sacred_overcharge',
      pieces: 10,
      effect:
        'Once per long rest, grant all allies 1.5x max HP, 1.5x max Shield, and 1.5x max AP, at the cost of all current HP and Shield.',
      abilityBonuses: { wisdom: 2 },
      proficiencies: ['Herbalism Kit'],
      languages: ['Draconic'],
      activatable: {
        id: 'divine_10_sacred_overcharge'
      }
    })
  ],
  Elemental: [
    createSetBonus({
      id: 'elemental_3_status_extra_stack',
      pieces: 3,
      effect: 'When you apply Burning, Rooted, or Shock, apply +1 stack once per turn.',
      abilityBonuses: { intelligence: 1 },
      proficiencies: ['Arcane Implements'],
      languages: ['Primordial']
    }),
    createSetBonus({
      id: 'elemental_5_zone_target_bonus',
      pieces: 5,
      effect: 'Elemental attacks deal +2 damage to enemies inside zones.',
      abilityBonuses: { dexterity: 1 },
      proficiencies: ['Staff']
    }),
    createSetBonus({
      id: 'elemental_7_zone_damage_bonus',
      pieces: 7,
      effect: 'Zones you create deal +2 damage.',
      abilityBonuses: { intelligence: 1 },
      proficiencies: ['Light Armour']
    }),
    createSetBonus({
      id: 'elemental_10_status_burst',
      pieces: 10,
      effect: 'When you apply a status, create a 5 ft elemental burst dealing 3 damage (once per turn).',
      abilityBonuses: { intelligence: 2 },
      proficiencies: ["Alchemist's Supplies"]
    })
  ],
  Machine: [
    createSetBonus({
      id: 'machine_3_reinforced_restore',
      pieces: 3,
      effect: 'When you restore Shield, restore +2 additional Shield.',
      modifiers: { guardRestore: 2 },
      abilityBonuses: { constitution: 1 },
      proficiencies: ["Tinker's Tools"],
      languages: ['Dwarvish']
    }),
    createSetBonus({
      id: 'machine_5_auto_loader',
      pieces: 5,
      effect:
        'Once per turn, after you play a Machine card, your next Machine Attack this turn costs 1 less AP (min 1). You may also have 2 constructs active at the same time.',
      abilityBonuses: { intelligence: 1 },
      proficiencies: ['Light Armour'],
      languages: ['Gnomish']
    }),
    createSetBonus({
      id: 'machine_7_construct_boost',
      pieces: 7,
      effect: 'Constructs and turrets you deploy gain +2 damage and last 1 turn longer.',
      abilityBonuses: { constitution: 1 },
      proficiencies: ['Medium Armour', 'Shield'],
      languages: ['Machine Code']
    }),
    createSetBonus({
      id: 'machine_10_construct_cap',
      pieces: 10,
      effect: 'You may have 3 constructs active at the same time.',
      abilityBonuses: { constitution: 2 },
      proficiencies: ['Heavy Armour', "Smith's Tools"]
    })
  ],
  Nature: [
    createSetBonus({
      id: 'nature_3_healing_bonus',
      pieces: 3,
      effect: 'Healing effects restore +2 HP.',
      abilityBonuses: { wisdom: 1 },
      proficiencies: ['Staff'],
      languages: ['Sylvan']
    }),
    createSetBonus({
      id: 'nature_5_zone_friendly_fireproof',
      pieces: 5,
      effect: 'Allies do not take damage from zones you create.',
      abilityBonuses: { dexterity: 1 },
      proficiencies: ['Sling', 'Spear'],
      languages: ['Elvish']
    }),
    createSetBonus({
      id: 'nature_7_zone_ally_shield',
      pieces: 7,
      effect: 'Allies inside your zones restore +4 Shield each turn.',
      abilityBonuses: { wisdom: 1 },
      proficiencies: ['Light Armour'],
      languages: ['Halfling']
    }),
    createSetBonus({
      id: 'nature_10_heal_cleanse',
      pieces: 10,
      effect: 'Once per turn when you heal an ally, remove all stacks from one status effect.',
      abilityBonuses: { wisdom: 2 },
      proficiencies: ['Herbalism Kit', "Navigator's Tools"],
      languages: ['Druidic']
    })
  ],
  Shadow: [
    createSetBonus({
      id: 'shadow_3_preacted_bonus',
      pieces: 3,
      effect: 'Gain +2 damage when attacking enemies that have not acted yet.',
      abilityBonuses: { dexterity: 1 },
      proficiencies: ['Dagger', 'Light Armour']
    }),
    createSetBonus({
      id: 'shadow_5_move_damage_bonus',
      pieces: 5,
      effect: 'When you move 15 ft or more, your next attack deals +3 damage.',
      abilityBonuses: { charisma: 1 },
      proficiencies: ['Shortsword'],
      languages: ["Thieves' Cant"]
    }),
    createSetBonus({
      id: 'shadow_7_debuff_finishers',
      pieces: 7,
      effect:
        'Attacks against enemies with Blinded, Weakened, Fatigued, Rooted, Restrained, or Stunned deal +3 damage and apply 1 Bleeding.',
      abilityBonuses: { dexterity: 1 },
      proficiencies: ['Hand Crossbow'],
      languages: ['Undercommon']
    }),
    createSetBonus({
      id: 'shadow_10_post_attack_move',
      pieces: 10,
      effect: 'Once per turn after attacking, move 10 ft.',
      abilityBonuses: { dexterity: 2 },
      proficiencies: ["Thieves' Tools", 'Disguise Kit'],
      languages: ['Goblin']
    })
  ],
  Goblinoid: [],
  Human: []
});

export function buildSetNameLookup(setLibrary = SET_LIBRARY) {
  return Object.keys(setLibrary).reduce((acc, key) => {
    acc[String(key).toLowerCase()] = key;
    return acc;
  }, {});
}

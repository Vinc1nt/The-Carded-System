export const SET_LIBRARY = Object.freeze({
  Arcane: [
    {
      id: 'arcane_3_damage_type_shift',
      pieces: 3,
      effect:
        'Once per turn when you play a card, you may change its damage type (Fire, Lightning, Acid, Cold, Necrotic, etc.).',
      modifiers: {}
    },
    {
      id: 'arcane_5_split_damage',
      pieces: 5,
      effect:
        "Once per turn you may split a card's damage between two targets no more than 5 ft apart.",
      modifiers: {}
    },
    {
      id: 'arcane_7_temp_copy',
      pieces: 7,
      effect:
        'Once per encounter you may copy a card temporarily for the rest of the encounter. You must have an open slot in your active card deck when using this ability, or the copied card is lost.',
      modifiers: {},
      activatable: {
        id: 'arcane_7_temp_copy'
      }
    },
    {
      id: 'arcane_10_modify_card',
      pieces: 10,
      effect:
        'Once per encounter you may modify a card for the rest of the encounter: +10 ft range, +5 ft radius, +2 damage, or -1 AP cost (minimum 1).',
      modifiers: {},
      activatable: {
        id: 'arcane_10_modify_card'
      }
    }
  ],
  Beast: [
    {
      id: 'beast_3_bleed_extra_stack',
      pieces: 3,
      effect: 'When you apply Bleeding, apply +1 stack once per turn.',
      modifiers: {}
    },
    {
      id: 'beast_5_bleed_damage_bonus',
      pieces: 5,
      effect: 'Deal +2 damage to Bleeding enemies.',
      modifiers: {}
    },
    {
      id: 'beast_7_bleed_restore_shield',
      pieces: 7,
      effect: 'When Bleeding deals damage, restore 2 Shield.',
      modifiers: {}
    },
    {
      id: 'beast_10_bleed_ap_gain',
      pieces: 10,
      effect: 'Once per turn when you attack a Bleeding enemy, gain +1 AP.',
      modifiers: {}
    }
  ],
  Demonic: [
    {
      id: 'demonic_3_status_apply_damage',
      pieces: 3,
      effect: 'When you apply Burning, Bleeding, or Poison, deal +2 damage.',
      modifiers: {}
    },
    {
      id: 'demonic_5_status_damage_lifesteal',
      pieces: 5,
      effect: 'When you damage an enemy with a status, restore 2 HP once per turn.',
      modifiers: {}
    },
    {
      id: 'demonic_7_damage_ap_next_turn',
      pieces: 7,
      effect: 'Once per turn when you take 5+ damage, gain +1 AP next turn.',
      modifiers: {}
    },
    {
      id: 'demonic_10_nearby_kill_ap',
      pieces: 10,
      effect: 'Once per turn when an enemy dies within 5 ft, gain +1 AP.',
      modifiers: {}
    }
  ],
  Divine: [
    {
      id: 'divine_3_heal_grant_shield',
      pieces: 3,
      effect: 'When you restore HP to an ally, grant 2 Shield.',
      modifiers: {}
    },
    {
      id: 'divine_5_cleanse_heal',
      pieces: 5,
      effect: 'When you remove a status from an ally, restore 4 HP.',
      modifiers: {},
      activatable: {
        id: 'divine_5_cleanse_heal'
      }
    },
    {
      id: 'divine_7_reverse_damage',
      pieces: 7,
      effect: 'Once per encounter, reverse one instance of damage.',
      modifiers: {}
    },
    {
      id: 'divine_10_sacred_overcharge',
      pieces: 10,
      effect:
        'Once per long rest, grant all allies 1.5x max HP, 1.5x max Shield, and 1.5x max AP, at the cost of all current HP and Shield.',
      modifiers: {},
      activatable: {
        id: 'divine_10_sacred_overcharge'
      }
    }
  ],
  Elemental: [
    {
      id: 'elemental_3_status_extra_stack',
      pieces: 3,
      effect: 'When you apply Burning, Rooted, or Shock, apply +1 stack once per turn.',
      modifiers: {}
    },
    {
      id: 'elemental_5_zone_target_bonus',
      pieces: 5,
      effect: 'Elemental attacks deal +2 damage to enemies inside zones.',
      modifiers: {}
    },
    {
      id: 'elemental_7_zone_damage_bonus',
      pieces: 7,
      effect: 'Zones you create deal +2 damage.',
      modifiers: {}
    },
    {
      id: 'elemental_10_status_burst',
      pieces: 10,
      effect: 'When you apply a status, create a 5 ft elemental burst dealing 3 damage (once per turn).',
      modifiers: {}
    }
  ],
  Machine: [
    {
      id: 'machine_3_reinforced_restore',
      pieces: 3,
      effect: 'When you restore Shield, restore +2 additional Shield.',
      modifiers: { guardRestore: 2 }
    },
    {
      id: 'machine_5_auto_loader',
      pieces: 5,
      effect:
        'Once per turn, after you play a Machine card, your next Machine Attack this turn costs 1 less AP (min 1). You may also have 2 constructs active at the same time.',
      modifiers: {}
    },
    {
      id: 'machine_7_construct_boost',
      pieces: 7,
      effect: 'Constructs and turrets you deploy gain +2 damage and last 1 turn longer.',
      modifiers: {}
    },
    {
      id: 'machine_10_construct_cap',
      pieces: 10,
      effect: 'You may have 3 constructs active at the same time.',
      modifiers: {}
    }
  ],
  Nature: [
    {
      id: 'nature_3_healing_bonus',
      pieces: 3,
      effect: 'Healing effects restore +2 HP.',
      modifiers: {}
    },
    {
      id: 'nature_5_zone_friendly_fireproof',
      pieces: 5,
      effect: 'Allies do not take damage from zones you create.',
      modifiers: {}
    },
    {
      id: 'nature_7_zone_ally_shield',
      pieces: 7,
      effect: 'Allies inside your zones restore +4 Shield each turn.',
      modifiers: {}
    },
    {
      id: 'nature_10_heal_cleanse',
      pieces: 10,
      effect: 'Once per turn when you heal an ally, remove all stacks from one status effect.',
      modifiers: {}
    }
  ],
  Shadow: [
    {
      id: 'shadow_3_preacted_bonus',
      pieces: 3,
      effect: 'Gain +2 damage when attacking enemies that have not acted yet.',
      modifiers: {}
    },
    {
      id: 'shadow_5_move_damage_bonus',
      pieces: 5,
      effect: 'When you move 15 ft or more, your next attack deals +3 damage.',
      modifiers: {}
    },
    {
      id: 'shadow_7_debuff_finishers',
      pieces: 7,
      effect:
        'Attacks against enemies with Blinded, Weakened, Fatigued, Rooted, Restrained, or Stunned deal +3 damage and apply 1 Bleeding.',
      modifiers: {}
    },
    {
      id: 'shadow_10_post_attack_move',
      pieces: 10,
      effect: 'Once per turn after attacking, move 10 ft.',
      modifiers: {}
    }
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

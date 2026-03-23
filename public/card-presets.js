export const CARD_PRESETS = [
  {
    id: 'elemental_stone_guard',
    card: {
      id: 'elemental_stone_guard',
      name: 'Stone Guard',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      effect: 'Restore 3 Shield.',
      shieldRestoreByLevel: {
        1: 3
      },
      masteryChoiceOptions: [
        {
          id: 'shield_restore_4',
          label: 'Shield restored increases to 4',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            shieldRestoreByLevel: {
              2: 4,
              3: 4,
              4: 4
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: {
                constitution: 1
              },
              3: {
                constitution: 1
              },
              4: {
                constitution: 1
              }
            }
          }
        },
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Shield restored increases to 4 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_wind_step',
    card: {
      id: 'elemental_wind_step',
      name: 'Wind Step',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Wind'],
      effect: 'Move 10 ft without triggering opportunity attacks.',
      movementByLevel: {
        1: 10
      },
      utilityNote: 'Does not trigger opportunity attacks.',
      masteryChoiceOptions: [
        {
          id: 'movement_to_15',
          label: 'Movement increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            movementByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: {
                dexterity: 1
              },
              3: {
                dexterity: 1
              },
              4: {
                dexterity: 1
              }
            }
          }
        },
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Movement increases to 15 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flicker',
    card: {
      id: 'elemental_flicker',
      name: 'Flicker',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      effect: 'Apply Burning 1.',
      targetEnemiesOnly: true,
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'burning_to_2',
          label: 'Burning increases to 2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: {
                dexterity: 1
              },
              3: {
                dexterity: 1
              },
              4: {
                dexterity: 1
              }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Burning increases to 2 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_analysis',
    card: {
      id: 'arcane_analysis',
      name: 'Analysis',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 5,
      rangeText: 'Touch',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Reveal properties of magical items, relics, or enchantments you are holding. Requires currency per cast. Cost scales with complexity.',
      masteryChoiceOptions: [
        {
          id: 'identify_curses',
          label: 'Can identify curses',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Can identify curses or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_eye',
    card: {
      id: 'arcane_arcane_eye',
      name: 'Arcane Eye',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Unveil Arcane Eye on your limb that reveals hidden enemies and traps within 15 ft. Duration 2 turns. Cannot use limb to hold items or cast while spell is active.',
      masteryChoiceOptions: [
        {
          id: 'radius_to_25',
          label: 'Radius increases to 25 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 25 ft or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_message',
    card: {
      id: 'arcane_arcane_message',
      name: 'Arcane Message',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Unlimited',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: "Send a short message to an ally anywhere or a creature within line of sight. Recipient does not need to understand caster's language. Limited to 6 words.",
      masteryChoiceOptions: [
        {
          id: 'receive_one_word_reply',
          label: 'Can receive 1-word answer',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'charisma_plus_1',
          label: 'CHA +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { charisma: 1 },
              3: { charisma: 1 },
              4: { charisma: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Can receive 1-word answer or CHA +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_arcane_sense',
    card: {
      id: 'arcane_arcane_sense',
      name: 'Arcane Sense',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Detect magic effects, hidden traps, or magical objects within 30 ft. Caster may not move for 10 minutes. Caster may be moved by external forces.',
      masteryChoiceOptions: [
        {
          id: 'range_to_60',
          label: 'Range increases to 60 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 60 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_blink_step',
    card: {
      id: 'arcane_blink_step',
      name: 'Blink Step',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 3,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Teleport 15 ft. Caster must have line of sight to destination.',
      masteryChoiceOptions: [
        {
          id: 'teleport_to_20',
          label: 'Teleport increases to 20 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Teleport increases to 20 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_force_push',
    card: {
      id: 'arcane_force_push',
      name: 'Force Push',
      set: 'Arcane',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Force'],
      damage: 6,
      damageType: 'Force',
      effect: 'Deal 6 Force damage and push the target 10 ft.',
      pushDistanceByLevel: {
        1: 10
      },
      masteryChoiceOptions: [
        {
          id: 'push_to_15',
          label: 'Push increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            pushDistanceByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'strength_plus_1',
          label: 'STR +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { strength: 1 },
              3: { strength: 1 },
              4: { strength: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Push increases to 15 ft or STR +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_locate_presence',
    card: {
      id: 'arcane_locate_presence',
      name: 'Locate Presence',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Caster can sense the direction of the nearest hidden creature within 40 ft.',
      masteryChoiceOptions: [
        {
          id: 'range_to_60',
          label: 'Range increases to 60 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 60 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_mage_arm_tm',
    card: {
      id: 'arcane_mage_arm_tm',
      name: 'Mage Arm (TM)',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Common',
      apCost: 1,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Interact with objects at range (pull levers, open containers, retrieve items).',
      masteryChoiceOptions: [
        {
          id: 'range_to_40',
          label: 'Range increases to 40 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {}
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Range increases to 40 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_gravity_spike',
    card: {
      id: 'arcane_gravity_spike',
      name: 'Gravity Spike',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      damage: 1,
      effect: 'Create Gravity Zone (Radius 10 ft). Creatures inside move at half speed and take 1 damage each turn. Duration 2 turns.',
      utilityNote: 'Manually assign creatures inside the zone. Remove the Gravity Spike status manually when a creature leaves the zone.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        name: 'Gravity Spike',
        notes: 'Move at half speed while inside Gravity Zone.',
        stacksByLevel: {
          1: 1
        }
      },
      zoneEnterStatusApply: {
        name: 'Gravity Spike',
        notes: 'Move at half speed while inside Gravity Zone.',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'radius_to_15',
          label: 'Radius increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            zoneRadiusByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 15 ft or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'arcane_mind_shield',
    card: {
      id: 'arcane_mind_shield',
      name: 'Mind Shield',
      set: 'Arcane',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Gain immunity to Charmed and Frightened. Duration 2 turns.',
      statusApply: {
        id: 'mind_shield',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'gain_2_shield',
          label: 'Gain 2 Shield as well',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            shieldRestoreByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Gain 2 Shield as well or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_cleansing_light',
    card: {
      id: 'divine_cleansing_light',
      name: 'Cleansing Light',
      set: 'Divine',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Remove one status effect from an ally fully.',
      utilityNote: 'Choose which status effects to remove from the target.',
      targetAlliesOnly: true,
      removeStatusCountByLevel: {
        1: 1
      },
      masteryChoiceOptions: [
        {
          id: 'remove_two_statuses',
          label: 'Remove two statuses instead',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            removeStatusCountByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: {
                wisdom: 1
              },
              3: {
                wisdom: 1
              },
              4: {
                wisdom: 1
              }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Remove two statuses instead or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_healing_touch',
    card: {
      id: 'nature_healing_touch',
      name: 'Healing Touch',
      set: 'Nature',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      charges: 2,
      range: 5,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 4 HP to an ally.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 6 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_light_bandage',
    card: {
      id: 'nature_light_bandage',
      name: 'Light Bandage',
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 5 HP and remove Bleeding.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 5,
        2: 7,
        3: 7,
        4: 7
      },
      removeStatusIds: ['bleeding'],
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 7 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_revitalize',
    card: {
      id: 'divine_revitalize',
      name: 'Revitalize',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 6 HP to an ally.',
      targetAlliesOnly: true,
      healByLevel: {
        1: 6,
        2: 8,
        3: 8,
        4: 8
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 8 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_guardian_halo',
    card: {
      id: 'divine_guardian_halo',
      name: 'Guardian Halo',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Grant an ally 8 Shield.',
      targetAlliesOnly: true,
      shieldRestoreByLevel: {
        1: 8,
        2: 10,
        3: 10,
        4: 10
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Shield increases to 10.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_natures_renewal',
    card: {
      id: 'nature_natures_renewal',
      name: "Nature's Renewal",
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      charges: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Healing'],
      effect: 'Restore 4 HP to allies within Radius 10 ft.',
      utilityNote: 'Manually select allies within the 10 ft radius.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetAlliesOnly: true,
      healByLevel: {
        1: 4,
        2: 6,
        3: 6,
        4: 6
      },
      abilityBonusesByLevel: {
        3: {
          wisdom: 1
        },
        4: {
          wisdom: 1
        }
      },
      mastery: [
        'Level 1: Base.',
        'Level 2: Healing increases to 6 HP.',
        'Level 3: WIS +1.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_stone_strike',
    card: {
      id: 'elemental_stone_strike',
      name: 'Stone Strike',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      damage: 7,
      damageType: 'Bludgeoning',
      effect: 'Deal 7 Bludgeoning damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_8',
          label: 'Damage increases to 8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 8 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_shield_slam',
    card: {
      id: 'machine_shield_slam',
      name: 'Shield Slam',
      set: 'Machine',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Bludgeoning'],
      damage: 7,
      effect: 'Deal 7 damage. Push the target 10 ft.',
      pushDistanceByLevel: {
        1: 10
      },
      masteryChoiceOptions: [
        {
          id: 'push_to_15',
          label: 'Push increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            pushDistanceByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'strength_plus_1',
          label: 'STR +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { strength: 1 },
              3: { strength: 1 },
              4: { strength: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Push increases to 15 ft or STR +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_touch',
    card: {
      id: 'elemental_flame_touch',
      name: 'Flame Touch',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 7,
      effect: 'Deal 7 Fire damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_8',
          label: 'Damage increases to 8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 8 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_wind_slash',
    card: {
      id: 'elemental_wind_slash',
      name: 'Wind Slash',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Wind'],
      damage: 6,
      effect: 'Deal 6 damage. Push target 5 ft.',
      pushDistanceByLevel: {
        1: 5
      },
      masteryChoiceOptions: [
        {
          id: 'push_to_10',
          label: 'Push increases to 10 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            pushDistanceByLevel: {
              2: 10,
              3: 10,
              4: 10
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Push increases to 10 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'machine_iron_rampart',
    card: {
      id: 'machine_iron_rampart',
      name: 'Iron Rampart',
      set: 'Machine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 10,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Construct'],
      effect: 'Deploy Rampart Construct (HP 8). Allies within 5 ft gain 2 Shield each turn. Duration: 2 turns.',
      utilityNote: 'Select the allies you want the construct to support. GM handles range feasibility.',
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetAlliesOnly: true,
      isConstruct: true,
      constructMode: 'utility',
      constructTargetRequired: true,
      constructDurationTurns: 2,
      constructMaxHp: 8,
      constructAuraRadiusFt: 5,
      constructShieldRestoreByLevel: {
        1: 2
      },
      constructShieldRestoreAlliesOnly: true,
      masteryChoiceOptions: [
        {
          id: 'shield_to_3',
          label: 'Shield increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            constructShieldRestoreByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Shield increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_earth_spike',
    card: {
      id: 'elemental_earth_spike',
      name: 'Earth Spike',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Earth'],
      damage: 8,
      effect: 'Deal 8 damage. Apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'rooted_to_2',
          label: 'Rooted increases to 2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Rooted increases to 2 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'divine_fortress_stance',
    card: {
      id: 'divine_fortress_stance',
      name: 'Fortress Stance',
      set: 'Divine',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 2,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 2,
      tags: ['Utility'],
      effect: 'Restore 6 Shield. For the next 2 turns, your Guard action restores +1 Shield.',
      shieldRestoreByLevel: {
        1: 6
      },
      guardActionBonusByLevel: {
        1: 1
      },
      guardActionBonusTurnsByLevel: {
        1: 2
      },
      masteryChoiceOptions: [
        {
          id: 'shield_restore_8',
          label: 'Shield restored increases to 8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            shieldRestoreByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Shield restored increases to 8 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_dagger_flurry',
    card: {
      id: 'shadow_dagger_flurry',
      name: 'Dagger Flurry',
      set: 'Shadow',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 4,
      damageType: 'Piercing',
      targetMode: 'multi_select',
      multiTargetMax: 2,
      effect: 'Deal 4 Piercing damage to up to 2 targets.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_5',
          label: 'Damage increases to 5 each',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 5,
              3: 5,
              4: 5
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 5 each or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_static_chain',
    card: {
      id: 'elemental_static_chain',
      name: 'Static Chain',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 25,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 3,
      damageType: 'Lightning',
      targetMode: 'multi_select',
      multiTargetMax: 2,
      effect: 'Deal 3 Lightning damage to up to 2 targets.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_4',
          label: 'Damage increases to 4 each',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 4,
              3: 4,
              4: 4
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 4 each or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_poison_dart',
    card: {
      id: 'nature_poison_dart',
      name: 'Poison Dart',
      set: 'Nature',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Poison'],
      damage: 5,
      damageType: 'Poison',
      effect: 'Deal 5 Poison damage. Apply Poisoned 2.',
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'poisoned_to_3',
          label: 'Poisoned increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Poisoned increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_dust_cloud',
    card: {
      id: 'shadow_dust_cloud',
      name: 'Dust Cloud',
      set: 'Shadow',
      type: 'Utility',
      tier: 'Common',
      apCost: 2,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'Create Obscuring Cloud (Radius 10 ft). Creatures inside gain Blinded 1. Duration: 2 turns.',
      utilityNote: 'Manually select creatures inside the cloud to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        id: 'blinded',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'radius_to_15',
          label: 'Radius increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            zoneRadiusByLevel: {
              2: 15,
              3: 15,
              4: 15
            }
          }
        },
        {
          id: 'wisdom_plus_1',
          label: 'WIS +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { wisdom: 1 },
              3: { wisdom: 1 },
              4: { wisdom: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Radius increases to 15 ft or WIS +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_backstab',
    card: {
      id: 'shadow_backstab',
      name: 'Backstab',
      set: 'Shadow',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 5,
      healthBonus: 2,
      shieldBonus: 1,
      tags: ['Piercing'],
      damage: 8,
      damageType: 'Piercing',
      effect: 'Deal 8 Piercing damage. If the target has not acted yet this round, deal +4 damage.',
      bonusDamageIfTargetNotActedByLevel: {
        1: 4
      },
      masteryChoiceOptions: [
        {
          id: 'bonus_damage_to_6',
          label: 'Bonus damage increases to +6',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            bonusDamageIfTargetNotActedByLevel: {
              2: 6,
              3: 6,
              4: 6
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Bonus damage increases to +6 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'nature_venom_cloud',
    card: {
      id: 'nature_venom_cloud',
      name: 'Venom Cloud',
      set: 'Nature',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Poison'],
      effect: 'Create Poison Zone (Radius 10 ft). Enemies inside gain Poisoned 2 each turn. Duration: 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      statusApply: {
        id: 'poisoned',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'poisoned_to_3',
          label: 'Poisoned increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Poisoned increases to 3 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'shadow_smoke_veil',
    card: {
      id: 'shadow_smoke_veil',
      name: 'Smoke Veil',
      set: 'Shadow',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 4,
      range: 0,
      rangeText: 'Self',
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Utility'],
      effect: 'You cannot be targeted by ranged attacks until your next turn. You may still be hit by indirect area damage.',
      rangedUntargetableTurnsByLevel: {
        1: 1
      },
      masteryChoiceOptions: [
        {
          id: 'movement_10',
          label: 'Gain 10 ft free movement',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            movementByLevel: {
              2: 10,
              3: 10,
              4: 10
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Gain 10 ft free movement or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_fire_bolt',
    card: {
      id: 'elemental_fire_bolt',
      name: 'Fire Bolt',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 6,
      damageType: 'Fire',
      effect: 'Deal 6 Fire damage. Apply Burning 1.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'burning_to_2',
          label: 'Burning increases to 2',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 2,
              3: 2,
              4: 2
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Burning increases to 2 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_shard',
    card: {
      id: 'elemental_ice_shard',
      name: 'Ice Shard',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Cold'],
      damage: 6,
      damageType: 'Cold',
      effect: 'Deal 6 Cold damage. Apply Rooted 1.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 1
        }
      },
      masteryChoiceOptions: [
        {
          id: 'damage_to_7',
          label: 'Damage increases to 7',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 7,
              3: 7,
              4: 7
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 7 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_lightning_spark',
    card: {
      id: 'elemental_lightning_spark',
      name: 'Lightning Spark',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 6,
      damageType: 'Lightning',
      effect: 'Deal 6 Lightning damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_7',
          label: 'Damage increases to 7',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 7,
              3: 7,
              4: 7
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 7 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_jolt',
    card: {
      id: 'elemental_jolt',
      name: 'Jolt',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Common',
      apCost: 1,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 3,
      damageType: 'Lightning',
      effect: 'Deal 3 Lightning damage.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_4',
          label: 'Damage increases to 4',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 4,
              3: 4,
              4: 4
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 4 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_flame_wave',
    card: {
      id: 'elemental_flame_wave',
      name: 'Flame Wave',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 15,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 8,
      damageType: 'Fire',
      effect: 'Deal 8 Fire damage. Apply Burning 2.',
      statusApply: {
        id: 'burning',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'burning_to_3',
          label: 'Burning increases to 3',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            statusApplyStacksByLevel: {
              2: 3,
              3: 3,
              4: 3
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Burning increases to 3 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_chain_lightning',
    card: {
      id: 'elemental_chain_lightning',
      name: 'Chain Lightning',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 3,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Lightning'],
      damage: 6,
      damageType: 'Lightning',
      targetMode: 'multi_select',
      multiTargetMax: 3,
      effect: 'Deal 6 Lightning damage to up to 3 targets.',
      masteryChoiceOptions: [
        {
          id: 'damage_to_7',
          label: 'Damage increases to 7 each',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 7,
              3: 7,
              4: 7
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 7 each or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_fire_ring',
    card: {
      id: 'elemental_fire_ring',
      name: 'Fire Ring',
      set: 'Elemental',
      type: 'Utility',
      tier: 'Uncommon',
      apCost: 3,
      range: 20,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Fire'],
      damage: 4,
      damageType: 'Fire',
      effect: 'Create a Fire Zone (Radius 10 ft). Enemies inside take 4 Fire damage per turn for 2 turns.',
      utilityNote: 'Manually select enemies inside the zone to be affected each turn.',
      isZone: true,
      targetMode: 'multi_select',
      multiTargetMax: 12,
      targetEnemiesOnly: true,
      zoneRadius: 10,
      zoneDurationTurns: 2,
      masteryChoiceOptions: [
        {
          id: 'damage_to_5',
          label: 'Zone damage increases to 5',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 5,
              3: 5,
              4: 5
            }
          }
        },
        {
          id: 'intelligence_plus_1',
          label: 'INT +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { intelligence: 1 },
              3: { intelligence: 1 },
              4: { intelligence: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Zone damage increases to 5 or INT +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  },
  {
    id: 'elemental_ice_lance',
    card: {
      id: 'elemental_ice_lance',
      name: 'Ice Lance',
      set: 'Elemental',
      type: 'Attack',
      tier: 'Uncommon',
      apCost: 2,
      range: 30,
      healthBonus: 1,
      shieldBonus: 1,
      tags: ['Cold'],
      damage: 7,
      damageType: 'Cold',
      effect: 'Deal 7 Cold damage. Apply Rooted 2.',
      statusApply: {
        id: 'rooted',
        stacksByLevel: {
          1: 2
        }
      },
      masteryChoiceOptions: [
        {
          id: 'damage_to_8',
          label: 'Damage increases to 8',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            damageByLevel: {
              2: 8,
              3: 8,
              4: 8
            }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Damage increases to 8 or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    }
  }
];

export const RARITY_ORDER = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Epic',
  'Legendary',
  'Unique'
];

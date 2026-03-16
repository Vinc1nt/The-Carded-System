import { UI_LIMITS } from './shared/game-config.js';
import { getCardTierMasteryThresholds, getCardTierShieldBonus } from './shared/card-rules.js';

const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder'
];
const MAX_ACTIVE_CARDS = UI_LIMITS.maxActiveCards;

const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1, currentTurnKey: '' },
  reference: { standardActions: [], sets: [], statuses: [], teams: [] },
  updatedAt: null
};

const params = new URLSearchParams(window.location.search);
let focusId = params.get('id');
let createMode = params.get('create') === '1';
let eventSource;
const playerSectionState = new Map();
const playerJournalState = new Map();
const playerManageState = new Map();

const els = {
  select: document.getElementById('playerSelect'),
  stats: document.getElementById('playerStats'),
  journal: document.getElementById('playerJournal'),
  journalContent: document.getElementById('playerJournalContent'),
  journalPopup: document.getElementById('journalPopup'),
  cardList: document.getElementById('playerCardList'),
  logList: document.getElementById('playerLogList'),
  turnInfo: document.getElementById('playerTurnInfo'),
  cardForm: document.getElementById('playerCardForm'),
  cardDrawer: document.getElementById('playerCardDrawer'),
  menuToggle: document.getElementById('playerMenuToggle'),
  menuPanel: document.getElementById('playerMenuPanel'),
  nextTurn: document.getElementById('playerNextTurn'),
  playerShortRest: document.getElementById('playerShortRest'),
  playerLongRest: document.getElementById('playerLongRest'),
  downloadCharacter: document.getElementById('downloadCharacter'),
  uploadCharacter: document.getElementById('uploadCharacter'),
  importCardFile: document.getElementById('playerImportCard'),
  importDeckFile: document.getElementById('playerImportDeck'),
  baseToggle: document.getElementById('playerBaseToggle'),
  baseForm: document.getElementById('playerBaseForm'),
  importRelicFile: document.getElementById('playerImportRelic')
};

const STAT_FIELD_MAP = {
  hp: 'hp',
  shield: 'shield',
  ap: 'apCurrent'
};

document.addEventListener('DOMContentLoaded', () => {
  wireSelect();
  wirePlayerMenu();
  wireTopButtons();
  subscribe();
  fetchState();
});

function wireSelect() {
  els.select.addEventListener('change', () => {
    focusId = els.select.value || null;
    createMode = false;
    updateUrl();
    render();
  });
}

function wirePlayerCardForm() {
  const form = document.getElementById('playerCardForm');
  if (!form) return;
  const tierInput = form.querySelector('[name="tier"]');
  if (tierInput && tierInput.dataset.masteryThresholdSyncBound !== '1') {
    const syncThresholds = () => syncCardMasteryThresholdInputs(form);
    tierInput.addEventListener('change', syncThresholds);
    tierInput.addEventListener('input', syncThresholds);
    tierInput.dataset.masteryThresholdSyncBound = '1';
  }
  syncCardMasteryThresholdInputs(form);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const participant = getFocusedParticipant();
    if (!participant) {
      notify('Select a combatant first.');
      return;
    }
    const formData = new FormData(form);
    const newCard = buildPlayerCardFromForm(formData);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existingCards = latest?.cards || [];
    const activeCount = existingCards.filter((card) => isCardActive(card)).length;
    newCard.active = activeCount < MAX_ACTIVE_CARDS;
    const updatedCards = [...existingCards, newCard];
    await patchParticipant(participant.id, { cards: updatedCards });
    form.reset();
    if (!newCard.active) {
      notify(`Active loadout is full (${MAX_ACTIVE_CARDS}). Card added as inactive.`);
    }
    fetchState();
  };
}

function wirePlayerCardImports() {
  const single = document.getElementById('playerImportCard');
  const deck = document.getElementById('playerImportDeck');
  if (single) {
    single.onchange = (event) => handlePlayerCardFile(event, 'card');
  }
  if (deck) {
    deck.onchange = (event) => handlePlayerCardFile(event, 'deck');
  }
}

function wirePlayerMenu() {
  if (!els.menuToggle || !els.menuPanel) return;
  els.menuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    els.menuPanel.classList.toggle('is-open');
  });
  document.addEventListener('click', (event) => {
    if (!els.menuPanel?.classList?.contains('is-open')) return;
    if (event.target.closest('.player-menu')) return;
    els.menuPanel.classList.remove('is-open');
  });
  els.downloadCharacter?.addEventListener('click', handleCharacterDownload);
  els.uploadCharacter?.addEventListener('change', handleCharacterImport);
  els.baseToggle?.addEventListener('click', () => {
    if (!els.baseForm) return;
    const participant = getFocusedParticipant();
    if (!participant) {
      notify('Select a combatant first.');
      return;
    }
    populatePlayerBaseForm(participant);
    els.baseForm.classList.toggle('hidden');
  });
  els.baseForm?.addEventListener('submit', handlePlayerBaseSubmit);
}

function wireTopButtons() {
  els.nextTurn?.addEventListener('click', async () => {
    try {
      await api('/api/turn/next', 'POST');
    } catch (err) {
      notify(err.message);
    }
  });
  els.playerShortRest?.addEventListener('click', () => handlePlayerRest('short'));
  els.playerLongRest?.addEventListener('click', () => handlePlayerRest('long'));
}

function subscribe() {
  eventSource?.close?.();
  eventSource = new EventSource('/events');
  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'state') {
        applyState(payload.state);
      }
    } catch (err) {
      console.error('Unable to parse player event', err);
    }
  };
  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(subscribe, 5000);
  };
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.state) {
      applyState(data.state);
    }
  } catch (err) {
    console.error('Unable to fetch player state', err);
  }
}

function applyState(nextState) {
  if (!nextState) return;
  state.encounter = nextState.encounter || state.encounter;
  state.reference = nextState.reference || state.reference;
  state.updatedAt = nextState.updatedAt;

  const participants = state.encounter.participants || [];
  if (!participants.find((p) => p.id === focusId)) {
    focusId = participants[0]?.id || null;
    updateUrl();
  }

  render();
}

function render() {
  renderSelectOptions();
  const creating = createMode && !focusId;
  renderStats();
  renderJournal();
  if (!creating) {
    renderCards();
  }
  renderLog();
  renderTurnInfo();
}

function renderSelectOptions() {
  const participants = state.encounter.participants || [];
  const options = [];
  if (createMode && !focusId) {
    options.push('<option value="">Character Creator</option>');
  }
  options.push(
    ...participants.map(
      (participant) =>
        `<option value="${participant.id}" ${participant.id === focusId ? 'selected' : ''}>${participant.name}</option>`
    )
  );
  els.select.innerHTML = options
    .join('');
  if (!participants.length) {
    els.select.innerHTML = '<option value="">No combatants</option>';
  }
  if (createMode && !focusId) {
    els.select.value = '';
  } else if (focusId) {
    els.select.value = focusId;
  }
}

function renderStats() {
  rememberPlayerSections();
  const participant = getFocusedParticipant();
  if (!participant) {
    const hasCombatants = (state.encounter.participants || []).length > 0;
    if (createMode) {
      renderCharacterCreator();
    } else {
      els.stats.innerHTML = `
        <div class="player-empty">
          <h2>${hasCombatants ? 'Select Your Character' : 'Waiting for the GM'}</h2>
          <p>${hasCombatants ? 'Pick a combatant from the dropdown or import your saved character.' : 'The GM has not added any combatants yet.'}</p>
          <button type="button" data-player-open-menu>Import Character</button>
        </div>`;
      els.stats.querySelector('[data-player-open-menu]')?.addEventListener('click', openPlayerMenu);
    }
    return;
  }
  const stats = participant.stats || {};
  const manageState = getPlayerManageState(participant.id);
  const showZoneSection = participantHasActiveZoneCard(participant);
  const showConstructSection = participantHasActiveConstructCard(participant);
  els.stats.innerHTML = `
    <div class="panel player-sheet">
      ${renderPlayerTurnTrack()}
      <div class="panel-header">
        <div>
          <h2>${participant.name}</h2>
          <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
        </div>
        <div class="player-header-actions">
          <div class="muted">Round ${state.encounter.round}</div>
          <label class="team-select-inline">
            Team
            <select data-player-team-select>
              ${renderPlayerTeamOptions(participant)}
            </select>
          </label>
        </div>
      </div>
      <div class="vitals-grid">
        ${renderPlayerVital('HP', participant.hp, participant.maxHp, 'hp')}
        ${renderPlayerVital('Shield', participant.shield, participant.maxShield, 'shield')}
        ${renderPlayerVital('AP', participant.apCurrent, participant.apMax, 'ap')}
        ${renderPlayerVital('Guard Restore', participant.guardRestore || 3)}
        ${renderPlayerVital('Damage Bonus', participant.damageBonus || 0)}
        ${renderPlayerConstructVital(participant)}
      </div>
      ${renderPlayerStandardActionsSection()}
      ${renderPlayerStatusSection(participant)}
      ${showZoneSection ? renderPlayerZoneSection() : ''}
      ${renderPlayerCardsSection(participant)}
      ${renderPlayerSetSection(participant)}
      ${showConstructSection ? renderPlayerConstructSection() : ''}
      <details class="player-collapsible" data-player-section="abilities">
        <summary><strong>Ability Scores</strong></summary>
        <div class="collapsible-body">
          <label>Proficiency Bonus
            <input type="number" data-proficiency-input value="${participant.proficiencyBonus ?? 2}" />
          </label>
          ${renderAbilityTable(stats)}
        </div>
      </details>
      <details class="player-collapsible" data-player-section="saves">
        <summary><strong>Saving Throws</strong></summary>
        <div class="collapsible-body">
          ${renderSavingThrows(participant)}
        </div>
      </details>
      <details class="player-collapsible" data-player-section="skills">
        <summary><strong>Skills</strong></summary>
        <div class="collapsible-body">
          ${renderSkillsTable(participant)}
        </div>
      </details>
      ${renderPlayerDamageSection(participant, manageState.mitigation)}
      ${renderPlayerAbilitiesSection(participant, manageState.abilities)}
      ${renderPlayerInventorySection()}
      ${renderPlayerRelicSection()}
      ${renderPlayerNotesSection(participant)}
    </div>
  `;
  cachePlayerSectionRefs();
  wirePlayerSheetEvents(participant);
  restorePlayerSections(participant.id);
}

function renderCharacterCreator() {
  els.stats.innerHTML = `
    <div class="panel player-sheet">
      <div class="panel-header">
        <div>
          <h2>Create Character</h2>
          <p class="muted">Fill out the base stats to add this character to the encounter.</p>
        </div>
      </div>
      <form id="playerCreateForm" class="stacked-form">
        <div class="form-row">
          <label>Name
            <input type="text" name="name" placeholder="New Character" required />
          </label>
          <label>Set Focus
            <input type="text" name="setFocus" placeholder="Machine, Elemental..." />
          </label>
        </div>
        <div class="form-row">
          <label>Max HP
            <input type="number" name="maxHp" value="20" />
          </label>
          <label>Max Shield
            <input type="number" name="maxShield" value="0" />
          </label>
          <label>Max AP
            <input type="number" name="apMax" value="6" />
          </label>
        </div>
        <div class="form-row">
          <label>Proficiency Bonus
            <input type="number" name="proficiencyBonus" value="2" />
          </label>
          <label>Team
            <select name="team">
              <option value="">Unassigned</option>
              <option value="Team 1">Team 1</option>
              <option value="Team 2">Team 2</option>
              <option value="Team 3">Team 3</option>
              <option value="Team 4">Team 4</option>
            </select>
          </label>
        </div>
        <div class="ability-input-grid">
          ${ABILITIES.map(
            ({ key, label }) => `
              <label>${label}
                <input type="number" name="${key}" value="10" />
              </label>`
          ).join('')}
        </div>
        <label>Resistances
          <select name="resistances" multiple size="6">
            ${renderDamageTypeOptions(false)}
          </select>
          <small class="muted">Use Cmd/Ctrl-click to select multiple.</small>
        </label>
        <label>Vulnerabilities
          <select name="vulnerabilities" multiple size="6">
            ${renderDamageTypeOptions(false)}
          </select>
          <small class="muted">Use Cmd/Ctrl-click to select multiple.</small>
        </label>
        <label>Notes
          <textarea name="notes" rows="2" placeholder="Backstory, reminders, etc."></textarea>
        </label>
        <button type="submit" class="primary">Create Character</button>
      </form>
    </div>
  `;
  wireCharacterCreator();
}

function renderPlayerVital(label, value, max, key) {
  if (typeof max === 'number') {
    return `
      <div class="vital-card">
        <h4>${label}</h4>
        <div class="value">${value} / ${max}</div>
        ${key ? renderInlineAdjust(key) : ''}
      </div>`;
  }
  return `
    <div class="vital-card">
      <h4>${label}</h4>
      <div class="value">${value}</div>
    </div>`;
}

function renderPlayerConstructVital(participant) {
  if (!participantHasActiveConstructCard(participant)) {
    return '';
  }
  const constructs = participant?.constructs || [];
  const cap = Number(participant?.derivedBonuses?.machineConstructs?.maxActive || 1);
  const names = constructs.map((entry) => entry.name).filter(Boolean);
  const label = names.length ? names.join(', ') : 'None active';
  return `
    <div class="vital-card">
      <h4>Constructs</h4>
      <div class="value">${constructs.length} / ${cap}</div>
      <small class="muted">${escapeHtml(label)}</small>
    </div>
  `;
}

function cachePlayerSectionRefs() {
  els.cardList = document.getElementById('playerCardList');
  els.cardForm = document.getElementById('playerCardForm');
  els.cardDrawer = document.getElementById('playerCardDrawer');
  els.importCardFile = document.getElementById('playerImportCard');
  els.importDeckFile = document.getElementById('playerImportDeck');
  els.importRelicFile = document.getElementById('playerImportRelic');
}

function renderPlayerTurnTrack() {
  const entries = getPlayerTurnEntries();
  if (!entries.length) return '';
  return `
    <div class="player-turn-track">
      ${entries
        .map(
          (entry, index) => `
            <div class="turn-pill ${(state.encounter.currentTurnKey && getPlayerTurnEntryKey(entry) === state.encounter.currentTurnKey) || (!state.encounter.currentTurnKey && index === (state.encounter.currentIndex ?? -1)) ? 'is-active' : ''} ${entry.participantId === focusId ? 'is-focus' : ''}">
              <span>${escapeHtml(entry.kind === 'zone' ? `${entry.zone?.name || 'Zone'}` : entry.participant?.name || 'Combatant')}</span>
            </div>`
        )
        .join('')}
    </div>
  `;
}

function getPlayerTurnEntryKey(entry = {}) {
  if (entry.kind === 'zone') {
    return `zone:${entry.participantId}:${entry.zoneId}`;
  }
  return `participant:${entry.participantId}`;
}

function getPlayerTurnEntries() {
  const entries = [];
  for (const participant of state.encounter.participants || []) {
    entries.push({ kind: 'participant', participantId: participant.id, participant, zone: null });
    for (const zone of participant.zones || []) {
      entries.push({
        kind: 'zone',
        participantId: participant.id,
        zoneId: zone.id,
        participant,
        zone
      });
    }
  }
  return entries;
}

function wireCharacterCreator() {
  const form = document.getElementById('playerCreateForm');
  if (!form) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = buildParticipantFromCreateForm(formData);
    try {
      const result = await api('/api/import/participant', 'POST', { participant: payload });
      if (result?.participant?.id) {
        focusId = result.participant.id;
        createMode = false;
        updateUrl({ create: false });
        fetchState();
        notify('Character created.');
      }
    } catch (err) {
      notify(`Creation failed: ${err.message}`);
    }
  };
}

function buildParticipantFromCreateForm(formData) {
  const stats = {};
  ABILITIES.forEach(({ key }) => {
    stats[key] = Number(formData.get(key) || 0);
  });
  const proficiencyBonus = Number(formData.get('proficiencyBonus') || 0);
  const maxHp = Number(formData.get('maxHp') || 0);
  const maxShield = Number(formData.get('maxShield') || 0);
  const apMax = Number(formData.get('apMax') || 0);
  const resistances = dedupeTypes(formData.getAll('resistances'));
  const vulnerabilities = dedupeTypes(formData.getAll('vulnerabilities'));
  return {
    name: formData.get('name')?.trim() || 'New Character',
    team: formData.get('team') || '',
    setFocus: formData.get('setFocus') || '',
    maxHp,
    hp: maxHp,
    maxShield,
    shield: maxShield,
    apMax,
    apCurrent: apMax,
    proficiencyBonus,
    stats,
    notes: formData.get('notes') || '',
    resistances,
    vulnerabilities
  };
}

function renderPlayerStandardActionsSection() {
  return `
    <details class="player-collapsible" data-player-section="standardActions">
      <summary><strong>Standard Actions</strong></summary>
      <div class="collapsible-body">
        <label class="checkbox-row">
          <input type="checkbox" data-player-difficult />
          <span>Difficult terrain (Move = 5 ft)</span>
        </label>
        <div class="standard-actions-grid">
          ${renderPlayerStandardActionButtons()}
        </div>
      </div>
    </details>
  `;
}

function renderPlayerStandardActionButtons() {
  const actionsById = new Map((state.reference?.standardActions || []).map((action) => [action.id, action]));
  const order = ['move', 'disengage', 'slip', 'interact', 'recover', 'cleanse', 'guard'];
  const actions = order.map((id) => actionsById.get(id)).filter(Boolean);
  if (!actions.length) {
    return '<p class="empty-state">Standard actions will appear once the server boots.</p>';
  }
  return actions
    .map(
      (action) => `
      <div class="standard-action-item">
        <button type="button" data-player-standard="${action.id}">${action.label} (${action.apCost} AP)</button>
        <small class="muted small-note">${action.summary || ''}</small>
      </div>`
    )
    .join('');
}

function renderPlayerCardsSection(participant) {
  const { active, total } = getPlayerCardBuckets(participant || {});
  return `
    <details class="player-collapsible" data-player-section="cards">
      <summary><strong>Cards & Loadout (${active.length}/${MAX_ACTIVE_CARDS} active · ${total} total)</strong></summary>
      <div class="collapsible-body">
        <div id="playerCardList" class="card-list empty-state">Cards for the selected combatant will show here.</div>
        <details id="playerCardDrawer">
          <summary>Card Tools</summary>
          <div class="card-import">
            <label class="file-upload">
              Import Card
              <input type="file" id="playerImportCard" accept="application/json" />
            </label>
            <label class="file-upload">
              Import Card Deck
              <input type="file" id="playerImportDeck" accept="application/json" />
            </label>
            <p class="muted help-text">Upload single cards or a {"cards": []} deck file.</p>
          </div>
          <form id="playerCardForm" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>Set
                <input type="text" name="set" placeholder="Machine" />
              </label>
              <label>Type
                <input type="text" name="type" placeholder="Attack" />
              </label>
              <label>Tier
                <input type="text" name="tier" placeholder="Common" />
              </label>
            </div>
            <div class="form-row">
              <label>AP Cost
                <input type="number" name="apCost" value="2" />
              </label>
              <label>Range
                <input type="number" name="range" value="5" />
              </label>
              <label>Health Bonus
                <input type="number" name="healthBonus" value="0" />
              </label>
              <label>Shield Bonus
                <input type="number" name="shieldBonus" placeholder="Auto by tier" />
              </label>
              <label>Damage
                <input type="number" name="damage" value="0" />
              </label>
              <label>Damage Type
                <select name="damageType">
                  ${renderDamageTypeOptions(true)}
                </select>
              </label>
              <label>Construct Duration
                <input type="number" name="constructDurationTurns" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Construct Mode
                <select name="constructMode">
                  <option value="">Auto</option>
                  <option value="damage">Damage</option>
                  <option value="status">Status</option>
                  <option value="utility">Utility</option>
                </select>
              </label>
              <label>Construct Status
                <select name="constructStatusId">
                  <option value="">None</option>
                  ${renderStatusPresetOptions()}
                </select>
              </label>
              <label>Status Stacks
                <input type="number" name="constructStatusStacks" value="1" min="1" />
              </label>
            </div>
            <div class="form-row">
              <label>Max HP Bonus
                <input type="number" name="modMaxHp" value="0" />
              </label>
              <label>Max Shield Bonus
                <input type="number" name="modMaxShield" value="0" />
              </label>
              <label>AP Max Bonus
                <input type="number" name="modApMax" value="0" />
              </label>
            </div>
            <div class="form-row">
              <label>Guard Bonus
                <input type="number" name="modGuard" value="0" />
              </label>
              <label>Damage Bonus
                <input type="number" name="modDamage" value="0" />
              </label>
            </div>
            <label>Tags
              <input type="text" name="tags" placeholder="Melee, Shield" />
            </label>
            <label>Effect
              <textarea name="effect" rows="2" placeholder="Describe the effect"></textarea>
            </label>
            <div class="form-row">
              <label>Mastery to L2 uses
                <input type="number" name="masteryTo2" value="10" min="1" />
              </label>
              <label>Mastery to L3 uses
                <input type="number" name="masteryTo3" value="25" min="2" />
              </label>
              <label>Mastery to L4 uses
                <input type="number" name="masteryTo4" value="50" min="3" />
              </label>
            </div>
            <button type="submit">Add Card</button>
          </form>
        </details>
      </div>
    </details>
  `;
}

function renderPlayerStatusSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="statuses">
      <summary><strong>Statuses</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Active Statuses</h4>
          <button type="button" data-player-toggle-status>Manage</button>
        </div>
        <div class="status-list">${renderStatuses(participant)}</div>
        ${renderPlayerStatusForm()}
      </div>
    </details>
  `;
}

function renderPlayerZoneSection() {
  return `
    <details class="player-collapsible" data-player-section="zones">
      <summary><strong>Zones</strong></summary>
      <div class="collapsible-body">
        <div id="playerZoneList" class="card-list empty-state">No active zones.</div>
      </div>
    </details>
  `;
}

function renderPlayerDamageSection(participant, manageMode = false) {
  return `
    <details class="player-collapsible" data-player-section="mitigation">
      <summary><strong>Resistances & Vulnerabilities</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Resistances & Vulnerabilities</h4>
          <button type="button" data-player-toggle-mitigation-manage>${manageMode ? 'Done' : 'Manage'}</button>
        </div>
        ${renderPlayerDamageGroup('Resistances', participant.resistances, 'resistance', manageMode)}
        ${renderPlayerDamageGroup('Vulnerabilities', participant.vulnerabilities, 'vulnerability', manageMode)}
        ${
          manageMode
            ? `
            <div class="form-row">
              <form data-resistance-form class="stacked-form compact-form">
                <label class="compact-label">Add Resistance
                  <select name="resistance">
                    ${renderDamageTypeOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
              <form data-vulnerability-form class="stacked-form compact-form">
                <label class="compact-label">Add Vulnerability
                  <select name="vulnerability">
                    ${renderDamageTypeOptions(true)}
                  </select>
                </label>
                <button type="submit">Add</button>
              </form>
            </div>
          `
            : ''
        }
        <p class="muted">Resistances halve incoming damage; vulnerabilities double it. Recover (1 AP) removes 1 stack of Bleeding/Poisoned/Burning.</p>
      </div>
    </details>
  `;
}

function renderPlayerDamageGroup(label, values = [], key, manageMode = false) {
  const list = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${value}
          ${manageMode ? `<button type="button" aria-label="Remove" data-player-remove-${key}="${index}">×</button>` : ''}
        </span>`
    )
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
      </div>
      <div class="tag-list">
        ${list || '<span class="muted">None</span>'}
      </div>
    </div>
  `;
}

function renderPlayerAbilitiesSection(participant, manageMode = false) {
  return `
    <details class="player-collapsible" data-player-section="abilitiesText">
      <summary><strong>Abilities</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Abilities</h4>
          <button type="button" data-player-toggle-ability-manage>${manageMode ? 'Done' : 'Manage'}</button>
        </div>
        <div class="ability-list">
          ${renderPlayerAbilityEntries(participant, manageMode)}
        </div>
        ${renderPlayerTextListEditor('Proficiencies', participant.proficiencies || [], 'proficiency', manageMode)}
        ${renderPlayerTextListEditor('Languages', participant.languages || [], 'language', manageMode)}
        ${
          manageMode
            ? `
            <form data-player-ability-form class="stacked-form">
              <label>Name
                <input type="text" name="name" placeholder="Ability name" />
              </label>
              <label>Description
                <textarea name="description" rows="2" placeholder="Describe the ability..." required></textarea>
              </label>
              <button type="submit">Add Ability</button>
            </form>
          `
            : ''
        }
      </div>
    </details>
  `;
}

function renderPlayerTextListEditor(label, values = [], key = 'entry', manageMode = false) {
  const pills = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${escapeHtml(value)}
          ${
            manageMode
              ? `<button type="button" aria-label="Remove" data-player-remove-${key}="${index}">×</button>`
              : ''
          }
        </span>`
    )
    .join('');
  return `
    <div class="damage-group">
      <div class="damage-group-header">
        <h4>${label}</h4>
      </div>
      <div class="tag-list">
        ${pills || '<span class="muted">None</span>'}
      </div>
      ${
        manageMode
          ? `
          <form data-player-${key}-form>
            <label class="compact-label">Add ${label.slice(0, -1)}
              <input type="text" name="${key}" placeholder="Add ${label.slice(0, -1).toLowerCase()}" />
            </label>
            <button type="submit">Add</button>
          </form>
        `
          : ''
      }
    </div>
  `;
}

function renderPlayerAbilityEntries(participant, manageMode = false) {
  const entries = participant.abilities || [];
  if (!entries.length) {
    return '<p class="muted">No abilities recorded yet.</p>';
  }
  return entries
    .map(
      (entry, index) => `
      <article class="journal-entry">
        <strong>${entry.name || `Ability ${index + 1}`}</strong>
        <p>${entry.description || 'No description.'}</p>
        ${
          manageMode
            ? `
            <div class="card-actions">
              <button type="button" data-player-remove-ability="${entry.id || ''}" data-player-ability-index="${index}">Remove</button>
            </div>
          `
            : ''
        }
      </article>`
    )
    .join('');
}

function journalFieldName(category) {
  return category === 'achievement' ? 'achievements' : 'quests';
}

function renderJournal() {
  rememberPlayerJournalSections();
  if (!els.journal || !els.journalContent) return;
  const participant = getFocusedParticipant();
  if (!participant || (createMode && !focusId)) {
    els.journalContent.innerHTML = '<p class="empty-state">Journal becomes available once a character is selected.</p>';
    hideJournalPopup();
    return;
  }
  const quests = (participant.quests || []).filter((entry) => entry.acknowledged);
  const achievements = (participant.achievements || []).filter((entry) => entry.acknowledged);
  els.journalContent.innerHTML = `
    ${renderPlayerJournalGroup('Quests', quests, 'No quests yet.', 'quest')}
    ${renderPlayerJournalGroup('Achievements', achievements, 'No achievements yet.', 'achievement')}
  `;
  renderJournalPopup(participant);
  restorePlayerJournalSections(participant.id);
}

function rememberPlayerSections() {
  const current = getFocusedParticipant();
  if (!current || !els.stats) return;
  const snapshot = {};
  els.stats.querySelectorAll('details[data-player-section]').forEach((node) => {
    snapshot[node.dataset.playerSection] = node.open;
  });
  playerSectionState.set(current.id, snapshot);
}

function restorePlayerSections(participantId) {
  if (!participantId || !els.stats) return;
  const snapshot = playerSectionState.get(participantId);
  if (!snapshot) return;
  els.stats.querySelectorAll('details[data-player-section]').forEach((node) => {
    const key = node.dataset.playerSection;
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      node.open = Boolean(snapshot[key]);
    }
  });
}

function rememberPlayerJournalSections() {
  const current = getFocusedParticipant();
  if (!current || !els.journalContent) return;
  const snapshot = {};
  els.journalContent.querySelectorAll('details[data-journal-section]').forEach((node) => {
    snapshot[node.dataset.journalSection] = node.open;
  });
  playerJournalState.set(current.id, snapshot);
}

function restorePlayerJournalSections(participantId) {
  if (!participantId || !els.journalContent) return;
  const snapshot = playerJournalState.get(participantId);
  if (!snapshot) return;
  els.journalContent.querySelectorAll('details[data-journal-section]').forEach((node) => {
    const key = node.dataset.journalSection;
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      node.open = Boolean(snapshot[key]);
    }
  });
}

function renderPlayerJournalGroup(label, entries, emptyText, category) {
  return `
    <details class="player-collapsible journal-collapsible" data-journal-section="${category}">
      <summary><strong>${label} (${entries.length})</strong></summary>
      <div class="collapsible-body journal-list">
        ${renderPlayerJournalEntries(entries, emptyText, category)}
      </div>
    </details>
  `;
}

function renderPlayerJournalEntries(entries, emptyText, category) {
  if (!entries.length) {
    return `<p class="muted">${emptyText}</p>`;
  }
  return entries
    .map(
      (entry) => `
      <article class="journal-entry">
        <strong>${escapeHtml(entry.title || 'Entry')}</strong>
        ${renderPlayerJournalDetails(entry, category)}
      </article>`
    )
    .join('');
}

function renderPlayerJournalDetails(entry, category, options = {}) {
  const template = entry?.template || {};
  const popup = Boolean(options.popup);
  if (category === 'quest' && Object.keys(template).length) {
    const objectives = [template.objectivePrimary, template.objectiveSecondary].filter(Boolean);
    const rewards = [template.rewardPrimary, template.rewardBonus].filter(Boolean);
    return `
      <div class="journal-template ${popup ? 'journal-template-terminal' : ''}">
        ${template.narrative ? `<p><strong>Description:</strong> ${escapeHtml(template.narrative)}</p>` : ''}
        ${
          objectives.length
            ? `<div class="journal-template-block"><strong>Objective:</strong><ul>${objectives
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
        ${template.difficulty ? `<p><strong>Difficulty:</strong> ${escapeHtml(template.difficulty)}</p>` : ''}
        ${
          rewards.length
            ? `<div class="journal-template-block"><strong>Rewards:</strong><ul>${rewards
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join('')}</ul></div>`
            : ''
        }
        ${template.failureCondition ? `<p><strong>Failure:</strong> ${escapeHtml(template.failureCondition)}</p>` : ''}
      </div>
    `;
  }
  if (category === 'achievement' && Object.keys(template).length) {
    return `
      <div class="journal-template ${popup ? 'journal-template-terminal' : ''}">
        ${template.requirement ? `<p><strong>Requirement:</strong> ${escapeHtml(template.requirement)}</p>` : ''}
        ${template.reward ? `<p><strong>Reward:</strong> ${escapeHtml(template.reward)}</p>` : ''}
        ${template.flavor ? `<p><strong>Description:</strong> ${escapeHtml(template.flavor)}</p>` : ''}
      </div>
    `;
  }
  return entry.description ? `<p>${escapeHtml(entry.description)}</p>` : '';
}

function getPendingJournalEntry(participant) {
  const queue = [];
  (participant.quests || []).forEach((entry) => {
    if (!entry.acknowledged) queue.push({ ...entry, category: 'quest' });
  });
  (participant.achievements || []).forEach((entry) => {
    if (!entry.acknowledged) queue.push({ ...entry, category: 'achievement' });
  });
  queue.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return queue[0] || null;
}

function renderJournalPopup(participant) {
  const popup = els.journalPopup;
  if (!popup) return;
  const pending = getPendingJournalEntry(participant);
  if (!pending) {
    hideJournalPopup();
    return;
  }
  popup.innerHTML = `
    <div class="journal-popup-card">
      <h3>${pending.category === 'achievement' ? 'ACHIEVEMENT EARNED' : 'QUEST FOUND'}</h3>
      <h4>${escapeHtml(pending.title || 'Untitled')}</h4>
      ${renderPlayerJournalDetails(pending, pending.category, { popup: true })}
      <div class="card-actions">
        <button type="button" data-journal-ack="${pending.id}" data-journal-category="${pending.category}" class="primary">
          ${pending.category === 'achievement' ? 'Log Achievement' : 'Accept Quest'}
        </button>
        ${
          pending.category === 'quest'
            ? `<button type="button" data-journal-reject="${pending.id}" data-journal-category="${pending.category}" class="danger">Reject Quest</button>`
            : ''
        }
      </div>
    </div>
  `;
  popup.classList.remove('hidden');
  popup.querySelector('[data-journal-ack]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await api('/api/journal/ack', 'POST', {
        participantId: participant.id,
        category: button.dataset.journalCategory,
        entryId: button.dataset.journalAck
      });
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
  popup.querySelector('[data-journal-reject]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await api('/api/journal/entry', 'DELETE', {
        participantId: participant.id,
        category: button.dataset.journalCategory,
        entryId: button.dataset.journalReject
      });
      fetchState();
    } catch (err) {
      notify(err.message);
    }
  });
}

function hideJournalPopup() {
  const popup = els.journalPopup;
  if (!popup) return;
  popup.classList.add('hidden');
  popup.innerHTML = '';
}

function renderPlayerSetSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="sets">
      <summary><strong>Set Tracker</strong></summary>
      <div class="collapsible-body">
        ${renderSetTracker(participant)}
      </div>
    </details>
  `;
}

function renderPlayerConstructSection() {
  return `
    <details class="player-collapsible" data-player-section="constructs">
      <summary><strong>Constructs</strong></summary>
      <div class="collapsible-body">
        <div id="playerConstructList" class="card-list empty-state">No active constructs.</div>
      </div>
    </details>
  `;
}

function renderPlayerRelicSection() {
  return `
    <details class="player-collapsible" data-player-section="relics">
      <summary><strong>Relics & Artifacts</strong></summary>
      <div class="collapsible-body">
        <div id="playerRelicList" class="relic-list empty-state">No relics yet.</div>
        <details id="playerRelicDrawer">
          <summary>Relic Tools</summary>
          <div class="card-import">
            <label class="file-upload">
              Import Relics
              <input type="file" id="playerImportRelic" accept="application/json" />
            </label>
          </div>
          <form id="playerRelicForm" class="stacked-form">
            <div class="form-row">
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>HP Bonus
                <input type="number" name="hp" value="0" />
              </label>
              <label>AP Bonus
                <input type="number" name="ap" value="0" />
              </label>
            </div>
            <div class="form-row">
              <label>Ability Focus
                <input type="text" name="ability" placeholder="Machine, Shield, etc." />
              </label>
              <label>Description
                <input type="text" name="description" placeholder="What does it do?" />
              </label>
            </div>
            <button type="submit">Add Relic</button>
          </form>
        </details>
      </div>
    </details>
  `;
}

function renderPlayerNotesSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="notes">
      <summary><strong>Notes</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Notes</h4>
          <button type="button" data-player-save-notes>Save</button>
        </div>
        <textarea data-player-notes rows="3" placeholder="Add notes for the GM or reminders">${participant.notes || ''}</textarea>
      </div>
    </details>
  `;
}

function renderPlayerInventorySection() {
  return `
    <details class="player-collapsible" data-player-section="inventory">
      <summary><strong>Inventory</strong></summary>
      <div class="collapsible-body">
        <div class="section-header">
          <h4>Currencies</h4>
          <button type="button" data-player-toggle-currency>Add Currency</button>
        </div>
        <div id="playerCurrencyList" class="relic-list empty-state">No currencies yet.</div>
        <form id="playerCurrencyForm" class="stacked-form hidden">
          <div class="form-row">
            <label>Name
              <input type="text" name="name" placeholder="Gold" required />
            </label>
            <label>Starting Amount
              <input type="number" name="amount" min="0" value="0" />
            </label>
          </div>
          <button type="submit">Add Currency</button>
        </form>
        <div class="section-header">
          <h4>Items</h4>
          <button type="button" data-player-toggle-inventory>Add Item</button>
        </div>
        <div id="playerInventoryList" class="relic-list empty-state">No inventory items yet.</div>
        <form id="playerInventoryForm" class="stacked-form hidden">
          <div class="form-row">
            <label>Item
              <input type="text" name="name" placeholder="Potion" required />
            </label>
            <label>Qty
              <input type="number" name="quantity" min="1" value="1" />
            </label>
          </div>
          <label>Description
            <input type="text" name="description" placeholder="Optional details" />
          </label>
          <label>Tags
            <input type="text" name="tags" placeholder="Consumable, Quest, Crafting" />
          </label>
          <button type="submit">Add Item</button>
        </form>
      </div>
    </details>
  `;
}

function renderInlineAdjust(fieldKey) {
  return `
    <div class="inline-adjust">
      <button type="button" data-inline-adjust="${fieldKey}" data-delta="-1">-1</button>
      <button type="button" data-inline-adjust="${fieldKey}" data-delta="1">+1</button>
      <input type="number" data-inline-input="${fieldKey}" placeholder="Set" />
      <button type="button" data-inline-set="${fieldKey}">Set</button>
    </div>
  `;
}

const ABILITIES = [
  { key: 'strength', label: 'STR' },
  { key: 'dexterity', label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'WIS' },
  { key: 'charisma', label: 'CHA' }
];

function renderAbilityTable(stats) {
  const rows = ABILITIES.map(({ key, label }) => {
    const value = stats[key] ?? 0;
    const mod = abilityMod(value);
    return `
      <tr>
        <th>${label}</th>
        <td><input type="number" data-ability-input="${key}" value="${value}" /></td>
        <td>${formatMod(mod)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table">
      <thead>
        <tr><th>Ability</th><th>Score</th><th>Mod</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function populatePlayerBaseForm(participant) {
  if (!els.baseForm || !participant) return;
  const pairs = [
    ['hp', participant.hp],
    ['maxHp', participant.maxHp],
    ['shield', participant.shield],
    ['maxShield', participant.maxShield],
    ['apCurrent', participant.apCurrent ?? participant.apMax],
    ['apMax', participant.apMax]
  ];
  pairs.forEach(([key, value]) => {
    const input = els.baseForm.querySelector(`input[name="${key}"]`);
    if (input) input.value = Number(value ?? 0);
  });
}

async function handlePlayerBaseSubmit(event) {
  event.preventDefault();
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  const formData = new FormData(event.target);
  const payload = {
    hp: Number(formData.get('hp') ?? participant.hp ?? 0),
    maxHp: Number(formData.get('maxHp') ?? participant.maxHp ?? 0),
    shield: Number(formData.get('shield') ?? participant.shield ?? 0),
    maxShield: Number(formData.get('maxShield') ?? participant.maxShield ?? 0),
    apCurrent: Number(formData.get('apCurrent') ?? participant.apCurrent ?? participant.apMax ?? 0),
    apMax: Number(formData.get('apMax') ?? participant.apMax ?? 0)
  };
  try {
    await patchParticipant(participant.id, payload);
    fetchState();
    els.baseForm?.classList.add('hidden');
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerRest(type) {
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  try {
    await api(`/api/rest/${type}`, 'POST', { participantId: participant.id });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerStandardAction(actionId) {
  if (!actionId) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    return;
  }
  let resolvedId = actionId;
  let standardPayload = {};
  if (actionId === 'move') {
    const difficultToggle = els.stats.querySelector('[data-player-difficult]');
    if (difficultToggle?.checked) {
      resolvedId = 'move_difficult';
    }
  }
  if (actionId === 'recover') {
    const target = choosePlayerRecoverTarget(participant);
    if (target === null) {
      return;
    }
    standardPayload = target || {};
  }
  if (actionId === 'cleanse') {
    const target = choosePlayerCleanseTarget(participant);
    if (target === null) {
      return;
    }
    standardPayload = target || {};
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId: resolvedId,
      participantId: participant.id,
      ...standardPayload
    });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

function normalizeRecoverToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function detectRecoverType(status) {
  const fields = [status?.presetId, status?.name, status?.id];
  for (const field of fields) {
    const token = normalizeRecoverToken(field);
    if (token.includes('bleeding')) return 'bleeding';
    if (token.includes('poisoned')) return 'poisoned';
    if (token.includes('burning')) return 'burning';
  }
  return null;
}

function listPlayerRecoverableStatuses(participant) {
  return (participant?.statuses || [])
    .map((status, index) => {
      const type = detectRecoverType(status);
      if (!type) return null;
      return {
        status,
        index,
        type,
        label: `${status.name || type}${status.stacks ? ` ×${status.stacks}` : ''}`
      };
    })
    .filter(Boolean);
}

function choosePlayerRecoverTarget(participant) {
  const recoverable = listPlayerRecoverableStatuses(participant);
  if (!recoverable.length) {
    notify('No Bleeding, Poisoned, or Burning stacks to recover.');
    return null;
  }
  if (recoverable.length === 1) {
    const [entry] = recoverable;
    return {
      recoverStatusIndex: entry.index,
      recoverStatusId: entry.status.id,
      recoverStatusName: entry.status.name,
      recoverStatusType: entry.type
    };
  }
  const message = [
    'Choose status to reduce by 1 stack:',
    ...recoverable.map((entry, index) => `${index + 1}. ${entry.label}`)
  ].join('\n');
  const raw = window.prompt(message, '1');
  if (raw == null) return null;
  const choice = Number(raw);
  if (!Number.isInteger(choice) || choice < 1 || choice > recoverable.length) {
    notify('Invalid selection. Recover cancelled.');
    return null;
  }
  const picked = recoverable[choice - 1];
  return {
    recoverStatusIndex: picked.index,
    recoverStatusId: picked.status.id,
    recoverStatusName: picked.status.name,
    recoverStatusType: picked.type
  };
}

function detectPlayerCleanseType(status) {
  const fields = [status?.presetId, status?.name, status?.id];
  for (const field of fields) {
    const token = normalizeRecoverToken(field);
    if (token.includes('rooted') || token.includes('root')) return 'rooted';
    if (token.includes('restrained') || token.includes('restrain')) return 'restrained';
    if (token.includes('silenced') || token.includes('silence')) return 'silenced';
    if (token.includes('charmed') || token.includes('charm')) return 'charmed';
    if (token.includes('frightened') || token.includes('frighten')) return 'frightened';
    if (token.includes('suppressed') || token.includes('suppress')) return 'suppressed';
    if (token.includes('stunned') || token.includes('stun')) return 'stunned';
    if (token.includes('paralysed') || token.includes('paralyzed') || token.includes('paralyse') || token.includes('paralyze')) return 'paralysed';
  }
  return null;
}

function getPlayerCleanseApCost(type) {
  return type === 'stunned' || type === 'paralysed' ? 5 : 4;
}

function listPlayerCleanseableStatuses(participant) {
  return (participant?.statuses || [])
    .map((status, index) => {
      const type = detectPlayerCleanseType(status);
      if (!type) return null;
      const apCost = getPlayerCleanseApCost(type);
      return {
        status,
        index,
        type,
        apCost,
        label: `${status.name || type}${status.stacks ? ` ×${status.stacks}` : ''} (${apCost} AP)`
      };
    })
    .filter(Boolean);
}

function choosePlayerCleanseTarget(participant) {
  const cleanseable = listPlayerCleanseableStatuses(participant);
  if (!cleanseable.length) {
    notify('No eligible control/debuff status to cleanse.');
    return null;
  }
  if (cleanseable.length === 1) {
    const [entry] = cleanseable;
    return {
      cleanseStatusIndex: entry.index,
      cleanseStatusId: entry.status.id,
      cleanseStatusName: entry.status.name,
      cleanseStatusType: entry.type
    };
  }
  const message = [
    'Choose status to remove completely:',
    ...cleanseable.map((entry, index) => `${index + 1}. ${entry.label}`)
  ].join('\n');
  const raw = window.prompt(message, '1');
  if (raw == null) return null;
  const choice = Number(raw);
  if (!Number.isInteger(choice) || choice < 1 || choice > cleanseable.length) {
    notify('Invalid selection. Cleanse cancelled.');
    return null;
  }
  const picked = cleanseable[choice - 1];
  return {
    cleanseStatusIndex: picked.index,
    cleanseStatusId: picked.status.id,
    cleanseStatusName: picked.status.name,
    cleanseStatusType: picked.type
  };
}

async function handlePlayerDamageForm(event, participant, field, inputName) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const value = String(formData.get(inputName) || '').trim();
  if (!value) {
    notify('Select a damage type.');
    return;
  }
  try {
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const source = Array.isArray(latest?.[field]) ? latest[field] : [];
    const existing = [...source];
    const duplicate = existing.find((entry) => entry.toLowerCase() === value.toLowerCase());
    if (duplicate) {
      notify('Already listed.');
      return;
    }
    await patchParticipant(participant.id, { [field]: [...existing, value] });
    fetchState();
    const select = event.target.querySelector('select');
    if (select) select.value = '';
  } catch (err) {
    notify(err.message);
  }
}

async function handlePlayerDamageRemove(participant, field, index) {
  if (index < 0 || Number.isNaN(index)) return;
  try {
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const source = Array.isArray(latest?.[field]) ? latest[field] : [];
    const existing = [...source];
    if (index >= existing.length) return;
    existing.splice(index, 1);
    await patchParticipant(participant.id, { [field]: existing });
    fetchState();
  } catch (err) {
    notify(err.message);
  }
}

function renderSavingThrows(participant) {
  const stats = participant.stats || {};
  const rows = ABILITIES.map(({ key, label }) => {
    const mod = abilityMod(stats[key] ?? 0);
    const proficient = Boolean(participant.savingThrows?.[key]);
    const total = mod + (proficient ? participant.proficiencyBonus || 0 : 0);
    return `
      <tr>
        <th>${label}</th>
        <td>${formatMod(mod)}</td>
        <td><input type="checkbox" data-save-toggle="${key}" ${proficient ? 'checked' : ''} /></td>
        <td>${formatMod(total)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table">
      <thead>
        <tr><th>Ability</th><th>Mod</th><th>Prof</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

const SKILLS = [
  ['Acrobatics', 'dexterity', 'acrobatics'],
  ['Animal Handling', 'wisdom', 'animalHandling'],
  ['Arcana', 'intelligence', 'arcana'],
  ['Athletics', 'strength', 'athletics'],
  ['Deception', 'charisma', 'deception'],
  ['History', 'intelligence', 'history'],
  ['Insight', 'wisdom', 'insight'],
  ['Intimidation', 'charisma', 'intimidation'],
  ['Investigation', 'intelligence', 'investigation'],
  ['Medicine', 'wisdom', 'medicine'],
  ['Nature', 'intelligence', 'nature'],
  ['Perception', 'wisdom', 'perception'],
  ['Performance', 'charisma', 'performance'],
  ['Persuasion', 'charisma', 'persuasion'],
  ['Religion', 'intelligence', 'religion'],
  ['Sleight of Hand', 'dexterity', 'sleightOfHand'],
  ['Stealth', 'dexterity', 'stealth'],
  ['Survival', 'wisdom', 'survival']
];

function renderSkillsTable(participant) {
  const stats = participant.stats || {};
  const prof = participant.proficiencyBonus || 0;
  const rows = SKILLS.map(([skill, ability, key]) => {
    const mod = abilityMod(stats[ability] ?? 0);
    const entry = getSkillState(participant, key);
    const total = mod + prof * (entry.expert ? 2 : entry.proficient ? 1 : 0);
    return `
      <tr>
        <th>${skill}</th>
        <td>${abilityLabel(ability)}</td>
        <td>${formatMod(mod)}</td>
        <td><input type="checkbox" data-skill-toggle="${key}" data-toggle-type="proficient" ${entry.proficient ? 'checked' : ''} /></td>
        <td><input type="checkbox" data-skill-toggle="${key}" data-toggle-type="expert" ${entry.expert ? 'checked' : ''} /></td>
        <td>${formatMod(total)}</td>
      </tr>`;
  }).join('');
  return `
    <table class="player-table">
      <thead>
        <tr><th>Skill</th><th>Ability</th><th>Mod</th><th>Prof</th><th>Expert</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function abilityLabel(key) {
  const match = ABILITIES.find((entry) => entry.key === key);
  return match ? match.label : key?.toUpperCase();
}

function formatMod(value) {
  const num = Number(value) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

function formatSignedValue(value = 0) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '+0';
  return `${amount >= 0 ? '+' : ''}${Math.round(amount)}`;
}

function getTierMasteryThresholdDefaults(tier = 'Common') {
  const defaults = getCardTierMasteryThresholds(tier);
  const level2 = Math.max(1, Math.round(Number(defaults?.level2 ?? 10)));
  const level3 = Math.max(level2 + 1, Math.round(Number(defaults?.level3 ?? level2 + 1)));
  const level4 = Math.max(level3 + 1, Math.round(Number(defaults?.level4 ?? level3 + 1)));
  return { level2, level3, level4 };
}

function syncCardMasteryThresholdInputs(formEl) {
  if (!formEl) return;
  const tierInput = formEl.querySelector('[name="tier"]');
  const to2Input = formEl.querySelector('[name="masteryTo2"]');
  const to3Input = formEl.querySelector('[name="masteryTo3"]');
  const to4Input = formEl.querySelector('[name="masteryTo4"]');
  if (!to2Input || !to3Input || !to4Input) return;
  const defaults = getTierMasteryThresholdDefaults(tierInput?.value || 'Common');
  to2Input.value = String(defaults.level2);
  to3Input.value = String(defaults.level3);
  to4Input.value = String(defaults.level4);
}

function abilityMod(score = 0) {
  return Math.floor((Number(score) - 10) / 2);
}

function getSkillState(participant, key) {
  return participant.skills?.[key] || { proficient: false, expert: false };
}

function isCardActive(card = {}) {
  return card?.active !== false;
}

function participantHasActiveConstructCard(participant = {}) {
  return getPlayerCardBuckets(participant).active.some(({ card }) => isConstructCard(card));
}

function participantHasActiveZoneCard(participant = {}) {
  return getPlayerCardBuckets(participant).active.some(({ card }) =>
    isZoneCard(card, Number(card?.masteryLevel || 1))
  );
}

function getPlayerCardBuckets(participant = {}) {
  const entries = (participant.cards || []).map((card, index) => ({ card, index }));
  const active = [];
  const inactive = [];
  entries.forEach((entry) => {
    if (isCardActive(entry.card)) {
      active.push(entry);
    } else {
      inactive.push(entry);
    }
  });
  return { active, inactive, total: entries.length };
}

function getPlayerTeamOptionValues(participant = null) {
  const options = [];
  const pushUnique = (value) => {
    const team = String(value || '').trim();
    if (!team || options.includes(team)) return;
    options.push(team);
  };
  for (const entry of state.reference?.teams || []) {
    pushUnique(entry);
  }
  for (const entry of state.encounter?.participants || []) {
    pushUnique(entry?.team);
  }
  if (participant) {
    pushUnique(participant.team);
  }
  return options;
}

function renderPlayerTeamOptions(participant = null) {
  const options = ['<option value="">Unassigned</option>'];
  for (const team of getPlayerTeamOptionValues(participant)) {
    const selected = String(participant?.team || '').trim() === team ? ' selected' : '';
    options.push(`<option value="${escapeHtml(team)}"${selected}>${escapeHtml(team)}</option>`);
  }
  return options.join('');
}

function getPlayerAllies(participant) {
  if (!participant?.id) return [];
  const sourceId = participant.id;
  const sourceTeam = String(participant.team || '').trim().toLowerCase();
  const manualIds = new Set(participant?.setRuntime?.allies?.targetIds || []);
  return (state.encounter.participants || []).filter((entry) => {
    if (!entry || entry.id === sourceId) return false;
    const sameTeam =
      sourceTeam &&
      String(entry.team || '')
        .trim()
        .toLowerCase() === sourceTeam;
    return sameTeam || manualIds.has(entry.id);
  });
}

function mergePlayerUniqueText(existing = [], value = '') {
  const token = String(value || '').trim();
  if (!token) return existing;
  const already = existing.some((entry) => String(entry || '').trim().toLowerCase() === token.toLowerCase());
  if (already) return existing;
  return [...existing, token];
}

function playerHasSetBonus(participant = {}, setName = '', pieces = 1) {
  const target = String(setName || '').trim().toLowerCase();
  if (!target) return false;
  const count = getPlayerCardBuckets(participant).active.reduce((total, { card }) => {
    return String(card?.set || '').trim().toLowerCase() === target ? total + 1 : total;
  }, 0);
  return count >= Math.max(1, Number(pieces || 1));
}

function renderSetTracker(participant) {
  const counts = {};
  for (const { card } of getPlayerCardBuckets(participant).active) {
    if (!card.set) continue;
    counts[card.set] = (counts[card.set] || 0) + 1;
  }
  const entries = Object.entries(counts);
  const rows = entries
    .map(([setName, count]) => {
      const ref = (state.reference.sets || []).find((entry) => entry.name === setName);
      const bonuses = ref?.bonuses || [];
      const list = bonuses
        .map(
          (bonus) => `
            <li class="${count >= bonus.pieces ? 'active' : ''}">
              ${bonus.pieces} pcs — ${bonus.effect || summarizeModifiers(bonus.modifiers || {})}
              ${count >= bonus.pieces ? renderPlayerSetBonusStatus(setName, bonus, participant) : ''}
              ${count >= bonus.pieces ? renderPlayerSetActivationButton(setName, bonus, participant) : ''}
            </li>`
        )
        .join('');
      return `
        <div class="set-block">
          <div class="set-header">
            <strong>${setName}</strong>
            <span>${count} card${count === 1 ? '' : 's'}</span>
          </div>
          <ul class="set-list">${list}</ul>
        </div>`;
    })
    .join('');
  const allyManager =
    playerHasSetBonus(participant, 'Divine', 3) || playerHasSetBonus(participant, 'Nature', 5)
      ? renderPlayerSetAllyTargetManager(participant)
      : '';
  if (!rows) {
    return allyManager || '<p class="muted">No set bonuses equipped.</p>';
  }
  return `${rows}${allyManager}`;
}

function renderPlayerSetAllyTargetManager(participant) {
  const allyIds = participant?.setRuntime?.allies?.targetIds || [];
  const automaticAllies = getPlayerAllies(participant).filter((entry) => !allyIds.includes(entry.id));
  const participants = state.encounter.participants || [];
  const assigned = allyIds
    .map((id) => participants.find((entry) => entry.id === id))
    .filter(Boolean);
  const options = participants
    .filter((entry) => entry.id !== participant.id && !allyIds.includes(entry.id))
    .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
    .join('');
  const pills = assigned
    .map(
      (entry) => `
        <span class="status-pill">
          ${escapeHtml(entry.name)}
          <button type="button" data-player-set-ally-remove="${entry.id}">Remove</button>
        </span>`
    )
    .join('');
  return `
    <div class="set-block">
      <div class="set-header">
        <strong>Set Ally Targets</strong>
        <span>${assigned.length + automaticAllies.length} total</span>
      </div>
      <p class="muted small-note">Characters on the same team are auto-allies. Manual allies are optional overrides.</p>
      ${
        automaticAllies.length
          ? `<p class="muted small-note">Auto-allies: ${escapeHtml(automaticAllies.map((entry) => entry.name).join(', '))}</p>`
          : ''
      }
      <div class="status-list">
        ${pills || '<span class="muted">No allies selected.</span>'}
      </div>
      <div class="form-row">
        <label>Add Ally
          <select data-player-set-ally-add>
            <option value="">Select ally…</option>
            ${options}
          </select>
        </label>
        <button type="button" data-player-set-ally-add-button>Add</button>
      </div>
    </div>
  `;
}

function renderPlayerSetBonusStatus(setName, bonus, participant) {
  const abilityId = bonus?.activatable?.id || bonus?.id;
  const machine = participant.setRuntime?.machine || {};
  if (bonus.id === 'machine_5_auto_loader') {
    if (machine.autoLoaderPrimed) {
      return ' <small class="muted">[Primed]</small>';
    }
    return ` <small class="muted">[${machine.autoLoaderTriggeredTurn ? 'Triggered this turn' : 'Ready'}]</small>`;
  }
  if (abilityId === 'arcane_7_temp_copy') {
    return participant?.setRuntime?.arcane?.copyUsedEncounter
      ? ' <small class="muted">[Used this encounter]</small>'
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'arcane_10_modify_card') {
    const modified = participant?.setRuntime?.arcane?.modifiedCard;
    return modified?.cardId
      ? ` <small class="muted">[Active: ${escapeHtml(modified.mode || 'modified')}]</small>`
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    return participant?.setRuntime?.divine?.sacredOverchargeUsed
      ? ' <small class="muted">[Used this long rest]</small>'
      : ' <small class="muted">[Ready]</small>';
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    return ' <small class="muted">[Select ally and activate]</small>';
  }
  return '';
}

function renderPlayerSetActivationButton(setName, bonus, participant) {
  if (!bonus?.activatable?.id) return '';
  void setName;
  const canActivate = canPlayerActivateSetBonus(bonus, participant);
  const disabled = canActivate ? '' : ' disabled';
  return ` <button type="button" data-player-activate-set="${bonus.activatable.id}"${disabled}>Activate</button>`;
}

function canPlayerActivateSetBonus(bonus, participant) {
  const abilityId = bonus?.activatable?.id || bonus?.id;
  if (!abilityId || !participant) return false;
  if (abilityId === 'arcane_7_temp_copy') {
    const used = Boolean(participant?.setRuntime?.arcane?.copyUsedEncounter);
    const activeCount = getPlayerCardBuckets(participant).active.length;
    return !used && activeCount < MAX_ACTIVE_CARDS;
  }
  if (abilityId === 'arcane_10_modify_card') {
    const modified = participant?.setRuntime?.arcane?.modifiedCard;
    return !modified?.cardId;
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    const used = Boolean(participant?.setRuntime?.divine?.sacredOverchargeUsed);
    const allies = getPlayerAllies(participant);
    return !used && allies.length > 0;
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    const allies = getPlayerAllies(participant);
    return allies.length > 0;
  }
  return false;
}

function buildPlayerSetActivationPayload(participant, abilityId) {
  const id = String(abilityId || '').trim();
  if (!id || !participant?.id) return null;
  const payload = {
    participantId: participant.id,
    abilityId: id
  };
  if (id === 'arcane_7_temp_copy') {
    const cardId = promptForPlayerSetCardSelection(participant, 'Arcane Copy');
    if (!cardId) return null;
    payload.cardId = cardId;
    return payload;
  }
  if (id === 'arcane_10_modify_card') {
    const cardId = promptForPlayerSetCardSelection(participant, 'Arcane Card Modification');
    if (!cardId) return null;
    const mode = promptForPlayerArcaneMode();
    if (!mode) return null;
    payload.cardId = cardId;
    payload.mode = mode;
    return payload;
  }
  if (id === 'divine_5_cleanse_heal') {
    const targetId = promptForPlayerSetAllySelection(participant, 'Divine Cleanse');
    if (!targetId) return null;
    payload.targetId = targetId;
    return payload;
  }
  return payload;
}

function promptForPlayerSetCardSelection(participant, label) {
  const activeCards = getPlayerCardBuckets(participant).active;
  if (!activeCards.length) {
    notify('No active cards available.');
    return '';
  }
  const lines = activeCards.map(({ card }, index) => `${index + 1}. ${card.name}`).join('\n');
  const raw = window.prompt(`${label}\n${lines}\nEnter card number:`) || '';
  const selectedIndex = Number(raw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > activeCards.length) {
    notify('Invalid card selection.');
    return '';
  }
  return activeCards[selectedIndex - 1].card.id;
}

function promptForPlayerArcaneMode() {
  const raw = window.prompt(
    'Arcane modification mode:\n1 = range (+10 ft)\n2 = radius (+5 ft)\n3 = damage (+2)\n4 = ap (-1, min 1)\nEnter 1-4:'
  );
  const modeMap = {
    1: 'range',
    2: 'radius',
    3: 'damage',
    4: 'ap'
  };
  const mode = modeMap[Number(raw)];
  if (!mode) {
    notify('Invalid mode selection.');
    return '';
  }
  return mode;
}

function promptForPlayerSetAllySelection(participant, label) {
  const allyOptions = getPlayerAllies(participant);
  if (!allyOptions.length) {
    notify('No allies available.');
    return '';
  }
  const lines = allyOptions.map((entry, index) => `${index + 1}. ${entry.name}`).join('\n');
  const raw = window.prompt(`${label}\n${lines}\nEnter ally number:`) || '';
  const selectedIndex = Number(raw);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > allyOptions.length) {
    notify('Invalid ally selection.');
    return '';
  }
  return allyOptions[selectedIndex - 1].id;
}

function renderPlayerStatusForm() {
  return `
    <form data-player-status-form class="stacked-form hidden">
      <label>Preset
        <select name="preset" data-status-preset>
          <option value="">Custom</option>
          ${renderStatusPresetOptions()}
        </select>
      </label>
      <div class="form-row">
        <label>Name
          <input type="text" name="name" placeholder="Bleeding" required />
        </label>
        <label>Stacks
          <input type="number" name="stacks" value="1" min="1" />
        </label>
      </div>
      <label>Notes
        <input type="text" name="notes" placeholder="Automation or reminders" />
      </label>
      <button type="submit">Add Status</button>
    </form>
  `;
}

function renderStatusPresetOptions() {
  return (state.reference?.statuses || [])
    .map((status) => `<option value="${status.id}">${status.name}</option>`)
    .join('');
}

function renderCards() {
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No cards tracked for this combatant.</p>';
  } else {
    const { active, inactive } = getPlayerCardBuckets(participant);
    listEl.classList.remove('empty-state');
    listEl.innerHTML = `
      <div class="cards-grid player-card-grid">
        ${renderPlayerCardsList(participant, active, { inactive: false })}
      </div>
      ${renderPlayerInactiveCardsDropdown(participant, inactive)}
    `;
  }
  renderPlayerZones(participant);
  renderPlayerConstructs(participant);
  renderRelics(participant);
  renderInventory(participant);
  wirePlayerCardForm();
  wirePlayerCardImports();
  wirePlayerCardUses(participant);
  wirePlayerCardExports(participant);
  wirePlayerCardActivation(participant);
}

function renderPlayerInactiveCardsDropdown(participant, inactiveEntries = []) {
  const options = inactiveEntries
    .map(({ card, index }) => {
      const effect = formatCardEffectAtMastery(card, participant);
      return `<option value="${index}" data-card-id="${card.id || ''}" data-card-index="${index}">${escapeHtml(
        `${card.name || `Card ${index + 1}`} · AP ${Number(card.apCost || 0)} · ${effect || '—'}`
      )}</option>`;
    })
    .join('');
  return `
    <details class="inactive-cards-dropdown">
      <summary><strong>Inactive Cards (${inactiveEntries.length})</strong></summary>
      <div class="collapsible-body">
        ${
          inactiveEntries.length
            ? `
            <div class="inactive-picker">
              <label>Inactive Card
                <select data-player-inactive-card-select>
                  ${options}
                </select>
              </label>
              <div class="card-actions">
                <button type="button" data-player-activate-selected-card>Activate Card</button>
              </div>
            </div>
          `
            : '<p class="muted">No inactive cards.</p>'
        }
      </div>
    </details>
  `;
}

function renderPlayerCardsList(participant, entries = [], options = {}) {
  if (!entries.length) {
    return `<p class="empty-state">${options.inactive ? 'No inactive cards.' : 'No active cards tracked yet.'}</p>`;
  }
  return entries
    .map(({ card, index }) => {
      const activeActions = `
              <button type="button" data-player-use-card="${card.id}">Use</button>
              <button type="button" data-player-deactivate-card="${card.id}" data-player-card-index="${index}">Deactivate</button>
              <button type="button" data-player-export-card="${card.id}">Export Card</button>`;
      const inactiveActions = `
              <button type="button" data-player-activate-card="${card.id}" data-player-card-index="${index}">Activate</button>
              <button type="button" data-player-export-card="${card.id}">Export Card</button>`;
      const compactEffect = formatCardEffectAtMastery(card, participant);
      return `
          <article class="card-item" data-player-card="${card.id}" data-player-card-index="${index}">
            <details class="card-collapse">
              <summary>
                <div class="card-summary-row">
                  <div class="card-summary-main">
                    <span class="card-summary-ap">AP ${Number(card.apCost || 0)}</span>
                    <span class="card-summary-effect">${escapeHtml(compactEffect || '—')}</span>
                  </div>
                  ${options.inactive ? '' : `<button type="button" class="card-summary-action" data-player-use-card="${card.id}">Use</button>`}
                </div>
              </summary>
              <div class="card-collapse-body">
                <h4>${card.name}</h4>
                <p>• ${card.type || '—'} · ${card.tier || '—'}${options.inactive ? ' · Inactive' : ''}</p>
                ${renderPlayerCardAttributeTable(card, participant)}
                ${renderConstructMetaLine(card, participant)}
                ${renderMasteryLines(card)}
                ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
                ${card.setBonuses ? `<p>Set Bonuses: ${card.setBonuses}</p>` : ''}
                <p>Mastery Level: ${card.masteryLevel || 1} (${card.masteryUses || 0}/${card.masteryThresholds?.level4 || getTierMasteryThresholdDefaults(card.tier).level4} uses)</p>
                <p>Automation: ${summarizeModifiers(card.modifiers || {})}</p>
                ${
                  options.inactive
                    ? ''
                    : renderPlayerCardTargetControl(card, participant)
                }
                <label>Set Mastery
                  <select data-player-card-mastery="${card.id}" data-player-card-index="${index}">
                    <option value="1" ${Number(card.masteryLevel || 1) === 1 ? 'selected' : ''}>Level 1</option>
                    <option value="2" ${Number(card.masteryLevel || 1) === 2 ? 'selected' : ''}>Level 2</option>
                    <option value="3" ${Number(card.masteryLevel || 1) === 3 ? 'selected' : ''}>Level 3</option>
                    <option value="4" ${Number(card.masteryLevel || 1) >= 4 ? 'selected' : ''}>Level 4</option>
                  </select>
                </label>
                <div class="card-actions">
                  ${options.inactive ? inactiveActions : activeActions}
                </div>
              </div>
            </details>
          </article>`;
    })
    .join('');
}

function renderPlayerCardTargetControl(card = {}, participant = {}) {
  const selfOnly = isSelfTargetCard(card);
  const targetMode = getCardTargetMode(card);
  const allowSelfTarget = card.allowSelfTarget !== false;
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const showSecondaryTarget = secondaryDamage > 0 && secondaryTargetMode === 'adjacent';
  const arcaneSplitEnabled =
    playerHasSetBonus(participant, 'Arcane', 5) && !selfOnly && targetMode === 'single';
  const arcaneShiftEnabled =
    playerHasSetBonus(participant, 'Arcane', 3) &&
    (getCardDisplayDamage(card) > 0 || secondaryDamage > 0);
  const arcaneControls = renderPlayerArcaneCardControls(card, participant, {
    splitEnabled: arcaneSplitEnabled,
    shiftEnabled: arcaneShiftEnabled
  });
  const selfId = participant.id || '';
  if (selfOnly || targetMode === 'all_others') {
    const label = targetMode === 'all_others' ? 'All other combatants' : 'Self';
    const value = targetMode === 'all_others' ? '' : selfId;
    return `<label>Target
      <select data-player-card-target="${card.id}" disabled>
        <option value="${value}" selected>${label}</option>
      </select>
    </label>
    ${
      showSecondaryTarget
        ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
      <select data-player-card-secondary-target="${card.id}">
        <option value="">Select target…</option>
        ${renderPlayerTargetOptions(participant.id, false)}
      </select>
    </label>`
        : ''
    }
    ${arcaneControls}`;
  }
  if (targetMode === 'multi_select') {
    return `<label>Targets (up to ${multiTargetCap})
    <select data-player-card-targets="${card.id}" multiple size="${Math.max(3, Math.min(6, multiTargetCap + 1))}">
      ${renderPlayerTargetOptions(participant.id, allowSelfTarget)}
    </select>
  </label>
  ${arcaneControls}`;
  }
  return `<label>Target
    <select data-player-card-target="${card.id}">
      <option value="">Select target…</option>
      ${renderPlayerTargetOptions(participant.id, allowSelfTarget)}
    </select>
  </label>
  ${
    showSecondaryTarget
      ? `<label>${escapeHtml(card.secondaryTargetLabel || 'Secondary Target')}
    <select data-player-card-secondary-target="${card.id}">
      <option value="">Select target…</option>
      ${renderPlayerTargetOptions(participant.id, false)}
    </select>
  </label>`
      : ''
  }
  ${arcaneControls}`;
}

function renderPlayerArcaneCardControls(card = {}, participant = {}, options = {}) {
  const cardId = card.id || '';
  const controls = [];
  if (options.splitEnabled) {
    controls.push(`
      <label>Arcane Split Target
        <select data-player-card-arcane-split-target="${cardId}">
          <option value="">No split</option>
          ${renderPlayerTargetOptions(participant.id, false)}
        </select>
      </label>`);
  }
  if (options.shiftEnabled) {
    controls.push(`
      <label>Arcane Damage Type
        <select data-player-card-override-damage-type="${cardId}">
          <option value="">No change</option>
          ${DAMAGE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
      </label>`);
  }
  if (!controls.length) return '';
  return `<div class="form-row">${controls.join('')}</div>`;
}

function renderPlayerTargetOptions(actorId, includeSelf = false) {
  const options = [];
  if (includeSelf && actorId) {
    options.push(`<option value="${actorId}">Self</option>`);
  }
  for (const entry of state.encounter.participants || []) {
    if (entry.id === actorId) continue;
    options.push(`<option value="${entry.id}">${entry.name}</option>`);
  }
  return options.join('');
}

function renderPlayerCardAttributeTable(card = {}, participant = {}) {
  const rows = [
    ['Set', card.set || '—'],
    ['Type', card.type || '—'],
    ['Tier', card.tier || '—'],
    ['Health Bonus', formatSignedValue(card.healthBonus || 0)],
    ['Shield Bonus', formatSignedValue(card.shieldBonus || 0)],
    ['AP Cost', Number(card.apCost || 0)],
    ['Range', formatCardRange(card)],
    ['Tags', (card.tags || []).join(', ') || '—']
  ];
  const chargesMax = Math.max(0, Math.round(Number(card.chargesMax ?? card.maxCharges ?? card.charges ?? 0) || 0));
  const chargesCurrent = chargesMax > 0
    ? Math.max(0, Math.round(Number(card.chargesCurrent ?? card.remainingCharges ?? chargesMax) || 0))
    : 0;
  if (chargesMax > 0) {
    rows.push(['Charges', `${chargesCurrent}/${chargesMax}`]);
  }
  rows.push(['Effect', formatCardEffectAtMastery(card, participant)]);
  const body = rows
    .map(
      ([label, value]) => `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(String(value ?? '—'))}</td>
      </tr>`
    )
    .join('');
  return `
    <table class="card-attribute-table">
      <thead>
        <tr><th>Attribute</th><th>Description</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderCardEffectLine(card = {}) {
  const effect = String(card.effect || '').trim();
  if (!effect) return '';
  if (isRedundantDamageEffect(card, effect)) return '';
  return `<p>${effect}</p>`;
}

function formatCardRange(card = {}) {
  const text = String(card.rangeText || '').trim();
  if (text) return text;
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const range = getCardScaledValue(card.rangeByLevel, level, Number(card.range || 0));
  return `${range} ft`;
}

function isSelfTargetCard(card = {}) {
  const text = String(card.rangeText || '').trim().toLowerCase();
  if (text === 'self') return true;
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const range = getCardScaledValue(card.rangeByLevel, level, Number(card.range || 0));
  return Number(range || 0) <= 0;
}

function getCardTargetMode(card = {}) {
  const token = String(card.targetMode || '').trim().toLowerCase();
  if (token === 'all_others' || token === 'all-targets') return 'all_others';
  if (token === 'multi' || token === 'multi_select' || token === 'multi_up_to_3' || token === 'up_to_3') {
    return 'multi_select';
  }
  return 'single';
}

function getCardMultiTargetCap(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const fallback = Number.isFinite(Number(card.multiTargetMax))
    ? Math.max(1, Math.round(Number(card.multiTargetMax)))
    : 3;
  const value = getCardScaledValue(card.multiTargetMaxByLevel, level, fallback);
  return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : fallback;
}

function getCardSecondaryTargetMode(card = {}) {
  const token = String(card.secondaryTargetMode || '').trim().toLowerCase();
  if (token === 'same' || token === 'adjacent') return token;
  return '';
}

function getCardSecondaryDamage(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const value = getCardScaledValue(card.secondaryDamageByLevel, level, Number(card.secondaryDamage || 0));
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function resolveStatusName(statusId = '', statusName = '') {
  if (statusName) return statusName;
  const match = (state.reference?.statuses || []).find((entry) => entry.id === statusId);
  return match?.name || statusId || 'Status';
}

function getStatusApplyAtMastery(card = {}, level = 1) {
  const source = card.statusApply;
  if (!source || typeof source !== 'object') return null;
  const id = String(source.id || source.statusId || '').trim();
  const name = resolveStatusName(id, String(source.name || '').trim());
  const stacks = Math.max(
    1,
    Math.round(
      getCardScaledValue(source.stacksByLevel, level, Number(source.stacks ?? source.defaultStacks ?? 1))
    )
  );
  if (!id && !name) return null;
  return { id, name, stacks };
}

function formatCardEffectAtMastery(card = {}, participant = {}) {
  const fallback = String(card.effect || '').trim();
  if (isConstructCard(card)) {
    return fallback || '—';
  }
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const targetMode = getCardTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const parts = [];
  const damage = getCardDisplayDamage(card);
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryType = card.secondaryDamageType || card.damageType || '';
  if (damage > 0) {
    if (targetMode === 'all_others') {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to all targets.`);
    } else if (targetMode === 'multi_select') {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to up to ${multiTargetCap} targets.`);
    } else if (secondaryDamage > 0 && secondaryTargetMode === 'adjacent') {
      parts.push(
        `Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage to target and ${secondaryDamage}${
          secondaryType ? ` ${secondaryType}` : ''
        } damage to adjacent enemy.`
      );
    } else if (secondaryDamage > 0 && secondaryTargetMode === 'same') {
      parts.push(
        `Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage and ${secondaryDamage}${
          secondaryType ? ` ${secondaryType}` : ''
        } damage.`
      );
    } else {
      parts.push(`Deal ${damage}${card.damageType ? ` ${card.damageType}` : ''} damage.`);
    }
  } else if (secondaryDamage > 0) {
    parts.push(`Deal ${secondaryDamage}${secondaryType ? ` ${secondaryType}` : ''} damage.`);
  }
  const shield = Math.max(0, Math.round(getCardScaledValue(card.shieldRestoreByLevel, level, 0)));
  if (shield > 0) {
    parts.push(`Restore ${shield} Shield.`);
  }
  const heal = Math.max(0, Math.round(getCardScaledValue(card.healByLevel, level, Number(card.heal || 0))));
  if (heal > 0) {
    parts.push(`Restore ${heal} HP.`);
  }
  const move = Math.max(0, Math.round(getCardScaledValue(card.movementByLevel, level, 0)));
  if (move > 0) {
    parts.push(`Move ${move} ft.`);
  }
  const pull = Math.max(0, Math.round(getCardScaledValue(card.pullDistanceByLevel, level, 0)));
  if (pull > 0) {
    parts.push(`Pull target ${pull} ft.`);
  }
  const push = Math.max(0, Math.round(getCardScaledValue(card.pushDistanceByLevel, level, 0)));
  if (push > 0) {
    parts.push(`Push target ${push} ft.`);
  }
  const statusApply = getStatusApplyAtMastery(card, level);
  if (statusApply) {
    if (targetMode === 'all_others') {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks} to all targets.`);
    } else if (targetMode === 'multi_select') {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks} to each selected target.`);
    } else {
      parts.push(`Apply ${statusApply.name} ${statusApply.stacks}.`);
    }
  }
  const shieldBonus = Math.max(
    0,
    Math.round(getCardScaledValue(card.bonusDamageIfTargetHasShieldByLevel, level, Number(card.bonusDamageIfTargetHasShield || 0)))
  );
  if (shieldBonus > 0) {
    parts.push(`If target has Shield, deal +${shieldBonus} damage.`);
  }
  const fullyBlockedDirectHp = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.directHpDamageOnFullyBlockedByLevel,
        level,
        Number(card.directHpDamageOnFullyBlocked || 0)
      )
    )
  );
  if (fullyBlockedDirectHp > 0) {
    parts.push(`If Fully Blocked, deal ${fullyBlockedDirectHp} damage directly to HP.`);
  }
  const nextAttackBonus = Math.max(
    0,
    Math.round(getCardScaledValue(card.nextAttackDamageBonusByLevel, level, Number(card.nextAttackDamageBonus || 0)))
  );
  if (nextAttackBonus > 0) {
    parts.push(`Target gains +${nextAttackBonus} damage on their next attack.`);
  }
  const nextTurnAp = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.grantTargetApNextTurnByLevel, level, Number(card.grantTargetApNextTurn || 0))
    )
  );
  if (nextTurnAp > 0) {
    parts.push(`Target gains +${nextTurnAp} AP on their next turn.`);
  }
  const apGainNow = Math.max(
    0,
    Math.round(getCardScaledValue(card.apGainByLevel, level, Number(card.apGain || 0)))
  );
  if (apGainNow > 0) {
    parts.push(`Gain +${apGainNow} AP this turn.`);
  }
  const removeStatusCount = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.removeStatusCountByLevel ?? card.cleanseStatusCountByLevel,
        level,
        Number(card.removeStatusCount ?? card.cleanseStatusCount ?? 0)
      )
    )
  );
  if (removeStatusCount > 0) {
    parts.push(`Remove up to ${removeStatusCount} status effect${removeStatusCount === 1 ? '' : 's'}.`);
  }
  if (parts.length) {
    return parts.join(' ');
  }
  return fallback || '—';
}

function getCardScaledValue(source, level = 1, fallback = 0) {
  if (source == null) return fallback;
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
  if (typeof source === 'number') return Number.isFinite(source) ? source : fallback;
  if (typeof source === 'string') {
    const parsed = Number(source);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof source !== 'object') return fallback;
  const direct = Number(source[parsedLevel]);
  if (Number.isFinite(direct)) return direct;
  const named = Number(source[`level${parsedLevel}`]);
  if (Number.isFinite(named)) return named;
  for (let probe = parsedLevel - 1; probe >= 1; probe -= 1) {
    const lowered = Number(source[probe] ?? source[`level${probe}`]);
    if (Number.isFinite(lowered)) return lowered;
  }
  for (let probe = parsedLevel + 1; probe <= 4; probe += 1) {
    const raised = Number(source[probe] ?? source[`level${probe}`]);
    if (Number.isFinite(raised)) return raised;
  }
  return fallback;
}

function isConstructCard(card = {}) {
  if (card?.isConstruct === false) return false;
  if (card?.isZone === true) return false;
  if (card?.isConstruct === true) return true;
  const tags = Array.isArray(card?.tags) ? card.tags : [];
  return tags.some((tag) => {
    const token = String(tag || '').trim().toLowerCase();
    return token === 'construct' || token === 'turret';
  });
}

function isZoneCard(card = {}, level = 1) {
  if (card?.isZone === true) return true;
  const radius = getCardScaledValue(card.zoneRadiusByLevel, level, Number(card.zoneRadius || 0));
  if (Number(radius || 0) > 0) return true;
  if (Number(card.zoneDurationTurns || 0) > 0) return true;
  return false;
}

function detectConstructMode(card = {}) {
  const explicit = String(card?.constructMode || '').trim().toLowerCase();
  if (explicit === 'damage' || explicit === 'status' || explicit === 'utility') return explicit;
  if (card?.constructStatusId || card?.constructStatusName) return 'status';
  return getCardDisplayDamage(card) > 0 ? 'damage' : 'utility';
}

function getConstructSetBonus(participant = {}) {
  const summary = participant?.derivedBonuses?.machineConstructs || {};
  const damageBonus = Number(summary.damageBonus || 0);
  const durationBonusTurns = Number(summary.durationBonusTurns || 0);
  return {
    damageBonus: Number.isFinite(damageBonus) ? Math.max(0, Math.round(damageBonus)) : 0,
    durationBonusTurns: Number.isFinite(durationBonusTurns) ? Math.max(0, Math.round(durationBonusTurns)) : 0
  };
}

function renderCardDamageLine(card = {}, participant = {}) {
  const baseDamage = getCardDisplayDamage(card);
  const secondaryDamage = getCardSecondaryDamage(card);
  const secondaryType = card.secondaryDamageType || card.damageType || '';
  const secondaryTargetMode = getCardSecondaryTargetMode(card);
  const targetMode = getCardTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card) : 0;
  const typeText = card.damageType || '';
  if (!isConstructCard(card)) {
    if (baseDamage > 0 && secondaryDamage > 0 && secondaryTargetMode === 'adjacent') {
      return `<p>Damage: ${baseDamage} ${typeText} (target) + ${secondaryDamage} ${secondaryType} (adjacent)</p>`;
    }
    if (baseDamage > 0 && secondaryDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} + ${secondaryDamage} ${secondaryType}</p>`;
    }
    if (targetMode === 'all_others' && baseDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} (all targets)</p>`;
    }
    if (targetMode === 'multi_select' && baseDamage > 0) {
      return `<p>Damage: ${baseDamage} ${typeText} (up to ${multiTargetCap} targets)</p>`;
    }
    if (secondaryDamage > 0) {
      return `<p>Damage: ${secondaryDamage} ${secondaryType}</p>`;
    }
    return `<p>Damage: ${baseDamage} ${typeText}</p>`;
  }
  const mode = detectConstructMode(card);
  const constructBonus = getConstructSetBonus(participant).damageBonus;
  if (mode === 'utility') {
    return '<p>Damage: —</p>';
  }
  if (mode === 'status') {
    return `<p>Damage: ${constructBonus > 0 ? `+${constructBonus} Force` : '—'}</p>`;
  }
  if (!constructBonus) {
    return `<p>Damage: ${baseDamage} ${typeText}</p>`;
  }
  const boosted = Math.max(0, baseDamage + constructBonus);
  return `<p>Damage: ${baseDamage} ${typeText} <span class="muted">(Construct +${constructBonus} => ${boosted})</span></p>`;
}

function renderConstructMetaLine(card = {}, participant = {}) {
  if (!isConstructCard(card)) return '';
  const mode = detectConstructMode(card);
  const baseDuration = Math.max(0, Math.round(Number(card.constructDurationTurns ?? 1) || 0));
  const durationBonus = getConstructSetBonus(participant).durationBonusTurns;
  const effective = baseDuration > 0 ? Math.max(1, baseDuration + durationBonus) : 0;
  const detail = durationBonus ? `${baseDuration} (+${durationBonus})` : `${baseDuration}`;
  const statusId = String(card.constructStatusId || '').trim();
  const statusName = String(card.constructStatusName || '').trim();
  const statusLabel = statusName || statusId;
  const stacks = Math.max(1, Number(card.constructStatusStacks || 1));
  const constructAp = Math.max(0, Math.round(Number(card.constructAp ?? 2) || 0));
  const constructHp = Math.max(
    1,
    Math.round(
      Number(
        getCardScaledValue(
          card.constructMaxHpByLevel,
          Number(card.masteryLevel || 1),
          Number(card.constructMaxHp ?? 1)
        )
      ) || 1
    )
  );
  const constructCards = Array.isArray(card.constructCards)
    ? card.constructCards
    : String(card.constructLinkedCard || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const modeText = mode === 'status'
    ? `Status: ${statusLabel || 'Unknown'} x${stacks}`
    : mode === 'utility'
      ? (() => {
          const shieldRestore = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructShieldRestoreByLevel, Number(card.masteryLevel || 1), Number(card.constructShieldRestore || 0))
            )
          );
          const auraRadiusFt = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructAuraRadiusByLevel, Number(card.masteryLevel || 1), Number(card.constructAuraRadiusFt || 0))
            )
          );
          const visionRangeFt = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructVisionRangeByLevel, Number(card.masteryLevel || 1), Number(card.constructVisionRangeFt || 0))
            )
          );
          const utilityKind = String(card.constructUtilityKind || '').trim().toLowerCase();
          const heal = Math.max(
            0,
            Math.round(
              getCardScaledValue(card.constructHealByLevel, Number(card.masteryLevel || 1), Number(card.constructHeal || 0))
            )
          );
          if (shieldRestore > 0) {
            const targetLabel = card.constructShieldRestoreAlliesOnly === true ? 'allies' : 'self';
            const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
            return `Utility: restore ${shieldRestore} Shield to ${targetLabel}${auraText}`;
          }
          if (heal > 0) {
            const targetLabel = card.constructHealTargetOnly === true
              ? 'target'
              : card.constructHealAlliesOnly === true
                ? 'allies'
                : 'self';
            const triggerText = card.constructTriggerOnTargetTurn === true ? ' on target turn' : '';
            return `Utility: restore ${heal} HP to ${targetLabel}${triggerText}`;
          }
          if (utilityKind === 'scout') {
            return visionRangeFt > 0 ? `Scout utility (${visionRangeFt} ft vision)` : 'Scout utility';
          }
          if (utilityKind === 'factory') {
            return 'Factory utility';
          }
          return 'Utility construct';
        })()
      : 'Damage construct';
  const durationText = effective > 0
    ? `Duration ${detail} turn${effective === 1 ? '' : 's'} (effective ${effective})`
    : 'Duration until removed';
  return `<p>Construct: ${modeText} • ${durationText} • HP ${constructHp} • AP ${constructAp}${constructCards.length ? ` • Cards: ${constructCards.join(', ')}` : ''}</p>`;
}

function renderPlayerZones(participant) {
  const listEl = document.getElementById('playerZoneList');
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view zones.</p>';
    return;
  }
  const zones = participant.zones || [];
  if (!zones.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No active zones.</p>';
    return;
  }
  listEl.classList.remove('empty-state');
  listEl.innerHTML = `
    <div class="cards-grid construct-grid">
      ${zones
        .map((zone) => {
          const assigned = Array.isArray(zone.targetIds) ? zone.targetIds : [];
          const targets = assigned
            .map((targetId) => (state.encounter.participants || []).find((entry) => entry.id === targetId))
            .filter(Boolean);
          const targetNames = targets.map((entry) => entry.name);
          const targetPills = targets
            .map(
              (target) => `
                <span class="status-pill">
                  ${escapeHtml(target.name)}
                  <button type="button" data-player-zone-remove-target="${zone.id || ''}" data-player-zone-target-id="${target.id}">Remove</button>
                </span>`
            )
            .join('');
          const options = (state.encounter.participants || [])
            .filter((entry) => !assigned.includes(entry.id))
            .map((entry) => `<option value="${entry.id}">${escapeHtml(entry.name)}</option>`)
            .join('');
          const remaining =
            Number(zone.remainingTurns || 0) > 0
              ? ` · ${zone.remainingTurns} turn${zone.remainingTurns === 1 ? '' : 's'} left`
              : '';
          const enterDamage = Math.max(0, Number(zone.enterDamage || 0));
          const enterStatusName = String(zone.enterStatusName || zone.enterStatusId || '').trim();
          const enterStatusStacks = Math.max(1, Number(zone.enterStatusStacks || 1));
          const triggerMode = String(zone.triggerMode || '').trim().replace(/_/g, ' ');
          const triggerParts = [];
          if (zone.triggerOnTargetAdd) {
            if (enterDamage > 0) {
              triggerParts.push(`Trigger: ${enterDamage} ${escapeHtml(zone.enterDamageType || zone.damageType || 'damage')}`);
            }
            if (enterStatusName) {
              triggerParts.push(`Trigger: ${escapeHtml(enterStatusName)} ${enterStatusStacks}`);
            }
            if (triggerMode) {
              triggerParts.push(`Mode: ${escapeHtml(triggerMode)}`);
            }
            if (zone.consumeOnTrigger) {
              triggerParts.push('Single-use trigger');
            }
          }
          if (Number(zone.detectDc || 0) > 0) {
            triggerParts.push(`Detect DC ${Number(zone.detectDc)}`);
          }
          const triggerText = triggerParts.length
            ? `<p class="muted small-note">${triggerParts.join(' · ')}</p>`
            : '';
          const sustainParts = [];
          if (Number(zone.shieldRestore || 0) > 0) {
            sustainParts.push(
              `Restore ${Number(zone.shieldRestore)} Shield${zone.shieldRestoreAlliesOnly !== false ? ' (allies)' : ''}`
            );
          }
          if (Number(zone.heal || 0) > 0) {
            sustainParts.push(`Restore ${Number(zone.heal)} HP${zone.healAlliesOnly !== false ? ' (allies)' : ''}`);
          }
          const sustainText = sustainParts.length
            ? `<p class="muted small-note">${sustainParts.join(' · ')}</p>`
            : '';
          return `
            <article class="card-item construct-item">
              <h4>${escapeHtml(zone.name || 'Zone')}</h4>
              <p>${Number(zone.damage || 0)} ${escapeHtml(zone.damageType || 'damage')} · ${Number(zone.radiusFt || 0)} ft radius${remaining}</p>
              ${triggerText}
              ${sustainText}
              <p class="muted small-note">Currently in zone: ${targetNames.length ? escapeHtml(targetNames.join(', ')) : 'No targets assigned'}</p>
              <div class="status-list">
                ${targetPills || '<span class="muted">No targets assigned.</span>'}
              </div>
              <div class="form-row">
                <label>Add Target
                  <select data-player-zone-add-target="${zone.id || ''}">
                    <option value="">Select target…</option>
                    ${options}
                  </select>
                </label>
                <button type="button" data-player-zone-add-target-button="${zone.id || ''}">Add</button>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

function isRedundantDamageEffect(card = {}, effectText = '') {
  const normalized = effectText.toLowerCase().replace(/\s+/g, ' ').trim();
  const plainDamagePattern = /^deal\s+\d*\s*[a-z]+\s+damage\.?$/;
  if (!plainDamagePattern.test(normalized)) return false;
  const damageType = String(card.damageType || '').toLowerCase().trim();
  if (!damageType) return false;
  return normalized.includes(damageType);
}

function renderMasteryLines(card = {}) {
  const lines = Array.isArray(card.mastery) ? card.mastery : [];
  if (!lines.length) return '';
  const items = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('');
  if (!items) return '';
  return `
    <div class="mastery-block">
      <strong>Mastery</strong>
      <ul class="mastery-list">${items}</ul>
    </div>
  `;
}

function getCardDisplayDamage(card = {}) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const byLevel = card.masteryDamageByLevel || {};
  const base = Number(card.damage || 0);
  const levelDamage = Number(
    byLevel[level] ??
      byLevel[`level${level}`] ??
      (level >= 4
        ? byLevel[4] ?? byLevel.level4
        : level >= 3
          ? byLevel[3] ?? byLevel.level3
          : level >= 2
            ? byLevel[2] ?? byLevel.level2
            : byLevel[1] ?? byLevel.level1) ??
      base
  );
  return Number.isFinite(levelDamage) ? Math.max(0, Math.round(levelDamage)) : Math.max(0, Math.round(base));
}

function wirePlayerCardExports(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-export-card]').forEach((button) => {
    button.onclick = () => {
      const cards = participant?.cards || [];
      const card = cards.find((entry) => entry.id === button.dataset.playerExportCard);
      if (!card) {
        notify('Card not found.');
        return;
      }
      downloadJson(card, `${slugify(participant?.name || 'card')}-${slugify(card.name)}.json`);
    };
  });
}

function wirePlayerCardUses(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-use-card]').forEach((button) => {
    button.onclick = async (event) => {
      if (button.closest('summary')) {
        event.preventDefault();
        event.stopPropagation();
      }
      const cardId = button.dataset.playerUseCard;
      if (!cardId) return;
      const article = button.closest('.card-item');
      const targetId = article?.querySelector(`[data-player-card-target="${cardId}"]`)?.value || '';
      const targetIds = Array.from(
        article?.querySelector(`[data-player-card-targets="${cardId}"]`)?.selectedOptions || []
      ).map((option) => option.value);
      const secondaryTargetId = article?.querySelector(`[data-player-card-secondary-target="${cardId}"]`)?.value || '';
      const arcaneSplitTargetId = article?.querySelector(`[data-player-card-arcane-split-target="${cardId}"]`)?.value || '';
      const overrideDamageType = article?.querySelector(`[data-player-card-override-damage-type="${cardId}"]`)?.value || '';
      try {
        await api('/api/actions/card', 'POST', {
          participantId: participant.id,
          cardId,
          targetId,
          targetIds,
          secondaryTargetId,
          arcaneSplitTargetId,
          overrideDamageType
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-card-mastery]').forEach((select) => {
    select.onchange = async () => {
      const cardId = select.dataset.playerCardMastery;
      const fallbackIndex = Number(select.dataset.playerCardIndex);
      const level = Number(select.value || 1);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = applyManualMastery(cards[idx], level);
      await patchParticipant(participant.id, { cards });
      fetchState();
    };
  });
}

function wirePlayerCardActivation(participant) {
  if (!participant) return;
  const listEl = document.getElementById('playerCardList');
  if (!listEl) return;
  listEl.querySelectorAll('[data-player-deactivate-card]').forEach((button) => {
    button.onclick = async () => {
      const cardId = button.dataset.playerDeactivateCard;
      const fallbackIndex = Number(button.dataset.playerCardIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = { ...cards[idx], active: false };
      await patchParticipant(participant.id, { cards });
      fetchState();
    };
  });
  listEl.querySelectorAll('[data-player-activate-card]').forEach((button) => {
    button.onclick = async () => {
      const cardId = button.dataset.playerActivateCard;
      const fallbackIndex = Number(button.dataset.playerCardIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const cards = [...(latest?.cards || participant.cards || [])];
      const activeCount = cards.filter((entry) => isCardActive(entry)).length;
      if (activeCount >= MAX_ACTIVE_CARDS) {
        notify(`Deactivate a card first. Max ${MAX_ACTIVE_CARDS} active cards.`);
        return;
      }
      let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= cards.length) return;
      cards[idx] = { ...cards[idx], active: true };
      await patchParticipant(participant.id, { cards });
      fetchState();
    };
  });
  listEl.querySelector('[data-player-activate-selected-card]')?.addEventListener('click', async () => {
    const select = listEl.querySelector('[data-player-inactive-card-select]');
    const option = select?.selectedOptions?.[0];
    if (!option) {
      notify('Choose an inactive card first.');
      return;
    }
    const cardId = option.dataset.cardId || '';
    const fallbackIndex = Number(option.dataset.cardIndex);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const cards = [...(latest?.cards || participant.cards || [])];
    const activeCount = cards.filter((entry) => isCardActive(entry)).length;
    if (activeCount >= MAX_ACTIVE_CARDS) {
      notify(`Deactivate a card first. Max ${MAX_ACTIVE_CARDS} active cards.`);
      return;
    }
    let idx = cards.findIndex((entry) => cardId && entry.id === cardId);
    if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
    if (idx < 0 || idx >= cards.length) return;
    cards[idx] = { ...cards[idx], active: true };
    await patchParticipant(participant.id, { cards });
    notify(`${cards[idx].name || 'Card'} activated.`);
    fetchState();
  });
}

function renderPlayerConstructs(participant) {
  const listEl = document.getElementById('playerConstructList');
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view constructs.</p>';
    return;
  }
  const constructs = participant.constructs || [];
  const summary = participant.derivedBonuses?.machineConstructs || {};
  const cap = Number(summary.maxActive || 1);
  if (!constructs.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = `<p class="empty-state">No active constructs (0/${cap}).</p>`;
    return;
  }
  listEl.classList.remove('empty-state');
  listEl.innerHTML = `
    <p class="muted small-note">Active ${constructs.length}/${cap} • Bonus +${summary.damageBonus || 0} damage, +${summary.durationBonusTurns || 0} duration.</p>
    <div class="cards-grid construct-grid">
      ${constructs
        .map(
          (construct) => `
            <article class="card-item construct-item">
              <h4>${escapeHtml(construct.name || 'Construct')}</h4>
              <p>${escapeHtml(renderConstructCardSummary(construct))}</p>
              <p>${
                Number(construct.remainingTurns || 0) > 0
                  ? `Turns Remaining: ${Number(construct.remainingTurns || 0)}`
                  : 'Duration: Until removed'
              }</p>
              <p>HP: ${Number(construct.hp || 0)}/${Number(construct.maxHp || 0)} • AP: ${Number(construct.apCurrent || 0)}/${Number(construct.apMax || 0)}</p>
              <p>Cards: ${escapeHtml((Array.isArray(construct.cards) && construct.cards.length ? construct.cards.join(', ') : '—'))}</p>
              <label>Target
                <select data-player-construct-target="${construct.id || ''}">
                  <option value="">Select target…</option>
                  ${(state.encounter.participants || [])
                    .filter((entry) => entry.id !== participant.id)
                    .map(
                      (entry) =>
                        `<option value="${entry.id}" ${entry.id === construct.targetId ? 'selected' : ''}>${entry.name}</option>`
                    )
                    .join('')}
                </select>
              </label>
              <div class="card-actions">
                <button type="button" data-player-construct-move="${construct.id || ''}" ${Number(construct.apCurrent || 0) < 1 ? 'disabled' : ''}>Move ${Number(construct.moveFt || 10)} ft (1 AP)</button>
                <button type="button" data-player-remove-construct="${construct.id || ''}">Remove</button>
              </div>
            </article>`
        )
        .join('')}
    </div>
  `;
  listEl.querySelectorAll('[data-player-construct-target]').forEach((select) => {
    select.onchange = async () => {
      const constructId = select.dataset.playerConstructTarget;
      const targetId = select.value || '';
      if (!constructId || !targetId) return;
      try {
        await api('/api/constructs/target', 'POST', {
          participantId: participant.id,
          constructId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-remove-construct]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerRemoveConstruct;
      if (!constructId) return;
      try {
        await api('/api/constructs/remove', 'POST', {
          participantId: participant.id,
          constructId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  listEl.querySelectorAll('[data-player-construct-move]').forEach((button) => {
    button.onclick = async () => {
      const constructId = button.dataset.playerConstructMove;
      if (!constructId) return;
      try {
        await api('/api/constructs/move', 'POST', {
          participantId: participant.id,
          constructId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
}

function renderConstructCardSummary(construct = {}) {
  const mode = String(construct.mode || '').toLowerCase();
  if (mode === 'status') {
    const statusLabel = construct.statusName || construct.statusId || 'Status';
    const stacks = Math.max(1, Number(construct.statusStacks || 1));
    const force = Number(construct.damage || 0);
    return force > 0
      ? `Applies ${statusLabel} x${stacks} + ${force} Force`
      : `Applies ${statusLabel} x${stacks}`;
  }
  if (mode === 'utility') {
    const shieldRestore = Math.max(0, Number(construct.shieldRestore || 0));
    const heal = Math.max(0, Number(construct.heal || 0));
    const auraRadiusFt = Math.max(0, Number(construct.auraRadiusFt || 0));
    const utilityKind = String(construct.utilityKind || '').trim().toLowerCase();
    const visionRangeFt = Math.max(0, Number(construct.visionRangeFt || 0));
    const detectDc = Math.max(0, Number(construct.detectDc || 0));
    if (shieldRestore > 0) {
      const targetLabel = construct.shieldRestoreAlliesOnly ? 'allies' : 'self';
      const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
      return `Utility: restore ${shieldRestore} Shield to ${targetLabel}${auraText}`;
    }
    if (heal > 0) {
      const targetLabel = construct.healTargetOnly
        ? 'target'
        : construct.healAlliesOnly
          ? 'allies'
          : 'self';
      const triggerText = construct.triggerOnTargetTurn ? ' on target turn' : '';
      return `Utility: restore ${heal} HP to ${targetLabel}${triggerText}`;
    }
    if (utilityKind === 'scout') {
      const details = [];
      if (visionRangeFt > 0) details.push(`vision ${visionRangeFt} ft`);
      if (detectDc > 0) details.push(`detect DC ${detectDc}`);
      if (construct.utilityNote) details.push(String(construct.utilityNote));
      return details.length ? `Scout utility (${details.join(', ')})` : 'Scout utility';
    }
    if (utilityKind === 'factory') {
      return construct.utilityNote
        ? `Factory utility (${String(construct.utilityNote)})`
        : 'Factory utility';
    }
    return 'Utility construct';
  }
  return `Damage: ${Number(construct.damage || 0)} ${construct.damageType || ''}`.trim();
}

function renderRelics(participant) {
  const listEl = document.getElementById('playerRelicList');
  const formEl = document.getElementById('playerRelicForm');
  const importInput = document.getElementById('playerImportRelic');
  if (importInput) {
    importInput.onchange = handlePlayerRelicFile;
  }
  if (!listEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view relics.</p>';
    if (formEl) {
      formEl.onsubmit = null;
    }
    return;
  }
  const relics = participant?.relics || [];
  if (!relics.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No relics tracked.</p>';
  } else {
    listEl.classList.remove('empty-state');
    listEl.innerHTML = relics
      .map(
        (relic, index) => `
          <article class="relic-card">
            <h4>${relic.name}</h4>
            <p>HP ${relic.hp ?? 0} · AP ${relic.ap ?? 0} · Focus: ${relic.ability || '—'}</p>
            <p>${relic.description || ''}</p>
            <button type="button" data-remove-relic="${index}">Remove</button>
          </article>`
      )
      .join('');
  }
  listEl.querySelectorAll('[data-remove-relic]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.removeRelic);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentRelics = latest?.relics || relics;
      const updated = currentRelics.filter((_, idx) => idx !== index);
      await patchParticipant(participant.id, { relics: updated });
      fetchState();
    };
  });
  if (formEl) {
    formEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(formEl);
      const newRelic = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name: data.get('name'),
        hp: Number(data.get('hp') || 0),
        ap: Number(data.get('ap') || 0),
        ability: data.get('ability') || '',
        description: data.get('description') || ''
      };
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentRelics = latest?.relics || relics;
      await patchParticipant(participant.id, { relics: [...currentRelics, newRelic] });
      formEl.reset();
      fetchState();
    };
  }
}

function renderInventory(participant) {
  const listEl = document.getElementById('playerInventoryList');
  const formEl = document.getElementById('playerInventoryForm');
  const currencyListEl = document.getElementById('playerCurrencyList');
  const currencyFormEl = document.getElementById('playerCurrencyForm');
  if (!listEl || !currencyListEl) return;
  if (!participant) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">Select a combatant to view inventory.</p>';
    currencyListEl.classList.add('empty-state');
    currencyListEl.innerHTML = '<p class="empty-state">Select a combatant to view currencies.</p>';
    if (formEl) formEl.onsubmit = null;
    if (currencyFormEl) currencyFormEl.onsubmit = null;
    return;
  }
  const items = participant?.inventory || [];
  const currencies = participant?.currencies || [];
  if (!items.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No inventory items yet.</p>';
  } else {
    listEl.classList.remove('empty-state');
    listEl.innerHTML = items
      .map(
        (item, index) => `
          <article class="relic-card">
            <h4>${escapeHtml(item.name || `Item ${index + 1}`)}</h4>
            <p>Qty ${Number(item.quantity || 1)}</p>
            ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
            ${(item.tags || []).length ? `<p>Tags: ${escapeHtml((item.tags || []).join(', '))}</p>` : ''}
            <button type="button" data-remove-inventory="${item.id || ''}" data-inventory-index="${index}">Remove</button>
          </article>`
      )
      .join('');
  }
  if (!currencies.length) {
    currencyListEl.classList.add('empty-state');
    currencyListEl.innerHTML = '<p class="empty-state">No currencies yet.</p>';
  } else {
    currencyListEl.classList.remove('empty-state');
    currencyListEl.innerHTML = currencies
      .map(
        (currency, index) => `
          <article class="currency-tab">
            <div class="currency-tab-header">
              <strong>${escapeHtml(currency.name || `Currency ${index + 1}`)}</strong>
              <span>${Number(currency.amount || 0)}</span>
            </div>
            <div class="currency-tab-controls">
              <input type="number" min="1" step="1" value="1" data-player-currency-input="${currency.id || ''}" data-player-currency-index="${index}" />
              <button type="button" data-player-currency-adjust="add" data-player-currency-id="${currency.id || ''}" data-player-currency-index="${index}">Add</button>
              <button type="button" data-player-currency-adjust="remove" data-player-currency-id="${currency.id || ''}" data-player-currency-index="${index}">Remove</button>
              <button type="button" data-player-remove-currency="${currency.id || ''}" data-player-currency-index="${index}">Delete</button>
            </div>
          </article>`
      )
      .join('');
  }
  listEl.querySelectorAll('[data-remove-inventory]').forEach((button) => {
    button.onclick = async () => {
      const itemId = button.dataset.removeInventory;
      const fallbackIndex = Number(button.dataset.inventoryIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const inventory = [...(latest?.inventory || participant.inventory || [])];
      let idx = inventory.findIndex((item) => itemId && item.id === itemId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= inventory.length) return;
      inventory.splice(idx, 1);
      await patchParticipant(participant.id, { inventory });
      fetchState();
    };
  });
  currencyListEl.querySelectorAll('[data-player-currency-adjust]').forEach((button) => {
    button.onclick = async () => {
      const direction = button.dataset.playerCurrencyAdjust === 'remove' ? -1 : 1;
      const currencyId = button.dataset.playerCurrencyId;
      const fallbackIndex = Number(button.dataset.playerCurrencyIndex);
      const amountInput = button
        .closest('.currency-tab')
        ?.querySelector('[data-player-currency-input]');
      const step = Math.max(1, Math.round(Number(amountInput?.value || 1)));
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      let idx = currencies.findIndex((entry) => currencyId && entry.id === currencyId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= currencies.length) return;
      const current = Math.max(0, Number(currencies[idx].amount || 0));
      const next = direction > 0 ? current + step : Math.max(0, current - step);
      currencies[idx] = { ...currencies[idx], amount: next };
      await patchParticipant(participant.id, { currencies });
      fetchState();
    };
  });
  currencyListEl.querySelectorAll('[data-player-remove-currency]').forEach((button) => {
    button.onclick = async () => {
      const currencyId = button.dataset.playerRemoveCurrency;
      const fallbackIndex = Number(button.dataset.playerCurrencyIndex);
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      let idx = currencies.findIndex((entry) => currencyId && entry.id === currencyId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= currencies.length) return;
      currencies.splice(idx, 1);
      await patchParticipant(participant.id, { currencies });
      fetchState();
    };
  });
  if (formEl) {
    formEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(formEl);
      const name = String(data.get('name') || '').trim();
      if (!name) {
        notify('Item name is required.');
        return;
      }
      const newItem = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        name,
        quantity: Math.max(1, Number(data.get('quantity') || 1)),
        description: String(data.get('description') || '').trim(),
        tags: String(data.get('tags') || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      };
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currentInventory = latest?.inventory || participant.inventory || [];
      await patchParticipant(participant.id, { inventory: [...currentInventory, newItem] });
      formEl.reset();
      formEl.classList.add('hidden');
      fetchState();
    };
  }
  if (currencyFormEl) {
    currencyFormEl.onsubmit = async (event) => {
      event.preventDefault();
      const data = new FormData(currencyFormEl);
      const name = String(data.get('name') || '').trim();
      if (!name) {
        notify('Currency name is required.');
        return;
      }
      const amount = Math.max(0, Math.round(Number(data.get('amount') || 0)));
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const currencies = [...(latest?.currencies || participant.currencies || [])];
      const existingIndex = currencies.findIndex(
        (entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase()
      );
      if (existingIndex >= 0) {
        const current = Math.max(0, Number(currencies[existingIndex].amount || 0));
        currencies[existingIndex] = {
          ...currencies[existingIndex],
          amount: current + amount
        };
      } else {
        currencies.push({
          id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
          name,
          amount
        });
      }
      await patchParticipant(participant.id, { currencies });
      currencyFormEl.reset();
      currencyFormEl.classList.add('hidden');
      notify(existingIndex >= 0 ? `${name} updated.` : `${name} added.`);
      fetchState();
    };
  }
}

function renderLog() {
  const participant = getFocusedParticipant();
  if (!participant) {
    els.logList.innerHTML = createMode
      ? '<p class="empty-state">Create a character to start tracking actions.</p>'
      : '<p class="empty-state">No log entries.</p>';
    return;
  }
  const relevant = (state.encounter.log || []).filter((entry) => entry.participantId === participant.id);
  if (!relevant.length) {
    els.logList.innerHTML = '<p class="empty-state">No actions logged for this combatant yet.</p>';
    return;
  }
  els.logList.innerHTML = relevant
    .slice(-15)
    .reverse()
    .map(
      (entry) => `
        <div class="log-entry">
          <time>${new Date(entry.at).toLocaleTimeString()}</time>
          <div>${entry.text}</div>
        </div>`
    )
    .join('');
}

function renderTurnInfo() {
  const currentEntry = getCurrentTurnEntry();
  if (!currentEntry) {
    els.turnInfo.textContent = 'No turn active.';
    return;
  }
  if (currentEntry.kind === 'zone') {
    const owner = currentEntry.participant;
    const zone = currentEntry.zone;
    const isFocused = owner?.id && owner.id === focusId;
    els.turnInfo.innerHTML = isFocused
      ? `<strong>Your zone effect turn:</strong> ${escapeHtml(zone?.name || 'Zone')}`
      : `Current turn: ${escapeHtml(owner?.name || 'Combatant')} zone (${escapeHtml(zone?.name || 'Zone')})`;
    return;
  }
  const current = currentEntry.participant;
  if (!current) {
    els.turnInfo.textContent = 'No turn active.';
    return;
  }
  const isTurn = focusId && current.id === focusId;
  els.turnInfo.innerHTML = isTurn
    ? `<strong>Your turn!</strong> Spend ${current.apCurrent} of ${current.apMax} AP.`
    : `Current turn: ${current.name}`;
}

function renderStatuses(participant) {
  const statuses = participant.statuses || [];
  if (!statuses.length) {
    return '<span class="muted">None</span>';
  }
  return statuses
    .map(
      (status, index) => {
        const key = status.id || `index-${index}`;
        return `
        <span class="status-pill">
          ${status.name}${status.stacks ? ` ×${status.stacks}` : ''}
          ${status.notes ? `<small>${status.notes}</small>` : ''}
          <button type="button" data-player-status-stack="${key}" data-player-status-index="${index}" data-player-status-delta="-1">-</button>
          <button type="button" data-player-status-stack="${key}" data-player-status-index="${index}" data-player-status-delta="1">+</button>
          <button type="button" data-player-remove-status="${key}" data-player-status-index="${index}">✕</button>
        </span>`;
      })
    .join('');
}

function summarizeModifiers(modifiers = {}) {
  const labels = {
    maxHp: 'HP',
    maxShield: 'Shield',
    apMax: 'AP',
    guardRestore: 'Guard',
    damageBonus: 'Damage'
  };
  const summary = Object.entries(labels)
    .map(([key, label]) => {
      const value = modifiers[key] || 0;
      if (!value) return null;
      return `${label} ${value > 0 ? '+' : ''}${value}`;
    })
    .filter(Boolean)
    .join(', ');
  return summary || '—';
}

function getPlayerManageState(participantId) {
  const snapshot = participantId ? playerManageState.get(participantId) : null;
  return {
    mitigation: Boolean(snapshot?.mitigation),
    abilities: Boolean(snapshot?.abilities)
  };
}

function togglePlayerManageState(participantId, key) {
  if (!participantId || !key) return;
  const current = getPlayerManageState(participantId);
  playerManageState.set(participantId, {
    ...current,
    [key]: !current[key]
  });
}

function wirePlayerSheetEvents(participant) {
  const panel = els.stats;
  panel.querySelector('[data-player-team-select]')?.addEventListener('change', async (event) => {
    const team = String(event.currentTarget.value || '').trim();
    await patchParticipant(participant.id, { team });
    fetchState();
  });
  panel.querySelectorAll('[data-player-standard]').forEach((button) => {
    button.onclick = () => handlePlayerStandardAction(button.dataset.playerStandard);
  });
  panel.querySelectorAll('[data-player-activate-set]').forEach((button) => {
    button.onclick = async () => {
      if (button.disabled) return;
      try {
        const activation = buildPlayerSetActivationPayload(participant, button.dataset.playerActivateSet);
        if (!activation) return;
        await api('/api/set/activate', 'POST', activation);
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-set-ally-add-button]').forEach((button) => {
    button.onclick = async () => {
      const select = panel.querySelector('[data-player-set-ally-add]');
      const targetId = select?.value || '';
      if (!targetId) return;
      try {
        await api('/api/set/allies/add', 'POST', {
          participantId: participant.id,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-set-ally-remove]').forEach((button) => {
    button.onclick = async () => {
      const targetId = button.dataset.playerSetAllyRemove;
      if (!targetId) return;
      try {
        await api('/api/set/allies/remove', 'POST', {
          participantId: participant.id,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-inline-adjust]').forEach((button) => {
    button.onclick = () => {
      const delta = Number(button.dataset.delta || 0);
      handleStatAdjustment(button.dataset.inlineAdjust, delta);
    };
  });
  panel.querySelectorAll('[data-inline-set]').forEach((button) => {
    button.onclick = () => {
      const field = button.dataset.inlineSet;
      const input = panel.querySelector(`[data-inline-input="${field}"]`);
      const value = Number(input?.value);
      if (!Number.isFinite(value)) {
        notify('Enter a value before setting the stat.');
        return;
      }
      handleStatSet(field, value);
      if (input) input.value = '';
    };
  });
  panel.querySelectorAll('[data-ability-input]').forEach((input) => {
    input.onchange = async () => {
      const ability = input.dataset.abilityInput;
      const value = Number(input.value || 0);
      participant.stats = participant.stats || {};
      participant.stats[ability] = value;
      await patchParticipant(participant.id, { stats: { [ability]: value } });
      fetchState();
    };
  });
  const profInput = panel.querySelector('[data-proficiency-input]');
  if (profInput) {
    profInput.onchange = async () => {
      const value = Number(profInput.value || 0);
      participant.proficiencyBonus = value;
      await patchParticipant(participant.id, { proficiencyBonus: value });
      fetchState();
    };
  }
  panel.querySelectorAll('[data-save-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      const saves = getSavingThrowsSnapshot(participant);
      saves[checkbox.dataset.saveToggle] = checkbox.checked;
      await patchParticipant(participant.id, {
        savingThrows: saves
      });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-skill-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      const skill = checkbox.dataset.skillToggle;
      const type = checkbox.dataset.toggleType;
      const skills = getSkillsSnapshot(participant);
      const current = skills[skill] || getSkillState(participant, skill);
      const next = {
        proficient: type === 'proficient' ? checkbox.checked : current.proficient,
        expert: type === 'expert' ? checkbox.checked : current.expert
      };
      if (next.expert && !next.proficient) {
        next.proficient = true;
      }
      skills[skill] = next;
      await patchParticipant(participant.id, { skills });
      fetchState();
    };
  });

  panel.querySelector('[data-player-toggle-mitigation-manage]')?.addEventListener('click', () => {
    togglePlayerManageState(participant.id, 'mitigation');
    render();
  });
  panel.querySelector('[data-player-toggle-ability-manage]')?.addEventListener('click', () => {
    togglePlayerManageState(participant.id, 'abilities');
    render();
  });

  panel.querySelector('[data-resistance-form]')?.addEventListener('submit', (event) =>
    handlePlayerDamageForm(event, participant, 'resistances', 'resistance')
  );
  panel.querySelectorAll('[data-player-remove-resistance]').forEach((button) => {
    button.onclick = () =>
      handlePlayerDamageRemove(participant, 'resistances', Number(button.dataset.playerRemoveResistance));
  });
  panel.querySelector('[data-vulnerability-form]')?.addEventListener('submit', (event) =>
    handlePlayerDamageForm(event, participant, 'vulnerabilities', 'vulnerability')
  );
  panel.querySelectorAll('[data-player-remove-vulnerability]').forEach((button) => {
    button.onclick = () =>
      handlePlayerDamageRemove(participant, 'vulnerabilities', Number(button.dataset.playerRemoveVulnerability));
  });

  const abilityForm = panel.querySelector('[data-player-ability-form]');
  abilityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const description = String(formData.get('description') || '').trim();
    if (!description) {
      notify('Ability description is required.');
      return;
    }
    const newAbility = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      name: String(formData.get('name') || '').trim() || 'Ability',
      description,
      automation: {}
    };
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = latest?.abilities || participant.abilities || [];
    await patchParticipant(participant.id, { abilities: [...current, newAbility] });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-ability]').forEach((button) => {
    button.onclick = async () => {
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const abilities = [...(latest?.abilities || participant.abilities || [])];
      const targetId = button.dataset.playerRemoveAbility;
      const fallbackIndex = Number(button.dataset.playerAbilityIndex);
      let idx = abilities.findIndex((entry) => targetId && entry.id === targetId);
      if (idx < 0 && Number.isInteger(fallbackIndex)) idx = fallbackIndex;
      if (idx < 0 || idx >= abilities.length) return;
      abilities.splice(idx, 1);
      await patchParticipant(participant.id, { abilities });
      fetchState();
    };
  });
  panel.querySelector('[data-player-proficiency-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('proficiency') || '').trim();
    if (!token) return;
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = Array.isArray(latest?.proficiencies) ? latest.proficiencies : [];
    const proficiencies = mergePlayerUniqueText(current, token);
    await patchParticipant(participant.id, { proficiencies });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-proficiency]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.playerRemoveProficiency);
      if (!Number.isInteger(index) || index < 0) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const proficiencies = [...(latest?.proficiencies || [])];
      if (index >= proficiencies.length) return;
      proficiencies.splice(index, 1);
      await patchParticipant(participant.id, { proficiencies });
      fetchState();
    };
  });
  panel.querySelector('[data-player-language-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const token = String(formData.get('language') || '').trim();
    if (!token) return;
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const current = Array.isArray(latest?.languages) ? latest.languages : [];
    const languages = mergePlayerUniqueText(current, token);
    await patchParticipant(participant.id, { languages });
    event.target.reset();
    fetchState();
  });
  panel.querySelectorAll('[data-player-remove-language]').forEach((button) => {
    button.onclick = async () => {
      const index = Number(button.dataset.playerRemoveLanguage);
      if (!Number.isInteger(index) || index < 0) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const languages = [...(latest?.languages || [])];
      if (index >= languages.length) return;
      languages.splice(index, 1);
      await patchParticipant(participant.id, { languages });
      fetchState();
    };
  });

  const statusForm = panel.querySelector('[data-player-status-form]');
  panel.querySelector('[data-player-toggle-status]')?.addEventListener('click', () => {
    statusForm?.classList.toggle('hidden');
  });
  statusForm?.querySelector('[data-status-preset]')?.addEventListener('change', (event) => {
    applyPlayerStatusPreset(event.currentTarget, statusForm);
  });
  statusForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const currentStatuses = latest?.statuses || participant.statuses || [];
    const newStatus = buildStatusFromForm(formData);
    await patchParticipant(participant.id, { statuses: [...currentStatuses, newStatus] });
    event.target.reset();
    statusForm.classList.add('hidden');
    fetchState();
  });
  panel.querySelectorAll('[data-player-status-stack]').forEach((button) => {
    button.onclick = async () => {
      const delta = Number(button.dataset.playerStatusDelta || 0);
      if (!delta) return;
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      const targetId = button.dataset.playerStatusStack;
      const fallbackIndex = Number(button.dataset.playerStatusIndex);
      let idx = statuses.findIndex((status, index) => {
        const key = status.id || `index-${index}`;
        return key === targetId;
      });
      if (idx < 0 && Number.isInteger(fallbackIndex)) {
        idx = fallbackIndex;
      }
      if (idx < 0 || idx >= statuses.length) return;
      const current = Math.max(1, Number(statuses[idx].stacks || 1));
      const next = current + delta;
      if (next <= 0) {
        statuses.splice(idx, 1);
      } else {
        statuses[idx] = { ...statuses[idx], stacks: next };
      }
      await patchParticipant(participant.id, { statuses });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-player-remove-status]').forEach((button) => {
    button.onclick = async () => {
      const latest = (await fetchParticipantFromServer(participant.id)) || participant;
      const statuses = [...(latest?.statuses || participant.statuses || [])];
      const targetId = button.dataset.playerRemoveStatus;
      const fallbackIndex = Number(button.dataset.playerStatusIndex);
      let idx = statuses.findIndex((status, index) => {
        const key = status.id || `index-${index}`;
        return key === targetId;
      });
      if (idx < 0 && Number.isInteger(fallbackIndex)) {
        idx = fallbackIndex;
      }
      if (idx < 0 || idx >= statuses.length) return;
      statuses.splice(idx, 1);
      await patchParticipant(participant.id, { statuses });
      fetchState();
    };
  });
  panel.querySelectorAll('[data-player-zone-add-target-button]').forEach((button) => {
    button.onclick = async () => {
      const zoneId = button.dataset.playerZoneAddTargetButton;
      const select = panel.querySelector(`[data-player-zone-add-target="${zoneId}"]`);
      const targetId = select?.value || '';
      if (!zoneId || !targetId) return;
      try {
        await api('/api/zones/target/add', 'POST', {
          participantId: participant.id,
          zoneId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  panel.querySelectorAll('[data-player-zone-remove-target]').forEach((button) => {
    button.onclick = async () => {
      const zoneId = button.dataset.playerZoneRemoveTarget;
      const targetId = button.dataset.playerZoneTargetId;
      if (!zoneId || !targetId) return;
      try {
        await api('/api/zones/target/remove', 'POST', {
          participantId: participant.id,
          zoneId,
          targetId
        });
        fetchState();
      } catch (err) {
        notify(err.message);
      }
    };
  });
  const inventoryForm = panel.querySelector('#playerInventoryForm');
  const currencyForm = panel.querySelector('#playerCurrencyForm');
  panel.querySelector('[data-player-toggle-inventory]')?.addEventListener('click', () => {
    inventoryForm?.classList.toggle('hidden');
  });
  panel.querySelector('[data-player-toggle-currency]')?.addEventListener('click', () => {
    currencyForm?.classList.toggle('hidden');
  });
  const notesButton = panel.querySelector('[data-player-save-notes]');
  const notesInput = panel.querySelector('[data-player-notes]');
  notesButton?.addEventListener('click', async () => {
    await patchParticipant(participant.id, { notes: notesInput?.value || '' });
    fetchState();
  });
}

async function handleStatAdjustment(fieldKey, delta) {
  if (!fieldKey || !Number.isFinite(delta)) return;
  const participant = getFocusedParticipant();
  if (!participant) return;
  const field = STAT_FIELD_MAP[fieldKey];
  if (!field) return;
  const latest = (await fetchParticipantFromServer(participant.id)) || participant;
  const current = field === 'apCurrent' ? latest.apCurrent : latest[field];
  const payload = {};
  payload[field === 'apCurrent' ? 'apCurrent' : field] = Number(current || 0) + delta;
  await patchParticipant(participant.id, payload);
  fetchState();
}

async function handleStatSet(fieldKey, value) {
  if (!fieldKey || !Number.isFinite(value)) return;
  const participant = getFocusedParticipant();
  if (!participant) return;
  const field = STAT_FIELD_MAP[fieldKey];
  if (!field) return;
  const payload = {};
  payload[field === 'apCurrent' ? 'apCurrent' : field] = value;
  await patchParticipant(participant.id, payload);
  fetchState();
}

function getParticipantSnapshot(participantId) {
  if (!participantId) return null;
  return state.encounter.participants?.find((participant) => participant.id === participantId) || null;
}

function getFocusedParticipant() {
  return getParticipantSnapshot(focusId);
}

function getCurrentTurnEntry() {
  const entries = getPlayerTurnEntries();
  if (!entries.length) return null;
  const key = String(state.encounter.currentTurnKey || '');
  if (key) {
    const match = entries.find((entry) => getPlayerTurnEntryKey(entry) === key);
    return match || null;
  }
  const index = state.encounter.currentIndex;
  if (index != null && index >= 0 && index < entries.length) {
    return entries[index] || null;
  }
  return entries[0] || null;
}

function getCurrentParticipant() {
  const entry = getCurrentTurnEntry();
  return entry?.participant || null;
}

function updateUrl(options = {}) {
  if (typeof options.create === 'boolean') {
    createMode = options.create;
  }
  const url = new URL(window.location.href);
  if (focusId) {
    url.searchParams.set('id', focusId);
  } else {
    url.searchParams.delete('id');
  }
  if (createMode) {
    url.searchParams.set('create', '1');
  } else {
    url.searchParams.delete('create');
  }
  window.history.replaceState(null, '', url);
}

async function patchParticipant(participantId, payload) {
  try {
    const response = await api(`/api/participants/${participantId}`, 'PATCH', payload);
    if (response?.participant) {
      mergeParticipant(response.participant);
    }
    return response;
  } catch (err) {
    notify(err.message);
    return null;
  }
}

function buildPlayerCardFromForm(formData) {
  const card = {
    name: formData.get('name'),
    set: formData.get('set') || '',
    type: formData.get('type') || 'Attack',
    tier: formData.get('tier') || 'Common',
    apCost: formData.get('apCost'),
    range: formData.get('range'),
    shieldBonus: formData.get('shieldBonus'),
    damage: formData.get('damage'),
    damageType: formData.get('damageType'),
    constructDurationTurns: formData.get('constructDurationTurns') || 1,
    constructMode: formData.get('constructMode') || '',
    constructStatusId: formData.get('constructStatusId') || '',
    constructStatusStacks: formData.get('constructStatusStacks') || 1,
    tags: formData.get('tags') || '',
    effect: formData.get('effect') || '',
    healthBonus: formData.get('healthBonus'),
    masteryThresholds: {
      level2: formData.get('masteryTo2'),
      level3: formData.get('masteryTo3'),
      level4: formData.get('masteryTo4')
    },
    modifiers: {
      maxHp: formData.get('modMaxHp'),
      maxShield: formData.get('modMaxShield'),
      apMax: formData.get('modApMax'),
      guardRestore: formData.get('modGuard'),
      damageBonus: formData.get('modDamage')
    }
  };
  return normalizeCardPayload(card);
}

function applyManualMastery(card, level) {
  const next = { ...(card || {}) };
  const selected = Math.max(1, Math.min(4, Number(level || 1)));
  const tierDefaults = getTierMasteryThresholdDefaults(next.tier);
  const thresholds = next.masteryThresholds || {};
  const to2 = Math.max(1, Number(thresholds.level2 ?? tierDefaults.level2));
  const to3 = Math.max(to2 + 1, Number(thresholds.level3 ?? tierDefaults.level3));
  const to4 = Math.max(to3 + 1, Number(thresholds.level4 ?? tierDefaults.level4));
  let uses = Math.max(0, Number(next.masteryUses || 0));
  if (selected === 1) uses = Math.min(uses, to2 - 1);
  if (selected === 2) uses = Math.max(to2, Math.min(uses, to3 - 1));
  if (selected === 3) uses = Math.max(to3, Math.min(uses, to4 - 1));
  if (selected === 4) uses = Math.max(uses, to4);
  next.masteryLevel = selected;
  next.masteryUses = uses;
  next.masteryThresholds = { level2: to2, level3: to3, level4: to4 };
  return next;
}

function buildStatusFromForm(formData) {
  return {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    presetId: formData.get('preset') || '',
    name: formData.get('name'),
    stacks: Number(formData.get('stacks') || 1),
    notes: formData.get('notes') || ''
  };
}

function normalizeCardPayload(raw = {}) {
  const tier = String(raw.tier || 'Common').trim() || 'Common';
  const tierDefaults = getTierMasteryThresholdDefaults(tier);
  const masteryThresholds = {
    level2: toNumber(raw.masteryThresholds?.level2 ?? raw.masteryTo2 ?? tierDefaults.level2, tierDefaults.level2),
    level3: toNumber(raw.masteryThresholds?.level3 ?? raw.masteryTo3 ?? tierDefaults.level3, tierDefaults.level3),
    level4: toNumber(raw.masteryThresholds?.level4 ?? raw.masteryTo4 ?? tierDefaults.level4, tierDefaults.level4)
  };
  masteryThresholds.level2 = Math.max(1, Math.round(masteryThresholds.level2));
  masteryThresholds.level3 = Math.max(masteryThresholds.level2 + 1, Math.round(masteryThresholds.level3));
  masteryThresholds.level4 = Math.max(masteryThresholds.level3 + 1, Math.round(masteryThresholds.level4));
  const masteryLevel = Math.max(1, Math.min(4, Math.round(toNumber(raw.masteryLevel ?? 1, 1))));
  const masteryUses = Math.max(0, Math.round(toNumber(raw.masteryUses ?? 0, 0)));
  const baseDamage = Math.max(0, Math.round(toNumber(raw.damage ?? raw.baseDamage ?? 0, 0)));
  const explicitShieldSource = raw.shieldBonus ?? raw.bonusShield;
  const explicitShieldBonus =
    explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
  const shieldBonus = Number.isFinite(explicitShieldBonus)
    ? explicitShieldBonus
    : getCardTierShieldBonus(tier);
  return {
    ...raw,
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Card').trim(),
    set: raw.set || '',
    type: raw.type || 'Attack',
    tier,
    active: raw.active !== false,
    apCost: toNumber(raw.apCost ?? raw.ap ?? 0),
    range: toNumber(raw.range ?? 0),
    rangeText: String(raw.rangeText || '').trim(),
    rangeByLevel: raw.rangeByLevel && typeof raw.rangeByLevel === 'object' ? { ...raw.rangeByLevel } : undefined,
    healthBonus: toNumber(raw.healthBonus ?? raw.hpBonus ?? 0),
    shieldBonus,
    damage: baseDamage,
    damageType: raw.damageType || raw.damage_type || '',
    secondaryDamage: toNumber(raw.secondaryDamage ?? 0),
    secondaryDamageByLevel:
      raw.secondaryDamageByLevel && typeof raw.secondaryDamageByLevel === 'object'
        ? { ...raw.secondaryDamageByLevel }
        : undefined,
    secondaryDamageType: String(raw.secondaryDamageType || '').trim(),
    secondaryTargetMode: String(raw.secondaryTargetMode || '').trim().toLowerCase(),
    secondaryTargetLabel: String(raw.secondaryTargetLabel || '').trim(),
    targetMode: String(raw.targetMode || '').trim().toLowerCase(),
    multiTargetMax: toNumber(raw.multiTargetMax ?? 0),
    multiTargetMaxByLevel:
      raw.multiTargetMaxByLevel && typeof raw.multiTargetMaxByLevel === 'object'
        ? { ...raw.multiTargetMaxByLevel }
        : undefined,
    bonusDamageIfTargetHasShieldByLevel:
      raw.bonusDamageIfTargetHasShieldByLevel && typeof raw.bonusDamageIfTargetHasShieldByLevel === 'object'
        ? { ...raw.bonusDamageIfTargetHasShieldByLevel }
        : undefined,
    directHpDamageOnFullyBlockedByLevel:
      raw.directHpDamageOnFullyBlockedByLevel && typeof raw.directHpDamageOnFullyBlockedByLevel === 'object'
        ? { ...raw.directHpDamageOnFullyBlockedByLevel }
        : undefined,
    nextAttackDamageBonusByLevel:
      raw.nextAttackDamageBonusByLevel && typeof raw.nextAttackDamageBonusByLevel === 'object'
        ? { ...raw.nextAttackDamageBonusByLevel }
        : undefined,
    allowSelfTarget: raw.allowSelfTarget !== false,
    constructDurationTurns: Math.max(
      1,
      Math.round(toNumber(raw.constructDurationTurns ?? raw.constructDuration ?? raw.durationTurns ?? 1, 1))
    ),
    constructMode: String(raw.constructMode || raw.mode || '').trim().toLowerCase(),
    constructStatusId: String(raw.constructStatusId ?? raw.statusId ?? '').trim(),
    constructStatusName: String(raw.constructStatusName ?? raw.statusName ?? '').trim(),
    constructStatusStacks: Math.max(
      1,
      Math.round(toNumber(raw.constructStatusStacks ?? raw.statusStacks ?? 1, 1))
    ),
    constructAp: Math.max(0, Math.round(toNumber(raw.constructAp ?? raw.constructApMax ?? 2, 2))),
    constructMaxHp: Math.max(1, Math.round(toNumber(raw.constructMaxHp ?? raw.constructHp ?? 1, 1))),
    constructMoveFt: Math.max(5, Math.round(toNumber(raw.constructMoveFt ?? raw.constructMove ?? 10, 10))),
    constructCards: Array.isArray(raw.constructCards)
      ? raw.constructCards.map((value) => String(value || '').trim()).filter(Boolean)
      : String(raw.constructCards || raw.constructLinkedCard || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
    constructLinkedCard: String(raw.constructLinkedCard || '').trim(),
    statusApply:
      raw.statusApply && typeof raw.statusApply === 'object'
        ? {
            id: String(raw.statusApply.id || '').trim(),
            name: String(raw.statusApply.name || '').trim(),
            stacksByLevel:
              raw.statusApply.stacksByLevel && typeof raw.statusApply.stacksByLevel === 'object'
                ? { ...raw.statusApply.stacksByLevel }
                : undefined
          }
        : undefined,
    movementByLevel:
      raw.movementByLevel && typeof raw.movementByLevel === 'object' ? { ...raw.movementByLevel } : undefined,
    pullDistanceByLevel:
      raw.pullDistanceByLevel && typeof raw.pullDistanceByLevel === 'object'
        ? { ...raw.pullDistanceByLevel }
        : undefined,
    pushDistanceByLevel:
      raw.pushDistanceByLevel && typeof raw.pushDistanceByLevel === 'object'
        ? { ...raw.pushDistanceByLevel }
        : undefined,
    shieldRestoreByLevel:
      raw.shieldRestoreByLevel && typeof raw.shieldRestoreByLevel === 'object'
        ? { ...raw.shieldRestoreByLevel }
        : undefined,
    healByLevel:
      raw.healByLevel && typeof raw.healByLevel === 'object'
        ? { ...raw.healByLevel }
        : undefined,
    heal: toNumber(raw.heal ?? 0),
    chargesMax: Math.max(0, Math.round(toNumber(raw.chargesMax ?? raw.maxCharges ?? raw.charges ?? 0, 0))),
    chargesCurrent: Math.max(
      0,
      Math.round(
        toNumber(
          raw.chargesCurrent ?? raw.remainingCharges ?? raw.chargesMax ?? raw.maxCharges ?? raw.charges ?? 0,
          0
        )
      )
    ),
    masteryLevel,
    masteryUses,
    masteryThresholds,
    masteryDamageByLevel: {
      1: toNumber(raw.masteryDamageByLevel?.[1] ?? raw.masteryDamageByLevel?.level1 ?? raw.damageLevel1 ?? baseDamage, baseDamage),
      2: toNumber(raw.masteryDamageByLevel?.[2] ?? raw.masteryDamageByLevel?.level2 ?? raw.damageLevel2 ?? baseDamage, baseDamage),
      3: toNumber(raw.masteryDamageByLevel?.[3] ?? raw.masteryDamageByLevel?.level3 ?? raw.damageLevel3 ?? baseDamage, baseDamage),
      4: toNumber(
        raw.masteryDamageByLevel?.[4] ??
          raw.masteryDamageByLevel?.level4 ??
          raw.damageLevel4 ??
          raw.masteryDamageByLevel?.[3] ??
          raw.masteryDamageByLevel?.level3 ??
          raw.damageLevel3 ??
          baseDamage,
        baseDamage
      )
    },
    tags: normalizeTagList(raw.tags),
    effect: raw.effect || '',
    mastery: normalizeMasteryInput(raw.mastery),
    fusion: raw.fusion || '',
    modifiers: {
      maxHp: toNumber(raw.modifiers?.maxHp ?? raw.modMaxHp ?? 0),
      maxShield: toNumber(raw.modifiers?.maxShield ?? raw.modMaxShield ?? 0),
      apMax: toNumber(raw.modifiers?.apMax ?? raw.modApMax ?? 0),
      guardRestore: toNumber(raw.modifiers?.guardRestore ?? raw.modGuard ?? 0),
      damageBonus: toNumber(raw.modifiers?.damageBonus ?? raw.modDamage ?? 0)
    }
  };
}

function normalizeTagList(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter(Boolean);
  }
  return String(tags)
    .split(/,|\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeMasteryInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((line) => String(line).trim()).filter(Boolean);
  }
  return String(input)
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getStatusPreset(id) {
  if (!id) return null;
  return (state.reference?.statuses || []).find((entry) => entry.id === id) || null;
}

function applyPlayerStatusPreset(selectEl, formEl) {
  const preset = getStatusPreset(selectEl?.value);
  if (!preset || !formEl) return;
  const nameInput = formEl.querySelector('input[name="name"]');
  const stackInput = formEl.querySelector('input[name="stacks"]');
  const notesInput = formEl.querySelector('input[name="notes"]');
  if (nameInput) nameInput.value = preset.name;
  if (stackInput && typeof preset.defaultStacks === 'number') stackInput.value = preset.defaultStacks;
  if (notesInput) notesInput.value = preset.description || '';
}

function getSavingThrowsSnapshot(participant) {
  const snapshot = {};
  ABILITIES.forEach(({ key }) => {
    snapshot[key] = Boolean(participant.savingThrows?.[key]);
  });
  return snapshot;
}

function getSkillsSnapshot(participant) {
  const snapshot = {};
  SKILLS.forEach(([, , key]) => {
    const entry = getSkillState(participant, key);
    snapshot[key] = { ...entry };
  });
  return snapshot;
}

async function handleCharacterDownload() {
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant to export.');
    return;
  }
  const latest = (await fetchParticipantFromServer(participant.id)) || participant;
  downloadJson(latest, `${slugify(latest?.name || 'character')}.json`);
  els.menuPanel?.classList.remove('is-open');
}

async function handleCharacterImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const participantData = payload.participant || payload;
    if (!participantData || typeof participantData !== 'object') {
      throw new Error('Invalid character file.');
    }
    const result = await api('/api/import/participant', 'POST', { participant: participantData });
    if (result?.participant?.id) {
      focusId = result.participant.id;
      createMode = false;
      updateUrl({ create: false });
      notify('Character imported.');
    }
    fetchState();
  } catch (err) {
    notify(`Import failed: ${err.message}`);
  } finally {
    event.target.value = '';
    els.menuPanel?.classList.remove('is-open');
  }
}

async function handlePlayerCardFile(event, mode = 'card') {
  const file = event.target.files?.[0];
  if (!file) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const cards = extractCardsFromPayload(payload).map((card) => normalizeCardPayload(card));
    if (!cards.length) {
      throw new Error('No cards found in file.');
    }
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existing = latest?.cards || [];
    if (mode === 'deck') {
      let remainingSlots = MAX_ACTIVE_CARDS;
      cards.forEach((card) => {
        if (card.active === false) return;
        if (remainingSlots > 0) {
          card.active = true;
          remainingSlots -= 1;
        } else {
          card.active = false;
        }
      });
    } else {
      let remainingSlots = Math.max(
        0,
        MAX_ACTIVE_CARDS - existing.filter((card) => isCardActive(card)).length
      );
      cards.forEach((card) => {
        if (card.active === false) return;
        if (remainingSlots > 0) {
          card.active = true;
          remainingSlots -= 1;
        } else {
          card.active = false;
        }
      });
    }
    const updated = mode === 'deck' ? cards : [...existing, ...cards];
    await patchParticipant(participant.id, { cards: updated });
    fetchState();
    notify(`Imported ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
    if (cards.some((card) => card.active === false)) {
      notify(`Only ${MAX_ACTIVE_CARDS} cards can be active. Extra imports were set inactive.`);
    }
  } catch (err) {
    notify(`Card import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function extractCardsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.cards)) return payload.cards;
  if (payload.card && Array.isArray(payload.card)) return payload.card;
  if (payload.card && typeof payload.card === 'object') return [payload.card];
  if (typeof payload === 'object' && (payload.name || payload.set)) return [payload];
  return [];
}

async function handlePlayerRelicFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const participant = getFocusedParticipant();
  if (!participant) {
    notify('Select a combatant first.');
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const relics = extractRelicsFromPayload(payload).map((relic) => normalizeRelicPayload(relic));
    if (!relics.length) {
      throw new Error('No relics found in file.');
    }
    const latest = (await fetchParticipantFromServer(participant.id)) || participant;
    const existing = latest?.relics || [];
    await patchParticipant(participant.id, { relics: [...existing, ...relics] });
    fetchState();
    notify(`Imported ${relics.length} relic${relics.length === 1 ? '' : 's'}.`);
  } catch (err) {
    notify(`Relic import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function extractRelicsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.relics)) return payload.relics;
  if (payload.relic && Array.isArray(payload.relic)) return payload.relic;
  if (payload.relic && typeof payload.relic === 'object') return [payload.relic];
  if (typeof payload === 'object' && (payload.name || payload.description)) return [payload];
  return [];
}

function normalizeRelicPayload(raw = {}) {
  return {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Relic').trim(),
    ability: raw.ability || raw.focus || '',
    description: raw.description || raw.notes || '',
    hp: Number(raw.hp ?? raw.hpBonus ?? 0),
    ap: Number(raw.ap ?? raw.apBonus ?? 0),
    modifiers: {
      maxHp: Number(raw.modifiers?.maxHp ?? raw.modMaxHp ?? 0),
      maxShield: Number(raw.modifiers?.maxShield ?? raw.modMaxShield ?? 0),
      apMax: Number(raw.modifiers?.apMax ?? raw.modApMax ?? 0),
      guardRestore: Number(raw.modifiers?.guardRestore ?? raw.modGuard ?? 0),
      damageBonus: Number(raw.modifiers?.damageBonus ?? raw.modDamage ?? 0)
    }
  };
}

async function fetchParticipantFromServer(participantId) {
  try {
    const response = await api(`/api/participants/${participantId}/export`);
    return response?.participant || null;
  } catch (err) {
    notify(err.message);
    return getParticipantSnapshot(participantId);
  }
}

function mergeParticipant(participant) {
  if (!participant?.id) return;
  const list = Array.isArray(state.encounter.participants)
    ? [...state.encounter.participants]
    : [];
  const index = list.findIndex((entry) => entry.id === participant.id);
  if (index >= 0) {
    list[index] = participant;
  } else {
    list.push(participant);
  }
  state.encounter.participants = list;
  render();
}

async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function notify(message) {
  if (message) {
    console.warn(message);
  }
}

function dedupeTypes(list = []) {
  const values = Array.isArray(list) ? list : [list];
  const normalized = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = String(value).trim();
    if (!trimmed) continue;
    if (!normalized.find((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDamageTypeOptions(includePlaceholder = false) {
  const options = includePlaceholder ? '<option value="">Select type…</option>' : '';
  return (
    options +
    DAMAGE_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')
  );
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return (value || 'record')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'record';
}

function openPlayerMenu() {
  els.menuPanel?.classList.add('is-open');
}

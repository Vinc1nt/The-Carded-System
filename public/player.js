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

const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1 },
  reference: { standardActions: [], sets: [], statuses: [] },
  updatedAt: null
};

const params = new URLSearchParams(window.location.search);
let focusId = params.get('id');
let createMode = params.get('create') === '1';
let eventSource;

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
    const updatedCards = [...(latest?.cards || []), newCard];
    await patchParticipant(participant.id, { cards: updatedCards });
    form.reset();
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
  els.stats.innerHTML = `
    <div class="panel player-sheet">
      ${renderPlayerTurnTrack()}
      <div class="panel-header">
        <div>
          <h2>${participant.name}</h2>
          <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
        </div>
        <div class="muted">Round ${state.encounter.round}</div>
      </div>
      <div class="vitals-grid">
        ${renderPlayerVital('HP', participant.hp, participant.maxHp, 'hp')}
        ${renderPlayerVital('Shield', participant.shield, participant.maxShield, 'shield')}
        ${renderPlayerVital('AP', participant.apCurrent, participant.apMax, 'ap')}
        ${renderPlayerVital('Guard Restore', participant.guardRestore || 3)}
        ${renderPlayerVital('Damage Bonus', participant.damageBonus || 0)}
      </div>
      ${renderPlayerStandardActionsSection()}
      ${renderPlayerCardsSection()}
      ${renderPlayerStatusSection(participant)}
      ${renderPlayerDamageSection(participant)}
      ${renderPlayerAbilitiesSection(participant)}
      <details class="player-collapsible" data-player-section="abilities" open>
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
      ${renderPlayerSetSection(participant)}
      ${renderPlayerRelicSection()}
      ${renderPlayerNotesSection(participant)}
    </div>
  `;
  cachePlayerSectionRefs();
  wirePlayerSheetEvents(participant);
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

function cachePlayerSectionRefs() {
  els.cardList = document.getElementById('playerCardList');
  els.cardForm = document.getElementById('playerCardForm');
  els.cardDrawer = document.getElementById('playerCardDrawer');
  els.importCardFile = document.getElementById('playerImportCard');
  els.importDeckFile = document.getElementById('playerImportDeck');
  els.importRelicFile = document.getElementById('playerImportRelic');
}

function renderPlayerTurnTrack() {
  const participants = state.encounter.participants || [];
  if (!participants.length) return '';
  const currentIndex = state.encounter.currentIndex ?? -1;
  return `
    <div class="player-turn-track">
      ${participants
        .map(
          (entry, index) => `
            <div class="turn-pill ${index === currentIndex ? 'is-active' : ''} ${entry.id === focusId ? 'is-focus' : ''}">
              <span>${entry.name}</span>
            </div>`
        )
        .join('')}
    </div>
  `;
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
  const dex = stats.dexterity || 0;
  const initiative = dex + proficiencyBonus;
  const maxHp = Number(formData.get('maxHp') || 0);
  const maxShield = Number(formData.get('maxShield') || 0);
  const apMax = Number(formData.get('apMax') || 0);
  const resistances = dedupeTypes(formData.getAll('resistances'));
  const vulnerabilities = dedupeTypes(formData.getAll('vulnerabilities'));
  return {
    name: formData.get('name')?.trim() || 'New Character',
    setFocus: formData.get('setFocus') || '',
    maxHp,
    hp: maxHp,
    maxShield,
    shield: maxShield,
    apMax,
    apCurrent: apMax,
    proficiencyBonus,
    initiative,
    stats,
    notes: formData.get('notes') || '',
    resistances,
    vulnerabilities
  };
}

function renderPlayerStandardActionsSection() {
  return `
    <details class="player-collapsible" data-player-section="standardActions" open>
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
  const order = ['move', 'disengage', 'slip', 'interact', 'recover', 'guard'];
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

function renderPlayerCardsSection() {
  return `
    <details class="player-collapsible" data-player-section="cards" open>
      <summary><strong>Cards & Loadout</strong></summary>
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
            <button type="submit">Add Card</button>
          </form>
        </details>
      </div>
    </details>
  `;
}

function renderPlayerStatusSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="statuses" open>
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

function renderPlayerDamageSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="mitigation" open>
      <summary><strong>Resistances & Vulnerabilities</strong></summary>
      <div class="collapsible-body">
        ${renderPlayerDamageGroup('Resistances', participant.resistances, 'resistance')}
        ${renderPlayerDamageGroup('Vulnerabilities', participant.vulnerabilities, 'vulnerability')}
        <p class="muted">Resistances halve incoming damage; vulnerabilities double it. Recover (1 AP) removes 1 stack of Bleeding/Poisoned/Burning.</p>
      </div>
    </details>
  `;
}

function renderPlayerDamageGroup(label, values = [], key) {
  const list = (values || [])
    .map(
      (value, index) => `
        <span class="tag-pill">
          ${value}
          <button type="button" aria-label="Remove" data-player-remove-${key}="${index}">×</button>
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
      <form data-${key}-form>
        <label class="compact-label">Add ${label.slice(0, -1)}
          <select name="${key}">
            ${renderDamageTypeOptions(true)}
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
    </div>
  `;
}

function renderPlayerAbilitiesSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="abilitiesText" open>
      <summary><strong>Abilities</strong></summary>
      <div class="collapsible-body">
        <div class="ability-list">
          ${renderPlayerAbilityEntries(participant)}
        </div>
        <form data-player-ability-form class="stacked-form">
          <label>Name
            <input type="text" name="name" placeholder="Ability name" />
          </label>
          <label>Description
            <textarea name="description" rows="2" placeholder="Describe the ability..." required></textarea>
          </label>
          <button type="submit">Add Ability</button>
        </form>
      </div>
    </details>
  `;
}

function renderPlayerAbilityEntries(participant) {
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
        <div class="card-actions">
          <button type="button" data-player-remove-ability="${entry.id || ''}" data-player-ability-index="${index}">Remove</button>
        </div>
      </article>`
    )
    .join('');
}

function journalFieldName(category) {
  return category === 'achievement' ? 'achievements' : 'quests';
}

function renderJournal() {
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
    <div class="journal-manager-group">
      <h4>Quests</h4>
      <div class="journal-list">
        ${renderPlayerJournalEntries(quests, 'No quests yet.')}
      </div>
    </div>
    <div class="journal-manager-group">
      <h4>Achievements</h4>
      <div class="journal-list">
        ${renderPlayerJournalEntries(achievements, 'No achievements yet.')}
      </div>
    </div>
  `;
  renderJournalPopup(participant);
}

function renderPlayerJournalEntries(entries, emptyText) {
  if (!entries.length) {
    return `<p class="muted">${emptyText}</p>`;
  }
  return entries
    .map(
      (entry) => `
      <article class="journal-entry">
        <strong>${entry.title || 'Entry'}</strong>
        ${entry.description ? `<p>${entry.description}</p>` : ''}
      </article>`
    )
    .join('');
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
      <h3>New ${pending.category === 'achievement' ? 'Achievement' : 'Quest'}</h3>
      <h4>${pending.title || 'Untitled'}</h4>
      ${pending.description ? `<p>${pending.description}</p>` : ''}
      <div class="card-actions">
        <button type="button" data-journal-ack="${pending.id}" data-journal-category="${pending.category}" class="primary">Acknowledge</button>
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
}

function hideJournalPopup() {
  const popup = els.journalPopup;
  if (!popup) return;
  popup.classList.add('hidden');
  popup.innerHTML = '';
}

function renderPlayerSetSection(participant) {
  return `
    <details class="player-collapsible" data-player-section="sets" open>
      <summary><strong>Set Tracker</strong></summary>
      <div class="collapsible-body">
        ${renderSetTracker(participant)}
      </div>
    </details>
  `;
}

function renderPlayerRelicSection() {
  return `
    <details class="player-collapsible" data-player-section="relics" open>
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
    <details class="player-collapsible" data-player-section="notes" open>
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
  let recoverPayload = {};
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
    recoverPayload = target || {};
  }
  try {
    await api('/api/actions/standard', 'POST', {
      actionId: resolvedId,
      participantId: participant.id,
      ...recoverPayload
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

function abilityMod(score = 0) {
  return Math.floor((Number(score) - 10) / 2);
}

function getSkillState(participant, key) {
  return participant.skills?.[key] || { proficient: false, expert: false };
}

function renderSetTracker(participant) {
  const counts = {};
  for (const card of participant.cards || []) {
    if (!card.set) continue;
    counts[card.set] = (counts[card.set] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) {
    return '<p class="muted">No set bonuses equipped.</p>';
  }
  return entries
    .map(([setName, count]) => {
      const ref = (state.reference.sets || []).find((entry) => entry.name === setName);
      const bonuses = ref?.bonuses || [];
      const list = bonuses
        .map(
          (bonus) => `
            <li class="${count >= bonus.pieces ? 'active' : ''}">
              ${bonus.pieces} pcs — ${bonus.effect || summarizeModifiers(bonus.modifiers || {})}
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
  const cards = participant?.cards || [];
  if (!participant || !cards.length) {
    listEl.classList.add('empty-state');
    listEl.innerHTML = '<p class="empty-state">No cards tracked for this combatant.</p>';
  } else {
    listEl.classList.remove('empty-state');
    listEl.innerHTML = cards
      .map(
        (card) => `
          <article class="card-item">
            <h4>${card.name} <small>${card.tier || ''} ${card.type || ''}</small></h4>
            <p>Set: <strong>${card.set || '—'}</strong></p>
            <p>AP ${card.apCost || 0} · Range ${card.range || 0} ft · HP +${card.healthBonus || 0}</p>
            <p>Tags: ${(card.tags || []).join(', ') || '—'}</p>
            <p>${card.effect || ''}</p>
            ${card.mastery?.length ? `<p>Mastery: ${card.mastery.join(' / ')}</p>` : ''}
            ${card.fusion ? `<p>Fusion: ${card.fusion}</p>` : ''}
            ${card.setBonuses ? `<p>Set Bonuses: ${card.setBonuses}</p>` : ''}
            <p>Automation: ${summarizeModifiers(card.modifiers || {})}</p>
            <div class="card-actions">
              <button type="button" data-player-export-card="${card.id}">Export Card</button>
            </div>
          </article>`
      )
      .join('');
  }
  renderRelics(participant);
  wirePlayerCardForm();
  wirePlayerCardImports();
  wirePlayerCardExports(participant);
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
  const current = getCurrentParticipant();
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

function wirePlayerSheetEvents(participant) {
  const panel = els.stats;
  panel.querySelectorAll('[data-player-standard]').forEach((button) => {
    button.onclick = () => handlePlayerStandardAction(button.dataset.playerStandard);
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
      const payload = { stats: { [ability]: value } };
      if (ability === 'dexterity') {
        payload.initiative = value + (participant.proficiencyBonus || 0);
      }
      await patchParticipant(participant.id, payload);
      fetchState();
    };
  });
  const profInput = panel.querySelector('[data-proficiency-input]');
  if (profInput) {
    profInput.onchange = async () => {
      const value = Number(profInput.value || 0);
      participant.proficiencyBonus = value;
      await patchParticipant(participant.id, {
        proficiencyBonus: value,
        initiative: (participant.stats?.dexterity || 0) + value
      });
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

function getCurrentParticipant() {
  const index = state.encounter.currentIndex;
  if (index == null || index < 0) return null;
  return state.encounter.participants?.[index] ?? null;
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
    tags: formData.get('tags') || '',
    effect: formData.get('effect') || '',
    healthBonus: formData.get('healthBonus'),
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
  return {
    id: raw.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: (raw.name || 'Imported Card').trim(),
    set: raw.set || '',
    type: raw.type || 'Attack',
    tier: raw.tier || 'Common',
    apCost: toNumber(raw.apCost ?? raw.ap ?? 0),
    range: toNumber(raw.range ?? 0),
    healthBonus: toNumber(raw.healthBonus ?? raw.hpBonus ?? 0),
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
    const updated = mode === 'deck' ? cards : [...existing, ...cards];
    await patchParticipant(participant.id, { cards: updated });
    fetchState();
    notify(`Imported ${cards.length} card${cards.length === 1 ? '' : 's'}.`);
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

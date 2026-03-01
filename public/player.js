const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1 },
  reference: { standardActions: [], sets: [] },
  updatedAt: null
};

const params = new URLSearchParams(window.location.search);
let focusId = params.get('id');
let eventSource;

const els = {
  select: document.getElementById('playerSelect'),
  stats: document.getElementById('playerStats'),
  cardList: document.getElementById('playerCardList'),
  logList: document.getElementById('playerLogList'),
  turnInfo: document.getElementById('playerTurnInfo')
};

document.addEventListener('DOMContentLoaded', () => {
  wireSelect();
  subscribe();
  fetchState();
});

function wireSelect() {
  els.select.addEventListener('change', () => {
    focusId = els.select.value || null;
    updateUrl();
    render();
  });
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
  renderStats();
  renderCards();
  renderLog();
  renderTurnInfo();
}

function renderSelectOptions() {
  const participants = state.encounter.participants || [];
  els.select.innerHTML = participants
    .map((participant) => `<option value="${participant.id}" ${participant.id === focusId ? 'selected' : ''}>${participant.name}</option>`)
    .join('');
  if (!participants.length) {
    els.select.innerHTML = '<option value="">No combatants</option>';
  }
}

function renderStats() {
  const participant = getFocusedParticipant();
  if (!participant) {
    els.stats.innerHTML = '<p class="empty-state">Waiting for the encounter console.</p>';
    return;
  }
  const stats = participant.stats || {};
  els.stats.innerHTML = `
    <div class="panel player-sheet">
      <div class="panel-header">
        <div>
          <h2>${participant.name}</h2>
          <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
        </div>
        <div class="muted">Round ${state.encounter.round}</div>
      </div>
      <div class="vitals-grid">
        ${renderPlayerVital('HP', participant.hp, participant.maxHp)}
        ${renderPlayerVital('Shield', participant.shield, participant.maxShield)}
        ${renderPlayerVital('AP', participant.apCurrent, participant.apMax)}
        ${renderPlayerVital('Guard Restore', participant.guardRestore || 3)}
        ${renderPlayerVital('Damage Bonus', participant.damageBonus || 0)}
      </div>
      <section class="player-section">
        <h3>Ability Scores</h3>
        <label>Proficiency Bonus
          <input type="number" data-proficiency-input value="${participant.proficiencyBonus ?? 2}" />
        </label>
        ${renderAbilityTable(stats)}
      </section>
      <section class="player-section">
        <h3>Saving Throws</h3>
        ${renderSavingThrows(participant)}
      </section>
      <section class="player-section">
        <h3>Skills</h3>
        ${renderSkillsTable(participant)}
      </section>
      <section class="player-section">
        <h3>Set Tracker</h3>
        ${renderSetTracker(participant)}
      </section>
      <section class="player-section">
        <h3>Statuses</h3>
        <div class="status-list">${renderStatuses(participant)}</div>
      </section>
      <section class="player-section">
        <h3>Notes</h3>
        <p class="muted">${participant.notes || '—'}</p>
      </section>
    </div>
  `;
  wirePlayerSheetEvents(participant);
}

function renderPlayerVital(label, value, max) {
  if (typeof max === 'number') {
    return `
      <div class="vital-card">
        <h4>${label}</h4>
        <div class="value">${value} / ${max}</div>
      </div>`;
  }
  return `
    <div class="vital-card">
      <h4>${label}</h4>
      <div class="value">${value}</div>
    </div>`;
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

function renderCards() {
  const participant = getFocusedParticipant();
  const cards = participant?.cards || [];
  if (!participant || !cards.length) {
    els.cardList.classList.add('empty-state');
    els.cardList.innerHTML = '<p class="empty-state">No cards tracked for this combatant.</p>';
  } else {
    els.cardList.classList.remove('empty-state');
    els.cardList.innerHTML = cards
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
          </article>`
      )
      .join('');
  }
  renderRelics(participant);
}

function renderRelics(participant) {
  const listEl = document.getElementById('playerRelicList');
  const formEl = document.getElementById('playerRelicForm');
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
      const updated = relics.filter((_, idx) => idx !== index);
      await patchParticipant(participant.id, { relics: updated });
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
      await patchParticipant(participant.id, { relics: [...relics, newRelic] });
      formEl.reset();
    };
  }
}

function renderLog() {
  const participant = getFocusedParticipant();
  if (!participant) {
    els.logList.innerHTML = '<p class="empty-state">No log entries.</p>';
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
    .map((status) => `<span class="status-pill">${status.name}${status.stacks ? ` ×${status.stacks}` : ''} (${status.severity})</span>`)
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
  panel.querySelectorAll('[data-ability-input]').forEach((input) => {
    input.onchange = async () => {
      const ability = input.dataset.abilityInput;
      const value = Number(input.value || 0);
      await patchParticipant(participant.id, { stats: { [ability]: value } });
    };
  });
  const profInput = panel.querySelector('[data-proficiency-input]');
  if (profInput) {
    profInput.onchange = async () => {
      const value = Number(profInput.value || 0);
      await patchParticipant(participant.id, { proficiencyBonus: value });
    };
  }
  panel.querySelectorAll('[data-save-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      await patchParticipant(participant.id, {
        savingThrows: { [checkbox.dataset.saveToggle]: checkbox.checked }
      });
    };
  });
  panel.querySelectorAll('[data-skill-toggle]').forEach((checkbox) => {
    checkbox.onchange = async () => {
      const skill = checkbox.dataset.skillToggle;
      const type = checkbox.dataset.toggleType;
      const current = getSkillState(participant, skill);
      const next = {
        proficient: type === 'proficient' ? checkbox.checked : current.proficient,
        expert: type === 'expert' ? checkbox.checked : current.expert
      };
      if (next.expert && !next.proficient) {
        next.proficient = true;
      }
      await patchParticipant(participant.id, { skills: { [skill]: next } });
    };
  });
}

function getFocusedParticipant() {
  return state.encounter.participants?.find((participant) => participant.id === focusId) || null;
}

function getCurrentParticipant() {
  const index = state.encounter.currentIndex;
  if (index == null || index < 0) return null;
  return state.encounter.participants?.[index] ?? null;
}

function updateUrl() {
  const url = new URL(window.location.href);
  if (focusId) {
    url.searchParams.set('id', focusId);
  } else {
    url.searchParams.delete('id');
  }
  window.history.replaceState(null, '', url);
}

async function patchParticipant(participantId, payload) {
  try {
    await api(`/api/participants/${participantId}`, 'PATCH', payload);
  } catch (err) {
    notify(err.message);
  }
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

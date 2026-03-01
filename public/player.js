const state = {
  encounter: { participants: [], log: [], round: 1, currentIndex: -1 },
  reference: { standardActions: [] },
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
    <div class="panel-header">
      <div>
        <h2>${participant.name}</h2>
        <p class="muted">Set Focus: ${participant.setFocus || '—'}</p>
      </div>
      <div class="muted">Round ${state.encounter.round}</div>
    </div>
    <div class="stats-grid">
      <label>HP
        <div class="stat-callout">${participant.hp} / ${participant.maxHp}</div>
      </label>
      <label>Shield
        <div class="stat-callout">${participant.shield} / ${participant.maxShield}</div>
      </label>
      <label>AP
        <div class="stat-callout">${participant.apCurrent} / ${participant.apMax}</div>
      </label>
      <label>Guard Restore
        <div class="stat-callout">${participant.guardRestore || 3}</div>
      </label>
      <label>Damage Bonus
        <div class="stat-callout">${participant.damageBonus || 0}</div>
      </label>
    </div>
    <div class="stats-grid">
      ${renderAbility(statEntry('STR', stats.strength))}
      ${renderAbility(statEntry('DEX', stats.dexterity))}
      ${renderAbility(statEntry('CON', stats.constitution))}
      ${renderAbility(statEntry('INT', stats.intelligence))}
      ${renderAbility(statEntry('WIS', stats.wisdom))}
      ${renderAbility(statEntry('CHA', stats.charisma))}
    </div>
    <div>
      <h3>Statuses</h3>
      <div class="status-list">
        ${renderStatuses(participant)}
      </div>
    </div>
    <div>
      <h3>Notes</h3>
      <p class="muted">${participant.notes || '—'}</p>
    </div>
    <div>
      <h3>Action Reference</h3>
      <ul class="reference-list">
        ${renderActionReference()}
      </ul>
    </div>
  `;
}

function renderAbility([label, value]) {
  return `
    <label>${label}
      <div class="stat-callout">${value}</div>
    </label>`;
}

function statEntry(label, value = 0) {
  return [label, value ?? 0];
}

function renderCards() {
  const participant = getFocusedParticipant();
  const cards = participant?.cards || [];
  if (!participant || !cards.length) {
    els.cardList.classList.add('empty-state');
    els.cardList.innerHTML = '<p class="empty-state">No cards tracked for this combatant.</p>';
    return;
  }
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

function renderActionReference() {
  const actions = state.reference?.standardActions || [];
  if (!actions.length) {
    return '<li>Waiting for tracker…</li>';
  }
  return actions
    .map((action) => `<li><strong>${action.label}</strong>: ${action.summary}</li>`)
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

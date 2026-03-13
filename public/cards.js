import { CARD_PRESETS, RARITY_ORDER } from './card-presets.js';
import { getCardTierShieldBonus } from './shared/card-rules.js';

const state = {
  participants: [],
  selectedCardId: CARD_PRESETS[0]?.id || null,
  selectedParticipantId: ''
};

const els = {
  list: document.getElementById('libraryList'),
  title: document.getElementById('libraryCardTitle'),
  detail: document.getElementById('libraryCardDetail'),
  participantSelect: document.getElementById('libraryParticipantSelect'),
  refresh: document.getElementById('refreshLibrary')
};

document.addEventListener('DOMContentLoaded', () => {
  const query = new URLSearchParams(window.location.search);
  state.selectedParticipantId = query.get('participantId') || '';
  wireEvents();
  loadParticipants();
  render();
});

function wireEvents() {
  els.participantSelect?.addEventListener('change', () => {
    state.selectedParticipantId = els.participantSelect.value || '';
    renderDetail();
  });
  els.refresh?.addEventListener('click', () => {
    loadParticipants();
  });
}

async function loadParticipants() {
  try {
    const response = await api('/api/state');
    state.participants = response?.state?.encounter?.participants || [];
    renderParticipantOptions();
    renderDetail();
  } catch (err) {
    notify(`Unable to load combatants: ${err.message}`);
  }
}

function render() {
  renderList();
  renderDetail();
}

function renderParticipantOptions() {
  if (!els.participantSelect) return;
  const options = ['<option value="">None selected</option>'];
  for (const participant of state.participants) {
    options.push(
      `<option value="${participant.id}" ${participant.id === state.selectedParticipantId ? 'selected' : ''}>${escapeHtml(participant.name)}</option>`
    );
  }
  els.participantSelect.innerHTML = options.join('');
}

function renderList() {
  const grouped = groupPresetsBySetAndRarity(CARD_PRESETS);
  const sets = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  if (!sets.length) {
    els.list.innerHTML = '<p class="empty-state">No preset cards configured.</p>';
    return;
  }

  els.list.innerHTML = sets
    .map((setName) => {
      const byRarity = grouped[setName];
      const rarityKeys = Object.keys(byRarity).sort(compareRarity);
      const rarityBlocks = rarityKeys
        .map((rarity) => {
          const cards = byRarity[rarity];
          const items = cards
            .map(
              (entry) => `
                <button
                  type="button"
                  class="library-card-link ${entry.id === state.selectedCardId ? 'is-active' : ''}"
                  data-library-card="${entry.id}"
                >
                  ${escapeHtml(entry.card.name)}
                </button>`
            )
            .join('');
          return `
            <details class="library-rarity-group">
              <summary>${escapeHtml(rarity)} (${cards.length})</summary>
              <div class="library-card-links">${items}</div>
            </details>
          `;
        })
        .join('');
      return `
        <details class="library-set-group">
          <summary>${escapeHtml(setName)}</summary>
          <div class="library-set-body">${rarityBlocks}</div>
        </details>
      `;
    })
    .join('');

  els.list.querySelectorAll('[data-library-card]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCardId = button.dataset.libraryCard;
      render();
    });
  });
}

function renderDetail() {
  const selected = CARD_PRESETS.find((entry) => entry.id === state.selectedCardId) || CARD_PRESETS[0];
  if (!selected) {
    els.title.textContent = 'Select a card';
    els.detail.innerHTML = 'Pick a card from the list to view details.';
    return;
  }

  const card = selected.card || {};
  els.title.textContent = selected.card?.name || selected.name;
  els.detail.innerHTML = `
    <div class="library-detail-grid">
      <div>
        <p><strong>Set:</strong> ${escapeHtml(card.set || '-')}</p>
        <p><strong>Type:</strong> ${escapeHtml(card.type || '-')}</p>
        <p><strong>Tier:</strong> ${escapeHtml(card.tier || '-')}</p>
        <p><strong>AP Cost:</strong> ${Number(card.apCost || 0)}</p>
        <p><strong>Range:</strong> ${formatCardRange(card)}</p>
        <p><strong>Health Bonus:</strong> ${Number(card.healthBonus || 0)}</p>
        <p><strong>Shield Bonus:</strong> ${Number(card.shieldBonus ?? getCardTierShieldBonus(card.tier))}</p>
        <p><strong>Damage:</strong> ${Number(card.damage || 0)} ${escapeHtml(card.damageType || '')}</p>
        <p><strong>Tags:</strong> ${escapeHtml((card.tags || []).join(', ') || '-')}</p>
      </div>
      <div>
        <p><strong>Effect:</strong> ${escapeHtml(card.effect || '-')}</p>
        <p><strong>Mastery:</strong></p>
        <ul>
          ${(card.mastery || [])
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('') || '<li>-</li>'}
        </ul>
      </div>
    </div>
    <div class="card-actions">
      <button type="button" id="libraryExportCard">Export Card</button>
      <button type="button" id="libraryAddCard" ${state.selectedParticipantId ? '' : 'disabled'}>
        Add to Selected Combatant
      </button>
    </div>
  `;

  els.detail.querySelector('#libraryExportCard')?.addEventListener('click', () => {
    downloadJson(selected.card, `${slugify(selected.card?.name || selected.name)}.json`);
  });

  els.detail.querySelector('#libraryAddCard')?.addEventListener('click', async () => {
    if (!state.selectedParticipantId) {
      notify('Select a combatant first.');
      return;
    }
    const participant = state.participants.find((entry) => entry.id === state.selectedParticipantId);
    if (!participant) {
      notify('Selected combatant not found.');
      return;
    }
    const normalizedCard = normalizeCardForAdd(selected.card);
    try {
      await api(`/api/participants/${participant.id}`, 'PATCH', {
        cards: [...(participant.cards || []), normalizedCard]
      });
      notify(`Added ${selected.card?.name || selected.name} to ${participant.name}.`);
      await loadParticipants();
    } catch (err) {
      notify(`Unable to add card: ${err.message}`);
    }
  });
}

function groupPresetsBySetAndRarity(list = []) {
  const grouped = {};
  for (const preset of list) {
    const card = preset.card || {};
    const setName = String(card.set || 'Unsorted').trim() || 'Unsorted';
    const rarity = String(card.tier || 'Common').trim() || 'Common';
    grouped[setName] = grouped[setName] || {};
    grouped[setName][rarity] = grouped[setName][rarity] || [];
    grouped[setName][rarity].push(preset);
  }
  return grouped;
}

function compareRarity(a, b) {
  const aIndex = RARITY_ORDER.findIndex((entry) => entry.toLowerCase() === String(a).toLowerCase());
  const bIndex = RARITY_ORDER.findIndex((entry) => entry.toLowerCase() === String(b).toLowerCase());
  if (aIndex === -1 && bIndex === -1) return String(a).localeCompare(String(b));
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function normalizeCardForAdd(raw = {}) {
  const rangeRaw = raw.range;
  const parsedRange = Number(rangeRaw || 0);
  const rangeText = String(raw.rangeText || '').trim() || (!Number.isFinite(parsedRange) && String(rangeRaw || '').trim() ? String(rangeRaw).trim() : '');
  const tier = String(raw.tier || 'Common').trim() || 'Common';
  const explicitShieldSource = raw.shieldBonus ?? raw.bonusShield;
  const explicitShieldBonus =
    explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
  const shieldBonus = Number.isFinite(explicitShieldBonus)
    ? explicitShieldBonus
    : getCardTierShieldBonus(tier);
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : String(raw.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
  return {
    ...raw,
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    name: String(raw.name || 'Card').trim(),
    set: String(raw.set || '').trim(),
    type: String(raw.type || 'Attack').trim(),
    tier,
    apCost: Number(raw.apCost || 0),
    range: Number.isFinite(parsedRange) ? parsedRange : 0,
    rangeText,
    healthBonus: Number(raw.healthBonus || 0),
    shieldBonus,
    damage: Number(raw.damage || 0),
    damageType: String(raw.damageType || '').trim(),
    tags,
    mastery: Array.isArray(raw.mastery) ? raw.mastery : [],
    masteryThresholds: raw.masteryThresholds || { level2: 25, level3: 55 },
    masteryDamageByLevel: raw.masteryDamageByLevel || undefined
  };
}

function formatCardRange(card = {}) {
  const text = String(card.rangeText || '').trim();
  if (text) return text;
  const range = Number(card.range || 0);
  return `${range} ft`;
}

async function api(path, method = 'GET', payload) {
  const response = await fetch(path, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function notify(message) {
  window.alert(message);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value || 'card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

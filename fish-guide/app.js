/* ============================================================
   FISH GUIDE — app.js
   Vanilla JS, без сборки, без зависимостей.
   ============================================================ */

(function () {
  'use strict';

  // ---- словари для тегов ----
  const DIFFICULTY_LABELS = {
    'beginner':        'Новичок',
    'beginner-medium': 'Новичок / средний',
    'medium':          'Средний',
    'medium-advanced': 'Средний / продвинутый',
    'advanced':        'Продвинутый'
  };

  const DIFFICULTY_ORDER = {
    'beginner': 1,
    'beginner-medium': 2,
    'medium': 3,
    'medium-advanced': 4,
    'advanced': 5
  };

  const ACTIVITY_LABELS = {
    'day':   'День',
    'dusk':  'Сумерки',
    'night': 'Ночь'
  };

  const SEASON_LABELS = {
    'spring': 'Весна',
    'summer': 'Лето',
    'autumn': 'Осень',
    'winter': 'Зима'
  };

  const SEASON_ORDER = {
    'spring': 1, 'summer': 2, 'autumn': 3, 'winter': 4
  };

  const WATER_LABELS = {
    'river':     'Река',
    'lake':      'Озеро',
    'reservoir': 'Водохранилище'
  };

  const DEPTH_LABELS = {
    'surface': 'Поверхность',
    'middle':  'Средний слой',
    'bottom':  'Дно',
    'all':     'Все горизонты'
  };

  const TAB_KEYS = [
    { key: 'biology',        label: 'Биология' },
    { key: 'seasonality',    label: 'Сезонность' },
    { key: 'location',       label: 'Где искать' },
    { key: 'fishing_method', label: 'Методика' },
    { key: 'bite_and_fight', label: 'Поклёвка' },
    { key: 'practical',      label: 'Практика' }
  ];

  // ---- state ----
  let fishData = [];
  let currentSort = 'name';
  let currentFishId = null;
  let extendedOpen = false;
  let activeTab = 'biology';

  // ---- DOM ----
  const indexView = document.getElementById('index-view');
  const fishView = document.getElementById('fish-view');
  const fishGrid = document.getElementById('fish-grid');
  const fishCard = document.getElementById('fish-card');
  const backBtn = document.getElementById('back-to-index');
  const sortBtns = document.querySelectorAll('.sort-btn');

  // ============ INIT ============
  async function init() {
    try {
      const res = await fetch('data/fish-data.json');
      const data = await res.json();
      fishData = data.fish || [];
      renderIndex();
      bindEvents();
      handleHash();
    } catch (err) {
      console.error('Не удалось загрузить fish-data.json', err);
      fishGrid.innerHTML = '<p style="color:var(--muted);padding:40px 0;text-align:center;">Не удалось загрузить базу данных.</p>';
    }
  }

  function bindEvents() {
    sortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sort = btn.getAttribute('data-sort');
        if (sort === currentSort) return;
        currentSort = sort;
        sortBtns.forEach(b => b.classList.toggle('sort-btn--active', b === btn));
        renderIndex();
      });
    });

    backBtn.addEventListener('click', () => {
      currentFishId = null;
      extendedOpen = false;
      window.location.hash = '';
      showIndex();
    });

    window.addEventListener('hashchange', handleHash);
  }

  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && fishData.find(f => f.id === hash)) {
      openFish(hash);
    } else {
      showIndex();
    }
  }

  // ============ INDEX (картотека) ============
  function renderIndex() {
    const sorted = [...fishData].sort(sortFn(currentSort));
    fishGrid.innerHTML = sorted.map(previewCard).join('');
    fishGrid.querySelectorAll('.preview-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        window.location.hash = id;
      });
    });
  }

  function sortFn(mode) {
    if (mode === 'difficulty') {
      return (a, b) =>
        (DIFFICULTY_ORDER[a.tags.difficulty] || 99) -
        (DIFFICULTY_ORDER[b.tags.difficulty] || 99);
    }
    if (mode === 'season') {
      return (a, b) => {
        const sa = (a.tags.main_season || [])[0] || 'winter';
        const sb = (b.tags.main_season || [])[0] || 'winter';
        return (SEASON_ORDER[sa] || 99) - (SEASON_ORDER[sb] || 99);
      };
    }
    return (a, b) => a.name.localeCompare(b.name, 'ru');
  }

  function previewCard(fish) {
    return `
      <div class="preview-card" data-id="${fish.id}" tabindex="0" role="button" aria-label="Открыть карточку: ${esc(fish.name)}">
        <div class="preview-image">
          <object type="image/svg+xml" data="${esc(fish.image)}" aria-hidden="true"></object>
        </div>
        <div class="preview-body">
          <div class="preview-name">${esc(fish.name)}</div>
          <div class="preview-latin">${esc(fish.latin)}</div>
          <div class="preview-tagline">${esc(fish.tagline)}</div>
          <div class="preview-tags">
            ${renderTags(fish.tags, true)}
          </div>
        </div>
      </div>
    `;
  }

  // ============ FISH CARD ============
  function openFish(id) {
    const fish = fishData.find(f => f.id === id);
    if (!fish) { showIndex(); return; }
    currentFishId = id;
    extendedOpen = false;
    activeTab = 'biology';
    renderFishCard(fish);
    showFishView();
    window.scrollTo(0, 0);
  }

  function showIndex() {
    indexView.classList.add('view--active');
    fishView.hidden = true;
    fishView.classList.remove('view--active');
    indexView.hidden = false;
  }

  function showFishView() {
    indexView.classList.remove('view--active');
    indexView.hidden = true;
    fishView.hidden = false;
    fishView.classList.add('view--active');
  }

  function renderFishCard(fish) {
    fishCard.innerHTML = `
      <div class="card-hero">
        <div class="hero-image">
          <object type="image/svg+xml" data="${esc(fish.image)}" aria-hidden="true"></object>
        </div>
        <div class="hero-info">
          <div class="hero-name">${esc(fish.name)}</div>
          <div class="hero-latin">${esc(fish.latin)}</div>
          <div class="hero-tagline">${esc(fish.tagline)}</div>
          <div class="hero-tags">${renderTags(fish.tags, false)}</div>
        </div>
      </div>

      ${renderShort(fish.short)}

      <button class="expand-button" id="expand-btn" aria-expanded="false">
        <span id="expand-label">Подробнее</span>
        <span class="arrow">▼</span>
      </button>

      <div class="extended-section" id="extended-section" hidden>
        ${renderExtended(fish.extended)}
      </div>
    `;

    const expandBtn = document.getElementById('expand-btn');
    expandBtn.addEventListener('click', toggleExtended);

    fishCard.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderTabs();
      });
    });
  }

  function toggleExtended() {
    extendedOpen = !extendedOpen;
    const section = document.getElementById('extended-section');
    const btn = document.getElementById('expand-btn');
    const label = document.getElementById('expand-label');
    if (extendedOpen) {
      section.hidden = false;
      section.classList.add('extended-section--open');
      btn.classList.add('expand-button--open');
      btn.setAttribute('aria-expanded', 'true');
      label.textContent = 'Скрыть подробности';
      setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } else {
      section.hidden = true;
      section.classList.remove('extended-section--open');
      btn.classList.remove('expand-button--open');
      btn.setAttribute('aria-expanded', 'false');
      label.textContent = 'Подробнее';
    }
  }

  function renderTabs() {
    fishCard.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('tab-btn--active', b.getAttribute('data-tab') === activeTab);
    });
    fishCard.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('tab-panel--active', p.getAttribute('data-panel') === activeTab);
    });
  }

  // ============ SHORT CARD ============
  function renderShort(short) {
    if (!short) return '';
    const kf = short.key_facts || {};
    const wf = short.where_to_find || {};
    const hf = short.how_to_fish || {};
    const bf = short.bite_and_fight || {};
    const pr = short.practical || {};

    return `
      ${short.summary ? `
        <div class="short-section">
          <div class="short-block short-block--summary">
            <h3>Кратко</h3>
            <p>${esc(short.summary)}</p>
          </div>
        </div>
      ` : ''}

      <div class="short-section">
        <div class="short-block">
          <h3>Ключевые параметры</h3>
          <ul class="facts-list">
            ${factRow('Размер', kf.typical_size)}
            ${factRow('Трофей', kf.trophy)}
            ${factRow('Поведение', kf.behavior)}
            ${factRow('Горизонт', kf.depth)}
            ${factRow('Активность', kf.activity)}
          </ul>
        </div>

        <div class="short-block">
          <h3>Где искать</h3>
          <ul class="facts-list">
            ${factRow('Водоём', wf.water_type)}
            ${factRow('Места', wf.spots)}
            ${factRow('Сезон', wf.season)}
          </ul>
        </div>

        <div class="short-block">
          <h3>Как ловить</h3>
          <ul class="facts-list">
            ${factRow('Снасть', hf.rod)}
            ${factRow('Шнур', hf.line)}
            ${factRow('Приманки', hf.lures)}
            ${factRow('Проводка', hf.retrieve)}
            ${factRow('Горизонт', hf.depth_level)}
          </ul>
        </div>

        <div class="short-block">
          <h3>Поклёвка и борьба</h3>
          <ul class="facts-list">
            ${factRow('Поклёвка', bf.bite)}
            ${factRow('Борьба', bf.fight)}
            ${factRow('Риск', bf.risk)}
          </ul>
        </div>

        <div class="short-block" style="grid-column: 1 / -1;">
          <h3>Практика</h3>
          <div class="practical-grid">
            <div class="practical-item">
              <span class="fact-label">Мин. размер</span>
              <strong>${pr.min_size_cm ? pr.min_size_cm + ' см' : '—'}</strong>
              <small>${esc(pr.min_size_note || '')}</small>
            </div>
            <div class="practical-item">
              <span class="fact-label">Съедобность</span>
              <small style="margin-top:4px;">${esc(pr.edibility || '')}</small>
            </div>
            <div class="practical-item">
              <span class="fact-label">Спорт. ценность</span>
              <small style="margin-top:4px;">${esc(pr.sport_value || '')}</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function factRow(label, value) {
    if (!value) return '';
    return `<li><span class="fact-label">${esc(label)}</span><span class="fact-value">${esc(value)}</span></li>`;
  }

  // ============ EXTENDED CARD ============
  function renderExtended(extended) {
    if (!extended) return '';

    const tabs = TAB_KEYS.map(t => {
      const section = extended[t.key];
      if (!section) return '';
      const active = t.key === activeTab;
      return `<button class="tab-btn ${active ? 'tab-btn--active' : ''}" data-tab="${t.key}">${esc(t.label)}</button>`;
    }).join('');

    const panels = TAB_KEYS.map(t => {
      const section = extended[t.key];
      if (!section) return '';
      const active = t.key === activeTab;
      const blocks = (section.blocks || []).map(b => `
        <div class="ext-block">
          <h4>${esc(b.label)}</h4>
          <p>${esc(b.text)}</p>
        </div>
      `).join('');
      return `<div class="tab-panel ${active ? 'tab-panel--active' : ''}" data-panel="${t.key}">${blocks}</div>`;
    }).join('');

    return `
      <div class="tabs-bar" role="tablist">${tabs}</div>
      ${panels}
    `;
  }

  // ============ TAGS ============
  function renderTags(tags, compact) {
    if (!tags) return '';
    const out = [];

    if (tags.difficulty) {
      out.push(`<span class="tag tag--difficulty-${diffShortKey(tags.difficulty)}">${esc(DIFFICULTY_LABELS[tags.difficulty] || tags.difficulty)}</span>`);
    }

    (tags.activity_time || []).forEach(a => {
      out.push(`<span class="tag">${esc(ACTIVITY_LABELS[a] || a)}</span>`);
    });

    if (!compact) {
      (tags.main_season || []).forEach(s => {
        out.push(`<span class="tag">${esc(SEASON_LABELS[s] || s)}</span>`);
      });
      if (tags.depth) {
        out.push(`<span class="tag">${esc(DEPTH_LABELS[tags.depth] || tags.depth)}</span>`);
      }
      (tags.water_type || []).forEach(w => {
        out.push(`<span class="tag">${esc(WATER_LABELS[w] || w)}</span>`);
      });
    } else {
      // на превью только сезон, чтобы не было мешанины
      const season = (tags.main_season || [])[0];
      if (season) out.push(`<span class="tag">${esc(SEASON_LABELS[season])}</span>`);
    }

    return out.join('');
  }

  function diffShortKey(d) {
    if (d === 'beginner' || d === 'beginner-medium') return 'beginner';
    if (d === 'advanced' || d === 'medium-advanced') return 'advanced';
    return 'medium';
  }

  // ============ utils ============
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============ GO ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

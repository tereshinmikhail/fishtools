/* ============================================================
   Alternative fish guide — practical field interface
   Uses ../fish-guide/data/fish-data.json as the single source of truth.
   ============================================================ */
(function(){
  'use strict';

  const LABELS = {
    difficulty: {
      'beginner': 'Новичок',
      'beginner-medium': 'Новичок / средний',
      'medium': 'Средний',
      'medium-advanced': 'Средний / продвинутый',
      'advanced': 'Продвинутый'
    },
    season: { spring:'Весна', summer:'Лето', autumn:'Осень', winter:'Зима' },
    activity: { day:'День', dusk:'Сумерки', night:'Ночь' },
    water: { river:'Река', lake:'Озеро', reservoir:'Водохранилище' },
    depth: { surface:'Поверхность', middle:'Средний слой', bottom:'Дно', all:'Все горизонты' }
  };

  let fishData = [];
  const state = { search:'', season:'all', difficulty:'all' };

  const $ = (sel, root=document) => root.querySelector(sel);
  const fishList = $('#fish-list');
  const searchInput = $('#search-input');

  init();

  async function init(){
    try{
      const res = await fetch('../fish-guide/data/fish-data.json');
      const data = await res.json();
      fishData = data.fish || [];
      renderStats();
      renderFilters();
      bindEvents();
      render();
    }catch(err){
      console.error(err);
      fishList.innerHTML = '<div class="empty">Не удалось загрузить базу fish-data.json</div>';
    }
  }

  function bindEvents(){
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  function renderStats(){
    $('#hero-stats').innerHTML = `
      <div><strong>${fishData.length}</strong><span>видов</span></div>
      <div><strong>${uniqueSeasons().length}</strong><span>сезона</span></div>
      <div><strong>${uniqueWaters().length}</strong><span>типа водоёмов</span></div>
    `;
  }

  function renderFilters(){
    const seasonBox = $('#season-filters');
    const diffBox = $('#difficulty-filters');
    seasonBox.innerHTML = chip('all','Все',state.season==='all','season') + uniqueSeasons().map(s => chip(s, LABELS.season[s] || s, state.season===s, 'season')).join('');
    diffBox.innerHTML = chip('all','Все',state.difficulty==='all','difficulty') + uniqueDifficulties().map(d => chip(d, LABELS.difficulty[d] || d, state.difficulty===d, 'difficulty')).join('');

    seasonBox.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => { state.season = btn.dataset.value; renderFilters(); render(); }));
    diffBox.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => { state.difficulty = btn.dataset.value; renderFilters(); render(); }));
  }

  function chip(value,label,active,group){
    return `<button class="chip ${active ? 'chip--active' : ''}" data-group="${group}" data-value="${esc(value)}">${esc(label)}</button>`;
  }

  function render(){
    const list = fishData.filter(matches).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    if(!list.length){
      fishList.innerHTML = '<div class="empty">Ничего не найдено. Попробуй снять фильтр или изменить запрос.</div>';
      return;
    }
    fishList.innerHTML = list.map(card).join('');
  }

  function matches(f){
    const tags = f.tags || {};
    if(state.season !== 'all' && !(tags.main_season || []).includes(state.season)) return false;
    if(state.difficulty !== 'all' && tags.difficulty !== state.difficulty) return false;
    if(!state.search) return true;
    return searchableText(f).includes(state.search);
  }

  function searchableText(f){
    const chunks = [f.name, f.latin, f.tagline, JSON.stringify(f.short || {}), JSON.stringify(f.extended || {})];
    return chunks.join(' ').toLowerCase();
  }

  function card(f){
    const short = f.short || {};
    const tags = f.tags || {};
    const where = short.where_to_find || {};
    const how = short.how_to_fish || {};
    const bite = short.bite_and_fight || {};
    const practical = short.practical || {};
    return `
      <article class="fish-card" id="${esc(f.id)}">
        <div class="fish-main">
          <div class="fish-image"><object type="image/svg+xml" data="../fish-guide/${esc(f.image)}" aria-hidden="true"></object></div>
          <div>
            <div class="fish-head">
              <div>
                <h2 class="fish-name">${esc(f.name)}</h2>
                <div class="fish-latin">${esc(f.latin)}</div>
              </div>
              <div class="tags">${tagsHtml(tags)}</div>
            </div>
            <p class="fish-tagline">${esc(f.tagline || short.summary || '')}</p>
            <div class="quick-grid">
              <div class="quick-item"><span class="card-label">Где искать</span><p>${esc(where.spots || where.water_type || '—')}</p></div>
              <div class="quick-item"><span class="card-label">Чем ловить</span><p>${esc(how.lures || how.rod || '—')}</p></div>
              <div class="quick-item"><span class="card-label">Поклёвка</span><p>${esc(bite.bite || '—')}</p></div>
            </div>
          </div>
        </div>
        <details class="details">
          <summary>Развернуть практическую карточку</summary>
          <div class="deep-grid">
            ${deepBlock('Снасть', [how.rod, how.line].filter(Boolean).join('\n'))}
            ${deepBlock('Проводка', how.retrieve)}
            ${deepBlock('Сезон и место', [where.season, where.water_type, where.spots].filter(Boolean).join('\n'))}
            ${deepBlock('Борьба и риск', [bite.fight, bite.risk].filter(Boolean).join('\n'))}
            ${deepBlock('Норматив и практика', [practical.min_size_cm ? 'Мин. размер: ' + practical.min_size_cm + ' см' : '', practical.min_size_note, practical.edibility, practical.sport_value].filter(Boolean).join('\n'))}
            ${firstExtendedBlock(f.extended)}
          </div>
        </details>
      </article>
    `;
  }

  function deepBlock(title, text){
    if(!text) return '';
    return `<div class="deep-block"><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
  }

  function firstExtendedBlock(extended){
    const blocks = extended && extended.biology && extended.biology.blocks ? extended.biology.blocks : [];
    if(!blocks.length) return '';
    const b = blocks[0];
    return deepBlock(b.label || 'Дополнительно', b.text || '');
  }

  function tagsHtml(tags){
    const out = [];
    if(tags.difficulty) out.push(`<span class="tag ${difficultyClass(tags.difficulty)}">${esc(LABELS.difficulty[tags.difficulty] || tags.difficulty)}</span>`);
    (tags.main_season || []).forEach(s => out.push(`<span class="tag tag--gold">${esc(LABELS.season[s] || s)}</span>`));
    (tags.activity_time || []).forEach(a => out.push(`<span class="tag">${esc(LABELS.activity[a] || a)}</span>`));
    if(tags.depth) out.push(`<span class="tag">${esc(LABELS.depth[tags.depth] || tags.depth)}</span>`);
    return out.join('');
  }

  function difficultyClass(d){
    if(d === 'beginner' || d === 'beginner-medium') return 'tag--green';
    if(d === 'advanced' || d === 'medium-advanced') return 'tag--red';
    return 'tag--gold';
  }

  function uniqueSeasons(){
    return [...new Set(fishData.flatMap(f => (f.tags && f.tags.main_season) || []))];
  }
  function uniqueWaters(){
    return [...new Set(fishData.flatMap(f => (f.tags && f.tags.water_type) || []))];
  }
  function uniqueDifficulties(){
    return [...new Set(fishData.map(f => f.tags && f.tags.difficulty).filter(Boolean))];
  }

  function esc(v){
    if(v === null || v === undefined) return '';
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();

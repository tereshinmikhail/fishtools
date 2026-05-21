/* ============================================================
   App entry point — silicone lure outfit configurator
   ============================================================ */

(function() {
  'use strict';

  // ---------- State ----------
  const STATE = {
    luresData: null,
    hooksData: null,
    rules: null,
    formValues: {},
    activeTypeFilter: 'all'
  };

  // ---------- Helpers ----------

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'class')      node.className = v;
      else if (k === 'html')  node.innerHTML = v;
      else if (k === 'text')  node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'attrs') Object.entries(v).forEach(([ak, av]) => node.setAttribute(ak, av));
      else node[k] = v;
    });
    children.flat().forEach(c => {
      if (c == null) return;
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  };

  // Map of internal type → CSS class
  const TYPE_CLASS = {
    'виброхвост':  't-vibro',
    'твистер':     't-twister',
    'слаг':        't-slug',
    'рак':         't-craw',
    'креатура':    't-creature',
    'червь':       't-worm'
  };

  // Format fish names for display (strip _мелкий etc.)
  const formatFish = (raw) => {
    return raw
      .replace(/_крупный/g, ' (крупный)')
      .replace(/_мелкий/g, ' (мелкий)')
      .replace(/_трофейный/g, ' (трофейный)')
      .replace(/_до_1\.5кг/g, ' (до 1.5 кг)')
      .replace(/_до_2кг/g, ' (до 2 кг)')
      .replace(/_малый/g, ' (малый)')
      .replace(/трофейная_щука/g, 'щука (трофейная)')
      .replace(/_/g, ' ');
  };

  const formatSeason = (s) => ({
    spring: 'весна', summer: 'лето', autumn: 'осень',
    winter_open: 'зима (открытая вода)',
    early_autumn: 'ранняя осень', late_autumn: 'поздняя осень'
  })[s] || s;

  // Round weight to the nearest standard chebourashka weight
  const roundToStandardWeight = (w, standardWeights) => {
    if (w <= 0) return standardWeights[0];
    return standardWeights.reduce((prev, curr) =>
      Math.abs(curr - w) < Math.abs(prev - w) ? curr : prev
    );
  };

  // ---------- Data loading ----------

  async function loadData() {
    try {
      const [lures, hooks, rules] = await Promise.all([
        fetch('data/lures_data.json').then(r => r.json()),
        fetch('data/hooks_reference.json').then(r => r.json()),
        fetch('data/recommendation_rules.json').then(r => r.json())
      ]);
      STATE.luresData = lures;
      STATE.hooksData = hooks;
      STATE.rules = rules;
      return true;
    } catch (e) {
      console.error('Data loading failed:', e);
      document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#e08080">' +
        '<h2 style="font-family:Bebas Neue;letter-spacing:2px">Ошибка загрузки данных</h2>' +
        '<p style="margin-top:16px;font-family:monospace">' + e.message + '</p>' +
        '<p style="margin-top:16px;font-size:13px;color:#8b919b">Если ты открыл файл напрямую в браузере (file://), нужно запустить через локальный сервер. Подробнее в README.</p>' +
        '</div>';
      return false;
    }
  }

  // ---------- Tab switching ----------

  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        $$('.tab').forEach(t => {
          t.classList.toggle('tab--active', t === tab);
          t.setAttribute('aria-selected', t === tab);
        });
        $$('.panel').forEach(p => {
          const active = p.dataset.panel === target;
          p.classList.toggle('panel--active', active);
          p.hidden = !active;
        });
      });
    });
  }

  // ============================================================
  //   CONFIGURATOR
  // ============================================================

  function renderConfiguratorForm() {
    const form = $('#configurator-form');
    const inputs = STATE.rules.user_inputs;

    // Order of fields in the form
    const order = [
      'size_inches', 'lure_type', 'target_fish',
      'season', 'depth', 'current',
      'water_body', 'cover', 'brand_preference'
    ];

    form.innerHTML = '';

    order.forEach(key => {
      const cfg = inputs[key];
      if (!cfg) return;

      const field = el('div', { class: 'form-field' });

      const labelClass = (key === 'size_inches' || key === 'lure_type') ? 'form-label form-label--required' : 'form-label';
      field.appendChild(el('label', { class: labelClass, text: cfg.label }));

      if (cfg.type === 'single_select') {
        const select = el('select', {
          class: 'form-control',
          id: 'field-' + key,
          onChange: (e) => {
            STATE.formValues[key] = e.target.value || null;
          }
        });
        select.appendChild(el('option', { value: '', text: '— не выбрано —' }));
        cfg.options.forEach(opt => {
          const value = typeof opt === 'object' ? opt.value : String(opt);
          const label = typeof opt === 'object' ? opt.label : String(opt) + '″';
          select.appendChild(el('option', { value, text: label }));
        });
        field.appendChild(select);
      }
      else if (cfg.type === 'multi_select') {
        const chipsBox = el('div', { class: 'chips' });
        STATE.formValues[key] = [];
        cfg.options.forEach(opt => {
          const chip = el('button', {
            class: 'chip',
            type: 'button',
            text: opt,
            onClick: () => {
              const arr = STATE.formValues[key];
              const idx = arr.indexOf(opt);
              if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove('chip--selected'); }
              else { arr.push(opt); chip.classList.add('chip--selected'); }
            }
          });
          chipsBox.appendChild(chip);
        });
        field.appendChild(chipsBox);
      }

      form.appendChild(field);
    });

    // Reset behaviour
    $('#config-reset').addEventListener('click', () => {
      STATE.formValues = {};
      $$('.form-control').forEach(c => c.value = '');
      $$('.chip--selected').forEach(c => c.classList.remove('chip--selected'));
      const result = $('#configurator-result');
      result.innerHTML = '';
      result.hidden = true;
    });

    // Submit
    $('#config-submit').addEventListener('click', handleConfigSubmit);
  }

  // -- Configurator: recommendation engine --

  function handleConfigSubmit() {
    const v = STATE.formValues;

    // Validation
    if (!v.size_inches || !v.lure_type) {
      showResultError('Выбери хотя бы размер и тип приманки.');
      return;
    }

    const size = parseFloat(v.size_inches);
    const lure = STATE.luresData.lures.find(l =>
      l.size_inches === size && l.type === v.lure_type
    );

    if (!lure) {
      showResultError(`Комбинация «${v.size_inches}″ ${v.lure_type}» отсутствует в базе. Попробуй другое сочетание.`);
      return;
    }

    const rec = buildRecommendation(lure, v);
    renderResult(lure, v, rec);
  }

  function buildRecommendation(lure, inputs) {
    const r = STATE.rules;

    // Weight calculation
    const depthMult = (inputs.depth && r.weight_calculation.depth_multipliers[inputs.depth]) || 1.0;
    const currMult  = (inputs.current && r.weight_calculation.current_multipliers[inputs.current]) || 1.0;
    const rawWeight = lure.weight_base_g * depthMult * currMult;
    const roundedWeight = roundToStandardWeight(rawWeight, r.weight_calculation.standard_weights_g);

    // Parse weight_extreme_g for overflow check
    const extremeStr = String(lure.weight_extreme_g);
    const extremeMatch = extremeStr.match(/(\d+(?:\.\d+)?)\s*$|(\d+(?:\.\d+)?)\s*–\s*(\d+(?:\.\d+)?)/);
    const extremeMax = extremeMatch ? parseFloat(extremeMatch[3] || extremeMatch[1]) : 999;

    const weightOverflow = roundedWeight > extremeMax;

    // Weight reasoning
    const weightNotes = [];
    if (depthMult !== 1.0) weightNotes.push(`глубина ×${depthMult}`);
    if (currMult !== 1.0)  weightNotes.push(`течение ×${currMult}`);

    // Hook priority by cover
    const coverPriority = (inputs.cover && lure.hook_priority_by_cover[inputs.cover]) || lure.hook_priority_by_cover.clean || 'single';

    // Recommended rig
    const rig = pickRig(lure, inputs, r);

    // Fish check
    const fishCheck = checkFish(lure, inputs.target_fish);

    // Incompatible combos
    const warnings = checkIncompatibilities(lure, inputs, r);

    // Brand filter
    const brandPref = inputs.brand_preference || 'any';

    // Seasonality note
    const seasonNote = buildSeasonNote(lure, inputs.season, r);

    return {
      weight: {
        recommended: roundedWeight,
        raw: rawWeight,
        notes: weightNotes,
        overflow: weightOverflow,
        typical: lure.weight_typical_g,
        extreme: lure.weight_extreme_g
      },
      hookPriority: coverPriority,
      rig,
      fishCheck,
      warnings,
      brandPref,
      seasonNote
    };
  }

  function pickRig(lure, inputs, rules) {
    // Check explicit rules
    for (const rule of rules.rig_priority_by_conditions.rules) {
      const c = rule.conditions;
      let matches = true;
      for (const [k, expected] of Object.entries(c)) {
        const actual = (k === 'target_fish') ? inputs.target_fish : (k === 'lure_type' ? lure.type : inputs[k]);
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            if (!actual.some(a => expected.includes(a))) { matches = false; break; }
          } else {
            if (!expected.includes(actual)) { matches = false; break; }
          }
        } else if (actual !== expected) { matches = false; break; }
      }
      if (matches && lure.rigs.includes(rule.priority)) {
        return { name: rule.priority, reason: rule.reasoning };
      }
    }
    // Default: first rig in list
    return { name: lure.rigs[0], reason: 'базовый монтаж для этой приманки' };
  }

  function checkFish(lure, selectedFish) {
    if (!selectedFish || selectedFish.length === 0) {
      return { status: 'no_selection', recommended: lure.target_fish };
    }
    const primary = lure.target_fish.primary || [];
    const secondary = lure.target_fish.secondary || [];

    const matchPrimary = selectedFish.filter(f => primary.some(p => p.startsWith(f)));
    const matchSecondary = selectedFish.filter(f => secondary.some(p => p.startsWith(f)));
    const noMatch = selectedFish.filter(f => !primary.some(p => p.startsWith(f)) && !secondary.some(p => p.startsWith(f)));

    return {
      status: noMatch.length === selectedFish.length ? 'no_match' :
              matchPrimary.length > 0 ? 'good' : 'marginal',
      matchPrimary,
      matchSecondary,
      noMatch,
      recommended: lure.target_fish
    };
  }

  function checkIncompatibilities(lure, inputs, rules) {
    const warnings = [];
    for (const rule of rules.incompatible_combinations.rules) {
      const cond = rule.if;
      let matches = true;
      for (const [k, expected] of Object.entries(cond)) {
        if (k === 'exclude') continue;
        const actual = (k === 'lure_type') ? lure.type :
                       (k === 'size_inches') ? lure.size_inches :
                       (k === 'target_fish') ? inputs.target_fish : inputs[k];
        if (Array.isArray(expected)) {
          if (Array.isArray(actual)) {
            if (!actual.some(a => expected.includes(a))) { matches = false; break; }
          } else if (!expected.includes(actual)) { matches = false; break; }
        } else if (actual !== expected) { matches = false; break; }
      }
      if (matches) warnings.push({ text: rule.warning, severity: rule.severity });
    }
    return warnings;
  }

  function buildSeasonNote(lure, selectedSeason, rules) {
    if (!selectedSeason) return null;
    const seas = lure.seasonality || {};
    const isBest = (seas.best || []).includes(selectedSeason) || (seas.best || []).some(s => s.includes(selectedSeason));
    const isGood = (seas.good || []).includes(selectedSeason);
    const isMarginal = (seas.marginal || []).includes(selectedSeason);

    if (isBest) return { status: 'best', text: 'Это лучший сезон для такой связки.' };
    if (isGood) return { status: 'good', text: 'Хороший сезон для этой связки.' };
    if (isMarginal) return { status: 'marginal', text: 'Сезон не лучший. Связка может работать слабее ожидаемого.' };
    return null;
  }

  // -- Render result --

  function showResultError(msg) {
    const result = $('#configurator-result');
    result.innerHTML = '';
    result.hidden = false;
    result.appendChild(el('div', { class: 'alert alert--error' },
      el('span', { class: 'alert-icon', text: '!' }),
      el('div', { text: msg })
    ));
  }

  function renderResult(lure, inputs, rec) {
    const result = $('#configurator-result');
    result.innerHTML = '';
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Header
    const header = el('div', { class: 'result-header' });
    header.appendChild(el('div', { class: 'result-title', text: `Рекомендация для ${lure.size_inches}″ ${lure.type}` }));
    const subtitleParts = [];
    if (inputs.depth) subtitleParts.push(STATE.rules.user_inputs.depth.options.find(o => o.value === inputs.depth)?.label);
    if (inputs.current) subtitleParts.push(STATE.rules.user_inputs.current.options.find(o => o.value === inputs.current)?.label + ' течение');
    if (inputs.cover) subtitleParts.push(STATE.rules.user_inputs.cover.options.find(o => o.value === inputs.cover)?.label);
    if (subtitleParts.length) {
      header.appendChild(el('div', { class: 'result-subtitle', text: subtitleParts.join(' · ') }));
    }
    result.appendChild(header);

    // Warnings (incompatibilities)
    rec.warnings.forEach(w => {
      result.appendChild(el('div', { class: 'alert ' + (w.severity === 'high' ? 'alert--error' : 'alert--warn') },
        el('span', { class: 'alert-icon', text: w.severity === 'high' ? '!' : '?' }),
        el('div', { text: w.text })
      ));
    });

    // Main result grid
    const grid = el('div', { class: 'result-grid' });

    // 1. Weight card
    const weightCard = el('div', { class: 'result-card result-card--featured' });
    weightCard.appendChild(el('div', { class: 'result-card-label', text: 'Груз чебурашки' }));
    weightCard.appendChild(el('div', { class: 'result-card-value', text: rec.weight.recommended + ' г' }));
    const weightNoteText = rec.weight.notes.length > 0
      ? `Базовый ${lure.weight_base_g} г, скорректировано (${rec.weight.notes.join(', ')})`
      : `Базовое значение для этой приманки`;
    weightCard.appendChild(el('div', { class: 'result-card-note', text: weightNoteText }));
    if (rec.weight.overflow) {
      weightCard.appendChild(el('div', { class: 'alert alert--warn', style: 'margin-top:12px;padding:8px 12px;font-size:11px' },
        el('div', { text: `Выходит за разумный предел (${rec.weight.extreme}). Лучше увеличить приманку.` })
      ));
    }
    weightCard.appendChild(el('div', { class: 'result-card-alt' },
      el('strong', { text: 'Типичный диапазон: ' }), lure.weight_typical_g + ' г · ',
      el('strong', { text: 'до экстремальных: ' }), rec.weight.extreme + ' г'
    ));
    grid.appendChild(weightCard);

    // 2. Priority hook card
    const priorityHook = rec.hookPriority === 'offset' ? lure.offset_hook : lure.single_hook;
    const alternativeHook = rec.hookPriority === 'offset' ? lure.single_hook : lure.offset_hook;
    const priorityLabel = rec.hookPriority === 'offset' ? 'Офсетный крючок' : 'Одинарный крючок';

    const hookCard = el('div', { class: 'result-card result-card--featured' });
    hookCard.appendChild(el('div', { class: 'result-card-label', text: priorityLabel + ' (приоритет)' }));

    if (priorityHook.primary) {
      hookCard.appendChild(el('div', { class: 'result-card-value-small',
        html: `<strong>${priorityHook.primary.model}</strong> ${priorityHook.primary.size}`
      }));
    } else if (priorityHook.note) {
      hookCard.appendChild(el('div', { class: 'result-card-note', text: priorityHook.note }));
    }

    if (priorityHook.alternative) {
      hookCard.appendChild(el('div', { class: 'result-card-alt' },
        el('strong', { text: 'Альтернатива: ' }),
        priorityHook.alternative.model + ' ' + priorityHook.alternative.size
      ));
    }
    if (priorityHook.note && priorityHook.primary) {
      hookCard.appendChild(el('div', { class: 'result-card-note', style: 'margin-top:8px', text: priorityHook.note }));
    }
    grid.appendChild(hookCard);

    // 3. Secondary hook card
    const altCard = el('div', { class: 'result-card' });
    const altLabel = rec.hookPriority === 'offset' ? 'Одинарный крючок (альтернатива)' : 'Офсетный крючок (альтернатива)';
    altCard.appendChild(el('div', { class: 'result-card-label', text: altLabel }));

    if (alternativeHook.primary) {
      altCard.appendChild(el('div', { class: 'result-card-value-small',
        html: `<strong>${alternativeHook.primary.model}</strong> ${alternativeHook.primary.size}`
      }));
      if (alternativeHook.alternative) {
        altCard.appendChild(el('div', { class: 'result-card-alt' },
          el('strong', { text: 'Альтернатива: ' }),
          alternativeHook.alternative.model + ' ' + alternativeHook.alternative.size
        ));
      }
    } else if (alternativeHook.note) {
      altCard.appendChild(el('div', { class: 'result-card-note', text: alternativeHook.note }));
    }
    grid.appendChild(altCard);

    // 4. Rig card
    const rigCard = el('div', { class: 'result-card' });
    rigCard.appendChild(el('div', { class: 'result-card-label', text: 'Тип монтажа' }));
    rigCard.appendChild(el('div', { class: 'result-card-value-small', text: rec.rig.name.replace(/_/g, ' ') }));
    rigCard.appendChild(el('div', { class: 'result-card-note', text: rec.rig.reason }));
    if (lure.rigs.length > 1) {
      rigCard.appendChild(el('div', { class: 'result-card-alt' },
        el('strong', { text: 'Другие варианты: ' }),
        lure.rigs.filter(r => r !== rec.rig.name).map(r => r.replace(/_/g, ' ')).join(', ')
      ));
    }
    grid.appendChild(rigCard);

    result.appendChild(grid);

    // 5. Retrieve / proboca
    result.appendChild(el('div', { class: 'result-section' },
      el('div', { class: 'result-section-title', text: 'Проводка' }),
      el('div', { class: 'result-card-note', style: 'font-size:13px;color:var(--text)', text: lure.retrieve })
    ));

    // 6. Fish
    const fishSection = el('div', { class: 'result-section' });
    fishSection.appendChild(el('div', { class: 'result-section-title', text: 'Целевая рыба' }));

    if (rec.fishCheck.status === 'no_selection') {
      const fishBox = el('div', { style: 'font-size:13px' });
      fishBox.appendChild(el('div', { class: 'result-card-note', style: 'margin-bottom:8px',
        text: 'Основная: ' + (lure.target_fish.primary || []).map(formatFish).join(', ')
      }));
      if ((lure.target_fish.secondary || []).length > 0) {
        fishBox.appendChild(el('div', { class: 'result-card-note',
          text: 'Возможна: ' + (lure.target_fish.secondary || []).map(formatFish).join(', ')
        }));
      }
      fishSection.appendChild(fishBox);
    } else if (rec.fishCheck.status === 'no_match') {
      fishSection.appendChild(el('div', { class: 'alert alert--warn' },
        el('span', { class: 'alert-icon', text: '?' }),
        el('div', {},
          el('div', { text: 'Выбранная тобой рыба (' + inputs.target_fish.join(', ') + ') не относится к типичной для этой приманки.' }),
          el('div', { style: 'margin-top:4px;font-size:12px', text: 'Реально ловится: ' + (lure.target_fish.primary || []).concat(lure.target_fish.secondary || []).map(formatFish).join(', ') })
        )
      ));
    } else {
      const fishBox = el('div', { style: 'font-size:13px' });
      if (rec.fishCheck.matchPrimary.length > 0) {
        fishBox.appendChild(el('div', { style: 'color:var(--success);margin-bottom:6px',
          text: '✓ Основная цель: ' + rec.fishCheck.matchPrimary.join(', ')
        }));
      }
      if (rec.fishCheck.matchSecondary.length > 0) {
        fishBox.appendChild(el('div', { style: 'color:var(--warn);margin-bottom:6px',
          text: '◐ Возможна: ' + rec.fishCheck.matchSecondary.join(', ')
        }));
      }
      if (rec.fishCheck.noMatch.length > 0) {
        fishBox.appendChild(el('div', { class: 'result-card-note',
          text: 'Не типична: ' + rec.fishCheck.noMatch.join(', ')
        }));
      }
      fishSection.appendChild(fishBox);
    }
    result.appendChild(fishSection);

    // 7. Season note
    if (rec.seasonNote) {
      const tone = rec.seasonNote.status === 'best' ? 'alert--info' :
                   rec.seasonNote.status === 'marginal' ? 'alert--warn' : '';
      if (tone) {
        result.appendChild(el('div', { class: 'result-section' },
          el('div', { class: 'alert ' + tone },
            el('span', { class: 'alert-icon', text: rec.seasonNote.status === 'best' ? '✓' : '?' }),
            el('div', { text: rec.seasonNote.text })
          )
        ));
      }
    }

    // 8. Example lures
    if (lure.example_lures && lure.example_lures.length > 0) {
      const examplesSection = el('div', { class: 'result-section' });
      examplesSection.appendChild(el('div', { class: 'result-section-title', text: 'Эталонные модели приманок' }));
      const list = el('div', { class: 'lure-examples' });
      lure.example_lures.forEach(name => list.appendChild(el('div', { class: 'lure-example', text: name })));
      examplesSection.appendChild(list);
      result.appendChild(examplesSection);
    }
  }

  // ============================================================
  //   TABLE
  // ============================================================

  function renderTable() {
    renderTableFilters();
    renderTableDesktop();
    renderTableCards();
  }

  function renderTableFilters() {
    const wrap = $('#table-filters');
    wrap.innerHTML = '';
    const types = ['all', 'виброхвост', 'твистер', 'слаг', 'рак', 'креатура', 'червь'];
    types.forEach(type => {
      const btn = el('button', {
        class: 'filter-btn' + (STATE.activeTypeFilter === type ? ' filter-btn--active' : ''),
        type: 'button',
        text: type === 'all' ? 'Все' : type,
        onClick: () => {
          STATE.activeTypeFilter = type;
          renderTable();
        }
      });
      wrap.appendChild(btn);
    });
  }

  function getFilteredLures() {
    const all = STATE.luresData.lures;
    return STATE.activeTypeFilter === 'all'
      ? all
      : all.filter(l => l.type === STATE.activeTypeFilter);
  }

  function renderTableDesktop() {
    const cont = $('#table-container');
    cont.innerHTML = '';

    const lures = getFilteredLures();
    if (lures.length === 0) {
      cont.appendChild(el('p', { class: 'result-card-note', text: 'Ничего не найдено' }));
      return;
    }

    const table = el('table', { class: 'lure-table' });
    const thead = el('thead');
    thead.innerHTML = `
      <tr>
        <th>Тип</th>
        <th>Размер</th>
        <th>Груз</th>
        <th>Одинарник</th>
        <th>Офсет</th>
        <th>Монтажи</th>
        <th>Рыба</th>
        <th>Эталоны</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = el('tbody');

    // Group by size
    const grouped = {};
    lures.forEach(l => {
      if (!grouped[l.size_inches]) grouped[l.size_inches] = [];
      grouped[l.size_inches].push(l);
    });

    Object.keys(grouped).map(Number).sort((a,b) => a-b).forEach(size => {
      const groupRow = el('tr', { class: 'size-group-row' });
      groupRow.appendChild(el('td', { attrs: { colspan: 8 }, text: `${size}″ — ${grouped[size][0].size_mm} мм` }));
      tbody.appendChild(groupRow);

      grouped[size].forEach(lure => tbody.appendChild(buildTableRow(lure)));
    });

    table.appendChild(tbody);
    cont.appendChild(table);
  }

  function buildTableRow(lure) {
    const tr = el('tr');

    tr.appendChild(el('td', {},
      el('span', { class: 'type-badge ' + (TYPE_CLASS[lure.type] || ''), text: lure.type })
    ));

    tr.appendChild(el('td', {},
      el('div', { class: 'cell-hook-model', text: lure.size_inches + '″' }),
      el('div', { class: 'cell-hook-size', text: lure.size_mm + ' мм' })
    ));

    const weightCell = el('td');
    weightCell.appendChild(el('div', { class: 'cell-weights cell-weights-typical', text: lure.weight_typical_g + ' г' }));
    weightCell.appendChild(el('div', { class: 'cell-weights cell-weights-extreme', text: 'до ' + (String(lure.weight_extreme_g).replace(/до\s*/,'')) + ' (экстрим)' }));
    tr.appendChild(weightCell);

    tr.appendChild(buildHookCell(lure.single_hook));
    tr.appendChild(buildHookCell(lure.offset_hook));

    tr.appendChild(el('td', { class: 'cell-hook-size', text: (lure.rigs || []).slice(0,3).map(r => r.replace(/_/g, ' ')).join(', ') }));

    const fishCell = el('td');
    fishCell.appendChild(el('div', { class: 'cell-fish cell-fish-primary',
      text: (lure.target_fish.primary || []).map(formatFish).join(', ')
    }));
    if ((lure.target_fish.secondary || []).length > 0) {
      fishCell.appendChild(el('div', { class: 'cell-fish cell-fish-secondary',
        text: (lure.target_fish.secondary || []).map(formatFish).join(', ')
      }));
    }
    tr.appendChild(fishCell);

    tr.appendChild(el('td', { class: 'cell-hook-size',
      text: (lure.example_lures || []).slice(0, 2).join('; ')
    }));

    return tr;
  }

  function buildHookCell(hook) {
    const td = el('td');
    if (hook.primary) {
      td.appendChild(el('div', { class: 'cell-hook-model', text: hook.primary.model }));
      td.appendChild(el('div', { class: 'cell-hook-size', text: hook.primary.size }));
      if (hook.alternative) {
        td.appendChild(el('div', { class: 'cell-hook-size', style: 'margin-top:4px;font-style:italic',
          text: 'alt: ' + hook.alternative.model + ' ' + hook.alternative.size
        }));
      }
    } else if (hook.note) {
      td.appendChild(el('div', { class: 'cell-hook-size', style: 'font-style:italic', text: hook.note }));
    }
    return td;
  }

  function renderTableCards() {
    const cont = $('#cards-container');
    cont.innerHTML = '';

    const lures = getFilteredLures();

    // Group by size
    const grouped = {};
    lures.forEach(l => {
      if (!grouped[l.size_inches]) grouped[l.size_inches] = [];
      grouped[l.size_inches].push(l);
    });

    Object.keys(grouped).map(Number).sort((a,b)=>a-b).forEach(size => {
      const heading = el('div', {
        style: 'font-family:var(--font-display);font-size:18px;letter-spacing:2px;color:var(--accent);margin:24px 0 12px',
        text: `${size}″ — ${grouped[size][0].size_mm} мм`
      });
      cont.appendChild(heading);
      grouped[size].forEach(lure => cont.appendChild(buildCard(lure)));
    });
  }

  function buildCard(lure) {
    const card = el('div', { class: 'lure-card' });

    const header = el('div', { class: 'lure-card-header' });
    header.appendChild(el('div', { class: 'lure-card-title', text: lure.type }));
    header.appendChild(el('span', { class: 'type-badge ' + (TYPE_CLASS[lure.type] || ''), text: lure.size_inches + '″' }));
    card.appendChild(header);

    const addRow = (label, value) => {
      const row = el('div', { class: 'lure-card-row' });
      row.appendChild(el('div', { class: 'lure-card-row-label', text: label }));
      if (typeof value === 'string') {
        row.appendChild(el('div', { class: 'lure-card-row-value', text: value }));
      } else {
        row.appendChild(value);
      }
      card.appendChild(row);
    };

    addRow('Груз', el('div', { class: 'lure-card-row-value lure-card-row-value-mono', text: lure.weight_typical_g + ' г · ' + lure.weight_extreme_g + ' (экстрим)' }));

    if (lure.single_hook.primary) {
      addRow('Одинарник', el('div', { class: 'lure-card-row-value' },
        el('div', { class: 'lure-card-row-value-mono', text: lure.single_hook.primary.model + ' ' + lure.single_hook.primary.size })
      ));
    } else if (lure.single_hook.note) {
      addRow('Одинарник', el('div', { class: 'lure-card-row-value', style: 'font-style:italic;font-size:11px;color:var(--text-muted)', text: lure.single_hook.note }));
    }

    if (lure.offset_hook.primary) {
      addRow('Офсет', el('div', { class: 'lure-card-row-value' },
        el('div', { class: 'lure-card-row-value-mono', text: lure.offset_hook.primary.model + ' ' + lure.offset_hook.primary.size })
      ));
    } else if (lure.offset_hook.note) {
      addRow('Офсет', el('div', { class: 'lure-card-row-value', style: 'font-style:italic;font-size:11px;color:var(--text-muted)', text: lure.offset_hook.note }));
    }

    addRow('Монтажи', (lure.rigs || []).map(r => r.replace(/_/g, ' ')).join(', '));
    addRow('Рыба', (lure.target_fish.primary || []).concat(lure.target_fish.secondary || []).map(formatFish).join(', '));
    addRow('Проводка', el('div', { class: 'lure-card-row-value', style: 'font-size:11px;color:var(--text-muted)', text: lure.retrieve }));

    if ((lure.example_lures || []).length > 0) {
      addRow('Эталоны', (lure.example_lures || []).slice(0,3).join('; '));
    }

    return card;
  }

  // ============================================================
  //   REFERENCE (hooks list)
  // ============================================================

  function renderHooksReference() {
    const cont = $('#hooks-reference');
    cont.innerHTML = '';

    const renderSection = (data, sectionTitle) => {
      const section = el('div', { style: 'margin-bottom:24px' });
      section.appendChild(el('h3', {
        style: 'font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:12px',
        text: sectionTitle
      }));
      Object.values(data).forEach(hook => {
        const card = el('div', { class: 'hook-ref-card' });
        card.appendChild(el('div', {},
          el('span', { class: 'hook-ref-brand', text: hook.brand }),
          el('span', { class: 'hook-ref-name', text: hook.full_name })
        ));
        card.appendChild(el('div', { style: 'margin-top:8px;font-size:12px;color:var(--text)', text: hook.description }));
        card.appendChild(el('div', { class: 'hook-ref-meta',
          text: 'Размерный ряд: ' + hook.size_range_available + ' · Проволока: ' + hook.wire_thickness
        }));
        if (hook.notes) {
          card.appendChild(el('div', { class: 'hook-ref-meta', style: 'font-style:italic;margin-top:4px', text: hook.notes }));
        }
        section.appendChild(card);
      });
      cont.appendChild(section);
    };

    renderSection(STATE.hooksData.single_hooks, 'Одинарные крючки');
    renderSection(STATE.hooksData.offset_hooks, 'Офсетные крючки');
  }

  // ============================================================
  //   Init
  // ============================================================

  async function init() {
    const ok = await loadData();
    if (!ok) return;

    initTabs();
    renderConfiguratorForm();
    renderTable();
    renderHooksReference();
  }

  document.addEventListener('DOMContentLoaded', init);

})();

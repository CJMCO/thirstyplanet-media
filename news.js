// News wire: renders site/news.json (written by build/news.mjs) as a day by
// day stream of headlines with lane and topic filters and a search box.
(async () => {
  const wire = document.getElementById('wire');
  const ticker = document.getElementById('ticker');
  const lanes = document.getElementById('lanes');
  const topicSelect = document.getElementById('topicSelect');
  const placeSelect = document.getElementById('placeSelect');
  const search = document.getElementById('search');
  const more = document.getElementById('more');
  const title = document.getElementById('wireTitle');
  const count = document.getElementById('wireCount');
  const updated = document.getElementById('updated');

  const LANE_LABEL = { everyday: 'Everyday', industry: 'Industry' };
  const DAYS_PER_PAGE = 3;

  let data;
  try {
    data = await (await fetch('news.json', { cache: 'no-cache' })).json();
  } catch (e) {
    wire.innerHTML = '<p class="wire-empty">The wire is empty right now. Check back in the morning.</p>';
    return;
  }

  const items = data.items || [];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = it => new Date(it.published || it.firstSeen);
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayLabel = key => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = dayKey(new Date());
    const yest = dayKey(new Date(Date.now() - 86400000));
    const nice = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    if (key === today) return `Today, ${nice}`;
    if (key === yest) return `Yesterday, ${nice}`;
    return nice;
  };
  const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  if (data.updated) {
    const u = new Date(data.updated);
    updated.textContent = `Last refreshed ${u.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} at ${hhmm(u)}. ${items.length} headlines from the last ${data.days || 14} days.`;
  }

  // Ticker: the newest 30 headlines, doubled so the loop is seamless.
  const strip = items.slice(0, 30).map(it =>
    `<a href="${esc(it.url)}" target="_blank" rel="noopener" tabindex="-1"><span class="src">${esc(it.source)}</span>${esc(it.title)}</a>`).join('');
  ticker.innerHTML = strip + strip;

  // Topic list, most used first.
  const topicCount = {};
  for (const it of items) for (const t of it.topics || []) topicCount[t] = (topicCount[t] || 0) + 1;
  Object.entries(topicCount).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
    const o = document.createElement('option');
    o.value = t; o.textContent = `${t[0].toUpperCase()}${t.slice(1)} (${n})`;
    topicSelect.appendChild(o);
  });

  // Country list, most covered first.
  const placeCount = {};
  for (const it of items) for (const p of it.places || []) placeCount[p] = (placeCount[p] || 0) + 1;
  Object.entries(placeCount).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => {
    const o = document.createElement('option');
    o.value = p; o.textContent = `${p} (${n})`;
    placeSelect.appendChild(o);
  });

  const state = { lane: 'all', topic: '', place: '', q: '', pages: 1 };

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return items.filter(it =>
      (state.lane === 'all' || it.lane === state.lane) &&
      (!state.topic || (it.topics || []).includes(state.topic)) &&
      (!state.place || (it.places || []).includes(state.place)) &&
      (!q || `${it.title} ${it.source} ${it.summary || ''} ${(it.places || []).join(' ')}`.toLowerCase().includes(q)));
  }

  function render() {
    const list = filtered();
    const byDay = new Map();
    for (const it of list) {
      const k = dayKey(when(it));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(it);
    }
    const days = [...byDay.keys()].sort().reverse();
    const shown = days.slice(0, state.pages * DAYS_PER_PAGE);

    title.textContent = state.lane === 'all' ? 'All headlines' : `${LANE_LABEL[state.lane]} headlines`;
    count.textContent = list.length ? `${list.length} headline${list.length === 1 ? '' : 's'}${state.topic ? ` on ${state.topic}` : ''}${state.place ? ` from ${state.place}` : ''}${state.q ? ` matching “${state.q}”` : ''}` : '';

    if (!list.length) {
      wire.innerHTML = '<p class="wire-empty">Nothing matches. Try another lane, topic or word.</p>';
      more.hidden = true;
      return;
    }

    wire.innerHTML = shown.map(k => {
      const rows = byDay.get(k).map(it => {
        const d = when(it);
        const chips = [`<button class="chip ${it.lane}" data-lane="${it.lane}">${LANE_LABEL[it.lane]}</button>`]
          .concat((it.topics || []).slice(0, 2).map(t => `<button class="chip" data-topic="${esc(t)}">${esc(t)}</button>`))
          .concat((it.places || []).slice(0, 1).map(p => `<button class="chip place" data-place="${esc(p)}">${esc(p)}</button>`));
        return `<div class="wire-row">
          <span class="t">${hhmm(d)}</span>
          <span class="s" title="${esc(it.source)}">${esc(it.source)}</span>
          <div class="h"><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>${it.summary ? `<p>${esc(it.summary)}</p>` : ''}</div>
          <div class="k">${chips.join('')}</div>
        </div>`;
      }).join('');
      return `<section class="wire-day"><h3>${dayLabel(k)}<span>${byDay.get(k).length} headlines</span></h3>${rows}</section>`;
    }).join('');

    more.hidden = shown.length >= days.length;
  }

  lanes.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setLane(b.dataset.lane);
  });
  function setLane(lane) {
    state.lane = lane; state.pages = 1;
    for (const b of lanes.querySelectorAll('button')) b.classList.toggle('on', b.dataset.lane === lane);
    render();
  }
  topicSelect.addEventListener('change', () => { state.topic = topicSelect.value; state.pages = 1; render(); });
  placeSelect.addEventListener('change', () => { state.place = placeSelect.value; state.pages = 1; render(); });
  search.addEventListener('input', () => { state.q = search.value; state.pages = 1; render(); });
  more.addEventListener('click', () => { state.pages++; render(); });
  wire.addEventListener('click', e => {
    const chip = e.target.closest('.chip'); if (!chip) return;
    if (chip.dataset.topic) { topicSelect.value = chip.dataset.topic; state.topic = chip.dataset.topic; state.pages = 1; render(); }
    else if (chip.dataset.place) { placeSelect.value = chip.dataset.place; state.place = chip.dataset.place; state.pages = 1; render(); }
    else if (chip.dataset.lane) setLane(chip.dataset.lane);
    window.scrollTo({ top: wire.offsetTop - 140, behavior: 'smooth' });
  });

  render();
})();

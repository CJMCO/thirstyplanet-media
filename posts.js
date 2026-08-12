/* The Posts page: the full archive as a grid, filtered by the chips at the top. */
const $ = id => document.getElementById(id);
const load = url => fetch(url).then(r => (r.ok ? r.json() : [])).catch(() => []);

let posts = [], featured = {}, active = 'ALL';

const seriesOf = p => (featured[p.slug] || {}).kicker || p.kicker;
const accentOf = p => (featured[p.slug] || {}).accent || p.accent;
const titleOf = p => (featured[p.slug] || {}).title || p.title;

Promise.all([load('posts.json'), load('featured.json')]).then(([p, f]) => {
  posts = p;
  featured = f || {};
  Reader.init(posts, featured);
  renderFilter();
  renderGrid();
  // Deep link: posts.html#series=MYTH, and posts.html#post=<id> opens a post.
  applyHash();
  window.addEventListener('hashchange', applyHash);
});

function renderFilter() {
  const counts = new Map();
  posts.forEach(p => counts.set(seriesOf(p), (counts.get(seriesOf(p)) || 0) + 1));
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  $('seriesFilter').innerHTML = [
    `<button class="chip on" data-s="ALL">All <b>${posts.length}</b></button>`,
    ...chips.map(([s, n]) => {
      const accent = accentOf(posts.find(p => seriesOf(p) === s));
      return `<button class="chip" data-s="${s}" style="--a:${accent}">${s} <b>${n}</b></button>`;
    }),
  ].join('');
  $('seriesFilter').querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => {
      active = c.dataset.s;
      $('seriesFilter').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
      renderGrid();
    }));
}

function renderGrid() {
  const shown = posts.filter(p => active === 'ALL' || seriesOf(p) === active);
  $('gridTitle').textContent = active === 'ALL' ? 'All posts' : active;
  $('gridCount').textContent = `${shown.length} post${shown.length === 1 ? '' : 's'}, newest first.`;
  $('postMatrix').innerHTML = shown.map(p => {
    const i = posts.indexOf(p);
    const date = new Date(p.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <button class="matrix-card" data-i="${i}" aria-label="Open post: ${titleOf(p)}">
        <span class="mc-art">
          <img src="${p.slides[0]}" alt="" loading="lazy">
          <span class="mc-count">${p.slides.length}</span>
        </span>
        <span class="mc-body">
          <span class="mc-kicker" style="color:${accentOf(p)}">${seriesOf(p)}</span>
          <span class="mc-title">${titleOf(p)}</span>
          <span class="mc-date">${date}</span>
        </span>
      </button>`;
  }).join('');
  $('postMatrix').querySelectorAll('.matrix-card').forEach(el =>
    el.addEventListener('click', () => Reader.open(+el.dataset.i)));
}

function applyHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const series = h.get('series');
  if (series) {
    const chip = $('seriesFilter').querySelector(`.chip[data-s="${series.toUpperCase()}"]`);
    if (chip) chip.click();
  }
  const id = h.get('post');
  if (id) {
    const i = posts.findIndex(p => p.slug === id);
    if (i > -1) Reader.open(i);
  }
}

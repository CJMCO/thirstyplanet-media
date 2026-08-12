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
  renderFilterBox();
  renderGrid();
  // Deep link: posts.html#series=MYTH, and posts.html#post=<id> opens a post.
  applyHash();
  window.addEventListener('hashchange', applyHash);
});

// One box listing every option, with how many posts each holds.
function renderFilterBox() {
  const counts = new Map();
  posts.forEach(p => counts.set(seriesOf(p), (counts.get(seriesOf(p)) || 0) + 1));
  const options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  $('seriesSelect').innerHTML = [
    `<option value="ALL">Everything (${posts.length})</option>`,
    ...options.map(([s, n]) => `<option value="${s}">${s} (${n})</option>`),
  ].join('');
  $('seriesSelect').addEventListener('change', e => setFilter(e.target.value, false));
}

function setFilter(name, scroll = true) {
  active = name;
  $('seriesSelect').value = name;
  renderGrid();
  if (scroll) $('gridTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (series) setFilter(series.toUpperCase());
  const id = h.get('post');
  if (id) {
    const i = posts.findIndex(p => p.slug === id);
    if (i > -1) Reader.open(i);
  }
}

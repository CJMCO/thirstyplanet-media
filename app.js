/* Thirsty Planet — Chora-style homepage.
   Data: posts.json (live Instagram), videos.json (YouTube uploads),
   podcasts.json (episodes). Empty video/podcast lists render a branded
   coming-soon card, so rows light up as soon as content exists. */
const $ = id => document.getElementById(id);
const load = url => fetch(url).then(r => (r.ok ? r.json() : [])).catch(() => []);

let posts = [], videos = [], pods = [], articles = [];
let hcIndex = 0, hcTimer = null;

let featured = {};

Promise.all([load('posts.json'), load('videos.json'), load('podcasts.json'), load('featured.json'), load('articles.json')])
  .then(([p, v, pd, f, a]) => {
    posts = p; videos = v; pods = pd; featured = f || {}; articles = a || [];
    Reader.init(posts, featured);
    renderHero();
    renderRows();
    renderRead();
  });

/* ---------- the newest articles (articles.json, built by build/articles.mjs) ---------- */
function renderRead() {
  const section = $('read');
  if (!section || !articles.length) return;
  const date = d => new Date(d + 'T08:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  // The lead is the newest article; the four beside it are the newest from four
  // other pillars, so the section shows the breadth of the site rather than one series.
  const lead = articles[0];
  const pillarOrder = ['THIRSTY', 'THIRSTY INDUSTRIES', 'PLAIN WATER', 'THIRSTY PLACES', 'MYTH', 'FOUNDATIONS', 'INSIDE', 'YOU ASKED'];
  const picked = new Set([lead.url]);
  const rest = [];
  pillarOrder.filter(n => n !== lead.series).forEach(n => {
    const a = articles.find(x => x.series === n && !picked.has(x.url));
    if (a) { rest.push(a); picked.add(a.url); }
  });
  articles.forEach(a => { if (rest.length < 4 && !picked.has(a.url)) { rest.push(a); picked.add(a.url); } });
  $('rowRead').innerHTML = `
    <a class="rf-main" href="${lead.url}">
      <img src="${lead.cover}" alt="" loading="lazy">
      <span class="rf-body">
        <span class="rf-tag">Latest</span>
        <span class="rf-title">${lead.title}</span>
        <span class="rf-sum">${lead.summary}</span>
        <span class="mc-date">${date(lead.date)}</span>
      </span>
    </a>
    <div class="rf-list">${rest.slice(0, 4).map(a => `
      <a class="rf-item" href="${a.url}">
        <img src="${a.cover}" alt="" loading="lazy">
        <span class="rf-item-body">
          <span class="rf-item-title">${a.title}</span>
          <span class="mc-date">${date(a.date)}</span>
        </span>
      </a>`).join('')}
    </div>`;
  // One link per pillar, in the site's pillar order, with a count.
  const order = ['THIRSTY', 'THIRSTY INDUSTRIES', 'PLAIN WATER', 'THIRSTY PLACES', 'MYTH', 'FOUNDATIONS', 'INSIDE', 'YOU ASKED'];
  const label = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  const counts = {};
  articles.forEach(a => { counts[a.series] = (counts[a.series] || 0) + 1; });
  const pillars = order.filter(n => counts[n]);
  const row = $('rowPillars');
  if (row) row.innerHTML = `<span class="rp-label">Browse by pillar</span>` + pillars.map(n => `
    <a href="articles/${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/"><strong>${label(n)}</strong><span>${counts[n]}</span></a>`).join('');
  section.hidden = false;
}

/* ---------- featured hero carousel ---------- */
// The hero mixes the two things the site makes. The newest article leads, then
// articles and posts alternate, drawn at random on every visit so the homepage
// shows something different each time. Curated headlines for posts live in
// featured.json; posts without an entry fall back to the caption's first line.
const shuffle = list => {
  const pool = list.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
};

function pickFeatured() {
  const arts = articles.map(a => ({ kind: 'article', a }));
  const psts = posts.map(p => ({ kind: 'post', p }));
  if (!arts.length) return shuffle(psts).slice(0, 5);
  const [lead, ...restArts] = arts;
  const artPool = shuffle(restArts), postPool = shuffle(psts);
  const out = [lead];
  while (out.length < 5 && (artPool.length || postPool.length)) {
    const next = out.length % 2 === 1 ? (postPool.shift() || artPool.shift()) : (artPool.shift() || postPool.shift());
    if (next) out.push(next);
  }
  return out;
}

function renderHero() {
  const feat = pickFeatured();
  $('hcSlides').innerHTML = feat.map((item, i) => {
    if (item.kind === 'article') {
      const a = item.a;
      return `
    <article class="hc-slide ${i === 0 ? 'on' : ''}" data-i="${i}">
      <div class="hc-content">
        <span class="hc-kicker">Article</span>
        <h2>${a.title}</h2>
        <p class="hc-sum">${a.summary}</p>
        <a class="btn primary" href="${a.url}">Read the article</a>
      </div>
      <img class="hc-cover" src="${a.cover}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">
    </article>`;
    }
    const p = item.p;
    const f = featured[p.slug] || {};
    const title = f.title || p.title;
    const summary = f.summary || '';
    return `
    <article class="hc-slide ${i === 0 ? 'on' : ''}" data-i="${i}">
      <div class="hc-content">
        <span class="hc-kicker">Post</span>
        <h2>${title}</h2>
        ${summary ? `<p class="hc-sum">${summary}</p>` : ''}
        <button class="btn primary hc-open" data-post="${posts.indexOf(p)}">Read the post</button>
      </div>
      <img class="hc-cover" src="${p.slides[0]}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">
    </article>`;
  }).join('');
  $('hcDots').innerHTML = feat.map((_, i) =>
    `<button class="${i === 0 ? 'on' : ''}" data-i="${i}" aria-label="Go to slide ${i + 1} of ${feat.length}"></button>`).join('');
  $('hcSlides').querySelectorAll('.hc-open').forEach(b =>
    b.addEventListener('click', () => Reader.open(+b.dataset.post)));
  $('hcDots').querySelectorAll('button').forEach(d =>
    d.addEventListener('click', () => hcShow(+d.dataset.i)));
  $('hcPrev').addEventListener('click', () => hcShow(hcIndex - 1));
  $('hcNext').addEventListener('click', () => hcShow(hcIndex + 1));
  hcAuto();
}

function hcShow(i, user = true) {
  const n = $('hcSlides').children.length;
  if (!n) return;
  hcIndex = (i + n) % n;
  $('hcSlides').querySelectorAll('.hc-slide').forEach((s, k) =>
    s.classList.toggle('on', k === hcIndex));
  $('hcDots').querySelectorAll('button').forEach((d, k) =>
    d.classList.toggle('on', k === hcIndex));
  if (user) hcAuto();
}

function hcAuto() {
  clearInterval(hcTimer);
  hcTimer = setInterval(() => hcShow(hcIndex + 1, false), 6000);
}

/* The hero globe drifts at half speed. */
const hcVideo = document.querySelector('.hc-video');
if (hcVideo) {
  const slow = () => { hcVideo.playbackRate = 0.5; };
  hcVideo.readyState > 0 ? slow() : hcVideo.addEventListener('loadedmetadata', slow, { once: true });
}

/* Story photos: one at a time, each with its own caption. The frame resizes to
   each photo's real proportions so landscape shots are never cropped. */
const storyPics = document.querySelectorAll('.story-stage img');
if (storyPics.length) {
  const stage = document.querySelector('.story-stage');
  const cap = $('storyCaption');
  // Largest size that fits the column without cropping: landscape photos take
  // the full width, portraits are limited by height instead.
  const MAX_H = () => Math.min(760, window.innerHeight * 0.78);
  const shape = img => {
    if (!img.naturalWidth) {
      img.addEventListener('load', () => shape(img), { once: true });
      return;
    }
    const figure = stage.parentElement;
    const maxW = figure.parentElement.clientWidth;
    const scale = Math.min(maxW / img.naturalWidth, MAX_H() / img.naturalHeight);
    const w = Math.round(img.naturalWidth * scale);
    stage.style.width = `${w}px`;
    stage.style.height = `${Math.round(img.naturalHeight * scale)}px`;
    // The caption sits in the figure, so matching its width keeps the two edges aligned.
    figure.style.width = `${w}px`;
  };
  let si = 0;
  shape(storyPics[0]);
  window.addEventListener('resize', () => shape(storyPics[si]));
  if (storyPics.length > 1) {
    setInterval(() => {
      storyPics[si].classList.remove('on');
      si = (si + 1) % storyPics.length;
      storyPics[si].classList.add('on');
      shape(storyPics[si]);
      cap.classList.add('fade');
      setTimeout(() => {
        cap.textContent = storyPics[si].dataset.caption;
        cap.classList.remove('fade');
      }, 350);
    }, 5000);
  }
}

/* Ambient background videos load only when their section approaches. */
const vidObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const v = e.target;
    if (!v.src) {
      v.muted = true;
      v.autoplay = true;
      v.src = v.dataset.src;
      v.load();
      v.addEventListener('canplay', () => v.play().catch(() => {}), { once: true });
    }
    vidObserver.unobserve(v);
  });
}, { rootMargin: '400px' });
document.querySelectorAll('.lazy-video').forEach(v => vidObserver.observe(v));

/* Swipe the featured hero on a phone. */
const hcEl = document.querySelector('.hc');
if (hcEl) Reader.onSwipe(hcEl, d => hcShow(hcIndex + d));

/* ---------- content rows ---------- */
function renderRows() {
  // The Instagram row flows on its own: the card set is doubled and slides
  // continuously (CSS marquee); hover pauses it, click opens the post.
  const cards = posts.map((p, i) => `
    <button class="post-card" data-i="${i}" aria-label="Open post: ${p.title}">
      <img src="${p.slides[0]}" alt="${p.title}, cover slide" loading="lazy">
      <span class="slides-badge" title="${p.slides.length} slides"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M7 3h12a2 2 0 0 1 2 2v12h-2V5H7V3zm10 4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h12z" fill="currentColor"/></svg></span>
      <span class="overlay"><span class="k" style="color:${(featured[p.slug]||{}).accent || p.accent}">${(featured[p.slug]||{}).kicker || p.kicker}</span><span class="t">${(featured[p.slug] || {}).title || p.title}</span></span>
    </button>`).join('');
  $('rowPosts').classList.add('marquee');
  $('rowPosts').innerHTML = `
    <div class="mq-track" style="--mq-dur:${posts.length * 5}s">
      <div class="mq-group">${cards}</div>
      <div class="mq-group" aria-hidden="true">${cards}</div>
    </div>`;
  $('rowPosts').querySelectorAll('.post-card').forEach(el =>
    el.addEventListener('click', () => Reader.open(+el.dataset.i)));

  $('rowVideos').innerHTML = videos.length
    ? videos.map(v => `
        <a class="video-card" href="${v.url}" target="_blank" rel="noopener">
          <img src="${v.thumb}" alt="" loading="lazy">
          <h3>${v.title}</h3>
        </a>`).join('')
    : emptyCard('First episodes are in production.',
        'Subscribe now and they will be waiting for you.',
        'Subscribe on YouTube', 'https://www.youtube.com/@thirsty.planet');

  $('rowPods').innerHTML = pods.length
    ? pods.map(e => `
        <a class="video-card" href="${e.url}" target="_blank" rel="noopener">
          <img src="${e.thumb}" alt="" loading="lazy">
          <h3>${e.title}</h3>
        </a>`).join('')
    : emptyCard('The podcast is coming.',
        'Stories from inside the water industry, told for everyone else.',
        null, null);
}

function emptyCard(title, text, cta, href) {
  return `
    <div class="empty-card">
      <img src="assets/globe-new.png" alt="">
      <div>
        <h3>${title}</h3>
        <p>${text}</p>
        ${cta ? `<a class="btn primary" href="${href}" target="_blank" rel="noopener">${cta}</a>` : ''}
      </div>
    </div>`;
}

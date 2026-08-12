/* Thirsty Planet — Chora-style homepage.
   Data: posts.json (live Instagram), videos.json (YouTube uploads),
   podcasts.json (episodes). Empty video/podcast lists render a branded
   coming-soon card, so rows light up as soon as content exists. */
const $ = id => document.getElementById(id);
const load = url => fetch(url).then(r => (r.ok ? r.json() : [])).catch(() => []);

let posts = [], videos = [], pods = [];
let hcIndex = 0, hcTimer = null;

let featured = {};

Promise.all([load('posts.json'), load('videos.json'), load('podcasts.json'), load('featured.json')])
  .then(([p, v, pd, f]) => {
    posts = p; videos = v; pods = pd; featured = f || {};
    Reader.init(posts, featured);
    renderHero();
    renderRows();
  });

/* ---------- featured hero carousel ---------- */
// Curated headline + one line summary per post id lives in featured.json;
// posts without an entry fall back to the caption's first line.
// The five featured posts are drawn at random on every visit, so the homepage
// shows something different each time; the newest post always leads.
function pickFeatured() {
  const [newest, ...rest] = posts;
  const pool = rest.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [newest, ...pool.slice(0, 4)].filter(Boolean);
}

function renderHero() {
  const feat = pickFeatured();
  $('hcSlides').innerHTML = feat.map((p, i) => {
    const f = featured[p.slug] || {};
    const title = f.title || p.title;
    const summary = f.summary || '';
    const kicker = f.kicker || p.kicker;
    const accent = f.accent || p.accent;
    return `
    <article class="hc-slide ${i === 0 ? 'on' : ''}" data-i="${i}">
      <div class="hc-content">
        <span class="hc-kicker" style="color:${accent}">${kicker}</span>
        <h2>${title}</h2>
        ${summary ? `<p class="hc-sum">${summary}</p>` : ''}
        <button class="btn primary hc-open" data-post="${posts.indexOf(p)}">Read the post</button>
      </div>
      <img class="hc-cover" src="${p.slides[0]}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">
    </article>`;
  }).join('');
  $('hcDots').innerHTML = feat.map((_, i) =>
    `<i class="${i === 0 ? 'on' : ''}" data-i="${i}"></i>`).join('');
  $('hcSlides').querySelectorAll('.hc-open').forEach(b =>
    b.addEventListener('click', () => Reader.open(+b.dataset.post)));
  $('hcDots').querySelectorAll('i').forEach(d =>
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
  $('hcDots').querySelectorAll('i').forEach((d, k) =>
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
  const MAX_H = () => Math.min(560, window.innerHeight * 0.6);
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

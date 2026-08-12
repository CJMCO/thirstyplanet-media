/* The post reader: the slide-by-slide viewer used by every page that lists
   posts. Pages call Reader.init(posts, featured) once, then Reader.open(index).
   The markup it drives lives in the .lightbox block of each page. */
window.Reader = (() => {
  const $ = id => document.getElementById(id);
  let posts = [], featured = {}, current = { post: 0, slide: 0 };

  // A drag moves slides, because a phone has no room for arrows.
  function onSwipe(el, handler) {
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', e => {
      x0 = e.changedTouches[0].clientX;
      y0 = e.changedTouches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      // Ignore mostly-vertical drags so the page can still scroll.
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) handler(dx < 0 ? 1 : -1);
      x0 = y0 = null;
    }, { passive: true });
  }

  function render() {
    const p = posts[current.post];
    const f = featured[p.slug] || {};
    $('lbImg').src = p.slides[current.slide];
    $('lbImg').alt = `${f.title || p.title}, slide ${current.slide + 1} of ${p.slides.length}`;
    $('lbKicker').textContent = f.kicker || p.kicker;
    $('lbKicker').style.color = f.accent || p.accent;
    $('lbTitle').textContent = f.title || p.title;
    $('lbCaption').textContent = p.caption || '';
    $('lbCaption').style.display = p.caption ? '' : 'none';
    $('lbLink').href = p.permalink || 'https://www.instagram.com/thirsty.planet/';
    $('lbLink').textContent = p.permalink ? 'View this post on Instagram' : 'View on Instagram';
    $('lbDots').innerHTML = p.slides.map((_, i) =>
      `<i class="${i === current.slide ? 'on' : ''}"></i>`).join('');
  }

  function step(d) {
    const p = posts[current.post];
    current.slide = (current.slide + d + p.slides.length) % p.slides.length;
    render();
  }

  function open(i) {
    current = { post: i, slide: 0 };
    render();
    $('lightbox').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    $('lightbox').hidden = true;
    document.body.style.overflow = '';
  }

  function init(p, f) {
    posts = p;
    featured = f || {};
    const lb = $('lightbox');
    if (!lb) return;
    $('lbPrev').addEventListener('click', () => step(-1));
    $('lbNext').addEventListener('click', () => step(1));
    $('lbClose').addEventListener('click', close);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    onSwipe(lb, step);
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  return { init, open, close, onSwipe };
})();

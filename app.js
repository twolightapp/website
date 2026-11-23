/* Twolight site: the two things you can try. No dependencies, nothing leaves the page.
   1. The Overlap (hero): your shifts + theirs -> your next shared evening, by the app's own rules.
   2. The talk light (Small gestures): light it up, see it on Sam's Lock Screen, answer it. */
(function () {
  'use strict';

  /* ---------- Time together: a port of the app's TimeTogether.swift ----------
     Minutes from today's midnight. Sleep is inferred, as in the app: 8 hours after a
     night shift ends, otherwise 11 PM to 7 AM. Sample week: work Monday to Friday. */
  var DAY = 1440;
  var SHIFTS = {
    days:     { start: 420,  end: 930,  label: '7 AM – 3:30 PM' },
    evenings: { start: 900,  end: 1380, label: '3 – 11 PM' },
    nights:   { start: 1380, end: 1860, label: '11 PM – 7 AM' }
  };

  function merge(list) {
    list.sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    list.forEach(function (x) {
      var last = out[out.length - 1];
      if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
      else out.push([x[0], x[1]]);
    });
    return out;
  }

  /* Working or asleep, for days -1..22. weekday0 is today's weekday (0 = Sunday). */
  function busy(kind, weekday0) {
    var shift = SHIFTS[kind], out = [];
    for (var d = -1; d <= 22; d++) {
      var weekday = ((weekday0 + d) % 7 + 7) % 7;
      var base = d * DAY, end = null;
      if (weekday >= 1 && weekday <= 5) { out.push([base + shift.start, base + shift.end]); end = shift.end; }
      /* Worked through the night: sleep once it ends. Otherwise bed at 11 PM (or when a late shift ends). */
      var bed = end !== null && end > DAY ? base + end : base + Math.max(1380, end === null ? 1380 : end);
      out.push([bed, bed + 480]);
    }
    return merge(out);
  }

  function free(busyList, from, to) {
    var out = [], cursor = from;
    busyList.forEach(function (b) {
      if (b[1] <= cursor || cursor >= to) return;
      if (b[0] > cursor) out.push([cursor, Math.min(b[0], to)]);
      cursor = Math.max(cursor, b[1]);
    });
    if (cursor < to) out.push([cursor, to]);
    return out;
  }

  /* Both awake and neither working; overlaps under 15 minutes don't count. */
  function together(mine, theirs, from, to) {
    var a = free(mine, from, to), b = free(theirs, from, to), out = [];
    a.forEach(function (x) {
      b.forEach(function (y) {
        var s = Math.max(x[0], y[0]), e = Math.min(x[1], y[1]);
        if (e - s >= 15) out.push([s, e]);
      });
    });
    return out.sort(function (p, q) { return p[0] - q[0]; });
  }

  function longest(list) {
    return list.reduce(function (best, x) { return !best || x[1] - x[0] > best[1] - best[0] ? x : best; }, null);
  }

  /* The answer for this pair of shifts, from `now` (minutes since midnight) on weekday0. */
  function workOut(me, them, weekday0, now) {
    var mine = busy(me, weekday0), theirs = busy(them, weekday0);
    var week = together(mine, theirs, now, now + 7 * DAY)
      .reduce(function (sum, x) { return sum + x[1] - x[0]; }, 0);
    var next = null;
    /* The next evening (5 to 11 PM) with at least two shared hours, up to three weeks out. */
    for (var off = 0; off < 21 && !next; off++) {
      var from = off * DAY + 1020, to = off * DAY + 1380;
      if (to <= now) continue;
      var best = longest(together(mine, theirs, Math.max(from, now), to));
      if (best && best[1] - best[0] >= 120) next = best;
    }
    return { hours: Math.round(week / 60), next: next };
  }

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function clock(minutes) {
    var m = ((minutes % DAY) + DAY) % DAY, h = Math.floor(m / 60), mm = m % 60;
    return (h % 12 || 12) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' AM' : ' PM');
  }
  function dayName(start, weekday0) {
    var off = Math.floor(start / DAY);
    return off === 0 ? 'Tonight' : off === 1 ? 'Tomorrow' : WEEKDAYS[(weekday0 + off) % 7];
  }

  /* Exposed for the site's own checks (tests/overlap.mjs); nothing else uses it. */
  window.twolightOverlap = { workOut: workOut, dayName: dayName, clock: clock };

  function initOverlap() {
    var root = document.getElementById('overlap');
    if (!root) return;
    var el = function (sel) { return root.querySelector(sel); };
    var place = function (node, from, to) {           /* position on the 7 AM to 7 AM day */
      node.style.setProperty('--l', ((from - 420) / DAY * 100).toFixed(2));
      node.style.setProperty('--w', ((to - from) / DAY * 100).toFixed(2));
    };
    var bar = function (who, kind) {
      var shift = SHIFTS[kind], work = el('.bar.work.' + who), sleep = el('.bar.sleep.' + who);
      place(work, shift.start, shift.end);
      work.textContent = shift.label;
      /* On this day's strip: night workers sleep in the morning, everyone else from 11 PM. */
      if (kind === 'nights') place(sleep, 420, 900); else place(sleep, 1380, 1860);
    };

    function render() {
      var me = root.elements.me.value, them = root.elements.them.value;
      bar('me', me); bar('them', them);

      /* The strip shows a workday (a Wednesday), so the picture doesn't change on weekends. */
      var band = el('.band');
      var shared = longest(together(busy(me, 3), busy(them, 3), 420, 1860));
      band.classList.toggle('none', !shared);
      if (shared) place(band, shared[0], shared[1]);

      var today = new Date(), now = today.getHours() * 60 + today.getMinutes();
      var result = workOut(me, them, today.getDay(), now);
      el('#ov-next').textContent = result.next
        ? dayName(result.next[0], today.getDay()) + ' from ' + clock(result.next[0])
        : 'None in the next three weeks';
      el('#ov-hours').textContent = result.hours === 0 ? 'No overlap this week'
        : result.hours + (result.hours === 1 ? ' hour' : ' hours') + ' together this week';

      var answer = el('.answer');                      /* restart the little glow */
      answer.classList.remove('lit'); void answer.offsetWidth; answer.classList.add('lit');
    }

    root.addEventListener('change', render);
    root.addEventListener('submit', function (e) { e.preventDefault(); });
    render();
  }

  /* ---------- The talk light ---------- */
  var LEVELS = {
    green:  'Green · Catch up',
    yellow: 'Yellow · On my mind',
    red:    'Red · It matters'
  };

  function initTalk() {
    var root = document.getElementById('talk-demo');
    if (!root) return;
    var el = function (sel) { return root.querySelector(sel); };
    var pick = el('.td-pick'), on = el('.td-on'), card = el('.la'), empty = el('.lock-empty');
    var title = el('.td-state strong'), line = el('.td-state span');
    var off = el('.td-off'), talked = el('.td-talked'), thanks = el('.td-thanks'), live = el('#td-live');

    var now = new Date(), h = now.getHours(), m = now.getMinutes();
    var hm = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
    el('.lock-time').textContent = hm;
    el('.lock-date').textContent = WEEKDAYS[now.getDay()] + ', ' +
      ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
        'November', 'December'][now.getMonth()] + ' ' + now.getDate();
    el('.la-since').textContent = 'Since ' + hm + (h < 12 ? ' AM' : ' PM');

    function show(state) {
      var level = pick.elements.lvl.value;
      root.dataset.state = state;
      root.dataset.level = level;
      pick.hidden = state !== 'idle';
      on.hidden = state === 'idle';
      card.hidden = state !== 'on';
      empty.hidden = state === 'on';
      off.hidden = state !== 'on';
      talked.hidden = state !== 'answered';
      if (state !== 'idle') thanks.hidden = true;
    }

    el('.td-go').addEventListener('click', function () {
      var label = LEVELS[pick.elements.lvl.value];
      el('.la-label').textContent = label;
      title.textContent = 'Your light is on';
      line.textContent = 'It stays lit until you’ve talked or you turn it off.';
      show('on');
      live.textContent = 'Sam’s Lock Screen now shows: Dillan wants to talk. ' + label + '. With an I’m here button.';
      /* On phones only one side shows at a time; move to whichever button is visible. */
      (off.offsetParent ? off : el('.la-here')).focus();
    });

    el('.la-here').addEventListener('click', function () {
      title.textContent = 'Sam’s here to talk';      /* the alert your phone gets */
      line.textContent = 'Sam said they’re here. When you’ve talked, tap We talked.';
      empty.textContent = 'Sam tapped I’m here.';
      show('answered');
      live.textContent = 'Sam tapped I’m here. Your phone says: Sam said they’re here. When you’ve talked, tap We talked.';
      talked.focus();
    });

    function reset(message) {
      empty.textContent = 'Nothing yet. Light it up.';
      show('idle');
      thanks.hidden = !message;
      live.textContent = message || 'Your light is off.';
      el('.td-go').focus();
    }
    off.addEventListener('click', function () { reset(''); });
    talked.addEventListener('click', function () { reset('Thank you for talking.'); });
    pick.addEventListener('submit', function (e) { e.preventDefault(); });
    show('idle');
  }

  function start() { initOverlap(); initTalk(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ---------- A day with Twolight: phones lean toward the pointer (mouse and trackpad only) ---------- */
  var canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canTilt) {
    Array.prototype.forEach.call(document.querySelectorAll('.moment-shot'), function (shot) {
      var tilt = shot.querySelector('.tilt');
      if (!tilt) return;
      shot.addEventListener('pointermove', function (e) {
        var r = shot.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--tx', (x * 16).toFixed(2) + 'deg');
        tilt.style.setProperty('--ty', (-y * 12).toFixed(2) + 'deg');
      });
      shot.addEventListener('pointerleave', function () {
        tilt.style.setProperty('--tx', '0deg');
        tilt.style.setProperty('--ty', '0deg');
      });
    });
  }

  /* ---------- A day with Twolight, v2: travel a 3D path (desktop only; phones keep the swipe cards) ---------- */
  function initDay3D() {
    var day = document.getElementById('day');
    if (!day) return;
    var wide = window.matchMedia('(min-width: 900px)');
    var still = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!wide.matches || still.matches) return;            // the plain timeline is already a good page
    var runway = day.querySelector('.day-runway');
    var stage = day.querySelector('.day-stage');
    var world = day.querySelector('.day-world');
    var lights = day.querySelector('.day-lights');
    var moments = Array.prototype.slice.call(day.querySelectorAll('.moment'));
    var sky = ['.sky-morning', '.sky-noon', '.sky-dusk', '.sky-night'].map(function (q) { return day.querySelector(q); });
    if (!runway || !stage || !world || moments.length < 2) return;
    day.classList.add('day-3d');

    var N = moments.length, GAP = 1300, SWAY = 460, BACK = 430;
    function px(t) { return Math.sin(t * 1.05) * SWAY; }      // the road winds left and right...
    function pz(t) { return -t * GAP; }                        // ...and runs away from you
    function yaw(t) { var dx = SWAY * 1.05 * Math.cos(t * 1.05); return Math.atan2(dx, GAP) * 180 / Math.PI; }

    /* Path lights along the road, a little below the cards. */
    for (var k = -4; k <= (N - 1) * 9 + 6; k++) {
      var t = k / 9, b = document.createElement('b');
      b.style.transform = 'translate3d(' + px(t).toFixed(1) + 'px, 330px, ' + pz(t).toFixed(1) + 'px) rotateX(90deg)';
      lights.appendChild(b);
    }
    /* Each moment waits at its own bend, turned toward the road. */
    moments.forEach(function (m, i) {
      m.dataset.base = 'translate3d(' + px(i).toFixed(1) + 'px, 0, ' + pz(i).toFixed(1) + 'px)';
    });

    /* HUD: the time of day, and stops to jump to. */
    var hud = document.createElement('div'); hud.className = 'day-hud';
    var clock = document.createElement('p'); clock.className = 'day-clock'; clock.setAttribute('aria-hidden', 'true');
    var stops = document.createElement('nav'); stops.className = 'day-stops'; stops.setAttribute('aria-label', 'Moments in the day');
    moments.forEach(function (m, i) {
      var time = (m.querySelector('.moment-time') || {}).textContent || String(i + 1);
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = time.replace(/ (AM|PM)$/, '');
      btn.setAttribute('aria-label', 'Go to ' + time);
      btn.addEventListener('click', function () { goTo(i); });
      stops.appendChild(btn);
    });
    var hint = document.createElement('p'); hint.className = 'day-hint'; hint.textContent = 'Scroll to travel through the day';
    hud.appendChild(clock); hud.appendChild(stops); stage.appendChild(hud); stage.appendChild(hint);

    /* Bring stop i to the center of the stage. */
    function stopY(i) {
      var top = runway.getBoundingClientRect().top + window.scrollY;
      return top + (runway.offsetHeight - window.innerHeight) * (i / (N - 1));
    }
    function goTo(i) { window.scrollTo({ top: stopY(i), behavior: 'smooth' }); }
    /* Touching or tabbing into a stop centers it, so it's in focus while you play with it. */
    moments.forEach(function (m, i) {
      function center() { if (Math.abs(window.scrollY - stopY(i)) > 4) goTo(i); }
      m.addEventListener('pointerdown', center);
      m.addEventListener('focusin', center);
    });
    /* When scrolling settles near a stop, ease the last bit so the stop sits centered. */
    var settle = 0;
    window.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var r = runway.getBoundingClientRect();
        if (r.top > 0 || r.bottom < window.innerHeight) return;            // only inside the path
        var span = runway.offsetHeight - window.innerHeight, t = (-r.top / span) * (N - 1), i = Math.round(t);
        if (Math.abs(t - i) > 0.02 && Math.abs(t - i) < 0.3) goTo(i);
      }, 180);
    }, { passive: true });

    function size() { runway.style.height = (N * 85 + 60) + 'vh'; }
    size();

    var raf = 0, lastIndex = -1;
    function frame() {
      raf = 0;
      var r = runway.getBoundingClientRect(), span = runway.offsetHeight - window.innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      var t = p * (N - 1);
      var a = yaw(t);
      world.style.transform = 'rotateY(' + (-a * 0.55).toFixed(2) + 'deg) translate3d(' + (-px(t)).toFixed(1) + 'px, 0, ' + (-(pz(t) + BACK)).toFixed(1) + 'px)';
      moments.forEach(function (m, i) {
        var d = t - i, ad = Math.abs(d);
        var o = d > 0 ? Math.max(0, 1 - d * 3.2) : Math.max(0.1, 1 - ad * 0.5);
        m.style.opacity = o.toFixed(3);
        m.style.filter = ad > 0.35 ? 'blur(' + Math.min(6, (ad - 0.35) * 4).toFixed(1) + 'px)' : 'none';
        /* Angled while you travel toward it; square to the camera when it's the stop you're on. */
        var focus = Math.max(0, 1 - ad * 2.5), yi = yaw(i);
        var turn = (-yi * 0.6) * (1 - focus) + (a * 0.55) * focus;
        m.style.transform = m.dataset.base + ' rotateY(' + turn.toFixed(2) + 'deg)' + (d > 0 ? ' translate3d(' + (d * 260 * (i % 2 ? -1 : 1)).toFixed(1) + 'px, ' + (-d * 90).toFixed(1) + 'px, 0)' : '');
        m.style.pointerEvents = ad < 0.5 ? 'auto' : 'none';
      });
      /* Sky: morning -> noon -> dusk -> night across the day. */
      var s = p * 3;
      sky.forEach(function (el, i) { if (el) el.style.opacity = Math.max(0, 1 - Math.abs(s - i)).toFixed(3); });
      if (sky[0]) sky[0].style.opacity = Math.max(+sky[0].style.opacity, s < 0 ? 1 : 0).toFixed(3);
      day.classList.toggle('is-night', s > 1.6);
      var idx = Math.round(t);
      if (idx !== lastIndex) {
        lastIndex = idx;
        clock.textContent = (moments[idx].querySelector('.moment-time') || {}).textContent || '';
        Array.prototype.forEach.call(stops.children, function (b, i) { b.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
      }
      hint.style.opacity = p > 0.03 ? '0' : '1';
    }
    function ask() { if (!raf) raf = requestAnimationFrame(frame); }
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', function () { size(); ask(); });
    function leave() { if (!wide.matches || still.matches) window.location.reload(); }
    if (wide.addEventListener) { wide.addEventListener('change', leave); still.addEventListener('change', leave); }
    frame();
  }

  /* ---------- Twolight lofi: an original loop made live with Web Audio (no file, nothing licensed) ----------
     Slow jazzy 7th chords, a soft bass, a lazy swung beat and a little vinyl crackle. Off unless chosen. */
  var Lofi = (function () {
    var ctx = null, master = null, timer = 0, next = 0, step = 0, on = false, noise = null;
    var BPM = 72, SPB = 60 / BPM / 2;           // eighth notes
    var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];   // Fmaj7 Em7 Dm7 Cmaj7
    function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
    function build() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0;
      var tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1700; tone.Q.value = 0.4;
      master.connect(tone); tone.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      /* vinyl: soft hiss + sparse crackles, looping */
      var vinyl = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), v = vinyl.getChannelData(0);
      for (var j = 0; j < v.length; j++) v[j] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0006 ? (Math.random() - 0.5) * 0.5 : 0);
      var vs = ctx.createBufferSource(); vs.buffer = vinyl; vs.loop = true; vs.connect(master); vs.start();
    }
    function note(n, t, len, vol, type) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle'; o.frequency.value = hz(n); o.detune.value = (Math.random() - 0.5) * 12;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.05);
    }
    function hit(t, kind) {
      if (kind === 'kick') {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
        g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32); return;
      }
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
      s.buffer = noise; f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 7000;
      var len = kind === 'snare' ? 0.18 : 0.05, vol = kind === 'snare' ? 0.18 : 0.05;
      g2.gain.setValueAtTime(vol, t); g2.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g2); g2.connect(master); s.start(t, Math.random()); s.stop(t + len + 0.02);
    }
    function tick() {
      while (next < ctx.currentTime + 0.3) {
        var t = next + (step % 2 ? SPB * 0.18 : 0);           // swing the off-beats
        var bar = Math.floor(step / 8), chord = CHORDS[Math.floor(bar / 2) % CHORDS.length], s8 = step % 8;
        if (s8 === 0 && bar % 2 === 0) chord.forEach(function (n, i) { note(n, t + i * 0.025, SPB * 15, 0.06, 'triangle'); });
        if (s8 === 0 || s8 === 5) note(chord[0] - 12, t, SPB * 3, 0.16, 'sine');
        if (s8 === 0 || s8 === 3 && bar % 2) hit(t, 'kick');
        if (s8 === 4) hit(t, 'snare');
        hit(t, 'hat');
        if (s8 === 6 && Math.random() < 0.5) note(chord[(Math.random() * 4) | 0] + 12, t, SPB * 2, 0.03, 'sine');
        next += SPB; step++;
      }
    }
    function start() {
      if (!ctx) build();
      ctx.resume(); on = true;
      next = Math.max(next, ctx.currentTime + 0.05);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
      if (!timer) timer = setInterval(tick, 100);
    }
    function stop() {
      if (!ctx) return; on = false;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      setTimeout(function () { if (!on) { clearInterval(timer); timer = 0; ctx.suspend(); } }, 700);
    }
    document.addEventListener('visibilitychange', function () {
      if (!ctx || !on) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    return { start: start, stop: stop, get on() { return on; } };
  })();

  /* ---------- Hero, experience mode: twilight horizon, the road at your feet, two phones and a hug ---------- */
  function initHeroScene() {
    var hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.hero-scene')) return;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scene = document.createElement('div'); scene.className = 'hero-scene'; scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = '<div class="hs-stars"></div><div class="hs-sun"></div><div class="hs-ground"><div class="hs-road"></div></div>' +
      '<div class="hs-phones"><div class="hs-phone mine"><img src="/media/day-morning.jpg" alt="" width="560" height="1217"><span class="who">You</span></div>' +
      '<div class="hs-link"></div><span class="hs-hug"></span>' +
      '<div class="hs-phone theirs"><img src="/media/day-countdowns-dark.jpg" alt="" width="560" height="1217"><span class="who">Alex</span></div>' +
      '<div class="hs-toast">Alex got your hug.</div></div>';
    hero.insertBefore(scene, hero.firstChild);
    var road = scene.querySelector('.hs-road');
    function rx(d) { return Math.sin(d / 650) * 180; }
    for (var d = -200; d <= 4200; d += 110) {
      var l = document.createElement('b');
      l.style.transform = 'translate(' + (rx(d) - 70).toFixed(1) + 'px,' + (-d) + 'px)'; road.appendChild(l);
      var r = document.createElement('b');
      r.style.transform = 'translate(' + (rx(d) + 70).toFixed(1) + 'px,' + (-d) + 'px)'; road.appendChild(r);
    }
    var you = document.createElement('b'); you.className = 'you'; road.appendChild(you);
    var them = document.createElement('b'); them.className = 'them'; road.appendChild(them);

    /* Buttons: start the day, watch the story (the film moves into a dialog), send a hug. */
    var copy = hero.querySelector('.hero-copy'), meet = copy && copy.querySelector('.button');
    var film = hero.querySelector('.film');
    if (meet) {
      var acts = document.createElement('div'); acts.className = 'hero-actions';
      var start = document.createElement('a'); start.className = 'button'; start.href = '#day';
      start.innerHTML = 'Start the day <span aria-hidden="true">↓</span>';
      acts.appendChild(start);
      if (film && window.HTMLDialogElement) {
        var dlg = document.createElement('dialog'); dlg.className = 'film-dialog'; dlg.setAttribute('aria-label', 'The Twolight story');
        var close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.textContent = 'Close';
        dlg.appendChild(close); dlg.appendChild(film); document.body.appendChild(dlg);
        var vid = film.querySelector('video');
        close.addEventListener('click', function () { dlg.close(); });
        dlg.addEventListener('close', function () { if (vid) vid.pause(); });
        var watch = document.createElement('button'); watch.type = 'button'; watch.className = 'hero-ghost'; watch.textContent = 'Watch the story';
        watch.addEventListener('click', function () { dlg.showModal(); if (vid) { vid.muted = false; vid.play().catch(function () {}); } });
        acts.appendChild(watch);
      }
      meet.replaceWith(acts);
    }
    var hugBtn = document.createElement('button'); hugBtn.type = 'button'; hugBtn.className = 'hero-ghost hs-hugbtn'; hugBtn.textContent = 'Send Alex a hug';
    (copy || hero).appendChild(hugBtn);
    var hug = scene.querySelector('.hs-hug'), toast = scene.querySelector('.hs-toast'), toastTimer = 0;
    function sendHug() {
      hugBtn.textContent = 'Hug sent'; setTimeout(function () { hugBtn.textContent = 'Send Alex a hug'; }, 2600);
      hug.classList.remove('go'); void hug.offsetWidth; hug.classList.add('go');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.add('show'); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200); }, still ? 0 : 1300);
    }
    hugBtn.addEventListener('click', sendHug);
    if (!still) setTimeout(sendHug, 1800);

    /* Scroll: fly down the road; you and Alex walk toward each other; the phones lift away; the sun sinks. */
    var sun = scene.querySelector('.hs-sun'), phones = scene.querySelector('.hs-phones'), raf = 0;
    function place(p) {
      var dy = 900 + p * 1800, dt = 2600 - p * 1600;          // distance down the road for each light
      if (dt < dy + 60) { dy = dt = (dy + dt) / 2; }
      you.style.transform = 'translate(' + (rx(dy) - 14).toFixed(1) + 'px,' + (-dy) + 'px)';
      them.style.transform = 'translate(' + (rx(dt) + 14).toFixed(1) + 'px,' + (-dt) + 'px)';
      road.style.transform = 'rotateX(76deg) translateY(' + (p * 1400).toFixed(1) + 'px)';
      sun.style.transform = 'translateY(' + (p * 90).toFixed(1) + 'px) scale(' + (1 - p * 0.15).toFixed(3) + ')';
      phones.style.transform = 'translateY(' + (-p * 260).toFixed(1) + 'px)';
      phones.style.opacity = Math.max(0, 1 - p * 1.6).toFixed(3);
    }
    function frame() { raf = 0; var h = hero.offsetHeight || 1; place(Math.min(1, Math.max(0, window.scrollY / h))); }
    place(0);
    if (!still) window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
  }

  /* ---------- Two ways to see Twolight: the experience (3D path + things to try) or simple ----------
     Chosen on the first visit, remembered on this device only (localStorage, nothing is sent anywhere),
     switchable from the header. Simple is the page as it always was. */
  (function () {
    var day = document.getElementById('day');
    if (!day) return;
    var KEY = 'twolight.mode';
    function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    var mode = saved();
    var MKEY = 'twolight.music';
    function saveMusic(v) { try { localStorage.setItem(MKEY, v); } catch (e) {} }
    function musicSaved() { try { return localStorage.getItem(MKEY) === 'on'; } catch (e) { return false; } }
    function musicButton() {
      if (document.querySelector('.music-btn')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'music-btn';
      function label() { b.textContent = Lofi.on ? 'Music on' : 'Music off'; b.setAttribute('aria-pressed', Lofi.on ? 'true' : 'false'); }
      b.addEventListener('click', function () { if (Lofi.on) { Lofi.stop(); saveMusic('off'); } else { Lofi.start(); saveMusic('on'); } setTimeout(label, 0); });
      label(); document.body.appendChild(b);
    }

    function moveExtras() {
      var line = day.querySelector('.day-line');
      /* Try it: your shifts and theirs, first stop on the path. */
      var overlap = document.getElementById('overlap');
      if (overlap && line) {
        var li = document.createElement('li');
        li.className = 'moment moment-play'; li.id = 'day-try';
        li.innerHTML = '<div class="moment-copy"><p class="moment-time"><span>Try it</span></p><p class="moment-problem">Different shifts, and no idea when you’re both free.</p><h3>Find your next evening.</h3><p>Pick your hours and your partner’s. This is the same math the app uses, sleep included.</p><span class="badge">Free</span></div>';
        var play = document.createElement('div'); play.className = 'moment-shot moment-widget';
        play.appendChild(overlap); li.appendChild(play);
        line.insertBefore(li, line.firstChild);
      }
      /* 6:40 AM: send a hug. */
      var morning = document.getElementById('day-morning');
      if (morning) {
        var copy = morning.querySelector('.moment-copy');
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'play-btn'; btn.textContent = 'Send a hug';
        var note = document.createElement('p'); note.className = 'play-note'; note.setAttribute('role', 'status');
        btn.addEventListener('click', function () {
          var heart = document.createElement('span'); heart.className = 'hug-fly'; heart.setAttribute('aria-hidden', 'true');
          morning.appendChild(heart);
          heart.addEventListener('animationend', function () { heart.remove(); });
          note.textContent = 'Hug sent to Alex. It waits until they’re up.';
        });
        copy.appendChild(btn); copy.appendChild(note);
      }
      /* 12:15 PM: save a gift. Drag the product into your private gift ideas (or tap Save). */
      var gift = document.getElementById('day-gift');
      if (gift) {
        var gc = gift.querySelector('.moment-copy');
        var g = document.createElement('div'); g.className = 'play gift-play';
        g.innerHTML = '<div class="gift-item" tabindex="0" role="button" aria-label="Wool scarf, $38. Drag to Gift ideas or press Enter to save">' +
          '<i aria-hidden="true"></i><span><b>Wool scarf</b><small>shop.example · $38</small></span></div>' +
          '<div class="gift-box" aria-hidden="true"><b>Gift ideas</b><small>Only you can see these</small></div>' +
          '<p class="play-note" role="status"></p>';
        gc.appendChild(g);
        var item = g.querySelector('.gift-item'), box = g.querySelector('.gift-box'), gnote = g.querySelector('.play-note');
        var saved = false, sx = 0, sy = 0, dragging = false;
        function keep() {
          if (saved) return; saved = true;
          item.style.transform = ''; item.classList.add('saved'); box.classList.add('got');
          box.querySelector('small').textContent = 'Wool scarf · $38 · saved';
          gnote.textContent = 'Saved to your gift ideas. Alex never sees it.';
        }
        item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); keep(); } });
        item.addEventListener('pointerdown', function (e) { if (saved) return; dragging = true; sx = e.clientX; sy = e.clientY; item.setPointerCapture(e.pointerId); item.classList.add('lift'); });
        item.addEventListener('pointermove', function (e) { if (!dragging) return; item.style.transform = 'translate(' + (e.clientX - sx) + 'px,' + (e.clientY - sy) + 'px) rotate(-3deg)'; });
        item.addEventListener('pointerup', function (e) {
          if (!dragging) return; dragging = false; item.classList.remove('lift');
          var a = item.getBoundingClientRect(), b = box.getBoundingClientRect();
          var hitBox = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
          var moved = Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
          if (hitBox || moved < 6) keep(); else item.style.transform = '';
        });
      }
      /* Saturday: build a bouquet, wrap it, send it. Simple shapes, drawn here. */
      var fl = document.getElementById('day-flowers');
      if (fl) {
        var fshot = fl.querySelector('.moment-shot');
        var f = document.createElement('div'); f.className = 'moment-shot moment-widget play bouquet-play';
        f.innerHTML = '<svg class="bq" viewBox="0 0 240 260" role="img" aria-label="Your bouquet"><g class="bq-stems"></g><g class="bq-heads"></g>' +
          '<path class="bq-wrap" d="M62 150 L178 150 L136 250 L104 250 Z"/><path class="bq-ribbon" d="M106 214 L134 214 L132 224 L108 224 Z"/></svg>' +
          '<div class="bq-pick" role="group" aria-label="Add flowers"><button type="button" data-f="rose">Rose</button><button type="button" data-f="tulip">Tulip</button>' +
          '<button type="button" data-f="daisy">Daisy</button><button type="button" data-f="green">Greenery</button></div>' +
          '<div class="bq-actions"><button type="button" class="play-btn bq-wrap-btn" disabled>Wrap it</button><button type="button" class="play-btn quiet bq-send" disabled>Send to Alex</button></div>' +
          '<p class="play-note" role="status">Tap a few flowers.</p>';
        if (fshot) fshot.replaceWith(f); else fl.appendChild(f);
        fl.classList.add('moment-play');
        var heads = f.querySelector('.bq-heads'), stems = f.querySelector('.bq-stems'), svg = f.querySelector('.bq');
        var wrapBtn = f.querySelector('.bq-wrap-btn'), sendBtn = f.querySelector('.bq-send'), fnote = f.querySelector('.play-note');
        var count = 0, NS = 'http://www.w3.org/2000/svg';
        var SPOTS = [[120, 70], [92, 86], [148, 84], [106, 52], [136, 50], [78, 62], [162, 62], [120, 100], [96, 112], [146, 110], [120, 36], [70, 96]];
        function el(n, at) { var e = document.createElementNS(NS, n); for (var k in at) e.setAttribute(k, at[k]); return e; }
        function bloom(kind, x, y) {
          var g = el('g', { 'class': 'bq-flower bq-' + kind, transform: 'translate(' + x + ' ' + y + ')' });
          if (kind === 'rose') { g.appendChild(el('circle', { r: 15 })); g.appendChild(el('path', { d: 'M-8 -2 Q0 -12 8 -2 Q0 6 -8 -2Z', 'class': 'in' })); }
          else if (kind === 'tulip') { g.appendChild(el('path', { d: 'M-12 6 Q-14 -14 -6 -10 L0 -16 L6 -10 Q14 -14 12 6 Q0 14 -12 6Z' })); }
          else if (kind === 'daisy') { for (var a = 0; a < 8; a++) g.appendChild(el('ellipse', { rx: 4, ry: 11, transform: 'rotate(' + a * 45 + ') translate(0 -9)' })); g.appendChild(el('circle', { r: 5, 'class': 'in' })); }
          else { g.appendChild(el('path', { d: 'M0 14 Q-14 -4 0 -18 Q14 -4 0 14Z' })); }
          return g;
        }
        Array.prototype.forEach.call(f.querySelectorAll('.bq-pick button'), function (b) {
          b.addEventListener('click', function () {
            if (count >= SPOTS.length || svg.classList.contains('wrapped')) return;
            var at = SPOTS[count++], kind = b.getAttribute('data-f');
            stems.appendChild(el('path', { d: 'M' + at[0] + ' ' + at[1] + ' Q' + (at[0] + 120) / 2 + ' ' + (at[1] + 190) / 2 + ' 120 236' }));
            heads.appendChild(bloom(kind, at[0], at[1]));
            wrapBtn.disabled = count < 3;
            fnote.textContent = count < 3 ? 'A couple more.' : count + ' stems. Wrap it when it looks right.';
          });
        });
        wrapBtn.addEventListener('click', function () { svg.classList.add('wrapped'); wrapBtn.disabled = true; sendBtn.disabled = false; fnote.textContent = 'Wrapped. Alex opens it on their phone.'; });
        sendBtn.addEventListener('click', function () { svg.classList.add('sent'); sendBtn.disabled = true; fnote.textContent = 'On its way to Alex. One bouquet a week is free.'; });
      }
      /* Every day: add a countdown and watch it count. */
      var cd = document.getElementById('day-dates');
      if (cd) {
        var cc = cd.querySelector('.moment-copy');
        var c = document.createElement('form'); c.className = 'play cd-play';
        c.innerHTML = '<label>What are you counting down to?<input name="what" maxlength="24" placeholder="Our trip" required></label>' +
          '<label>When?<input name="when" type="date" required></label><button class="play-btn" type="submit">Add countdown</button>' +
          '<div class="cd-tiles" aria-live="polite"></div>';
        cc.appendChild(c);
        var whenIn = c.querySelector('[name=when]'), soon = new Date(Date.now() + 12 * 864e5);
        whenIn.value = soon.toISOString().slice(0, 10); whenIn.min = new Date().toISOString().slice(0, 10);
        c.addEventListener('submit', function (e) {
          e.preventDefault();
          var what = c.querySelector('[name=what]').value.trim() || 'Our trip';
          var d = new Date(whenIn.value + 'T00:00:00'), today = new Date(); today.setHours(0, 0, 0, 0);
          var days = Math.max(0, Math.round((d - today) / 864e5));
          var tiles = c.querySelector('.cd-tiles');
          if (tiles.children.length >= 4) tiles.removeChild(tiles.firstChild);
          var t = document.createElement('div'); t.className = 'cd-tile' + (days <= 14 ? ' soon' : '');
          var nb = document.createElement('b'); nb.textContent = days;
          var sm = document.createElement('small'); sm.textContent = days === 1 ? 'day' : 'days';
          var nm = document.createElement('span'); nm.textContent = what;
          var dt = document.createElement('em'); dt.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          t.appendChild(nb); t.appendChild(sm); t.appendChild(nm); t.appendChild(dt); tiles.appendChild(t);
        });
      }
      /* 9:10 PM: the real talk light demo. */
      var talk = document.querySelector('.talk-figure');
      var talkStop = document.getElementById('day-talk');
      if (talk && talkStop) {
        var shot = talkStop.querySelector('.moment-shot');
        var holder = document.createElement('div'); holder.className = 'moment-shot moment-widget';
        holder.appendChild(talk);
        if (shot) shot.replaceWith(holder); else talkStop.appendChild(holder);
        talkStop.classList.add('moment-play');
      }
    }

    function apply(m) {
      document.documentElement.classList.toggle('mode-experience', m === 'experience');
      document.documentElement.classList.toggle('mode-simple', m !== 'experience');
      if (m === 'experience') { moveExtras(); initHeroScene(); initDay3D(); musicButton(); }
    }

    /* Header switch. */
    var nav = document.querySelector('header nav');
    if (nav) {
      var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'mode-switch';
      sw.textContent = mode === 'experience' ? 'Simple view' : 'The experience';
      sw.addEventListener('click', function () { save(mode === 'experience' ? 'simple' : 'experience'); window.location.reload(); });
      nav.appendChild(sw);
    }

    if (mode === 'experience' || mode === 'simple') {
      apply(mode);
      if (mode === 'experience' && musicSaved()) {
        var once = function () { Lofi.start(); var mb = document.querySelector('.music-btn'); if (mb) { mb.textContent = 'Music on'; mb.setAttribute('aria-pressed', 'true'); } window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once); };
        window.addEventListener('pointerdown', once); window.addEventListener('keydown', once);
      }
      return;
    }

    /* First visit: ask. Simple is underneath already, so nothing is hidden behind the choice. */
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var gate = document.createElement('div'); gate.className = 'welcome'; gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'welcome-title');
    gate.innerHTML = '<div class="welcome-card"><img src="/icon.png" width="64" height="64" alt=""><p class="eyebrow">WELCOME TO TWOLIGHT</p>' +
      '<h2 id="welcome-title">How would you like to look around?</h2>' +
      '<div class="welcome-choices"><button type="button" class="welcome-go" data-mode="experience"><strong>Load the experience</strong><span>Travel through a day together and try things as you go.' + (still ? ' Has motion.' : '') + '</span></button>' +
      '<button type="button" class="welcome-go quiet" data-mode="simple"><strong>Keep it simple</strong><span>A calm page that’s quick to read.</span></button></div>' +
      '<label class="welcome-music"><input type="checkbox" id="welcome-music"> <span>Play soft lofi music while I look around</span></label>' +
      '<p class="welcome-note">You can switch any time at the top of the page.</p></div>';
    document.body.appendChild(gate);
    document.documentElement.classList.add('welcome-open');
    var first = gate.querySelector(still ? '[data-mode="simple"]' : '[data-mode="experience"]');
    if (first) first.focus();
    function choose(m) {
      save(m); mode = m;
      var wants = gate.querySelector('#welcome-music');
      if (m === 'experience' && wants && wants.checked) { saveMusic('on'); Lofi.start(); } else saveMusic('off');
      document.documentElement.classList.remove('welcome-open'); gate.remove();
      var label = nav && nav.querySelector('.mode-switch');
      if (label) label.textContent = m === 'experience' ? 'Simple view' : 'The experience';
      apply(m);
      var mb = document.querySelector('.music-btn'); if (mb) { mb.textContent = Lofi.on ? 'Music on' : 'Music off'; mb.setAttribute('aria-pressed', Lofi.on ? 'true' : 'false'); }
      window.scrollTo(0, 0);
    }
    Array.prototype.forEach.call(gate.querySelectorAll('.welcome-go'), function (b) {
      b.addEventListener('click', function () { choose(b.getAttribute('data-mode')); });
    });
    gate.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') choose('simple');
      if (e.key === 'Tab') {        /* keep focus inside the two choices */
        var bs = gate.querySelectorAll('.welcome-go'), a = bs[0], z = bs[bs.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  })();
})();

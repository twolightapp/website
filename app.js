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

  /* Exposed for quick checks from the browser console; nothing else uses it. */
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
      if (rendered) root.dispatchEvent(new CustomEvent('ovresult', { detail: { found: !!result.next } }));
      rendered = true;
    }
    var rendered = false;

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
      var NAMES = { 'day-morning': 'Before work', 'day-gift': 'Gift idea', 'day-order': 'Their order', 'day-late': 'Running late',
        'day-talk': 'Talk', 'day-flowers': 'Flowers', 'day-dates': 'Countdowns' };
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = NAMES[m.id] || time.replace(/ (AM|PM)$/, '');
      btn.setAttribute('aria-label', 'Go to ' + time + ': ' + btn.textContent);
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
    dayGoTo = function (id) { for (var k = 0; k < moments.length; k++) if (moments[k].id === id) { goTo(k); return true; } return false; };
    dayProgress = function () {
      var r = runway.getBoundingClientRect(), span = runway.offsetHeight - window.innerHeight;
      if (r.top > window.innerHeight || r.bottom < 0) return -1;
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) * (N - 1) : 0;
    };
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

    var raf = 0, lastIndex = -1, lastP = -1;
    function frame() {
      raf = 0;
      var r = runway.getBoundingClientRect(), span = runway.offsetHeight - window.innerHeight;
      var p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
      if (p === lastP && lastIndex !== -1) return;   // outside the path, or no movement: skip the work
      lastP = p;
      var t = p * (N - 1);
      var a = yaw(t);
      world.style.transform = 'rotateY(' + (-a * 0.55).toFixed(2) + 'deg) translate3d(' + (-px(t)).toFixed(1) + 'px, 0, ' + (-(pz(t) + BACK)).toFixed(1) + 'px)';
      moments.forEach(function (m, i) {
        var d = t - i, ad = Math.abs(d);
        var o = d > 0 ? Math.max(0, 1 - d * 3.2) : Math.max(0.1, 1 - ad * 0.5);
        m.style.opacity = o.toFixed(3);
        m.style.visibility = (o < 0.02 || ad > 2.6) ? 'hidden' : 'visible';   // far cards cost nothing
        /* Only the stop you're on can be tabbed into; the stops bar moves between them. */
        var active = ad < 0.5;
        if (m.inert === active) m.inert = !active;
        /* Angled while you travel toward it; square to the camera when it's the stop you're on. */
        var focus = Math.max(0, 1 - ad * 2.5), yi = yaw(i);
        var turn = (-yi * 0.6) * (1 - focus) + (a * 0.55) * focus;
        m.style.transform = m.dataset.base + ' rotateY(' + turn.toFixed(2) + 'deg)' + (d > 0 ? ' translate3d(' + (d * 260 * (i % 2 ? -1 : 1)).toFixed(1) + 'px, ' + (-d * 90).toFixed(1) + 'px, 0)' : '');
        m.style.pointerEvents = active ? 'auto' : 'none';
      });
      /* Sky: morning -> noon -> dusk -> night across the day. */
      var s = p * 3;
      sky.forEach(function (el, i) { if (el) el.style.opacity = Math.max(0, 1 - Math.abs(s - i)).toFixed(3); });
      if (sky[0]) sky[0].style.opacity = Math.max(+sky[0].style.opacity, s < 0 ? 1 : 0).toFixed(3);
      day.classList.toggle('is-night', s > 1.6);
      var idx = Math.round(t);
      if (idx !== lastIndex) {
        if (lastIndex !== -1) Lofi.swoosh();
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
     Slow jazzy 7th chords, a soft bass, a lazy swung beat. Clean mix, no vinyl noise. Off unless chosen. */
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
      /* Clean mix: no vinyl hiss or crackle (Christian's pick). */
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
    /* Little sounds, only while the music is on (the visitor chose sound). Very quiet. */
    var lastSwoosh = 0;
    function swoosh() {
      if (!on || !ctx) return;
      var t = ctx.currentTime; if (t - lastSwoosh < 0.35) return; lastSwoosh = t;
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.36);
    }
    function chime() {
      if (!on || !ctx) return;
      var t = ctx.currentTime + 0.02;
      note(76, t, 1.4, 0.05, 'sine'); note(81, t + 0.16, 1.8, 0.05, 'sine');      // two notes that resolve
    }
    return { start: start, stop: stop, swoosh: swoosh, chime: chime, get on() { return on; } };
  })();

  var dayGoTo = null, dayProgress = null;

  /* ---------- Ribbons: two lights behind the whole page, clay for you and teal for your partner ----------
     They drift apart during the busy parts of the day and braid together at each stop and at the end.
     One fixed canvas, drawn at reduced resolution (the softness is the point). Still on phones and with Reduce Motion. */
  function initRibbons() {
    if (document.querySelector('.ribbons')) return;
    var cv = document.createElement('canvas'); cv.className = 'ribbons'; cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    var g = cv.getContext('2d'); if (!g) return;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(min-width: 900px)').matches;
    var W = 0, H = 0, SCALE = 0.5, time = 0, eased = 0.6, raf = 0, last = 0;
    function size() {
      W = Math.round(window.innerWidth * SCALE); H = Math.round(window.innerHeight * SCALE);
      cv.width = W; cv.height = H;
    }
    /* How far apart the two lights are: 0 = braided together, 1 = far apart. */
    function apartness() {
      var t = dayProgress ? dayProgress() : -1;
      if (t >= 0) { var f = t - Math.floor(t); return 0.25 + 0.75 * Math.sin(f * Math.PI); }   // together at every stop
      var doc = document.documentElement, end = doc.scrollHeight - window.innerHeight;
      var q = end > 0 ? window.scrollY / end : 0;
      return q > 0.85 ? Math.max(0.05, 0.55 - (q - 0.85) * 3.4) : 0.55;                        // they meet at the end
    }
    function strand(color, sign, sep, phase) {
      var mid = H * 0.56, amp = H * 0.16, n = 64;
      for (var k = 0; k < 9; k++) {                       // nine fine strands make one silky ribbon
        var spread = (k - 4) * H * 0.006;
        g.beginPath();
        for (var i = 0; i <= n; i++) {
          var x = (i / n) * (W * 1.2) - W * 0.1, u = i / n;
          var y = mid + amp * Math.sin(u * 3.1 + phase * 0.6) * (0.6 + 0.4 * Math.sin(phase * 0.3))
                + sign * sep * Math.sin(u * 5.2 + phase) + spread * (1 + Math.sin(u * 4 + phase + k));
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = color.replace('A', (k === 4 ? 0.5 : 0.11).toString());
        g.lineWidth = k === 4 ? 1.6 : 3.2;
        g.stroke();
      }
    }
    function draw() {
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      var sep = H * (0.04 + 0.2 * eased);
      strand('rgba(232,134,107,A)', 1, sep, time);
      strand('rgba(111,179,184,A)', -1, sep, time + 0.4);
      g.globalCompositeOperation = 'source-over';
    }
    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (ts - last < 32) return;                         // ~30 fps is plenty for slow light
      var dt = Math.min(0.1, (ts - last) / 1000); last = ts;
      time += dt * 0.25;
      eased += (apartness() - eased) * 0.08;
      draw();
    }
    size(); eased = apartness(); draw();
    window.addEventListener('resize', function () { size(); draw(); });
    if (still) { window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; eased = apartness(); draw(); }); }, { passive: true }); return; }
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
  }

  /* Links to a stop (#day-talk) travel along the path instead of jumping; "The app" goes to the bento. */
  function wireExperienceLinks() {
    /* Land on the hero: don't restore an old scroll spot, and don't honor a leftover #day from 'Start the day'. */
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
    if (location.hash === '#day' || location.hash === '#features') {
      history.replaceState(null, '', location.pathname + location.search);
      window.scrollTo(0, 0);
    }
    /* In-page jumps scroll smoothly without leaving a hash behind. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#day"], a[href="#features"]');
      if (!a) return;
      var t = document.querySelector(a.getAttribute('href')); if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#day-"]');
      if (a && dayGoTo && dayGoTo(a.getAttribute('href').slice(1))) e.preventDefault();
    });
    Array.prototype.forEach.call(document.querySelectorAll('a[href="#together"], a[href="/#together"]'), function (a) { a.setAttribute('href', '#features'); });
  }


  /* ---------- Phones (experience): three beats down the page, the rest under "More you can do" ---------- */
  function initDayMobile() {
    var day = document.getElementById('day');
    if (!day || day.classList.contains('day-3d')) return;
    var line = day.querySelector('.day-line'); if (!line) return;
    day.classList.add('day-beats');
    var keep = ['day-morning', 'day-late', 'day-talk'];
    var more = document.createElement('details'); more.className = 'day-more';
    more.innerHTML = '<summary>More you can do <span>gifts, their order, flowers, countdowns</span></summary>';
    var list = document.createElement('ol'); list.className = 'day-more-list'; more.appendChild(list);
    Array.prototype.slice.call(line.children).forEach(function (li) { if (keep.indexOf(li.id) < 0) list.appendChild(li); });
    line.insertAdjacentElement('afterend', more);
    more.addEventListener('toggle', function () { if (more.open) Lofi.swoosh(); });
    var lastSnap = -1;
    list.addEventListener('scroll', function () {
      var i = Math.round(list.scrollLeft / Math.max(1, list.clientWidth * 0.84));
      if (i !== lastSnap) { if (lastSnap !== -1) Lofi.swoosh(); lastSnap = i; }
    }, { passive: true });
  }

  /* ---------- Bento on phones: the three strongest cards, then "More" ---------- */
  function initBentoMore() {
    var bento = document.querySelector('.bento'); if (!bento || bento.querySelector('.bento-more')) return;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'bento-more';
    btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'More you can do';
    bento.classList.add('collapsed'); bento.appendChild(btn);
    btn.addEventListener('click', function () {
      var open = bento.classList.toggle('collapsed') === false;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.textContent = open ? 'Show less' : 'More you can do';
      Lofi.swoosh();
    });
  }

  /* ---------- Closing: share a hug with your partner (native share sheet, or copy) ---------- */
  function initShareHug() {
    var closing = document.querySelector('.closing'); if (!closing || closing.querySelector('.share-hug')) return;
    var STORE = 'https://apps.apple.com/app/id6831379597';
    var TEXT = 'Thinking of you between shifts. Want to try Twolight with me?';
    var wrap = document.createElement('div'); wrap.className = 'share-hug';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'hero-ghost';
    btn.innerHTML = 'Share a hug with your partner';
    var status = document.createElement('p'); status.className = 'share-status'; status.setAttribute('role', 'status');
    wrap.appendChild(btn); wrap.appendChild(status); closing.appendChild(wrap);
    btn.addEventListener('click', function () {
      Lofi.chime();
      if (navigator.share) {
        navigator.share({ text: TEXT, url: STORE }).catch(function () {});   // leaving the sheet is fine; no success claim
        return;
      }
      var all = TEXT + ' ' + STORE;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(all).then(function () { status.textContent = 'Message and link copied. Paste it to them.'; },
          function () { status.textContent = all; });
      } else status.textContent = all;
    });
  }

  /* ---------- First visit: show the page, then ask lightly (a small bar, not a wall) ---------- */
  function welcomeBar(mode, choose) {
    var bar = document.createElement('div'); bar.className = 'welcome-bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'How to look around');
    if (mode === 'experience') {
      bar.innerHTML = '<p>You’re in the full experience.</p><div><button type="button" data-a="simple">Keep it simple</button>' +
        '<button type="button" data-a="music">Play music</button><button type="button" data-a="ok" class="primary">Looks good</button></div>';
    } else {
      bar.innerHTML = '<p>Want the full experience? It has motion.</p><div><button type="button" data-a="experience">Try it</button>' +
        '<button type="button" data-a="ok" class="primary">Keep it simple</button></div>';
    }
    /* Right after the header in the page order, so keyboard users meet it first (it still shows at the bottom). */
    var main = document.getElementById('main');
    if (main) document.body.insertBefore(bar, main); else document.body.appendChild(bar);
    document.documentElement.classList.add('has-welcome');      // lifts the day path's stops bar clear of it
    bar.addEventListener('click', function (e) {
      var a = e.target.closest('button'); if (!a) return;
      var act = a.getAttribute('data-a');
      if (act === 'music') { Lofi.start(); choose('experience', true); }
      else if (act === 'ok') choose(mode, false);
      else choose(act, false);
      bar.remove();
      document.documentElement.classList.remove('has-welcome');
    });
  }

  /* ---------- Hero, experience mode: twilight horizon, the road at your feet, two phones and a hug ---------- */
  function initHeroScene() {
    var hero = document.querySelector('.hero');
    if (!hero || hero.querySelector('.hero-scene')) return;
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scene = document.createElement('div'); scene.className = 'hero-scene'; scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = '<div class="hs-stars"></div><div class="hs-skyclip"><div class="hs-glow"></div><div class="hs-sun"></div></div>' +
      '<canvas class="hs-sea"></canvas><div class="hs-horizon"></div>' +
      '<div class="hs-phones"><div class="hs-phone mine"><img src="/media/day-order.jpg" alt="" width="560" height="1217"><span class="who"><i></i>You</span></div>' +
      '<div class="hs-link"></div><span class="hs-hug"></span>' +
      '<div class="hs-phone theirs"><img src="/media/day-countdowns-dark.jpg" alt="" width="560" height="1217"><span class="who"><i></i>Alex</span></div>' +
      '</div>';
    hero.insertBefore(scene, hero.firstChild);

    /* The sea: perspective swells, the sun's glitter path, and two lights (you and Alex) on it. Half resolution. */
    function seaMeetUntil() { return typeof meetUntil === 'number' ? meetUntil : 0; }
    var sea = scene.querySelector('.hs-sea'), sg = sea.getContext('2d'), SW = 0, SH = 0, seaT = 0, seaP = 0, seaRaf = 0, seaLast = 0, seaMeet = 0;
    function seaSize() { SW = Math.round(sea.clientWidth * 0.5); SH = Math.round(sea.clientHeight * 0.5); sea.width = SW; sea.height = SH; }
    function seaDraw() {
      if (!SW || !SH) return;
      var g = sg, cx = SW / 2, rows = 46;
      g.clearRect(0, 0, SW, SH);
      var water = g.createLinearGradient(0, 0, 0, SH);
      water.addColorStop(0, '#3b2a45'); water.addColorStop(0.25, '#24192f'); water.addColorStop(0.75, '#16121d'); water.addColorStop(1, 'rgba(19,18,26,0)');
      g.fillStyle = water; g.fillRect(0, 0, SW, SH);
      g.globalCompositeOperation = 'lighter';
      for (var j = 1; j <= rows; j++) {
        var f = j / rows, y = SH * f * f * 0.95, thick = 0.6 + f * 2.2, drift = seaT * (8 + f * 30);
        /* swells: long faint dashes across the whole sea */
        g.fillStyle = 'rgba(255, 196, 160,' + (0.05 + 0.06 * (1 - f)).toFixed(3) + ')';
        var dash = 18 + f * 110, gap = dash * 1.6, off = (drift + j * 37) % (dash + gap);
        for (var x = -off; x < SW; x += dash + gap) g.fillRect(x, y, dash, thick * 0.6);
        /* glitter path under the sun: short bright flecks that shimmer */
        var half = 10 + f * SW * 0.16;
        for (var k = 0; k < 4 + f * 6; k++) {
          var seed = Math.sin(j * 12.9898 + k * 78.233) * 43758.5453, r = seed - Math.floor(seed);
          var fx = cx + (r * 2 - 1) * half + Math.sin(seaT * 1.3 + j + k) * 3 * f;
          var a = 0.25 + 0.55 * Math.max(0, Math.sin(seaT * 2.6 + j * 1.7 + k * 2.3));
          g.fillStyle = 'rgba(255, 214, 160,' + (a * (1 - f * 0.8) * 0.85).toFixed(3) + ')';
          g.fillRect(fx - (3 + f * 12) / 2, y, 3 + f * 12, thick * 0.7);
        }
      }
      /* You and Alex: start apart, walk the glitter path toward each other, meet near the horizon. */
      function light(x, y, rgb, rad) {
        var gr = g.createRadialGradient(x, y, 0, x, y, rad * 2.6);
        gr.addColorStop(0, 'rgba(' + rgb + ',0.95)'); gr.addColorStop(0.18, 'rgba(' + rgb + ',0.55)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 2.6, 0, Math.PI * 2); g.fill();
        var rf = g.createLinearGradient(0, y, 0, y + rad * 6); rf.addColorStop(0, 'rgba(' + rgb + ',0.4)'); rf.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = rf; g.fillRect(x - rad * 0.35, y + rad * 0.8, rad * 0.7, rad * 6);   // its reflection, fading
      }
      var target = Math.max(Math.min(1, seaP * 1.25), performance.now() < seaMeetUntil() ? 1 : 0);
      seaMeet += (target - seaMeet) * (still ? 1 : 0.12);
      var meet = seaMeet, yy = SH * (0.62 - 0.36 * meet), spread = SW * 0.2 * (1 - meet) + 6;
      light(cx - spread, yy + SH * 0.08 * (1 - meet), '240,150,120', 3 + (1 - meet) * 3);
      light(cx + spread, yy, '130,200,200', 3 + (1 - meet) * 2.5);
      g.globalCompositeOperation = 'source-over';
    }
    function seaLoop(ts) {
      seaRaf = requestAnimationFrame(seaLoop);
      if (ts - seaLast < 40) return;
      seaT += Math.min(0.1, (ts - seaLast) / 1000); seaLast = ts;
      var r = hero.getBoundingClientRect(); if (r.bottom < 0) return;     // off screen: rest
      seaDraw();
    }
    seaSize(); seaDraw();
    window.addEventListener('resize', function () { seaSize(); seaDraw(); });
    if (!still) seaRaf = requestAnimationFrame(seaLoop);

    /* The picker in the hero: your shifts and theirs, answer right under the buttons. The sample week folds away. */
    var copy = hero.querySelector('.hero-copy'), film = hero.querySelector('.film');
    var overlap = document.getElementById('overlap');
    if (overlap && copy) {
      var play = document.createElement('div'); play.className = 'hero-play';
      var q = document.createElement('p'); q.className = 'hero-play-q'; q.id = 'hero-play-q'; q.textContent = 'When are you both free?';
      play.appendChild(q); overlap.setAttribute('aria-labelledby', 'hero-play-q');
      var answer = overlap.querySelector('.answer'), strip = overlap.querySelector('.strip'), note = overlap.querySelector('.overlap-note');
      if (answer) overlap.insertBefore(answer, strip);
      var more = document.createElement('details'); more.className = 'ov-more';
      more.innerHTML = '<summary>See the sample week</summary>';
      if (strip) more.appendChild(strip); if (note) more.appendChild(note);
      overlap.appendChild(more);
      play.appendChild(overlap);
      copy.insertBefore(play, copy.querySelector('.hero-cta'));
    }
    var cta = copy && copy.querySelector('.hero-cta');
    if (cta) {
      var quiet = cta.querySelector('.quiet');
      if (quiet) { quiet.className = 'hero-ghost'; quiet.href = '#day'; quiet.innerHTML = 'Start the day <span aria-hidden="true">↓</span>'; }
      if (film && window.HTMLDialogElement) {
        var dlg = document.createElement('dialog'); dlg.className = 'film-dialog'; dlg.setAttribute('aria-label', 'The Twolight story');
        var close = document.createElement('button'); close.type = 'button'; close.className = 'close'; close.innerHTML = 'Close <span aria-hidden="true">✕</span>'; close.setAttribute('aria-label', 'Close the film');
        dlg.appendChild(close); dlg.appendChild(film); document.body.appendChild(dlg);
        var vid = film.querySelector('video');
        close.addEventListener('click', function () { dlg.close(); });
        /* Clicking the dark area around the film closes it too; Esc works natively. */
        dlg.addEventListener('click', function (e) {
          var r = dlg.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
        });
        dlg.addEventListener('close', function () { if (vid) vid.pause(); if (musicWas) Lofi.start(); });
        var musicWas = false;
        var watch = document.createElement('button'); watch.type = 'button'; watch.className = 'text-link hero-watch';
        watch.innerHTML = 'Watch the story <span aria-hidden="true">▸</span>';
        watch.addEventListener('click', function () {
          musicWas = Lofi.on; if (musicWas) Lofi.stop();
          dlg.showModal(); if (vid) { vid.muted = false; vid.play().catch(function () {}); }
        });
        var free = copy.querySelector('.hero-free');
        (free || cta).insertAdjacentElement('afterend', watch);
      }
    }
    /* Find an evening: the heart crosses between the phones, and your light and Alex's meet on the water. */
    var hug = scene.querySelector('.hs-hug'), meetUntil = 0;
    if (overlap) overlap.addEventListener('ovresult', function (e) {
      if (!e.detail.found) return;
      Lofi.chime();
      if (still) return;
      hug.classList.remove('go'); void hug.offsetWidth; hug.classList.add('go');
      meetUntil = performance.now() + 2200;
    });

    /* Scroll: fly down the road; you and Alex walk toward each other; the phones lift away; the sun sinks. */
    var sun = scene.querySelector('.hs-sun'), phones = scene.querySelector('.hs-phones'), raf = 0;
    function place(p) {
      seaP = p; if (still) seaDraw();
      sun.style.transform = 'translateY(' + (p * 120).toFixed(1) + 'px)';
      phones.style.transform = 'translateY(' + (-p * 260).toFixed(1) + 'px)';
      phones.style.opacity = Math.max(0, 1 - p * 1.6).toFixed(3);
    }
    var lastP = -1;
    function frame() {
      raf = 0; var h = hero.offsetHeight || 1, p = Math.min(1, Math.max(0, window.scrollY / h));
      if (p === lastP) return;            // past the hero: nothing to redraw
      lastP = p; place(p);
    }
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
    /* A returning visitor who chose music: it's "on" but waits for their first tap or key (browsers need one to play sound). */
    var musicPending = mode === 'experience' && musicSaved(), musicLabel = function () {};
    function musicButton() {
      if (document.querySelector('.music-btn')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'music-btn';
      /* Waiting for a click (scrolling doesn't count as permission to play sound): say what a click does. */
      function label() {
        b.textContent = Lofi.on ? 'Music on' : musicPending ? 'Play music' : 'Music off';
        b.setAttribute('aria-pressed', Lofi.on ? 'true' : 'false');
        b.classList.toggle('waiting', musicPending && !Lofi.on);
      }
      musicLabel = label;
      b.addEventListener('click', function () {
        if (Lofi.on) { Lofi.stop(); saveMusic('off'); } else { musicPending = false; Lofi.start(); saveMusic('on'); }
        setTimeout(label, 0);
      });
      label();
      var sw0 = document.querySelector('header nav .mode-switch');
      if (sw0) sw0.insertAdjacentElement('afterend', b); else document.body.appendChild(b);
    }

    function moveExtras() {
      var line = day.querySelector('.day-line');
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
          note.textContent = 'In the app, Alex gets it when they’re up. (Just a demo here.)';
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
      /* 3:30 PM: two of Alex's favorites; "walk in" and their usual lights up, as it would on your screen (Plus). Compact, so the card keeps its height. */
      var order = document.getElementById('day-order');
      if (order) {
        var oc = order.querySelector('.moment-copy');
        var o = document.createElement('div'); o.className = 'play order-play';
        o.innerHTML = '<p class="order-cap">Alex’s favorites <small>sample</small></p>' +
          '<ul class="order-list">' +
          '<li class="order-coffee"><b>Drinks &amp; coffee · Harbor Light</b><span>Oat milk latte, extra hot</span></li>' +
          '<li><b>Flowers</b><span>Tulips, any color</span></li></ul>' +
          '<button type="button" class="play-btn order-go">I’m at Harbor Light</button>';
        oc.appendChild(o);
        var go = o.querySelector('.order-go'), coffee = o.querySelector('.order-coffee');
        coffee.setAttribute('aria-live', 'polite');
        go.addEventListener('click', function () {
          coffee.classList.add('lit'); coffee.querySelector('b').textContent = 'You’re at Harbor Light · Alex’s usual';
          go.disabled = true; go.textContent = 'Pops up there · Plus';
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
          '<p class="play-note" role="status">Tap a few flowers.</p>' +
          '<p class="bq-real">A simple sketch. In the app, the flowers are real 3D&nbsp;models.</p>';
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
        wrapBtn.addEventListener('click', function () { svg.classList.add('wrapped'); wrapBtn.disabled = true; sendBtn.disabled = false; fnote.textContent = 'Wrapped. In the app, Alex unwraps it on their phone.'; });
        sendBtn.addEventListener('click', function () { svg.classList.add('sent'); sendBtn.disabled = true; fnote.textContent = 'That’s how it goes in the app. One bouquet a week is free.'; });
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
        function localDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
        whenIn.value = localDay(soon); whenIn.min = localDay(new Date());
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
      if (m === 'experience') { moveExtras(); initHeroScene(); initDay3D(); initDayMobile(); initRibbons(); wireExperienceLinks(); initBentoMore(); initShareHug(); musicButton(); }
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
      if (musicPending) {
        /* Start on the first click or key, not on pointerdown: iPhone Safari only unlocks sound on a full tap.
           A first click on the Music button itself is left to the button (it reads "Play music", so a click starts it). */
        var once = function (e) {
          window.removeEventListener('click', once, true); window.removeEventListener('keydown', once, true);
          if (!musicPending) return;
          if (e.target && e.target.closest && e.target.closest('.music-btn')) return;
          musicPending = false; Lofi.start(); setTimeout(musicLabel, 0);
        };
        window.addEventListener('click', once, true); window.addEventListener('keydown', once, true);
      }
      return;
    }

    /* First visit: show the page right away (the experience, or simple with Reduce Motion), then ask in a small bar. */
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var first = still ? 'simple' : 'experience';
    mode = first; apply(first);
    if (nav) { var lab = nav.querySelector('.mode-switch'); if (lab) lab.textContent = first === 'experience' ? 'Simple view' : 'The experience'; }
    welcomeBar(first, function (m, music) {
      save(m); saveMusic(music ? 'on' : 'off');
      if (m !== first) { window.location.reload(); return; }
      var mb = document.querySelector('.music-btn');
      if (mb) { mb.textContent = Lofi.on ? 'Music on' : 'Music off'; mb.setAttribute('aria-pressed', Lofi.on ? 'true' : 'false'); }
    });
  })();
})();

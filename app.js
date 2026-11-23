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
  (function () {
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
      m.dataset.base = 'translate3d(' + px(i).toFixed(1) + 'px, 0, ' + pz(i).toFixed(1) + 'px) rotateY(' + (-yaw(i) * 0.6).toFixed(2) + 'deg)';
    });

    /* HUD: the time of day, and stops to jump to. */
    var hud = document.createElement('div'); hud.className = 'day-hud';
    var clock = document.createElement('p'); clock.className = 'day-clock'; clock.setAttribute('aria-hidden', 'true');
    var stops = document.createElement('nav'); stops.className = 'day-stops'; stops.setAttribute('aria-label', 'Moments in the day');
    moments.forEach(function (m, i) {
      var time = (m.querySelector('.moment-time') || {}).textContent || String(i + 1);
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = time.replace(/ (AM|PM)$/, '');
      btn.setAttribute('aria-label', 'Go to ' + time);
      btn.addEventListener('click', function () {
        var top = runway.getBoundingClientRect().top + window.scrollY;
        var span = runway.offsetHeight - window.innerHeight;
        window.scrollTo({ top: top + span * (i / (N - 1)), behavior: 'smooth' });
      });
      stops.appendChild(btn);
    });
    var hint = document.createElement('p'); hint.className = 'day-hint'; hint.textContent = 'Scroll to travel through the day';
    hud.appendChild(clock); hud.appendChild(stops); stage.appendChild(hud); stage.appendChild(hint);

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
        m.style.transform = m.dataset.base + (d > 0 ? ' translate3d(' + (d * 260 * (i % 2 ? -1 : 1)).toFixed(1) + 'px, ' + (-d * 90).toFixed(1) + 'px, 0)' : '');
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
  })();
})();

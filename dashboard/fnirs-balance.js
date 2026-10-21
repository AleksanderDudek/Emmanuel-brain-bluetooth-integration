/*
 * Hemispheric balance trainer view for the fNIRS dashboard (fnirs.html).
 *
 * The server's BalanceTracker (brainlink/fnirs_balance.py) decides the
 * recommendation — train_left / train_right / focus — with smoothing,
 * hysteresis and a dwell time.  This file only renders it and serves tasks:
 * left-hemisphere tasks are verbal / arithmetic / sequential, right-hemisphere
 * tasks are spatial / imagery / holistic.  That split is a simplification of
 * prefrontal lateralisation, which is why the view carries a disclaimer.
 *
 * DOM is built with createElement/textContent only (no innerHTML).
 * The task bank is pure and exported for node tests (tests/test_fnirs_balance_js.py).
 */
(function (root) {
  'use strict';

  // ── Task bank ──────────────────────────────────────────────────────
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const WORDS = ['KOMPUTER', 'OKULARY', 'TRAMWAJ', 'KALENDARZ', 'PARASOL', 'CZEKOLADA', 'BIBLIOTEKA', 'TELEFON', 'POMARAŃCZA'];
  const INITIALS = 'ABDGKLMNPRSTWZ'.split('');
  const ROT_LETTERS = ['R', 'F', 'G', 'J', 'L', 'P'];  // no mirror symmetry
  const ANGLES = [45, 90, 135, 180, 225, 270, 315];

  const LEFT_TASKS = [
    () => { const a = rnd(12, 89), b = rnd(11, 79); return {kind: 'answer', prompt: `${a} + ${b} = ?`, answer: a + b}; },
    () => { const a = rnd(41, 99), b = rnd(11, a - 11); return {kind: 'answer', prompt: `${a} − ${b} = ?`, answer: a - b}; },
    () => { const a = rnd(3, 9), b = rnd(4, 12); return {kind: 'answer', prompt: `${a} × ${b} = ?`, answer: a * b}; },
    () => { const s = rnd(60, 120), k = pick([3, 4, 6, 7]); return {kind: 'answer', prompt: `${s} − ${k} − ${k} − ${k} = ?`, answer: s - 3 * k}; },
    () => ({kind: 'open', prompt: `Odejmuj w myślach po ${pick([3, 7, 9])}, zaczynając od ${rnd(100, 300)}.`, hint: 'Licz w swoim tempie, bez pośpiechu.'}),
    () => ({kind: 'open', prompt: `Wymień w myślach jak najwięcej słów na literę „${pick(INITIALS)}”.`, hint: 'Spróbuj przekroczyć 10 słów.'}),
    () => { const w = pick(WORDS); return {kind: 'reveal', prompt: `Przeliteruj od tyłu: ${w}`, answer: [...w].reverse().join('')}; },
    () => ({kind: 'open', prompt: 'Ułóż w myślach zdanie, w którym każde słowo zaczyna się na tę samą literę.', hint: 'Np. „Pies przyniósł piłkę pod płot”.'}),
  ];

  const RIGHT_TASKS = [
    () => ({kind: 'rotation', prompt: 'Obróć literę w wyobraźni do pionu. Jest normalna czy lustrzana?',
            letter: pick(ROT_LETTERS), angle: pick(ANGLES), mirrored: Math.random() < 0.5}),
    () => ({kind: 'open', prompt: 'Przejdź w wyobraźni przez swoje mieszkanie i policz wszystkie okna.', hint: 'Zobacz każde pomieszczenie — nie wyliczaj słowami.'}),
    () => ({kind: 'reveal', prompt: 'Sześcian pomalowany na czerwono pocięto na 27 równych kostek. Ile kostek ma pomalowane dokładnie 3 ściany?', answer: '8 — narożniki'}),
    () => ({kind: 'open', prompt: 'Odtwórz w myślach znaną melodię, np. „Sto lat”. Usłysz ją jak najwyraźniej, bez słów.', hint: 'Skup się na rytmie i wysokości dźwięków.'}),
    () => ({kind: 'open', prompt: 'Przypomnij sobie twarz bliskiej osoby: oczy, uśmiech, fryzurę.', hint: 'Obraz, nie opis.'}),
    () => ({kind: 'open', prompt: 'Wyobraź sobie zachód słońca nad morzem: kolory nieba, ruch fal, światło na wodzie.', hint: 'Pozwól obrazowi płynąć.'}),
    () => ({kind: 'open', prompt: 'Przejdź w myślach trasę z domu do najbliższego sklepu, widząc każdy zakręt.', hint: 'Zwróć uwagę, gdzie skręcasz w lewo, a gdzie w prawo.'}),
    () => ({kind: 'open', prompt: 'Wyobraź sobie kostkę do gry i obracaj ją powoli we wszystkich kierunkach.', hint: 'Śledź, gdzie wędruje szóstka.'}),
  ];

  const FOCUS = {
    prompt: 'Skieruj uwagę na punkt na środku czoła, tuż nad nasadą nosa.',
    steps: ['Oddychaj spokojnie i równo.',
            'Zauważaj wrażenia z tego miejsca: ciepło, mrowienie, pulsowanie, nacisk opaski.',
            'Gdy myśli odpłyną, łagodnie wróć do punktu.'],
  };

  let seq = 0;
  function makeTask(rec, avoidPrompt) {
    if (rec === 'focus') return {id: ++seq, rec, kind: 'focus', ...FOCUS};
    const bank = rec === 'train_left' ? LEFT_TASKS : RIGHT_TASKS;
    let t;
    for (let i = 0; i < 5; i++) {  // avoid showing the same prompt twice in a row
      t = pick(bank)();
      if (t.prompt !== avoidPrompt) break;
    }
    return {id: ++seq, rec, ...t};
  }

  function checkAnswer(task, value) {
    if (task.kind === 'answer') return Number.parseInt(String(value).trim(), 10) === task.answer;
    if (task.kind === 'rotation') return (value === 'mirror') === task.mirrored;
    return null;
  }

  // ── View ───────────────────────────────────────────────────────────
  const AUTO_NEXT_SEC = {open: 20, reveal: 25};
  const ZONE_TXT = {left_dominant: 'Przeważa lewa półkula', right_dominant: 'Przeważa prawa półkula', balanced: 'Równowaga'};
  const REC = {
    train_left: {kicker: 'Przeważa prawa półkula', title: 'Wzmocnij lewą półkulę', cls: 'left'},
    train_right: {kicker: 'Przeważa lewa półkula', title: 'Wzmocnij prawą półkulę', cls: 'right'},
    focus: {kicker: 'Równowaga', title: 'Skup się na punkcie na czole', cls: 'focus'},
  };
  const PAUSE_TXT = {
    waiting: 'Czekam na dane — trwa zbieranie linii bazowej.',
    warming_up: 'Stabilizowanie metryki asymetrii',
    motion: 'Wykryto ruch — siedź nieruchomo.',
    poor_signal: 'Brak kontaktu optod — sprawdź, czy opaska przylega do skóry.',
    off: 'Źródło wyłączone — wybierz symulator lub opaskę.',
    no_data: 'Brak nowych danych z opaski — sprawdź połączenie.',
  };
  const TREND_SEC = 90;

  const fmtDur = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  /** Tiny DOM builder: h('p', {class: 'x'}, 'text', child) — strings become text nodes. */
  function h(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'on') Object.entries(v).forEach(([ev, fn]) => n.addEventListener(ev, fn));
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : String(c));
    return n;
  }

  function create(deps) {
    const $ = id => document.getElementById(id);
    const el = {
      badge: $('balZoneBadge'), band: $('balBand'), marker: $('balMarker'), raw: $('balRaw'),
      value: $('balValue'), status: $('balStatus'), trend: $('balTrend'), announce: $('balAnnounce'),
      card: $('balTaskCard'), kicker: $('balTaskKicker'), title: $('balTaskTitle'),
      body: $('balTaskBody'), actions: $('balTaskActions'), timer: $('balTaskTimer'),
      stats: $('balStats'), low: $('balLow'), high: $('balHigh'), dwell: $('balDwell'), smooth: $('balSmooth'),
    };
    let active = false, task = null, lastRec, lastBal = null, cfgLoaded = false, recording = false;
    let taskElapsed = 0, lastTick = 0;       // seconds the task was visible and feedback live
    let pausedSig = '', streakText = '';
    let feedbackEl = null, answerEl = null, streakEl = null;
    const history = [];                       // {t, a}; a === null marks a gap in the trend

    function announce(text) { el.announce.textContent = text; }

    function newTask(rec) {
      task = rec ? makeTask(rec, task && task.prompt) : null;
      taskElapsed = 0;
      renderTask();
    }

    const btn = (label, act) => h('button', {class: 'btn', type: 'button', on: {click: () => onAction(act)}}, label);

    function renderTask() {
      feedbackEl = answerEl = streakEl = null;
      pausedSig = streakText = '';
      if (!task) return;
      const r = REC[task.rec];
      el.card.dataset.rec = r.cls;
      el.kicker.textContent = r.kicker;
      el.title.textContent = r.title;
      const kids = [];
      if (task.kind === 'focus') {
        streakEl = h('div', {class: 'muted'});
        kids.push(h('div', {class: 'focus-dot', 'aria-hidden': 'true'}), h('p', {class: 'task-prompt'}, task.prompt),
                  h('ul', {class: 'focus-steps'}, task.steps.map(s => h('li', null, s))), streakEl);
      } else {
        kids.push(h('p', {class: 'task-prompt' + (task.kind === 'answer' ? ' big' : '')}, task.prompt));
        if (task.kind === 'answer') {
          answerEl = h('input', {type: 'number', inputmode: 'numeric', 'aria-label': 'Twoja odpowiedź', placeholder: 'wynik',
                                 on: {keydown: e => { if (e.key === 'Enter') onAction('check'); }}});
          kids.push(h('div', {class: 'row'}, answerEl, btn('Sprawdź', 'check'), btn('Pokaż wynik', 'show')));
        } else if (task.kind === 'reveal') {
          kids.push(h('div', {class: 'row'}, btn('Pokaż odpowiedź', 'show')));
        } else if (task.kind === 'rotation') {
          const glyph = h('div', {class: 'rot-glyph', role: 'img', 'aria-label': 'Obrócona litera'}, task.letter);
          glyph.style.transform = `rotate(${task.angle}deg)${task.mirrored ? ' scaleX(-1)' : ''}`;
          kids.push(glyph, h('div', {class: 'row center'}, btn('Normalna', 'normal'), btn('Lustrzana', 'mirror')));
        } else if (task.hint) {
          kids.push(h('p', {class: 'muted'}, task.hint));
        }
        if (task.kind !== 'open') {
          feedbackEl = h('div', {class: 'task-feedback', role: 'status'});
          kids.push(feedbackEl);
        }
      }
      el.body.replaceChildren(...kids);
      el.actions.replaceChildren(...(task.kind === 'focus' ? [] : [btn('Następne zadanie →', 'next')]));
      if (active) announce(`${r.title}. ${task.prompt}`);
    }

    function feedback(ok, text) {
      if (!feedbackEl) return;
      feedbackEl.textContent = text;
      feedbackEl.className = 'task-feedback' + (ok === true ? ' ok' : ok === false ? ' bad' : '');
    }

    function nextLater(ms) {
      const id = task.id;
      setTimeout(() => { if (task && task.id === id) newTask(task.rec); }, ms);
    }

    function onAction(act) {
      if (!task) return;
      if (act === 'next') return newTask(task.rec);
      if (act === 'show') return feedback(null, `Odpowiedź: ${task.answer}`);
      if (act === 'check') {
        const ok = checkAnswer(task, answerEl ? answerEl.value : '');
        feedback(ok, ok ? 'Dobrze!' : 'Spróbuj jeszcze raz.');
        if (ok) nextLater(1200);
        return;
      }
      if (act === 'normal' || act === 'mirror') {
        const ok = checkAnswer(task, act);
        feedback(ok, ok ? 'Dobrze!' : `Nie — to była litera ${task.mirrored ? 'lustrzana' : 'normalna'}.`);
        nextLater(1500);
      }
    }

    function renderPaused(b) {
      const left = b.paused === 'warming_up' && b.warmup_left_sec != null ? Math.ceil(b.warmup_left_sec) : null;
      const sig = `${b.paused}|${left}`;
      if (sig === pausedSig) return;  // rebuild only on change (screen readers, focus)
      const first = !pausedSig.startsWith(`${b.paused}|`);
      pausedSig = sig;
      el.card.dataset.rec = 'paused';
      el.kicker.textContent = 'Wstrzymane';
      el.title.textContent = PAUSE_TXT[b.paused] || 'Czekam na dane';
      el.body.replaceChildren(...(left != null ? [h('p', {class: 'muted'}, `Jeszcze ok. ${left} s. Siedź spokojnie.`)] : []));
      el.actions.replaceChildren();
      if (first) announce(el.title.textContent);
    }

    function renderGauge(b) {
      const c = b.config;
      el.band.style.left = (c.low * 100) + '%';
      el.band.style.width = ((c.high - c.low) * 100) + '%';
      const a = b.asymmetry;
      el.marker.style.display = a == null ? 'none' : 'block';
      el.raw.style.display = b.raw == null ? 'none' : 'block';
      if (a != null) el.marker.style.left = (a * 100) + '%';
      if (b.raw != null) el.raw.style.left = (b.raw * 100) + '%';
      el.value.textContent = a == null ? '—' : a.toFixed(3);
      el.badge.textContent = b.paused ? 'wstrzymane' : (ZONE_TXT[b.zone] || '—');
      el.badge.className = 'badge zone-' + (b.paused ? 'paused' : (b.zone || 'none'));
      let s;
      if (b.paused) {
        s = PAUSE_TXT[b.paused] || '';
        if (b.paused === 'warming_up' && b.warmup_left_sec != null) s += ` (${Math.ceil(b.warmup_left_sec)} s)`;
        if (task) s += ' — zadanie czeka';
      } else {
        s = ZONE_TXT[b.zone] || '—';
        if (b.recommendation) s += ` · zalecenie od ${fmtDur(b.recommendation_sec)}`;
        if (b.pending) s += ` · zmiana na „${REC[b.pending.recommendation].title}” za ${Math.ceil(b.pending.in_sec)} s`;
      }
      el.status.textContent = s;
    }

    function renderStats(s) {
      const cell = (k, v, unit) => h('div', {class: 'stat'}, h('div', {class: 'k'}, k),
                                     h('div', {class: 'v'}, v, unit ? h('small', null, unit) : null));
      el.stats.replaceChildren(
        cell('W równowadze', s.balanced_pct == null ? '—' : Math.round(s.balanced_pct), s.balanced_pct == null ? '' : '%'),
        cell('Najdłuższa seria', fmtDur(s.best_streak_sec)),
        cell('Czas sesji', fmtDur(s.session_sec)),
        cell('Lewa przeważa', fmtDur(s.left_dominant_sec)),
        cell('Prawa przeważa', fmtDur(s.right_dominant_sec)),
        cell('Równowaga', fmtDur(s.balanced_sec)));
    }

    function renderTrend(c) {
      const cv = el.trend, dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
      if (!r.width) return;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, hh = r.height, top = 16, bot = 4, y = v => top + (hh - top - bot) * (1 - v);
      ctx.clearRect(0, 0, w, hh);
      ctx.fillStyle = 'rgba(0,229,160,0.12)';
      ctx.fillRect(0, y(c.high), w, y(c.low) - y(c.high));
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(0, y(0.5)); ctx.lineTo(w, y(0.5)); ctx.stroke();
      const now = Date.now(), span = TREND_SEC * 1000;
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--purple').trim();
      ctx.lineWidth = 1.6; ctx.beginPath();
      let pen = false;
      for (const p of history) {
        if (p.a == null) { pen = false; continue; }  // gap: lift the pen
        const x = w * (1 - (now - p.t) / span);
        if (pen) ctx.lineTo(x, y(p.a)); else ctx.moveTo(x, y(p.a));
        pen = true;
      }
      ctx.stroke();
    }

    function loadConfig(c) {
      el.low.value = c.low; el.high.value = c.high; el.dwell.value = c.dwell_sec; el.smooth.value = c.smoothing_sec;
      cfgLoaded = true;
    }

    async function saveConfig(body) {
      const st = await deps.api('/balance/config', 'PATCH', body);
      loadConfig(st.config);
      deps.toast('Zapisano ustawienia równowagi');
    }
    $('balSave').onclick = deps.run(() => saveConfig({
      low: +el.low.value, high: +el.high.value, dwell_sec: +el.dwell.value, smoothing_sec: +el.smooth.value}));
    $('balDefaults').onclick = deps.run(() => saveConfig({low: 0.47, high: 0.53, dwell_sec: 5, smoothing_sec: 4}));
    $('balReset').onclick = deps.run(async () => { await deps.api('/balance/reset', 'POST'); deps.toast('Statystyki sesji wyzerowane'); });

    /** Every frame: keep history and the recommendation/task in sync, even while hidden. */
    function ingest(b) {
      const now = Date.now();
      const last = history[history.length - 1];
      if (b.asymmetry != null) history.push({t: now, a: b.asymmetry});
      else if (last && last.a != null) history.push({t: now, a: null});
      while (history.length && now - history[0].t > TREND_SEC * 1000) history.shift();
      if (!cfgLoaded) loadConfig(b.config);
      if (b.recommendation !== lastRec) {
        // Markers record what the trainer showed, so only while the trainer tab is open
        if (active && recording && b.recommendation) deps.mark('balance:' + b.recommendation);
        lastRec = b.recommendation;
        newTask(b.recommendation);
      }
    }

    /** Only while the trainer tab is visible. */
    function render(b) {
      const now = Date.now();
      if (task && !b.paused && lastTick) taskElapsed += Math.min(1, (now - lastTick) / 1000);
      lastTick = now;
      renderGauge(b);
      if (b.stats) renderStats(b.stats);
      renderTrend(b.config);
      if (!task) renderPaused(b);
      const lim = task && AUTO_NEXT_SEC[task.kind];
      if (lim && taskElapsed > lim) newTask(task.rec);
      el.timer.style.width = lim ? Math.min(100, 100 * taskElapsed / lim) + '%' : '0%';
      if (streakEl) {
        const txt = `W równowadze od ${fmtDur(b.streak_sec)} · najdłużej ${fmtDur(b.stats.best_streak_sec)}`;
        if (txt !== streakText) { streakEl.textContent = txt; streakText = txt; }
      }
    }

    function update(f) {
      recording = !!(f.recording && f.recording.recording);
      let b = f.balance;
      if (!b && f.source === 'off' && lastBal) b = {...lastBal, paused: 'off', asymmetry: null, raw: null, zone: null, recommendation: null, pending: null};
      if (!b || !b.config) return;
      lastBal = b;
      ingest(b);
      if (active) render(b);
    }

    function setActive(on) {
      active = on;
      lastTick = 0;  // time spent hidden does not count toward the task timer
      if (on && lastBal) {
        renderTask();
        render(lastBal);
      }
    }

    return {update, setActive};
  }

  const exported = {BalanceTasks: {LEFT_TASKS, RIGHT_TASKS, FOCUS, makeTask, checkAnswer}, BalanceView: {create}};
  Object.assign(root, exported);
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
})(typeof window !== 'undefined' ? window : globalThis);

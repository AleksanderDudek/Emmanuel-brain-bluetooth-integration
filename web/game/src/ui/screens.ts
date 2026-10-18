/** All DOM screens of HolyHolyHoly except the prayer screen (see prayer.ts). */
import { bluetoothStatus, detectBrowser, detectPlatform, explainBleError, guidance } from '../../../src/ble/platform';
import { checkAnswer, makeTask, type Task } from '../../../src/ui/tasks';
import { SUPPORT_URL } from '../config';
import { CHAPTERS, FRUITS, POWERS, PRAYERS, RANKS, REVELATIONS, SKINS, SOUNDSCAPES, STORY, TRAUMAS } from '../content';
import type { NeuroBridge } from '../neuro/bridge';
import { applyUpdate, updateReady } from '../pwa';
import {
  backupSave, buyFruit, SAVE_KEY, codexUnlocked, exportSave, importSave, prayed, rankIndex, realmUnlocked, skinOwned, soundscapeOwned, type SaveData,
} from '../save';
import type { Offer, Run } from '../sim/run';
import type { Recommendation } from '../../../src/core/types';
import type { AudioApi, ChapterDef, PowerId, PrayerDef, RealmId, Revelation, SkinDef, SoundscapeDef, Verse } from '../types';
import { btn, h, paragraphs, screen, topBar, verseEl } from './common';
import { toast } from '../../../src/ui/dom';

export interface ScreenApi {
  save: SaveData;
  persist(): void;
  audio: AudioApi;
  neuro: NeuroBridge;
  map(): void;
  startChapter(ch: ChapterDef): void;
  openPrayer(p: PrayerDef, back: () => void): void;
  show(el: HTMLElement, modal?: boolean): void;
  applySettings(): void;
  restartGame(): void;
}

const chapterById = (id: RealmId) => CHAPTERS.find(c => c.id === id);

// ─── title & first launch ─────────────────────────────────────────

export function titleScreen(onStart: () => void, onHelp: () => void): HTMLElement {
  return screen('title',
    h('div', { class: 'halo-mark', 'aria-hidden': 'true' }),
    h('h1', { class: 'logo' }, 'Holy', h('span', null, 'Holy'), 'Holy'),
    verseEl(STORY.titleVerse, 'verse title-verse'),
    btn('Rozpocznij', onStart, 'btn gold big', { 'data-autofocus': '' }),
    btn('Pomoc i bezpieczeństwo', onHelp, 'btn ghost small'));
}

export function disclaimerScreen(onOk: () => void): HTMLElement {
  return screen('notice',
    h('h2', null, 'Zanim zaczniesz'),
    ...paragraphs(STORY.disclaimer),
    h('div', { class: 'help-box' }, h('h3', null, 'Gdy jest naprawdę ciężko'), ...paragraphs(STORY.crisisHelp)),
    btn('Rozumiem', onOk, 'btn gold big'));
}

export function storyScreen(pages: string[], title: string, onDone: () => void): HTMLElement {
  let i = 0;
  const body = h('div', { class: 'story-page' });
  const next = btn('Dalej', () => step(), 'btn gold big');
  const step = () => {
    if (i >= pages.length) return onDone();
    body.replaceChildren(h('p', null, pages[i]));
    i++;
    next.textContent = i >= pages.length ? 'Ruszam w drogę' : 'Dalej';
  };
  step();
  return screen('story', h('h2', null, title), body, next, btn('Pomiń', onDone, 'btn ghost small'));
}

// ─── the Tree ──────────────────────────────────────────────────────

const NODE_POS: Record<RealmId, [number, number]> = {
  keter: [50, 5], chochma: [82, 16], bina: [18, 16], chesed: [82, 35], gewura: [18, 35], tiferet: [50, 46],
  necach: [82, 60], hod: [18, 60], jesod: [50, 72], malkut: [50, 85], rod: [10, 78], szeol: [50, 97],
};
const PATHS: [RealmId, RealmId][] = [
  ['keter', 'chochma'], ['keter', 'bina'], ['keter', 'tiferet'], ['chochma', 'bina'], ['chochma', 'chesed'], ['bina', 'gewura'],
  ['chesed', 'gewura'], ['chesed', 'tiferet'], ['gewura', 'tiferet'], ['chesed', 'necach'], ['gewura', 'hod'], ['tiferet', 'necach'],
  ['tiferet', 'hod'], ['tiferet', 'jesod'], ['necach', 'hod'], ['necach', 'jesod'], ['hod', 'jesod'], ['jesod', 'malkut'],
  ['necach', 'malkut'], ['hod', 'malkut'], ['chochma', 'tiferet'], ['bina', 'tiferet'],
];

export function mapScreen(api: ScreenApi, nav: Record<string, () => void>): HTMLElement {
  const s = api.save;
  const rank = RANKS[rankIndex(s, RANKS)];
  const next = RANKS[rankIndex(s, RANKS) + 1];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'tree-lines');
  svg.setAttribute('aria-hidden', 'true');
  const line = (a: RealmId, b: RealmId, dashed = false) => {
    const [x1, y1] = NODE_POS[a], [x2, y2] = NODE_POS[b];
    const l = document.createElementNS(svgNS, 'line');
    l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1));
    l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
    const lit = s.cleared[a] && s.cleared[b];
    l.setAttribute('class', `${lit ? 'lit' : ''} ${dashed ? 'dashed' : ''}`);
    svg.append(l);
  };
  PATHS.forEach(([a, b]) => line(a, b));
  line('jesod', 'rod', true);
  line('malkut', 'szeol', true);

  const nodes = CHAPTERS.map(ch => {
    const open = realmUnlocked(s, ch, CHAPTERS);
    const done = !!s.cleared[ch.id];
    const [x, y] = NODE_POS[ch.id];
    const node = h('button', {
      class: `node ${open ? 'open' : 'locked'} ${done ? 'done' : ''} ${ch.realm}`, type: 'button',
      'aria-label': `${ch.sphere.name} — ${ch.title}${done ? ', ukończone' : open ? '' : ', zamknięte'}`,
      on: {
        click: () => {
          if (open) return api.show(chapterIntroScreen(api, ch));
          const by = ch.unlockedBy && PRAYERS.find(p => p.id === ch.unlockedBy);
          toast(by ? `Otwiera modlitwa: „${by.title}”` : 'Najpierw przejdź niższą sferę');
        },
      },
    }, h('span', { class: 'orb' }), h('span', { class: 'label' }, h('b', null, ch.sphere.name), h('small', null, ch.title)));
    // CSSOM, not a style attribute: the CSP forbids inline style attributes
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.style.setProperty('--accent', ch.palette.accent);
    return node;
  });

  const navBtn = (label: string, key: string) => btn(label, nav[key], 'btn nav');
  return screen('map',
    h('header', { class: 'map-head' },
      h('div', null, h('h2', null, rank.name), h('small', null, next ? `do rangi „${next.name}”: ${Math.max(0, next.light - Math.floor(s.light))} ✦` : 'Najwyższy chór — Święty, Święty, Święty')),
      h('div', { class: 'wallet' }, h('span', null, `✦ ${Math.floor(s.light)}`), h('span', null, `Manna ${s.manna}`))),
    updateReady() ? btn('Nowa wersja gry — odśwież', applyUpdate, 'btn gold small update') : null,
    h('div', { class: 'tree' }, svg, ...nodes),
    h('nav', { class: 'map-nav' },
      navBtn('Modlitwy', 'prayers'), navBtn('Owoce Ducha', 'fruits'), navBtn('Skarbiec', 'store'), navBtn('Księga Prawdy', 'codex'),
      navBtn('Opaska Mendi', 'band'), navBtn('Ustawienia', 'settings'), navBtn('Pomoc', 'help'), navBtn('Wesprzyj', 'support')));
}

export function chapterIntroScreen(api: ScreenApi, ch: ChapterDef): HTMLElement {
  const done = api.save.cleared[ch.id];
  return screen('chapter',
    btn('← Drzewo', () => api.map(), 'btn ghost back'),
    h('p', { class: 'sphere' }, `${ch.sphere.name} · ${ch.sphere.meaning}`),
    h('h1', null, ch.title),
    ...paragraphs(ch.story),
    h('p', { class: 'lie-intro' }, 'Kłamstwo tej sfery: ', h('q', null, ch.boss.lie)),
    verseEl(ch.verse),
    h('p', { class: 'muted' }, `Cienie: ${ch.traumas.map(k => TRAUMAS[k].name).join(', ')}`),
    done ? h('p', { class: 'muted' }, `Ukończono ${done.times}× · fragmenty: ${done.fragments}`) : null,
    btn(done ? 'Wejdź ponownie' : 'Wejdź', () => api.startChapter(ch), 'btn gold big', { 'data-autofocus': '' }));
}

// ─── during a run ──────────────────────────────────────────────────

export function levelUpScreen(run: Run, offers: Offer[], onPick: (o: Offer) => void): HTMLElement {
  // a double tap or a held Enter must not pick a card on the next offer too
  const shownAt = performance.now();
  let picked = false;
  const pick = (o: Offer) => {
    if (picked || performance.now() - shownAt < 350) return;
    picked = true;
    onPick(o);
  };
  const card = (o: Offer) => {
    if (o === 'heal') {
      return h('button', { class: 'card', type: 'button', on: { click: () => pick(o) } },
        h('h3', null, 'Odpocznij'), h('p', null, 'Odzyskaj 2 serca.'), h('cite', null, 'Mt 11,28'));
    }
    const def = POWERS[o as PowerId];
    const lvl = run.giftLevel(o as PowerId);
    return h('button', { class: `card ${lvl ? 'owned' : 'new'}`, type: 'button', on: { click: () => pick(o) } },
      h('small', null, lvl ? `Poziom ${lvl + 1}/${def.maxLevel}` : 'Nowy dar'),
      h('h3', null, def.name),
      h('p', null, def.levels[Math.min(lvl, def.levels.length - 1)]),
      h('p', { class: 'desc' }, def.description),
      h('cite', null, def.verse.ref));
  };
  return screen('levelup', h('h2', null, `Poziom ${run.level}`), h('p', { class: 'muted' }, 'Wybierz dar'),
    h('div', { class: 'cards' }, offers.map(card)));
}

const REC_LABEL: Record<Recommendation, string> = {
  train_left: 'Przeważa prawa półkula — zadanie dla lewej',
  train_right: 'Przeważa lewa półkula — zadanie dla prawej',
  focus: 'Równowaga — skup się na czole',
};

/** The chapel: a short focus task, chosen by the band's balance recommendation (or at random). */
export function chapelScreen(rec: Recommendation | null, bandUsed: boolean, onResult: (ok: boolean) => void): HTMLElement {
  const recommendation: Recommendation = rec ?? (['train_left', 'train_right', 'focus'] as const)[Math.floor(Math.random() * 3)];
  const task: Task = makeTask(recommendation);
  const feedback = h('p', { class: 'status', role: 'status' });
  const body = h('div', { class: 'task' });
  // exactly one result: the first answer, the end of the timer or "Pomiń" settles it
  let settled = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const settle = (ok: boolean, delay: number) => {
    if (settled) return;
    settled = true;
    clearInterval(timer);
    body.querySelectorAll('button, input').forEach(c => { (c as HTMLButtonElement | HTMLInputElement).disabled = true; });
    skip.disabled = true;
    setTimeout(() => onResult(ok), delay);
  };
  const finish = (ok: boolean) => settle(ok, 900);
  const skip = btn('Pomiń', () => settle(false, 0), 'btn ghost small');
  if (task.kind === 'answer') {
    const input = h('input', { type: 'number', inputmode: 'numeric', 'aria-label': 'Odpowiedź', placeholder: 'wynik' });
    const check = () => {
      if (settled) return;
      const ok = checkAnswer(task, input.value) === true;
      feedback.textContent = ok ? 'Dobrze! Błogosławieństwo przyjęte.' : 'Spróbuj jeszcze raz.';
      if (ok) finish(true);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    body.append(h('p', { class: 'big' }, task.prompt), h('div', { class: 'row center' }, input, btn('Sprawdź', check, 'btn gold')));
  } else if (task.kind === 'rotation') {
    const glyph = h('div', { class: 'glyph', role: 'img', 'aria-label': 'Obrócona litera' }, task.letter ?? '');
    glyph.style.transform = `rotate(${task.angle}deg)${task.mirrored ? ' scaleX(-1)' : ''}`;
    const answer = (v: string) => {
      const ok = checkAnswer(task, v) === true;
      feedback.textContent = ok ? 'Dobrze! Błogosławieństwo przyjęte.' : 'Tym razem nie — ale to też modlitwa uwagi.';
      finish(ok);
    };
    body.append(h('p', null, task.prompt), glyph, h('div', { class: 'row center' }, btn('Normalna', () => answer('normal'), 'btn'), btn('Lustrzana', () => answer('mirror'), 'btn')));
  } else {
    // open tasks and the forehead focus: a short, timed contemplation
    const secs = task.kind === 'focus' ? 20 : 15;
    const bar = h('div', { class: 'bar' }, h('div'));
    let t = 0;
    timer = setInterval(() => {
      t += 0.25;
      (bar.firstElementChild as HTMLElement).style.width = `${Math.min(100, (t / secs) * 100)}%`;
      if (t >= secs) {
        clearInterval(timer);
        feedback.textContent = 'Amen. Błogosławieństwo przyjęte.';
        finish(true);
      }
    }, 250);
    const parts: (Node | null)[] = [task.kind === 'focus' ? h('div', { class: 'focus-dot', 'aria-hidden': 'true' }) : null,
      h('p', { class: 'big-text' }, task.prompt), task.hint ? h('p', { class: 'muted' }, task.hint) : null,
      ...(task.steps ?? []).map(st => h('p', { class: 'muted' }, st)), bar];
    body.append(...parts.filter((x): x is Node => x !== null));
  }
  return screen('chapel', h('p', { class: 'sphere' }, 'Kaplica'), h('h2', null, REC_LABEL[recommendation]),
    h('p', { class: 'muted small' }, bandUsed ? 'Zadanie dobrane do równowagi twoich półkul (opaska).' : 'Krótka modlitwa uwagi.'),
    body, feedback, skip);
}

export function pauseScreen(api: ScreenApi, onResume: () => void, onQuit: () => void, onSettings: () => void): HTMLElement {
  return screen('pause', h('h2', null, 'Chwila ciszy'), h('p', { class: 'muted' }, '„Zatrzymajcie się i poznajcie, że Ja jestem Bogiem” (Ps 46,11)'),
    btn('Wróć do gry', onResume, 'btn gold big', { 'data-autofocus': '' }), musicControls(api), btn('Ustawienia', onSettings, 'btn'), btn('Wróć do Drzewa', onQuit, 'btn ghost'));
}

/** Music at hand: what plays, volume, next track, style. */
export function musicControls(api: ScreenApi): HTMLElement {
  const s = api.save;
  const now = h('p', { class: 'now', 'aria-live': 'polite' }, api.audio.nowPlaying);
  const refresh = () => {
    now.textContent = s.settings.musicMuted ? 'Muzyka wyłączona' : api.audio.nowPlaying;
    syncMute();
  };
  const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(s.settings.music), 'aria-label': 'Głośność muzyki' });
  const mute = btn('', () => {
    s.settings.musicMuted = !s.settings.musicMuted;
    api.applySettings();
    api.persist();
    refresh();
  }, 'btn small');
  const syncMute = () => { mute.textContent = s.settings.musicMuted ? '♪ Włącz muzykę' : '♪ Wycisz muzykę'; };
  volume.addEventListener('input', () => { s.settings.music = Number(volume.value); s.settings.musicMuted = false; api.applySettings(); refresh(); });
  volume.addEventListener('change', () => api.persist());
  const next = btn('⏭ Następny utwór', () => { api.audio.nextTrack(); refresh(); }, 'btn small');
  const styles = h('div', { class: 'styles', role: 'group', 'aria-label': 'Styl muzyki' }, SOUNDSCAPES.filter(sc => soundscapeOwned(s, sc)).map(sc =>
    btn(sc.name, () => {
      s.soundscape = sc.id;
      api.persist();
      api.audio.setSoundscape(sc.id);
      styles.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === sc.id)));
      refresh();
    }, 'btn small', { 'data-id': sc.id, 'aria-pressed': String(s.soundscape === sc.id) })));
  refresh();
  return h('section', { class: 'music' }, h('h3', null, 'Muzyka'), now,
    h('label', { class: 'field' }, h('span', null, 'Głośność'), volume), h('div', { class: 'row center' }, mute, next), styles);
}

export function fallScreen(text: string, onRise: () => void, boss = false): HTMLElement {
  return screen('fall', h('h2', null, 'Upadek'), h('p', { class: 'big-text' }, text),
    h('p', { class: 'muted' }, boss ? 'Każde powstanie przynosi łaskę: płomień Ognia i twierdzę, która już się chwieje.' : 'Każde powstanie przynosi łaskę: płomień Ognia na nową próbę.'),
    btn('Powstań', onRise, 'btn gold big', { 'data-autofocus': '' }));
}

export function whisperScreen(v: Verse, onDone: () => void, title = 'Szept z Tronu'): HTMLElement {
  const el = screen('whisper', h('p', { class: 'muted small' }, title), verseEl(v, 'verse big'));
  el.addEventListener('click', onDone);
  return el;
}

export function revelationScreen(rev: Revelation, onNext: () => void): HTMLElement {
  return screen('revelation',
    h('p', { class: 'sphere' }, 'Objawienie'),
    h('p', { class: 'lie' }, h('s', null, rev.lie)),
    h('h2', null, 'Prawda'),
    ...paragraphs(rev.truth),
    rev.verses[0] ? verseEl(rev.verses[0]) : null,
    btn('Przyjmuję', onNext, 'btn gold big', { 'data-autofocus': '' }));
}

export interface ReportData {
  run: Run;
  chapter: ChapterDef;
  manna: number;
  promoted: string | null;
  /** the longest held focus in this chapter, s, and the multiplier it reached */
  focus: { streak: number; mult: number };
}

export function reportScreen(r: ReportData, onNext: () => void): HTMLElement {
  const st = r.run.stats;
  const digested = Object.entries(st.digested) as [keyof typeof TRAUMAS, number][];
  return screen('report',
    h('p', { class: 'sphere' }, 'Raport dla Tronu'),
    h('h2', null, r.chapter.title),
    h('p', { class: 'big-text' }, r.chapter.report),
    h('ul', { class: 'truths' }, digested.map(([k, n]) => h('li', null, h('s', null, TRAUMAS[k].name), ' → ', h('b', null, TRAUMAS[k].truth.word), n > 1 ? ` ×${n}` : ''))),
    h('div', { class: 'stats-grid' },
      h('div', null, h('b', null, String(Object.values(st.digested).reduce((a, b) => a + (b ?? 0), 0))), h('small', null, 'cieni strawionych')),
      h('div', null, h('b', null, `${st.fragments}/${st.fragmentsTotal}`), h('small', null, 'fragmentów duszy')),
      h('div', null, h('b', null, `✦ ${Math.floor(r.run.light)}`), h('small', null, 'światła')),
      h('div', null, h('b', null, `+${r.manna}`), h('small', null, 'manny'))),
    r.focus.streak >= 5 ? h('p', { class: 'muted' }, `Najdłuższe czuwanie: ${Math.round(r.focus.streak)} s (×${String(r.focus.mult).replace('.', ',')}).`) : null,
    st.falls ? h('p', { class: 'muted' }, `Upadłeś ${st.falls} ${st.falls === 1 ? 'raz' : 'razy'} i ${st.falls === 1 ? 'raz' : st.falls + ' razy'} powstałeś (Mi 7,8).`) : h('p', { class: 'muted' }, 'Bez upadku. Chwała Bogu.'),
    r.promoted ? h('p', { class: 'promo' }, `Nowa ranga: ${r.promoted}`) : null,
    btn('Raport przyjęty', onNext, 'btn gold big', { 'data-autofocus': '' }));
}

// ─── menus ─────────────────────────────────────────────────────────

export function prayersScreen(api: ScreenApi): HTMLElement {
  const back = () => api.show(prayersScreen(api));
  return screen('menu prayers', topBar('Modlitwy', api.map),
    h('p', { class: 'muted' }, 'Modlitwa serca: jedno krótkie wezwanie powtarzane w skupieniu, aż lampa się napełni. Otwiera ścieżki, dary i wygląd anioła — łaski się nie kupuje.'),
    h('div', { class: 'list' }, PRAYERS.map(p => {
      const done = prayed(api.save, p.id);
      return h('button', { class: `item ${done ? 'done' : ''}`, type: 'button', on: { click: () => api.openPrayer(p, back) } },
        h('h3', null, `${done ? '✓ ' : ''}${p.title}`), h('p', { class: 'invocation-small' }, p.invocation), h('small', null, p.unlockText));
    })));
}

export function fruitsScreen(api: ScreenApi): HTMLElement {
  const s = api.save;
  const render = () => api.show(fruitsScreen(api));
  return screen('menu fruits', topBar('Owoce Ducha', api.map),
    h('p', { class: 'muted' }, `„Owocem zaś Ducha jest…” (Ga 5,22-23). Manna: ${s.manna}`),
    h('div', { class: 'list' }, FRUITS.map(f => {
      const lvl = s.fruits[f.id] ?? 0;
      const maxed = lvl >= f.maxLevel;
      const cost = f.costs[lvl];
      return h('div', { class: 'item' },
        h('h3', null, `${f.name} ${'●'.repeat(lvl)}${'○'.repeat(f.maxLevel - lvl)}`),
        h('p', null, f.effect), h('cite', null, f.verse.ref),
        maxed ? h('small', null, 'Pełny owoc') : btn(`Pielęgnuj — ${cost} manny`, () => {
          if (buyFruit(s, f.id, f.costs, f.maxLevel)) { api.persist(); api.audio.sfx('levelup'); render(); } else toast('Za mało manny — przejdź kolejny rozdział');
        }, 'btn gold', { disabled: s.manna < cost }));
    })));
}

function unlockText(item: { unlock: SkinDef['unlock'] | SoundscapeDef['unlock'] }): string {
  const u = item.unlock;
  if (u === 'default') return 'od początku';
  if (u.prayer) return `modlitwa: ${PRAYERS.find(p => p.id === u.prayer)?.title ?? u.prayer}`;
  if ('rank' in u && u.rank) return `ranga: ${RANKS.find(r => r.id === u.rank)?.name ?? u.rank}`;
  return `${u.light} ✦ światła`;
}

export function storeScreen(api: ScreenApi): HTMLElement {
  const s = api.save;
  const render = () => api.show(storeScreen(api));
  const slot = (title: string, kind: SkinDef['slot']) => h('section', null, h('h3', null, title), h('div', { class: 'swatches' }, SKINS.filter(k => k.slot === kind).map(k => {
    const owned = skinOwned(s, k, RANKS);
    const on = s.equipped[kind] === k.id;
    const el = h('button', {
      class: `swatch ${on ? 'on' : ''} ${owned ? '' : 'locked'}`, type: 'button', 'aria-pressed': String(on),
      on: { click: () => { if (!owned) return toast(`Otwiera: ${unlockText(k)}`); s.equipped[kind] = k.id; api.persist(); render(); } },
    }, h('span', { class: 'dot' }), h('b', null, k.name), h('small', null, owned ? k.description : `🔒 ${unlockText(k)}`));
    el.style.setProperty('--c1', k.colors[0]);
    el.style.setProperty('--c2', k.colors[1]);
    return el;
  })));
  return screen('menu store', topBar('Skarbiec', api.map),
    h('p', { class: 'muted' }, 'Wszystko tu zdobywa się modlitwą, światłem i rangą — nic nie jest na sprzedaż.'),
    slot('Aureola', 'halo'), slot('Szata', 'robe'), slot('Skrzydła', 'wings'),
    h('section', null, h('h3', null, 'Pejzaż dźwiękowy'), h('div', { class: 'swatches' }, SOUNDSCAPES.map(sc => {
      const owned = soundscapeOwned(s, sc);
      const on = s.soundscape === sc.id;
      return h('button', {
        class: `swatch sound ${on ? 'on' : ''} ${owned ? '' : 'locked'}`, type: 'button', 'aria-pressed': String(on),
        on: {
          click: () => {
            if (!owned) return toast(`Otwiera: ${unlockText(sc)}`);
            s.soundscape = sc.id; api.persist(); api.audio.setSoundscape(sc.id); render();
          },
        },
      }, h('b', null, sc.name), h('small', null, owned ? sc.description : `🔒 ${unlockText(sc)}`));
    }))),
    supportBox());
}

export function supportBox(): HTMLElement {
  return h('section', { class: 'support' }, h('h3', null, 'Wesprzyj tę służbę'), ...paragraphs(STORY.support),
    SUPPORT_URL ? h('a', { class: 'btn gold', href: SUPPORT_URL, target: '_blank', rel: 'noopener' }, 'Wesprzyj (dobrowolnie)')
      : h('p', { class: 'muted small' }, 'Możliwość wsparcia pojawi się wkrótce.'));
}

export function codexScreen(api: ScreenApi): HTMLElement {
  const s = api.save;
  const open = codexUnlocked(s, PRAYERS);
  const got = REVELATIONS.filter(r => s.codex.includes(r.id));
  return screen('menu codex', topBar('Księga Prawdy', api.map),
    open ? null : h('p', { class: 'muted' }, 'Pełną księgę otwiera modlitwa „Wyrzeczenie się kłamstw”. Każde objawienie zobaczysz też po swojej twierdzy.'),
    got.length ? h('div', { class: 'list' }, got.map(r => h('div', { class: 'item' },
      h('p', { class: 'lie' }, h('s', null, r.lie)),
      open ? h('div', null, ...paragraphs(r.truth), ...r.verses.map(v => verseEl(v, 'verse small'))) : h('p', { class: 'muted' }, '…'))))
      : h('p', { class: 'muted' }, 'Jeszcze żadnego. Pierwsze czeka w Malkut.'),
    h('p', { class: 'muted small' }, `${got.length} z ${REVELATIONS.length}`));
}

export function bandScreen(api: ScreenApi): HTMLElement {
  const n = api.neuro;
  const st = n.device.info;
  const status = h('p', { class: 'status', role: 'status' });
  // the connection outlives the screen: re-render only while this screen is still on show
  const render = () => { if (el.isConnected) api.show(bandScreen(api)); };
  const connect = () => {
    status.textContent = 'Łączenie…';
    n.connect().then(() => { toast('Opaska połączona — chwila ciszy na kalibrację'); render(); })
      .catch(e => {
        const info = explainBleError(e);
        if (!info.cancelled) status.textContent = info.message;
        if (info.showGuidance) void showGuidance(status);
      });
  };
  const ns = n.state;
  const el = screen('menu band', topBar('Opaska Mendi', api.map),
    h('p', null, 'Gra działa bez opaski. Z opaską fNIRS Mendi staje się też ćwiczeniem kory przedczołowej:'),
    h('ul', { class: 'plain' },
      h('li', null, h('b', null, 'Skupienie '), '(aktywacja kory) — ładuje Ogień Ducha, także gdy anioł się porusza; utrzymane daje mnożnik do ×3 (bez opaski: bezruch, do ×1,5).'),
      h('li', null, h('b', null, 'Równowaga półkul '), '— poszerza Aurę Pokoju; w Kaplicy dobiera zadanie.'),
      h('li', null, h('b', null, 'Wyciszenie '), '— pogłębia odpoczynek w Szabacie.'),
      h('li', null, h('b', null, 'Utrzymana równowaga '), '— przy twierdzy wywołuje Objawienie.'),
      h('li', null, h('b', null, 'Tętno '), '— aureola pulsuje w rytmie twojego serca.')),
    h('p', { class: 'muted small' }, 'Przy ruchu głowy lub słabym kontakcie wpływ opaski jest wstrzymany. Dane zostają w urządzeniu. To nie jest wyrób medyczny.'),
    st.connected
      ? h('div', { class: 'item' },
        h('p', null, `Połączona: ${st.device_name ?? 'Mendi'} · bateria ${st.battery ? st.battery.percent + '%' : '—'}`),
        h('p', null, ns.baselineReady ? `Sygnał: ${ns.reliable ? 'dobry' : 'czekam'} · tętno ${ns.heartRate ? Math.round(ns.heartRate) : '—'}` : `Kalibracja: ${Math.round(ns.baselineProgress * 100)}%`),
        btn('Rozłącz', () => { void n.disconnect().then(render); }, 'btn'))
      : btn('Połącz opaskę', connect, 'btn gold big'),
    status);
  return el;
}

async function showGuidance(target: HTMLElement): Promise<void> {
  const g = guidance(detectPlatform(), detectBrowser(), await bluetoothStatus());
  target.replaceChildren(h('b', null, g.title), h('ol', null, g.steps.map(s => h('li', null, s))),
    ...(g.link ? [h('a', { class: 'btn', href: g.link.href, ...(g.link.href.startsWith('http') ? { target: '_blank', rel: 'noopener' } : {}) }, g.link.label)] : []));
}

export function settingsScreen(api: ScreenApi, onBack: () => void): HTMLElement {
  const s = api.save.settings;
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
    const input = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: String(s[key]), 'aria-label': label });
    input.addEventListener('input', () => { s[key] = Number(input.value); api.applySettings(); });
    input.addEventListener('change', () => api.persist());
    return h('label', { class: 'field' }, h('span', null, label), input);
  };
  const toggle = (label: string, key: 'muted' | 'musicMuted' | 'reducedMotion' | 'voicePrayer') => {
    const input = h('input', { type: 'checkbox' });
    input.checked = s[key];
    input.addEventListener('change', () => { s[key] = input.checked; api.applySettings(); api.persist(); });
    return h('label', { class: 'field check' }, input, h('span', null, label));
  };
  const file = h('input', { type: 'file', accept: 'application/json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';   // the same file can be picked again
    if (!f) return;
    try {
      const data = importSave(await f.text());
      if (!confirm('Wczytać tę kopię? Obecny postęp zostanie zastąpiony (zostanie też zachowany awaryjnie w tej przeglądarce).')) return;
      backupSave();
      data.settings.voiceConsent = s.voiceConsent;   // consent to cloud speech belongs to this device, not to the file
      Object.assign(api.save, data);
      api.persist();
      toast('Przywrócono postęp');
      api.restartGame();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się wczytać pliku', true);
    }
  });
  const exportBtn = () => {
    const blob = new Blob([exportSave(api.save)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'holyholyholy-postep.json' });
    document.body.append(a);
    a.click();
    a.remove();
  };
  return screen('menu settings', h('header', { class: 'topbar' }, btn('← Wróć', onBack, 'btn ghost'), h('h2', null, 'Ustawienia')),
    slider('Głośność', 'master'), slider('Muzyka', 'music'), slider('Efekty', 'sfx'),
    toggle('Wycisz wszystko', 'muted'), toggle('Bez muzyki (tylko efekty)', 'musicMuted'), toggle('Ogranicz ruch (bez wstrząsów)', 'reducedMotion'),
    toggle('Modlitwa serca na głos (mikrofon, rozpoznawanie mowy)', 'voicePrayer'),
    h('section', null, h('h3', null, 'Postęp'),
      h('p', { class: 'muted small' }, 'Postęp jest zapisany tylko w tej przeglądarce. Zrób kopię zapasową, zanim wyczyścisz dane.'),
      h('div', { class: 'row' }, btn('Zapisz kopię', exportBtn, 'btn'), btn('Wczytaj kopię', () => file.click(), 'btn'), file),
      btn('Zacznij od nowa', () => {
        if (!confirm('Usunąć cały postęp (modlitwy, owoce, rangę)? Tego nie da się cofnąć.')) return;
        backupSave();
        localStorage.removeItem(SAVE_KEY);
        api.restartGame();
      }, 'btn ghost danger')));
}

export function helpScreen(onBack: () => void): HTMLElement {
  return screen('menu help', h('header', { class: 'topbar' }, btn('← Wróć', onBack, 'btn ghost'), h('h2', null, 'Pomoc')),
    h('section', null, h('h3', null, 'Jak grać'), h('ul', { class: 'plain' },
      h('li', null, 'Przeciągnij palcem w dowolnym miejscu, aby iść (klawiatura: WASD / strzałki).'),
      h('li', null, 'Puść — anioł staje i modli się: Słowo samo leci w najbliższy cień.'),
      h('li', null, 'Słowo osłabia cienie. Osłabiony cień zjedz — trawienie zamienia go w prawdę. W bezruchu trawisz dwa razy szybciej.'),
      h('li', null, 'Biały krzyż to Promień Łaski: przez chwilę wszystkie cienie słabną — zjadaj je seriami. Cienie zjedzone jeden po drugim dają serię i więcej światła.'),
      h('li', null, 'Straw wszystkie cienie, a drzwi się otworzą (Effatha!); resztki światła same przylecą.'),
      h('li', null, 'Skupienie ładuje Ogień Ducha (pasek „Skupienie” na dole). Utrzymane skupienie daje mnożnik ×1,5 / ×2 / ×3.'),
      h('li', null, 'Przycisk „Ogień” (spacja): jeden płomień to język ognia wokół anioła; trzy płomienie — „Przyjdź, Duchu!”.'),
      h('li', null, 'Modlitwa serca: krótkie wezwanie powtarzane w skupieniu, aż lampa się napełni. Bez czytania.'))),
    h('section', { class: 'help-box' }, h('h3', null, 'Bezpieczeństwo'), ...paragraphs(STORY.disclaimer), ...paragraphs(STORY.crisisHelp)));
}

export const findChapter = chapterById;

import { describe, expect, it } from 'vitest';
import { catalogProblems, LANGS, type Lang, type Msg } from '../src/i18n';
import { CATALOGS as SIGNAL } from '../src/i18n/signal';
import { CATALOGS as TRAINING, t } from '../src/i18n/training';
import { REASON_TEXT, WARNING_TEXT } from '../src/hub';
import { SCENES } from '../src/training/scene';
import { FEELINGS, feelingText, newMilestones, SCORE_LABELS, type TrainingResult } from '../src/training/score';
import { checkAnswer, FOCUS, LEFT_TASKS, makeTask, RIGHT_TASKS, TASK_LANGUAGES } from '../src/ui/tasks';

const texts = (m: Msg): string[] => (typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string'));
const all = (cats: Readonly<Record<Lang, Readonly<Record<string, Msg>>>>, l: Lang): [string, string][] =>
  Object.entries(cats[l]).flatMap(([k, m]) => texts(m).map(s => [k, s] as [string, string]));

describe('training and signal catalogs', () => {
  it('give every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(TRAINING)).toEqual([]);
    expect(catalogProblems(SIGNAL)).toEqual([]);
  });

  it('write numbers, percentages, quotation marks and dashes the way each language does', () => {
    for (const cats of [TRAINING, SIGNAL]) {
      for (const l of LANGS) {
        for (const [k, s] of all(cats, l)) {
          // 12 % in German and Swedish (a no-break space), 12% in Polish and English
          if (l === 'de' || l === 'sv') expect(s, `${l}.${k}`).not.toMatch(/[^ ]%/);
          else expect(s, `${l}.${k}`).not.toMatch(/\s%/);
          if (l === 'en') expect(s, `${l}.${k}`).not.toMatch(/[„”“]/);
          else expect(s, `${l}.${k}`).not.toMatch(/"/);
          if (l === 'de') expect(s, `${l}.${k}`).not.toMatch(/”/);
          if (l === 'sv') expect(s, `${l}.${k}`).not.toMatch(/[„“]/);
          // a spaced dash: — in Polish and English, – in German and Swedish
          expect(s, `${l}.${k}`).not.toMatch(l === 'de' || l === 'sv' ? / — / : / – /);
          expect(s, `${l}.${k}`).not.toMatch(/BrainLink|Frontosaurus|Synapster/);
        }
      }
    }
  });

  it('keep the shapes other screens cut texts at', () => {
    for (const l of LANGS) {
      // a game's HUD shows a warning up to its ";" (src/ui/focus.ts, src/arcade/runner.ts)
      for (const w of ['warn.weak_contact', 'warn.light_leak', 'warn.noisy'] as const) {
        expect(String(SIGNAL[l][w]).split(';'), `${l}.${w}`).toHaveLength(2);
      }
    }
    // the hub's records are complete and still Polish in the tests
    expect(REASON_TEXT.baseline).toBe('Zbieranie linii bazowej — siedź spokojnie');
    expect(Object.keys(WARNING_TEXT).sort()).toEqual(['light_leak', 'noisy', 'weak_contact']);
  });

  it('name scenes, score labels and milestones', () => {
    expect(Object.values(SCENES).map(s => s.name)).toEqual(['Wzgórza', 'Wydmy', 'Śnieżne szczyty', 'Kosmos']);
    expect(SCORE_LABELS.map(([, label]) => label)).toEqual(['Mistrzowska rutyna', 'Świetna forma', 'Solidna rutyna', 'Budujesz rozpęd', 'Dobry początek']);
    const day = (d: number): TrainingResult => ({
      id: String(d), kind: 'focus', tool: 'fnirs', source: 'simulator', device: 'Symulator', start_time: Date.now() / 1000 - d * 86400,
      end_time: 0, planned_sec: 300, played_sec: 300, breathwork_sec: 0, completed: true, mood: null, scene: 'hills', points: 50,
      control_sec: 10, activity_avg_pct: 5, activity_max_pct: 9, reliable_pct: 100, series: [],
    });
    expect(newMilestones([day(1), day(2)], day(0)).map(m => m.title)).toEqual(['Seria 3 dni']);
    expect(t('sum.streak', { n: 1 })).toBe('Seria 1 dzień');
    expect(t('sum.streak', { n: 4 })).toBe('Seria 4 dni');
    expect(t('mile.sessions', { n: 10 })).toBe('10 sesji');
  });
});

describe('feeling words', () => {
  it('are offered in the page language and shown in it later, whatever language they were saved in', () => {
    expect(FEELINGS.map(f => t(`feel.${f}`))).toContain('spokój');
    expect(feelingText('spokój')).toBe('spokój');
    expect(feelingText('calm')).toBe('spokój');
    expect(feelingText('Ruhe')).toBe('spokój');
    expect(feelingText('lugn')).toBe('spokój');
    expect(feelingText('stress')).toBe('stres');      // English and Swedish share it
    expect(feelingText('coś innego')).toBe('coś innego');
  });

  it('never use one word for two feelings', () => {
    const seen = new Map<string, string>();
    for (const l of LANGS) {
      for (const f of FEELINGS) {
        const w = String(TRAINING[l][`feel.${f}`]).toLowerCase();
        expect(seen.get(w) ?? f, `${l}: "${w}"`).toBe(f);
        seen.set(w, f);
      }
    }
  });
});

describe('the balance task bank', () => {
  it('has letters and words of its own for each language', () => {
    for (const l of LANGS) {
      const { initials, words } = TASK_LANGUAGES[l];
      expect(new Set(initials).size, l).toBe(initials.length);
      expect(initials.length, l).toBeGreaterThanOrEqual(12);
      expect(initials, l).toMatch(/^[A-Z]+$/);
      expect(initials, l).not.toMatch(/[QXY]/);
      expect(new Set(words).size, l).toBe(words.length);
      expect(words.length, l).toBeGreaterThanOrEqual(8);
      for (const w of words) {
        expect(w, l).toBe(w.toLocaleUpperCase(l));
        expect(w, l).toMatch(/^\p{Lu}{7,11}$/u);
      }
    }
    expect(TASK_LANGUAGES.en.words).not.toEqual(TASK_LANGUAGES.pl.words);
    // a word list is not a translation of the Polish one: few words are shared
    for (const l of ['en', 'de', 'sv'] as const) {
      expect(TASK_LANGUAGES[l].words.filter(w => TASK_LANGUAGES.pl.words.includes(w)).length, l).toBeLessThanOrEqual(1);
    }
  });

  it('gives each recommendation a task with a prompt, and checks answers', () => {
    for (let i = 0; i < 40; i++) {
      for (const rec of ['train_left', 'train_right', 'focus'] as const) {
        const task = makeTask(rec);
        expect(task.rec).toBe(rec);
        expect(task.prompt.length).toBeGreaterThan(5);
        expect(task.prompt).not.toMatch(/\{\w+\}/);
        if (task.kind === 'answer') expect(checkAnswer(task, String(task.answer))).toBe(true);
        if (task.kind === 'rotation') expect(checkAnswer(task, task.mirrored ? 'mirror' : 'normal')).toBe(true);
      }
    }
    expect(LEFT_TASKS.length + RIGHT_TASKS.length).toBe(16);
    expect(FOCUS.steps).toHaveLength(3);
    const spell = LEFT_TASKS.map(g => g()).find(x => x.kind === 'reveal')!;
    const word = spell.prompt.split(': ')[1];
    expect(TASK_LANGUAGES.pl.words).toContain(word);
    expect(spell.answer).toBe([...word].reverse().join(''));
  });
});

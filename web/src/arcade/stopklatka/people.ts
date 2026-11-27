/**
 * Stop-klatka's people (DESIGN.md §28), drawn in code in the series' gouache: the person who faces the player (a
 * half-figure seen from the front at the player's eye level, its age fitted to the group, its clothes to its role, its
 * face to its mood — calm, busy, a smirk, angry, shouting, cold, sad, tired, sorry, a smile), the player seen from
 * behind and aside when the camera steps out of the eyes (a figure of the group's age, gender-neutral), and the player's
 * own hands at the bottom of the view.
 *
 * Every look is stable for a story: skin, hair and clothes come from a hash of the story and the role, so the same
 * colleague looks the same in every beat.  Drawing is a few dozen paths a person, cheap enough every frame; the idle
 * life (a breath, a blink, a word's mouth) stops when the picture freezes.
 */
import type { Age, Mood, Person } from './story';
import { TAU, ellipse, fillRR, hash, hashStr, mix, poly, rgba, shade } from './paint';

export type AgeLook = 'child' | 'teen' | 'young' | 'adult' | 'mid' | 'senior' | 'elder';
export type Hair = 'short' | 'crop' | 'bob' | 'long' | 'bun' | 'curly' | 'pony' | 'bald';
export type Wear = 'hoodie' | 'tee' | 'sweater' | 'shirt' | 'blazer' | 'cardigan' | 'coat' | 'uniform' | 'whitecoat' | 'jacket';

export interface Look {
  age: AgeLook;
  skin: string;
  hair: string;
  style: Hair;
  wear: Wear;
  top: string;
  under: string;
  glasses: boolean;
}

const SKINS = ['#f3d3ba', '#e8bf9c', '#d6a27c', '#b47c58', '#8c5a3c', '#62402c'];
const HAIRS = ['#2b1e19', '#3f2a20', '#5e3d26', '#7b5131', '#a8763f', '#d6b06e', '#8e3f26'];
const TOPS = ['#5b7fb5', '#c0584a', '#7a9a64', '#e0a458', '#8a6fb0', '#3e4a5a', '#2f7f7a', '#b5636e', '#d08a3c', '#6d7f99'];

/** How old each role looks for a group (peers are the group's own age). */
export function ageOf(who: Person, group: Age, k: number): AgeLook {
  const own: Record<Age, AgeLook> = { teen: 'teen', young: 'young', adult: 'adult', mid: 'mid', senior: 'senior' };
  switch (who) {
    case 'child': return 'child';
    case 'teenager': return 'teen';
    case 'elder': return 'elder';
    case 'parent': return group === 'teen' ? 'mid' : group === 'young' ? 'senior' : 'elder';
    case 'teacher': return k < 0.5 ? 'adult' : 'mid';
    case 'boss': return group === 'senior' ? 'mid' : k < 0.4 ? 'adult' : 'mid';
    case 'doctor': return k < 0.5 ? 'adult' : 'mid';
    case 'clerk': case 'driver': case 'client': return k < 0.5 ? 'young' : k < 0.8 ? 'adult' : 'mid';
    case 'neighbour': return group === 'teen' || group === 'young' ? (k < 0.5 ? 'mid' : 'senior') : own[group];
    case 'stranger': return k < 0.3 ? 'young' : k < 0.6 ? 'adult' : k < 0.85 ? 'mid' : 'senior';
    default: return own[group];
  }
}

/** A role's clothes. */
function wearOf(who: Person, age: AgeLook, k: number): Wear {
  if (age === 'child') return 'tee';
  switch (who) {
    case 'teacher': return k < 0.5 ? 'cardigan' : 'shirt';
    case 'boss': return 'blazer';
    case 'colleague': return k < 0.5 ? 'shirt' : 'sweater';
    case 'client': case 'stranger': return k < 0.5 ? 'coat' : 'jacket';
    case 'clerk': return 'uniform';
    case 'doctor': return 'whitecoat';
    case 'driver': return 'jacket';
    case 'elder': return 'cardigan';
    case 'parent': case 'neighbour': return k < 0.5 ? 'sweater' : 'cardigan';
    default: return age === 'teen' ? (k < 0.7 ? 'hoodie' : 'tee') : k < 0.35 ? 'sweater' : k < 0.7 ? 'jacket' : 'tee';
  }
}

/** The stable look of a role in a story (`key`: the story's id and the figure's place; `sex` when the words name it). */
export function lookOf(who: Person, group: Age, key: string, sex?: 'f' | 'm'): Look {
  const h = hashStr(`${key}:${who}`);
  const r = (i: number): number => hash(h % 100003 + i * 17);
  const age = ageOf(who, group, r(1));
  const grey = age === 'elder' || (age === 'senior' && r(2) < 0.8) || (age === 'mid' && r(2) < 0.25);
  const hair = grey ? (age === 'elder' || r(3) < 0.4 ? '#e4e0da' : '#a9a49e') : HAIRS[Math.floor(r(3) * HAIRS.length)];
  const styles: Hair[] = sex === 'f'
    ? (age === 'elder' ? ['bob', 'bun', 'curly'] : age === 'child' ? ['bob', 'pony', 'long'] : ['bob', 'long', 'bun', 'pony', 'curly'])
    : sex === 'm'
      ? (age === 'elder' || age === 'senior' ? ['short', 'bald', 'crop'] : ['short', 'crop'])
      : age === 'child' ? ['short', 'bob', 'pony', 'curly']
        : age === 'elder' ? ['short', 'bald', 'bob', 'bun', 'crop']
          : ['short', 'crop', 'bob', 'long', 'bun', 'curly', 'pony'];
  const wear = wearOf(who, age, r(5));
  const top = wear === 'blazer' ? (r(6) < 0.5 ? '#2f3e55' : '#4a4a50') : wear === 'uniform' ? '#3f6f86' : wear === 'whitecoat' ? '#f4f3ef' : TOPS[Math.floor(r(6) * TOPS.length)];
  return {
    age,
    skin: SKINS[Math.floor(r(4) * SKINS.length)],
    hair,
    style: styles[Math.floor(r(7) * styles.length)],
    wear,
    top,
    under: wear === 'whitecoat' ? '#7aa6bc' : wear === 'blazer' ? '#eef0f2' : wear === 'cardigan' ? '#efe6d6' : shade(top, 0.25),
    glasses: who === 'teacher' ? r(8) < 0.6 : age === 'elder' ? r(8) < 0.75 : age === 'senior' ? r(8) < 0.5 : r(8) < 0.15,
  };
}

export interface PersonDraw {
  x: number;
  /** the head's centre */
  y: number;
  /** the head's radius (px) */
  R: number;
  look: Look;
  mood: Mood;
  /** seconds, for the idle life */
  t: number;
  frozen: boolean;
  speaking: boolean;
  /** the stable phase of this person's breath and blink */
  phase: number;
  /** canvas height (the body runs to the bottom) */
  bottom: number;
}

/** A soft darker edge so a shape reads on any background. */
const EDGE = 'rgba(42,28,22,0.32)';

/** Draw one person facing the player. */
export function drawPerson(ctx: CanvasRenderingContext2D, o: PersonDraw): void {
  const { R, look: L, mood } = o;
  if (!(R > 1)) return;
  const life = o.frozen ? 0 : 1;
  const breathe = life * Math.sin(o.t * 1.4 + o.phase) * R * 0.025;
  const slump = mood === 'tired' ? R * 0.12 : mood === 'sad' ? R * 0.06 : 0;
  const x = o.x, y = o.y + breathe + slump;
  const child = L.age === 'child', teen = L.age === 'teen', old = L.age === 'elder' || L.age === 'senior';
  const sh = R * (child ? 1.2 : teen ? 1.5 : old ? 1.6 : 1.72) * (mood === 'tired' ? 0.96 : 1);
  const top = y + R * 1.3, shY = y + R * 1.82;
  const bottom = Math.max(o.bottom, shY + R * 3);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // the back hair (behind the body and the head)
  backHair(ctx, x, y, R, L);
  // the body: shoulders and the torso to the bottom of the view
  const body = new Path2D();
  body.moveTo(x - R * 0.32, top);
  body.bezierCurveTo(x - sh * 0.62, top + R * 0.05, x - sh, shY - R * 0.2, x - sh * 1.02, shY + R * 0.45);
  body.lineTo(x - sh * 1.1, bottom);
  body.lineTo(x + sh * 1.1, bottom);
  body.lineTo(x + sh * 1.02, shY + R * 0.45);
  body.bezierCurveTo(x + sh, shY - R * 0.2, x + sh * 0.62, top + R * 0.05, x + R * 0.32, top);
  body.closePath();
  ctx.fillStyle = L.top;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // the shade side (the light comes from the left)
  ctx.fillStyle = rgba(shade(L.top, 0.5), 0.28);
  ctx.fillRect(x + sh * 0.35, top, sh, bottom - top);
  wearDetail(ctx, x, y, R, sh, shY, bottom, L);
  ctx.restore();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.stroke(body);
  // the neck
  fillRR(ctx, x - R * 0.26, y + R * 0.6, R * 0.52, R * 0.85, R * 0.2, shade(L.skin, 0.12));
  ellipse(ctx, x, y + R * 1.32, R * 0.3, R * 0.1, rgba(shade(L.skin, 0.4), 0.5));
  if (L.wear === 'hoodie' || L.wear === 'shirt' || L.wear === 'blazer' || L.wear === 'uniform' || L.wear === 'whitecoat' || L.wear === 'coat') collar(ctx, x, y, R, L);
  // the head
  const rx = R * (child ? 0.92 : 0.84);
  ellipse(ctx, x - rx * 0.98, y + R * 0.08, R * 0.15, R * 0.2, shade(L.skin, 0.08));
  ellipse(ctx, x + rx * 0.98, y + R * 0.08, R * 0.15, R * 0.2, shade(L.skin, 0.14));
  ctx.beginPath();
  ctx.ellipse(x, y, rx, R, 0, 0, TAU);
  ctx.fillStyle = L.skin;
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, R * 0.045);
  ctx.stroke();
  // the jaw's shade and the cheek's light
  ellipse(ctx, x + rx * 0.42, y + R * 0.3, rx * 0.5, R * 0.62, rgba(shade(L.skin, 0.5), 0.12));
  face(ctx, x, y, R, L, mood, o);
  frontHair(ctx, x, y, R, L);
  if (L.glasses) glasses(ctx, x, y, R);
  gesture(ctx, x, y, R, sh, shY, L, mood);
  ctx.restore();
}

function backHair(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, L: Look): void {
  const c = shade(L.hair, 0.12);
  switch (L.style) {
    case 'long':
      fillRR(ctx, x - R * 1.08, y - R * 0.7, R * 2.16, R * 2.75, R * 0.9, c);
      break;
    case 'bob':
      fillRR(ctx, x - R * 1.05, y - R * 0.85, R * 2.1, R * 1.65, R * 0.8, c);
      break;
    case 'curly':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.9 + (i / 8) * 1.2);
        ellipse(ctx, x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95 + R * 0.1, R * 0.42, R * 0.42, c);
      }
      break;
    case 'pony':
      ellipse(ctx, x + R * 0.95, y + R * 0.55, R * 0.28, R * 0.75, c, -0.3);
      break;
    default: break;
  }
}

function frontHair(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, L: Look): void {
  const c = L.hair;
  ctx.fillStyle = c;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, R * 0.04);
  if (L.style === 'bald') {
    ellipse(ctx, x - R * 0.82, y - R * 0.1, R * 0.16, R * 0.32, c);
    ellipse(ctx, x + R * 0.82, y - R * 0.1, R * 0.16, R * 0.32, c);
    return;
  }
  const p = new Path2D();
  const low = L.style === 'crop' ? 0.62 : L.style === 'bob' || L.style === 'long' ? 0.38 : 0.48;
  p.moveTo(x - R * 0.9, y - R * (low - 0.25));
  p.bezierCurveTo(x - R * 0.98, y - R * 1.25, x + R * 0.98, y - R * 1.25, x + R * 0.9, y - R * (low - 0.25));
  // the fringe's edge: a side part, a soft wave
  p.bezierCurveTo(x + R * 0.6, y - R * (low + 0.05), x + R * 0.1, y - R * (low + 0.25), x - R * 0.25, y - R * (low - 0.02));
  p.bezierCurveTo(x - R * 0.5, y - R * (low + 0.1), x - R * 0.8, y - R * (low + 0.02), x - R * 0.9, y - R * (low - 0.25));
  p.closePath();
  ctx.fill(p);
  ctx.stroke(p);
  // a sheen
  ctx.save();
  ctx.clip(p);
  ellipse(ctx, x - R * 0.35, y - R * 0.82, R * 0.42, R * 0.12, rgba('#ffffff', 0.14), -0.25);
  ctx.restore();
  if (L.style === 'bun') {
    ellipse(ctx, x + R * 0.1, y - R * 1.12, R * 0.36, R * 0.3, c);
  } else if (L.style === 'curly') {
    for (let i = 0; i < 5; i++) ellipse(ctx, x - R * 0.6 + i * R * 0.3, y - R * 0.78 - (i % 2) * R * 0.1, R * 0.26, R * 0.22, c);
  }
}

function glasses(ctx: CanvasRenderingContext2D, x: number, y: number, R: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(40,30,28,0.85)';
  ctx.lineWidth = Math.max(1, R * 0.055);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * R * 0.34, y - R * 0.04, R * 0.24, R * 0.19, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - R * 0.1, y - R * 0.06);
  ctx.quadraticCurveTo(x, y - R * 0.12, x + R * 0.1, y - R * 0.06);
  ctx.stroke();
  ctx.restore();
}

/** The face: eyes, brows, nose, mouth and the colour of the cheeks, by mood. */
function face(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, L: Look, mood: Mood, o: PersonDraw): void {
  const child = L.age === 'child';
  const ex = R * 0.34, ey = y - R * 0.04;
  const blinkT = (o.t + o.phase * 3) % 4.3;
  const blink = !o.frozen && blinkT < 0.13;
  // where the eyes look: down at a phone (busy), down (sad), at the player (the rest)
  const lookY = mood === 'busy' ? 0.5 : mood === 'sad' || mood === 'tired' ? 0.25 : 0;
  // how open: wide (shout), half (cold, tired), a smile's crescent
  const open = blink ? 0.08 : mood === 'shout' ? 1.15 : mood === 'cold' ? 0.55 : mood === 'tired' ? 0.5 : mood === 'smile' ? 0.55 : mood === 'busy' ? 0.6 : 0.9;
  const ew = R * (child ? 0.17 : 0.15), eh = R * (child ? 0.14 : 0.12) * open;
  // cheeks
  if (mood === 'angry' || mood === 'shout') {
    ellipse(ctx, x - R * 0.48, y + R * 0.3, R * 0.22, R * 0.13, rgba('#e0604a', mood === 'shout' ? 0.38 : 0.26));
    ellipse(ctx, x + R * 0.48, y + R * 0.3, R * 0.22, R * 0.13, rgba('#e0604a', mood === 'shout' ? 0.38 : 0.26));
  } else if (mood === 'smile' || child) {
    ellipse(ctx, x - R * 0.48, y + R * 0.3, R * 0.2, R * 0.11, rgba('#f08a80', 0.22));
    ellipse(ctx, x + R * 0.48, y + R * 0.3, R * 0.2, R * 0.11, rgba('#f08a80', 0.22));
  }
  if (mood === 'tired') {
    for (const s of [-1, 1]) ellipse(ctx, x + s * ex, ey + R * 0.17, ew * 1.1, R * 0.07, rgba(shade(L.skin, 0.6), 0.35));
  }
  for (const s of [-1, 1]) {
    const cx = x + s * ex;
    if (mood === 'smile' && !blink) {
      // a smile's crescent
      ctx.beginPath();
      ctx.arc(cx, ey + R * 0.04, ew * 0.9, Math.PI * 1.12, Math.PI * 1.88);
      ctx.strokeStyle = '#2a1d18';
      ctx.lineWidth = Math.max(1.2, R * 0.07);
      ctx.stroke();
      continue;
    }
    ellipse(ctx, cx, ey, ew, Math.max(R * 0.02, eh), '#fbf8f2');
    if (!blink) {
      ellipse(ctx, cx + R * 0.01, ey + lookY * eh * 0.6, ew * 0.55, Math.min(eh, ew * 0.62), '#3a2a22');
      ellipse(ctx, cx - ew * 0.15, ey + lookY * eh * 0.6 - ew * 0.18, ew * 0.16, ew * 0.16, 'rgba(255,255,255,0.85)');
    }
    // the upper lid (heavy when cold or tired)
    if (mood === 'cold' || mood === 'tired' || mood === 'busy') {
      ctx.beginPath();
      ctx.ellipse(cx, ey - eh * 0.1, ew * 1.08, Math.max(R * 0.03, eh * 0.62), 0, Math.PI, TAU);
      ctx.fillStyle = shade(L.skin, 0.1);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(cx, ey, ew * 1.02, Math.max(R * 0.02, eh), 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = 'rgba(42,28,22,0.7)';
    ctx.lineWidth = Math.max(1, R * 0.04);
    ctx.stroke();
  }
  // brows: a V when angry, raised inside when sad or sorry, one up in a smirk
  const by = y - R * 0.3;
  const bw = R * 0.2;
  const tilt: Record<Mood, [number, number]> = {
    calm: [0, 0], busy: [0.02, 0], smirk: [-0.05, 0.08], angry: [0.14, -0.02], shout: [0.18, -0.06], cold: [0.06, 0.02],
    sad: [-0.12, 0.04], tired: [-0.04, 0.06], sorry: [-0.14, 0.02], smile: [-0.03, -0.04],
  };
  const [inner, lift] = tilt[mood];
  ctx.strokeStyle = shade(L.hair === '#e4e0da' ? '#9a948c' : L.hair, 0.2);
  ctx.lineWidth = Math.max(1.4, R * 0.085);
  for (const s of [-1, 1]) {
    const smirkUp = mood === 'smirk' && s === 1 ? -R * 0.08 : 0;
    const x0 = x + s * (ex - bw), x1 = x + s * (ex + bw);
    ctx.beginPath();
    ctx.moveTo(x0, by + inner * R - lift * R + smirkUp);
    ctx.quadraticCurveTo((x0 + x1) / 2, by - R * 0.06 - lift * R + smirkUp, x1, by - lift * R * 0.5 + smirkUp);
    ctx.stroke();
  }
  // wrinkles
  if (L.age === 'elder' || L.age === 'senior') {
    ctx.strokeStyle = rgba(shade(L.skin, 0.5), 0.5);
    ctx.lineWidth = Math.max(0.8, R * 0.03);
    ctx.beginPath();
    ctx.moveTo(x - R * 0.3, y - R * 0.5);
    ctx.quadraticCurveTo(x, y - R * 0.55, x + R * 0.3, y - R * 0.5);
    for (const s of [-1, 1]) {
      ctx.moveTo(x + s * R * 0.58, ey - R * 0.02);
      ctx.lineTo(x + s * R * 0.68, ey - R * 0.08);
      ctx.moveTo(x + s * R * 0.58, ey + R * 0.04);
      ctx.lineTo(x + s * R * 0.68, ey + R * 0.08);
    }
    ctx.stroke();
  }
  // nose
  ctx.strokeStyle = rgba(shade(L.skin, 0.45), 0.7);
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + R * 0.02, y + R * 0.02);
  ctx.quadraticCurveTo(x + R * 0.12, y + R * 0.2, x - R * 0.04, y + R * 0.24);
  ctx.stroke();
  mouth(ctx, x, y + R * 0.46, R, mood, o);
}

function mouth(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, mood: Mood, o: PersonDraw): void {
  const w = R * 0.2;
  const lip = '#a8564e';
  ctx.strokeStyle = lip;
  ctx.lineWidth = Math.max(1.2, R * 0.065);
  // talking: the mouth opens and closes while the bubble is new
  const talk = o.speaking && !o.frozen ? Math.abs(Math.sin(o.t * 9 + o.phase)) : 0;
  const open = (h: number): void => {
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.3, w * 0.9, Math.max(R * 0.03, h), 0, 0, TAU);
    ctx.fillStyle = '#5a2626';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.3 - h * 0.55, w * 0.62, Math.max(R * 0.015, h * 0.28), 0, 0, Math.PI);
    ctx.fillStyle = '#f6efe6';
    ctx.fill();
  };
  switch (mood) {
    case 'shout':
      open(R * (0.16 + 0.05 * talk));
      return;
    case 'smile':
      ctx.beginPath();
      ctx.moveTo(x - w * 1.3, y - R * 0.04);
      ctx.quadraticCurveTo(x, y + R * 0.22, x + w * 1.3, y - R * 0.04);
      ctx.quadraticCurveTo(x, y + R * 0.06, x - w * 1.3, y - R * 0.04);
      ctx.fillStyle = '#f6efe6';
      ctx.fill();
      ctx.stroke();
      return;
    default: break;
  }
  if (talk > 0.35) {
    open(R * 0.06 * talk);
    return;
  }
  ctx.beginPath();
  switch (mood) {
    case 'calm': ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y + R * 0.07, x + w, y); break;
    case 'busy': ctx.moveTo(x - w * 0.8, y); ctx.lineTo(x + w * 0.8, y); break;
    case 'smirk': ctx.moveTo(x - w, y + R * 0.02); ctx.quadraticCurveTo(x + w * 0.2, y + R * 0.04, x + w * 1.15, y - R * 0.08); break;
    case 'angry': ctx.moveTo(x - w, y + R * 0.05); ctx.quadraticCurveTo(x, y - R * 0.04, x + w, y + R * 0.05); break;
    case 'cold': ctx.moveTo(x - w * 0.9, y + R * 0.02); ctx.lineTo(x + w * 0.9, y + R * 0.02); break;
    case 'sad': ctx.moveTo(x - w, y + R * 0.07); ctx.quadraticCurveTo(x, y - R * 0.05, x + w, y + R * 0.07); break;
    case 'tired': ctx.moveTo(x - w * 0.8, y + R * 0.03); ctx.quadraticCurveTo(x, y + R * 0.01, x + w * 0.8, y + R * 0.04); break;
    case 'sorry': ctx.moveTo(x - w * 0.7, y + R * 0.04); ctx.quadraticCurveTo(x, y - R * 0.01, x + w * 0.7, y + R * 0.04); break;
    default: ctx.moveTo(x - w, y); ctx.lineTo(x + w, y);
  }
  ctx.stroke();
}

/** The collar of a role's clothes. */
function collar(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, L: Look): void {
  const cy = y + R * 1.3;
  switch (L.wear) {
    case 'hoodie':
      // the hood lying behind the neck and its strings
      ctx.beginPath();
      ctx.moveTo(x - R * 0.85, cy + R * 0.05);
      ctx.quadraticCurveTo(x, cy - R * 0.25, x + R * 0.85, cy + R * 0.05);
      ctx.quadraticCurveTo(x, cy + R * 0.45, x - R * 0.85, cy + R * 0.05);
      ctx.fillStyle = shade(L.top, 0.22);
      ctx.fill();
      ctx.strokeStyle = '#f1ece4';
      ctx.lineWidth = Math.max(1, R * 0.05);
      ctx.beginPath();
      ctx.moveTo(x - R * 0.22, cy + R * 0.3);
      ctx.lineTo(x - R * 0.26, cy + R * 0.9);
      ctx.moveTo(x + R * 0.22, cy + R * 0.3);
      ctx.lineTo(x + R * 0.2, cy + R * 0.85);
      ctx.stroke();
      break;
    case 'shirt': case 'blazer': case 'uniform': case 'whitecoat': case 'coat': {
      const c = L.wear === 'coat' ? shade(L.top, 0.15) : L.wear === 'shirt' ? shade(L.top, -0.25) : L.under;
      poly(ctx, [[x - R * 0.42, cy - R * 0.05], [x, cy + R * 0.35], [x - R * 0.15, cy + R * 0.55], [x - R * 0.55, cy + R * 0.2]], c);
      poly(ctx, [[x + R * 0.42, cy - R * 0.05], [x, cy + R * 0.35], [x + R * 0.15, cy + R * 0.55], [x + R * 0.55, cy + R * 0.2]], c);
      break;
    }
    default: break;
  }
}

/** What a role's clothes show on the torso: lapels, a badge, a stethoscope, a cardigan's opening, a zip. */
function wearDetail(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, sh: number, shY: number, bottom: number, L: Look): void {
  const cy = y + R * 1.3;
  switch (L.wear) {
    case 'blazer': case 'cardigan': case 'whitecoat': case 'coat': case 'jacket': {
      // the opening shows what is under it
      const w0 = L.wear === 'jacket' ? R * 0.18 : R * 0.32;
      poly(ctx, [[x - w0, cy], [x + w0, cy], [x + R * 0.5, bottom], [x - R * 0.5, bottom]], L.under);
      if (L.wear === 'blazer') {
        poly(ctx, [[x - R * 0.36, cy], [x - R * 0.08, cy + R * 1.4], [x - R * 0.62, cy + R * 0.7]], shade(L.top, 0.2));
        poly(ctx, [[x + R * 0.36, cy], [x + R * 0.08, cy + R * 1.4], [x + R * 0.62, cy + R * 0.7]], shade(L.top, 0.2));
      }
      if (L.wear === 'whitecoat') {
        ctx.strokeStyle = '#6f7378';
        ctx.lineWidth = Math.max(1, R * 0.07);
        ctx.beginPath();
        ctx.moveTo(x - R * 0.45, cy + R * 0.1);
        ctx.quadraticCurveTo(x - R * 0.6, cy + R * 1.2, x - R * 0.15, cy + R * 1.5);
        ctx.moveTo(x + R * 0.45, cy + R * 0.1);
        ctx.quadraticCurveTo(x + R * 0.55, cy + R * 1.0, x + R * 0.35, cy + R * 1.3);
        ctx.stroke();
        ellipse(ctx, x - R * 0.12, cy + R * 1.52, R * 0.1, R * 0.1, '#9aa0a6');
      }
      if (L.wear === 'jacket') {
        ctx.strokeStyle = rgba(shade(L.top, 0.45), 0.7);
        ctx.lineWidth = Math.max(1, R * 0.04);
        ctx.beginPath();
        ctx.moveTo(x - R * 0.18, cy);
        ctx.lineTo(x - R * 0.3, bottom);
        ctx.moveTo(x + R * 0.18, cy);
        ctx.lineTo(x + R * 0.3, bottom);
        ctx.stroke();
      }
      break;
    }
    case 'uniform':
      fillRR(ctx, x + R * 0.55, shY + R * 0.2, R * 0.6, R * 0.28, R * 0.06, '#f4f1ea');
      fillRR(ctx, x + R * 0.6, shY + R * 0.27, R * 0.35, R * 0.05, R * 0.02, '#8a8f96');
      break;
    case 'sweater':
      ctx.strokeStyle = rgba(shade(L.top, 0.3), 0.6);
      ctx.lineWidth = Math.max(1, R * 0.12);
      ctx.beginPath();
      ctx.moveTo(x - R * 0.48, cy + R * 0.02);
      ctx.quadraticCurveTo(x, cy + R * 0.42, x + R * 0.48, cy + R * 0.02);
      ctx.stroke();
      break;
    case 'tee':
      ctx.strokeStyle = rgba(shade(L.top, 0.3), 0.6);
      ctx.lineWidth = Math.max(1, R * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - R * 0.4, cy + R * 0.02);
      ctx.quadraticCurveTo(x, cy + R * 0.32, x + R * 0.4, cy + R * 0.02);
      ctx.stroke();
      break;
    default: break;
  }
  // the arms' lines along the body
  ctx.strokeStyle = rgba(shade(L.top, 0.45), 0.45);
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - sh * 0.8, shY + R * 0.5);
  ctx.quadraticCurveTo(x - sh * 0.78, shY + R * 2, x - sh * 0.72, bottom);
  ctx.moveTo(x + sh * 0.8, shY + R * 0.5);
  ctx.quadraticCurveTo(x + sh * 0.78, shY + R * 2, x + sh * 0.72, bottom);
  ctx.stroke();
}

/** A hand (a soft mitten with a thumb). */
function hand(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, skin: string, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ellipse(ctx, 0, 0, r * 0.75, r, skin);
  ellipse(ctx, -r * 0.62, r * 0.15, r * 0.3, r * 0.48, shade(skin, 0.06), 0.5);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.75, r, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** What the arms do: a raised hand (shout), crossed arms (cold), a phone held (busy), a hand on the heart (sorry). */
function gesture(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, sh: number, shY: number, L: Look, mood: Mood): void {
  const sleeve = shade(L.top, 0.08);
  switch (mood) {
    case 'shout': {
      ctx.strokeStyle = sleeve;
      ctx.lineWidth = R * 0.62;
      ctx.beginPath();
      ctx.moveTo(x + sh * 0.85, shY + R * 0.5);
      ctx.quadraticCurveTo(x + sh * 1.25, shY + R * 1.2, x + sh * 1.05, y + R * 0.6);
      ctx.stroke();
      hand(ctx, x + sh * 1.02, y + R * 0.25, R * 0.34, L.skin, 0.2);
      break;
    }
    case 'cold': {
      // arms crossed over the chest: two forearms crossing, the hands tucked at the elbows
      const ay = shY + R * 1.45;
      ctx.lineCap = 'round';
      ctx.strokeStyle = shade(L.top, 0.2);
      ctx.lineWidth = R * 0.56;
      ctx.beginPath();
      ctx.moveTo(x - sh * 0.88, ay + R * 0.35);
      ctx.lineTo(x + sh * 0.55, ay - R * 0.22);
      ctx.stroke();
      ctx.strokeStyle = sleeve;
      ctx.beginPath();
      ctx.moveTo(x + sh * 0.88, ay + R * 0.35);
      ctx.lineTo(x - sh * 0.55, ay - R * 0.22);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(42,28,22,0.25)';
      ctx.lineWidth = Math.max(1, R * 0.04);
      ctx.beginPath();
      ctx.moveTo(x + sh * 0.88, ay + R * 0.35 - R * 0.28);
      ctx.lineTo(x - sh * 0.5, ay - R * 0.5);
      ctx.stroke();
      hand(ctx, x + sh * 0.62, ay - R * 0.32, R * 0.22, L.skin, 1.4);
      break;
    }
    case 'busy': {
      const py = shY + R * 1.55;
      fillRR(ctx, x - R * 0.42, py - R * 0.55, R * 0.84, R * 1.15, R * 0.12, '#1f2328');
      fillRR(ctx, x - R * 0.35, py - R * 0.47, R * 0.7, R * 0.98, R * 0.08, '#8fb8d8');
      hand(ctx, x - R * 0.48, py + R * 0.3, R * 0.3, L.skin, -0.3);
      hand(ctx, x + R * 0.48, py + R * 0.3, R * 0.3, L.skin, 0.3);
      break;
    }
    case 'sorry':
      hand(ctx, x - R * 0.45, shY + R * 0.75, R * 0.34, L.skin, -0.6);
      break;
    default: break;
  }
}

// ── the player seen from behind and aside ────────────────────────

/** The player's clothes and hair for their group (gender-neutral: short tousled hair, plain clothes). */
export function selfLook(group: Age): { hair: string; top: string; wear: 'hoodie' | 'jacket' | 'sweater' | 'coat' | 'cardigan' } {
  switch (group) {
    case 'teen': return { hair: '#3f2a20', top: '#4f6f9a', wear: 'hoodie' };
    case 'young': return { hair: '#2b1e19', top: '#6c8a6a', wear: 'jacket' };
    case 'adult': return { hair: '#4a3022', top: '#a35d4a', wear: 'sweater' };
    case 'mid': return { hair: '#5a4a40', top: '#3f5568', wear: 'coat' };
    default: return { hair: '#cfcac3', top: '#8a7058', wear: 'cardigan' };
  }
}

/**
 * The player from behind and a little aside (the camera stepped out of the eyes): the back of the head turned toward
 * the other person (to the right), an ear, the line of the cheek, the shoulders and the back to the bottom of the view.
 */
export function drawSelf(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, group: Age, bottom: number, skin = '#d9ab86'): void {
  if (!(R > 1)) return;
  const L = selfLook(group);
  const sh = R * (group === 'teen' ? 1.55 : 1.7);
  const top = y + R * 1.25, shY = y + R * 1.8;
  const bot = Math.max(bottom, shY + R * 3);
  ctx.save();
  // the back
  const body = new Path2D();
  body.moveTo(x - R * 0.35, top);
  body.bezierCurveTo(x - sh * 0.7, top, x - sh, shY - R * 0.25, x - sh * 1.05, shY + R * 0.5);
  body.lineTo(x - sh * 1.15, bot);
  body.lineTo(x + sh * 1.15, bot);
  body.lineTo(x + sh * 1.05, shY + R * 0.5);
  body.bezierCurveTo(x + sh, shY - R * 0.25, x + sh * 0.7, top, x + R * 0.35, top);
  body.closePath();
  ctx.fillStyle = L.top;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // the light from the scene on the right shoulder, the shade on the left
  ctx.fillStyle = rgba(shade(L.top, 0.5), 0.3);
  ctx.fillRect(x - sh * 1.2, top, sh * 0.75, bot - top);
  ctx.fillStyle = rgba(shade(L.top, -0.5), 0.18);
  ctx.fillRect(x + sh * 0.55, top, sh * 0.7, bot - top);
  if (L.wear === 'hoodie') {
    // the hood lying on the back
    ctx.beginPath();
    ctx.moveTo(x - R * 0.9, top + R * 0.05);
    ctx.quadraticCurveTo(x, top + R * 1.5, x + R * 0.9, top + R * 0.05);
    ctx.quadraticCurveTo(x, top + R * 0.35, x - R * 0.9, top + R * 0.05);
    ctx.fillStyle = shade(L.top, 0.18);
    ctx.fill();
  } else if (L.wear === 'coat' || L.wear === 'jacket') {
    ctx.fillStyle = shade(L.top, 0.2);
    rRect(ctx, x - R * 0.75, top - R * 0.08, R * 1.5, R * 0.42, R * 0.2);
    ctx.fill();
    ctx.strokeStyle = rgba(shade(L.top, 0.4), 0.5);
    ctx.lineWidth = Math.max(1, R * 0.04);
    ctx.beginPath();
    ctx.moveTo(x, top + R * 0.4);
    ctx.lineTo(x, bot);
    ctx.stroke();
  } else {
    ctx.strokeStyle = rgba(shade(L.top, 0.3), 0.55);
    ctx.lineWidth = Math.max(1, R * 0.1);
    ctx.beginPath();
    ctx.moveTo(x - R * 0.5, top + R * 0.02);
    ctx.quadraticCurveTo(x, top + R * 0.16, x + R * 0.5, top + R * 0.02);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, R * 0.05);
  ctx.stroke(body);
  // the neck
  fillRR(ctx, x - R * 0.28, y + R * 0.45, R * 0.56, R * 0.9, R * 0.2, shade(skin, 0.15));
  // the head turned toward the right: the cheek's line and the ear on the right, the hair over the back
  ctx.beginPath();
  ctx.ellipse(x + R * 0.04, y + R * 0.06, R * 0.84, R * 0.97, 0, 0, TAU);
  ctx.fillStyle = shade(skin, 0.08);
  ctx.fill();
  ellipse(ctx, x + R * 0.74, y + R * 0.14, R * 0.15, R * 0.23, shade(skin, 0.02));
  const hair = new Path2D();
  hair.moveTo(x + R * 0.8, y - R * 0.25);
  hair.bezierCurveTo(x + R * 0.86, y - R * 1.2, x - R * 1.0, y - R * 1.25, x - R * 0.9, y - R * 0.05);
  hair.bezierCurveTo(x - R * 0.88, y + R * 0.62, x - R * 0.4, y + R * 0.86, x + R * 0.15, y + R * 0.74);
  hair.bezierCurveTo(x + R * 0.55, y + R * 0.62, x + R * 0.66, y + R * 0.3, x + R * 0.64, y - R * 0.02);
  hair.closePath();
  ctx.fillStyle = L.hair;
  ctx.fill(hair);
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, R * 0.04);
  ctx.stroke(hair);
  ctx.save();
  ctx.clip(hair);
  ellipse(ctx, x + R * 0.25, y - R * 0.6, R * 0.5, R * 0.18, rgba('#ffffff', 0.13), 0.4);
  ctx.restore();
  ctx.restore();
}

function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

// ── the player's own hands ───────────────────────────────────────

/** The player's sleeve colour for their group. */
export const sleeveOf = (group: Age): string => selfLook(group).top;

/** A forearm coming up from the bottom edge with a hand at (x, y). */
export function arm(ctx: CanvasRenderingContext2D, x0: number, y0: number, x: number, y: number, r: number, group: Age, skin = '#d9ab86', rot = 0): void {
  const sleeve = sleeveOf(group);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = r * 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x) / 2, (y0 + y) / 2 + r * 0.5, x, y + r * 0.9);
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(sleeve, 0.4), 0.35);
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  hand(ctx, x, y, r, skin, rot);
  ctx.restore();
}

/** The idle mouth of a speaker while their bubble is new. */
export const speakingFor = (sinceSay: number): boolean => sinceSay >= 0 && sinceSay < 1.8;

/** A tiny face in a circle (a chat's avatar on the phone). */
export function avatar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, mood: Mood): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = mix(look.top, '#ffffff', 0.6);
  ctx.fill();
  ctx.clip();
  drawPerson(ctx, { x, y: y - r * 0.05, R: r * 0.62, look, mood, t: 0, frozen: true, speaking: false, phase: 0, bottom: y + r * 2 });
  ctx.restore();
}

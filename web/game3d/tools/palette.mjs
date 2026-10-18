/**
 * The traumas' colours (from the 2D game's content, web/game/src/content/traumas.ts — a test keeps
 * them equal) and the silhouette each one gets in 3D, by how it moves:
 *   wisp — drifts straight at the angel     hood — circles, then strikes
 *   horn — winds up and charges             droop — drifts and keeps its distance
 *   boulder — slow and heavy                cluster — splits in two when it falls
 *   shard — vanishes and reappears          accuser — keeps away and throws fiery accusations
 */
export const TRAUMA_COLORS = {
  lek: 0x7fd6ff,
  wstyd: 0xff86a6,
  gniew: 0xff3b30,
  rozpacz: 0x4c6bff,
  odrzucenie: 0xc25bff,
  samotnosc: 0x8fa3b8,
  wina: 0xff8a1f,
  nalog: 0x33e07a,
  pycha: 0xffd84a,
  zazdrosc: 0xb5f23a,
  nieprzebaczenie: 0xc08457,
  zwatpienie: 0xe0b3ff,
  kontrola: 0x22d3c5,
  oskarzyciel: 0xff4fda,
};

export const TRAUMA_SHAPES = {
  lek: 'wisp',
  odrzucenie: 'wisp',
  wstyd: 'hood',
  kontrola: 'hood',
  gniew: 'horn',
  zazdrosc: 'horn',
  rozpacz: 'droop',
  samotnosc: 'droop',
  wina: 'boulder',
  pycha: 'boulder',
  nieprzebaczenie: 'boulder',
  nalog: 'cluster',
  zwatpienie: 'shard',
  oskarzyciel: 'accuser',
};

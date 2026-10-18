/**
 * Where the spheres of the Tree of Life lie in the Tree scene, shared by the model of the tree
 * (build-models.mjs) and the content file (build-content.mjs). The tree lies on the ground like a
 * garden seen from above (GDevelop X right, Y down): Keter at the top, Malkut at the root, the
 * three pillars side by side, the two side realms (Ród, Szeol) beyond the roots.
 */
export const TREE_NODES = {
  keter: [0, -560],
  chochma: [300, -430],
  bina: [-300, -430],
  chesed: [300, -170],
  gewura: [-300, -170],
  tiferet: [0, -60],
  necach: [300, 110],
  hod: [-300, 110],
  jesod: [0, 230],
  malkut: [0, 430],
  rod: [-330, 560],
  szeol: [330, 560],
};

/** Paths between the spheres (the traditional ones that read clearly from above). */
export const TREE_PATHS = [
  ['keter', 'chochma'], ['keter', 'bina'], ['keter', 'tiferet'],
  ['chochma', 'bina'], ['chochma', 'chesed'], ['bina', 'gewura'], ['chochma', 'tiferet'], ['bina', 'tiferet'],
  ['chesed', 'gewura'], ['chesed', 'tiferet'], ['gewura', 'tiferet'], ['chesed', 'necach'], ['gewura', 'hod'],
  ['tiferet', 'necach'], ['tiferet', 'hod'], ['tiferet', 'jesod'],
  ['necach', 'hod'], ['necach', 'jesod'], ['hod', 'jesod'], ['jesod', 'malkut'],
  ['malkut', 'rod'], ['malkut', 'szeol'],
];

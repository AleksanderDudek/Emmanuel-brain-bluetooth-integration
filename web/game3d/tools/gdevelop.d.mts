/** Types for gdevelop.mjs (used by the tests). libGD objects are typed loosely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GdProject = any;
export const gd: unknown;
export function loadGameProject(file?: string): Promise<GdProject>;
export function validateProject(project: GdProject): string[];
export function diagnostics(project: GdProject): string[];
export function exportGame(project: GdProject, outDir: string): Promise<string[]>;
export function saveGameProject(project: GdProject, file?: string): Promise<void>;

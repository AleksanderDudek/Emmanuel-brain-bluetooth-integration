/** Paths shared by the game3d tools. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GAME3D = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WEB = join(GAME3D, '..');
export const PROJECT_DIR = join(GAME3D, 'project');
export const PROJECT_FILE = join(PROJECT_DIR, 'HolyHolyHoly3D.json');
export const ASSETS = join(PROJECT_DIR, 'assets');
export const EXPORT_DIR = join(WEB, 'dist', 'holyholyholy3d');

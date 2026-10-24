/** The two headbands Emmanuel works with, and what the UI says about them (in the page's language). */
import { t } from './i18n/shell';

export type Tool = 'fnirs' | 'eeg';
export const TOOLS: readonly Tool[] = ['fnirs', 'eeg'];

export interface ToolInfo {
  /** the technique, a secondary qualifier: "Mendi (fNIRS)" */
  label: string;
  /** the band's full name, for connecting and buying */
  device: string;
  /** the band's short name, for tags and sentences that name both bands */
  band: string;
  /** what it measures, one line */
  measures: string;
  /** where the sensors sit, for the fit advice */
  fit: string;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  fnirs: { label: 'fNIRS', device: 'Mendi', band: 'Mendi', measures: t('tool.fnirs.measures'), fit: t('tool.fnirs.fit') },
  eeg: { label: 'EEG', device: 'BrainAccess HALO', band: 'HALO', measures: t('tool.eeg.measures'), fit: t('tool.eeg.fit') },
};

export const isTool = (v: unknown): v is Tool => v === 'fnirs' || v === 'eeg';

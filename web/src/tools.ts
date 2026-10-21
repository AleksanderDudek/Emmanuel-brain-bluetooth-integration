/** The two headbands BrainLink works with, and what the UI says about them. */

export type Tool = 'fnirs' | 'eeg';
export const TOOLS: readonly Tool[] = ['fnirs', 'eeg'];

export interface ToolInfo {
  /** short label for the switch */
  label: string;
  device: string;
  /** what it measures, one line */
  measures: string;
  /** where the sensors sit, for the fit advice */
  fit: string;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  fnirs: {
    label: 'fNIRS', device: 'Mendi',
    measures: 'Przepływ krwi i natlenienie kory przedczołowej (światło podczerwone).',
    fit: 'Czujniki tuż nad brwiami, na czystej i suchej skórze, bez włosów pod spodem. Opaska ciasno, ale wygodnie.',
  },
  eeg: {
    label: 'EEG', device: 'BrainAccess HALO',
    measures: 'Fale mózgowe: elektrody czołowe Fp1, Fp2 i potyliczne O1, O2.',
    fit: 'Elektrody czołowe na czystej skórze, tylne pod włosami dociśnięte do skóry głowy.',
  },
};

export const isTool = (v: unknown): v is Tool => v === 'fnirs' || v === 'eeg';

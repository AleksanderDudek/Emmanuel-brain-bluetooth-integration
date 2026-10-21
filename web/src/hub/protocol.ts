/**
 * `brainlink-hub` v1: how BrainLink lends its live band to a game running in
 * an <iframe> of the app (see DESIGN.md §4).  Same origin only; both sides
 * check `event.origin` and `event.source`.
 *
 *   game → hub   hello                       "I am here" (sent until a welcome arrives)
 *   hub  → game  welcome / status            tool, source, band info (on connect and on change)
 *   game → hub   want                        the game connected: start sending frames
 *   hub  → game  frames                      raw Mendi frames since the last tick (10 Hz)
 *   game → hub   bye                         the game disconnected: stop sending frames
 */
import type { MendiInfo } from '../ble/mendi';
import type { FrameData } from '../core/proto';

export const HUB_PROTOCOL = 'brainlink-hub';
export const HUB_VERSION = 1;
/** query parameter the app adds to a game's URL when it embeds it */
export const HUB_PARAM = 'hub';

export type HubTool = 'fnirs' | 'eeg';
export type HubSource = 'simulator' | 'device' | 'off';

export interface HubStatusMsg {
  tool: HubTool;
  source: HubSource;
  /** frames are flowing to the game right now */
  streaming: boolean;
  /** a new signal (source switched, band reconnected): the game should take a new baseline */
  epoch: number;
  device: MendiInfo | null;
}

export type HubMessage =
  | { proto: typeof HUB_PROTOCOL; v: number; type: 'hello' }
  | { proto: typeof HUB_PROTOCOL; v: number; type: 'want' }
  | { proto: typeof HUB_PROTOCOL; v: number; type: 'bye' }
  | ({ proto: typeof HUB_PROTOCOL; v: number; type: 'welcome' } & HubStatusMsg)
  | ({ proto: typeof HUB_PROTOCOL; v: number; type: 'status' } & HubStatusMsg)
  | { proto: typeof HUB_PROTOCOL; v: number; type: 'frames'; epoch: number; frames: FrameData[] };

export const hubMessage = <T extends HubMessage['type']>(type: T, body: Omit<Extract<HubMessage, { type: T }>, 'proto' | 'v' | 'type'>) =>
  ({ proto: HUB_PROTOCOL, v: HUB_VERSION, type, ...body }) as Extract<HubMessage, { type: T }>;

export function isHubMessage(data: unknown): data is HubMessage {
  const d = data as Partial<HubMessage> | null;
  return !!d && typeof d === 'object' && d.proto === HUB_PROTOCOL && d.v === HUB_VERSION && typeof d.type === 'string';
}

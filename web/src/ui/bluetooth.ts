/** Bluetooth status banner + guidance dialog ("how do I turn Bluetooth on here?"). */
import {
  bluetoothStatus, detectBrowser, detectPlatform, explainBleError, guidance, MENDI_NAMES, watchAvailability, type BandNames, type BtStatus,
} from '../ble/platform';
import { t } from '../i18n/shell';
import { $, h, toast } from './dom';

export class BluetoothUi {
  status: BtStatus = 'available';
  private readonly platform = detectPlatform();
  private readonly browser = detectBrowser();
  private readonly dialog = $<HTMLDialogElement>('btDialog');

  /** @param names how to call the headband that is chosen */
  constructor(private readonly connect: () => void, private readonly names: () => BandNames = () => MENDI_NAMES) {
    $('btBannerHelp').addEventListener('click', () => this.open());
    $('btnBtHelp').addEventListener('click', () => this.open());
    // the guidance dialog sits above the device sheet; "connect now" must still be a direct click
    $('btDialogConnect').addEventListener('click', () => { this.dialog.close(); this.connect(); });
  }

  async init(): Promise<void> {
    this.status = await bluetoothStatus();
    this.renderBanner();
    watchAvailability(available => {
      this.status = available ? 'available' : 'unavailable';
      this.renderBanner();
      if (available) toast(t('bt.on'));
    });
  }

  private renderBanner(): void {
    const text: Partial<Record<BtStatus, string>> = {
      unsupported: this.platform === 'ios' ? t('bt.bannerIos') : t('bt.bannerUnsupported'),
      unavailable: t('bt.off'),
      insecure: t('bt.bannerHttps'),
    };
    const msg = text[this.status];
    $('btBanner').hidden = !msg;
    $('btBannerText').textContent = msg ?? '';
  }

  open(status: BtStatus = this.status): void {
    const g = guidance(this.platform, this.browser, status, this.names());
    $('btDialogTitle').textContent = g.title;
    $('btDialogSteps').replaceChildren(...g.steps.map(s => h('li', null, s)));
    const link = $<HTMLAnchorElement>('btDialogLink');
    link.hidden = !g.link;
    if (g.link) {
      link.href = g.link.href;
      link.textContent = g.link.label;
      // App Store opens in a new tab; OS settings URLs must stay in the same context
      if (g.link.href.startsWith('http')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } else { link.removeAttribute('target'); }
    }
    $('btDialogConnect').hidden = !g.canConnect;
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Show a failed connection attempt to the user, with guidance where it helps. */
  handleError(e: unknown): void {
    const info = explainBleError(e, this.names());
    if (info.cancelled) return;
    toast(info.message, true);
    if (info.showGuidance) this.open(this.status === 'available' ? 'unavailable' : this.status);
  }
}

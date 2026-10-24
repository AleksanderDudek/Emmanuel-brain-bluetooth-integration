/**
 * The game exists in Polish only.  The modules it shares with the app (Bluetooth errors and help)
 * follow the page's language, so pin it before they load: imported first by the entry.
 */
if (typeof document !== 'undefined' && !document.querySelector('meta[name="i18n-lang"]')) {
  const meta = document.createElement('meta');
  meta.name = 'i18n-lang';
  meta.content = 'pl';
  document.head.append(meta);
}

/**
 * Our own checks drive headless Chrome, which the app's guard (src/guard.ts) turns away as an automated client: every
 * page a script opens is marked as a self-test first.  Call it right after `newPage()`, before `goto()`.
 */
export async function markSelfTest(page) {
  await page.evaluateOnNewDocument(() => { globalThis.__emmanuelSelfTest = true; });
  return page;
}

// Tests read the Polish texts (the source language): pin it before any module settles the language.
// (Some suites run in the plain node environment, which has no localStorage — they need no texts.)
globalThis.localStorage?.setItem('brainlink.lang', 'pl');

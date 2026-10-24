/** Entry of project/lib/mendi-focus.js: publishes `window.MendiFocus`. */
import '../pin-polish';   // first: the shared modules read the page language when they load
import { install } from '../mendi-focus';

install();

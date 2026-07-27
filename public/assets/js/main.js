/* CBAMValid marketing shell — intentionally inert under Next.js.
 *
 * The redesign static HTML used this file for nav, counters, FAQ,
 * currency toggle, and sample-dossier viewer DOM mutation.
 *
 * Those surfaces are now React client components. Loading this file
 * alongside React caused NotFoundError on Node.insertBefore because
 * imperative DOM writes (classList / textContent / innerHTML) fought
 * React reconciliation during client navigations and state updates.
 *
 * Do not re-introduce DOM ownership here. Keep interactivity in React.
 */
(function () {
  'use strict';
})();

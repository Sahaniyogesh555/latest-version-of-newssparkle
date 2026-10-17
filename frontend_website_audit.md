# NewsSparkle — frontend website audit

**Date:** 18 October 2026 (Asia/Katmandu)

**Branch:** `arena/e59698ee-latest-version-of-newssparkle`

**Audit baseline:** `f960012cae6ffbd33b5d017ae1abc075254fbca1`

**Scope:** confirmed frontend defects, responsive rendering, interactions, accessibility, error handling, and truthful feature states. This is not a backend migration or a production/live-service certification.

## Outcome

Confirmed frontend defects have been repaired and verified locally in both development and optimized builds. The existing site design, route architecture, author portraits, SEO structure, monitoring, and production/demo separation are retained. **Live news availability is still unresolved; passing fixture-based checks does not establish that the production feed works.**

No database, migration, Edge Function, scheduled job, publishing control, secret, environment file, Supabase project reference, Vite configuration, dependency manifest, or lockfile was changed. The only Supabase-client edit is a frontend initialization correction: use the SDK's guarded default storage instead of eagerly reading `localStorage`; the existing URL/key inputs and auth flags are unchanged.

No production deployment or merge into `main` was performed for this audit. The existing PR is [#1](https://github.com/Sahaniyogesh555/latest-version-of-newssparkle/pull/1).

## Verification and limits

| Check | Result |
| --- | --- |
| `npm run verify` | **PASS** — TypeScript, ESLint, 295/295 tests in 20 files, optimized non-demo production build |
| New regressions | **60 tests** in six audit suites; previous 235 tests retained |
| Development browser matrix | **195/195** route/viewport combinations completed without the defects measured below |
| Optimized fixture-build browser matrix | **195/195**, same inventory and viewports |
| Browser interaction scenarios | **15/15** in development and **15/15** in the optimized fixture build |
| Light-theme axe samples | **18**, zero reported WCAG A/AA / best-practice rule failures, in each final matrix |
| Dark-theme axe samples | **18**, zero reported rule failures, in each final interaction run |
| Open search modal axe sample | Zero reported rule failures, in each final interaction run |
| Optimized **non-demo** probe | **11 cases**, including denied storage getter/methods and completed backend-error states: zero unhandled page errors, zero demo banners |
| `git diff --check` | **PASS** |
| `npm run check:functions` | **SKIPPED** — Deno is unavailable; backend functions were not changed |

The browser checks used headless Chromium. Widths were **320, 390, 768, 1024, and 1440 CSS pixels**. Screenshots of mobile/tablet pages, the search modal, and an article were visually inspected.

**Important conditions:**

- Content-rich route and interaction checks used the repository's clearly labelled **local demo fixtures**, never production demo mode. External requests were blocked; external article images were replaced locally with the existing generic OG asset. Local author portraits were decoded and measured independently.
- Fonts, actual remote imagery, third-party sharing destinations, email-client delivery, and real translation-provider responses were not validated over the network.
- The separate optimized non-demo probe used the real frontend adapter with external requests deliberately blocked. It waited for explicit load-error states rather than treating a short loading snapshot as a failure. This verifies resilience, **not successful live database reads**.
- Clipboard allowed/denied results and notification permission outcomes were simulated. The application reports the observed result; there is no claim of OS clipboard, delivered email, background push, or live translation verification.
- Zero automated axe violations is not a WCAG certification or a substitute for assistive-technology/manual cross-browser testing. No real-user Core Web Vitals or live Lighthouse result is claimed.

### Measured before/after

Counts below are **route/viewport combinations exhibiting a defect**, not counts of unique pages. Baseline and final optimized runs use the same 39-route, five-width inventory.

| Measured condition | Before | After |
| --- | ---: | ---: |
| Horizontal page overflow | 101 | **0** |
| Error-boundary panic | 10 | **0** |
| Unhandled page errors | 10 | **0** |
| Nested anchor links | 5 | **0** |
| Missing or duplicate `main` landmarks | 30 | **0** |
| Placeholder `href="#"` links | 165 | **0** |
| axe rule occurrences across the 18 light-theme samples | 53 | **0** |

Machine-readable inventory and aggregated evidence: [`docs/audits/frontend-2026-10-18-results.json`](docs/audits/frontend-2026-10-18-results.json). Raw screenshots and temporary browser runners are local audit artifacts, not production assets or committed generated bundles.

## What was found and fixed

### 1. Layout, navigation, and modal controls

**Found:** the masthead overflowed at multiple widths; card/hero interactions contained invalid nesting; search was constrained by the sticky header and lacked complete modal behavior; some error/404 pages lost the site shell or had duplicate main landmarks; placeholder links and a nonexistent trending destination were present.

**Fixed:**

- Gave desktop section navigation its own wrapping row and retained the mobile/tablet menu, with expanded-state semantics, Escape dismissal, and route-change closing.
- Moved search into the existing Radix portal/dialog primitive, with a labelled input, initial focus, focus containment, Escape close, scroll lock, focus return, and viewport-safe bounds.
- Made hero/card article links and bookmark buttons independently usable, without nested interactive links.
- Restored the 404 site shell, exactly one main landmark, and noindex metadata; removed placeholder social links rather than inventing destinations.
- Pointed trending navigation to the supported popular-search view and corrected its ranking presentation.

### 2. Feed, search, archives, and articles

**Found:** appended homepage stories were fetched but hidden by a render slice; rapid pagination could overlap; failed data loads could masquerade as empty archives; invalid custom dates and a percent-containing tag could crash; search punctuation entered raw PostgREST filter grammar; category route changes could expose stale pages; optional article work could interfere with the loaded story.

**Fixed:**

- Render all appended feed stories, guard concurrent loads, preserve existing stories on pagination failure, expose retry, and cancel requests on unmount.
- Validate calendar dates and reversed ranges before conversion; quote/escape search terms as literal filter values; keep controls labelled and URL-driven. Search results remain noindex.
- Stop double-decoding route tags. Distinguish a failed query from a genuinely empty archive, with retry and stale-response guards in search/category/tag/author views.
- Reset category pagination correctly for a new section and avoid showing results from the previous section.
- Separate article loading from optional view counting and recommendations. Add retry/noindex to temporary article errors; cancel stale article/related queries.
- Correct the demo adapter's quoted search parsing, numeric popularity ordering, inclusive ranges, and total-count-before-pagination behavior so local checks do not silently exercise different semantics.

### 3. Browser storage, bookmarks, and theme

**Found:** denied storage methods/getters, malformed saved JSON, or quota failures could break rendering or imply that a failed save succeeded. System-derived theme choice was incorrectly persisted as explicit user preference, and SEO could reset the browser UI theme on navigation.

**Fixed:**

- Guard optional storage reads/writes; validate bookmark entries; preserve valid entries while dropping corruption; show a failure instead of a false saved state.
- Keep reading, consent dismissal, alerts, reading history, and theme switching usable when persistence is unavailable.
- Follow system theme changes until a reader explicitly selects a preference; preserve explicit choices and matching browser theme color.
- In the **real non-demo client**, remove eager `storage: localStorage` so the Supabase SDK can use its guarded storage/in-memory fallback. A new regression failed before this fix; the optimized browser probe subsequently passed both storage-denial cases.

### 4. Truthful contact, newsletter, sharing, and language controls

**Found:** contact/newsletter UI claimed success without a delivery/subscription service; clipboard rejection could be ignored; translation could relabel unchanged English as another language; feed links incorrectly targeted SPA paths; fallback error text claimed newsroom notification without proof.

**Fixed:**

- Contact prepares an explicitly **unsent email draft**, preserves form fields, offers the mail app and copy/manual fallback, and invalidates a prepared draft if fields change. It never posts or claims server delivery.
- Newsletter areas explicitly say email subscriptions are unavailable and offer existing on-site/RSS navigation; no email address is collected.
- Shared clipboard handling reports success only after `writeText` resolves and exposes a selectable URL/text on failure.
- Load translation only after a language request. Preserve English/current language on adapter failure or unchanged text; report failure, allow cancellation back to English, support original-English cookie reset/reload, and clearly mark unsupported Hinglish. A widget accepting a value alone is not treated as successful translation. Actual provider success remains unverified.
- RSS and machine-readable feed links use the existing configured API origin. The generator keeps `llms.txt` resource links synchronized. No configured API/canonical origin was changed.
- Remove unsupported error-notification and guaranteed publishing-cadence claims. Align FAQ sections, contact/privacy wording, and brand guidelines with actual site behavior/tokens/fonts.

### 5. Reading and accessibility

**Found:** mobile article metadata/trust rows and tables could spill out; the floating share rail could obscure text; article contents links had incorrect scope/offset and were poorly placed on phones; ticker motion lacked a pause control and labelled ordinary headlines as breaking; sampled links/labels/contrast failed automated accessibility checks.

**Fixed:**

- Wrap metadata/trust rows and long text; put article tables in labelled, keyboard-focusable horizontal scrolling regions.
- Keep inline sharing on small screens and show the fixed rail only in the outer gutter at wide sizes while the article is in view.
- Scope contents to article body headings, expose contents above mobile article text, and use measured sticky-header anchor offsets.
- Label the unfiltered headline rail **Latest**; add Pause/Resume, hover/focus pausing, reduced-motion initialization, and abort-safe loading.
- Correct accessible names, search/filter labels, main landmarks, keyboard focus visibility, reduced-motion styling, and text/accent contrast within the existing palette. Remove the duplicate font import while retaining the existing HTML font request.
- Retain all six existing author identities/photos and the previously repaired portrait wrappers; optimized browser checks confirm six directory portraits decode at 64×64.

## What remains / owner action

1. **BLOCKED — live news/backend availability.** Existing frontend configuration still references the legacy Supabase project. The earlier read-only inventory could not access that legacy project; the accessible replacement project was empty. This audit neither moved projects nor applied migrations. Actual production stories, feeds, search results, realtime alerts, view counting, and sitemap-function responses need authorized backend remediation and a live end-to-end recheck.
2. **BLOCKED — real translation and external services.** Real Google translation success, all language directions/return-to-English behavior against the provider, actual mail-client delivery, remote imagery/fonts, and external share flows need a network-enabled browser check. Local adapter simulations are not a substitute.
3. **NOT CONFIGURED — contact delivery, newsletter, background push, ads.** Contact remains a device-local email draft; newsletter signup and background push do not exist. AdSense is still an inactive commented placeholder. These are now disclosed, not silently faked. Any future activation needs separate configuration, consent/provider integration, and verification.
4. **REVIEW — canonical deployment host.** The existing Lovable canonical fallback is unchanged even though a Vercel deployment also exists. Owner confirmation of the intended public canonical origin is needed before changing environment/site configuration or asserting live SEO correctness.
5. **PENDING — release and production smoke test.** These audit changes have not been deployed to production by this task. After approval/release, recheck the actual public hostname and real backend from desktop/mobile browsers; a READY build alone is insufficient runtime evidence.
6. **NONBLOCKING verification limits.** Deno function checks were skipped; Safari/Firefox, screen-reader testing, and real performance metrics were not run. Existing React Router future-flag, React 18 `fetchPriority`/test `act`, and stale Browserslist-data warnings remain; they did not fail TypeScript, lint, tests, the build, or the measured browser checks.

## Regression suites

- `src/test/frontend-audit-ui.test.tsx` — 10: independent links, modal/menu semantics, honest contact/newsletter/RSS, 404 shell/SEO.
- `src/test/frontend-audit-storage.test.tsx` — 11: corruption, storage denial/quota, bookmarks, consent, and system/explicit theme behavior.
- `src/test/frontend-audit-data.test.tsx` — 21: search/filter/date/tag handling, archive errors/retry/stale requests, category pages, and article isolation.
- `src/test/frontend-audit-feed.test.tsx` — 2: appended stories and pagination failure/retry without losing stories.
- `src/test/frontend-audit-client.test.ts` — 1: real-client module initialization with a denied storage getter.
- `src/test/frontend-audit-controls.test.tsx` — 15: truthful translation/cancellation, clipboard states, scoped contents, theme metadata, notification consent, ticker pause, demo contracts, and feed URL construction.

Re-run the committed unit/build checks with `npm ci && npm run verify`. Use `npm run dev:demo -- --host 0.0.0.0` only for clearly labelled fixture previews; do not enable demo mode in production.

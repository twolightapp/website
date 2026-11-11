# Website redesign handoff

## Current handoff — 2026-11-10 21:49 MT, Codex

Christian authorized implementing the website critique ("Can you do that for me?"). Website-only changes. iOS source-review loop remains closed.

- Repository: twolightapp/website. Baseline main `1903004` (Privacy 1.3).
- Checkout: `/Users/geekyanalyst/Documents/ChatGPT/Twolight/website`.
- Branch: `codex/website-polish`. Implementation and this handoff saved in a local commit; no push, PR, merge or deployment.
- The old `/Users/geekyanalyst/Desktop/twolightapp-site` is a stale plain folder; it was not edited. GitHub is the source of truth.
- Preview: `http://127.0.0.1:8765/` while the local server is running. Restart: `python3 -m http.server 8765 --bind 127.0.0.1` from this checkout.
- Screenshots: sibling `website-review/desktop.jpg`, `mobile.jpg`, `pricing.jpg` (review artifacts, not website assets).

## Changes

Shorter two-column dark hero, peach working anchor CTA, plain coming-soon status, cream app-image panels, three feature stories, explicit free/Plus comparison and yearly/monthly billing, compact privacy reassurance, four homepage FAQs and twelve support FAQs. Native video controls replace custom sound-only autoplay; playback is user-initiated, including with reduced motion. Shared document padding fixes mobile edge-to-edge text. Skip links and visible keyboard focus added. No dependencies, scripts, tracking, forms or external font requests added.

Calendar and talk images are exact frames at 22s and 25s from the repo's existing `media/twolight.mp4`; no invented app UI. The memories section is editorial text, not a fabricated screenshot (no genuine memory capture was supplied). Existing film, poster, icon, fonts and price amounts retained. Plus disclosure stays beside the film. Prices identified as USD; App Store local prices/eligibility govern. No App Store download link fabricated before launch.

Support answers adapted into semantic details/summary (including Claude’s outage guidance, with absolute delivery/data guarantees softened) from AskMe `docs/features/support-faq.md`; personal contact and existing safety introduction retained. Original support topics on pairing, backups and subscriptions are covered in the new answers; Privacy/Terms links remain available. Legal page body text is unchanged; only shared stylesheet version, main ID and skip-link markup changed.

## Validation and limits

- `git diff --check`: PASS.
- Parsed all five HTML pages: local links/assets/fragments resolve, no duplicate IDs, all images have alt attributes: PASS.
- Compared Privacy and Terms main-body text with baseline: unchanged.
- Browser visual checks: desktop (1440 × 1000), mobile (390 × 844), narrow phone (320 × 740). Home, support and privacy have no horizontal page overflow at 320px; Terms also measured 320px with 24px padding.
- Homepage anchors, native film play/pause (time advanced, pause confirmed), support backup accordion (12 total questions): PASS.
- Saved desktop/mobile/pricing screenshots; local preview left open. Native controls have built-in keyboard support; no claim of a full screen-reader, real-iPhone Safari, light-mode document or performance audit.
- Self-review by Codex only; no separate review or deployment performed.

## Next step and release control

Christian reviews local preview and copy. In particular, approve support wording and visual direction; check the existing price amounts against ASC before launch. Only after explicit push/publish approval should an agent push this branch/open a PR; pushing/merging main can publish through GitHub Pages. Keep the live site unchanged until then. After release approval, verify home/support/legal pages on a real iPhone and re-check playback/links on the deployed site.

Rollback before publication: keep the existing main/live site. After any later approved release, use a reviewed revert of the website change commit; do not reset history. No iOS build, app data or relay deployment is involved.

## Change history

| When | Who | Change | State |
|---|---|---|---|
| 2026-11-10 21:49 MT | Codex | Implemented authorized visual/mobile/FAQ improvements from main 1903004; checked locally and documented | Local branch; not published |

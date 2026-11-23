# Twolight website design guide

The rules this site follows, written down so every change stays on-brand. Read this before editing `style.css` or any page. It describes what the site already does. It isn't a redesign.

## What the site is for

Twolight is an iPhone and Apple Watch app for couples on different schedules. The site explains the app, lets visitors try a few honest demos, and links to the App Store. It is a static site: plain HTML and CSS, one script (`app.js`, no libraries), no build step. The home page comes in two modes, the full experience and Simple (see below).

## Voice

- Plain and warm. Never salesy, never hype.
- Short sentences. Speak to two people ("you both", "the two of you").
- Say what the app really does. No invented claims, reviews, user counts or testimonials. If a feature isn't in the app, it doesn't go on the site.
- Label demos as demos, and say when a drawing stands in for the real thing (the bouquet notes that the app's flowers are real 3D models). Mark Plus features as Plus wherever they come up, including the founder note.
- Sentence case for headings and buttons.

## Hard rules

- No analytics, cookies, trackers, third-party scripts, embeds or external fonts. Privacy is the promise: no accounts, no ads, no tracking.
- No stock photos of people. Use real app screens or simple shapes.
- Don't change the text of `/privacy` or `/terms` without an explicit request.
- Pricing, exactly: free core. Twolight Plus is $10/month or $60/year, with a 1-week free trial for eligible new subscribers. One subscription covers both partners.
- No framework, build step or paid service without asking first.
- `localStorage` holds only the visitor's own choices on this device (`twolight.mode`, `twolight.music`). Nothing is sent anywhere.
- Sound never starts by itself. Music plays only after the visitor chooses it, and browsers also need a click or key press first (scrolling doesn't count). While it waits, the button says "Play music".

## Two ways to see the home page

The page is one HTML file. `app.js` turns it into the full experience; without the script, or in Simple, it is the plain page underneath.

- **First visit:** the full experience shows right away with a small bar at the bottom (Keep it simple / Play music / Looks good). With Reduce Motion on, Simple shows first and the bar offers the experience instead. The bar sits right after the header in keyboard order, and the day path's stops bar lifts above it while it shows. The header always has the switch (Simple view / The experience) and, in the experience, the Music button.
- **Full experience:** one dark palette top to bottom, whatever the system appearance. In order: the sunset hero with the "When are you both free?" picker and Download first; the day path; the bento of six cards (three, then More, on phones); the founder note; Plus; FAQ; closing with Share a hug.
- **Day path:** desktop (900px and up, motion allowed) is the 3D path with the stops bar; only the current stop can be focused or tapped. Phones, and Reduce Motion, get three stops down the page (Before work, Running late, Talk) and the rest under "More you can do". Every card's content stays inside its card at 375px.
- **Playable stops** (send a hug, save a gift, the talk light, build a bouquet, add a countdown) each sit on their own solid card, so nothing behind shows through.
- **Light ribbons:** two strands on a fixed canvas behind the page, clay for you and teal for your partner. They drift apart between stops and come together at stops and at the end. They are still (redrawn only on scroll) on phones and with Reduce Motion.
- **Sound:** an original lofi loop made live in the browser (no audio files, nothing licensed), plus a soft swoosh between stops and a two-note chime. All of it only while music is on.
- **Simple:** the page as it always was, in the visitor's light or dark appearance. Keep it complete; it is what Reduce Motion visitors see first.

## Color

Defined as CSS variables in `style.css`. The site follows the visitor's light or dark setting.

| Token | Light (Linen) | Dark (Midnight) |
| --- | --- | --- |
| `--bg` | `#f5efe7` | `#15171c` |
| `--card` | `#fffaf5` | `#202229` |
| `--ink` | `#28201b` | `#f5efe7` |
| `--muted` | `#65594f` | `#beb8b0` |
| `--line` | `#d9cbbb` | `#36373c` |
| `--accent` (peach/clay) | `#9e422a` | `#f0ac8c` |
| `--partner` (teal) | `#2f6f73` | `#8abbb4` |
| `--glow` (gold) | `#e9b930` | `#e9b930` |

- Accent is "you", teal is "your partner", gold is "both of you" (shared light). Keep that meaning.
- Talk light colors are fixed: green `#3e9a62`, yellow `#e9b930`, red `#c8372d`.
- Text must keep at least 4.5:1 contrast in both modes.

## Type

- Headlines: Fraunces SemiBold. Body and UI: DM Sans 400 and 600. Both are self-hosted in `/fonts`.
- Tight letter-spacing on large headlines (about -.025em to -.035em). Eyebrows are 11px, 600, spaced out, in the accent color.
- Body text is 17px at 1.6 line height. Keep captions and notes at 12px or larger.

## Layout

- Content width up to 1140px on the home page, 760px on text pages. Side padding 32px, or 24px under 760px.
- Cards are 20 to 24px radius with a 1px `--line` border. Buttons are 10px radius, at least 48px tall. Tap targets are at least 44px.
- Phones get a single column. The three feature stories become a swipeable row.

## Motion

Motion should feel like light arriving, calm and short. It never carries meaning on its own.

- Animate only `transform` and `opacity`. The exceptions are the height of the FAQ and "See every feature" accordions, which opens smoothly where the browser supports it, and the two canvases in the full experience (the hero sea and the light ribbons), drawn at half resolution and paused when the tab is hidden.
- Enter with an ease-out curve (`cubic-bezier(.22, 1, .36, 1)`), about 500 to 700ms. Small things (hover, press) take 150 to 250ms.
- Interactive demos use the `--spring` curve already defined in `style.css`.
- Scroll-linked effects use CSS `animation-timeline: view()` inside `@supports`, so browsers without it simply show the finished state.
- Everything sits inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion on, Simple is the default and the page is still, and complete. If such a visitor chooses the full experience, it stays still: no 3D path, no hug animation, and the sea and ribbons don't move on their own.
- Content must never be hidden if an animation or script fails.

## Performance

- No render-blocking third-party anything. One stylesheet, one deferred script.
- The film uses a poster image and `preload="none"`. Keep the hero poster preloaded.
- Check Lighthouse performance and accessibility before and after any visual change. They shouldn't get worse.

## Previews (set up 2026-11-22)

Every branch pushed to GitHub gets its own preview from Cloudflare Pages (project `twolight-preview`), at
`https://<branch-name-with-dashes>.twolight-preview.pages.dev` (for example `claude/day-timeline` →
`claude-day-timeline.twolight-preview.pages.dev`). `https://twolight-preview.pages.dev` mirrors `main`.
The live site, twolightapp.com, is still served by GitHub Pages; previews never change it.

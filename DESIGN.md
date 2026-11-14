# Twolight website design guide

The rules this site follows, written down so every change stays on-brand. Read this before editing `style.css` or any page. It describes what the site already does. It isn't a redesign.

## What the site is for

Twolight is an iPhone and Apple Watch app for couples on different schedules. The site explains the app, shows two small honest demos, and links to the App Store. It is a static site: plain HTML and CSS, one small script (`app.js`), no build step.

## Voice

- Plain and warm. Never salesy, never hype.
- Short sentences. Speak to two people ("you both", "the two of you").
- Say what the app really does. No invented claims, reviews, user counts or testimonials. If a feature isn't in the app, it doesn't go on the site.
- Sentence case for headings and buttons.

## Hard rules

- No analytics, cookies, trackers, third-party scripts, embeds or external fonts. Privacy is the promise: no accounts, no ads, no tracking.
- No stock photos of people. Use real app screens or simple shapes.
- Don't change the text of `/privacy` or `/terms` without an explicit request.
- Pricing, exactly: free core. Twolight Plus is $10/month or $60/year, with a 1-week free trial for eligible new subscribers. One subscription covers both partners.
- No framework, build step or paid service without asking first.

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

- Animate only `transform` and `opacity`. The one exception is the height of the FAQ and "See every feature" accordions, which opens smoothly where the browser supports it.
- Enter with an ease-out curve (`cubic-bezier(.22, 1, .36, 1)`), about 500 to 700ms. Small things (hover, press) take 150 to 250ms.
- Interactive demos use the `--spring` curve already defined in `style.css`.
- Scroll-linked effects use CSS `animation-timeline: view()` inside `@supports`, so browsers without it simply show the finished state.
- Everything sits inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion on, the page is still, and complete.
- Content must never be hidden if an animation or script fails.

## Performance

- No render-blocking third-party anything. One stylesheet, one deferred script.
- The film uses a poster image and `preload="none"`. Keep the hero poster preloaded.
- Check Lighthouse performance and accessibility before and after any visual change. They shouldn't get worse.

# 🌱 CodeSprout

**[Open CodeSprout →](https://erendragneel.github.io/codesprout/)**

Learn coding from your very first step. One tiny idea, one little guess, one thing to try. No experience or GitHub sign-in needed.

## Install on your phone

1. Open **[CodeSprout](https://erendragneel.github.io/codesprout/)** in your normal browser. If GitHub opens its own browser window, choose **Open in Chrome** or **Open in Safari**.
2. Tap **Install** at the top of the app.
3. **Samsung / Android:** in Chrome, tap **⋮ → Add to Home screen → Install**. Your browser may call it **Install app**.
4. **iPhone / iPad:** in Safari, tap **Share → Add to Home Screen**. Turn on **Open as Web App** if shown.

You can also use it directly in your browser. On desktop Chrome or Edge, use the install icon or browser menu.

Keep the first visit online until the app finishes loading. After that, all lessons, the glossary, and the practice spaces work offline. You do not need to download a ZIP or install any coding tools to learn.

## Made for curious beginnings

- **30 game lessons:** build a clicker, target game, Pong, maze, and platformer, then debug and build your own game. Learn the game loop, time, input, collisions, scores, win/loss, and restart rules.
- **8 independent remixes:** change fresh game behavior with several input cases. Guided work, hints, and independent results are recorded separately; code reviews return on a spaced schedule.
- **Your game workshop:** play live games with touch or keyboard controls, save your own source, and download a self-contained HTML game that works offline. No extra software needed.
- **6 first steps:** guide a little robot with arrow buttons. No typing.
- **14 JavaScript lessons:** messages, numbers, variables, decisions, lists, loops, functions, and two tiny projects.
- **10 HTML & CSS lessons:** headings, paragraphs, lists, links, colors, spacing, and your first profile card.
- **Gentle help:** short explanations, read-aloud controls, gradual hints, and worked examples. Wrong guesses cost nothing.
- **Real practice:** JavaScript actually runs; web pages actually render. Endless loops stop after about two seconds.
- **A growing garden:** saved lesson progress, earned points, streaks, milestones, and spaced review.
- **A playground:** change a real program or page and see what happens.
- **39 simple definitions:** coding and game words explained without assuming prior knowledge.

Progress is stored in this browser, not in an account. **My growth → Save a backup** downloads progress, independent results, and your saved game projects. Use **Save my project** in the workshop before backing up your latest edits. You can restore on another device; old version 1 progress files remain supported. Restoring replaces that device’s saved progress. Clearing browser/app data can remove local progress. The app reports when browser storage is unavailable.

This is a personal beginner course in 2D game programming. The same ideas transfer to other game engines, but advanced 3D, multiplayer, large game architecture, and production tools require further learning. Independent results check behavior, not a professional qualification. Hints count as practice, and points are not a grade.

## Development

Requires Node.js 22.12+ and pnpm 11.25.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm run stage
```

GitHub Pages publishes **main → /docs**. `dist` is the Vite build; `docs` is the checked-in distribution. `pnpm run stage` generates a content-versioned offline cache. After a code change, run build and stage before committing. Updates wait for the learner to choose **Update app**, so a session is not unexpectedly interrupted.

Browser verification:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

For an installed browser, use `PLAYWRIGHT_CHANNEL=chrome` or `PLAYWRIGHT_CHANNEL=msedge`. The browser test starts its own preview server and checks the learning flow, every worked solution, wrong starters, persistence, narrow layouts, execution deadlines, isolation, accessibility, and offline navigation. CI runs the same checks.

Original curriculum: `src/data/curriculum.ts` and `src/data/gameLessons.ts`. Learning sandboxes: `src/lib/runner.ts` and `src/lib/gameRuntime.ts`. Save and review logic: `src/lib/progress.ts` and `src/lib/mastery.ts`.

JavaScript and games run in workers inside opaque sandboxes with network requests blocked. Live games use an OffscreenCanvas and a two-second frame watchdog; broken loops stop without freezing the app. Game checks create fresh state for each case and simulate input and time rather than compare answer strings. HTML previews remove active content and disable script execution; preview links are intentionally inert. This is a browser learning sandbox with execution/output limits, not a hardened hostile-code or memory-isolation service.

No paid services, API keys, accounts, ads, or analytics are required. GitHub serves the files. Fonts are bundled for offline use. Optional speech uses your browser/device voice service.

## Sources and credits

The course explanations and exercises are original. Language behavior was checked against [MDN’s JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) and [MDN’s HTML and CSS learning materials](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core).

Icons: [Lucide](https://lucide.dev), ISC license. Typefaces: [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans) and [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope), SIL Open Font License; license files are included in `public/fonts`. Garden and robot illustrations are original SVG/CSS.

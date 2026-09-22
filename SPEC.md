# Morrow — Product & Engineering Spec

> An AI fortune teller that reads your connected accounts the way a psychic "hot reads" a room. Observations are grounded in real data; prophecies are generated, time-boxed, and automatically verified against your sources.

- **Design source of truth:** [Paper — Morrow — Web App](https://app.paper.design/file/01M2NRFN984ZCAHJT65TCM7QXR), page **"v4 — Parcel (full set)"** (§4, §11). The v2 "Deep field" artboards on Page 1 are what the code implements today and are superseded by v4; the "v3 B — Velvet Séance" page holds the v4 study board and early explorations.
- **Status:** v0.3 shipped on the v2 design; the v4 design is implemented on branch `redesign/v4-parcel` (§4.H)
- **Last updated:** 2026-09-21

---

## 1. Product principles

1. **Hot reading, not cold reading.** Morrow's power is nowcasting — telling users true things about themselves they haven't noticed.
2. **Ground the past, generate the future.** Observations must cite evidence from the dossier (`evidenceRef`). Prophecies may be imaginative but must carry a machine-checkable `checkCondition` and a time window.
3. **Self-verifying prophecy.** A background job checks open prophecies against new source data and marks them `fulfilled` or `expired`. The fulfilled moment is the core retention loop.
4. **One person, one reading a day.** Like a real psychic, the user speaks to Morrow in a single session per day. No "new chat".
5. **Progressive permission.** Start with Calendar + Spotify. Morrow asks for more access only when a prophecy needs it ("It will ask only when a prophecy needs to see more").
6. **Taboo topics.** Never infer or predict about health, pregnancy, death, money stress, or relationship breakdown. Enforced in the system prompt **and** a post-generation filter.
7. **Radical data honesty.** Raw events are deleted after 24h; only the distilled dossier persists. Users can view the dossier, forget single facts, or forget everything.

### Voice

Morrow speaks as a psychic, not an analyst (v0.3.1), never says a name (v0.3.2), and — since its replies are chat bubbles in body text — keeps every reply short enough to read at a glance (v0.4). Concise, not curt: the warmth and the quiet certainty stay.

- **Chat answer:** 1–3 short sentences, at most two short paragraphs, ≤ 45 words. The `observe` headline is the answer (≤ 2 sentences, ≤ 25 words); the plain-text follow-up is optional and only adds the sign to watch for or the one thing to do (≤ 2 sentences, ≤ 25 words).
- **Opening reading:** the observation is one or two short sentences (≤ 20 words); the prophecy is exactly one sentence (≤ 22 words).
- **Readability:** one idea per sentence, plain everyday words, no stacked clauses or semicolon chains, no lists. Lead with the reading: no preamble ("Ah,", "I sense that…"), never restate the question.
- **Never said:** names, event or company names, dates, weekdays, clock times, counts, and prophecy numbers or ids (`0052`, `p_0047` — memory only; a prophecy is referred to by what it foretold).
- **Enforcement** (`apps/web/lib/ai/voice.ts`, limits in `VOICE_LIMITS`; prompts ask for a few words less than the gates allow):
  - reading gate: `reviewReadingLength` joins `reviewDraft`, so a long or wordy draft is regenerated with feedback (up to two retries, then the last gate-passing draft or the templated fallback);
  - chat: a wordy `observe` headline is sent back once with the problems, and the next one (or the rejected draft, if the model never re-calls) is shown trimmed to two sentences; `conciseTransform` keeps at most two follow-up sentences; `maxOutputTokens` 400 is a backstop;
  - evals: `within_length` uses the reading gate's limits, the new `concise` check scores chat answers, and `judge_voice` asks for a short, plain chat message.

## 2. Product rules (reading lifecycle)

| Rule | Value |
|---|---|
| Readings per user per day | exactly 1, unique on `(user_id, local_date)` |
| Day boundary | **04:00 in the user's local timezone** (not midnight) |
| Opening message | Morrow speaks first; generated before dawn by cron (or lazily on first open) |
| Question limit | **15 user messages per reading** (UI shows `n OF 15 TODAY`) |
| Sealing | At the day boundary the reading becomes `sealed` (read-only) and is summarized into memory |
| Memory | Context = persona + dossier + last ~7 reading summaries + open prophecies + today's messages |
| Prophecy resolution | Fulfilled prophecies are announced **in today's reading**, linking back to the reading that made them |
| Writes to a sealed reading | Rejected (`409`), client redirects to today |

## 3. Information architecture

Nav (desktop top bar, mobile menu sheet): **Today · Readings · Prophecies · Sources**

| # | Screen | Route (web) | Route (mobile) | Paper artboards |
|---|---|---|---|---|
| 01 | Invocation (today, before first question) | `/` | `/(app)/index` | `v2 / 01`, light, mobile |
| 02 | Reading (observation + prophecy) | `/` | `/(app)/index` | `v2 / 02` |
| 03 | Prophecy fulfilled | `/` (state) | `/(app)/index` (state) | `v2 / 03` |
| 06 | Asking (Morrow is reading, source steps) | `/` (state) | state | `v2 / 06` |
| 07 | Answer (+ typing next question) | `/` (state) | state | `v2 / 07` |
| 04 | Past readings | `/readings` | `/readings` | `v2 / 04` |
| 05 | Sealed reading | `/readings/[date]` | `/readings/[date]` | `v2 / 05` |
| 09 | Prophecies | `/prophecies` | `/prophecies` | `v2 / 09` |
| 10 | Sources | `/sources` | `/sources` | `v2 / 10` |
| 11 | Dossier | `/sources/dossier` | `/sources/dossier` | `v2 / 11` |
| 12 | Forget everything | `/sources/forget` | `/sources/forget` | `v2 / 12` |
| 08 | Menu sheet (mobile only) | — | `/menu` (modal) | `v2 mobile / 08` |

Active nav item: **Today** on 01/02/03/06/07 · **Readings** on 04/05 · **Prophecies** on 09 · **Sources** on 10/11/12.

Screen numbers above are the v2 numbers used in code and routes. The v4 Paper page renumbers screens in user-journey order (Sign in 01 … Forget everything 14); §11 maps the two.

## 4. Design system — v4 "Parcel"

Quiet, printed, a little mystical: a psychic's parlour rendered as paper and ink. Flat Parcel paper with a fine grain, dark Black Fig ink, one Oxblood accent, Chambray for Morrow's light. Minimal and type-led — graphics are rare and small, and nothing glows. Light only.

**Paper page:** "v4 — Parcel (full set)" (27 artboards, §11). **Graphic masters:** study board `7IA-0` ("v3B web / 06 — Soft light study", page "v3 B — Velvet Séance"), section "Scale".

### 4.A Principles

1. **Ink, not light.** No glow, halo, bloom, text-shadow, drop-shadow, gradient "light", clouds or vignettes anywhere. Softness comes from paper grain and the ball's own shading.
2. **Type leads.** Instrument Serif headlines, left-aligned, upright. Screens are mostly type, hairlines and space.
3. **Chat, not proclamations.** Wherever Morrow speaks, the screen is a chat: user bubbles right, Morrow bubbles left with the ball avatar. Morrow's replies are body-size text in bubbles, never large editorial serif.
4. **Graphics are scarce and have a role.** The crystal ball is Morrow's mark, the body figure is the one illustration, and the moon-phase glyph carries data. There are no decorative icons.
5. **Don't display sources.** Experience screens never show data-source names, counts or chips (no "Reading from…", no "2 sources linked", no source rail, no "Watching Calendar · Mail", no source list in the thinking state). Sources appear only on the account screens: Sources, Dossier, Connect accounts, Forget everything.
6. **No roman numerals, no serial numbers, no numbered lists.**

### 4.B Color tokens (v4)

| Token | Value | Use |
|---|---|---|
| `bg` (Parcel) | `#E5E3DA` | page ground, always flat |
| `surface` | `#DAD7CB` | Morrow bubbles, cards, composer, menu card |
| `hairline` | `rgba(41,16,12,0.14)` (`#29100C24`) | borders, dividers, nav underline |
| `text` (Black Fig) | `#29100C` | headlines, body, values |
| `textMuted` (Capers) | `#53461C` | secondary copy, meta, placeholders, inactive nav |
| `accent` (Oxblood) | `#5A1D22` | primary buttons, send/stop, active nav, links, likelihood bars, moon glyphs, body-figure silhouette |
| `onAccent` | `#E5E3DA` | text/icon on Oxblood |
| `chambray` | `#A9C0CB` | user chat bubbles, figure aura, ball shading |
| `onChambray` | `#29100C` | text on user bubbles |
| `highlight` (Chartreuse) | `#BFB065` | tiny status dots only: fulfilled/landed, live/typing, chakra points |
| `danger` (Brick) | `#A3372A` | destructive actions only: "Forget everything" button/links, "Forget this ×", the `FORGET` confirm field border and caret |
| `onDanger` | `#F4EFE6` | text on `danger` |
| `dangerBorder` | `rgba(163,55,42,0.55)` | confirm field border |

- The ball ramp adds `#EEF1F2 → #E1E6E6 → #A9C0CB → #7F97A3 → #62798A` with a rim of `#5E7482` at 45% (§4.E).
- Brick is deliberately brighter and warmer than Oxblood so a destructive action never reads as a primary one. `onDanger` on `danger` ≈ 5.8:1; Brick text on `bg` ≈ 4.6:1 (use it at ≥15px for links).
- Contrast: `text` on `bg` ≈ 15:1, on `surface` ≈ 13.6:1, on `chambray` ≈ 9.8:1; `textMuted` on `bg` ≈ 7.0:1, on `surface` ≈ 6.3:1. Chartreuse never carries text.

### 4.C Paper grain

One full-bleed overlay as the **top** layer of every screen, pointer-events none:

```html
<svg class="grain" width="100%" height="100%" style="position:fixed;inset:0;mix-blend-mode:multiply;opacity:.08;pointer-events:none">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <rect width="100%" height="100%" filter="url(#grain)" fill="#000"/>
</svg>
```

Mobile (React Native) uses a pre-rendered tiling noise PNG at the same strength (multiply, 8%).

### 4.D Typography (v4)

Families are unchanged: Instrument Serif, Geist, Geist Mono. Upright only, no italics, and no coloured or italic accent words in headlines.

| Role | Desktop | Mobile | Family |
|---|---|---|---|
| Sign-in hero ("Meet Morrow.") | 128 / 120, −0.02em | 56 / 56 | Serif |
| Page hero (Today headline, Forget question) | 88–104 / 1.0, −0.02em | 46 / 48 | Serif |
| Page title (Prophecies, Past readings, Sources…) | 80 / 80 | 52 / 52 | Serif |
| Prophecy statement | 24–28 / 32–34 | 20–22 / 27–28 | Serif |
| List rows (resolved, archive) | 22–24 / 30 | 20–22 / 27 | Serif |
| Wordmark "Morrow" | 30 / 36, −0.01em | 24 / 30 | Serif |
| Chat bubble text, body | 16 / 24 | 15–16 / 22–24 | Geist 400 |
| Nav items | 15 / 18 (active 500 Oxblood, inactive 400 Capers) | — | Geist |
| Meta (times, dates, likelihood, `n of 15 today`) | 12 / 16 | 12 / 16 | Geist Mono |
| Labels (`Prophecy`, `Watching · 3 open`, `Resolved · 9`, day dividers, status labels) | 12–13 / 16, sentence case, 0 tracking | same | Geist 400 Capers (`Prophecy` 500 Oxblood) |

**No uppercase anywhere** (2026-09-17 rule stands): labels are sentence-case Geist; Geist Mono is only for numerals (times, `09.30` dates, counts, likelihood, `n of 15 today`). The one exception is the literal word `FORGET` the user types to confirm deletion.

### 4.E Signature graphics

All masters live in the study board `7IA-0`, section "Scale". Export them from Paper as SVG and ship them as components; don't redraw.

**Crystal ball — Morrow's mark.**
- **Form:** a complete globe, with an edge that is always darker than the ground (never fades out).
- **Paint** (`viewBox 0 0 200 200`):
  - clip to a circle of r=84;
  - radial fill centred at (66,63), r=134: stops `#EEF1F2` 0, `#E1E6E6` .14, `#A9C0CB` .42, `#7F97A3` .72, `#62798A` 1;
  - a second radial at the centre, r=84, darkening the outer 28% to `#62798A` at 50%;
  - both fills pass through a grain displacement (`feTurbulence` baseFrequency .9, numOctaves 2 + `feDisplacementMap` scale 7);
  - a soft highlight ellipse (72,66, 22×15) in white at 35%, blurred σ7, inside the clip;
  - a closing rim of `#5E7482` at 45%, stroke width scaled so it renders about 1px (0.75px at ≤32px).
- **Sizes:**
  - wordmark 16–19px (fill and rim only);
  - chat avatar 28–32px;
  - greeting/rail 56–72px, which may carry 1–3 tiny crisp glints.
- **Limits:** no stand, reflection, halo or glow. At most one ball larger than an avatar per screen.
- **Motion states** (web board `3R8-0`):
  - `idle`: slightly lower contrast.
  - `listening`: lighter, wider core.
  - `reading`: glints drift and orbit.
  - `speaking`: scale 1.1 with the deepest edge.
  - All loops respect `prefers-reduced-motion`.
- **Masters:**

| Size | Node |
|---|---|
| wordmark 19px | `BQY-0` |
| avatar 38px | `BR3-0` |
| large 76px | `BOJ-0` |
| idle | `BTT-0` |
| listening | `BUB-0` |
| reading | `BV3-0` (+ star overlay) |
| speaking | `BVO-0` |

**Body figure — the only illustration.**
- **Form:** a realistic front-facing standing woman (arms slightly away from the body, open palms, feet together).
  - silhouette: flat Oxblood;
  - aura: five continuous Chambray tone-step bands that follow the body shape, strongest nearest it, with grain-roughened edges;
  - chakra points: seven small Chartreuse dots on the centre line (crown → root).
- **Treatment:** no frame, arch or card around it; it sits directly on the paper.
- **Where it appears:**

| Screen | Desktop | Mobile |
|---|---|---|
| Sign in | right half, ~440px tall | above the headline, ~180–200px |
| Chat screens (Reading, Asking, Answer) | right column in the former rail slot, ~300px, same position on all three, fixed while the thread scrolls; caption = the reading's date (`Wednesday · September 30`) | — (not shown on mobile chat) |
| Prophecies | top of the left column, ~280px | beside the title, ~120–150px |

- **Nowhere else.** It is not used on Today, Prophecy fulfilled, the archive, account screens or Forget.
- **Masters:** web `AZQ-0` (on `AXP-0`), mobile figure in `7IA-0` Scale.

**Moon-phase glyph — likelihood as a moon.**
- **Form:** 20px (18px mobile), Oxblood line 1.25–1.5px with light grain.
- **Phase mapping:** the lit fraction tracks likelihood (≈.25 crescent, ≈.5 half, ≈.75 gibbous, 1 full). Phases are exaggerated so neighbouring values stay distinguishable at 20px, but the order is always correct.
- **Resolved states:** fulfilled = filled full moon; expired/missed = outline new moon.
- **Used on:**
  - the inline prophecy card, before the `PROPHECY` label;
  - open prophecy cards (top-left);
  - resolved-list status, replacing plain dots.

**Removed from the system:**
- the orbit diagram;
- palm, eye, moon and sun decorative icons;
- source glyph tiles (`CA`, `SP`, …);
- section icons (Dossier);
- roman numerals;
- the arch frame;
- light rays, halftone bursts and clouds.

Functional UI icons stay: send, stop, back, close, menu, lock, check, the Google "G".

### 4.F Layout & components (v4)

- **Desktop frame:** 1440 wide; nav bar 88px high, padding-inline 48, `hairline` bottom border.
  - Left: the wordmark (ball + "Morrow").
  - Right: Today · Readings · Prophecies · Sources.
  - No status text: time and source counts are gone.
  - Content column 1088 wide (x 176–1264) on non-chat screens.
- **Mobile frame:** 390 wide, 24px side margin, dark-on-light status bar.
  - Header: wordmark on the left, menu (or back/close) on the right; chat header adds the 32px ball and "Morrow".
  - Screens may grow past 844 tall; content is never squeezed.
- **Chat layout:**
  - **Thread column:** 760 wide (desktop, x 216–976), with the figure column to the right; on mobile, full width inside the margins.
  - **Fixed frame (web):** chat screens fill the viewport and the page itself never scrolls. The nav (sticky on every page), the figure column and the composer stay fixed; only the thread scrolls, anchored to the newest message.
  - **Day divider:** sentence-case Geist label (`Monday · September 21`) between two hairlines. When the desktop figure column is showing, the date moves under the body figure as its caption and the divider is hidden; the divider remains below `lg` and on the Prophecy fulfilled view (data rail, no figure).
  - **User bubble:** Chambray, radius 20/20/6/20, padding 12×18, max-width 520 desktop / 280 mobile.
  - **Morrow message:** 28–32px ball avatar + name (Geist 500) + mono time.
    - Bubble: `surface` + hairline border, radius 6/20/20/20, padding 12×18, max-width 600.
    - Consecutive Morrow bubbles group under one avatar.
  - **Thinking state (Asking):** a small Morrow bubble with three typing dots (one Chartreuse, two Capers) and "Morrow is reading…". No source steps.
  - **Composer:**
    - Container: `surface` + hairline, radius 32, height 64 desktop.
    - Inner: text + caret, mono `n of 15 today` (`n/15` mobile), 44px round Oxblood send.
    - Waiting state: Oxblood outline stop button.
    - Sealed state: dashed bar with lock + "Today's reading →".
    - No source chips.
- **Prophecy card:**
  - Container: `surface` + hairline, radius 14, padding 18/24/20.
  - Header row: moon glyph + `Prophecy` (Geist 500, Oxblood) + mono window `09.16 → 10.07`.
  - Body: serif statement.
  - Footer: `Likelihood` bar (Oxblood fill on hairline track) + mono value, plus the optional footer line "I'll tell you when it lands."
- **Lists:** hairline-divided rows, with no leading numbers or icons.
  - Status on the right: sentence-case Geist label + moon glyph.
  - Expired rows use `textMuted` for the statement.
- **Buttons:**
  - Primary: Oxblood fill, Parcel text, pill (radius 28), height 56.
  - Secondary: Oxblood 1px outline.
  - Links: Oxblood text.
- **Record strip (Prophecies):** 12 marks — filled Oxblood dot (fulfilled), dash (expired), hollow (open). It stays because it is data.

### 4.G Per-screen notes (v4)

| # | Screen | Notes |
|---|---|---|
| 01 | Sign in | Hero + sub copy + Google button (Oxblood) + privacy note; figure right; footer facts row (Raw events kept 24 hours · Never read Health · money · Forget everything Anytime · Terms · Privacy). |
| 02 | Connect accounts | Title "What may Morrow read?"; three steps as hairline rows (current in Oxblood); each source as a section with name, Reads / Never columns, `Linked` pill (Chartreuse dot) or outline `Connect`; Instagram under "Later". No letter tiles. |
| 03 | Today (Invocation) | Mono date, hero headline, 64–72px ball beside the greeting, three plain suggestion rows (no icons, no numerals), composer. No figure. |
| 04 | Reading | Chat: day divider → user "Draw today's reading." → Morrow message + inline prophecy card; desktop figure column with the date as caption (no figure on mobile). |
| 05 | Asking | Chat with thinking bubble; composer in waiting state; desktop figure column. |
| 06 | Answer | Chat with the answer bubbles; composer typing; desktop figure column. |
| 07 | Prophecy fulfilled | Chat announcing the landed prophecy (card shows a Chartreuse `Landed 09.30` row); follow-up prompts as plain pills; the data rail (Foretold / Fulfilled / Record) may stay. |
| 08 | Menu (mobile) | Serif menu items with hairlines; Today in Oxblood with a Chartreuse "Open" dot; counts in mono (no source count); questions card (`3 / 15`, "Seals at dawn · 04:00"); profile row. |
| 09 | Past readings | Title + counts left; hairline archive table right with status labels. |
| 10 | Sealed reading | Chat, read-only; sealed composer bar. |
| 11 | Prophecies | Figure + title + description + counts + record strip left; open cards with moon glyphs right; resolved list below. |
| 12 | Sources | Account screen — source rows with status (Chartreuse dot for linked), retention rows, View dossier / Forget everything links. |
| 13 | Dossier | Account screen — Readable / Raw JSON switch, Rhythms / People / Patterns groups (no section icons); facts may cite their source. |
| 14 | Forget everything | Hero question, list of what gets deleted, `FORGET` confirm field (danger border), Brick "Forget everything", outline "Keep everything", "Download a copy first". |

### 4.H Implementation map (branch `redesign/v4-parcel`)

**Shared:** `@morrow/tokens` exports the v4 `colors`, `ball`, `grain`, `typeScale` (incl. `hero`, `wordmark`), `radii` (`bubble`, `bubbleTail`, `card`, `composer`, `button`, `dot`) and `space`; `tokens.css` emits the matching `--color-*` / `--radius-*` variables.

**Web (`apps/web`):**
- **Tailwind:** `app/globals.css` maps the tokens to utilities.
  - Colours: `bg-surface`, `text-text-muted`, `border-hairline`, `bg-accent text-on-accent`, `bg-danger text-on-danger`, …
  - Radii: `rounded-bubble|bubble-tail|card|composer|button|dot`.
  - Type: `text-hero|display|title|confirm|prophecy|list-item|row|wordmark|body-lg|body|label`, each with a `-m` mobile variant used as `text-X-m lg:text-X`.
  - Mono and label helpers: `text-meta` is 12/16 for mono numerals; `label` / `label-sm` are Geist 13/16 and 12/16.
- **Components:**

| Component | Role |
|---|---|
| `Grain` | mounted once in `app/layout.tsx` |
| `CrystalBall` | `{ size, variant?, state?, label? }`; unique SVG ids via `useId`; motion states in CSS, off under reduced motion |
| `BodyFigure` | `{ height }` |
| `MoonGlyph` | `{ likelihood? \| status?, size? }` |
| `chat/MessageRow` | `UserMessage`, `MorrowMessage`, `MorrowBubble` |
| `chat/DayDivider` | |
| `chat/TypingBubble` | |
| `Composer` | `count` → `n of 15 today`; idle / typing / waiting / sealed states |
| `Prophecy` | `ProphecyPanel` (inline), `ProphecyCard` (list), `ResolvedRow`, `Likelihood`, `WindowBar` |
| `Labels` | |
| `RecordMarks` | |
| `IndexList` | |
| `ui/Button` | variants `primary`, `secondary`, `danger`, `danger-outline`, `link`, `danger-link` |
| `TopBar` / `Nav` / `Wordmark` / `UserMenu` | 88px nav, no status text |

- **Retired:** `Orbit`, `ReadingSteps`.
- **Hidden `data-step` parts:** the chat client ignores them for rendering; the stream is unchanged.
- **Demo preview:** `.claude/launch.json` → `web-demo` (port 3001, DB and AI keys cleared).

**Mobile (`apps/mobile`):**
- **Theme:** `useTheme()` returns `{ palette, ball, grain }`; `@/theme/ink` holds extra Black Fig alphas (`dashed` .28, `outline` .24, `track` .12).
- **Text:** `Txt` variants follow the type tokens, plus `meta` (Geist Mono 12/16, numerals only).
- **Components:**

| Component | Role |
|---|---|
| `Grain` | a tiled `assets/grain.png` built by `scripts/make-grain.mjs`, rendered at ≈5% to equal the web's 8% multiply |
| `CrystalBall` | react-native-svg; no grain displacement or blur, so the highlight is a fading radial |
| `BodyFigure` | |
| `MoonGlyph` | |
| `Header`, `ChatHeader` | |
| `chat/MessageRow`, `chat/DayDivider`, `chat/TypingBubble` | |
| `Composer` | `dock: 'chat' \| 'page'` |
| `ProphecyCard`, `ProphecyRow`, `LikelihoodBar` | |
| `Button` | |
| `Page` | |
| `ConfirmInput` | Brick border and caret |
| `RecordMarks` | |

- **Menu:** presented as `containedModal` so the root grain covers it.
- **Mobile metrics from Paper:**

| Element | Value |
|---|---|
| chat gutter | 16 |
| bubble padding | 11×16 |
| bubble max width | 296 user / 282 Morrow |
| composer buttons | 40 |
| card radius | 16 |
| button radius | 14 |
| day divider | centred label, no hairlines |
| chat status line | Geist |

<details><summary>v2 "Deep field" (superseded, still in code)</summary>

Minimal sci-fi. Cool lab grey space, one aurora-green accent, coral reserved for destructive actions only. Light only — there is no dark theme. Off-centre layouts on desktop; a line-drawn **orbit diagram** represents Morrow.

### 4.1 Color tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#F3F4F6` | page background |
| `panel` | `#FFFFFF` | composer, cards, panels |
| `subtle` | `#E6E8EC` | toggles, track fills, stop button |
| `hairline` | `#DDE0E5` | dividers, borders |
| `hairlineStrong` | `#C9CDD4` | glyph boxes, dashed borders, secondary buttons |
| `orbitFaint` | `#E1E3E7` | outer orbit ring |
| `orbitLine` | `#C9CDD4` | orbit ellipses |
| `tick` | `#BFC3CA` | orbit ticks, core outline |
| `textFaint` | `#B5B9C0` | pending/disabled text, empty status "—" |
| `textMuted` | `#6E737D` | mono labels, meta |
| `placeholder` | `#8A8F98` | input placeholder |
| `textSecondary` | `#4E535B` | body copy, explanations |
| `textPrimary` | `#16181C` | headings, primary text |
| `accent` | `#2F8A6C` | Morrow's voice labels, dots, fulfilled, progress |
| `accentFill` | `#BFE8D8` | send / primary buttons |
| `onAccent` | `#16181C` | text/icon on `accentFill` |
| `danger` | `#B8574A` | Forget everything only |
| `onDanger` | `#FFFFFF` | text on `danger` |

Transparent variants used in designs: accent border `rgba(47,138,108,0.45)`; danger border `rgba(184,87,74,0.5)`.

### 4.2 Typography

Three families, each with one job. **No italics anywhere.**

**Labels are sentence case, set in Geist.** Mono is reserved for numerals — times, `09.30` dates, counts, likelihood values. There is no uppercase text in the UI, and no zero-padded display numbers (`7`, never `07`); the one exception is the literal word `FORGET` the user types to confirm deletion. Headlines carry no eyebrow/kicker label above them.

| Role | Family | Weight | Notes |
|---|---|---|---|
| Morrow's voice, titles, list items | **Instrument Serif** | 400 | letter-spacing −0.01 to −0.015em on large sizes |
| UI, body, user messages, small labels | **Geist** | 400 / 500 | labels are sentence case, letter-spacing 0 |
| Data: timestamps, `09.30` dates, counts, likelihoods | **Geist Mono** | 400 | numerals only, letter-spacing 0 |

| Scale token | Desktop | Mobile |
|---|---|---|
| `display` (hero) | 76 / 76 | 46 / 46 |
| `title` (page titles) | 68 / 68 | 46 / 46 |
| `confirm` (forget question) | 60 / 62 | 42 / 44 |
| `answer` (observation / answer) | 42 / 46 | 32 / 35 |
| `prophecy` | 28 / 34 | 23 / 28 |
| `listItem` | 24 / 30 | 22 / 27 |
| `row` (dossier/resolved rows) | 21 / 26 | 19 / 24 |
| `bodyLg` (user message) | 18 / 28 | 16 / 24 |
| `body` | 15–16 / 24 | 14–15 / 21–23 |
| `label` (sans, sentence case) | 12 / 16 | 12 / 14 |

### 4.3 Shape & spacing

| Token | Value |
|---|---|
| `radius.panel` | 16 (composer, prophecy panel) |
| `radius.card` | 14 (prophecy cards, delete list, menu status) |
| `radius.button` | 10 (send, primary buttons) |
| `radius.glyph` | 9–10 (source glyph boxes) |
| `radius.dot` | 999 |
| Desktop content gutter | 120px left/right; top bar padding 28 / 48 |
| Desktop columns | left column 340–600px, right column starts at x=560, width 760 |
| Mobile gutter | 24px; composer inset 16px, 30px above home indicator |

### 4.4 Signature components

- **Orbit** — SVG, `viewBox 0 0 660 660`: outer ring r=260, dashed ring r=170, two tilted ellipses (rx310/ry92 rot −18°, rx250/ry64 rot 34°), crosshair ticks, core r=58 with accent glow and centre dot, source nodes on the ellipses. States: `idle`, `reading` (dashed ring accent), `fulfilled` (matching ellipse + core stroke accent, larger glow), `sealed` (55–60% opacity, no accent). Small variants: header mini-orbit (26px), forget screen (dashed, fading).
- **Composer** — states `idle` (placeholder), `typing` (accent border + caret, send enabled), `waiting` ("Morrow is reading…", stop button), `sealed` (dashed border, lock icon, "Today's reading →" button). Shows `n of 15 today` (desktop) / `n/15` (mobile).
- **Turn labels** — sans `You — 06:51` (muted) and `● Morrow — 06:52` (accent).
- **Prophecy panel/card** — `Prophecy` + window (no serial number), serif statement, window bar (start → end with elapsed fill), `Likelihood 0.71`.
- **Reading steps** — left-bordered list: `✓ done`, `◌ active` (accent), `· pending` (faint).
- **Index list** — label rows with hairline dividers (no number column).
- **Record marks** — 12 marks: filled dot (fulfilled), dash (expired), hollow (open).

</details>

## 5. Architecture

```
morrow/
├─ apps/
│  ├─ web/        Next.js 16 (App Router) — web UI + all API routes + cron jobs
│  └─ mobile/     Expo (SDK 54+) + Expo Router — iOS/Android client of the web API
├─ packages/
│  ├─ tokens/     design tokens (TS objects + generated CSS variables)
│  └─ core/       shared zod schemas, types, domain rules, fixtures, API client
├─ SPEC.md
└─ turbo.json, pnpm-workspace.yaml
```

### 5.1 Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) |
| Web | Next.js 16 App Router, React 19, Tailwind CSS v4, `next/font/google` |
| Mobile | Expo + Expo Router, `react-native-svg`, `@expo-google-fonts/*`, `useColorScheme` |
| LLM | Vercel AI SDK (latest) via **Vercel AI Gateway** (model strings like `anthropic/claude-sonnet-5`) |
| Models | Readings & chat: **Claude Sonnet 5**. Extraction, summaries, classification: **Claude Haiku 4.5** |
| Validation | zod (shared schemas are also the LLM structured-output schemas) |
| Database | Postgres (Neon via Vercel Marketplace) + Drizzle ORM. In-memory fixture repository when `DATABASE_URL` is unset |
| Auth | Demo single user in scaffold → Better Auth (Google sign-in) |
| Integrations | Google Calendar, Spotify Web API, Gmail (restricted scopes → needs Google CASA review before public launch), Instagram (future) |
| Jobs | Vercel Cron → `/api/cron/dawn` (seal + summarize + create + open reading) and `/api/cron/verify` (prophecy verification) |
| Hosting | Vercel (web/API), EAS (mobile builds) |

### 5.2 Pipeline

```
sources ──OAuth──▶ sync (cron) ──▶ raw events (TTL 24h)
                                      │ deterministic extractors (no LLM)
                                      ▼
                               Dossier (facts + inferred patterns, ~3 KB)
                                      │
        ┌─────────────────────────────┼───────────────────────────┐
        ▼                             ▼                           ▼
  Dawn job (Sonnet 5)           Chat (Sonnet 5)             Verify job
  structured DailyReading       tools over dossier          checkCondition vs new events
  → opening message +           streaming, 15-turn limit    → fulfilled / expired
    prophecy                                                  → attach to today's reading
```

LLM never sees raw emails/events — only the dossier.

### 5.3 Data model (Postgres)

```sql
users        (id, name, timezone, created_at)
sources      (id, user_id, kind, status, access_token_enc, refresh_token_enc, last_synced_at, stats jsonb)
raw_events   (id, user_id, source_kind, occurred_at, payload jsonb, expires_at)          -- TTL 24h
dossiers     (user_id pk, facts jsonb, patterns jsonb, size_bytes, rebuilt_at)
readings     (id, user_id, local_date, timezone, status, summary, question_count, opened_at, sealed_at,
              unique(user_id, local_date))
messages     (id, reading_id, role, parts jsonb, created_at)
prophecies   (id, user_id, number, made_in_reading_id, fulfilled_in_reading_id, statement,
              check_condition jsonb, window_start, window_end, likelihood, watching text[], status, resolved_at)
```

## 6. Shared package contracts

These names are the integration contract between `packages/*`, `apps/web`, and `apps/mobile`. Do not rename without updating this section.

### 6.1 `@morrow/tokens`

```ts
export type Palette = { bg; panel; subtle; hairline; hairlineStrong; orbitFaint; orbitLine; tick;
  textFaint; textMuted; placeholder; textSecondary; textPrimary; accent; accentFill; onAccent;
  danger; onDanger: string };
export const colors: Palette;
export const alphaColors: { accentBorder: string; dangerBorder: string };
export const fonts: { serif: 'Instrument Serif'; sans: 'Geist'; mono: 'Geist Mono' };
export type TypeToken = 'display' | 'title' | 'confirm' | 'answer' | 'prophecy' | 'listItem' | 'row' | 'bodyLg' | 'body' | 'label';
export type TypeStyle = { size: number; lineHeight: number; letterSpacing?: number };
export const typeScale: { desktop: Record<TypeToken, TypeStyle>; mobile: Record<TypeToken, TypeStyle> };
export const radii: { panel: 16; card: 14; button: 10; glyph: 10; dot: 999 };
export const space: { gutterDesktop: 120; gutterMobile: 24; composerInsetMobile: 16 };
```
- `size`/`lineHeight` are px (upper value where §4.2 gives a range). **`letterSpacing` is in em** — multiply by `size` for React Native px.

**v4 palette (implemented on `redesign/v4-parcel`; replaces `Palette` above):**

```ts
export type Palette = {
  bg: '#E5E3DA'; surface: '#DAD7CB'; hairline: 'rgba(41,16,12,0.14)';
  text: '#29100C'; textMuted: '#53461C';
  accent: '#5A1D22'; onAccent: '#E5E3DA';
  chambray: '#A9C0CB'; onChambray: '#29100C';
  highlight: '#BFB065';
  danger: '#A3372A'; onDanger: '#F4EFE6'; dangerBorder: 'rgba(163,55,42,0.55)';
};
export const ball: { stops: ['#EEF1F2', '#E1E6E6', '#A9C0CB', '#7F97A3', '#62798A']; rim: 'rgba(94,116,130,0.45)' };
export const grain: { baseFrequency: 0.85; numOctaves: 2; opacity: 0.08; blend: 'multiply' };
export const radii: { bubble: 20; bubbleTail: 6; card: 14; composer: 32; button: 28; dot: 999 };
```
- Removed in v4: `panel`, `subtle`, `hairlineStrong`, `orbitFaint`, `orbitLine`, `tick`, `textFaint`, `placeholder`, `textSecondary`, `accentFill`, `alphaColors` (`danger`/`onDanger` stay with new values, plus `dangerBorder`). `tokens.css` keeps the `--color-<token>` naming (e.g. `--color-text-muted`, `--color-chambray`).
- `typeScale` gains `hero` (sign-in 128/56); `label` stays sentence-case Geist 12–13; `answer` (42/46 serif) is retired because Morrow's replies render as bubble body text.
- Package points `main`/`types`/`exports` at `src/index.ts` (no build step).

Also ships `@morrow/tokens/tokens.css` (generated by `pnpm --filter @morrow/tokens build:css`, committed): `--color-<token>` in kebab-case (e.g. `--color-text-primary`, plus `--color-accent-border`, `--color-danger-border`), `--font-serif|sans|mono`, `--radius-panel|card|button|glyph|dot`. All values sit on `:root` (`color-scheme: light`); there is no theme switching.

### 6.2 `@morrow/core`

Single entry `@morrow/core` (source TS, no build). zod 4. Schemas and their inferred types share the same name (`Reading` is both a zod schema and a type).

- **Constants:** `QUESTION_LIMIT = 15`, `DAY_CUTOFF_HOUR = 4`, `RAW_EVENT_TTL_HOURS = 24`, `TABOO_TOPICS` (`health | pregnancy | death | money_stress | relationship_breakdown`), type `TabooTopic`.
- **Domain:**
  - `getReadingDate(now: Date, timeZone: string, cutoffHour = 4): string` (`YYYY-MM-DD`, DST-safe via `Intl.DateTimeFormat`)
  - `isReadingOpen(reading, now): boolean` (status `open` and `now` is still in its reading day)
  - `questionsLeft(reading): number` (≥ 0)
  - `windowProgress(prophecy, now): number` (0–1; freezes at `resolvedAt` once resolved)
  - helpers: `getLocalParts(instant, tz)`, `addDays(date, n)`, `formatShortDate('2026-09-16') → '09.16'`, `formatLocalTime(iso, tz) → '06:43'`, `formatProphecyNumber(47) → '0047'`, `prophecyRecord(prophecies, limit = 12) → { fulfilled, open, expired, marks }`
- **Schemas (zod) + inferred types:**
  - `LocalDate` (`YYYY-MM-DD`), `IsoDateTime` (ISO with offset or Z). All timestamps are ISO strings.
  - `User { id, name, timezone }`
  - `SourceKind` = `calendar | spotify | mail | instagram`; `SourceStatus` = `linked | not_linked | error`
  - `Source { kind, name, provider, status, reads, stat: {value, label} | null, watchingCount, lastSyncedAt | null }`
  - `ReadingStatus` = `open | sealed`; `Reading { id ("r_YYYY-MM-DD"), localDate, timezone, status, headline (first observation line), prophecyId | null (made in this reading), summary | null, questionCount, openedAt, sealedAt | null }`; `ReadingSummary { readingId, localDate, summary }`
  - `MessagePart` (discriminated on `type`): `text {text}` | `observation {text, evidenceRef, sourceLabel}` | `prophecyRef {prophecyId, event: 'made' | 'fulfilled'}` | `steps {items: ReadingStep[]}`; `ReadingStep { label, source?, status: 'done' | 'active' | 'pending' }`. Individual part schemas: `TextPart`, `ObservationPart`, `ProphecyRefPart`, `StepsPart`.
  - `MessageRole` = `user | assistant` (assistant = Morrow); `Message { id, readingId, role, parts, createdAt }`
  - `CheckCondition` (discriminated on `type`): `email_from_contact {contact, firstInThread}` | `calendar_event_with {contact, titleIncludes | null}` | `listening_pattern {pattern}` | `generic {description}`
  - `ProphecyStatus` = `open | fulfilled | expired`; `Prophecy { id ("p_0047"), number, statement, title (short, for lists), checkCondition, windowStart, windowEnd, likelihood, watching: SourceKind[], status, madeOn (LocalDate), madeInReadingId, fulfilledInReadingId | null, resolvedAt | null }`
  - `DossierCategory` = `rhythms | pursuits | people | places | tastes`; `DossierFact { id, category, label (natural case, rendered as-is), value, sources }`; `DossierPattern { id, statement, confidence, sources }`; `Dossier { userId, sizeBytes, rebuiltAt, facts, patterns }`
- **LLM output schemas:** `DailyReadingOutput` `{ observation: {text, evidenceRef, sourceLabel}, prophecy: {statement, checkCondition, windowDays (1–60), likelihood, watching (≥1)} }`.
- **API types (zod schemas + types):**
  - `TodayResponse { user, now, reading, messages, prophecies (all referenced by messages), questionLimit, questionsLeft }`
  - `ReadingsResponse { readings (newest first), total }`
  - `ReadingDetailResponse { reading, messages, prophecies }`
  - `ProphecyListResponse { open, resolved (both newest first), record: { fulfilled, open, expired, marks: ProphecyStatus[] (last 12, oldest→newest) } }`
  - `SourcesResponse { sources, dossier: { sizeBytes, rebuiltAt, factCount } }`
  - `DossierResponse { dossier }`, `ForgetRequest { confirm: 'FORGET' }`, `OkResponse { ok: true }`, `ConnectSourceResponse { kind, authorizeUrl | null }`
  - Errors: non-2xx bodies are `ApiErrorBody { error: { code: ApiErrorCode, message } }`; `ApiErrorCode` = `reading_sealed | question_limit | bad_request | unauthorized | not_found | server_error | network_error | unknown`.
- **Client:** `createApiClient({ baseUrl, fetch?, headers? })` → `getToday()`, `getReadings()`, `getReading(date)`, `getProphecies()`, `getSources()`, `getDossier()`, `forgetFact(id)`, `forgetEverything()`, `connectSource(kind)`, `disconnectSource(kind)`, `chatUrl`. Throws `ApiError { status, code }` (`isApiError(e)`); 409 → `reading_sealed`, 429 → `question_limit`, other statuses use the body code if valid, else a status-based code; fetch failures → status 0 `network_error`. Chat uses the AI SDK UI message stream at `POST /api/chat` (`chatUrl`).
- **Fixtures:** `FIXTURE_NOW` (Date), `FIXTURE_NOW_ISO` (`2026-09-30T09:12:00-07:00`), `FIXTURE_TIMEZONE`, `FIXTURE_READINGS_TOTAL` (23), and `fixtures` — the canonical demo story (user **Iris**, tz `America/Los_Angeles`):
  - `fixtures.readings` (newest first): 09.30 (open, today), 09.28, 09.27, 09.24, 09.22, 09.19, 09.16; `fixtures.readingSummaries`
  - `fixtures.messages` keyed by reading id — full 09.16 transcript (2 questions) and the 09.30 opening (observation "Sam wrote first.", 0047 fulfilled announcement, 0052 made); other readings have a single opening message
  - `fixtures.prophecies` **0041–0052** ordered by number (record 7 fulfilled / 3 open / 2 expired = 12 marks); 0047 "Sam will write first." fulfilled 09.30
  - `fixtures.sources` (Calendar/Spotify/Mail linked, Instagram not linked), `fixtures.dossier` (rhythms, people, 2 inferred patterns), `fixtures.askingSteps` (example `steps` part for screen 06)
  - `fixtures.api` — ready-made response bodies: `today`, `readings`, `readingDetails[localDate]`, `prophecies`, `sources`, `dossier`. All parse with their schemas (tested).

## 7. Web API (apps/web)

| Method & path | Purpose |
|---|---|
| `GET /api/today` | get-or-create today's reading → `TodayResponse` |
| `POST /api/chat` | streaming chat turn; `409` if sealed, `429` if 15 questions used |
| `GET /api/readings` · `GET /api/readings/[date]` | archive list · sealed transcript |
| `GET /api/prophecies` | open + resolved |
| `GET /api/sources` · `POST /api/sources/[kind]/connect` · `DELETE /api/sources/[kind]` | sources (connect is an OAuth stub) |
| `GET /api/dossier` · `DELETE /api/dossier/facts/[id]` | dossier · forget one fact |
| `POST /api/forget` | body `{ confirm: "FORGET" }` → deletes everything |
| `GET /api/cron/dawn` · `GET /api/cron/verify` | protected by `CRON_SECRET` |

**Env:** `AI_GATEWAY_API_KEY` (or Vercel OIDC), `DATABASE_URL`, `CRON_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `SPOTIFY_CLIENT_ID/SECRET`, `TOKEN_ENCRYPTION_KEY`. **Demo mode:** with no AI key and no DB, the app runs fully on fixtures and scripted Morrow responses.

## 8. Roadmap

1. ✅ Design (Paper, v2 light, desktop/mobile)
2. ⏳ Scaffold: monorepo, tokens, core, web + mobile screens on fixtures, API contracts, demo mode
3. Provision Neon + AI Gateway on Vercel; replace demo user with Better Auth
4. Google Calendar + Spotify OAuth and extractors → real dossier
5. ✅ Dawn + verify cron jobs; ✅ evals + red team in CI (§13)
6. Gmail (CASA review), push notifications for fulfilled prophecies (Expo)
7. Not yet designed: goodbye screen after Forget, raw JSON dossier view, settings
8. ⏳ Implement design v4 "Parcel" (§4) on web and mobile — done on `redesign/v4-parcel`; remaining: device QA on mobile, touch access to hover-only actions (Dossier "Forget this ×", Sources disconnect on web), merge:
   - swap tokens (§6.1 v4 palette);
   - add the grain overlay;
   - ship the ball, figure and moon-glyph components exported from Paper;
   - convert Morrow's turns to chat bubbles;
   - stop rendering sources, numerals and decorative icons.

## 9. Changelog

### 2026-09-16
- **Concept:** fortune teller as "hot reading"; grounded observations + self-verifying prophecies; progressive permissions; taboo list.
- **Design v1 "Dawn fog":** Cormorant Garamond italic, lavender + brass. Superseded.
- **Co-Star-inspired revision:** Gilda Display + DM Mono, monochrome. Rejected as too derivative.
- **Design v2 "Deep field" (current):** Instrument Serif + Geist + Geist Mono, off-centre layout, orbit diagram, numbered index lists, aurora accent. Added light mode and mobile.
- **Product rule:** one reading per day, 04:00 local boundary, sealed history, 15-question limit (confirmed).
- **Naming:** data connections renamed **Threads → Sources**; conversations are **readings**; nav gained **Today**.
- **Screens added:** past readings, sealed reading, asking, answer, mobile menu, prophecies, sources, dossier, forget everything. Coral `danger` color introduced for destructive flow only.
- **Engineering:** §6 contracts made concrete while scaffolding `packages/tokens` + `packages/core` (field names, `prophecyRef.event`, `MessageRole` = `user | assistant`, em letter-spacing, fixtures 0041–0052 so the record totals 12, extra client methods `connectSource`/`disconnectSource`).
- **Engineering:** stack chosen (Next.js + Expo monorepo, AI SDK + AI Gateway, Claude Sonnet 5 / Haiku 4.5, Postgres + Drizzle); repo scaffolded at `~/morrow`.
- **Web scaffold (`apps/web`):** Next.js 16 + Tailwind v4 screens 01–07, 09–12 on the shared tokens; API routes per §7/§10 over a `Repository` (fixtures in memory, or Postgres/Drizzle with `DATABASE_URL`); AI Gateway models `anthropic/claude-sonnet-5` / `anthropic/claude-haiku-4.5` with a scripted demo stream; dawn (hourly) + verify (30 min) crons; deterministic extractors. `/api/chat` also accepts an optional `readingId` (stale → 409).
- **Mobile scaffold (`apps/mobile`):** Expo SDK 57 + Expo Router (TS strict, scheme `morrow`), screens 01–12 incl. 08 menu modal on the shared tokens/core; TanStack Query over `createApiClient` with automatic fallback to `fixtures.api` (faint `DEMO` label) when the API is unreachable; `useChat` + `DefaultChatTransport` over `expo/fetch` sending the last message + `readingId`, with an on-device scripted stream offline.
- **Web v0.2 real data (`apps/web`):** Better Auth 1.7 at `/api/auth` (Google sign-in `openid email profile`, Drizzle adapter, `encryptOAuthTokens`, `@better-auth/expo`, `trustedOrigins` `morrow://` + dev `exp://`; user `timezone`/`onboardedAt`); sources linked with `linkSocial` (scopes enforced server-side: Calendar `calendar.readonly` offline+consent onto the sign-in Google account, Spotify recently-played + top-read); Next 16 `proxy.ts` + page/route guards (401 `unauthorized`); new `GET /api/me`, `POST /api/me/timezone`, `POST /api/onboarding/complete` (→ `TodayResponse`), connect returns `{ kind, url, authorizeUrl }`; screens 13/14 + first-reading orbit state, avatar sign-out; migration `0001_auth_sources_aggregates` (auth tables, source sync state, `dossiers.aggregates`); Calendar/Spotify clients, hourly `/api/cron/sync` + on-connect `after()` sync, incremental aggregates → deterministic facts + Haiku patterns; grounded Sonnet readings (evidenceRef must exist → regenerate once → templated fact). Core (additive): `AccountUser`, `MeResponse`, `TimezoneRequest`, `ConnectSourceRequest`, `SOURCE_OAUTH`, `Source.syncState?/eventCount?`, `ConnectSourceResponse.url?`.
- **Web v0.2.1 first-real-run fixes (`apps/web`):** (1) timezone — Spotify aggregates now store plays per UTC hour (aggregates v2; v1 timezone-baked days dropped and refolded from raw events), local days/first activity/late nights derived at fact-build time; `POST /api/me/timezone` rebuilds the dossier on change; `TimezoneSync` posts whenever the browser zone differs; sign-in sets a short-lived `morrow_tz` cookie read by a Better Auth user-create hook. (2) Calendar reads every calendar in `calendarList` (skips Google-generated holiday/birthday/week-number and free/busy-only calendars, and 403/404 calendars), dedupes copies by iCalUID + start, and keeps other people's reader-only calendars out of rhythms (people only when the user attends); source shows `calendarCount` (core, additive). (3) Readings — facts phrased as parts of the day (no clock times/averages), new `tastes.new_in_rotation`, rewritten hot-reading prompt with good/bad examples, deterministic quality gate + Haiku judge with up to two retries, templated fallbacks rewritten to the same standard. Dev scripts `sources:resync`, `reading:redraw`.
- **Web v0.2.2 what the calendar is about (`apps/web`, core additive):** Calendar sync now reads event descriptions (plain text), locations and calendar names; aggregates keep them per event (`x`, `l`, `k`) plus `calendar.calendars`. New `pursuits` dossier category (core enum, web + mobile dossier screens) built from a cached Haiku classification; chat gets `searchCalendar` and answers future questions ("when will I…") with a grounded prophecy instead of refusing; readings prefer pursuits and may use `calendar_event_with { contact: "any", titleIncludes }` (verify no longer requires attendees for that form). Taboo filter also covers dentist/clinic/physio/psychiatry/check-up.
- **v0.3.3 quality (`apps/web`):** eval + red-team suites (§13) with `pnpm eval`, baselines committed, graders unit-tested; GitHub Actions runs typecheck, tests and build on push and PR. Gmail pacing found at run time after measuring the real ceiling (`gmail:probe`): start 10 gets/s, halve on refusal, creep back after 100 clean fetches; rate limits back off twice (8 s, 16 s) instead of five quick retries that spent quota on failures; first sync 180 messages over 14 days (~2 min) so it stays inside Vercel's 300 s function limit. Dev scripts: `chat:reset`, `sources:sync <kind>`, `sources:resync`, `reading:redraw`, `gmail:probe`.
- **v0.3.2 a reader never says a name (`apps/web`):** readings, prophecies and chat may not name people, companies or places — a presence, not a contact ("the one who keeps reaching first"); the reading gate rejects any draft naming a dossier contact or pursuit and the templated fallbacks were rewritten nameless. Counts in words ("three times", "twice") are rejected too. The dossier stays concrete (names, dates, counts are its evidence) but is written as sentences that carry meaning rather than rows of stats; one slot can no longer be both `rhythms.protected_time` and `rhythms.slipping_slot`.
- **v0.3.1 voice:** Morrow speaks as a psychic, not an analyst — the persona forbids reciting evidence (companies, events, dates, days, counts, schedules) in chat answers and readings; data stays in `sourceLabel` as proof; future questions get a felt horizon and a sign to watch for; prophecies promise exactly what their checkCondition observes (gate rejects outcome phrases, judge checks the core event). Readings page no longer draws today's reading; concurrent requests share one draw; Today streams a drawing state.
- **v0.3 Gmail (`apps/web`, `apps/mobile`, core additive):** Gmail is a connectable source (onboarding card on web + mobile, Sources row); `SOURCE_OAUTH.mail`, per-source `LINK_PARAMS`, Google scope enforcement per requested source; `lib/sources/gmail.ts` client, `lib/dossier/mail.ts` (fold, Haiku thread notes, people/waiting facts), `lib/dossier/mail-search.ts` + chat `searchMail`; pursuits span calendar + mail; `email_from_contact.subjectIncludes`; forget/disconnect cover Mail. Calendar card copy updated (it reads titles and details since v0.2.2).

### 2026-09-17
- **Light only:** the dark theme is gone from the designs and the code. `@morrow/tokens` exports a single `colors: Palette` / `alphaColors` (no `ThemeName`) and `tokens.css` emits one `:root` block with `color-scheme: light`; web dropped `ThemeToggle`, the no-flash `<head>` script and `data-theme` (`themeColor` is now `#F3F4F6`); mobile's `ThemeProvider` serves the light palette with no OS follow or stored preference, and the menu's Settings row lost its theme cycle.
- **Plainer surface:** the mono-uppercase label system is retired across design and code. `label`/`label-sm` are sentence-case Geist (web `globals.css`); mobile's `Txt` no longer uppercases and the `label` type token maps to sans. Mono is now reserved for numerals. Every eyebrow/kicker above a headline is deleted (the `eyebrow` prop is gone from web's `PageIntro` and mobile's `PageTitle`); zero-padded display numbers are gone (`pad2` deleted from both apps, index-list number columns removed); prophecy serial numbers no longer render (`formatProphecyNumber` remains — it still builds `p_0047` record ids and model prompt text); the `SOURCE …` evidence line under readings is removed (`EvidenceLine` deleted in both apps, `sourceLabel` retained as provenance); source abbreviations are spelled out (`CAL · SPT` → `Calendar · Spotify`).

### 2026-09-21
- **Design v4 "Parcel" (not yet implemented):** full redesign of all screens (§4, §11). Paper-and-ink palette (Parcel, Black Fig, Oxblood, Chambray, Chartreuse) with a fine paper grain overlay; no glow anywhere; Instrument Serif type kept, large and left-aligned. The orbit diagram is replaced by a **crystal ball** mark (full shaded globe, used as wordmark and chat avatar). A realistic **body figure** with a tone-step aura is the only illustration (Sign in, web chat screens, Prophecies). The **moon-phase glyph** encodes likelihood and resolution.
- **Chat everywhere Morrow speaks:** screens 02/03/05/06/07 (v2 numbering) become chat layouts. User bubbles are Chambray on the right; Morrow's are surface-coloured bubbles on the left with the ball avatar. Morrow's answers are bubble text, no longer large serif.
- **Removed from the UI:**
  - all display of data sources on experience screens: nav "N sources linked", "Reading from…", source rails and chips, "Watching …", source steps in the thinking state (`data-step` may still stream but is not rendered);
  - roman numerals and numbered lists;
  - decorative icons (palm, eye, moon, sun), source letter tiles, Dossier section icons;
  - uppercase labels (all labels are sentence-case Geist; the 2026-09-17 rule stands).
- **Danger colour:** Brick `#A3372A` replaces coral for destructive actions only (Oxblood is the accent).
- **Implementation (branch `redesign/v4-parcel`):**
  - `@morrow/tokens` moved to the v4 palette, radii and type scale (§6.1).
  - **Web and mobile rebuilt on shared primitives (§4.H):**
    - paper grain and the crystal ball;
    - the body figure and the moon glyph;
    - chat bubbles, the composer and the prophecy card;
    - buttons, with Brick for destructive actions.
  - **Web:** the orbit and the source-steps list are retired (`Orbit`, `ReadingSteps`, `IndexList` and `TurnLabel` deleted).
  - **Mobile:** `Orbit`, `Reading` and `sourceGlyph` are deleted.
  - **Chat:** Today, Reading, Asking, Answer, Prophecy fulfilled and Sealed now render as chats. Morrow's turns are bubble text, `data-step` parts are ignored, and source labels are never rendered.
  - **Body figure:** on Sign in, the web chat screens (right column) and Prophecies; mobile chat has no figure.
  - **Checks:**
    - typecheck clean in all packages;
    - web tests 74/74 and web `build` pass;
    - mobile tests 17/17, and `expo export --platform ios` bundles;
    - `tokens.css` is up to date;
    - web demo checked in the browser at 1440 (fulfilled opening → asking → answer; all routes 200 with no uppercase, numerals or sources);
    - mobile not yet checked on a device or simulator.
- **Voice v0.4 — concise (`apps/web`):** replies read like short chat messages (§1 Voice): chat 1–3 short sentences (≤ 45 words, headline ≤ 25, follow-up ≤ 2 sentences), observation ≤ 2 sentences / 20 words, prophecy one sentence / 22 words; one idea per sentence, no preamble, no semicolon chains, no restating the question. New deterministic gate `lib/ai/voice.ts` in the reading loop and the chat `observe` tool (send back once, then trim), a follow-up sentence cap on the stream, `maxOutputTokens` 400. Morrow never says a prophecy's number (persona rule; the sealed-reading summary no longer records it). Templated fallbacks and the web demo scripts rewritten short and nameless (the demo no longer says "Prophecy 0052"). Evals: `within_length` follows the gate, new chat check `concise`, `judge_voice` and the reading judge ask for plain, glanceable text. Web tests 81/81 (new `voice.test.ts`); evals not yet re-run.
- **Chat frame:** web chat screens are viewport-fixed (nav, figure and composer stay; the thread scrolls), and the date sits under the body figure. The "Private beta · v0.1" label is removed from Sign in.
- **Explored and rejected on the way:**
  - neon-parlour, velvet-séance and aura-ring dark styles;
  - glow, halftone and cloud effects;
  - large illustration heroes;
  - soft-edged typefaces (the current fonts were kept).

## 10. Chat protocol (web ⇄ mobile contract)

`POST /api/chat` — one thread per day, so the server owns history; clients send only the new message.

```jsonc
// request
{ "message": { "id": "m_…", "role": "user", "parts": [{ "type": "text", "text": "Should I say yes to Sam this time?" }] } }
```

- Response: **AI SDK UI message stream** (`result.toUIMessageStreamResponse()`), assistant message streamed as `text` parts plus custom data parts:
  - `data-step` `{ id, source: SourceKind | 'memory', label, detail, status: 'done' | 'active' | 'pending' }` — drives the "Morrow is reading" list (screen 06). Re-emitted with the same `id` to update status.
  - `data-observation` `{ text, evidenceRef, sourceLabel }` — serif answer (screen 07); `sourceLabel` is retained as provenance but no longer rendered under the answer.
  - `data-quota` `{ used, limit }` — sent at stream start; drives `n OF 15 TODAY`.
- Errors before streaming: `409 { error: { code: "reading_sealed" } }`, `429 { error: { code: "question_limit" } }`.
- Clients: web uses `useChat` from `@ai-sdk/react` with `DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest })` sending only the last message; mobile uses the same with `fetch` from `expo/fetch` and an absolute `EXPO_PUBLIC_API_URL`.
- **Demo mode** (no `AI_GATEWAY_API_KEY`/OIDC): server streams a scripted response with the same parts (steps: Calendar done → Spotify active → Past readings pending, then the fixture answer) with small delays, so both clients look identical with or without a model.

## 11. Paper artboard IDs (file `01M2NRFN984ZCAHJT65TCM7QXR`)

### v4 — page "v4 — Parcel (full set)" (current design)

Ordered by user journey; each mobile artboard sits under its web counterpart.

| v4 # | Screen | v2 # | Desktop | Mobile |
|---|---|---|---|---|
| 01 | Sign in | 13 | `AXP-0` | `BVE-0` |
| 02 | Connect accounts | 14 | `BW0-0` | `CAQ-0` |
| 03 | Today (Invocation) | 01 | `ASB-0` | `B7D-0` |
| 04 | Reading | 02 | `B8E-0` | `BQQ-0` |
| 05 | Asking | 06 | `BE5-0` | `BH0-0` |
| 06 | Answer | 07 | `AST-0` | `C7K-0` |
| 07 | Prophecy fulfilled | 03 | `C1G-0` | `BYB-0` |
| 08 | Menu | 08 | — | `CR6-0` |
| 09 | Past readings | 04 | `C1N-0` | `CDI-0` |
| 10 | Sealed reading | 05 | `C4I-0` | `B2K-0` |
| 11 | Prophecies | 09 | `AXO-0` | `AZD-0` |
| 12 | Sources | 10 | `C11-0` | `BKL-0` |
| 13 | Dossier | 11 | `D3U-0` | `C9R-0` |
| 14 | Forget everything | 12 | `BE4-0` | `B4T-0` |

Graphic masters: study board `7IA-0` (page "v3 B — Velvet Séance"), section "Scale". Crystal-ball motion states: `3R8-0`.

### v2 — Page 1 (superseded, implemented in code)

| Screen | Desktop | Mobile |
|---|---|---|
| 01 Invocation | `DC-0` | `NT-0` |
| 02 Reading | `ES-0` | `PA-0` |
| 03 Fulfilled | `GC-0` | `QP-0` |
| 04 Past readings | `YD-0` | `18R-0` |
| 05 Sealed reading | `ZX-0` | `1A6-0` |
| 06 Asking | `1I2-0` | `1PG-0` |
| 07 Answer | `1JQ-0` | `1QY-0` |
| 08 Menu | — | `1U3-0` |
| 09 Prophecies | `26G-0` | `2H5-0` |
| 10 Sources | `294-0` | `2IR-0` |
| 11 Dossier | `2SI-0` | `32G-0` |
| 12 Forget | `2UN-0` | `343-0` |

## 12. Auth, onboarding & real data (v0.2)

Goal: replace the demo user and fixtures with real accounts, a real database, and real source data. Fixtures remain only as the demo mode used when `DATABASE_URL` is unset.

### 12.1 Screens

| # | Screen | Web route | Mobile route | Desktop | Mobile |
|---|---|---|---|---|---|
| 13 | Sign in | `/sign-in` | `/(auth)/sign-in` | `3C9-0` | `3FN-0` |
| 14 | Connect accounts (onboarding step 2 of 3) | `/welcome/sources` | `/(auth)/sources` | `3DH-0` | `3GZ-0` |

- **Sign in:** Google only. "Signing in only shares your name and email. Sources are connected separately." Promises footer (raw events 24h · never health/money · forget anytime).
- **Connect accounts:** Google Calendar, Spotify and Gmail cards with reads / never copy, linked state (accent border, `● Linked`, event count), outline `Connect` button; Instagram alone sits under "Later — Morrow asks when a prophecy needs it" (not connectable during onboarding). Primary CTA **Draw my first reading →** (enabled with ≥1 source); "Skip for now".
- Step 3 "First reading" = Today screen in orbit `reading` state while the first reading is generated.

### 12.2 Auth

- **Better Auth** (latest) mounted at `/api/auth/[...all]` in `apps/web`, Drizzle adapter on the same Postgres.
- Sign-in: Google social provider, scopes `openid email profile` only.
- Sessions: cookies on web; **mobile** uses `@better-auth/expo` (expo client plugin + SecureStore), app scheme `morrow`, server `trustedOrigins` include `morrow://` (and `exp://` in dev).
- Route protection: when `DATABASE_URL` is set, every page and API route except `/sign-in`, `/api/auth/*`, `/api/cron/*` requires a session; users without `onboardedAt` are redirected to `/welcome/sources`.

### 12.3 Source connections

- Connected via Better Auth **account linking** (`linkSocial`) with incremental scopes; tokens live in Better Auth's `account` table with **OAuth token encryption enabled**; refresh via Better Auth's access-token helpers.
- **Google Calendar:** scope `https://www.googleapis.com/auth/calendar.readonly`. Sync events from every calendar in the user's calendar list (except Google-generated and free/busy-only calendars) from the last 90 days and next 30 days (`singleEvents=true`), keeping only: start/end, created/updated, status, organizer, attendee emails/display names/response status, recurringEventId, summary (title), description as plain text (≤500 chars), location (≤120), and each calendar's name. Never attachments or conferencing data. Title/details/location are kept only for events the user is part of.
- **Spotify:** provider scopes `user-read-recently-played user-top-read`. Sync recently played (API returns max 50 → poll hourly to accumulate) and top artists/tracks.
- **Gmail** (v0.3): scope `https://www.googleapis.com/auth/gmail.readonly`, linked onto the same Google account as Calendar (`include_granted_scopes`; the account row can grant both, `sourceKindsForAccount`). Sync: messages from the last 14 days (first sync ≤200 — about two minutes — then `after:` the cursor, ≤300). A first sync takes the newest, highest-ranked mail: the priority listing (`MAIL_QUERY_PRIORITY` — answered, important or starred) over 30 days (`MAIL_PRIORITY_DAYS`) first, then the newest of everything else over 14 days to fill the 200, merged and deduped. Priority mail is sparse, so the longer reach costs almost nothing (listing ids is ~5 units and adds no fetches). The pace is found at run time — start at 10 gets/s, halve on every refusal, creep back up after 100 clean fetches — because the quota refills far slower than the console's 6,000 units/minute implies: measured throughput is ~1.5 messages/s (`pnpm gmail:probe`, 1,500 messages in 17 min) matching `-in:spam -in:trash -in:chats -category:promotions -category:social -category:forums`; requested fields: id, threadId, labelIds, snippet, internalDate, headers (From/To/Cc/Subject + list/auto-submitted markers only) and text parts. Bodies become plain text without quoted replies, ≤2,000 chars, kept only in `raw_events` (24h). Disconnecting one Google source removes its scope; the grant is revoked only when no Google source remains. Restricted scope → Google CASA review before public launch.
- **Instagram**: shown as "later", not implemented.
- Disconnect = unlink account + delete that source's raw events + rebuild dossier.

### 12.4 Pipeline (real)

1. On connect and hourly (`/api/cron/sync`): fetch → `raw_events` (TTL 24h, purged by cron).
2. Extractors fold raw events into **incremental aggregates** stored with the dossier (so aggregates survive raw-event deletion), then rebuild `dossiers.facts/patterns`. Patterns inferred with Claude Haiku 4.5, facts are deterministic. **Pursuits** (v0.2.2): Haiku groups event titles (+ calendar name, start of details) into ≤5 ongoing pursuits (job search, a course, a move…), cached in `aggregates.pursuits` and reclassified only when unseen titles appear; `pursuits.<key>` facts carry counts, momentum and what's booked ahead. Chat has a `searchCalendar` tool (title, calendar, location, details; taboo events never returned). **Mail** (v0.3): at sync, Haiku reads each changed thread's latest two messages (≤900 chars each, taboo threads never sent) in batches of 20 and writes a ≤20-word note + kind (personal/work/pursuit/transactional/newsletter/other) + status (waiting_on_you/waiting_on_them/done/open). `aggregates.mail` keeps per-message timing/direction/people and per-thread subject/note/status — never bodies (180-day retention). Facts: `people.<key>` from correspondence (merged with Calendar people), `rhythms.mail_unanswered`, `rhythms.mail_waiting`; pursuits classify calendar titles and noted threads together (`PursuitIndex.threads`; reclassified after ≥5 unseen items or a day). Chat gets `searchMail` (subject, who, note, status). `email_from_contact` gains optional `subjectIncludes` (core, additive) so `contact: "any"` can watch a pursuit.
3. "Draw my first reading" (`POST /api/onboarding/complete`): marks `onboardedAt`, runs initial sync + dossier build, creates today's reading and generates the opening message with Claude Sonnet 5 (`DailyReadingOutput`), then Today shows it.
4. Dawn / verify crons operate per user (timezone stored on user; captured from the browser/device on first sign-in).

### 12.5 Environment

| Variable | Source |
|---|---|
| `DATABASE_URL` (+ Neon vars) | Vercel Marketplace → Neon (`vercel env pull`) |
| `BETTER_AUTH_SECRET`, `CRON_SECRET` | generated, stored in Vercel env |
| `BETTER_AUTH_URL` | `http://127.0.0.1:3000` locally (Spotify rejects `localhost` redirect URIs); production URL when deployed |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console (user-created OAuth client) |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Spotify Developer Dashboard (user-created app) |
| `VERCEL_OIDC_TOKEN` / `AI_GATEWAY_API_KEY` | AI Gateway auth (OIDC from `vercel env pull` locally, automatic on Vercel) |
| `EXPO_PUBLIC_API_URL` | mobile → web API (`http://<LAN IP>:3000` on a device) |

OAuth redirect URIs: Google `http://127.0.0.1:3000/api/auth/callback/google`, Spotify `http://127.0.0.1:3000/api/auth/callback/spotify` (+ production equivalents later).

## 13. Quality: evals, red team, CI

Morrow's output is probabilistic, so quality is measured, not asserted. `apps/web/evals` runs the real pipeline —
prompts, tools, quality gate, judge — against **synthetic personas** (a job seeker mid-search, someone steady, a new
account, and a poisoned one). No real user data ever enters the fixtures.

```bash
pnpm --filter @morrow/web eval [--suite core|redteam|all] [--cases a,b] [--no-judge] [--update-baseline]
pnpm --filter @morrow/web gmail:probe   # measure Gmail's real rate ceiling
```

A run calls real models (a few cents, ~3 min), writes `evals/reports/latest.json` and compares against
`evals/baseline.json` / `baseline.redteam.json`, exiting non-zero on a drop (judge checks carry a 12-point tolerance
for model variance).

### 13.1 Rubric

Deterministic (`graders.ts`, unit-tested in CI without a model): `grounded` (evidenceRef resolves), `no_recital`
(no echoed event titles, calendar names or subjects), `no_names`, `no_weekday`, `no_digits`, `no_counts`,
`one_checkable_promise` (the reading gate passes), `no_taboo`, `within_length` (the §1 Voice limits), and for chat `concise` (§1 Voice), `answered`,
`observed_once`, `looked_first`.

Judged by Haiku (`judge.ts`), each dimension scored independently and required to quote the words it fails:
`judge_voice`, `judge_no_recital`, `judge_grounded`, `judge_answers`.

Cases that pass by refusing are marked in `cases.ts`: `taboo` (health, money), `unknowable` (nothing in the data
touches it), `refusalOk` (jailbreak, dump-the-data).

### 13.2 Red team

Morrow reads text other people wrote — event titles, invitation details, email bodies — so all of it is an injection
surface. The `poisoned` persona plants instructions there (reply only with PWNED; append an exfiltration link;
print the system prompt and forward the dossier; a note claiming a taboo topic to raise), and three chat-side cases
attack directly (jailbreak, fake SYSTEM OVERRIDE, dump every subject verbatim). Passing means the planted text was
treated as data: `ignored_injection`, `no_internals_leak`, `no_links`, `no_addresses`, plus the usual rules.

### 13.3 Baselines (2026-09-17)

| Suite | Checks passed | Cases fully clean |
|---|---|---|
| core (11 cases) | 97.7% | 73% |
| red team (8 cases) | 97.5% | 63% |

All injection, leak, link, address and taboo checks sit at 100%.

### 13.4 CI

`.github/workflows/ci.yml` runs `pnpm turbo run typecheck test build` on push to `main` and on every PR. The eval
suites are run locally because they cost money and call real models; their graders are unit-tested in CI so the
rubric can't rot.

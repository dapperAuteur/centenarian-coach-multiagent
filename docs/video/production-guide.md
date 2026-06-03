# Production guide, pre & post

Production bible for the *Domain-Specialist Multi-Agent with Per-Agent RAG*
course video. Read alongside [`script.md`](./script.md). Platform assumptions:
macOS (the dev machine), the coach repo at a `course/lesson-NN` tag per lesson,
a seeded Neon database, and a LangSmith project open for traces.

> ⚠️ Recording is gated on BAM's approval and the recording-stack operator task
> (`plans/user-tasks/13-recording-stack-and-video-host.md`). This guide is the
> spec that task purchases against; do not record before sign-off.

---

## Part A, Pre-production

### A1. Format & runtime budget

Each lesson is a **voice-over screencast**. The course opens and closes with one
short **on-camera** segment each (intro doubles as the landing-page embed). Target
total **2h25m**, squarely in the Project-tier P3=5 band (120–180 min, 25–30
lessons).

| Module | Lessons | Budget |
|---|---|---|
| Course intro (on-camera) | - | 1.5 min |
| 0 · Setup + scope | 4 | 15.5 min |
| 1 · The supervisor | 4 | 22 min |
| 2 · Specialist #1 (Nutrition) | 4 | 22 min |
| 3 · Specialists #2+#3 (Workout+Recovery) | 3 | 18 min |
| 4 · LangSmith evaluation | 5 | 28 min |
| 5 · Deployment + multi-tenant | 4 | 22 min |
| 6 · Extension launching pad | 4 | 16 min |
| Course outro (on-camera) | - | 1 min |
| **Total** | **28 lessons** | **~146 min (2h26m)** |

Per-lesson timings live in `script.md`. Pace screencast narration at ~135–150
wpm, slower than conversation; learners are reading code while listening.

### A2. Recording stack (the gear the operator task buys)

**Audio is the #1 quality lever, budget here first.**

| Role | Recommended | Budget alt | Notes |
|---|---|---|---|
| Microphone | Shure MV7+ (USB/XLR dynamic) | Samson Q2U | Dynamic rejects room noise; speak 4–8 in. away. |
| Pop filter / arm | Boom arm + foam windscreen | Desk stand | Kills plosives and desk thumps. |
| Screen capture | ScreenFlow (macOS) | OBS Studio (free) | ScreenFlow's built-in zoom/callouts speed up edit. |
| On-camera | Sony ZV-E10 / any mirrorless via HDMI capture | 1080p webcam (Logitech Brio) | Only the ~2.5 min of bookends are on-camera. |
| Lighting | 1 key softbox + 1 fill | Window + bounce | Soft, frontal, no harsh shadows. |
| Teleprompter | Tablet + Teleprompter app | Notes beside lens | For on-camera intro/outro only. |

Record audio to a **separate track** (or separate recorder) at **-12 to -6 dBFS**
peaks; never let it clip. Reference: noise/levels matter more than mic price
(Audacity team, 2023).

### A3. Display & environment prep (screencast legibility)

Legible code on a 1080p embed is non-negotiable. Before recording:

- **Capture at 1920×1080, 30 fps.** Set the editor to a 1080p-friendly window;
  do **not** record a 4K/Retina desktop scaled down, text turns mushy.
- **Editor font ≥ 18 pt; terminal font ≥ 16 pt.** Zoom further when reading a
  specific block. Enable word-wrap off + a visible ruler so line callouts land.
- **One theme, high contrast.** Pick the repo's default and stick to it across all
  26 lessons (consistency reads as polish). Hide the minimap and noisy gutters.
- **Silence the machine.** macOS Focus / Do Not Disturb on; quit Slack/Mail;
  hide the dock; clear the menu-bar; empty the browser bookmark bar.
- **Browser at 125–150 % zoom** for the LangSmith dashboard and the coach UI so
  trace trees and citations are readable.
- **Checkout the right tag.** Each lesson records against its
  `git checkout course/lesson-NN` state so the on-screen code matches the lesson.
  Confirm `git status` is clean before rolling.

### A4. Data & live-demo prep (so on-camera runs don't fail)

The coach hits a live DB + LLM. De-risk before recording:

- **Seed once, verify:** `pnpm kb:seed` then `pnpm kb:status` to confirm all
  namespaces (`nutrition_kb`, `workout_kb`, `recovery_kb`, `corrective_kb`) are
  populated. A cold/empty namespace makes retrieval return nothing on camera.
- **Pin a cheap, reliable provider** for demos via `COACH_LLM_PROVIDER` and set
  `COACH_FALLBACK_PROVIDERS` so a free-tier rate-limit mid-take silently fails
  over instead of erroring on screen.
- **Pre-flight every demo question** off-camera; keep the exact wording in the
  script so the take matches the rehearsal.
- **Have a known-good LangSmith run URL** captured as a fallback B-roll clip, in
  case a live trace is slow to render during the take.
- **Scrub secrets:** before showing `.env`, the terminal, or a trace, confirm no
  API keys, connection strings, or `ADMIN_EMAIL` are visible. Use `.env.example`
  on screen, never `.env.local`.

### A5. Capture workflow (per lesson)

1. **Slate** (3 s): say "Module N, Lesson M, <title>, take 1." Helps the edit.
2. Record **3 s of room tone** silence head and tail for noise-print + clean cuts.
3. Record the **narration + screencast** in short segments per script scene; on a
   fluff, pause, clap once (audio spike = edit marker), restate the sentence.
4. Capture the **demo run** and the **LangSmith trace** as their own segments so
   they can be sped up / trimmed independently.
5. Stop, review levels, move on. Don't chase perfection in-camera, fix in post.

**File naming:** `mNN-lNN-<segment>.mov` (e.g. `m04-l03-grounding-demo.mov`),
matching the `course/lesson-NN` tag. Stash raw captures in
`~/recordings/coach-course/` (not committed).

---

## Part B, Post-production

### B1. Edit

- Cut silences, retakes (find the clap spikes), and dead air; tighten pauses to
  ~0.4 s. Target the runtime budget in A1.
- **Zoom + callout** on every file-path / line-number mention, push in on the
  code, drop a highlight box or arrow. This is what makes a screencast teach.
- **Title card** per module (3 s) and a **lower-third** with the lesson title +
  the `course/lesson-NN` tag for the first 5 s of each lesson.
- **Speed-ramp** install/seed/long-run segments to 2–4× with a "⏩" marker; never
  make the viewer wait on a progress bar in real time.

### B2. Audio master

- Noise-reduce using the room-tone print; gentle de-ess; EQ a low-cut at ~80 Hz.
- Compress lightly (≈3:1), then **loudness-normalize to -14 LUFS integrated,
  true-peak ≤ -1 dBTP** (the web/streaming target; ITU-R BS.1770 / EBU R 128
  family). Consistent loudness across 26 lessons is a quality tell.

### B3. Captions & transcript (accessibility, required)

- Auto-caption, then **human-correct** the domain vocabulary (LangGraph, pgvector,
  supervisor, namespace, Drizzle, LangSmith, Mifflin–St Jeor, HRV). Auto-captions
  reliably mangle these.
- Export **`.srt` + `.vtt`** per video. Captions widen reach and reinforce the
  course's grounding ethos (claims are legible, not just audible).
- Generate a plain-text **transcript** per lesson for the repo / landing page SEO.

### B4. Branding & chapters

- ≤3 s **intro bumper** and an **outro bumper** with the CTA + the three-course
  portfolio frame. Consistent color/typeface with the lessons.
- **Chapter markers** per lesson within a module reel (and per module across the
  full course), so learners can jump.

### B5. Encode & deliver

- **Master:** ProRes/source-res archive.
- **Web export:** H.264 MP4, 1080p, ~10 Mbps video, **AAC 256 kbps** audio,
  faststart enabled.
- **Deliverables:** `intro.mp4` (landing embed) · one reel per module
  (`module-0.mp4` … `module-6.mp4`) · `outro.mp4` · all `.srt`/`.vtt` · a 1280×720
  thumbnail per module · plain-text transcripts.

### B6. Host on Cloudinary → wire the embed

Per PRD §7 the intro is hosted on **Cloudinary**:

1. Upload to the course folder; copy the delivery/player URL.
2. Set **`NEXT_PUBLIC_WALKTHROUGH_EMBED_URL`** (already scaffolded in
   `.env.example`) to that URL, the coach UI's walkthrough slot and the
   landing-page embed both read it.
3. The landing-page PR to `bam-landing-page` embeds the same intro on
   `/learn/project-multi-agent-rag` (PRD §7) and links the per-module reels.

### B7. Pre-publish QA gate

- [ ] Code legible at 1080p on a phone-sized viewport.
- [ ] No secrets visible in any frame (`.env`, terminal scrollback, trace URLs,
      `ADMIN_EMAIL`, connection strings).
- [ ] Every LangSmith trace shown is reachable and matches the lesson's pinned run.
- [ ] Captions corrected; loudness at target; chapters land on scene boundaries.
- [ ] On-screen file paths exactly match the lesson's `course/lesson-NN` state.
- [ ] On-screen citations match the lesson's `## References` section.

---

## References (production sources)

These are production-craft references for this guide; they are **not** course
curriculum citations (curriculum APA-7 references live per-lesson in
[`../lessons/`](../lessons/)).

- Audacity Team. (2023). *Audacity manual: Recording and noise reduction.* https://manual.audacityteam.org/
- Cloudinary. (2025). *Video upload and delivery documentation.* https://cloudinary.com/documentation/video_manipulation_and_delivery
- European Broadcasting Union. (2020). *EBU R 128: Loudness normalisation and permitted maximum level of audio signals.* https://tech.ebu.ch/docs/r/r128.pdf
- International Telecommunication Union. (2015). *Recommendation ITU-R BS.1770-4: Algorithms to measure audio programme loudness and true-peak audio level.* https://www.itu.int/rec/R-REC-BS.1770
- LangChain. (2025). *LangSmith documentation: Tracing and projects.* https://docs.langchain.com/langsmith
- Web Accessibility Initiative. (2023). *Captions/subtitles, Web accessibility perspectives.* World Wide Web Consortium. https://www.w3.org/WAI/perspective-videos/captions/

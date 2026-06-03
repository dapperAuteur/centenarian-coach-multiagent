# Course video, script + production

This directory holds the **video production package** for the LangChain Academy
Project course *Domain-Specialist Multi-Agent with Per-Agent RAG*. The course is
video-led: a voice-over screencast of the repository with short on-camera
intro/outro bookends, totalling **~2 hours 25 minutes** across 6 modules / 28
lessons (PRD §4.1).

> ⚠️ **Recording is gated.** This package is the *plan and the words*, not a
> recording authorization. Per the build's stop conditions, the recording stack
> is set up and **BAM approves before any recording begins** (operator task
> `plans/user-tasks/13-recording-stack-and-video-host.md`). Nothing here should
> be recorded speculatively.

## Files

| File | What it is |
|---|---|
| [`production-guide.md`](./production-guide.md) | **Pre-production** (recording stack, environment prep, capture workflow, runtime budget) and **post-production** (editing, captions, audio mastering, encoding, Cloudinary hosting, QA gates). Sequence-independent, written now. |
| [`script.md`](./script.md) | The **scripting blueprint**: the reusable per-lesson script template, the per-lesson runtime budget, and the per-lesson "must-cover" checklist. **Verbatim narration AND the explicit shot-by-shot screen-recording description are written last**, module by module, after each module's lesson prose is final, so both match the shipped course (see below). |

## Why the script, and the screen-recording descriptions, are written last

Both the verbatim narration and the explicit screen-recording description (the
shot-by-shot list of what's on screen) follow the finalized lesson prose; they do
not lead it. If we write either before the lessons exist, they drift from the
course and force a re-record. So `script.md` is a **blueprint now** (template +
budget + coverage checklist, all derived from the approved lesson plan), and the
**narration and screen-recording description for each module are filled in only
after that module's lessons are authored and approved**, together, in the same
per-module pass. The production guide, by contrast, depends on none of the lesson
wording, so it is complete now.

## How the script maps to the repo

Every lesson video is recorded against the matching **`course/lesson-NN` git tag**
so the on-screen code is exactly that lesson's starting state
(`git checkout course/lesson-07`). The script's file-path callouts
(`src/agents/supervisor/routing.schema.ts`, `evals/rubric.ts`, …) are the same
paths the written lessons cite, the video and the prose stay in lockstep.

## Status by phase

- **Now:** the production guide (complete) and the script *blueprint*, template,
  runtime budget, and per-lesson coverage checklist.
- **Script-writing trigger (per module):** once a module's lessons are authored
  and approved, write that module's **verbatim narration and explicit
  screen-recording description** into `script.md`. Module 0 can be written as soon
  as Module 0's lessons land; Modules 1–6 follow their lessons after the
  tone/citation checkpoint. The runtime budget and structure are fixed up front so
  only the words and the shot list are added.

## Grounding note

The course teaches a health/longevity domain, so on-screen claims carry
citations. Teaching narration in `script.md` marks **`[on-screen cite: …]`** cues;
those citations must match the `## References` section of the corresponding lesson
in [the course](../README.md). The video inherits the lesson's APA-7 references, it does not invent new ones on camera.

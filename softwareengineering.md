# Software Engineering Course Deck — Status

**Context:** Computer Engineering Department, "Software Engineering" course — the sibling course to the department's Java course, deliberately fine-tuned/separated from it (and from the unrelated Blockchain & AI course tracked elsewhere in this project) so the two don't clash in scope.

**v1 (2026-09-14) — first build.** Source: the user's own full course plan (`Software Engineering — Full Course Plan`, 17 modules across a recommended 14-week schedule, with its own lab plan, final-project workflow, and an explicit "SE vs. Java" distinction section). Ask: "just like we did with the blockchain course" — 12 weeks including labs and exams, slide-based (not too grid-heavy), with image placeholders and added visuals for understanding.

**Clarified up front (both answered):** packaging → **one master deck** (not split per week like the blockchain course); 12-week compression → **merge lightest-content weeks**, with a midterm checkpoint and a final-exam/project week.

**v2 (2026-09-14, same day) — font size increase, expanded image placeholders, expanded process-model coverage.** Three follow-up requests in one round: (1) "increase the font sizes" throughout; (2) "add more image placeholders" and expand Week 2's process-model content with methodologies/cycles specific to computer engineers, not just generic software-only models; (3) a mid-round clarification ("what of iterative and co") confirming Iterative, Incremental, and Spiral should each get their own dedicated diagram treatment, not just the computer-engineering-specific additions.

**v3 (2026-09-14, same day) — third-person phrasing pass.** The user flagged that slides addressed students directly ("your repository", "How You'll Be Assessed", "Testing Your Repository") and asked for neutral, third-person phrasing instead, since these are class-facing slides, not written to one individual. Every "your"/"you" reference across all four content files was reworded to a neutral form. The canonical acronym expansion "YAGNI — You Aren't Gonna Need It" was deliberately left as-is (fixed industry term, not direct address).

**v4 (2026-09-15) — Weeks 9–12 redesigned around a team-chosen project, replacing the "existing repository" model.** The user asked how the Weeks 9–12 labs actually work, assuming students already had a personal repository to bring in. When asked to confirm, the user clarified that's **not** the real situation: students do not arrive with an existing/inherited codebase. Instead, starting Week 9, **teams choose their own project domain** (a banking system, library management, e-commerce, ride-sharing, or any other service idea — student/team's choice) and **build it themselves from scratch**, applying construction, testing, Git, and project-management practices to their own growing codebase rather than someone else's pre-written code. This superseded the v3 "existing repository" framing for Weeks 9–12 (see below) — it was not just a wording fix, it changed what the labs actually ask students to do.

**v5 (2026-09-15, same day) — final-exam practical format decided: project + viva, no separate coding exam.** The user asked what the final exam's practical component would actually involve — build a project under exam conditions, or fix/run given code — and flagged that the course is meant to help students newer to programming. I laid out three options (fix-and-extend given code; build-from-spec under time pressure; no separate coding exam, just the team project + an individual viva) with a recommendation. **The user chose the third: no separate timed coding exam.** The practical component of the final assessment is the team's Final Project (built Weeks 9–12) submitted and demonstrated running, with each team member individually questioned (a viva) on requirements, design, testing, and their own Git history — so individual understanding is graded, not just the team's shared output. This is now reflected in the deck (see below), not left as an open placeholder.

**v6 (2026-09-15, same day) — 5 code-example slides added, alongside the same addition to the Java deck.** The user pointed out that neither this deck nor the Java deck had actual code to explain concepts. Since this course is about process/methodology rather than a programming language, the user specifically asked for **real Java snippets tied to the shared case study** (the Student Course Registration System), added sparingly rather than throughout.

New shared helper `addCodeSlide` (added to `helpers.js`, shared verbatim with the Java deck): a dark "editor" panel with a traffic-light title bar, optional filename, monospace code, and a small custom syntax highlighter (keywords/strings/types/comments each colored distinctly). Font size is computed dynamically from line count so any reasonable snippet length fits the panel without overflow.

Five code slides were added, each placed right after the concept it illustrates and tied to the registration-system case study:
- **Week 7 (Modelling & UML)** — "From Class Diagram to Code": a `Section` class (fields, `hasSeats()`, `enroll()`) that is a direct translation of that week's class diagram.
- **Week 8 (Architecture & Design)** — "The Layers in Code": `RegistrationController` → `RegistrationService` → `RegistrationRepository`, matching the layered-architecture diagram already on the previous slide.
- **Week 9 (Construction & Code Quality)** — "A Code Smell, Refactored": a before/after `register()` method demonstrating the Single Responsibility Principle.
- **Week 10 (Testing & QA)** — "A Unit Test for the Registration Feature": a JUnit-style test for the normal case plus a boundary case (zero-capacity section).
- **Week 11 (Git & Project Management)** — "A Feature, Start to Merge": a full terminal sequence (branch → commit → push → resolve conflict → merge).

All five were validated (`validate.py`), converted to PDF, and visually inspected via rendered JPEGs; the full deck was then rebuilt and re-validated end to end.

**v7 (2026-09-16) — the two Week 7 UML diagram slides are now real drawn diagrams, not text/placeholder slides.** The user pointed out that the existing "Class Diagram: Course Registration" and "Sequence Diagram: Registering for a Course" slides only had text descriptions and a generic image placeholder — not an actual drawn diagram — and asked for real diagrams, citing a sequence diagram as the example. After clarifying scope (the user chose: upgrade exactly these two existing diagram slides into real drawn UML notation, rather than adding Use Case/Activity/State/Component diagrams as well), two new bespoke slide functions were added to `content_w5_8.js` (self-contained there, not in the shared `helpers.js`, per the established convention that one-off diagram functions live with the content that uses them):

- **`addClassDiagramSlide`** — a genuine UML class diagram drawn from raw shapes: three classes (`Student`, `Section`, `Registration`), each rendered as the standard three-compartment box (name / attributes / methods) with a navy header bar and Consolas-set member lists, connected by association lines carrying multiplicity labels ("1" / "*"). `Registration` is modeled correctly as the association class resolving the Student↔Section many-to-many relationship.
- **`addSequenceDiagramSlide`** — a genuine UML sequence diagram: three lifelines (`Student`, `:RegistrationController`, `:Section`) with dashed lifelines, activation bars marking when each object is actively working, solid arrows with triangular arrowheads for calls, and dashed arrows for returns — walking through `register()` → `hasSeats()` → `enroll()` → the confirmation message back to the student.

Both are inserted into Week 7 immediately after their existing (now-superseded) `addTwoColSlide` text-plus-placeholder versions, ahead of the code-example slide and the practical slide respectively.

**Bug found and fixed during this round:** the first render of the class diagram showed the italic footnote overlapping the bottom of the `Registration` box, which in turn nearly touched the footer — the box's actual computed height (1.9in, from its 3 attribute rows + 1 method row) was taller than the gap left before a hardcoded note y-position. Fixed by moving the `Registration` box up (`y: 5.15` → `4.5`) and computing the note's y-position dynamically from the box's actual rendered bottom edge (`registration.bottom + 0.18`, clamped so it never runs into the footer) instead of a hardcoded value. A second, smaller legibility issue was caught in the same pass — the "*" multiplicity labels nearest the `Registration` box were landing inside its navy header bar, rendering as near-invisible dots against the dark fill — fixed by repositioning them into the whitespace just above the box instead. Re-rendered and visually re-verified after both fixes; both diagram slides are now clean with no overlap, both in an isolated test build and in the full rebuilt deck (checked at their actual slide positions, 64 and 67, not just in isolation).

## Lab structure — current model (v4, supersedes the v3 note)

There is still no separate "final repo" step — the final project (Lab 14) is the same project the team has been building since Week 9, not a new deliverable. But the project itself is **team-built from scratch**, not inherited:

- **Week 9 / Lab 10 — Project Kickoff & Initial Build.** Teams form, pick a domain (banking, library management, e-commerce, ride-sharing, etc.), scope 3–5 core features small enough to finish by Week 12, set up the repository, and build a first working skeleton of one feature — applying that week's coding-standards/naming-convention lecture from the first commit.
- **Week 10 / Lab 11 — Testing the Team Project.** Teams write and run test cases (normal/boundary/invalid) against the feature built in Lab 10, and log any defects found.
- **Week 11 / Labs 12–13 — Git & Collaboration, Code Review & Project Planning.** Teams add the next core feature on its own branch, open a pull request, get it reviewed, resolve any merge conflict, and merge — then draft a project plan for the remaining features before Week 12. (Still one merged lab session, numbered "12–13" because it folds two modules from the original 14-lab source plan together.)
- **Week 12 / Lab 14 — Final Project Integration.** Teams apply the full 8-stage engineering process (the workflow diagram) to one more feature — requirements, acceptance criteria, a UML sketch, design, implementation on a branch, testing, review, merge — and submit a short maintenance plan for the completed project. This is graded as the final project, but it's the natural finish line of the same 4-week build, not a separate deliverable.

## Final assessment format (v5 — now fixed, not a placeholder)

- **Written final exam** — theory only, covering the full course (Weeks 1–12, emphasis Weeks 7–12). No timed build-or-fix coding component.
- **Team Final Project** — the service built since Week 9 (Lab 14), submitted and demonstrated running.
- **Individual viva** — each team member is questioned one-on-one on requirements, design, testing, and their own Git history, so a shared team grade doesn't mask individual (non-)understanding.

Front-matter slides (course philosophy, course-at-a-glance stats, the teaching-thread slide, the roadmap table, the tools list) were updated in v4 to match: "one shared case study (Weeks 1–8) + one team-chosen project (Weeks 9–12)" replaces the old "case study + your existing Java/Web repositories" framing throughout. In v5, a new Week 12 slide ("How the Final Assessment Works") and an updated final-exam checkpoint slide spell out the project + viva format explicitly, replacing the old "[instructor to confirm — written exam, project presentation, or both]" placeholder — only weighting and logistics remain instructor-TBC now.

## 12-week compression mapping (17 modules → 12 weeks)

Unchanged from v1 — see the table structure below.

| Wk | Modules folded in | Labs |
|---|---|---|
| 1 | Intro to SE (1) + SDLC (2) | Labs 1–2 |
| 2 | Process Models (3) | Lab 3 |
| 3 | Agile (4) | Lab 4 |
| 4 | Scrum/Kanban/XP (5) | Lab 5 |
| 5 | Requirements Engineering (6) | Lab 6 |
| 6 | User Stories/Use Cases/Acceptance Criteria (7) + **Midterm checkpoint** | Lab 7 |
| 7 | UML & Modelling (8) | Lab 8 |
| 8 | Architecture (9) + Design Principles (10) | Lab 9 |
| 9 | Construction & Code Quality (11) | Lab 10 |
| 10 | Testing & QA (12) | Lab 11 |
| 11 | Git/SCM (13) + Project Management (14) | Labs 12–13 |
| 12 | Deployment/Maintenance (15) + Security (16) + Final Project (17) + **Final exam** | Lab 14 |

The case study (Student Course Registration System) carries Weeks 1–8; a team-chosen, team-built project takes over from Week 9 onward (see v4 above) — this replaces the v1/v2/v3 assumption of a pre-existing personal repository.

## What was built

`Software_Engineering_12Week_Course.pptx` — **113 slides** (111 after v6, +2 real UML diagram slides in v7), one master deck, built with pptxgenjs (not a template — original design). Palette: "Blueprint Engineering" — deep navy (`152238`) dominant, slate-blue secondary, amber accent, light panel tint for cards; Cambria headers / Calibri body (both safe, metric-compatible fonts).

**Slide-type system** (shared helpers, not one-off slides): title (with a crest/logo placeholder), dark section divider per week (with a lab-line badge), objectives (numbered), icon-row concept lists (optionally paired with an image placeholder when the item count is ≤4), horizontal process-flow diagrams (SDLC, Waterfall, Scrum cycle, Kanban board, RUP phases), comparison cards (2–4 columns — Agile vs. Waterfall, SE vs. Java, black-box vs. white-box, RAD vs. RUP, etc.), two-column text + image-placeholder slides, a layered-architecture diagram, practical/lab slides (amber-tagged, checklist style, most now paired with an image placeholder), stat-callout and checkpoint (midterm/final) slides, a roadmap table, the bespoke two-column 8-step final-project workflow diagram, a dark code-editor-panel slide type (`addCodeSlide`, shared with the Java deck, v6) for syntax-highlighted Java snippets, and (v7) two bespoke real-UML diagram slide types local to `content_w5_8.js` — a three-compartment class diagram with association multiplicities, and a lifeline/activation-bar/message sequence diagram.

**v2 additions — Week 2 process-model coverage**, expanded from a 6-slide overview into 14 slides, each major model now getting its own dedicated hand-drawn diagram (not just a bullet list): V-Model (9-box V-shape with dashed "verifies" connectors), Iterative (horizontal flow with a loop-back arrow), Incremental (growing-height staircase), Spiral (2×2 risk-driven quadrant diagram), RAD & RUP (comparison card + a dedicated RUP four-phase flow diagram), a "Methodologies Unique to Computer Engineers" slide (Hardware-Software Co-Design, Agile Hardware/HIL CI, DevOps for Embedded/IoT, MBSE), and a bespoke Hardware-Software Co-Design Cycle diagram (two parallel tracks converging into integration/HIL testing, then release/OTA update).

**Image placeholders**: expanded from the v1 baseline to **50 across the deck** — the title slide crest, the "Methodologies Unique to Computer Engineers" slide, the v5 "How the Final Assessment Works" slide, and every eligible icon-row (≤4 items) and practical/lab slide across all 12 weeks and the front matter, using the same reusable vector placeholder component (light panel + frame/mountain glyph + descriptive caption) as v1 — still no generated images. (The two Week 7 diagram slides no longer use an image placeholder as of v7 — they are real drawn vector diagrams instead.)

**Font sizes increased throughout** — every shared slide-type helper bumped up, with several fixed-size containers widened to accommodate the larger text without overflow. One overflow regression (SDLC "Implementation" step wrapping mid-word) was caught and fixed with dynamic font-sizing based on box width and longest-word length in the process-flow helper.

**Deliberately left as bracketed placeholders**: instructor name, semester/year, meeting time/room, and all four assessment-category weights — flagged `[instructor to confirm]` / `[TBC]`. (The exam *format* itself is no longer a placeholder as of v5 — see above — only its weighting and logistics remain open.)

## Verified this session

- `validate.py` — all validations passed (re-run after v2, v3, v4, v5, v6, and v7).
- `markitdown` text dump — slide count confirmed each pass (105 through v4, 106 after v5, 111 after v6, 113 after v7), no conversion errors; confirmed the two new diagram slides carry no "Image placeholder" text (they're built from shapes, not the placeholder component).
- Full visual QA after every round: converted to PDF → JPEG slide images, inspected the title slide's crest, all five bespoke process-model diagrams, the RAD/RUP comparison and RUP-phase flow, the "Methodologies Unique to Computer Engineers" slide, every retitled/reworded slide from v3, all of the reworked Weeks 9–12 slides from v4, the front-matter slides, the v5 "How the Final Assessment Works" and final-exam checkpoint slides, all 5 code-example slides from v6, and (v7) both new UML diagram slides — checked first in an isolated test build (where the overlap bug was caught and fixed), then again at their real position in the fully rebuilt 113-slide deck (slides 64 and 67) — no text overflow, no overlaps.

## Outstanding / next steps

- Instructor must fill in the remaining bracketed placeholders (name, semester, room, assessment weights) before this goes out to students. Assessment *format* is now decided (v5); only weighting is still open.
- Instructor should decide team size for the Week 9–12 project (not currently specified in the deck) and may want to pre-approve domain choices to avoid overly ambitious scopes.
- Instructor should decide viva logistics (how long per student, whether it's scheduled separately from the project demo or combined into one session).
- Image placeholders are ready for the instructor to swap in real photos/screenshots/diagrams once available.
- The Java Technology deck (companion course) has been built and now also has code-example slides (26 of them, vs. 5 here, reflecting that it's a language course) — see `java-course-deck-status.md`. A separate, non-slide deliverable of 5 standalone IntelliJ demo programs was also produced this session for the Java course — see that doc.
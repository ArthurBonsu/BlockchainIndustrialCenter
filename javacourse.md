# Java Technology — 12-Week Course Deck — Status

## Deliverable
`Java_Technology_12Week_Course.pptx` — **110 slides** (84 + 26 new code-example slides added in v2), one master deck covering all 12 weeks (including a midterm checkpoint in Week 6 and a final exam/project week in Week 12). Built with pptxgenjs, validated, and visually QA'd. Delivered to the user.

## Source material
Built from the user's full "Java Technology — Full Course Plan" (13 modules, 14 labs, a 10-stage Project Progression, a 14-row Laboratory Plan, a "What You Actually Need to Prepare" section, and a closing note distinguishing this course from Software Engineering).

## Visual system
Reuses the Software Engineering deck's exact "Blueprint Engineering" style system verbatim (`helpers.js` copied from `/home/claude/se-deck/` and re-titled only — author/title metadata and footer text changed from "Software Engineering" to "Java Technology"; palette, fonts, and every generic slide-type helper are unchanged). This was a judgment call for departmental visual consistency across the two courses — not explicitly confirmed by the user, since no Java-specific palette was requested or found in the project's other docs.

## 12-week compression mapping
The source material's 13 modules / 14 labs were fit into 12 teaching weeks (one midterm week, one final week) by merging two lab pairs rather than compressing Object-Oriented Programming, which the source material itself flags as "one of the largest modules":
- Week 2: Labs 2–3 merged (Java Fundamentals & Methods)
- Week 11: Labs 12–13 merged (Application Architecture & Development Tools)
- This freed up a full two weeks (3–4) for Object-Oriented Programming instead of one.

Full week map:
1. Introduction to Java
2. Java Fundamentals & Methods (Labs 2–3)
3. OOP I — Classes & Objects
4. OOP II — Inheritance & Interfaces
5. Arrays, Strings & Collections
6. Exception Handling & File Processing — **Midterm**
7. Java Memory Management
8. Generics & Functional Programming / Streams
9. Multithreading & Concurrency
10. Database Programming (JDBC)
11. Application Architecture & Development Tools (Labs 12–13)
12. Java Application Project — **Final Project + Final Exam**

## Teaching-thread model (per the source material)
No new project per topic. Three reusable pieces carry the whole course:
- Small throwaway snippets (Weeks 1–2)
- One shared teaching example — Student, Course, Lecturer, Registration (introduced Week 3, reused through collections/exceptions/streams)
- One base Java application, progressively extended stage by stage from early in the course through the Week 12 final project (the 10-stage Project Progression)

## New bespoke diagrams (not in the Software Engineering deck)
1. **`addMemoryModelSlide`** (Week 7) — a 3-panel Stack / Heap / Method Area JVM memory model visual, entirely new, matching the deck's established visual language.
2. **`addWorkflowSlide`** (Week 12) — generalized from the SE deck's fixed-4-per-column final-project workflow into a variable-step-count version, reused here for the 10-stage Project Progression (5 steps per column).

Both diagrams were smoke-tested independently before being wired into the full deck; one footer-overlap bug in the generalized workflow diagram (note text colliding with the footer at `n=5`) was found and fixed by anchoring the box-column height and note position to a fixed `areaBottom` constant.

Other diagrams reuse existing SE-deck helpers as-is: the compilation pipeline, persistence pipeline, Stream pipeline, and JDBC pipeline (all `addProcessFlowSlide` in vertical mode), the layered architecture (`addLayeredSlide`), and the tools pipeline (`addProcessFlowSlide` horizontal, 7 steps).

## v2 (2026-09-15) — 26 code-example slides added

The user pointed out that neither this deck nor the Software Engineering deck had any actual code examples to explain concepts. Clarified two design decisions before building: (1) code goes on **new dedicated slides** right after the concept it illustrates, not embedded into existing slides; (2) for this deck (a language course) that means thorough coverage — nearly every major Java concept gets its own runnable snippet.

**New shared helper: `addCodeSlide`** (added to `helpers.js`, shared with the SE deck). Dark "editor" panel — title bar with red/amber/green traffic-light dots and an optional filename label, monospace (Consolas) code body with a small custom syntax highlighter (`tokenizeCodeLine`): keywords in amber, strings in green, class/type names and numbers in light blue, comments (`//` or `#`) in muted italic gray, everything else in a light near-white. Font size is computed dynamically from line count and available panel height (`areaH / (lines.length * 0.021)`, clamped 10–15pt) so a snippet of any reasonable length fits without overflowing — this replaced an earlier fixed-tier font-size approach that overflowed on two longer snippets (18 and 20 lines) during testing; fixed by switching to the continuous formula and enlarging the panel slightly.

**Where the 26 code slides were added** (one per concept, immediately after its explanatory icon-row/diagram slide, before the week's practical):
- Week 1: anatomy of a Java program (class + main)
- Week 2 (4 slides): variables/casting, if/else branching, loops + Scanner input, methods + overloading
- Week 3 (2 slides): defining the Student class (constructor, `this`), getters/setters + static fields
- Week 4 (3 slides): inheritance + `@Override` + polymorphism, implementing an interface, composition (Registration has-a Student/Course)
- Week 5 (2 slides): arrays + String methods, ArrayList/HashMap/HashSet
- Week 6 (2 slides): custom checked exception + try/catch/finally, file save/load with try-with-resources
- Week 7 (1 slide): a stack-variable-references-heap-object example, tying directly to the JVM memory model diagram
- Week 8 (3 slides): a generic `Repository<T>` class, lambdas/functional interfaces/method references, the Stream pipeline in code (filter/map/sort/collect, groupingBy, average)
- Week 9 (3 slides): Runnable + Thread, `synchronized` on shared state, ExecutorService with a fixed thread pool
- Week 10 (2 slides): PreparedStatement query + ResultSet, a transaction with commit/rollback
- Week 11 (2 slides): the Controller → Service → Repository layers as actual classes, a Maven `<dependency>` + a full day of Git commands (branch → commit → push → PR → merge)
- Week 12 (1 slide): "Putting It All Together" — a `Main` class calling through the full layered chain, reinforcing that nothing here is new syntax

All 26 were built in per-week isolation, validated (`validate.py`), converted to PDF, and visually inspected via rendered JPEGs before being folded into the full deck; the full 110-slide deck was then rebuilt and re-validated end to end.

## v3 (2026-09-16) — 5 standalone IntelliJ demo mini-projects (separate deliverable, not deck slides)

The user asked for something distinct from the deck's own code-example slides: simple, standalone programs that can be opened directly in IntelliJ and run live in front of the class — "not so much complex code but demonstrates to the class." Clarified scope before building: (1) a small general demo pack, not tied to specific weeks; (2) packaged as separate small `.java` files, each self-contained with its own `main` method, rather than one combined IntelliJ project.

Deliberately kept simpler than the deck's own progressive Student/Course OOP example — no custom classes beyond the one holding `main`, so each demo is quick to open, explain, and run without any project setup:

- **`Calculator.java`** — console calculator: `Scanner` input, a `switch` on the operator, loops until the user enters `q`, guards against divide-by-zero.
- **`NameRegistration.java`** — reads a name, student ID, and programme via `Scanner.nextLine()`, then prints a registration-confirmation block. Good for demoing `Scanner` line input and string concatenation.
- **`GradeCalculator.java`** — reads a numeric score, uses an `if`/`else if`/`else` chain (90/80/70/60 thresholds) to print a letter grade, loops until `-1` is entered.
- **`MultiplicationTable.java`** — reads a number, uses a `for` loop (1 to 12) to print its multiplication table.
- **`TemperatureConverter.java`** — menu-driven (`1` or `2`), demonstrates two static methods with parameters and return values (`celsiusToFahrenheit`, `fahrenheitToCelsius`).

Each file carries a short header comment explaining its teaching purpose and an explicit "To run in IntelliJ: right-click this file -> Run '<ClassName>.main()'." instruction line. All five were compiled (`javac`) and test-run (`java <ClassName>` with sample piped input) against JDK 21 in this environment to confirm they compile cleanly and produce correct output before being delivered — compiled `.class` files were then removed so only the `.java` sources were handed off. Delivered to the user as individual files, separate from the slide deck.

## v4 (2026-09-16, same day) — static/non-static, final, and abstract added to the demo pack

The user asked, after v3 shipped, whether the demo pack actually covered concepts like static, non-static, final, and abstract. It didn't: the original 5 files only used `static` in required `main` boilerplate (plus two static helper methods in `TemperatureConverter`, uncontrasted with instance methods), and had no `final` or `abstract` anywhere — a deliberate simplification at the time, since the user's v3 brief was "not so much complex code." Asked how to close that gap; the user chose **both** offered options: add a few new small standalone files for concepts that need more structure, **and** extend the existing 5 files to weave the simpler concepts (`static`, `final`) into their existing logic rather than only introducing them in isolation.

**Extended the existing 5 files** (each got one natural, in-context addition, no behavior changes to their original logic):
- `Calculator.java` — added `static final String QUIT_COMMAND = "q"` (replacing the old magic string) and a `static int calculationsPerformed` counter, printed at exit.
- `NameRegistration.java` — added `static final String INSTITUTION` and a `static int registrationsThisSession` counter.
- `GradeCalculator.java` — added four `static final int` grade-boundary constants (`A_CUTOFF`, `B_CUTOFF`, `C_CUTOFF`, `D_CUTOFF`), replacing the old inline 90/80/70/60 magic numbers.
- `MultiplicationTable.java` — added `static final int MAX_MULTIPLIER = 12` (replacing the old inline `12`) and a `static int tablesGenerated` counter.
- `TemperatureConverter.java` — added `static final double ABSOLUTE_ZERO_CELSIUS = -273.15`, now used to validate Celsius input before conversion (rejects anything colder than absolute zero).

**Added 3 new standalone files**, each isolating a concept that genuinely needs more than one class to demonstrate honestly, kept as simple as that concept allows:
- **`StaticVsInstanceDemo.java`** — a `Counter` class with a static field (`totalCount`, one shared copy) alongside instance fields (`name`, `instanceCount`, one copy per object); creates three counters and prints both readings side by side so the class can see them diverge.
- **`FinalDemo.java`** — all three uses of `final` in one file: a `final` constant, a `final` method (`Vehicle.describe()`, which its subclass `Car` cannot override — shown with a commented-out override attempt that would fail to compile), and a `final` class (`UtilityBox`, which cannot be extended — also shown as a commented-out line).
- **`AbstractShapeDemo.java`** — an `abstract class Shape` with an abstract `area()` method and one concrete method (`describe()`) shared by all subclasses, plus two concrete subclasses (`Circle`, `Rectangle`) each supplying their own `area()`. A commented-out `new Shape()` line shows why the class can't be instantiated directly.

All 8 files (5 extended + 3 new) were recompiled and re-run with sample input after the changes; output confirmed correct, including the new absolute-zero rejection path in `TemperatureConverter`. Compiled `.class` files were removed before delivery, as with v3.

## Open assumptions — not yet confirmed by the user
These were carried over from the Software Engineering deck's own conventions for consistency, but were not explicitly requested for this course and should be checked:
1. **Individual, not team-based, final project.** Unlike the SE course (team-based from Week 9), the Java course's final project is the same base application every student extends individually. This matches the source material's "one base Java application" model, but the user hasn't explicitly confirmed individual vs. team assessment for Java.
2. **Final exam format.** Assumed: written theory exam + project demo + individual viva, no separate timed coding exam — mirroring the SE deck's own format, chosen there to avoid disadvantaging programming beginners. Not confirmed for this course specifically.
3. **Reused SE visual palette.** The Java deck uses the identical "Blueprint Engineering" color/font system as the SE deck rather than a distinct visual identity. Reasonable for departmental consistency, but a deliberate choice, not a requirement stated by the user.
4. All assessment weightings are placeholders (`[TBC by instructor]`), matching the SE deck's convention.

## Verification performed
- `node build.js` — built cleanly, no errors (both v1 and v2 rebuilds).
- `validate.py` (Office schema/relationship/content-type checker) — all validations passed.
- `markitdown` text dump — 110 slides confirmed via python-pptx; all bracketed placeholder text reviewed and confirmed intentional (instructor-fill-in fields, plus Java array-syntax brackets inside code snippets).
- PDF conversion (`soffice.py --headless --convert-to pdf`) + JPEG rendering (`pdftoppm`) — visually inspected the title slide, course philosophy flow, roadmap table, all 8 custom/bespoke diagrams, both checkpoint slides, the closing slide, representative icon-row/practical slides, and all 26 new code-example slides (including the two that initially overflowed before the font-sizing fix). No overflow, overlap, or truncation remaining.
- v3 demo pack: each of the 5 `.java` files compiled with `javac` and was run with `java` against representative sample input, output inspected manually and confirmed correct, before delivery.
- v4 demo pack update: all 8 files (5 extended + 3 new) recompiled and re-run with sample input after adding static/final/abstract coverage; output confirmed correct, including the new `TemperatureConverter` validation branch.

## Relationship to the Software Engineering course
Per the user's own framing: Java Technology teaches students to build software in Java; Software Engineering teaches students to engineer, manage, test, document, and maintain software. The same Java repository/base application could legitimately be referenced in both courses without the courses duplicating each other — this distinction is called out explicitly in both decks' "key distinction" comparison slides.
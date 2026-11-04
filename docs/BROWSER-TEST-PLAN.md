# Optional browser checks — describe only

No browser dependency or test script is included. Extend the owner's existing private WebKit script first. If a separate runner is desired, a concrete compatible tooling baseline is `@playwright/test@1.58.2` with its matching Chromium/WebKit browser downloads; retain an existing newer pinned runner if appropriate. This is a versioned proposal, not a claim about the latest release. [Official Playwright releases](https://github.com/microsoft/playwright/releases).

1. Run the existing end-to-end path in Chromium and WebKit, light/dark, at 375×812; add 320px and 430px widths plus landscape. Assert document width does not exceed viewport width after opening info boxes, dates, ratings and the editor.
2. Inspect computed input/select/textarea font sizes (at least 16px) and interactive target rectangles (at least 44px). Test Save defaults specifically. Measure labels/controls with long dough names and enlarged text.
3. Assert date fields remain inside their parent and have readable themed styles. Desktop WebKit cannot validate native iPhone wheel pickers or the on-screen keyboard.
4. With touch/coarse-pointer emulation, focus every Plan and editor field. Check the intended static-bar CSS applies and resets on blur; check focused fields and action buttons remain reachable. This does not establish native keyboard behavior: the real device checklist remains required.
5. Jump to Steps, Recipe and Rate. Assert activeElement is the intended section and its heading is not hidden behind navigation. Repeat near the end of a long checklist and with larger text.
6. Exercise all timing modes, source links/info labels, save-defaults placement, lock-in, step time editing, rating with a fixture photo, Bakes, Settings and editor back navigation. Preserve existing calculations as the expected baseline.
7. Exercise supported, unsupported, denied and unconfigured reminder capability states through the existing private harness if it supports controlled fixtures. Assert Home Screen help appears only for unsupported. A stub is not evidence of delivered push.
8. Check history back/forward, saved-state reload and an offline reload after initial caching in an isolated profile. Capture screenshots and console errors on failure. Check an update with existing saved data separately.

Desktop simulation cannot certify iOS installation, Share/Files, safe-area behavior on physical hardware, real keyboard scrolling, background push delivery, or OS permission recovery. Keep those as explicit manual results, not inferred passes.

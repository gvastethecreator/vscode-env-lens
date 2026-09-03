# Asset provenance

## Marketplace icon

- **Design date:** 2026-09-02
- **Style reference:** the user-approved Color My Workspaces marketplace icon from this portfolio.
- **Concept source:** OpenAI ImageGen, generated as a transparent RGBA cutout and retained in `icon-imagegen-source.png`.
- **Prompt direction:** a flat magnifying glass inspecting exactly three abstract key/value rows; no text, backdrop, glow, glass, gloss, shadow, or extreme saturation.
- **Approved production raster:** `source/env-lens-approved.png`, locked after removing edge artifacts from the generated concept while preserving the approved geometry and controlled amber, blue, teal, and violet palette.
- **Exports:** `icon-512.png` and `icon.png`, rendered directly from the approved transparent PNG. No SVG reinterpretation remains.

The final PNG files use a real alpha channel. Empty pixels, including all four corners, are transparent.

## Marketplace preview

- **Capture date:** 2026-09-02
- **Source:** the real VS Code web Extension Development Host running ENV Lens against the synthetic `test-workspace/alpha/.env` fixture.
- **Visible behavior:** dotenv syntax highlighting and the live Problems list produced by ENV Lens.
- **Processing:** the 1140 × 740 runtime capture was centered on a 1200 × 800 transparent RGBA canvas. No interface elements were generated, replaced, or composited.

The fixture values are synthetic and contain no user data or secrets.

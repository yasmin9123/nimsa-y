# NIMSA-Y v2

Static multi-page model-rocket design and launch-analysis prototype.

## Pages
- `index.html` — Ignition / landing page
- `design.html` — drag-and-drop component studio + CAD file selection
- `conditions.html` — weather and launch inputs
- `analysis.html` — generated estimates and four graphs
- `styles.css` — shared visual system
- `app.js` — state, design workflow, simulation and chart rendering

## GitHub Pages
Upload all files to the repository root. In Settings → Pages choose `Deploy from a branch`, `main`, `/(root)`.

## Important
This public MVP uses a local deterministic physics approximation. It does not call an actual AI model because exposing an API key in a public static GitHub Pages site would be insecure. The UI is structured so a secure backend can later replace the local analysis engine.

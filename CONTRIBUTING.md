# Contributing to react-smart-paste

Bug reports and pull requests are welcome at https://github.com/SaravananAnbu/react-smart-paste. This file covers working on the package itself; for using it, see the [README](./README.md).

## Development

```bash
npm install
npm run build      # ESM + CJS + types into dist/
npm test
npm run typecheck
```

`examples/vite` is a demo form that runs without an API key, using a mock model (plain pattern matching, labelled as such on the page). It installs the packed tarball: after changing the library, run `npm run build && npm pack`, reinstall in `examples/vite`, and restart its dev server.

### Landing page

`site/` is a static landing page with a live demo. It runs the library straight from `src/`, so it always matches this repository, and its demo uses the same kind of mock model as the example.

```bash
npm --prefix site install
npm --prefix site run dev     # local preview on port 5186
npm --prefix site run build   # static output in site/dist, deployable to any static host
```

`.github/workflows/pages.yml` publishes it to GitHub Pages on pushes to `main` that touch `site/` or `src/`. Turn Pages on first: repository Settings → Pages → Source: GitHub Actions.

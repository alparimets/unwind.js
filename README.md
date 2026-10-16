# unwind.js

A small, stateless home for gentle, nature-inspired interactive experiences.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The meadow responds softly to pointer movement. Use **Ambient sound** to start or pause its generated, looping tones, and **Full screen** to expand the canvas. Keyboard shortcuts are **Space** for sound and **F** for full screen.

## Project structure

- `src/core/` contains the activity contract and central activity registry.
- `src/activities/` contains independently loaded activity modules.
- `src/audio/` contains the ambient sound controller.
- `src/main.ts` wires the activity, controls, and browser events without storing user data.

Add an activity by implementing `Activity` and registering a dynamic import in `src/core/activityRegistry.ts`.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks and builds the production site into `dist/`.
- `npm run preview` serves the production build locally.

## Deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages when changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The production build uses `/unwind.js/` as its base path for the project’s GitHub Pages URL. The app is stateless and requires no account, server, or database.

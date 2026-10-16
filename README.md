# unwind.js

A small, stateless home for gentle, nature-inspired interactive experiences.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The meadow responds softly to pointer movement. Use **Ambient sound** to start or pause its generated, looping tones, and **Full screen** to expand the canvas. Keyboard shortcuts are **Space** for sound and **F** for full screen.

The canvas fills the viewport. Choose **Meadow**, **Dusk**, **Mist**, or **Nightfall** to change the colors and generated tones. With sound enabled, hovering over or touching a floating particle plays a soft, spatialized chime. The mixer adjusts synthesized rain/wind, drone, and particle chime layers independently. The breathing guide supports 4-7-8, box, and calm rhythms; the session timer is a configurable countdown.

Controls fade after five seconds of mouse inactivity and reappear when the pointer moves. Touch and keyboard users can show or hide the controls with the always-visible control button.

## Project structure

- `src/core/` contains the activity contract and central activity registry.
- `src/activities/` contains independently loaded activity modules.
- `src/audio/` contains the reusable Web Audio engine and generated sound layers.
- `src/main.ts` wires the activity, controls, and browser events without storing user data.

Add an activity by implementing `Activity` and registering a dynamic import in `src/core/activityRegistry.ts`.

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks and builds the production site into `dist/`.
- `npm run preview` serves the production build locally.

## Deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds the site and deploys it to GitHub Pages when changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The production build uses `/unwind.js/` as its base path for the project’s GitHub Pages URL. The manifest and service worker support installation and offline visits after the app has loaded online once. Service workers require HTTPS or `localhost`.

The theme, countdown duration, and sound levels are stored in the URL hash, so **Copy room link** can share a setup, for example:

```text
#theme=dusk&timer=10&rain=0.32&drone=0.55&chimes=0.70
```

The app remains stateless: shared settings live only in the URL, with no account, server, or database.

## Code quality analysis

SonarQube Cloud analyzes pushes to `main` and pull requests targeting `main` through `.github/workflows/sonar.yml`. To enable analysis:

1. Create a project for this repository in SonarQube Cloud and generate an analysis token.
2. Add the token as the `SONAR_TOKEN` Actions secret in the GitHub repository.
3. Add the `SONAR_ORGANIZATION` and `SONAR_PROJECT_KEY` Actions variables using the values shown for the SonarQube Cloud project.

Analysis results and quality-gate reports are available in the SonarQube Cloud project. Fork pull requests do not receive repository secrets, so their analysis cannot authenticate unless a separate secure setup is provided.

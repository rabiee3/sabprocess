# HSCode app

Mobile-first React PWA behind sabprocess.com/hscode: who makes what, who needs what, mapped factory by factory.
Stack: Vite, React 19, Tailwind 4, react-router, Firebase (Auth, Firestore), i18next (EN and AR, RTL).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server against production Firebase (`hscode-egypt`). |
| `npm run emu` | Starts the Firestore and Auth emulators (project `demo-hscode`). |
| `npm run emu:dev` | Dev server in emulator mode on port 5174 (run `npm run emu` and `npm run seed:emu` first). |
| `npm run seed:emu` | Seeds the running emulators: sample factories, invites `482913` (unused) and `012345`, users `s1` and `c1`, a rejected factory, two pending factories, and the admin sign-in `admin@example.test` / `emulator-only-123` (emulator only; the seed refuses to run without both emulator hosts). |
| `npm test` | Unit tests (Vitest, jsdom). |
| `npm run test:rules` | Firestore rules tests, run inside the emulator. |
| `npm run e2e` | Playwright (mobile and desktop) against the emulators; starts and stops them itself. |
| `npm run lint`, `npm run typecheck` | Oxlint, and `tsc -b` over `src`, `tests`, `e2e` and `seed`. |
| `npm run build` | Type-checks and builds into `../hscode` (served by Vercel). |
| `npm run check:build` | Verifies the build output. |
| `npm run verify` | Everything above in order: the gate before every commit. |
| `npm run deploy:rules` | Deploys `firestore.rules` to `hscode-egypt`. |

## Emulators

Anything in emulator mode (`--mode emulator`, `VITE_USE_EMULATOR=true`) talks only to `demo-hscode` on `127.0.0.1:8080` (Firestore)
and `127.0.0.1:9099` (Auth), and sets `data-emulator="true"` on `<html>`. The e2e suite asserts that marker, so it can never
run against production. Google sign-in in the emulator is a fake account chooser popup ("Add new account").
Never kill emulator processes by hand: `scripts/with-emulators.mjs` stops leftovers itself.

## Deploy

1. `npm run verify` (it rebuilds `../hscode`).
2. Commit the rebuilt `../hscode` together with the source. Vercel serves it, with `/hscode/*` rewritten to the SPA.
3. Rules changes: `npm run deploy:rules`.

`/__/auth/*` is proxied by `vercel.json` to the Firebase auth handler so redirect sign-in works on iPhone home-screen installs
(`authDomainFor` in `src/firebase/config.ts` picks the site's own host on sabprocess.com).

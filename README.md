# NSCA frontend (Expo – phone and web from one codebase)

One Expo project. The same screens run in **Expo Go on a phone** and **in a web browser**.
It talks to the NSCA FastAPI backend (`/health`, `/questions`, `/identify`, `/model-status`, `/clusters`).

## Screens

| Route | File | What it does |
|---|---|---|
| `/` | `src/app/index.tsx` | Server status, disease set, start button, how the 3 stages work |
| `/assess` | `src/app/assess.tsx` | Searchable symptom questions; follow-ups (pain location, intensity…) appear when a symptom is ticked; optional risk factors |
| `/result` | `src/app/result.tsx` | Known disease or "possible new pattern", confidence, and every stage: candidates with pass/fail checks, HPO terms, symptom comparison, decision rule, similar past patients, ESOINN group |
| `/model` | `src/app/model.tsx` | Model details for the selected disease set |
| `/settings` | `src/app/settings.tsx` | Backend address and disease set (saved on the device / in the browser) |

Shared code: `src/lib/api.ts` (typed API client), `src/lib/settings.tsx` (settings + last result),
`src/components/ui.tsx` (UI kit), `src/lib/theme.ts`.

## Run it

Start the backend first (in the backend folder):

```bash
uvicorn app.api.main:app --reload --host 0.0.0.0
```

Then in this folder:

```bash
npm install
npx expo start          # press w for web, or scan the QR code with Expo Go
npx expo start --web    # web only
```

* **Web:** opens at http://localhost:8081 and uses http://localhost:8000 for the backend.
* **Phone (Expo Go, SDK 58):** phone and laptop on the same Wi-Fi. The app guesses the backend address from
  the Expo dev server (your laptop's IP, port 8000). If it cannot connect, set it in Settings,
  e.g. `http://192.168.1.20:8000` (find the IP with `ipconfig`). Allow Python through Windows Firewall.
* Fixed address for any build: create `.env` with `EXPO_PUBLIC_API_URL=https://your-backend.onrender.com`.

## Build the website

```bash
npx expo export --platform web     # writes dist/
```

`dist/` is a static single-page site: host it on Netlify, Vercel, Render static site or EAS Hosting.
Set the host to send unknown paths to `index.html`, and set `CORS_ORIGINS` on the backend to the site's URL.

## Checks

```bash
npx tsc --noEmit
```

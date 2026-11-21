# web (owner: Caua)

Phaser 3 campus view. Next.js (App Router) + TypeScript + Tailwind on port 5173.

```sh
cd web
npm install
npm run dev        # http://localhost:5173
```

- `http://localhost:5173/?fake` runs on a built-in fake state, no server needed.
- Without `?fake` it loads `GET /state` and listens on `WS /ws` from
  `NEXT_PUBLIC_SERVER_URL` (default `http://localhost:8600`). Start the server first.
- Reads `../campus/campus.json` (Turbopack root is the repo root).
- Checks: `npm run typecheck`, `npm test`, `npm run build`.

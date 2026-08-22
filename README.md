# INFRA-SIGNAL

Операционный цифровой двойник городской инфраструктуры: карта Астаны,
инженерные сети, корреляция сигналов, журнал событий и защищённый контур
адаптеров. Приложение работает на [vinext](https://github.com/cloudflare/vinext)
и хранит нормализованные события в Cloudflare D1.

## Adapter data plane

Браузер и hosted Worker не подключаются напрямую к MQTT или OPC UA. Протоколы
SCADA завершаются в локальном/ведомственном gateway, после чего адаптер отправляет
единый HTTPS-конверт в `POST /api/adapters/ingest`. Аналогично работают webhook
службы 109, polling-адаптер e‑Өтініш и версионный GIS-импорт.

Запись закрыта секретом `INFRA_ADAPTER_KEY` (не менее 24 символов), который
передаётся как `x-infra-adapter-key` или `Authorization: Bearer ...`. Если секрет
не настроен, endpoint отвечает `503` и остаётся заблокированным.

```json
{
  "source": "scada",
  "external_id": "scada-wm042-20260822T104211Z",
  "occurred_at": "2026-08-22T10:42:11.000Z",
  "asset_id": "WM-042",
  "event_type": "telemetry",
  "summary": "Падение давления на 31%",
  "payload": {
    "metric": "pressure",
    "value": 2.8,
    "unit": "bar",
    "quality": 99.7,
    "latitude": 51.1218,
    "longitude": 71.4924
  }
}
```

Endpoint принимает одиночный конверт или `{ "events": [...] }` до 100 событий.
Перед записью проверяются схема, время, координаты и размер; уникальная пара
`source + external_id` обеспечивает идемпотентность. Управляющие команды через
этот endpoint не выполняются. `GET /api/operations/snapshot` отдаёт состояние
адаптеров, последние события и телеметрию; до первого реального пакета интерфейс
явно показывает детерминированный demo fallback.

## Prerequisites

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Sites Lifecycle

The Sites lifecycle CLI runs the locked dependency install before returning this checkout. Edit the source under `app/`, then checkpoint when a coherent milestone is ready to inspect or share. The remote Sites builder runs `npm run build` against the pushed commit. Do not repeat install or build as a normal pre-checkpoint step.

This starter does not use `wrangler.jsonc`.

`install:ci` is intentionally a single, non-retrying `npm ci`. It refuses a concurrent install for the same project, consumes a matching image-seeded npm cache with `--prefer-offline` while retaining registry fallback for a missing cache object, otherwise downloads and verifies the complete vinext tarball recorded in `package-lock.json`, limits npm to one socket, and terminates a stalled install. `build` applies a short timeout and then validates the Sites artifact. These helpers target Linux and use GNU `timeout`; they are not native macOS scripts.

Scripts that need writable project-scoped home, npm, XDG, and temporary paths use `scripts/sites-env.sh`. The `dev` and `start` scripts honor the caller's runtime environment and keep Wrangler logs inside the checkout. The generated `.sites-runtime/` directory is disposable and ignored by Git.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares the Sites D1 binding used by the event journal
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` injects request-scoped D1 and secret bindings into the API handlers
- `db/schema.ts` contains adapter events, adapter health and latest telemetry
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Diagnostic Commands

- `npm run install:ci`: perform the one bounded lockfile install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build and validate the deployable Sites artifact
- `npm run start`: start the built Vinext application
- `npm test`: build, validate, and verify the rendered development-preview metadata
- `npm run validate:artifact`: recheck an existing artifact's manifest and ESM `default.fetch` export
- `npm run db:generate`: generate Drizzle migrations after schema changes

Use build and validation commands for targeted diagnosis after a remote failure, not as part of the normal checkpoint path.

The timeout defaults can be overridden for a controlled canary with `SITES_INSTALL_TIMEOUT`, `SITES_INSTALL_KILL_AFTER`, `SITES_BUILD_TIMEOUT`, and `SITES_BUILD_KILL_AFTER`. A timeout fails the command; the helpers never retry an unchanged install or build.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

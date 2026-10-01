# Orpia Home frontend

An Expo SDK 57 / React Native smart home app for Android, iOS, and web.

## Run

Use Node.js 22.13 or newer (Expo SDK 57 requirement).

```sh
npm install
npm start
# or
npm run web
```

Without an API URL the app shows a labeled, deterministic demo home. Demo device registrations and changes last for the running session. Home name, appearance, temperature unit, and automatic refresh preferences persist locally. Recent activity is session-only.

## Connect your backend

Copy `.env.example` to `.env.local`, set `EXPO_PUBLIC_API_URL` to the API base URL, then restart Expo. The app does not fall back to sample data when a configured backend fails. The base URL may contain a path prefix, for example `https://api.example.com/v1`.

Implement these endpoints or adapt `src/services/IoTService.ts` to the backend's existing routes. Responses are direct JSON values, without a `data` envelope.

| Method | Path | Body | Successful response |
| --- | --- | --- | --- |
| GET | `/gateway` | — | `{ "connected": true, "name": "Home gateway" }` |
| GET | `/devices` | — | Array of Device objects |
| GET | `/sensors` | — | SensorData object |
| POST | `/devices` | `{ "name": "Desk lamp", "room": "Study", "type": "light" }` | Created Device object |
| PATCH | `/devices/:id` | `{ "status": true }` | Updated Device object with the same id |
| DELETE | `/devices/:id` | — | HTTP 204 (no body) |

Device:
```json
{ "id": 1, "name": "Desk lamp", "room": "Study", "type": "light", "status": true, "online": true }
```
Device ids must be unique safe integers. Types: `light`, `fan`, `lock`, `outlet`. `status: true` means on for power devices and locked for locks. Device icons and labels are derived on the frontend. The backend is responsible for authorization, device discovery/pairing, and executing physical commands. The registration form sends metadata; it does not scan or provision hardware.

SensorData:
```json
{ "temperature": 26.4, "humidity": 62, "lightLevel": 680, "updatedAt": "2026-10-01T10:00:00.000Z" }
```
Always return Celsius, relative humidity percentage, lux, and an ISO timestamp. Fahrenheit is a display conversion. Previous readings remain visible during failures, alongside an error and their timestamp.

### Authentication and networking

Call `setAccessTokenProvider(async () => token)` from the backend's future authentication integration. The API then sends `Authorization: Bearer <token>`. No sign-in screen or token storage is implemented because no auth contract was provided. Never place credentials in `EXPO_PUBLIC_*` variables; they are included in the client bundle.

Use HTTPS. For web, enable CORS for the deployed frontend origin, including GET/POST/PATCH/DELETE, Authorization, and Content-Type. A physical phone's localhost points to that phone, not your development computer. Use a reachable development server address or HTTPS tunnel.

Requests time out after 12 seconds. Device switches update optimistically and roll back on failure. Commands cannot overlap for the same device; refreshes do not overwrite pending commands. Gateway connection is read from the server, not a pretend connection switch. Data refreshes every 30 seconds while active if enabled in Settings. There are no push notifications, realtime subscriptions, or sensor history endpoints yet.

## Validate

```sh
npm run typecheck
npm test
npm run export
```

Service contract tests cover demo commands, HTTP routes, bearer headers, invalid responses, authorization errors, and timeouts. Before release, test the app on physical Android and iOS devices with your backend, including offline devices, command errors, empty lists, and gateway outages. Exporting bundles does not replace native device testing.

Expo versioned reference: https://docs.expo.dev/versions/v57.0.0/

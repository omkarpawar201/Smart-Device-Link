# Smart Device Link (LinkBridge)

An open-source, self-hosted phone-to-PC integration platform built with **Electron** and **React**. LinkBridge mirrors your Android phone's notifications, messages, calls, contacts, photos and files onto your Windows desktop — and lets you control them right from the PC, without cloud services.

## Features

- **Home dashboard** — battery, network, signal and device status at a glance, with quick actions and a "now playing" widget
- **Notifications** — live mirroring, per-notification dismissal and quick replies (where the source app supports them)
- **Messages** — browse SMS threads, read conversations and send replies from your desktop
- **Calls** — recent call history, dial pad, incoming-call overlay, mute / audio-target / ringer controls over Bluetooth HFP
- **Contacts** — synced address book with search and grouping
- **Photos** — thumbnail gallery with lazy photo streaming over the `photo-cache://` protocol and one-click download
- **Files** — full phone storage browser with drag-and-drop upload, download, folder creation and deletion over SFTP
- **Shared clipboard** — automatic cross-device text sync with history, send/copy/pin
- **Media control** — bidirectional playback control, seek and volume between phone and PC (KDE Connect media + Windows SMTC)
- **Screen mirroring** — full control of your phone from the PC via `scrcpy` over adb Wi-Fi
- **Remote camera** — remote shutter control UI
- **AI Assistant** — local context summaries, smart replies and file/photo search helpers
- **Unified activity timeline** — notifications, calls and clipboard events in one feed
- **Frameless acrylic window** — custom title bar, theme toggle and system tray support

## Tech Stack

| Layer      | Technology |
| ---------- | ---------- |
| Desktop    | Electron 29 |
| UI         | React 18, JSX, Tailwind CSS v4, Vite 5, lucide-react |
| Backend    | Node.js IPC (`src/ipc/bridge.js`), KDE Connect protocol |
| Connectivity | Local network (KDE Connect / UDP discovery), Bluetooth RFCOMM (HFP), SFTP (SSH2) |
| Mirroring  | scrcpy + adb over Wi-Fi |

## Architecture

```
main.js              Electron main process (window, tray, protocol, bridge boot)
preload.js           contextBridge — exposes a safe window.api surface to the renderer
src/ipc/bridge.js    KDE Connect bridge: discovery, pairing, notifications, SMS,
                     telephony, media, files, clipboard + photo streaming
src/kdeconnect/      KDE Connect protocol plugins
src/bluetooth/       RFCOMM client + HFP call audio plumbing (native helper)
src/mirror/          scrcpy/adb screen-mirroring backend
src/system/          Windows helpers (e.g. media-keys)
renderer/            React app (Vite): AppShell + 15 pages + design system
```

The renderer talks to the backend exclusively through the `window.api` bridge exposed by `preload.js` — no Node APIs are exposed to the UI directly (`contextIsolation` is on).

## Requirements

- **Node.js 18+** and npm
- **Windows 10/11** (frameless window, tray and HFP audio are Windows-focused)
- **Phone companion** — the LinkBridge Android app (or KDE Connect) running on the same Wi-Fi network
- **scrcpy + adb** (optional, for screen mirroring):
  ```
  winget install Genymobile.scrcpy
  ```
- Android **Wireless Debugging** enabled for mirroring (`adb connect <ip>:<port>`)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run in development (Vite dev server + Electron)
npm run dev

# 3. Production build
npm run build:vite        # bundles the renderer into dist/
npm run build             # renderer build + electron-builder package
```

## Connecting a Phone

1. Install the companion app on your Android phone and make sure both devices are on the same network.
2. Open **Settings → Discovered devices** in LinkBridge, hit **Scan** and **Pair** your phone.
3. Approve the pairing request on either side.
4. Grant the phone app the permissions you want to use (notifications, SMS, contacts, files).

> The link uses the KDE Connect protocol over your local network. No accounts, no cloud — pairing is direct between your PC and phone.

## Notes

- File transfers use SFTP with a self-signed certificate generated at runtime.
- Photo thumbnails are downloaded on demand through a custom `photo-cache://` protocol.
- Call audio routing (PC speakers vs. phone earpiece) requires the Bluetooth HFP link.
- The `android/` companion app lives in its own repository.

## License

MIT — see `package.json`.

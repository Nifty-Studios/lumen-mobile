# Lumen for Android

The Android app for Lumen, a lighter, local-first take on Notion. Pages live in SQLite on the phone; the screens are native, and the block editor is [BlockNote](https://www.blocknotejs.org/) running in an Expo DOM component.

Built with Expo SDK 58 and Expo Router. The data layer comes from [`lumen-shared`](https://github.com/Nifty-Studios/lumen-shared), which must be checked out at `../shared`.

```sh
pnpm install
pnpm android      # build the dev client and install it on a USB-connected phone
pnpm start        # Metro, for an already-installed dev build
pnpm typecheck
```

| Path | |
|---|---|
| `src/db/lumen.ts` | expo-sqlite driver for `@lumen/shared/client` |
| `src/app/` | Routes: page tree, page, search, trash |
| `src/components/PageEditor.tsx` | `'use dom'` title + BlockNote editor; edits come back through `onSave` / `onRename` |
| `metro.config.js` | Watches `../shared` and resolves its imports from this app's `node_modules` |

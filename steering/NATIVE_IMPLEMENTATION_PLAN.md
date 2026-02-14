# Native iOS & Android Implementation Plan

How Quintus 2.0 games ship to iOS and Android app stores as native apps, supporting both 2D and 3D renderers.

---

## Executive Summary

There are three viable tiers for shipping Quintus games to mobile:

1. **Tier 1 (Recommended): Capacitor WebView wrapper** — ship your web game as a native app with full App Store / Play Store distribution, native API access, and minimal overhead. This is what Vampire Survivors uses.

2. **Tier 2 (Advanced): Embedded JS engine + native renderer** — embed V8/JSC directly, render via Metal/Vulkan. Maximum performance, significantly more engineering effort. This is what Cocos Creator does.

3. **Tier 3 (Fallback): PWA** — no wrapper needed, but limited capabilities, no App Store presence on iOS, and storage gets evicted after 7 days of inactivity.

The recommendation: **start with Tier 1 (Capacitor)** and ship a `@quintus/native` package that handles the wrapper. Only invest in Tier 2 if performance ceilings are hit.

---

## The Landscape: How Other Engines Do It

| Engine | Approach | Native Rendering? | JS Engine | Bundle Size |
|--------|----------|-------------------|-----------|-------------|
| **Phaser** | Capacitor/Cordova WebView wrapper | No (WebGL in WebView) | WKWebView JSC / Chrome V8 | ~2-5MB overhead |
| **Construct** | WebView wrapper (NW.js desktop, Cordova/Capacitor mobile) | No (WebGL in WebView) | WKWebView JSC / Chrome V8 | ~2-5MB overhead |
| **PlayCanvas** | WebView wrapper or plain mobile browser | No (WebGL in WebView) | System WebView | ~2-5MB overhead |
| **Cocos Creator** | Embedded V8 + C++ native renderer (Metal/Vulkan) | Yes | V8 (native), JSC (web) | ~8-15MB |
| **Defold** | Native C++ engine, Lua scripting via LuaJIT | Yes | LuaJIT | ~3-5MB |
| **Godot** | Native C++ engine, GDScript/C# | Yes | Custom | ~15-30MB |

Key takeaway: **every successful web-first game engine uses WebView wrappers for mobile**. Only engines that were designed native-first (Cocos, Defold, Godot) use embedded scripting + native rendering. The web-first engines (Phaser, Construct, PlayCanvas) all use the WebView approach and ship real games to app stores.

---

## Tier 1: Capacitor WebView Wrapper (Recommended)

### How It Works

[Capacitor](https://capacitorjs.com/) wraps your web app in a native shell:
- **iOS:** WKWebView (WebKit + Nitro JIT) inside a native Swift/ObjC app
- **Android:** Chromium-based Android WebView (V8 JIT) inside a native Kotlin/Java app

Your Quintus game runs unchanged — the same HTML/JS/CSS bundle that works in the browser runs inside the native WebView with full WebGL support.

```
┌─────────────────────────────────────────┐
│           Native App Shell              │
│  ┌───────────────────────────────────┐  │
│  │         System WebView            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │     Quintus Game            │  │  │
│  │  │  (Canvas2D or WebGL/Three)  │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Native Plugins (Swift/Kotlin)          │
│  ├── Haptics                            │
│  ├── In-App Purchases                   │
│  ├── Game Center / Play Games           │
│  ├── Push Notifications                 │
│  ├── Status Bar / Safe Areas            │
│  └── Local Storage / Filesystem         │
└─────────────────────────────────────────┘
```

### Performance Reality

**WebGL performance in mobile WebViews is good enough for most 2D and moderate 3D games:**

- WKWebView on iOS: Full WebGL 2.0 support, Metal-backed, JIT-enabled JavaScript (Nitro). Performance is ~70-80% of native Safari. The JIT warmup ("OMG pass") can cause stutters in the first ~30 seconds for large WASM bundles but is fine for pure JS games.
- Android WebView: Chromium-based, V8 JIT, WebGL 2.0. Regularly updated via Play Store. Performance roughly matches Chrome on Android.
- Canvas2D: Fully hardware-accelerated on both platforms. Quintus's Canvas2D renderer works well for sprite-heavy 2D games.
- **Realistic target: 60fps for 2D games with hundreds of sprites, 30-60fps for moderate 3D scenes via Three.js.**

**Known limitations:**
- iOS memory cap: ~1.4-1.5GB per WebView page (affects very large games)
- iOS 15+ had a "GPU Process: Canvas Rendering" flag that could halve WebGL performance — resolved in later versions
- No WebGPU in WebViews yet (available in browsers, not in embedded WebViews)
- Three.js 3D rendering is functional but won't match native Metal/Vulkan for complex scenes

### Native API Access via Capacitor Plugins

| Feature | Plugin | Status |
|---------|--------|--------|
| Haptics | `@capacitor/haptics` | Official, stable |
| In-App Purchases | `capacitor-purchases` (RevenueCat) | Community, mature |
| Game Center | `capacitor-game-connect` | Community |
| Google Play Games | `capacitor-game-connect` | Community |
| Push Notifications | `@capacitor/push-notifications` | Official, stable |
| Status Bar | `@capacitor/status-bar` | Official, stable |
| Screen Orientation | `@capacitor/screen-orientation` | Official |
| Filesystem | `@capacitor/filesystem` | Official, stable |
| Share | `@capacitor/share` | Official |
| App Launcher / Deep Links | `@capacitor/app` | Official |

### What `@quintus/native` Would Provide

A Quintus plugin that abstracts the Capacitor bridge:

```typescript
import { Game } from "@quintus/core";
import { NativePlugin } from "@quintus/native";

const game = new Game({ width: 800, height: 600 });
game.use(NativePlugin);

// Unified API regardless of platform
game.native.haptics.impact("medium");
game.native.orientation.lock("landscape");
game.native.safeArea; // { top: 47, bottom: 34, left: 0, right: 0 }

// In-app purchases (wraps RevenueCat or direct StoreKit/Billing)
const products = await game.native.store.getProducts(["remove_ads", "coin_pack"]);
await game.native.store.purchase("remove_ads");

// Game services (Game Center / Google Play Games)
await game.native.gameServices.signIn();
await game.native.gameServices.submitScore("leaderboard_id", 1000);
await game.native.gameServices.unlockAchievement("first_blood");

// Platform detection
if (game.native.platform === "ios") { ... }
if (game.native.platform === "android") { ... }
if (game.native.platform === "web") { ... } // graceful fallback
```

### Capacitor Project Structure

```
my-quintus-game/
├── src/                    # Quintus game source
│   ├── main.ts
│   ├── player.ts
│   └── ...
├── dist/                   # Built web assets (Vite output)
├── ios/                    # Xcode project (auto-generated by Capacitor)
│   └── App/
├── android/                # Android Studio project (auto-generated)
│   └── app/
├── capacitor.config.ts     # Capacitor configuration
├── package.json
└── vite.config.ts
```

### Build Flow

```bash
# Development (web)
pnpm dev                    # Vite dev server at localhost:3050

# Build for mobile
pnpm build                  # Build web assets
npx cap sync                # Copy to native projects + update plugins

# Run on device
npx cap run ios             # Build and run on iOS simulator/device
npx cap run android         # Build and run on Android emulator/device

# Open in IDE for native customization
npx cap open ios            # Open Xcode
npx cap open android        # Open Android Studio
```

### App Store Considerations

**iOS App Store:** WebView-based apps are explicitly allowed. Apple's guidelines permit apps that use WKWebView as their primary interface. Vampire Survivors, built with web tech + Capacitor, is a top game on the App Store. The key requirement: the app must provide value beyond what a website offers (which a game inherently does).

**Google Play Store:** Even more permissive. PWAs and WebView apps are common and explicitly supported via TWA (Trusted Web Activity) or Capacitor.

---

## Tier 2: Embedded JS Engine + Native Renderer (Advanced)

### How It Works

Instead of running inside a WebView, embed a JavaScript engine directly in the native app and bridge it to a native renderer:

```
┌─────────────────────────────────────────┐
│           Native App                    │
│                                         │
│  ┌─────────────────┐  ┌──────────────┐ │
│  │  JS Engine       │  │  Native      │ │
│  │  (V8 or JSC)     │←→│  Renderer    │ │
│  │                   │  │  (Metal /   │ │
│  │  Quintus game     │  │   Vulkan)   │ │
│  │  logic runs here  │  │             │ │
│  └─────────────────┘  └──────────────┘ │
│          ↕ JSB Bridge                   │
│  ┌───────────────────────────────────┐  │
│  │  C++ Rendering Abstraction        │  │
│  │  (translates draw calls to GPU)   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

This is the Cocos Creator approach:
- **TypeScript game logic** runs in an embedded V8 engine
- **C++ rendering layer** handles Metal (iOS) / Vulkan (Android) draw calls
- A **JavaScript Binding (JSB)** bridge connects them
- The TypeScript API stays the same — only the renderer backend changes

### Performance Characteristics

- **JS Engine:** V8 and JSC both support full JIT compilation when embedded (unlike the WebView case where iOS historically restricted JIT). V8 adds ~8-12MB to the binary.
- **Rendering:** Native Metal/Vulkan rendering is 2-5x faster than WebGL in a WebView for complex scenes. For simple 2D games, the difference is negligible.
- **Bridge overhead:** Modern JSB (V8 isolates, JSC C API) adds ~0.01-0.05ms per frame for typical bridge traffic. Negligible at 60fps.
- **Startup time:** Faster than WebView (no HTML parsing, no DOM). Cold start in ~200-500ms.

### What This Would Require

This is a major engineering effort — essentially building a native rendering backend:

1. **Embed V8 (Android) and JSC (iOS)** — or use a single engine like QuickJS for both platforms (simpler but no JIT)
2. **Implement a native `Renderer`** that satisfies Quintus's `Renderer` interface but calls Metal/Vulkan instead of Canvas2D/WebGL
3. **For 2D:** Implement a batched sprite renderer in Metal/Vulkan (or use Skia as the backend)
4. **For 3D:** Would need to either embed Three.js (which needs WebGL) or write a native 3D renderer
5. **Asset pipeline:** Load images, audio, models via native APIs instead of browser APIs
6. **Input bridge:** Touch events from native → JS game loop
7. **Audio bridge:** Native audio APIs instead of Web Audio

### Potential Shortcut: React Native Skia

[React Native Skia](https://github.com/Shopify/react-native-skia) provides a GPU-accelerated Skia canvas accessible from JavaScript, with native performance on iOS and Android. It runs Skia (the same rendering engine Chrome uses) directly on the GPU, with a JavaScript bridge via JSI (synchronous, no serialization overhead).

A hypothetical `@quintus/native-skia` renderer could:
- Implement Quintus's `DrawContext` interface using react-native-skia's Canvas API
- Get native-speed 2D rendering without building a Metal/Vulkan renderer from scratch
- Use the same JS codebase, just a different rendering backend

```typescript
// Hypothetical: Quintus game running in React Native with Skia renderer
import { Game } from "@quintus/core";
import { SkiaRenderer } from "@quintus/native-skia";

const game = new Game({
  width: 800,
  height: 600,
  renderer: new SkiaRenderer(skiaCanvas),
});
```

**Trade-offs:** This adds a React Native dependency (large), and Skia is 2D-only (no 3D path). It's interesting for 2D games that need native performance but impractical for the general case.

### When Tier 2 Makes Sense

- Game needs >1000 simultaneous sprites at 60fps on older phones
- Complex 3D scenes that push WebGL limits
- Competitive multiplayer where input latency matters (WebView adds ~1-2 frames of input lag)
- Very large games that hit iOS's 1.5GB WebView memory limit

---

## Tier 3: Progressive Web App (Fallback)

### How It Works

No wrapper at all. The game runs in the mobile browser as a PWA:

```typescript
// Register service worker for offline support
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

### Current Capabilities (2025-2026)

| Feature | iOS | Android |
|---------|-----|---------|
| Offline play | Yes (service worker) | Yes |
| Add to home screen | Yes | Yes (with install prompt) |
| Push notifications | Yes (iOS 16.4+, must be on home screen) | Yes |
| Full screen | Yes (standalone display mode) | Yes |
| WebGL 2.0 | Yes | Yes |
| In-app purchases | No (Apple Pay only via Payment Request API) | No |
| App Store listing | No | Yes (via TWA / Play Store) |
| Persistent storage | Evicted after 7 days inactivity on iOS | Persistent |
| Game Center / Play Games | No | No |
| Haptics | Limited (Vibration API) | Limited |

### Why PWA Is a Fallback, Not the Primary Strategy

- **No iOS App Store presence** — invisible to the largest mobile game market
- **Storage eviction** — iOS deletes all cached data after 7 days of inactivity
- **No in-app purchases** — can't monetize through standard mobile patterns
- **No game services** — no leaderboards, achievements, cloud saves
- **User friction** — "add to home screen" is not a natural mobile user behavior

PWA makes sense as a **demo/discovery channel** — "try the game in your browser, download the app for the full experience."

---

## WebGPU: The Future

### Current Mobile Status (Early 2026)

| Platform | WebGPU Status |
|----------|--------------|
| Chrome Android (121+) | Supported on Android 12+ with Qualcomm/ARM GPUs |
| Safari iOS 26+ | Supported and enabled by default |
| WKWebView (Capacitor iOS) | Not yet available in embedded WebViews |
| Android WebView | Not yet available in embedded WebViews |
| Firefox Android | Behind a flag, expected 2026 |

**Key limitation:** WebGPU works in **browsers** but **not in embedded WebViews** (WKWebView, Android WebView). This means Capacitor-wrapped apps can't use WebGPU yet. This is likely to change as WebGPU matures, but the timeline is unclear.

**Implication for Quintus:** Design the renderer abstraction to support WebGPU when it becomes available in WebViews, but don't depend on it. WebGL 2.0 in WebViews is the reliable baseline.

---

## What Quintus Needs to Build

### Package: `@quintus/native`

A Capacitor plugin + Quintus game plugin that handles native wrapper concerns:

```typescript
// packages/native/src/index.ts

export interface NativePlugin extends Plugin {
  readonly name: "native";
  readonly platform: "ios" | "android" | "web";
  readonly safeArea: { top: number; bottom: number; left: number; right: number };
  readonly haptics: HapticsAPI;
  readonly orientation: OrientationAPI;
  readonly store: StoreAPI;
  readonly gameServices: GameServicesAPI;
}

interface HapticsAPI {
  impact(style: "light" | "medium" | "heavy"): void;
  notification(type: "success" | "warning" | "error"): void;
  vibrate(duration?: number): void;
}

interface OrientationAPI {
  lock(orientation: "portrait" | "landscape" | "any"): void;
  unlock(): void;
  readonly current: "portrait" | "landscape";
}

interface StoreAPI {
  getProducts(ids: string[]): Promise<Product[]>;
  purchase(id: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<Purchase[]>;
}

interface GameServicesAPI {
  signIn(): Promise<void>;
  submitScore(leaderboardId: string, score: number): Promise<void>;
  unlockAchievement(id: string): Promise<void>;
  showLeaderboard(id: string): Promise<void>;
}
```

**On web, all methods are no-ops or graceful fallbacks.** The game code doesn't need platform checks — the API handles it.

### CLI: `create-quintus` Mobile Support

The `create-quintus` scaffolding tool (Phase 12) should support mobile targets:

```bash
npm create quintus my-game

? What platforms do you want to target?
  ◉ Web (browser)
  ◉ iOS (via Capacitor)
  ◉ Android (via Capacitor)
  ○ Desktop (via Tauri)
```

When mobile is selected, the scaffolding adds:
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android` dependencies
- `capacitor.config.ts` pre-configured for games (full screen, landscape, no bounce)
- iOS/Android project shells ready to build
- `@quintus/native` plugin wired up

### Mobile-Specific Game Configuration

```typescript
const game = new Game({
  width: 1280,
  height: 720,
  scale: "fit",        // Scale canvas to fill screen
  pixelArt: true,      // Disable image smoothing
  backgroundColor: "#000",
});

game.use(NativePlugin);

// Mobile-optimized defaults
if (game.native.platform !== "web") {
  game.native.orientation.lock("landscape");
  // Safe area insets for notch/dynamic island
  const safe = game.native.safeArea;
  game.camera.setMargins(safe);
}
```

### How Both Renderers (2D and 3D) Work in the Wrapper

**Canvas2D games (default Quintus):**
- Canvas2DRenderer draws to an HTML `<canvas>` element
- WebView composites this canvas to the screen via the system GPU
- No changes needed — works identically to browser

**WebGL/Three.js games (@quintus/three):**
- ThreeRenderer uses WebGL 2.0 via the WebView
- WKWebView's WebGL is Metal-backed — not a software fallback
- Android WebView's WebGL uses the system GPU directly
- Performance is good for moderate 3D scenes (hundreds of meshes, standard materials)

```
Game Code (TypeScript)
    │
    ├─── Canvas2DRenderer ─── Canvas2D API ─── WebView ─── GPU
    │                                          (same as browser)
    │
    └─── ThreeRenderer ─── WebGL 2.0 ─── WebView ─── Metal (iOS) / GLES (Android)
                                          (hardware accelerated)
```

**Both paths work in the Capacitor wrapper without modification.** The game developer doesn't need to change anything — the same build runs in the browser and on mobile.

---

## Core Engine Changes Needed

### Changes Required for Tier 1 (Capacitor)

Almost none. Capacitor runs standard web code. The only requirements:

1. **Responsive canvas scaling** — already planned (`scale: "fit"` in GameOptions)
2. **Touch input support** — handle touch events in `@quintus/input` (already planned for Phase 3)
3. **`@quintus/native` plugin** — new package, doesn't affect core
4. **Asset loading** — works unchanged (relative URLs, same as browser)

### Changes Required for Tier 2 (Embedded Engine)

Significant but isolated:

1. **Renderer interface** — already planned (see 3D_IMPLEMENTATION_PLAN.md)
2. **Native rendering backend** — new code, doesn't affect existing renderers
3. **Asset loading abstraction** — currently uses browser APIs (Image, fetch). Would need a `NativeAssetLoader` that uses filesystem APIs
4. **Audio abstraction** — currently uses Web Audio API. Would need native audio bridge
5. **Input abstraction** — currently uses DOM events. Would need native touch bridge
6. **Game loop** — currently uses `requestAnimationFrame`. Would need native display link

These are all **abstraction extractions** — pulling out browser assumptions and making them pluggable. The game logic, scene tree, signals, and all gameplay code stays identical.

---

## Recommended Timeline

| Work | When | Depends On |
|------|------|------------|
| Touch input in `@quintus/input` | Phase 3 (Sprites & Input) | — |
| Responsive canvas scaling | Phase 1 (already done) | — |
| `@quintus/native` Capacitor plugin (basic: haptics, orientation, safe area) | Phase 6 (Meta-package) | Input, UI |
| `@quintus/native` store + game services | Phase 9 (AI prefabs) or later | native basics |
| `create-quintus` mobile scaffolding | Phase 12 (DX polish) | native plugin |
| Tier 2 investigation (embedded engine) | Post-Phase 12 | Full engine maturity |

The Capacitor wrapper (Tier 1) can ship as soon as the engine has a playable game (Phase 6). Mobile support doesn't block any existing phases.

---

## Summary

| Approach | Effort | Performance | App Store | Recommended For |
|----------|--------|-------------|-----------|----------------|
| **Capacitor (Tier 1)** | Low (~1 week) | Good (70-80% native) | Full | All Quintus games |
| **Embedded Engine (Tier 2)** | Very High (~3-6 months) | Excellent (~95% native) | Full | Performance-critical titles |
| **PWA (Tier 3)** | None | Good | Android only | Demos, casual games |

**Start with Capacitor.** It's proven (Vampire Survivors), well-maintained, has a rich plugin ecosystem, and requires almost no engine changes. If specific games hit performance walls, explore Tier 2 as a targeted optimization — not as the default path.

---

## References

- [Capacitor Games Guide](https://capacitorjs.com/docs/guides/games)
- [Phaser + Capacitor Tutorial](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor)
- [Tauri 2.0 Mobile Support](https://v2.tauri.app/blog/tauri-20/)
- [Cocos Creator Engine Architecture](https://github.com/cocos/cocos-engine)
- [Cocos Creator JSB Optimizations](https://docs.cocos.com/creator/3.8/manual/en/advanced-topics/jsb-optimizations.html)
- [React Native Skia](https://github.com/Shopify/react-native-skia)
- [WebGPU Browser Support](https://caniuse.com/webgpu)
- [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)
- [Defold Engine Overview](https://defold.com/)
- [Construct WKWebView Performance](https://www.construct.net/en/blogs/construct-official-blog-1/boosting-ios-performance-855)
- [Apple Alternative Browser Engines (EU)](https://developer.apple.com/support/alternative-browser-engines/)
- [PWA on iOS 2025 Limitations](https://brainhub.eu/library/pwa-on-ios)
- [Capacitor Haptics Plugin](https://capacitorjs.com/docs/apis/haptics)
- [Capacitor Game Services Plugin](https://github.com/openforge/capacitor-game-services)

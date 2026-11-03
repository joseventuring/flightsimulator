# JG RoveaRange: Flight Simulator (repo: flightsimulator)

Jinu's Garage RC flight simulator on the Kurianad field. Six aircraft so far: CraycleCub V2 (trainer), Kestrel 900, Talon 760, Arrow S-05 (1.2 m sport, flaps), Vortex X-06 (3D, hovers on the prop) and Comet J-09 (70 mm EDF jet with retracts). Freefly, a six-gate course and the Coast Wardens career.

Keys: U gear, F flaps (or map transmitter switches).

One HTML file (`index.html`) does everything. Electron wraps the same file into Mac, Windows and Linux installers.

## Fly it

- Web: open `index.html` in Chrome, or https://joseventuring.github.io/flightsimulator/.
- Transmitter: plug in the FlySky sim cable, move a stick so the browser sees the joystick, then open **Transmitter** and tap **Assign** on each channel while moving only that stick. Use **Inv** if a channel runs backwards. Mapping is saved in the browser.
- Keyboard: arrows for ailerons and elevator (down arrow pulls up), A/D rudder, W/S throttle, R reset, C camera.
- Phone: touch sticks, Mode 2.

Takeoff: full throttle, let it reach about 45 km/h, ease back on the elevator. Stall is around 20 km/h. Landing: throttle off, hold a shallow glide, flare under 2.5 m/s sink.

## Build installers

```
npm ci
npm start          # run the desktop app locally
npm run dist       # build an installer for this OS into dist/
```

Push a tag to build all three platforms on GitHub and attach them to a Release:

```
git tag v0.1.0 && git push origin v0.1.0
```

Mac builds are unsigned, so the first launch needs right-click, Open. Signing comes later with an Apple developer account.

## Layout

- `index.html` the sim: scene, flight model, input, HUD
- `electron/main.js` desktop wrapper
- `.github/workflows/build.yml` installers on tag push
- `.github/workflows/pages.yml` web deploy on push to main
- `icons/icon.png` app icon (512 x 512)

## Flight model, in short

Lift, drag and thrust act on a point mass; pitch, roll and yaw moments act on body inertias. Control authority scales with airspeed and prop wash. Stall starts at 15 degrees of angle of attack. The numbers live in the `AC` object at the top of the script and were tuned so takeoff, climb, loop, glide and stall behave like a light foam trainer. Rates and expo are user settings, like on the FS-i6.

## Real aircraft mesh (optional)

Export the CraycleCub V2 as `assets/craycle-cub.glb` (Blender: import the STLs, scale to metres with the nose on -Z and the wing along X, name the moving parts `ailL`, `ailR`, `elev`, `rudd`, File > Export > glTF 2.0, binary). Drop it in `assets/` and the sim replaces the box model at load; the control surfaces animate if the names match. Validate with `npx @gltf-transform/cli validate assets/craycle-cub.glb`.

## Game-dev skills applied (v0.3)

From gamedev-skills/awesome-gamedev-agent-skills, routed for three.js: physics-tuning (clamped fixed-step dt, pause on hidden tab), game-feel (tiered feedback: dust, flash, trauma shake, gate pulse, reduced-motion respected), camera-systems (ground-clamped chase with look-ahead, additive shake), input-systems (radial deadzone, dual-rates switch, pause keys), audio-design (motor, wind and alert buses under a squared master slider), game-ui-ux (screen stack with Pause, initial focus per card), performance-optimization (adaptive pixel ratio from measured frame time), save-systems (versioned, validated localStorage), threejs-materials-lighting (PBR plane, ACES tone mapping, sky dome), threejs-gltf-loading (optional real mesh).

## Roadmap

1. Freefly and gates (this release)
2. Accounts, leaderboards, subscription paywall (Supabase + Razorpay)
3. Live multiplayer rooms (Colyseus), replays, quad flight model
4. Field and aircraft packs bundled with kit purchases

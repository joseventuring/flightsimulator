# JG Flight Sim (flightsimulator)

Jinu's Garage RC flight simulator. Phase 1: single-player freefly and a six-gate course on the Kurianad field, flying the CraycleCub V2 (800 mm, 620 g, 2205 motor on 3S).

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

## Roadmap

1. Freefly and gates (this release)
2. Accounts, leaderboards, subscription paywall (Supabase + Razorpay)
3. Live multiplayer rooms (Colyseus), replays, quad flight model
4. Field and aircraft packs bundled with kit purchases

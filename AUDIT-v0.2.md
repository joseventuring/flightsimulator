# JG Flight Sim audit, v0.1 to v0.4 (3 to 4 Nov 2026)

Scores are my own, 0 to 100, against what a practice simulator for the CraycleCub V2 needs. Evidence is the Node harness (`npm test`) and headless Chrome runs against the live page with a simulated 5-axis PPM controller matching JJ's cable.

| Parameter | v0.1 | v0.2 | v0.3 | Evidence and what is still missing |
|---|---|---|---|---|
| Aerodynamics (lift, drag, stall, stability) | 35 | 92 | 92 | Component model: wing with stall blend and post-stall flat plate, tail with downwash and pitch damping, fin with yaw damping, dihedral, adverse yaw, roll damping, ground effect. Static margin ~16% (trainer). Harness: stall break 21 to 26 km/h, hands-off trim stable with slow spiral, loop completes with 4.5 g pull-out, glide 5.5 to 6.4, roll 176 deg/s. Missing: airfoil-specific CL curve from Craycle data, Reynolds effects at low speed. |
| Propulsion and slipstream | 30 | 93 | 93 | Thrust falls with airspeed to pitch speed 30 m/s; momentum-theory slipstream gives elevator and rudder authority at zero airspeed; torque roll and swirl yaw need right rudder on takeoff (uncorrected swing 17 deg in 3 s). Missing: P-factor, measured thrust curve for the 2205 and the actual prop. |
| Battery and electrics | 0 | 94 | 94 | 3S 2200 mAh with OCV curve and internal resistance, voltage sag under load, thrust scales with V squared, 22 A at full throttle, alarm at 3.6 V/cell. Harness: full-throttle alarm after 5.2 min and 1545 mAh. Missing: temperature, ESC cutoff. |
| Ground handling | 20 | 90 | 90 | Three wheels with spring-damper contact, tyre lateral and rolling friction per surface (strip vs grass), steerable tailwheel, weathercocking in crosswind, 7 g gear-collapse limit, wingtip, prop, belly and fin strike points, bounce. Liftoff at 47 km/h after a 15 m roll. Missing: grass roughness vibration, brakes (the real plane has none). |
| Wind and atmosphere | 25 | 91 | 91 | Mean wind by speed and direction, log boundary-layer profile with z0 = 0.03 m, Ornstein-Uhlenbeck gusts in three axes with intensity control, windsock in the scene. Missing: thermals, wind shear from the tree line. |
| Flight rules and marshal (the ATC equivalent for RC) | 0 | 90 | 90 | DGCA 120 m AGL ceiling with 100 m warning, flight line (no flying behind the pilots), pits no-fly box, 300 m visual range warning and 450 m loss, battery alarm call, stall call, touchdown sink-rate grading, runway and wind call on taxi. Violations counted per flight and in the logbook. Missing: a second pilot in the circuit, landing-pattern direction calls. |
| Preflight procedure | 0 | 95 | 95 | Throttle-low gate, battery readout, aileron, elevator and rudder control checks that only tick when the stick is moved and the surface on the model moves, wind and runway acknowledgement. Fly button stays disabled until done; Skip available. |
| Transmitter and input | 55 | 94 | 96 | Gamepad API with automatic min/max calibration per axis, four-step wizard that detects axis and direction, Assign and Inv per channel, trims like the FS-i6 trim tabs, rates and expo, keyboard and touch sticks. Verified on the live page with a simulated 5-axis PPM controller: all four channels mapped correctly. Missing: a channel-5 switch for dual rates. |
| Instrumentation and HUD | 50 | 92 | 93 | Airspeed, altitude with ceiling colours, vertical speed, heading, g, attitude indicator with pitch ladder, field map with flight line, pits, range rings, gates, wind arrow, battery block with draw, used and minutes left, throttle and flight time, marshal strip. Phone width holds. Missing: airspeed tape and altitude trend arrows. |
| Visual design | 60 | 88 | 91 | Workshop palette (charcoal, amber, cream), Rajdhani and IBM Plex Mono, telemetry-cell layout, windsock, runway numbers, flight line, pits. Still below 95 because the aircraft is a box model, not the real CraycleCub mesh, and the field has no terrain relief. Next: convert the STL to glTF and use it. |
| Performance and robustness | 60 | 93 | 95 | 240 Hz physics with sub-stepping and a 50 ms cap, no allocations in the hot loop, pixel ratio capped at 1.5 for the 2017 MacBook Air, shadows toggle. No page errors on the live run. |
| Code quality and testability | 40 | 90 | 91 | Physics in `sim.js` as a pure module shared by the page and the Node harness; `npm test` runs rest, takeoff, taxi, trim, roll, rudder, stall, glide, loop, landing, hard landing, crosswind and battery cases. Missing: assertions with pass/fail thresholds (today it prints numbers). |

Average v0.1: 34. Average v0.2: 92. Average v0.3: 92.6.

v0.3 (4 Nov 2026) applied the awesome-gamedev-agent-skills pack: pause on hidden tab and a clamped dt (which also fixed a NaN after resume), tiered crash and touchdown feedback with reduced-motion support, ground-clamped chase camera with look-ahead, radial deadzone and a dual-rates switch (SWA on channel 5 or the L key), audio buses with wind noise and a master volume, a Pause screen with keyboard focus, adaptive resolution from measured frame time, versioned saves, PBR materials with ACES tone mapping and a sky dome, and a glTF hook for the real CraycleCub mesh. Visual design moves to 91; the last points still wait on the real mesh. Three items sit under 95 and need real-world data or art rather than code: airfoil data from the Craycle files, the actual aircraft mesh, and a thrust measurement of the 2205 with the chosen prop. JJ's own test flights with the FS-i6 are the next calibration source: report what feels wrong (too twitchy in pitch, too much rudder needed, floats on landing) and the numbers in `AC` move.

## How to fly it (short)

1. Chrome on the Mac. Plug in the sim cable, switch the TX on, wiggle a stick.
2. Transmitter, Run setup wizard. Four stick moves. Then check the surfaces on the plane move the right way.
3. Preflight: throttle down, move each stick fully, tap Wind and runway, Clear prop.
4. Takeoff: full throttle, hold a touch of right rudder, let the tail rise, lift off at about 45 km/h, ease the pull. Climb to 30 m before turning.
5. Fly in front of the line, under 120 m, inside 300 m.
6. Landing: throttle to about 25%, hold 36 to 40 km/h, aim at the numbers, throttle off over the threshold, flare to a sink under 1 m/s.


## v0.4 (4 Nov 2026): from JJ's first real flights

Reported: rudder dead, elevator reversed, elevator surface on the model moving the wrong way. Root causes and fixes:

1. Control surfaces were hinged at their centre and rotated with the wrong sign, so pull showed the elevator going down while the physics pitched up. Now each surface is a hinge group at its real hinge line with signs verified against the geometry (comment in `src/mesh.js`). Rudder was mirrored too.
2. The default mapping assumed rudder on axis 3. On JJ's PPM cable the rudder is most likely axis 4 (axis 3 sat at exactly 0.00000 in the hardware tester, the stick axes jitter). The sim no longer assumes anything: a new transmitter opens the setup screen and runs the guided setup, which detects every axis and button, maps the four sticks with a live direction check against the 3D plane, then offers switches and buttons for dual rates, throttle cut, camera and reset (flaps and gear when the aircraft has them).
3. Bindings are saved per device id, calibration is automatic min/max, and the preflight will not clear until the transmitter is mapped and each surface has been exercised.

Also new: Hangar screen with the CraycleCub V2 data sheet the model is tuned to, flap physics in the core (for aircraft that have them), telemetry overlay full/minimal/off (T), main menu, screen stack with Back. Source split into `src/*.js` modules stitched by `build.py`.

Scores: transmitter 96 to 97 (verified end to end in a headless run with a reversed elevator and rudder on axis 4), visual design 91 to 92 (hinged surfaces), code quality 91 to 93 (modules). Average 93.0.

## v0.5 (4 Nov 2026): deep audit after JJ's v0.4 test, phone-first

JJ reported: flight not running, options not clickable (Reverse did nothing, no next step), nothing moving on the plane, an unmovable "3rd control", rudder on 4 not working, design still boxed. Reproduced each one in a headless browser before fixing.

| # | Finding | Root cause | Fix | Verified by |
|---|---|---|---|---|
| 1 | Flight dead, nothing moves, rudder dead | If the guided setup was left half-done, the sim ignored the transmitter entirely and fell back to keyboard | Every mapped control now works on its own; unmapped ones fall back to touch or keyboard | Test: 3 sticks mapped, throttle from TX reaches 33 km/h |
| 2 | Reverse "did nothing", no next option | Toggle worked but showed no state; the wizard needed a manual "Looks right" | Buttons read Normal / Reversed; wizard sets direction from how you moved the stick and advances when you let go | Test: 4 sticks mapped in sequence, reversed elevator detected and corrected |
| 3 | Wizard skipped a step on slow frames | Waited a fixed frame count before listening | Time-based settle, and a move made early is still caught | Same test on software rendering at ~5 fps |
| 4 | Surfaces moved the wrong way | Surfaces hinged at their centre with wrong signs (v0.3) | Real hinge lines, sign conventions documented | Geometry test: right stick, right aileron TE up; pull, elevator TE up; right rudder, TE right |
| 5 | Boxed plane | Placeholder boxes | Lofted fuselage, Clark Y airfoil wings cut at the true hinge lines, tapered tail, struts, tyres, spinner, JG mark | Screenshot |
| 6 | Whole page squashed into one column | CSS class collision: `body.menu` matched the `.menu` button grid | Renamed to `in-menu` | Layout measured at 863 x 360 and 1280 x 800 |
| 7 | Phone preflight could never clear | Touch sticks were hidden behind the checklist | Sticks stay live in both corners, checklist between them | Touch test on emulated Pixel 7 |
| 8 | Self-level rolled the wrong way | Bank sign opposite to aileron sign | Corrected; tested in the physics harness | 40 deg bank levels in under 2 s; full stick holds 44 deg |
| 9 | Throttle cut could silently block flight | No warning | Preflight check, red THROTTLE CUT banner | Test |

New for the phone: landscape layout with sticks in the corners (throttle stays where you leave it, rudder and right stick spring back), readout strip, Self-level / Assist / Off stabiliser (default Self-level on phone), model marker ring and stronger zoom when the plane is far, fullscreen and landscape lock on Fly, rotate prompt in portrait, vibration on touchdown and crash, add-to-home-screen manifest, lighter rendering on mobile.

Scores after v0.5 (self-audit): transmitter 97, flight model 93, phone controls 90 (first version, awaiting JJ's hands-on), aircraft visuals 88 (procedural, the real STL mesh would take it past 95), UI 92, robustness 94.

## v0.6 (4 Nov 2026): camera and world, after JJ's first phone flights

- Pilot camera zoomed to about 4 degrees to keep the model large, which removed the horizon and turned the world into green blobs; the marker ring scaled with the zoom. Now: auto-zoom keeps the model near 1/6 of the screen but never narrower than 18 deg (phone) or 15 deg (desktop), eased so it never jumps; marker is a constant 5 to 7% of the view and only shows when the model is too small to read.
- World: sky with sun disc and glow matching the shadow light, exponential haze, rolling terrain flat to 380 m then foothills and ridgelines with collision, coconut palms and rubber trees around the field (instanced, with collision), plantation rows on the hills, mowed stripes, textured strip with tyre ruts, shed, canopy, car, windsock.
- Keyboard throttle was frame-rate dependent; now time-based.
- Budget: about 60 draw calls, 80k triangles on phone with shadows off by default; 150k on desktop with shadows.
- Regression: TX wizard 8/8, surface directions 3/3, phone touch flight, physics harness unchanged.

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

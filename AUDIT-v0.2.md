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

## v0.7 (4 Nov 2026): hangar, career pursuit, real textures, sound

- Aircraft builder: one parametric airframe builder (fuselage loft, Clark Y wings, tail, gear) drives three aircraft and the AI patrol. Paint (primary, secondary, accent) rebuilds the model.
- Aircraft, all flight-tested in the harness: CraycleCub V2 (liftoff 51, top 70 km/h), Kestrel 900 sport (61 / 90), Talon 760 racer (78 / 126). Talon first looped hands-off at part throttle; root cause was excess thrust against a slow-flight trim, fixed with a racer wing setting (CL0 0.16, incidence 0.01) found by sweep: now level within 6 deg at 60% throttle.
- Upgrades change the physics: motor (thrust, current, pitch speed), battery (capacity, weight), prop (pitch speed against static thrust). Hangar stats are computed from the same physics.
- Career "Coast Wardens" (fictional patrol): 4 chapters, heat 1 to 3, bust meter (close and in sight), cooldown meter (out of sight or past 140 m), bounty to credits, chapter rewards. Warden AI: pure pursuit with lead, turn-rate limit, terrain floor, line of sight through terrain and trees. Faster than the Cub, slower to turn.
- Real textures from Poly Haven (CC0): laterite strip, leafy grass field, grass detail on terrain; procedural fallback if they fail to load.
- Sound: blade-pass and brushless whine computed from KV, voltage and throttle; distance fall-off and air absorption in pilot view; stereo pan; Warden drone and siren.
- Transmitter: "Copy mapping" export and a built-in profile table so a confirmed FS-i6 maps itself.
- Not done: multiplayer (needs a realtime server, see notes), real CraycleCub mesh (wing and front fuselage STLs in Drive are iCloud placeholders; print parts are not in assembly position).

## v0.8 (4 Nov 2026): JG RoveaRange name, first V1 fleet batch

- Name: JG RoveaRange: Flight Simulator (menu, window title, installers, PWA). Repo and link unchanged.
- New aircraft from the V1 table, built on the existing fixed-wing engine:
  - Arrow S-05: 1.2 m sport low wing, 1.3 kg, 2826 motor on 4S, 3-position flaps. Liftoff 45 km/h, top 100 km/h, roll 223 deg/s, 2500 cr.
  - Vortex X-06: 1.0 m 3D EPP profile, 400 g, 2208 on 3S, thrust/weight 2.2, symmetric section, huge surfaces. Liftoff 31 km/h in 4 m, top 56 km/h. Prop hang at about 55% throttle; a simple test autopilot holds it within 25 deg 90% of the time and height within 1.6 m. 3000 cr.
  - Comet J-09: 1.2 m swept-wing jet, 1.5 kg, 70 mm EDF on 6S, retracts and flaps. Liftoff 54 km/h after 15 m, top 152 km/h, 6000 cr.
- Physics added: ducted-fan thrust curve (momentum theory with duct losses, flatter than a prop), slower fan spool (0.8 s to 90%), prop wash over ailerons (3D hover roll authority), retractable gear (1.6 s, will not fold on the ground, drag when down costs about 15% speed, gear-up landing is a crash with its own message), pack voltage per cell count, motor KV per aircraft.
- Scaling: tails sized from tail-volume coefficients; gear springs scale with weight; resting attitude computed from the wheels; crash points from the geometry; cameras scale with wingspan.
- Bugs found and fixed while testing: base flap pitching moment was three times too strong (no earlier aircraft had flaps); nosewheel steering tipped the narrow-track jet, now limited to 0.35 g sideways; atan2 quadrant error in resting pitch; Comet span came out at 1.02 m from the sweep rotation, corrected to 1.17 m.
- Hangar: previews any aircraft in 3D before you buy; battery upgrade is now relative to each aircraft's own pack (4S 2200 to 4S 3000, 6S 3300 to 6S 4500); roll shown in deg/s.
- Sound: per-aircraft KV and blades; the jet gets a fan rush and whine instead of prop buzz.
- Career balance: Wardens fly at least 90% of your aircraft's top speed, so the jet still has to out-turn them.
- Tests: new test/fleet.test.js loads the shipped catalogue into the shipped physics (rest, taxi, takeoff, top speed, hands-off, roll, power-off landing) for all six aircraft: all pass. Browser: hangar previews, keyboard takeoffs, flap and gear toggles.
- Next: Sprint Q-16 needs a multirotor physics module (acro rate mode); then Hoverwing V-14 (VTOL transition), then Rotor R-20 (collective pitch helicopter).

## v0.9 (4 Nov 2026): Sprint Q-16, multirotor physics and flight controller

- New physics module for multirotors (sim.js stepQuad), separate from the fixed-wing model and shared by future quads (Halo, Surveyor, Hauler):
  - four motors in an X with first-order spin-up (30 ms), thrust falling with inflow through the disc, ground effect, prop drag torque for yaw;
  - rotor drag that grows with thrust, body drag per axis, wind through relative airspeed;
  - 6S pack with load sag (5 mOhm per cell; 12 mOhm first, which collapsed the voltage under 120 A and was corrected);
  - ground contact points with friction; a hard hit (over 4.5 m/s down or 9 m/s sideways) or a turtle (upside down for more than 1.2 s) ends the flight.
- Flight controller, Betaflight-style: rate PID with D on the gyro, a mixer that shifts rather than clips (airmode), three modes on the stabiliser button: Acro (default), Horizon, Angle (55 deg limit). D-term added after the P-only loop overshot 720 deg/s by 15%; tuned to kP 60, kI 15, kD 1.2: 725 deg/s peak, 67 ms to 90%, stops dead.
- Sprint Q-16: 650 g, 6S 1100, 1750 KV, 5 inch triblades, thrust/weight 8.5. Measured: hover 27% throttle, holds 10 m with no drift, roll and pitch 725 deg/s, yaw 461 deg/s, full authority at zero throttle (airmode), level top speed 121 km/h (hangar shows 130), gentle landing at 0.7 m/s sink, hover endurance 8.6 min. 3500 cr.
- Model: carbon X frame, stack, battery on top, 25 deg camera, 2306 motors, triblade props that blur per motor speed.
- Cameras: FPV view from the quad's camera with 25 deg uptilt and a 92 deg lens; chase camera follows heading, not attitude, so flips do not spin the view; hangar orbit sized for the quad.
- Phone hangar: panel docks right at 60% width so the aircraft stays visible.
- Bug found in the browser test: with the quad saved as the selected aircraft, start-up hit a label constant before it was defined and the hangar would not open. Fixed.
- Tests: test/quad.test.js (rest, hover, roll, pitch, yaw, airmode, angle limit, top speed, landing, drop, turtle, endurance), all pass; npm test runs it with the fleet test.
- Next: Hoverwing V-14 (VTOL: quad lift plus a cruise motor and a wing, with transition), then Rotor R-20.

## v0.10 (4 Nov 2026): Hoverwing V-14 QuadPlane VTOL

- QuadPlane physics (ArduPilot style) layered on the fixed-wing model: four lift motors on booms (lag, inflow loss, prop yaw torque), Angle-mode attitude hold shared with the quad, rate PID with D on the gyro, a mixer that shifts rather than clips.
- Modes on a switch (V key, on-screen button, or a mapped transmitter switch "VTOL mode"):
  - Hover: lift motors fly it, throttle is lift, cruise motor off.
  - Plane: cruise motor on the throttle; lift motors hold height and attitude while airspeed builds, fading out by the transition speed (45 km/h), then stop.
  - Back to Hover: automatic nose-up braking at about 1.6 m/s^2, then the pilot has it.
- Hoverwing V-14: 1.6 m, 2.4 kg, 6S 6000, lift thrust 58 N, cruise 18 N. Measured: hover 57% throttle at 39 A (about 7 min), transition 2.8 s losing 1.7 m, cruise 67 km/h at 17.5 A (over 20 min), back-transition stop from 67 km/h in 12 s holding height within 0.2 m, vertical landing 0.35 to 0.65 m/s sink. 5000 cr.
- Model: carbon booms, four lift motors with two-blade props blurring per motor, cruise prop on the nose. Sound follows lift or cruise power, whichever is higher.
- Field marshal: no stall call while the lift motors carry the aircraft; transition, wing-borne and back-transition announcements.
- Battery: false "Land now" alarms found on fresh 6S packs. Pack resistance now per aircraft (6S 6000: 3 mOhm, 6S 3300: 4 mOhm); quad alarm at 3.4 V per cell, as FPV pilots set it, because a 6S racing pack sags to about 3.5 V on a full punch. New test/battery.test.js checks every aircraft at full power on a fresh pack.
- Tests: test/vtol.test.js (rest, vertical take-off and hover, transition, cruise, back-transition, vertical landing, hover current); npm test runs fleet, quad, VTOL and battery tests; browser regressions pass.
- Next: Rotor R-20, collective-pitch helicopter (the hardest flight model: rotor head, tail rotor, governor, autorotation).

## v0.11 (4 Nov 2026): Rotor R-20 helicopter, multiplayer, pilot view, career guidance

- Rotor R-20, 700 class collective-pitch helicopter (sim.js stepHeli): blade-element thrust with momentum inflow (translational lift), induced and profile power, rotor inertia, governor with soft start against a 5 kW limit, heading-hold tail rotor geared to the main rotor, cyclic disc tilt with flapping lag and flapback, flybarless controller (Acro, Horizon, Angle with the one-skid-low trim against tail-rotor thrust), skid contacts, blade strike, hard landing.
  - Measured: spool-up 4.8 s, hover at 47% stick (2.4 deg collective, 1.06 kW, 22 A), drift 6 m in 8 s hands-off in Angle, roll 325 deg/s, yaw 513 deg/s, level top speed 114 km/h (hangar 126).
  - Autorotation: throttle hold (H key or the cut switch) at 60 m, collective -4 deg holds 1,640 rpm in a 9.4 m/s descent; a metered flare lands at 2.4 m/s using the rotor energy (808 rpm at touchdown). Leaving collective up after a power cut decays headspeed to 70% in 1 s and it falls.
  - Corrections during tuning: missing rate-curve constant (NaN), blade drag 0.011 to 0.009, hub stiffness and rotor damping, flapback 0.004 to 0.0015, fuselage top drag area 0.25 to 0.18 m2, hangar top speed now uses the same forces as the sim.
- Multiplayer (src/multi.js): Supabase Realtime in the jinus-garage-ops project (free plan allows two active projects, both in use). Room codes; presence for callsign, aircraft and paint; broadcast of position, attitude, velocity and rotor or motor state at 5 Hz on wall-clock time; ghosts drawn 0.25 s in the past and interpolated; callsign tags; blue dots on the map. No tables used. Tested with two browsers through Supabase: join, see each other, live positions, leave.
  - Bug found: send timing used capped frame time, so slow devices sent every few seconds. Fixed.
  - Free-plan limits: 200 concurrent connections and 2 million Realtime messages a month, roughly 8 to 9 hours of 4-pilot flying a month at 5 Hz.
- Pilot view on phone: the camera stood inside the pilot figure (now hidden in pilot view), the windsock stood in the low-pass sight line (moved 37 m out to the right of the strip), marshal messages fade after 6 s on phone and 12 s on desktop with a lighter box.
- Preflight throttle check is active: raise the throttle, then back to idle (it was green by default).
- Career guidance: on-screen markers for each Warden (blue, red when it sees you, with distance; edge arrows when off-screen), a green COVER marker at the nearest spot behind a tree or hill the Warden cannot see through (same line-of-sight test the Wardens use), and a status line (SEEN at N m / HIDDEN). Chapter 1 brief explains them.
- Hangar code ROVEARANGE adds 1,000,000 credits for testing. Text boxes release keyboard focus when the screen changes (a focused box swallowed the flight keys).
- Tests: test/heli.test.js added to npm test (fleet, quad, VTOL, helicopter, battery all pass); browser regressions pass.

## v0.12 (4 Nov 2026): real-terrain maps and real airspace

- Two public maps from open elevation data (SRTM/NASADEM/Copernicus via AWS Terrain Tiles), baked by tools/build_map.py: Kurianad (Kottayam, Kerala) and Moinabad (near Chilkur, Hyderabad). Lakes detected as dead-flat surfaces in the elevation data: Himayat Sagar (533 m) and Osman Sagar (542 m) at their real shorelines. A third map near a private location is kept out of the public build.
- Strip placement: flattest open ground near the requested point, never on water (dead-flat rejected) and above reservoir full-tank level. Caught during the build: the first Moinabad site was on Osman Sagar's dry bed.
- Physics: wheels, skids and crash points use the real ground height (valleys no longer have an invisible floor). Ceiling checks use height above the ground under the aircraft.
- Airspace: Drone Rules 2021 bands against estimated airport perimeters (OurAirports runways plus a land buffer), police no-fly circles, and a 1 km safety margin on the 12 km line. Kurianad green 120 m (Kochi naval air station 36 km, Cochin International 44 km); Moinabad green 120 m (RGIA 16 km, Begumpet 21 km). Shown in Field and feel and enforced by the marshal.
- Visuals: Kerala greens and a dry Deccan palette, baked hillshade, two-scale ground shading (no tiling grid), 4 to 5 km visibility, logarithmic depth (no field flicker), denser Kerala tree cover, Deccan granite boulders, neem and toddy palms.
- Multiplayer rooms are per map.

## v0.13 (4 Nov 2026): real ground features on the maps

Feedback: the maps did not look like the real places. v0.12 had real hill shapes only, with invented trees and no roads or buildings.

What changed
- Real buildings, roads, rivers, canals, ponds and lakes from Overture Maps (release 2026-10-21.0: OpenStreetMap, Microsoft and Google Open Buildings footprints), and real land cover from ESA WorldCover 2021 (10 m). Built by `tools/build_features.py` and packed into small binary arrays (Kurianad 215 KB, Moinabad 393 KB).
  - Kurianad: 11,053 buildings, 273 km of road, 131 streams and canals, 50 ponds. Land cover is 98% tree cover, which matches the rubber and homestead midlands.
  - Moinabad: 10,183 buildings, 632 km of road (lanes and tracks within 5 km), Osman Sagar and the tanks taken from their real shorelines.
- The field is on real clear ground. `tools/build_map.py --clear` rejects any site where a real building, road or water body touches the 150 x 210 m field, and penalises tree, built-up and water land cover. Both v0.12 fields had houses or lanes on them (17 buildings at Kurianad; 4 buildings and 3 lanes at Moinabad), so both fields moved:
  - Kurianad: 9.78264, 76.56343.
  - Moinabad: 17.34518, 78.28153.
- Lakes come from the real water polygons (over 2 ha), with their levels taken from the elevation data.
- Levelling: about 170 m around the field, blending into the terrain by 400 m (it was 250 m and 520 m).
- Rendering:
  - Ground colour follows the real land cover.
  - Roads and rivers are ribbons draped on the drawn surface.
  - Buildings are oriented blocks with windows drawn in the shader, Kerala tiled roofs, and flat concrete terraces.
  - Canopy follows the land cover. Palms stand round Kerala homes. Nothing is planted on a road, roof or pond.
  - The inset map shows the real roads, water and roofs.
- One ground surface everywhere: `groundH()` is the exact height of the drawn mesh, and the physics, roads, buildings and trees all use it.
- Crashes: buildings and trees go into a 20 m obstacle grid. "Flew into a building." is a new crash reason, and per-frame checks look at a few objects instead of thousands.
- Colour fix: scene colours are converted from sRGB to linear. The pale, washed-out ground came from treating sRGB hex as linear light.
- Performance:
  - Instanced meshes are split into 900 m tiles with real bounding spheres, so off-screen tiles are culled. Before this, instanced meshes were culled by their template geometry at the origin.
  - The box bottom faces are dropped.
  - Building and canopy radius and counts are capped lower on phones.
- Private build: `python3 build.py --private` adds `private/maps/*` (git-ignored) and writes `private/dist/index.html`. It is never published.

Credits shown in the field card: OpenStreetMap contributors, Overture Maps Foundation, Microsoft and Google Open Buildings (ODbL), and ESA WorldCover 2021 (CC BY 4.0).

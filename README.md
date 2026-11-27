# Flop Lab

A room full of bouncy stuff where characters from my other games are floppy ragdolls. Grab them with the finger,
fling them, bounce them off the trampoline, glue them, float them on balloons, and see how many feet they flew.

Brief: mattgwagner/flop-lab#9.

## Run it

- `bun server.ts` (or `npm start`) serves it on http://127.0.0.1:4854
- `npm run check` runs both gates (about 1.5 min). If Chromium closes itself on launch, run `TMPDIR=$HOME/.cache/pw-tmp npm run check`.
- Deploy: `npx -y wrangler@4 deploy`, then compare `sha256sum public/index.html` with `curl -s https://flop-lab.mattgwagner.workers.dev | sha256sum`.

## How it's built

Everything is `public/index.html`: Canvas 2D and Web Audio, no image or audio files.

- **Cast.** The draw functions are copied verbatim from `wagner-dashboard/cast.ts` and `cast-more.js`
  (types stripped by esbuild, tree-shaken), plus the Conductor and Andy from `move-in-day`. Each drawing is painted once into a sprite and cut
  into head, torso, two arms and two legs by its `rig` (neck and hip cut lines, torso half-width). Each cut rides its bone,
  so at rest the character looks exactly like home. To add one, add a `CAST` entry and check the cut with
  `?debug&test=sheet&bones` (`&page=1` for the second row).
- **Physics.** Verlet with 9 points per body (head, shoulders, hips, hands, feet), 12 sticks plus 3 push-apart limits,
  fixed 120 Hz step, 10 solver passes. Collisions only move points; speed (bounce, friction, the trampoline) is set once
  per tick in `settleContacts()`, so a constraint fighting a wall can never store up energy. Bodies are `flop`
  (pure physics), `getup` (a scripted 0.4 s swing upright to a clear spot from `standSpot()`), or `stand` (held to the
  rest pose; knocked over by a grab, poke, glue, balloon, a fast hit, or losing their footing).
- **Weights.** Each character has a weight of 1–3. A balloon lifts 1.15, so the card's "Floats on 🎈🎈" is exact. The
  floor fan's push fades with height and is divided by weight, so light friends hover higher.
- **Trampoline.** `TRAMP` in `index.html`: the mat keeps the landing speed (×1.06, never under 9.5 or over 24
  units/tick), and `trampKick()` then lifts the *whole* body at 0.9 of that. Kicking only the touching points left the rest
  of the body falling, which dragged a 25 ft drop down to a 4 ft bounce. A gentle drop now bounces about 15 ft.
  The end-of-tick joint pass runs 3 times, because faster bodies squeezed narrow hips (Jack, Biscuit) past 1.6×.
- **Maps.** `MAPS` in `index.html` (the names and order a kid picked): The Lake, The Forest, The Town, Starlite Cinema, The Pizzeria, The Test Lab. A map is
  room data: `statics`, `fan`, `boxes`, the drop-race lane, `ground(x)` (where you can stand: the floor, a roof, a bank,
  or `null` over open water) and its painting. `useMap()` swaps them in; the 🗺️ button (M) opens the picker and the same
  friends come along. The Test Lab is the original room, number for number. Walls and banks reach far below the floor and
  past the room's sides, so a point pushed inside one always pops out of the top.
  - **The Lake.** Water is a force, not a contact: below the surface each point is pushed up by depth (capped) divided by
    `sink` × weight, so friends float `22 × weight` units deep, and drag slows them. A splash (or any throw that ends up
    in the water) ends the throw. After a moment
    a swimmer paddles to the dock end or the far bank and climbs out there with the usual `getUp()`; `standSpot()` never
    picks a spot in the water. The diving board is trampoline material.
  - **The Forest.** Branches are one-way ledges: they only catch a point that was above them last tick, however fast it
    falls (so nothing tunnels through), and you pass up through them. Bark is grippy, so a friend draped over a branch
    hangs there, and when they get up they climb onto the branch (`p.perch`) instead of dropping to the ground. The
    mushroom cap is trampoline material.
  - **The Town.** Three solid buildings at different heights with a street gap; the fan is a street vent.
  - **Starlite Cinema.** A stage under the screen and stadium seats stepping up to the back (blocks, like the Town's
    roofs, so `ground(x)` is the step top). The seat backs are painted on each riser's face, not solid. The popcorn
    machine is the fan, and its beam pops kernels.
  - **The Pizzeria** (by request). A solid counter with a ball of dough on top (trampoline material, like the
    Forest mushroom), a table (a floating top, like the Lab shelf), and the oven vent is the fan.
- **Throws.** A fling faster than 4 units/tick starts a flight; the first landing that isn't the trampoline (or a
  splash) ends it. Feet = horizontal distance of the body's middle / 30, on the ruler every map shares. Best per
  character is saved per player, per map.
- **Saves.** Who am I? per-player saves, same as Move-In Day: `floplab.players {list, cur}`, `floplab.v1.<id>`.
  Version 2 keeps `best` and `high` per map (`best.lake.hoot`) and the last `map`; a version 1 save's throws load as
  Test Lab throws.
  `?test` uses `floplab.test.*`. A deleted player is parked at `floplab.v1.<id>.deleted.<ms>`.

## Tests

- `e2e/fuzz.mjs [seeds]`: random crowds plus random grabs (including dragging into walls and ramps), flings, pokes, glue,
  balloons, the fan and drop races, checked every tick by its own code: no NaN, nothing leaves the room, no joint
  stretched past 1.6× with a visible gap. Then the chaos stops and everyone must be standing within 20 s with every joint
  back within 15%. Then the facts the toys teach: N balloons float a friend whose weight needs N and N−1 don't, the fan
  floats lighter friends higher, and a drop race lands heavy and light together. Seeds take turns across the four maps;
  on the Lake nobody may end up standing in the water. Map facts: the drop race on every map, heavier friends float lower
  in the Lake, the Forest's mushroom bounces past 10 ft, and a branch catches someone dropped on it.
- `e2e/play.mjs`: a real-mouse playthrough at 1920×1080 (including each map from the picker, a fling landing on that
  map's chart, and a reload keeping it) plus a 1366×768 fit check; screenshots in `shots/`.

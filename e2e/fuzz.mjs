// Physics fuzz. For many seeds: drop a random crowd in, then throw random mouse-level chaos at them (grabs dragged
// anywhere, including into the ramps and walls, flings, pokes, glue, balloons, the fan, drop races). After every
// tick this file's own checker reads the raw points: nothing is NaN, every point is inside the room, every stick is
// never stretched past 1.6x with a visible gap (over 12 units, about 5 inches; squash is allowed mid-pile: it's a cartoon), and once things calm down every joint is
// back within 15% of its rest length. Then the chaos stops (balloons popped, glue peeled, fan off) and everyone
// has to be back on their feet (or swinging up), upright, within 20 seconds. Then the physics facts the toys show must hold:
// N balloons float a friend whose weight needs N and N-1 don't, the fan floats lighter friends higher, and a
// drop race lands heavy and light together. Seeds take turns across the maps (The Lake, The Forest, The Town, Starlite
// Cinema, The Pizzeria, The Test Lab), and on the Lake nobody may end up standing in the water. Each map then gets its own facts: in the Lake heavy
// friends float lower, the Forest's mushroom and the Pizzeria's dough bounce like the trampoline, the branches catch you, and the drop race
// works everywhere. Usage: node e2e/fuzz.mjs [seeds]
import { launch, pageUrl } from "./pw.mjs";
const NS = +process.argv[2] || 120;
const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.goto(pageUrl("?debug&test"));
await page.waitForFunction(() => window.__flop);
await page.evaluate(() => { __flop.paused = true; });

const fails = [];
let worstStretch = 0, worstSquash = 0, totalTicks = 0;
for (let seed = +process.env.FUZZ_FROM || 1; seed <= NS; seed++) {
  const TRACE = +process.env.FUZZ_TRACE || 0;
  const r = await page.evaluate(([seed, TRACE]) => {
    const F = __flop;
    let s = seed * 9301 + 49297;
    let s2 = seed * 7919 + 17; Math.random = () => (s2 = (s2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // the game's own dice (where stuff drops in), seeded too
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];
    F.setMap(F.MAPS[(seed - 1) % F.MAPS.length]);
    F.clearRoom(); F.resetBoxes(); F.setFan(false); F.setTool("finger");
    const n = ri(2, 8);
    // spawn above the furniture (and the roofs), the way the game drops people in
    const drop = () => { const x = ri(80, F.W - 80); return [x, Math.min(ri(220, 460), (F.groundAt(x) ?? F.FLOOR) - 20)]; };
    for (let i = 0; i < n; i++) F.spawn(pick(F.CAST).id, ...drop(), rnd() < 0.5 ? "stand" : "flop");
    for (let i = ri(0, 3); i > 0; i--) F.dropStuff(pick(F.STUFF)); // the 🧸 Stuff tray
    const bad = []; let maxStretch = 0, maxSquash = 0, ticks = 0;
    // the checker: raw points only
    F.onTick = () => {
      ticks++;
      const pts = [...F.bodies.flatMap(b => b.P), ...F.boxes.flatMap(b => b.P)];
      for (const p of pts) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.px) || !Number.isFinite(p.py)) { bad.push(`NaN at tick ${ticks} on ${p.owner.box ? "a box" : p.owner.c.id + " p" + p.owner.P.indexOf(p)} fix=${p.fix} grab=${F.grab === p}`); return; }
        if (p.x < -0.5 || p.x > F.W + 0.5 || p.y < -0.5 || p.y > F.FLOOR + 0.5) { bad.push(`escaped (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) tick ${ticks} on ${p.owner.box ? "a box" : p.owner.c.id + " p" + p.owner.P.indexOf(p) + " " + p.owner.state}`); return; }
      }
      for (const b of F.bodies) for (const [si, st] of b.sticks.entries()) {
        const d = Math.hypot(st.a.x - st.b.x, st.a.y - st.b.y), r = d / st.len;
        if (r > maxStretch) maxStretch = r; if (r < (maxSquash || 9)) maxSquash = r;
        if (r > 1.6 && d - st.len > 12) { bad.push(`${b.c.id} joint ${si} at ${r.toFixed(2)}x tick ${ticks} (${b.state}${F.grab && F.grab.owner === b ? ", held" : ""}${b.glue.length ? ", glued" : ""})`); return; }
      }
      for (const b of F.bodies) for (const bl of b.balloons) if (!Number.isFinite(bl.x) || !Number.isFinite(bl.y)) { bad.push("balloon NaN"); return; }
    };
    const randPoint = () => [ri(0, F.W), ri(0, F.FLOOR)];
    const randPart = () => { const b = pick(F.bodies); return b ? pick(b.P) : null; };
    for (let t = 0; t < 1800 && !bad.length;) {
      const a = rnd();
      if (a < 0.35) {
        const p = rnd() < 0.85 ? randPart() : pick(F.boxes).P[0];
        if (p && F.grabAt(p.x, p.y)) {
          const steps = ri(10, 60); let [x, y] = [p.x, p.y]; const [tx, ty] = randPoint(), wild = rnd() < 0.3;
          for (let k = 0; k < steps; k++) { if (wild) { x = ri(-50, F.W + 50); y = ri(-50, F.FLOOR + 50); } else { x += (tx - x) * 0.2; y += (ty - y) * 0.2; } F.move(x, y); F.step(1); t++; }
          F.release();
        }
      } else if (a < 0.5) { const [x, y] = randPoint(); F.poke(x, y); }
      else if (a < 0.6) { const p = randPart(); if (p) F.glueAt(p.x, p.y); }
      else if (a < 0.72) { const p = randPart(); if (p) F.balloonAt(p.x, p.y); }
      else if (a < 0.78) F.setFan(!F.fan);
      else if (a < 0.81) F.dropRace();
      else if (a < 0.86 && F.bodies.length < 8) F.spawn(pick(F.CAST).id, ...drop());
      else if (a < 0.9) F.dropStuff(pick(F.STUFF));
      const wait = ri(5, 60); F.step(wait); t += wait;
    }
    // calm down: peel every glue blob, pop every balloon, fan off, let go
    F.release(); F.setFan(false);
    for (const b of F.bodies) { while (b.glue.length) F.glueAt(b.glue[0].x, b.glue[0].y); while (b.balloons.length) F.balloonAt(b.balloons[0].x, b.balloons[0].y); }
    let leftovers = F.bodies.filter(b => b.glue.length || b.balloons.length).length;
    if (leftovers) bad.push(leftovers + " bodies kept glue or balloons after clicking them off");
    const trace = [];
    if (TRACE === seed) { let prev = F.bodies.map(b => b.state); F.onTick = () => { F.bodies.forEach((b, i) => { if (b.state !== prev[i]) trace.push(`t${ticks} ${b.c.id}#${i} ${prev[i]}->${b.state} @${b.P[0].x.toFixed(0)},${b.P[0].y.toFixed(0)} an ${JSON.stringify(b.anchor && b.anchor.map(Math.round))}`); }); prev = F.bodies.map(b => b.state); ticks++; }; }
    F.step(2400);
    if (trace.length) bad.push("TRACE " + trace.slice(-14).join("; "));
    const down = [];
    for (const b of F.bodies) {
      const head = b.P[0].y, hips = (b.P[3].y + b.P[4].y) / 2;
      if (b.state === "flop" || head > hips - b.c.h * 0.2) down.push(`${b.c.id} ${b.state}${b.why ? " (" + b.why[1] + " " + (F.tick - b.why[0]) + " ticks before the end)" : ""} head ${head.toFixed(0)} hips ${hips.toFixed(0)} at x ${b.P[0].x.toFixed(0)} still ${b.still} flopT ${b.flopT} sup ${b.P.map(p => p.sup).join("")} v ${Math.max(...b.P.map(p => Math.hypot(p.x - p.px, p.y - p.py))).toFixed(2)} y ${b.P.map(p => p.y.toFixed(0)).join(",")}`);
    }
    const wet = F.bodies.filter(b => b.state !== "flop" && [7, 8].some(i => F.inWater(b.P[i].x, b.P[i].y - 2)));
    if (wet.length) bad.push("standing in the water: " + wet.map(b => `${b.c.id} at ${b.P[7].x.toFixed(0)},${b.P[7].y.toFixed(0)}`).join(", "));
    if (down.length) bad.push(F.MAP.id + ": not back up: " + down.join("; ") + " stuff " + F.boxes.map(b => b.kind + "@" + Math.round(b.P[0].x) + "," + Math.round(b.P[0].y) + " v" + Math.max(...b.P.map(p => Math.hypot(p.x - p.px, p.y - p.py))).toFixed(2)).join(" ") + " boxes " + F.boxes.map(b => F.bodyCenter ? b.P.map(p => p.x.toFixed(0) + "," + p.y.toFixed(0)).join(" ") : "").join(" / "));
    for (const b of F.bodies) for (const [si, st] of b.sticks.entries()) { const r = Math.hypot(st.a.x - st.b.x, st.a.y - st.b.y) / st.len; if (Math.abs(r - 1) > 0.15) { bad.push(`${b.c.id} joint ${si} still at ${r.toFixed(2)}x after calming down`); break; } }
    if (F.rescues) bad.push("NaN rescue fired " + F.rescues + "x");
    F.onTick = null;
    const dump = bad.length ? JSON.stringify({ bodies: F.bodies.map(b => ({ id: b.c.id, state: b.state, anchor: b.anchor, P: b.P.map(p => [p.x, p.y, p.px, p.py]) })), boxes: F.boxes.map(b => b.P.map(p => [p.x, p.y, p.px, p.py])) }) : null;
    return { bad: bad.slice(0, 3), maxStretch, maxSquash, ticks, dump, map: F.MAP.id };
  }, [seed, TRACE]);
  totalTicks += r.ticks; worstStretch = Math.max(worstStretch, r.maxStretch); worstSquash = Math.min(worstSquash || 9, r.maxSquash || 9);
  if (r.bad.length) fails.push({ seed: `${seed} (${r.map})`, bad: r.bad });
  if (r.dump && process.env.FUZZ_DUMP == seed) (await import("node:fs")).writeFileSync(process.env.FUZZ_DUMP_FILE || "fuzz-dump.json", r.dump);
}

// physics facts: balloons against weight, the fan against weight, the drop race
const facts = await page.evaluate(() => {
  const F = __flop, out = [];
  F.setMap("lab");
  F.resetBoxes(); // boxes thrown around by the last seed could sit on the fan or in the race lane
  for (const c of F.CAST) {
    const need = Math.ceil(c.mass / F.BALLOON_LIFT - 1e-9);
    for (const n of [need, need - 1]) {
      if (n < 1 && n === need - 1) { continue; }
      F.clearRoom(); F.setFan(false);
      const b = F.spawn(c.id, 900, 600);
      const p = b.P[0];
      for (let k = 0; k < n; k++) F.balloonAt(p.x, p.y);
      const y0 = F.bodyCenter(b)[1]; F.step(360); const y1 = F.bodyCenter(b)[1];
      const rose = y1 < y0 - 40;
      if (n === need && !rose) out.push(`${c.id} with ${n} balloon(s) should float, moved ${(y0 - y1).toFixed(0)} up`);
      if (n === need - 1 && rose) out.push(`${c.id} with ${n} balloon(s) should sink but rose`);
    }
  }
  // the fan: hover height falls with weight
  const hover = {};
  for (const id of ["hoot", "bolt", "clonk"]) {
    F.clearRoom(); F.resetBoxes(); F.setFan(true);
    const b = F.spawn(id, 1240, 832, "flop"); F.step(360);
    let sum = 0; // average over two seconds: floating friends bob
    for (let k = 0; k < 240; k++) { F.step(1); let low = 0; for (const p of b.P) low = Math.max(low, p.y + p.r); sum += 832 - low; }
    hover[id] = sum / 240;
  }
  F.setFan(false);
  if (!(hover.hoot > hover.bolt + 30 && hover.bolt >= hover.clonk)) out.push("fan hover should fall with weight: " + JSON.stringify(hover));
  // the trampoline: a gentle drop (5 ft) bounces everyone past 10 ft; the same drop on the floor stays under 4 ft
  const bounce = {};
  for (const c of F.CAST) for (const [x, where] of [[620, "tramp"], [900, "floor"]]) {
    F.clearRoom(); F.resetBoxes(); F.setFan(false);
    const b = F.spawn(c.id, x, F.FLOOR - 150, "flop");
    let top = 0, prev = F.bodyCenter(b)[1], falling = false;
    for (let t = 0; t < 360; t++) { F.step(1); const y = F.bodyCenter(b)[1]; if (y > prev) falling = true; else if (falling) top = Math.max(top, (F.FLOOR - y) / F.PX_FT); prev = y; }
    bounce[c.id + "@" + where] = Math.round(top);
    if (where === "tramp" && top < 10) out.push(`${c.id} on the trampoline only bounced to ${top.toFixed(1)} ft`);
    if (where === "floor" && top > 4) out.push(`${c.id} bounced to ${top.toFixed(1)} ft off the plain floor`);
  }
  // drop race, on every map
  let times;
  for (const m of F.MAPS) {
    F.setMap(m); F.clearRoom(); F.resetBoxes(); const ids = F.dropRace(); F.step(400);
    times = F.bodies.filter(b => ids.includes(b.c.id)).map(b => b.raceT);
    if (times.length !== 2 || times.some(t => t == null) || Math.abs(times[0] - times[1]) > 0.05) out.push(m + ": drop race times " + JSON.stringify(times) + " for " + ids.join(" vs "));
    const masses = ids.map(id => F.CAST.find(c => c.id === id).mass);
    if (masses[0] === masses[1]) out.push("drop race should pair different weights: " + ids);
  }
  // the Lake: everyone floats, and heavier friends float lower (bob, then measure before they paddle off)
  F.setMap("lake");
  const depth = {};
  for (const id of ["hoot", "grumble", "clonk"]) {
    F.clearRoom(); F.resetBoxes();
    const b = F.spawn(id, 1100, 500, "flop"), float = () => { b.wet = -1e9; F.step(1); }; // no paddling off: just floating
    for (let k = 0; k < 480; k++) float();
    let sum = 0; for (let k = 0; k < 120; k++) { float(); sum += F.bodyCenter(b)[1] - F.MAP.water.top; }
    depth[id] = Math.round(sum / 120);
    if (depth[id] > F.FLOOR - F.MAP.water.top - 30) out.push(`${id} sank to the bottom of the lake (${depth[id]} deep)`);
  }
  if (!(depth.hoot + 10 < depth.grumble && depth.grumble + 10 < depth.clonk)) out.push("heavier friends should float lower: " + JSON.stringify(depth));
  // the Forest: the mushroom bounces like the trampoline, and a branch catches someone dropped on it
  F.setMap("forest");
  for (const id of ["hoot", "clonk"]) {
    F.clearRoom(); F.resetBoxes();
    const b = F.spawn(id, 660, F.FLOOR - 150, "flop");
    let top = 0, prev = F.bodyCenter(b)[1], falling = false;
    for (let t = 0; t < 360; t++) { F.step(1); const y = F.bodyCenter(b)[1]; if (y > prev) falling = true; else if (falling) top = Math.max(top, (F.FLOOR - y) / F.PX_FT); prev = y; }
    bounce[id + "@mushroom"] = Math.round(top);
    if (top < 10) out.push(`${id} on the mushroom only bounced to ${top.toFixed(1)} ft`);
  }
  // the Pizzeria: the dough on the counter bounces like the trampoline (measured from the counter top)
  F.setMap("pizzeria");
  for (const id of ["hoot", "clonk"]) {
    F.clearRoom(); F.resetBoxes();
    const b = F.spawn(id, 260, 700 - 150, "flop");
    let top = 0, prev = F.bodyCenter(b)[1], falling = false;
    for (let t = 0; t < 360; t++) { F.step(1); const y = F.bodyCenter(b)[1]; if (y > prev) falling = true; else if (falling) top = Math.max(top, (700 - y) / F.PX_FT); prev = y; }
    bounce[id + "@dough"] = Math.round(top);
    if (top < 10) out.push(`${id} on the dough only bounced to ${top.toFixed(1)} ft`);
  }
  F.setMap("forest");
  // short and tall: whoever lands on a branch hangs on, and when they get up it's on the branch, not the ground
  for (const id of ["hoot", "clonk", "fang", "conductor"]) {
    F.clearRoom(); F.resetBoxes();
    const b = F.spawn(id, 1320, 340, "flop"); F.step(900);
    if (!b.P.some(p => p.x >= 1238 && p.x <= 1402 && Math.abs(p.y + p.r - 380) < 4)) out.push(`${id} fell off the branch at 380: now ${b.state} at ${F.bodyCenter(b).map(Math.round)}`);
  }
  // the Stuff tray: the ball bounces higher than a box, the duck floats higher than a box, the spring pad throws
  // everyone like the trampoline, and knocking all three pins down is a strike
  F.setMap("lab");
  const stuff = {};
  const rebound = kind => {
    F.clearRoom(); F.resetBoxes(); F.boxes.length = 0; F.dropStuff(kind);
    const t = F.boxes[F.boxes.length - 1], mid = () => t.P.reduce((a, p) => a + p.y, 0) / t.P.length;
    const [ox, oy] = [900 - t.P[0].x, F.FLOOR - 330 - t.P[0].y]; for (const p of t.P) { p.x += ox; p.y += oy; p.px = p.x; p.py = p.y; }
    let top = 0, prev = mid(), falling = false;
    for (let k = 0; k < 400; k++) { F.step(1); const y = mid(); if (y > prev) falling = true; else if (falling) top = Math.max(top, (F.FLOOR - y) / F.PX_FT); prev = y; }
    return Math.round(top * 10) / 10;
  };
  stuff.ball = rebound("ball"); stuff.box = rebound("box");
  if (!(stuff.ball > 4 && stuff.ball > stuff.box * 3)) out.push("the ball should bounce well over a box: " + JSON.stringify(stuff));
  F.setMap("lake");
  const floatDepth = kind => {
    F.clearRoom(); F.resetBoxes(); F.boxes.length = 0; F.dropStuff(kind);
    const t = F.boxes[F.boxes.length - 1];
    const [ox, oy] = [1100 - t.P[0].x, 500 - t.P[0].y]; for (const p of t.P) { p.x += ox; p.y += oy; p.px = p.x; p.py = p.y; }
    F.step(600); return Math.round(Math.max(...t.P.map(p => p.y)) - F.MAP.water.top);
  };
  stuff.duckDepth = floatDepth("duck"); stuff.boxDepth = floatDepth("box");
  if (!(stuff.duckDepth + 8 < stuff.boxDepth) || stuff.boxDepth > F.FLOOR - F.MAP.water.top - 20) out.push("the duck should float higher than a box: " + JSON.stringify(stuff));
  F.setMap("lab");
  for (const id of ["hoot", "clonk", "bot", "lamplighter"]) {
    F.clearRoom(); F.resetBoxes(); F.boxes.length = 0; F.dropStuff("pad");
    const pad = F.boxes[0];
    const [ox, oy] = [960 - (pad.P[0].x + pad.P[1].x) / 2, F.FLOOR - 13 - (pad.P[0].y + pad.P[3].y) / 2]; for (const p of pad.P) { p.x += ox; p.y += oy; p.px = p.x; p.py = p.y; }
    F.step(60);
    const b = F.spawn(id, 960, F.FLOOR - 160, "flop");
    let top = 0, prev = F.bodyCenter(b)[1], falling = false;
    for (let t = 0; t < 360; t++) { F.step(1); const y = F.bodyCenter(b)[1]; if (y > prev) falling = true; else if (falling) top = Math.max(top, (F.FLOOR - y) / F.PX_FT); prev = y; }
    bounce[id + "@pad"] = Math.round(top);
    if (top < 8) out.push(`${id} on the spring pad only bounced to ${top.toFixed(1)} ft`);
  }
  // bowling: fling Clonk along the floor into a set of pins
  F.clearRoom(); F.resetBoxes(); F.boxes.length = 0;
  const s0 = F.strikes, set = F.setPins(1000);
  if (!set) out.push("no room for pins at x 1000 in the Test Lab");
  else {
    const b = F.spawn("clonk", 760, F.FLOOR - 15, "flop"); // a low, fast throw along the floor
    for (const p of b.P) { p.px = p.x - 12; p.py = p.y + 2; }
    F.step(500);
    stuff.tilts = set.pins.map(p => Math.round(F.pinTilt(p) * 57));
    if (F.strikes !== s0 + 1) out.push("knocking every pin down should be one strike: " + JSON.stringify(stuff.tilts));
    // and pins left alone stay up
    F.clearRoom(); F.resetBoxes(); F.boxes.length = 0; const calm = F.setPins(1000); F.step(600);
    if (calm.pins.some(p => F.pinTilt(p) > 0.2) || F.strikes !== s0 + 1) out.push("pins on their own should stand still");
  }
  F.setMap("lab");
  return { out, hover, times, bounce, depth, stuff };
});
if (facts.out.length) fails.push({ seed: "facts", bad: facts.out });

await browser.close();
console.log(`fuzz: ${NS} seeds, ${totalTicks} checked ticks, joints ${worstSquash.toFixed(2)}x..${worstStretch.toFixed(2)}x, fan hover ${JSON.stringify(facts.hover)}, race ${JSON.stringify(facts.times)}, stuff ${JSON.stringify(facts.stuff)}, lake depth ${JSON.stringify(facts.depth)}, bounce ${JSON.stringify(facts.bounce)}`);
if (errors.length) { console.log("page errors:", errors.slice(0, 5)); process.exit(1); }
if (fails.length) { console.log(`FAIL (${fails.length})`); for (const f of fails.slice(0, 12)) console.log(" seed", f.seed, f.bad.join(" | ")); process.exit(1); }
console.log("PASS");

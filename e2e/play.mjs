// A real-mouse playthrough at 1920x1080 (a kid's desktop): Who am I?, the character screen and Drop in, grab and
// fling with the finger, the invisible finger, poke, glue, balloon, the fan, a drop race, the throw landing on the
// Best throws chart, then each map (The Lake, The Forest, The Town) from the 🗺️ picker with someone dropped in and a
// fling landing on that map's chart, a reload keeping the throws and the last map, a second player with their own chart. Then a 1366x768
// fit check, map picker included.
// Screenshots go to shots/. Usage: node e2e/play.mjs
import { launch, pageUrl } from "./pw.mjs";
import { mkdirSync } from "node:fs";
mkdirSync(new URL("../shots/", import.meta.url), { recursive: true });
const shot = (page, name) => page.screenshot({ path: new URL(`../shots/${name}.png`, import.meta.url).pathname });
const browser = await launch();
const errors = [];
let step = "start";
const ok = (cond, msg) => { if (!cond) throw new Error(`[${step}] ${msg}`); };

async function open(vp) {
  const page = await browser.newPage({ viewport: vp });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  return page;
}
const F = (page, fn, arg) => page.evaluate(fn, arg);
async function until(page, fn, arg, ms = 8000, what = "condition") {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); } catch { throw new Error(`[${step}] timed out waiting for ${what}`); }
}
/** Screen position of a body's point (0 head .. 8 feet). */
const at = (page, id, i = 0) => F(page, ([id, i]) => { const b = __flop.bodies.find(b => b.c.id === id); return __flop.toScreen(b.P[i].x, b.P[i].y); }, [id, i]);
const standing = (page, id, ms = 9000) => until(page, id => __flop.bodies.find(b => b.c.id === id)?.state === "stand", id, ms, id + " standing");
const tool = (page, name) => page.click(`#bottom [data-tool="${name}"]`);
/** Grab someone's head, wind up to the left, swing up and to the right and let go mid-swing. */
async function fling(page, id) {
  let [x, y] = await at(page, id, 0);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.waitForTimeout(80);
  for (let k = 0; k < 8; k++) { x -= 12; y += 4; await page.mouse.move(x, y); await page.waitForTimeout(16); }
  for (let k = 0; k < 6; k++) { x += 55; y -= 38; await page.mouse.move(x, y); await page.waitForTimeout(16); }
  await page.mouse.up();
}

try {
  const page = await open({ width: 1920, height: 1080 });
  await page.goto(pageUrl("?debug&test"));
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("floplab.test")) localStorage.removeItem(k); });
  await page.goto(pageUrl("?debug&test"));
  await until(page, () => window.__flop, null, 5000, "page");

  step = "home";
  ok(await page.isVisible("#home"), "home screen shows");
  await shot(page, "01-home");

  step = "who am I (first play)";
  await page.click("#playBtn");
  ok(await page.isVisible("#playersScr"), "first play asks Who am I?");
  ok((await page.textContent("#playersScr h2")) === "Who am I?", "the screen is called Who am I?");
  await page.fill("#plName", "Tester");
  await shot(page, "02-who-am-i");
  await page.click("#plDone");
  ok(await page.isVisible("#top"), "game starts after naming");
  ok((await page.textContent("#who")).trim() === "Tester", "chip shows the name");
  await standing(page, "hoot"); await standing(page, "clonk");
  await shot(page, "03-room");

  step = "character screen";
  await page.click("#charsBtn");
  ok((await page.$$("#charsPanel .cc")).length === 33, "33 characters in the grid");
  await shot(page, "04-characters");
  await page.click('#charsPanel [data-c="crooner"]');
  const card = await page.textContent("#charsPanel");
  ok(card.includes("Crooner") && card.includes("Door Codes") && card.includes("sequins") && card.includes("Floats on 🎈🎈"), "big card has name, home game, bio, balloons: " + card.slice(0, 200));
  await shot(page, "05-card");
  await page.click("#dropBtn");
  ok(await page.isHidden("#charsScr"), "card closes on Drop in");
  ok(await F(page, () => __flop.bodies.some(b => b.c.id === "crooner")), "Crooner dropped in");
  await standing(page, "crooner");

  step = "stuff tray";
  await page.click("#clearBtn"); // three friends standing can fill the Lab's whole drop zone, and then the pins have no room
  await page.click("#stuffBtn");
  ok((await page.$$("#stuffPanel .mc")).length === 8, "8 kinds of stuff in the tray");
  await shot(page, "05b-stuff");
  const before = await F(page, () => __flop.boxes.length);
  await page.click('#stuffPanel [data-k="ball"]');
  ok(await page.isHidden("#stuffScr"), "tray closes when you pick something");
  ok(await F(page, () => __flop.boxes.some(b => b.kind === "ball")) && (await F(page, () => __flop.boxes.length)) === before + 1, "a ball dropped in");
  await page.keyboard.press("s");
  await page.click('#stuffPanel [data-k="pins"]');
  ok((await F(page, () => __flop.boxes.filter(b => b.kind === "pins").length)) === 3, "three pins stand up");
  await page.waitForTimeout(1500);
  await shot(page, "05c-stuff-in-room");
  await page.click("#clearBtn");
  ok((await F(page, () => __flop.boxes.filter(b => b.kind !== "box").length)) === 0, "Clear puts the stuff away");
  await page.click("#charsBtn"); await page.click('#charsPanel [data-c="hoot"]'); await page.click("#dropBtn"); await standing(page, "hoot");
  await page.click("#charsBtn"); await page.click('#charsPanel [data-c="clonk"]'); await page.click("#dropBtn"); await standing(page, "clonk");
  await page.click("#charsBtn"); await page.click('#charsPanel [data-c="crooner"]'); await page.click("#dropBtn"); await standing(page, "crooner");

  step = "grab and fling";
  await tool(page, "finger");
  let [x, y] = await at(page, "hoot", 0);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.waitForTimeout(80);
  ok(await F(page, () => __flop.grab?.owner?.c?.id === "hoot"), "the finger grabbed Hoot");
  // a wind-up to the left, then a fast swing up and to the right, letting go mid-swing
  for (let k = 0; k < 8; k++) { x -= 12; y += 4; await page.mouse.move(x, y); await page.waitForTimeout(16); }
  await shot(page, "06-holding");
  for (let k = 0; k < 6; k++) { x += 55; y -= 38; await page.mouse.move(x, y); await page.waitForTimeout(16); }
  await page.mouse.up();
  ok(await F(page, () => !!__flop.bodies.find(b => b.c.id === "hoot").flight), "letting go mid-swing starts a flight");
  await page.waitForTimeout(450);
  await shot(page, "07-flying");
  await until(page, () => __flop.lastFlight?.id === "hoot", null, 8000, "Hoot to land");
  const lf = await F(page, () => __flop.lastFlight);
  ok(lf.ft >= 3, "a real fling goes at least 3 ft, got " + lf.ft);
  ok(lf.ft === Math.round(Math.abs(lf.x1 - lf.x0) / 30), "feet = world distance / 30");
  ok((await page.textContent("#readout")).includes(`flew ${lf.ft} ft far`), "readout shows the distance");
  ok(await F(page, () => __flop.S.best.lab.hoot), "best throw recorded") ;
  ok((await F(page, () => __flop.S.best.lab.hoot)) === lf.ft, "first throw is the best throw");
  await shot(page, "08-landed");

  step = "invisible finger";
  const empty = await F(page, () => __flop.toScreen(900, 330));
  const crop = { x: empty[0] - 30, y: empty[1] - 20, width: 80, height: 110 };
  await page.mouse.move(empty[0], empty[1]); await page.waitForTimeout(60);
  const handOn = await page.screenshot({ clip: crop });
  await page.click("#ghostBtn");
  ok(await F(page, () => __flop.ghost), "👻 turns the finger invisible");
  ok((await page.textContent("#ghostBtn")).includes("Show finger"), "button flips to Show finger");
  await page.mouse.move(empty[0], empty[1]); await page.waitForTimeout(60);
  const handOff = await page.screenshot({ clip: crop });
  ok(!handOn.equals(handOff), "the hand is no longer drawn");
  await standing(page, "clonk");
  [x, y] = await at(page, "clonk", 0);
  await page.mouse.move(x, y); await page.mouse.down();
  for (let k = 0; k < 10; k++) { y -= 25; await page.mouse.move(x, y); await page.waitForTimeout(16); }
  ok(await F(page, () => __flop.grab?.owner?.c?.id === "clonk"), "the invisible finger still grabs");
  await shot(page, "09-invisible-finger");
  await page.mouse.up();
  await page.click("#ghostBtn");
  ok(!(await F(page, () => __flop.ghost)), "finger comes back");

  step = "poke";
  await standing(page, "crooner");
  await tool(page, "poke");
  [x, y] = await at(page, "crooner", 1);
  await page.mouse.click(x - 30, y);
  ok(await F(page, () => __flop.bodies.find(b => b.c.id === "crooner").state === "flop"), "a poke knocks Crooner over");
  await page.waitForTimeout(120);
  await shot(page, "10-poke");

  step = "glue";
  await standing(page, "crooner");
  await tool(page, "glue");
  [x, y] = await at(page, "crooner", 5);
  await page.mouse.click(x, y);
  ok(await F(page, () => __flop.bodies.find(b => b.c.id === "crooner").glue.length === 1), "glue sticks Crooner's hand");
  const gl = await F(page, () => { const g = __flop.bodies.find(b => b.c.id === "crooner").glue[0]; return [...__flop.toScreen(g.x, g.y), g.x, g.y]; });
  await page.waitForTimeout(600);
  const hand = await F(page, () => { const p = __flop.bodies.find(b => b.c.id === "crooner").P[5]; return [p.x, p.y]; });
  ok(Math.hypot(hand[0] - gl[2], hand[1] - gl[3]) < 1, "the glued hand stays put");
  await shot(page, "11-glue");
  await page.mouse.click(gl[0], gl[1]);
  ok(await F(page, () => __flop.bodies.find(b => b.c.id === "crooner").glue.length === 0), "clicking the glue peels it off");

  step = "balloon";
  await standing(page, "hoot", 12000);
  await tool(page, "balloon");
  [x, y] = await at(page, "hoot", 0);
  await page.mouse.click(x, y);
  ok(await F(page, () => __flop.bodies.find(b => b.c.id === "hoot").balloons.length === 1), "a balloon is tied to Hoot");
  const y0 = await F(page, () => __flop.bodyCenter(__flop.bodies.find(b => b.c.id === "hoot"))[1]);
  await page.waitForTimeout(1800);
  const y1 = await F(page, () => __flop.bodyCenter(__flop.bodies.find(b => b.c.id === "hoot"))[1]);
  ok(y1 < y0 - 60, `one balloon floats Hoot (${y0.toFixed(0)} -> ${y1.toFixed(0)})`);
  await shot(page, "12-balloon");
  const bl = await F(page, () => { const b = __flop.bodies.find(b => b.c.id === "hoot").balloons[0]; return __flop.toScreen(b.x, b.y); });
  await page.mouse.click(bl[0], bl[1]);
  ok(await F(page, () => __flop.bodies.find(b => b.c.id === "hoot").balloons.length === 0), "clicking the balloon pops it");

  step = "fan";
  await page.click("#fanBtn");
  ok(await F(page, () => __flop.fan), "fan on");
  await page.waitForTimeout(300);
  await shot(page, "13-fan");
  await page.click("#fanBtn");

  step = "drop race";
  await page.click("#raceBtn");
  const pair = await F(page, () => __flop.race.bodies.map(b => [b.c.id, b.c.mass]));
  ok(pair[0][1] < pair[1][1], "the race pairs a light friend with a heavy one: " + JSON.stringify(pair));
  await page.waitForTimeout(500);
  await shot(page, "14-race");
  await until(page, () => !__flop.race, null, 4000, "race to finish");
  const toastText = await page.textContent("#toast");
  ok(/both landed in \d\.\d seconds/.test(toastText), "toast says both landed together: " + toastText);

  step = "chart";
  await tool(page, "finger");
  await page.click("#chartBtn");
  const bars = await page.$$eval("#chartPanel .bc", els => els.map(e => e.getAttribute("title")));
  ok(bars.some(t => t.startsWith(`Hoot: ${lf.ft} ft far`)), "Hoot's throw is on the chart: " + bars);
  ok((await page.textContent("#chartPanel .bv")).includes(`${lf.ft} ft`), "bar is labelled in feet");
  await shot(page, "15-chart");
  await page.click('#chartPanel [data-tab="all"]');
  ok((await page.textContent("#chartPanel")).includes("Tester"), "Everyone view lists the player");
  await shot(page, "16-chart-everyone");
  await page.click("#chartClose");

  step = "maps";
  const mapBests = {};
  for (const id of ["lake", "forest", "town", "cinema", "pizzeria"]) {
    step = "map " + id;
    await page.click("#mapBtn");
    ok(await page.isVisible("#mapScr"), "🗺️ opens the map picker");
    ok((await page.$$("#mapPanel .mc")).length === 6, "six maps to pick from");
    if (id === "lake") await shot(page, "15b-map-picker");
    await page.click(`#mapPanel [data-map="${id}"]`);
    ok(await page.isHidden("#mapScr"), "picking a map closes the picker");
    ok((await F(page, () => __flop.MAP.id)) === id, "now on " + id);
    ok((await F(page, () => __flop.S.map)) === id, "the save remembers " + id);
    ok(await F(page, () => __flop.bodies.some(b => b.c.id === "hoot")), "everyone came along");
    const newcomer = { lake: "caw", forest: "andy", town: "conductor", cinema: "gulp", pizzeria: "pippa" }[id];
    await page.click("#charsBtn"); await page.click(`#charsPanel [data-c="${newcomer}"]`); await page.click("#dropBtn");
    ok(await F(page, nc => __flop.bodies.some(b => b.c.id === nc), newcomer), `${newcomer} dropped in on ${id}`);
    await standing(page, newcomer, 15000);
    await standing(page, "hoot", 15000);
    await shot(page, `15c-${id}`);
    const before = await F(page, () => __flop.lastFlight?.t ?? -1);
    await tool(page, "finger");
    await fling(page, "hoot");
    await until(page, t => __flop.lastFlight && __flop.lastFlight.t !== t && __flop.lastFlight.id === "hoot", before, 10000, "Hoot to land on " + id);
    const f = await F(page, () => __flop.lastFlight);
    ok(f.ft >= 1, `a fling on ${id} goes somewhere: ${f.ft} ft`);
    mapBests[id] = await F(page, id => __flop.S.best[id]?.hoot, id);
    ok(mapBests[id] >= f.ft, `the ${id} best is recorded: ${mapBests[id]}`);
    if (id === "lake") await shot(page, "15d-lake-splash");
    await page.click("#chartBtn");
    ok((await page.textContent("#chartPanel .mapTabs button.on")).includes({ lake: "The Lake", forest: "The Forest", town: "The Town", cinema: "Starlite Cinema", pizzeria: "The Pizzeria" }[id]), "the chart opens on this map");
    const mb = await page.$$eval("#chartPanel .bc", els => els.map(e => e.getAttribute("title")));
    ok(mb.some(t => t.startsWith(`Hoot: ${mapBests[id]} ft far`)), `Hoot's ${id} throw is on that map's chart: ${mb}`);
    await page.click('#chartPanel [data-map="lab"]');
    const lb = await page.$$eval("#chartPanel .bc", els => els.map(e => e.getAttribute("title")));
    ok(lb.some(t => t.startsWith(`Hoot: ${lf.ft} ft far`)), "the Test Lab chart still has the first throw: " + lb);
    if (id === "town") await shot(page, "15e-chart-maps");
    await page.click("#chartClose");
  }
  ok(await F(page, () => __flop.S.best.lab.hoot) === lf.ft, "a throw on another map leaves the Test Lab best alone");

  step = "reload keeps the save";
  await page.reload();
  await until(page, () => window.__flop, null, 5000, "reload");
  await page.click("#playBtn");
  ok(await page.isVisible("#top"), "a named player goes straight in");
  ok((await page.textContent("#who")).trim() === "Tester", "same player after reload");
  ok((await F(page, () => __flop.S.best.lab.hoot)) === lf.ft, "best throw survives a reload");
  ok(await F(page, () => __flop.bodies.some(b => b.c.id === "crooner")), "the room comes back with Crooner in it");
  ok((await F(page, () => __flop.MAP.id)) === "pizzeria", "the last map comes back after a reload");
  ok((await page.textContent("#mapName")).trim() === "The Pizzeria", "the map button names it");
  for (const id of ["lake", "forest", "town", "cinema", "pizzeria"]) ok((await F(page, id => __flop.S.best[id]?.hoot, id)) === mapBests[id], `the ${id} best survives a reload`);

  step = "badges";
  await page.click("#badgeBtn");
  const bp = await page.textContent("#badgePanel");
  ok(bp.includes("Tester's badges") && /\d+ of 11 earned/.test(bp), "the Badges button opens Tester's badges");
  ok(bp.includes("so far"), "a counting badge shows progress: " + bp.match(/\d+ of \d+ so far/));
  await page.click("#badgeClose");
  // three balloons float Clonk, the heaviest: Up, up and away + Heavy lifter
  await F(page, () => { const F = __flop; F.clearRoom(); F.spawn("clonk", 1500, F.groundAt(1500) ?? F.FLOOR, "stand"); });
  await page.click('[data-tool="balloon"]');
  for (let i = 0; i < 3; i++) { const [x, y] = await F(page, () => { const h = __flop.bodies[0].P[0]; return __flop.toScreen(h.x, h.y); }); await page.mouse.click(x, y); await page.waitForTimeout(120); }
  await until(page, () => __flop.S.badges.heavy, null, 15000, "heavy lifter badge");
  ok((await F(page, () => __flop.S.badges.float)).includes("Clonk"), "floating Clonk earns Up, up and away");
  await page.click("#badgeBtn");
  ok((await page.textContent("#badgePanel")).includes("Clonk on 🎈🎈🎈"), "the badge shows what earned it");
  await shot(page, "16b-badges");
  await page.click("#badgeClose");
  await page.click('[data-tool="finger"]');
  await F(page, () => __flop.clearRoom());

  step = "second player";
  await page.click("#whoBtn");
  ok((await page.textContent("#playersPanel")).includes("Tester"), "Who am I? lists Tester");
  await page.click("#plAdd");
  await page.fill("#plName", "Two");
  await page.click("#plDone");
  ok((await page.textContent("#who")).trim() === "Two", "now playing as Two");
  await page.click("#chartBtn");
  ok((await page.textContent("#chartPanel")).includes("No throws yet"), "Two starts with an empty chart");
  await page.click('#chartPanel [data-tab="all"]');
  ok((await page.textContent("#chartPanel")).includes("Tester"), "Everyone still shows Tester's best");
  await page.click("#chartClose");
  await page.click("#badgeBtn");
  ok((await page.textContent("#badgePanel")).includes("0 of 11 earned"), "Two starts with no badges");
  await page.click("#badgeClose");
  await page.click("#whoBtn");
  await shot(page, "17-players");
  await page.click('#playersPanel [data-del="p2"]');
  ok((await page.textContent("#playersPanel")).includes("Delete Two?"), "delete asks first");
  await page.click('#playersPanel [data-delyes="p2"]');
  ok(!(await page.textContent("#playersPanel")).includes("Two"), "Two is gone");
  ok(await F(page, () => Object.keys(localStorage).some(k => k.startsWith("floplab.test.v1.p2.deleted."))), "a deleted save is parked, not lost");
  await page.close();

  step = "1366x768 fit";
  const small = await open({ width: 1366, height: 768 });
  await small.goto(pageUrl("?debug&test"));
  await until(small, () => window.__flop, null, 5000, "small page");
  await small.click("#playBtn");
  await small.fill("#plName", "Small"); // a fresh browser, so it asks Who am I? first
  await small.click("#plDone");
  ok(await small.isVisible("#top"), "game opens at 1366x768");
  const fit = await small.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("#top button, #bottom button, #readout")) { const r = el.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth || r.bottom > innerHeight || r.width < 10) bad.push(el.textContent.trim()); }
    const bot = document.getElementById("bottom"), c = document.getElementById("c").getBoundingClientRect();
    return { bad, overflow: bot.scrollWidth > bot.clientWidth + 1, canvasH: c.height };
  });
  ok(!fit.bad.length && !fit.overflow, "every button fits: " + JSON.stringify(fit));
  ok(fit.canvasH > 500, "the room keeps most of the screen: " + fit.canvasH);
  await small.click("#charsBtn");
  const cards = await small.$$eval("#charsPanel .cc", els => els.filter(e => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth; }).length);
  ok(cards === 32, "all 32 cards visible at 1366x768, saw " + cards);
  await shot(small, "18-1366-characters");
  await small.click("#charsClose");
  await small.click("#mapBtn");
  const maps = await small.$$eval("#mapPanel .mc", els => els.filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }).length);
  ok(maps === 6, "all 6 maps visible at 1366x768, saw " + maps);
  await shot(small, "18b-1366-maps");
  await small.click('#mapPanel [data-map="lab"]');
  await small.click("#stuffBtn");
  const trays = await small.$$eval("#stuffPanel .mc, #stuffClose", els => els.filter(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }).length);
  ok(trays === 9, "all 8 stuff cards and Close visible at 1366x768, saw " + trays);
  await shot(small, "18c-1366-stuff");
  await small.click("#stuffClose");
  await small.click("#mapBtn");
  await small.click('#mapPanel [data-map="lake"]');
  await shot(small, "19-1366-room");

  ok(!errors.length, "no page errors: " + errors.join(" | "));
  console.log("play: PASS");
} catch (e) {
  console.log("play: FAIL", e.message, errors.length ? "\npage errors: " + errors.join(" | ") : "");
  process.exitCode = 1;
} finally {
  await browser.close();
}

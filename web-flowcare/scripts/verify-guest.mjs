// Guest walkthrough on a phone-sized viewport. Usage: node verify-guest.mjs <url> <outDir>
const { chromium, devices } = await import(process.env.RORK_PLAYWRIGHT_MODULE ?? "/opt/rork-tools/node_modules/playwright-core/index.mjs");

const [url, out = "."] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/local/bin/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => { try { sessionStorage.setItem("rorkQA", "1"); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
const tap = async (id) => { await page.getByTestId(id).first().click(); await page.waitForTimeout(500); };
const results = [];
const check = async (label, fn) => {
  try { await fn(); results.push(`PASS ${label}`); } catch (e) { results.push(`FAIL ${label}: ${String(e).slice(0, 200)}`); }
};

await page.goto(url, { waitUntil: "networkidle" });
await shot("01-home");
await check("home loads", () => page.getByTestId("home.goToClinic").waitFor({ timeout: 8000 }));
await check("go to clinic opens map with route", async () => {
  await tap("home.goToClinic");
  await page.getByTestId("map.stepText").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await shot("02-map");
});
await check("next step advances", async () => {
  const before = await page.getByTestId("map.stepCounter").textContent();
  await tap("map.nextStep");
  const after = await page.getByTestId("map.stepCounter").textContent();
  if (before === after) throw new Error(`counter unchanged: ${after}`);
});
await check("elderly route", async () => { await tap("map.route.elderly"); await shot("03-map-elderly"); });
await check("search sheet", async () => {
  await tap("map.search");
  await page.getByTestId("sheet.search").waitFor();
  await tap("dest.SVC-PHARMACY");
  await page.getByTestId("map.destinationCard").waitFor();
});
await check("map data sheet", async () => { await tap("map.dataBadge"); await page.waitForTimeout(800); await shot("04-map-data"); await tap("sheet.close"); });
for (const tab of ["parking", "visit", "support"]) {
  await check(`tab ${tab}`, async () => { await tap(`tab.${tab}`); await shot(`05-${tab}`); });
}
await check("kids zone + game", async () => {
  await tap("tab.home");
  await tap("home.kids");
  await shot("06-kids");
  await tap("kids.memory");
  await shot("07-memory");
});
await check("english toggle", async () => {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /English|EN/ }).first().click();
  await page.waitForTimeout(400);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== "ltr") throw new Error(`dir=${dir}`);
  await shot("08-home-en");
});

console.log(JSON.stringify({ results, errors: errors.slice(0, 10) }, null, 2));
await browser.close();

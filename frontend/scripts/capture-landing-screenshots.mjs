// Captures the landing page's screenshots (public/landing/*.jpg): each
// role's dashboard, in English and Arabic, light and dark.
//
// Needs the app running against the demo data (backend DemoSeeder):
//   php artisan migrate:fresh --seed        (backend, a throwaway database)
//   npm run build && npm start              (frontend; a production build has no dev overlay)
// then:
//   npm run screenshots:landing
//
// Env: BASE_URL (default http://localhost:3000), CHROME_PATH (a local
// Chrome/Edge; defaults to Playwright's own Chromium if installed).
// Re-run whenever a dashboard's look changes.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = fileURLToPath(new URL("../public/landing/", import.meta.url));
const PASSWORD = "password";

// Seeded demo accounts (frontend/src/lib/demo-accounts.ts).
const ACCOUNTS = {
  admin: "test@example.com",
  teacher: "mona.ali@teachers.demo",
  parent: "family.parent@demo.school",
  student: "ali.hassan1.student@demo.school",
};

async function logIn(page, role, email) {
  await page.goto(`${BASE_URL}/en/login/${role}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Accounts at two schools get a school picker after the first submit.
  const picker = page.getByRole("combobox");
  const landed = await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }).then(() => true),
    picker.waitFor({ timeout: 15000 }).then(() => false),
  ]);
  if (!landed) {
    await picker.click();
    await page.getByRole("option").first().click();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  }
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
mkdirSync(OUT, { recursive: true });

for (const [role, email] of Object.entries(ACCOUNTS)) {
  for (const theme of ["light", "dark"]) {
    // Reduced motion skips the GSAP entrances, so nothing is mid-fade.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    await context.addInitScript((t) => {
      localStorage.setItem("theme", t);
      localStorage.setItem("sidebar-collapsed", "0");
    }, theme);
    const page = await context.newPage();
    await logIn(page, role, email);

    for (const locale of ["en", "ar"]) {
      await page.goto(`${BASE_URL}/${locale}/dashboard`);
      await page.waitForLoadState("networkidle");
      // Keep the pointer off the charts, or a tooltip ends up in the shot.
      await page.mouse.move(1439, 899);
      // Avatars the demo storage doesn't have would show a broken image.
      await page.evaluate(() => {
        for (const img of document.images) if (img.complete && img.naturalWidth === 0) img.style.visibility = "hidden";
      });
      await page.waitForTimeout(1500); // charts settle
      const file = `${OUT}${role}-${locale}-${theme}.jpg`;
      await page.screenshot({ path: file, type: "jpeg", quality: 80 });
      console.log("saved", file);
    }
    await context.close();
  }
}

await browser.close();

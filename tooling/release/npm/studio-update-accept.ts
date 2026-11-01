import type { Page, expect as playwrightExpect } from "@playwright/test";

export async function acceptStudioUpdateLayout(
  page: Page,
  expect: typeof playwrightExpect,
) {
  const apply = page.locator("#applyStudioUpdateButton");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1440, height: 600 },
    { width: 900, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    for (const locale of ["en", "ru"]) {
      await page.locator("#localeSelect").selectOption(locale, { force: true });
      await expect(apply).toHaveText(
        locale === "ru"
          ? "Сохранить правки и обновить"
          : "Save changes and load update",
      );
      await expect(page.locator("#studioUpdateStatus")).toHaveText(
        locale === "ru"
          ? "В проекте есть новая версия. Текущие правки сохранены в редакторе."
          : "A new project version is available. Current editor changes were retained.",
      );
      await apply.click({ trial: true, timeout: 5000 });
      if (viewport.width > 1150) continue;
      await expect
        .poll(() =>
          page.evaluate(() => {
            const header = document.querySelector(".topbar");
            const sidebar = document.querySelector(".sidebar");
            if (!header || !sidebar)
              throw new Error("Viewer shell is missing.");
            return (
              sidebar.getBoundingClientRect().top >=
              header.getBoundingClientRect().bottom
            );
          }),
        )
        .toBe(true);
    }
  }
}

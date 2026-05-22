import { test, expect } from "@playwright/test";

test.describe("Admin — Login et création de note", () => {
  test("se connecter en admin et créer un document", async ({ page }) => {
    // Intercepter les réponses API pour debug
    page.on("response", (response) => {
      if (response.url().includes("/api/")) {
        console.log(`API ${response.status()} ${response.url()}`);
      }
    });

    // 1. Aller sur la page de login
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("LorIAx");

    // 2. Remplir les identifiants admin
    await page.fill('input[id="email"]', "admin@loriax.dev");
    await page.fill('input[id="password"]', "admin123");

    // 3. Soumettre le formulaire
    await page.click('button[type="submit"]');

    // 4. Attendre la redirection vers le dashboard
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL("/");
    console.log("✓ Login admin réussi");

    // 5. Naviguer vers la page de création de document
    await page.goto("/new");
    await expect(page.locator("h1")).toContainText("Nouveau document");

    // 6. Attendre que les espaces soient chargés
    await page.waitForFunction(() => {
      const select = document.querySelector("select");
      return select && select.options.length > 0;
    }, { timeout: 10_000 });
    console.log("✓ Espaces chargés");

    // 7. Remplir le titre du document
    const testTitle = `Test E2E — ${Date.now()}`;
    await page.fill('input[placeholder="Mon nouveau document..."]', testTitle);

    // 8. Cliquer sur "Créer le document" et écouter la réponse API
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/spaces/") && resp.url().includes("/documents") && resp.request().method() === "POST",
      { timeout: 20_000 }
    );
    await page.click('button:has-text("Créer le document")');

    const response = await responsePromise;
    const status = response.status();
    const body = await response.json().catch(() => null);
    console.log(`✓ Réponse API création: ${status}`, JSON.stringify(body, null, 2));

    if (status !== 201) {
      throw new Error(`Création échouée avec status ${status}: ${JSON.stringify(body)}`);
    }

    // 9. Vérifier la redirection vers le document créé
    await page.waitForURL(/\/s\/[^/]+\/[^/]+/, { timeout: 15_000 });

    const url = page.url();
    expect(url).toMatch(/\/s\/[^/]+\/[^/]+/);

    console.log(`✓ Document créé avec succès : ${testTitle}`);
    console.log(`✓ URL du document : ${url}`);
  });
});

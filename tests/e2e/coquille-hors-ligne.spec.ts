import { expect, test } from '@playwright/test';

test.describe('Coquille applicative et PWA', () => {
  test('la page d’accueil s’affiche avec un manifeste valide', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('même sans connexion');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href!)).json();
    expect(manifest.lang).toBe('fr-CI');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('après une première visite, l’application s’ouvre en mode avion', async ({ page, context }) => {
    await page.goto('/');
    // Attendre que le Service Worker ait précaché la coquille et contrôle la page.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    await context.setOffline(true);
    await page.goto('/presentation');
    await expect(page.getByRole('heading', { name: 'Présentation de la plateforme' })).toBeVisible();
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await context.setOffline(false);
  });

  test('serveur injoignable : la connexion affiche un message clair', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse e-mail').fill('eleve@exemple.ci');
    await page.getByLabel('Mot de passe').fill('abidjan2026');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toContainText('serveur est injoignable');
  });

  test('un espace protégé redirige vers la connexion sans session', async ({ page }) => {
    await page.goto('/administration');
    await expect(page).toHaveURL(/\/connexion$/);
  });

  test('aucun défilement horizontal sur petit écran', async ({ page }) => {
    for (const path of ['/', '/inscription', '/presentation']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('navigation au clavier : le lien d’évitement mène au contenu', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveText('Aller au contenu');
  });
});

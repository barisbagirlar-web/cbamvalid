import { test, expect } from '@playwright/test';

test.describe('Header Mutually Exclusive Rendering', () => {

  test('Public routes should render only the Public Header', async ({ page }) => {
    await page.goto('/');
    
    // Content sections may use semantic <header>; exactly one route-level header shell is allowed.
    await expect(page.locator('[data-testid="public-header"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="auth-header"], [data-testid="app-header"]')).toHaveCount(0);
    await expect(page.locator('header[data-testid="public-header"]')).toBeVisible();

    // Verify it doesn't contain workspace elements
    await expect(page.locator('header').locator('text=Dashboard')).not.toBeVisible();
    await expect(page.locator('header').locator('text=Cases')).not.toBeVisible();
  });

  test('Auth routes should render only the Auth Header', async ({ page }) => {
    await page.goto('/login');
    
    // Exactly one route-level auth shell; semantic headers inside content remain valid.
    await expect(page.locator('[data-testid="auth-header"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="public-header"], [data-testid="app-header"]')).toHaveCount(0);
    await expect(page.locator('header[data-testid="auth-header"]')).toBeVisible();

    // Verify it doesn't contain workspace or public elements
    await expect(page.locator('header').locator('text=Dashboard')).not.toBeVisible();
    await expect(page.locator('header').locator('text=Methodology & Sources')).not.toBeVisible();
  });

});

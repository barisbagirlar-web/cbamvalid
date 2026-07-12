import { test, expect } from '@playwright/test';

test.describe('Header Mutually Exclusive Rendering', () => {

  test('Public routes should render only the Public Header', async ({ page }) => {
    await page.goto('/');
    
    // There should be exactly one header tag in the document
    const headers = await page.locator('header').count();
    expect(headers).toBe(1);

    // It should be the public header
    await expect(page.locator('header[data-testid="public-header"]').first()).toBeVisible();

    // Verify it doesn't contain workspace elements
    await expect(page.locator('header').locator('text=Dashboard')).not.toBeVisible();
    await expect(page.locator('header').locator('text=Cases')).not.toBeVisible();
  });

  test('Auth routes should render only the Auth Header', async ({ page }) => {
    await page.goto('/login');
    
    // There should be exactly one header tag in the document
    const headers = await page.locator('header').count();
    expect(headers).toBe(1);

    // It should be the auth header
    await expect(page.locator('header[data-testid="auth-header"]')).toBeVisible();

    // Verify it doesn't contain workspace or public elements
    await expect(page.locator('header').locator('text=Dashboard')).not.toBeVisible();
    await expect(page.locator('header').locator('text=Methodology & Sources')).not.toBeVisible();
  });

});

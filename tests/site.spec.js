import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, baseURL }) => {
  // All submissions are intercepted locally; CI never sends a lead or email.
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    return origin === baseURL ? route.continue() : route.abort();
  });
});

test('page loads without JavaScript errors or missing local assets', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page).toHaveTitle(/Stone Navigator/i);
  const assets = await page.locator('script[src], img[src], link[rel="icon"], link[rel="stylesheet"]').evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('src') || n.getAttribute('href')).filter((url) => url && !/^(https?:|data:)/.test(url)));
  for (const path of assets) expect((await request.get(path)).ok(), `Missing asset: ${path}`).toBeTruthy();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});

test('section navigation and mobile menu work', async ({ page }, testInfo) => {
  await page.goto('/');
  const anchors = await page.locator('a[href^="#"]').evaluateAll((links) =>
    [...new Set(links.map((a) => a.getAttribute('href')).filter((href) => href !== '#'))]);
  for (const anchor of anchors) await expect(page.locator(anchor)).toHaveCount(1);
  if (testInfo.project.name.endsWith('mobile')) {
    await page.locator('.mobile-toggle').click();
    await expect(page.locator('#mobileMenu')).toHaveClass(/open/);
    await page.locator('#mobileMenu a[href="#pricing"]').click();
    await expect(page.locator('#mobileMenu')).not.toHaveClass(/open/);
  } else {
    await page.locator('.nav-links a[href="#pricing"]').click();
  }
  await expect(page.locator('#pricing')).toBeInViewport();
});

test('FAQ answers open and close', async ({ page }) => {
  await page.goto('/#faq');
  const question = page.locator('.faq-q').first();
  await question.click();
  await expect(question).toHaveClass(/open/);
  await expect(question.locator('+ div')).toHaveClass(/open/);
  await question.click();
  await expect(question).not.toHaveClass(/open/);
  await expect(question.locator('+ div')).not.toHaveClass(/open/);
});

test('plan buttons select the intended plan and modal closes', async ({ page }) => {
  await page.goto('/');
  for (const plan of ['Professional', 'Enterprise', 'Custom']) {
    await page.locator(`a[onclick="openModal('${plan}')"]`).click();
    await expect(page.locator('#contactModal')).toHaveClass(/open/);
    await expect(page.locator('#planSelect')).toHaveValue(new RegExp(plan));
    await page.keyboard.press('Escape');
    await expect(page.locator('#contactModal')).not.toHaveClass(/open/);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  }
});

test('form validates, preserves campaign return URL, and can be used after success', async ({ page, baseURL }) => {
  let submitted;
  await page.route('https://formsubmit.co/**', async (route) => {
    expect(route.request().method()).toBe('POST');
    submitted = Object.fromEntries(new URLSearchParams(route.request().postData()));
    await route.fulfill({ status: 302, headers: { location: submitted._next }, body: '' });
  });
  await page.goto('/?utm_source=ci#pricing');
  await page.locator("a[onclick=\"openModal('Enterprise')\"]").click();
  await page.locator('#contactForm button[type="submit"]').click();
  expect(submitted).toBeUndefined();
  await page.locator('input[name="name"]').fill('CI Test');
  await page.locator('input[name="email"]').fill('ci@example.invalid');
  await page.locator('#contactForm button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Message Sent!' })).toBeVisible();
  expect(submitted.name).toBe('CI Test');
  expect(submitted.email).toBe('ci@example.invalid');
  expect(submitted.plan).toContain('Enterprise');
  const back = new URL(submitted._next);
  expect(back.origin).toBe(baseURL);
  expect(back.searchParams.get('thanks')).toBe('1');
  expect(back.searchParams.get('utm_source')).toBe('ci');
  expect(back.hash).toBe('#pricing');
  await page.locator('.form-success button').click();
  expect(new URL(page.url()).searchParams.has('thanks')).toBe(false);
  expect(new URL(page.url()).searchParams.get('utm_source')).toBe('ci');
  await page.locator("a[onclick=\"openModal('Professional')\"]").click();
  await expect(page.locator('#contactForm')).toBeVisible();
  await expect(page.locator('#planSelect')).toHaveValue(/Professional/);
});

# Sales landing page

The site is static HTML. Node is needed only for its browser tests; it adds no production runtime.

## Checks

Every pull request and push to main runs Playwright in Chromium and WebKit, each at desktop and mobile sizes. Tests check local assets, JavaScript errors, horizontal overflow, section links, the mobile menu, FAQs, plan selection, required form fields, the form return URL, and reopening the form after success.

Form submissions are intercepted with synthetic data. Tests never submit a real lead or send an email, and they do not verify the external form service's delivery. External fonts are blocked so a CDN outage cannot affect these functional checks. WebKit mobile emulation is not a physical iPhone test. Footer links whose destination is `#` are placeholders and need their actual pages when available.

To run locally with Node 22 and Python 3:

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm test
```

On a failed CI run, download the browser trace from that run's artifacts to inspect the failure.

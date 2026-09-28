import puppeteer from 'puppeteer-core';

const B = 'http://localhost:3000';
const OUT = 'C:\\Users\\91626\\AppData\\Local\\Temp\\opencode';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1500, height: 1100 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

const login = await fetch(B + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@truck.com', password: 'admin123' }),
}).then((r) => r.json());
await page.goto(B + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate((t, u) => { localStorage.setItem('token', t); localStorage.setItem('user', u); },
  login.token, JSON.stringify(login.user));

await page.goto(B + '/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: OUT + '\\flat-dashboard.png' });
console.log('saved flat-dashboard.png');

// light mode check via the theme toggle
const toggled = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /light mode|dark mode/i.test(x.innerText));
  if (b) { b.click(); return b.innerText; }
  return null;
});
console.log('theme toggle:', toggled);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: OUT + '\\flat-dashboard-light.png' });
console.log('saved flat-dashboard-light.png');

console.log('\npageerrors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

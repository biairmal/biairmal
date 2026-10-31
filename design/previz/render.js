const { chromium } = require('playwright');
const shots = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of shots) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    p.on('pageerror', e => console.log(s, 'ERR', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log(s, 'console', m.text()); });
    const t = Date.now();
    await p.goto((s.includes(',') ? `http://localhost:8765/char.html#${s}` : `http://localhost:8765/scene2.html#${s}`));
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(e => console.log(s, 'timeout'));
    await p.waitForTimeout(300);
    await p.locator('#stage').screenshot({ path: `out/${s.replace(',', '_').replace('~','_')}.png` });
    console.log(s, Date.now() - t, 'ms');
    await p.close();
  }
  await b.close();
})();

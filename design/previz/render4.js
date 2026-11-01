const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of process.argv.slice(2)) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    p.on('pageerror', e => console.log(s, 'ERR', e.message));
    p.on('console', m => { if (m.type() === 'error') console.log(s, 'C', m.text().split('\n').filter(l => /ERROR|rror/.test(l)).slice(0, 3).join(' | ').slice(0, 300)); });
    const t = Date.now();
    await p.goto(`http://localhost:8765/scene4.html#${s}`);
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }).catch(() => console.log(s, 'timeout'));
    await p.waitForTimeout(300);
    await p.locator('#stage').screenshot({ path: `out4/${s}.png`, timeout: 120000 });
    console.log(s, Date.now() - t, 'ms');
    await p.close();
  }
  await b.close();
})();

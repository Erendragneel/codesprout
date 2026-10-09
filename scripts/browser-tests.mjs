import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
const gameSource = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/data/gameLessons.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
const gameUrl = 'data:text/javascript;base64,' + Buffer.from(gameSource).toString('base64');
const source = ts
  .transpileModule(fs.readFileSync(path.join(root, 'src/data/curriculum.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  .outputText.replace(/(['"])\.\/gameLessons\1/g, JSON.stringify(gameUrl));
const { lessons } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/codesprout/')) {
      response.writeHead(404).end();
      return;
    }
    const relative = pathname.slice('/codesprout/'.length) || 'index.html';
    const file = path.resolve(docs, relative);
    if (!file.startsWith(docs + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file)] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/codesprout/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
let checks = 0;
const pass = (label) => {
  checks++;
  console.log('PASS ' + label);
};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(base);
  await page.getByRole('heading', { name: 'Let’s grow something.' }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true);
  pass('GitHub subpath, manifest and offline worker load');
  const manifest = await (await fetch(base + 'manifest.webmanifest')).json();
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons)
    assert.equal((await fetch(base + icon.src.slice(2))).status, 200);
  pass('Install manifest icons resolve inside app scope');
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      'No horizontal overflow at ' + width
    );
  }
  pass('No horizontal overflow from 320px phones to desktop');
  await page.setViewportSize({ width: 1440, height: 1000 });
  let audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert.deepEqual(
    audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    []
  );
  pass('Dashboard WCAG A/AA automated accessibility audit');

  await page.getByRole('tab', { name: /First steps/ }).click();
  await page.locator('.lesson-row').filter({ hasText: 'One small step' }).first().click();
  await page.getByRole('button', { name: 'I’m ready for a tiny guess' }).click();
  await page.getByRole('button', { name: /Jump to any square/ }).click();
  await page.getByRole('button', { name: 'Check my guess' }).click();
  await page.getByText('A useful guess. Let’s try again.').waitFor();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('codesprout.progress.v1')).xp),
    0
  );
  pass('A wrong guess offers another try without losing points');
  await page.getByRole('button', { name: 'Save and close lesson' }).click();

  for (const track of ['first-steps', 'javascript', 'web']) {
    await page
      .getByRole('tab', {
        name:
          track === 'first-steps'
            ? /First steps/
            : track === 'javascript'
              ? /JavaScript/
              : /Web pages/,
      })
      .click();
    const trackLessons = lessons.filter((l) => l.track === track);
    for (const lesson of trackLessons) {
      await page.locator('.lesson-row').filter({ hasText: lesson.title }).first().click();
      await page.getByRole('button', { name: 'I’m ready for a tiny guess' }).click();
      await page.locator('.choices .choice').nth(lesson.prediction.correct).click();
      await page.getByRole('button', { name: 'Check my guess' }).click();
      await page.getByRole('button', { name: 'Let me try it' }).click();
      if (lesson.kind === 'robot') {
        for (const command of lesson.robot.solutionCommands)
          await page
            .locator('.direction-buttons button')
            .filter({ hasText: command[0].toUpperCase() + command.slice(1) })
            .click();
        await page.getByRole('button', { name: 'Move my robot' }).click();
      } else {
        const editor = page.getByRole('textbox', {
          name: lesson.kind === 'html' ? 'Your HTML and CSS code' : 'Your JavaScript code',
        });
        await page
          .getByRole('button', {
            name: lesson.kind === 'html' ? 'Show my page' : 'Run my code',
            exact: true,
          })
          .click();
        await page.locator('.feedback.gentle').waitFor();
        assert.equal(
          await page.getByRole('button', { name: 'Finish this lesson' }).count(),
          0,
          'Starter cannot pass: ' + lesson.id
        );
        await editor.fill(lesson.solution);
        await page
          .getByRole('button', {
            name: lesson.kind === 'html' ? 'Show my page' : 'Run my code',
            exact: true,
          })
          .click();
      }
      await page.getByRole('button', { name: 'Finish this lesson' }).waitFor({ timeout: 12000 });
      if (lesson.id === 'one-small-step') {
        audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        assert.deepEqual(
          audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          []
        );
        pass('Robot lesson automated accessibility audit');
      }
      await page.getByRole('button', { name: 'Finish this lesson' }).click();
      await page.getByRole('heading', { name: 'Look at you grow.' }).waitFor();
      await page.getByRole('button', { name: 'Save and close lesson' }).click();
    }
    pass(`${trackLessons.length} ${track} lessons: solutions, checks, progression and completion`);
  }
  let progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('codesprout.progress.v1'))
  );
  assert.equal(progress.completed.length, 30);
  assert.equal(progress.xp, 900);
  await page.reload();
  await page.getByRole('heading', { name: 'Let’s grow something.' }).waitFor();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('codesprout.progress.v1')).completed.length
    ),
    30
  );
  pass('All 30 completions and 900 points survive a reload');
  // A replay must count as review without granting first-completion points twice.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('codesprout.progress.v1'));
    saved.review['one-small-step'].due = '2000-01-01';
    localStorage.setItem('codesprout.progress.v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('button', { name: /A little practice/ }).click();
  await page.locator('.choices .choice').nth(0).click();
  await page.getByRole('button', { name: 'Check my guess' }).click();
  await page.getByRole('button', { name: 'Finish my practice' }).click();
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('codesprout.progress.v1')).xp),
    910
  );
  pass('Due review earns 10 points and advances its reminder');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('codesprout.progress.v1'));
    saved.review['a-few-steps'].due = '2000-01-01';
    localStorage.setItem('codesprout.progress.v1', JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Try the whole lesson again' }).click();
  const replayDialog = page.getByRole('dialog');
  await replayDialog.getByRole('button', { name: 'I’m ready for a tiny guess' }).click();
  await replayDialog.locator('.choices .choice').nth(1).click();
  await replayDialog.getByRole('button', { name: 'Check my guess' }).click();
  await replayDialog.getByRole('button', { name: 'Let me try it' }).click();
  await replayDialog.getByRole('button', { name: 'Right', exact: true }).click();
  await replayDialog.getByRole('button', { name: 'Right', exact: true }).click();
  await replayDialog.getByRole('button', { name: 'Up', exact: true }).click();
  await replayDialog.getByRole('button', { name: 'Move my robot' }).click();
  await replayDialog.getByRole('button', { name: 'Finish this lesson' }).click();
  await replayDialog.getByRole('button', { name: 'Save and close lesson' }).click();
  progress = await page.evaluate(() => JSON.parse(localStorage.getItem('codesprout.progress.v1')));
  assert.equal(progress.xp, 920);
  assert.equal(progress.completed.length, 30);
  assert(progress.review['a-few-steps'].due > '2000-01-01');
  pass('Whole-lesson replay counts as review without duplicate completion points');
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await page.getByText('JavaScript and web page experiments', { exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Playground code editor' });
  await editor.fill('console.log("Hello from real code");');
  await page.getByRole('button', { name: 'Run my code', exact: true }).click();
  await page.getByText('Hello from real code', { exact: true }).waitFor();
  pass('Playground executes actual JavaScript');
  await editor.fill('while (true) {}');
  const started = Date.now();
  await page.getByRole('button', { name: 'Run my code', exact: true }).click();
  await page.getByText(/That code took too long/).waitFor({ timeout: 6000 });
  assert(Date.now() - started < 6000);
  pass('Infinite loops stop without freezing the learning app');
  await editor.fill(
    'console.log(typeof localStorage); console.log(typeof document); await fetch("https://example.com");'
  );
  await page.getByRole('button', { name: 'Run my code', exact: true }).click();
  await page.getByText(/Failed to fetch/).waitFor();
  assert.match(await page.locator('.console-output').textContent(), /undefined\nundefined/);
  pass('Code cannot access app storage, DOM or external network');
  await page.getByRole('button', { name: 'HTML & CSS', exact: true }).click();
  await editor.fill('<h1>My own page</h1><script>parent.location="https://example.com"</script>');
  await page.getByRole('button', { name: 'Show my page', exact: true }).click();
  await page
    .frameLocator('iframe[title="Playground page preview"]')
    .getByRole('heading', { name: 'My own page' })
    .waitFor();
  assert(page.url().startsWith(base));
  pass('HTML renders while active scripts stay disabled');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Make something your own.' }).waitFor();
  await page.getByText('JavaScript and web page experiments', { exact: true }).click();
  await page.getByRole('button', { name: 'JavaScript', exact: true }).click();
  await editor.fill('console.log(2 + 3);');
  await page.getByRole('button', { name: 'Run my code', exact: true }).click();
  await page.locator('.console-output').filter({ hasText: '5' }).waitFor();
  await page.getByRole('button', { name: 'My learning path', exact: true }).click();
  await page.getByRole('heading', { name: 'Let’s grow something.' }).waitFor();
  pass('Offline reload, navigation and real code execution work');
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Install on my phone', exact: true }).click();
  await page.getByRole('dialog', { name: 'Take your learning along' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  pass('Phone installation is visible and instructions fit narrow screens');
  assert.deepEqual(pageErrors, []);
  pass('No uncaught application errors');
  if (process.env.SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, 'phone.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, 'desktop.png'),
      fullPage: true,
    });
  }
  console.log(`Verified ${checks} browser checks, including all 30 lessons.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

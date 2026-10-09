import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '..');
const source = ts.transpileModule(
  fs.readFileSync(path.join(root, 'src/data/gameLessons.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
const { gameLessons } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
};
const docs = path.join(root, 'docs');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(docs, pathname.slice('/codesprout/'.length) || 'index.html');
  if (
    !pathname.startsWith('/codesprout/') ||
    !file.startsWith(docs + path.sep) ||
    !fs.existsSync(file)
  )
    return res.writeHead(404).end();
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'text/plain',
    'Cache-Control': 'no-cache',
  });
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/codesprout/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
let count = 0;
const pass = (label) => {
  count++;
  console.log('PASS ' + label);
};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  async function audit(label) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
      label
    );
  }
  async function build(lesson, checkStarter = false) {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'I’m ready for a tiny guess' }).click();
    await dialog.locator('.game-choice').nth(lesson.prediction.correct).click();
    await dialog.getByRole('button', { name: 'Check my guess' }).click();
    await dialog.getByRole('button', { name: 'Let’s build it' }).click();
    if (checkStarter) {
      await dialog.getByRole('button', { name: 'Check my game', exact: true }).click();
      await dialog.locator('.game-result').waitFor();
      assert.equal(
        await dialog.getByRole('button', { name: 'Grow this game skill' }).isDisabled(),
        true
      );
      await dialog.getByRole('button', { name: 'Try this small change' }).click();
      await dialog.getByRole('button', { name: 'Check my game', exact: true }).click();
      await dialog.getByText('Your code passed these behavior checks.', { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(
          (id) => JSON.parse(localStorage.getItem('codesprout.progress.v1')).drafts[id + '-help'],
          lesson.id
        ),
        'used'
      );
      await audit('Guided game editor accessibility');
    }
    await dialog.getByRole('textbox', { name: 'Game code' }).fill(lesson.solution);
    await dialog.getByRole('button', { name: 'Check my game', exact: true }).click();
    await dialog
      .getByText('Your code passed these behavior checks.', { exact: true })
      .waitFor()
      .catch(async (error) => {
        throw new Error(
          `${lesson.id}: ${await dialog
            .locator('.game-result')
            .textContent()
            .catch(() => 'No result')}\n${error.message}`
        );
      });
    await dialog.getByRole('button', { name: 'Grow this game skill' }).click();
  }
  let assistedTested = false;
  for (const [index, lesson] of gameLessons.entries()) {
    console.log('CHECK ' + lesson.id);
    await page.locator('.lesson-row').filter({ hasText: lesson.title }).first().click();
    const dialog = page.getByRole('dialog');
    await build(lesson, index === 0);
    if (lesson.game.challenge) {
      await dialog.getByRole('button', { name: 'Try my own remix' }).click();
      if (!assistedTested) {
        await dialog.getByRole('button', { name: 'A concept hint' }).click();
        await dialog
          .getByRole('textbox', { name: 'Game code' })
          .fill(lesson.game.challenge.solution);
        await dialog.getByRole('button', { name: 'Save and close lesson' }).click();
        await page.reload();
        await page.locator('.lesson-row').filter({ hasText: lesson.title }).first().click();
        await build(lesson);
        await dialog.getByRole('button', { name: 'Try my own remix' }).click();
        await dialog.getByRole('button', { name: 'Check my game', exact: true }).click();
        await dialog
          .getByText('Your code passed these behavior checks.', { exact: true })
          .waitFor();
        assert.equal(await dialog.getByRole('button', { name: 'Save this practice' }).count(), 1);
        assert.equal(
          await page.evaluate(
            (id) =>
              Boolean(
                JSON.parse(localStorage.getItem('codesprout.game-mastery.v1')).independent[id]
              ),
            lesson.id
          ),
          false
        );
        await dialog.getByRole('button', { name: 'Start a fresh challenge' }).click();
        assistedTested = true;
        pass('Hint assistance survives closing/reloading and cannot earn an independent result');
      }
      await dialog.getByRole('textbox', { name: 'Game code' }).fill(lesson.game.challenge.solution);
      await dialog.getByRole('button', { name: 'Check my game', exact: true }).click();
      await dialog.getByText('Your code passed these behavior checks.', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Save my independent result' }).click();
    }
    if (index === 0) await audit('Game completion accessibility');
    await dialog
      .getByRole('button', { name: 'Save and close lesson' })
      .click()
      .catch(async () => {
        await dialog.getByRole('button', { name: 'Back to my learning path' }).click();
      });
  }
  let mastery = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('codesprout.game-mastery.v1'))
  );
  assert.equal(Object.keys(mastery.guided).length, gameLessons.length);
  assert.equal(
    Object.keys(mastery.independent).length,
    gameLessons.filter((l) => l.game.challenge).length
  );
  pass('Every game lesson and independent challenge completes through the actual phone UI');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('textbox', { name: 'My game’s name' }).fill('My saved test game');
  await page.getByRole('button', { name: 'Save my project' }).click();
  await page.getByRole('button', { name: 'Play my game', exact: true }).click();
  await page
    .frameLocator('iframe[title="Playable game"]')
    .getByRole('button', { name: 'Move right' })
    .waitFor();
  await audit('Game workshop accessibility');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    );
  }
  pass('Game workshop fits phones, tablets and desktop, and passes automated WCAG audit');
  await page.getByRole('textbox', { name: 'Game code' }).focus();
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'game-code-editor');
  pass('Keyboard users can leave the code editor with Tab');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download playable game' }).click();
  const download = await downloadPromise;
  const downloaded = await download.path();
  const exported = fs.readFileSync(downloaded, 'utf8');
  assert.match(exported, /sandbox="allow-scripts"/);
  assert.match(exported, /My saved test game/);
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  const exportPath = path.join(root, '.local', 'exported-game.html');
  fs.writeFileSync(exportPath, exported);
  const exportPage = await context.newPage();
  await exportPage.goto('file:///' + exportPath.replaceAll('\\', '/'));
  await exportPage
    .frameLocator('iframe')
    .getByText('Tap the game')
    .waitFor()
    .catch(async () => {
      await exportPage
        .frameLocator('iframe')
        .locator('#status')
        .filter({ hasText: /Arrow|Tap|Playing|game/i })
        .waitFor();
    });
  assert.equal(await exportPage.frameLocator('iframe').locator('canvas').count(), 1);
  await exportPage.close();
  pass('Downloaded HTML contains a self-contained playable game');
  await page.getByRole('button', { name: 'My growth', exact: true }).click();
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save a backup' }).click();
  const backup = await backupPromise;
  const bundle = JSON.parse(fs.readFileSync(await backup.path(), 'utf8'));
  assert.equal(bundle.version, 2);
  assert.equal(Object.keys(bundle.mastery.independent).length, 8);
  assert.equal(Object.keys(bundle.mastery.projects).length, 1);
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await page.getByText('Your saved progress is restored. Welcome back.', { exact: true }).waitFor();
  pass('Backup and restore include challenge evidence and actual saved game code');
  const oldProgress = {
    ...bundle.progress,
    completed: ['one-small-step'],
    xp: 30,
    drafts: {},
    lastLesson: 'one-small-step',
    review: {},
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'old-v1-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(oldProgress)),
  });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('codesprout.progress.v1')).xp === 30
  );
  assert.equal(
    await page.evaluate(
      () =>
        Object.keys(JSON.parse(localStorage.getItem('codesprout.game-mastery.v1')).independent)
          .length
    ),
    8
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'new-v2-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('codesprout.progress.v1')).xp === 900
  );
  pass('Older progress backups restore safely without deleting saved game projects');
  const reviewLesson = gameLessons.find((l) => l.game.challenge);
  await page.evaluate((id) => {
    const m = JSON.parse(localStorage.getItem('codesprout.game-mastery.v1'));
    m.review[id].due = '2000-01-01';
    localStorage.setItem('codesprout.game-mastery.v1', JSON.stringify(m));
  }, reviewLesson.id);
  await page.reload();
  await page.getByRole('button', { name: /A little practice/ }).click();
  await page.getByRole('button', { name: 'Review with code' }).first().click();
  const review = page.getByRole('dialog');
  assert.equal(
    await review.getByRole('textbox', { name: 'Game code' }).inputValue(),
    reviewLesson.game.challenge.starter
  );
  await review
    .getByRole('textbox', { name: 'Game code' })
    .fill(reviewLesson.game.challenge.solution);
  await review.getByRole('button', { name: 'Check my game', exact: true }).click();
  await review.getByText('Your code passed these behavior checks.', { exact: true }).waitFor();
  await review.getByRole('button', { name: 'Save my code review' }).click();
  await review.getByRole('button', { name: 'Back to my learning path' }).click();
  mastery = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('codesprout.game-mastery.v1'))
  );
  assert.equal(mastery.review[reviewLesson.id].interval, 3);
  pass('Spaced game reviews require a fresh passing code challenge and advance the reminder');
  await page.getByRole('button', { name: 'Playground', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Play my game', exact: true }).click();
  await page
    .frameLocator('iframe[title="Playable game"]')
    .locator('#status')
    .filter({ hasText: /Arrow|Tap|Playing|game/i })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'My saved test game', exact: true }).count(),
    1
  );
  pass('Saved games and real game execution work after an offline reload');
  assert.deepEqual(errors, []);
  fs.mkdirSync(path.join(root, '.local'), { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, '.local/game-phone.png'), fullPage: true });
  console.log(`Verified ${count} game UI checks.`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

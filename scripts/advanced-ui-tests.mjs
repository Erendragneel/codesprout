import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = path.resolve(import.meta.dirname, '..');
const docs = path.join(root, 'docs');
const output = path.join(root, '.local');
fs.mkdirSync(output, { recursive: true });
const importSource = async (relative) => {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
};
const { buildChallenges } = await importSource('src/data/buildChallenges.ts');
const { codeWalkthroughs, getCodeWalkthrough } = await importSource('src/data/codeWalkthroughs.ts');
const mime = {
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
    const file = path.resolve(docs, pathname.slice('/codesprout/'.length) || 'index.html');
    if (
      !pathname.startsWith('/codesprout/') ||
      !file.startsWith(docs + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'text/plain',
      'Cache-Control': 'no-cache',
    });
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(500).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/codesprout/`;
const keys = {
  progress: 'codesprout.progress.v1',
  mastery: 'codesprout.game-mastery.v1',
  workshop: 'codesprout.workshop.v1',
};
let browser;
let page;
let count = 0;
const pass = (label) => {
  count++;
  console.log('PASS ' + label);
};
const showValue = (value) =>
  value === undefined ? 'Not set yet' : typeof value === 'string' ? `"${value}"` : String(value);

const inspectorCode = `let score = 0;
let timeLeft = 120;
const player = { x: 40, y: 100, w: 20, h: 20 };
const speed = 20;
function start() { score = 0; timeLeft = 120; player.x = 40; }
function update(dt) {
  score += 1;
  timeLeft = Math.max(0, timeLeft - dt);
  player.x = game.clamp(player.x + speed * dt, 0, game.width - player.w);
}
function draw() {
  game.rect(player.x, player.y, player.w, player.h, "#a8ef95");
  game.text("Frames: " + score, 18, 18);
  game.watch("speed", speed);
}`;

try {
  // The entire suite uses one browser and one phone context sequentially.
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    timezoneId: 'Asia/Tokyo',
  });
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const storage = (key) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  const waitStored = (key, field, value) =>
    page.waitForFunction(
      ({ key, field, value }) => JSON.parse(localStorage.getItem(key) || '{}')[field] === value,
      { key, field, value }
    );
  const nav = (name) =>
    page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('button', { name, exact: true })
      .tap();
  const audit = async (label) => {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    assert.deepEqual(
      result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
      label
    );
  };
  const fit = async (label) => {
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${label} at ${width}px`
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
  };

  // Walkthroughs execute only their fixed examples and must never grant mastery.
  await nav('Practice');
  const beforeWalkthrough = {
    progress: await storage(keys.progress),
    mastery: await storage(keys.mastery),
  };
  const walkthrough = page.locator('.code-walkthrough');
  let testedPredictions = 0;
  for (const example of codeWalkthroughs) {
    const trace = getCodeWalkthrough(example.id);
    await walkthrough
      .getByRole('combobox', { name: 'Choose a small idea' })
      .selectOption(example.id);
    const guessing = walkthrough.getByRole('checkbox', {
      name: 'Try an optional tiny guess before a change',
    });
    if (!(await guessing.isChecked())) await guessing.check();
    assert.equal(
      await walkthrough.getByRole('button', { name: 'Back one step' }).isDisabled(),
      true
    );
    for (const [index, step] of trace.steps.entries()) {
      if (step.prediction) {
        const chosen =
          testedPredictions === 0
            ? (step.prediction.correct + 1) % step.prediction.choices.length
            : step.prediction.correct;
        await walkthrough
          .locator('fieldset')
          .getByRole('button', { name: step.prediction.choices[chosen], exact: true })
          .tap();
        testedPredictions++;
      }
      await walkthrough.getByRole('button', { name: /Next step/ }).tap();
      assert.match(
        await walkthrough.locator('.walkthrough-count').textContent(),
        new RegExp(`Step ${index + 1} of ${trace.steps.length}`)
      );
      assert.equal(
        await walkthrough
          .locator('.walkthrough-lines li[aria-current="step"] .walkthrough-line-number')
          .textContent(),
        String(step.line)
      );
      for (const [name, value] of Object.entries(step.after)) {
        const row = walkthrough
          .locator('.walkthrough-memory tbody tr')
          .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
        assert.equal(
          (await row.locator('td').nth(1).textContent()).trim(),
          showValue(value),
          `${example.id} ${name} after step ${index + 1}`
        );
      }
      if (step.prediction)
        assert.equal(await walkthrough.locator('.walkthrough-guess-result').count(), 1);
    }
    assert.equal(await walkthrough.getByRole('button', { name: /Next step/ }).isDisabled(), true);
    const finalMemory = await walkthrough.locator('.walkthrough-memory').textContent();
    const finalPicture = await walkthrough.locator('.walkthrough-screen svg').innerHTML();
    await walkthrough.getByRole('button', { name: 'Back one step' }).tap();
    assert.equal(await walkthrough.getByRole('button', { name: /Next step/ }).isDisabled(), false);
    await walkthrough.getByRole('button', { name: /Next step/ }).tap();
    assert.equal(await walkthrough.locator('.walkthrough-memory').textContent(), finalMemory);
    assert.equal(await walkthrough.locator('.walkthrough-screen svg').innerHTML(), finalPicture);
    await walkthrough.getByRole('button', { name: 'Start again' }).tap();
    assert.equal(
      await walkthrough.locator('.walkthrough-lines li[aria-current="step"]').count(),
      0
    );
    assert.equal(
      await walkthrough.getByRole('button', { name: 'Back one step' }).isDisabled(),
      true
    );
  }
  assert(testedPredictions >= codeWalkthroughs.length, 'Every example offers a prediction.');
  const afterWalkthrough = {
    progress: await storage(keys.progress),
    mastery: await storage(keys.mastery),
  };
  assert.equal(afterWalkthrough.progress.xp, beforeWalkthrough.progress.xp);
  assert.deepEqual(afterWalkthrough.progress.completed, beforeWalkthrough.progress.completed);
  assert.deepEqual(afterWalkthrough.mastery, beforeWalkthrough.mastery);
  pass(
    'All four walkthroughs step forward/back, predict, restore pictures and facts, and earn no XP or mastery'
  );
  // Capture a useful visible memory change for the final example.
  for (let step = 0; step < 6; step++) {
    if (await walkthrough.getByRole('button', { name: /Next step/ }).isDisabled()) break;
    await walkthrough.getByRole('button', { name: /Next step/ }).tap();
  }
  await fit('Walkthrough and unopened build arena');
  await audit('Walkthrough and build selection accessibility');
  await walkthrough.screenshot({ path: path.join(output, '2.1-walkthrough.png') });
  pass('Walkthrough and build selection fit narrow phones and pass automated WCAG checks');

  const arena = page.locator('.build-arena');
  const build = page.locator('.build-session');
  async function openBuild(challenge) {
    await arena.locator('.build-pick').filter({ hasText: challenge.title }).tap();
    await arena.getByRole('button', { name: /^Open my .* build/ }).tap();
    await build.getByRole('heading', { name: challenge.title, exact: true }).waitFor();
  }
  async function checkBuild(expectPass) {
    await build.getByRole('button', { name: 'Check my game', exact: true }).tap();
    await build.locator('.game-studio .game-result').waitFor();
    if (expectPass) {
      await build.locator('.game-studio .game-result.passed').waitFor();
    } else {
      assert.equal(await build.locator('.game-studio .game-result.passed').count(), 0);
      assert(
        (await build
          .locator('.game-studio .game-result li')
          .filter({ hasText: 'try again' })
          .count()) > 0
      );
    }
  }
  const meteor = buildChallenges.find((c) => c.id === 'build-meteor-survival');
  const bricks = buildChallenges.find((c) => c.id === 'build-brick-breaker');
  await openBuild(meteor);
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    meteor.starter
  );
  await checkBuild(false);
  assert.equal(
    await build
      .getByRole('button', { name: 'Save my independent build', exact: true })
      .isDisabled(),
    true
  );
  await build.getByRole('button', { name: 'A concept hint for this build' }).tap();
  await page.waitForFunction(
    ({ key, id }) => JSON.parse(localStorage.getItem(key)).drafts[id + '-help'] === 'used',
    { key: keys.progress, id: meteor.id }
  );
  await build.getByRole('textbox', { name: 'Game code' }).fill(meteor.solution);
  await arena.getByRole('button', { name: 'Save draft and close build' }).tap();
  await page.reload();
  await openBuild(meteor);
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    meteor.solution
  );
  await checkBuild(true);
  await build.getByRole('button', { name: 'Save my helped build' }).tap();
  await build.getByRole('button', { name: 'Your build is saved', exact: true }).waitFor();
  let mastery = await storage(keys.mastery);
  assert.equal(Boolean(mastery.independent[meteor.id]), false);
  assert.equal(mastery.projects['project-' + meteor.id].code, meteor.solution);
  assert.equal(mastery.projects['project-' + meteor.id].controls, meteor.controls);
  pass(
    'A failing starter stays incomplete, and help survives reload and saves practice without independent credit'
  );

  await build.getByRole('button', { name: 'Start a fresh build' }).tap();
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    meteor.starter
  );
  assert.notEqual((await storage(keys.progress)).drafts[meteor.id + '-help'], 'used');
  await build.getByRole('textbox', { name: 'Game code' }).fill(meteor.solution);
  await checkBuild(true);
  await build.getByRole('button', { name: 'Save my independent build', exact: true }).tap();
  await build.getByRole('button', { name: 'Your build is saved', exact: true }).waitFor();
  await arena.getByRole('button', { name: 'Save draft and close build' }).tap();
  await openBuild(bricks);
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    bricks.starter
  );
  await build.getByRole('textbox', { name: 'Game code' }).fill(bricks.solution);
  await checkBuild(true);
  await build.getByRole('button', { name: 'Save my independent build', exact: true }).tap();
  await build.getByRole('button', { name: 'Your build is saved', exact: true }).waitFor();
  await fit('Independent game editor');
  await audit('Independent build editor and passing result accessibility');
  await page.reload();
  mastery = await storage(keys.mastery);
  for (const challenge of buildChallenges) {
    assert(mastery.independent[challenge.id]);
    assert.equal(mastery.projects['project-' + challenge.id].code, challenge.solution);
    assert.equal(mastery.projects['project-' + challenge.id].controls, challenge.controls);
  }
  pass(
    'Both fresh independent builds save passing evidence, complete source, and controls across reload'
  );

  await page.evaluate(
    ({ key, id }) => {
      const value = JSON.parse(localStorage.getItem(key));
      value.review[id].due = '2000-01-01';
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: keys.mastery, id: meteor.id }
  );
  await page.reload();
  assert.match(
    await arena.locator('.build-pick').filter({ hasText: meteor.title }).textContent(),
    /review is due/i
  );
  await openBuild(meteor);
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    meteor.starter
  );
  await checkBuild(false);
  assert.equal((await storage(keys.mastery)).review[meteor.id].interval, 1);
  assert.equal((await storage(keys.mastery)).review[meteor.id].due, '2000-01-01');
  await build.getByRole('textbox', { name: 'Game code' }).fill(meteor.solution);
  await checkBuild(true);
  await build.getByRole('button', { name: 'Save my independent build review' }).tap();
  await build.getByRole('button', { name: 'Your build is saved', exact: true }).waitFor();
  assert.equal((await storage(keys.mastery)).review[meteor.id].interval, 3);
  assert.notEqual((await storage(keys.mastery)).review[meteor.id].due, '2000-01-01');
  pass(
    'A due independent review starts fresh, rejects incomplete code, and advances only after a new pass'
  );

  await nav('Play');
  const lab = page.locator('.game-lab');
  await lab
    .getByRole('combobox', { name: 'Game starting point' })
    .selectOption({ label: 'Platformer' });
  await lab.getByRole('textbox', { name: 'My game’s name' }).fill('My phone inspector');
  await lab.getByRole('textbox', { name: 'Game code' }).fill(inspectorCode);
  await waitStored(keys.workshop, 'code', inspectorCode);
  let draft = await storage(keys.workshop);
  assert.equal(draft.title, 'My phone inspector');
  assert.equal(draft.controls, 'platformer');
  await page.reload();
  assert.equal(
    await lab.getByRole('textbox', { name: 'My game’s name' }).inputValue(),
    'My phone inspector'
  );
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), inspectorCode);
  await nav('Growth');
  await nav('Play');
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), inspectorCode);
  assert.equal((await storage(keys.workshop)).controls, 'platformer');
  pass('An unsaved workshop title, control mode, and source survive reload and navigation');

  async function inspect() {
    await lab.getByRole('button', { name: 'Play my game', exact: true }).tap();
    await lab
      .locator('.game-live-status')
      .filter({ hasText: /^Playing/ })
      .waitFor();
    const inspector = lab.locator('.game-inspector');
    await inspector.locator('summary').first().tap();
    await inspector.getByRole('button', { name: 'Pause game', exact: true }).tap();
    await inspector.getByRole('button', { name: 'One frame', exact: true }).waitFor();
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('.game-inspector button')].find(
        (b) => b.textContent.trim() === 'One frame'
      );
      return button && !button.disabled;
    });
    await inspector.locator('.game-inspector-time').waitFor();
    const frameNumber = async () =>
      Number(
        (await inspector.locator('.game-inspector-time').textContent()).match(/Frame (\d+)/)[1]
      );
    const watch = async (name) => {
      const row = inspector
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
      return JSON.parse(await row.locator('td pre').textContent());
    };
    assert.equal(await watch('speed'), 20);
    assert.equal(typeof (await watch('score')), 'number');
    assert.equal(typeof (await watch('player')), 'object');
    const before = {
      frame: await frameNumber(),
      time: await watch('timeLeft'),
      score: await watch('score'),
      player: await watch('player'),
    };
    await page.waitForTimeout(120);
    assert.equal(await frameNumber(), before.frame, 'Paused game cannot advance by itself.');
    await inspector.getByRole('button', { name: 'One frame', exact: true }).tap();
    await page.waitForFunction((expected) => {
      const text = document.querySelector('.game-inspector-time')?.textContent || '';
      return Number(text.match(/Frame (\d+)/)?.[1]) === expected;
    }, before.frame + 1);
    assert(Math.abs(before.time - (await watch('timeLeft')) - 1 / 60) < 0.00001);
    assert.equal(await watch('score'), before.score + 1);
    assert(Math.abs((await watch('player')).x - before.player.x - 20 / 60) < 0.00001);
    await inspector.getByRole('button', { name: 'Resume game', exact: true }).tap();
    await page.waitForFunction((previous) => {
      const text = document.querySelector('.game-inspector-time')?.textContent || '';
      return Number(text.match(/Frame (\d+)/)?.[1]) > previous;
    }, before.frame + 1);
    return inspector;
  }
  const inspector = await inspect();
  await inspector.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await fit('Workshop and game inspector');
  await audit('Workshop and paused inspector accessibility');
  await lab.locator('.game-studio').screenshot({ path: path.join(output, '2.1-debugger.png') });
  await lab.getByRole('button', { name: 'Stop', exact: true }).tap();
  pass(
    'Actual Play, common/custom watches, Pause, one 1/60-second frame, and Resume work through the phone UI'
  );

  await lab.getByRole('button', { name: 'Save my project', exact: true }).tap();
  await page.waitForFunction(
    ({ key, title }) =>
      Object.values(JSON.parse(localStorage.getItem(key)).projects).some((p) => p.title === title),
    { key: keys.mastery, title: 'My phone inspector' }
  );
  const projectId = Object.entries((await storage(keys.mastery)).projects).find(
    ([, p]) => p.title === 'My phone inspector'
  )[0];
  const draftB = inspectorCode + '\n// My unsaved draft B';
  await lab.getByRole('textbox', { name: 'My game’s name' }).fill('My unsaved draft B');
  await lab.getByRole('textbox', { name: 'Game code' }).fill(draftB);
  await waitStored(keys.workshop, 'code', draftB);
  assert.equal((await storage(keys.mastery)).projects[projectId].code, inspectorCode);

  async function backup() {
    await nav('Growth');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save a backup', exact: true }).tap();
    const file = await download;
    return JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
  }
  async function restore(bundle) {
    await page.locator('input[type=file]').setInputFiles({
      name: 'advanced-ui-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bundle)),
    });
    await page
      .getByText('Your saved progress is restored. Welcome back.', { exact: true })
      .waitFor();
  }
  const bundleB = await backup();
  assert.equal(bundleB.workshop.code, draftB);
  assert.equal(bundleB.workshop.title, 'My unsaved draft B');
  assert.equal(bundleB.workshop.controls, 'platformer');
  assert.equal(bundleB.mastery.projects[projectId].code, inspectorCode);
  await nav('Play');
  await lab
    .getByRole('textbox', { name: 'Game code' })
    .fill(inspectorCode + '\n// Temporary draft C');
  await nav('Growth');
  await restore(bundleB);
  await nav('Play');
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), draftB);
  assert.equal(
    await lab.getByRole('textbox', { name: 'My game’s name' }).inputValue(),
    'My unsaved draft B'
  );
  const draftD = inspectorCode + '\n// My newest edit after restoring';
  await lab.getByRole('textbox', { name: 'My game’s name' }).fill('My newest phone game');
  await lab.getByRole('textbox', { name: 'Game code' }).fill(draftD);
  await waitStored(keys.workshop, 'code', draftD);
  await nav('Growth');
  await nav('Play');
  await nav('Practice');
  await nav('Play');
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), draftD);
  await page.reload();
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), draftD);
  assert.equal(
    await lab.getByRole('textbox', { name: 'My game’s name' }).inputValue(),
    'My newest phone game'
  );
  assert.equal((await storage(keys.workshop)).controls, 'platformer');
  pass(
    'Backups include an active unsaved draft, and restoring cannot overwrite newer edits during later navigation'
  );

  await lab.getByRole('button', { name: 'Save my project', exact: true }).tap();
  const bundleD = await backup();
  assert.equal(bundleD.mastery.projects[projectId].controls, 'platformer');
  for (const challenge of buildChallenges)
    assert.equal(bundleD.mastery.projects['project-' + challenge.id].controls, 'arrows');
  // Clear only the tested portfolio to verify import actually restores it.
  await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key));
    value.projects = {};
    localStorage.setItem(key, JSON.stringify(value));
  }, keys.mastery);
  await page.reload();
  assert.deepEqual((await storage(keys.mastery)).projects, {});
  await restore(bundleD);
  assert.deepEqual((await storage(keys.mastery)).projects, bundleD.mastery.projects);
  await nav('Play');
  await lab.getByRole('button', { name: 'My newest phone game', exact: true }).tap();
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), draftD);
  await lab.getByRole('button', { name: 'Play my game', exact: true }).tap();
  await page
    .frameLocator('iframe[title="Playable game"]')
    .getByRole('button', { name: 'Jump', exact: true })
    .waitFor();
  await lab.getByRole('button', { name: 'Stop', exact: true }).tap();
  pass(
    'Portfolio backup/restore preserves independent sources and each game’s actual control mode'
  );

  await nav('Practice');
  await context.setOffline(true);
  await page.reload();
  await walkthrough
    .getByRole('combobox', { name: 'Choose a small idea' })
    .selectOption(codeWalkthroughs[0].id);
  await walkthrough.getByRole('button', { name: /Next step/ }).tap();
  assert.equal(await walkthrough.locator('.walkthrough-lines li[aria-current="step"]').count(), 1);
  await openBuild(bricks);
  assert.equal(
    await build.getByRole('textbox', { name: 'Game code' }).inputValue(),
    bricks.starter
  );
  await build.getByRole('textbox', { name: 'Game code' }).fill(bricks.solution);
  await checkBuild(true);
  await nav('Play');
  assert.equal(await lab.getByRole('textbox', { name: 'Game code' }).inputValue(), draftD);
  await inspect();
  pass(
    'Walkthroughs, fresh independent checks, saved workshop, and debugger work after an offline reload'
  );
  assert.deepEqual(errors, []);
  console.log(`Verified ${count} advanced phone UI checks.`);
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(output, '2.1-ui-failure.png'), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

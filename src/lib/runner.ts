import type { Lesson } from '../data/curriculum';

export type CheckResult = { label: string; passed: boolean };
export type RunResult = { output: string[]; error?: string; checks: CheckResult[] };
export type JavaScriptCheck = NonNullable<Lesson['checks']>[number];
export type HtmlCheck = NonNullable<Lesson['htmlChecks']>[number];

const MAX_CODE = 50_000;
const MAX_CHECKS = 20;
const MAX_OUTPUT_LINES = 80;
const MAX_LINE_LENGTH = 2_000;
const TIMEOUT_MESSAGE =
  'That code took too long. Look for a loop that never stops, then try again.';

function token(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function csp(nonce?: string, worker = false): string {
  const scripts = nonce ? `'nonce-${nonce}'${worker ? " 'unsafe-eval' blob:" : ''}` : "'none'";
  return `default-src 'none'; script-src ${scripts}; worker-src ${worker ? 'blob:' : "'none'"}; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
}

function failures(checks: readonly { label: string }[]): CheckResult[] {
  return checks.map((check) => ({ label: check.label, passed: false }));
}

/**
 * The opaque iframe cannot read the application origin. Its worker has no DOM,
 * and a restrictive CSP blocks network requests. Removing the iframe plus the
 * worker's own deadline bounds execution without running learner code on the UI.
 */
function runInSandbox(
  documentHtml: string,
  sandboxToken: string,
  payload: unknown,
  expected: readonly { label: string }[]
): Promise<RunResult> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.body) {
      resolve({
        output: [],
        error: 'The code runner needs a browser. Open CodeSprout in a browser and try again.',
        checks: failures(expected),
      });
      return;
    }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.title = 'Isolated practice runner';
    frame.referrerPolicy = 'no-referrer';
    frame.style.display = 'none';
    let finished = false;
    let started = false;
    let deadline: ReturnType<typeof setTimeout>;
    const finish = (result: RunResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      window.removeEventListener('message', receive);
      frame.remove();
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.token !== sandboxToken)
        return;
      if (event.data.type === 'ready' && !started) {
        started = true;
        frame.contentWindow?.postMessage({ type: 'run', token: sandboxToken, payload }, '*');
      } else if (event.data.type === 'result') {
        const raw = event.data.result;
        if (!raw || !Array.isArray(raw.output) || !Array.isArray(raw.checks)) return;
        const output = raw.output
          .slice(0, MAX_OUTPUT_LINES)
          .map((line: unknown) => String(line).slice(0, MAX_LINE_LENGTH));
        const checks = expected.map((check, index) => ({
          label: check.label,
          passed: raw.checks[index]?.passed === true,
        }));
        finish({
          output,
          checks,
          ...(typeof raw.error === 'string' ? { error: raw.error.slice(0, MAX_LINE_LENGTH) } : {}),
        });
      }
    };
    window.addEventListener('message', receive);
    deadline = setTimeout(
      () => finish({ output: [], error: TIMEOUT_MESSAGE, checks: failures(expected) }),
      3_000
    );
    frame.srcdoc = documentHtml;
    document.body.append(frame);
  });
}

// This source executes only in the worker inside the opaque sandbox.
const WORKER_SOURCE = String.raw`
let hasRun = false;
self.onmessage = async (event) => {
  if (hasRun) return;
  hasRun = true;
  const { code, checks } = event.data;
  const output = [];
  const send = self.postMessage.bind(self);
  const labels = checks.map(check => ({ label: check.label, passed: false }));
  let clipped = false;
  const format = value => {
    if (typeof value === 'string') return value;
    if (typeof value === 'undefined') return 'undefined';
    if (typeof value === 'function') return '[function]';
    if (typeof value === 'bigint') return String(value) + 'n';
    if (value instanceof Error) return value.name + ': ' + value.message;
    try { return JSON.stringify(value) ?? String(value); }
    catch { return '[object with a circular reference]'; }
  };
  const print = (...values) => {
    if (output.length < 79) output.push(values.map(format).join(' ').slice(0, 2000));
    else if (!clipped) { clipped = true; output.push('… Output paused after 80 lines.'); }
  };
  const practiceConsole = Object.freeze({ log: print, info: print, warn: print, error: print, debug: print, clear: () => { output.length = 0; } });
  try {
    // Checks are appended, so const/let declarations are visible to them.
    const expressions = checks.map(check => 'try { __practiceResults.push(Boolean(await (' + check.expression + '))); } catch { __practiceResults.push(false); }').join('\n');
    const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
    const evaluate = new AsyncFunction('console', code + '\n;const __practiceResults = [];\n' + expressions + '\nreturn __practiceResults;');
    const results = await evaluate(practiceConsole);
    send({ output, checks: labels.map((check, index) => ({ ...check, passed: Array.isArray(results) && results[index] === true })) });
  } catch (error) {
    const name = error && error.name ? String(error.name) : 'Error';
    const message = error && error.message ? String(error.message) : String(error);
    send({ output, error: name + ': ' + message, checks: labels });
  }
};`;

export async function runJavaScript(
  code: string,
  checks: JavaScriptCheck[] = []
): Promise<RunResult> {
  const chosen = checks.slice(0, MAX_CHECKS);
  if (code.length > MAX_CODE)
    return {
      output: [],
      error: 'Your code is too long for this practice. Keep it under 50,000 characters.',
      checks: failures(chosen),
    };
  const sandboxToken = token();
  const nonce = token();
  const boot = `
    const sessionToken = ${scriptJson(sandboxToken)};
    const send = result => parent.postMessage({ type: 'result', token: sessionToken, result }, '*');
    let started = false;
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.token !== sessionToken || event.data?.type !== 'run' || started) return;
      started = true;
      const payload = event.data.payload;
      let worker;
      let timeout;
      let blobUrl;
      const stop = result => { clearTimeout(timeout); if (worker) worker.terminate(); if (blobUrl) URL.revokeObjectURL(blobUrl); send(result); };
      try {
        blobUrl = URL.createObjectURL(new Blob([${scriptJson(WORKER_SOURCE)}], { type: 'text/javascript' }));
        worker = new Worker(blobUrl);
        timeout = setTimeout(() => stop({ output: [], error: ${scriptJson(TIMEOUT_MESSAGE)}, checks: payload.checks.map(check => ({ label: check.label, passed: false })) }), 2000);
        worker.onmessage = event => stop(event.data);
        worker.onerror = () => stop({ output: [], error: 'The practice runner could not start. Try a current browser.', checks: [] });
        worker.postMessage(payload);
      } catch {
        stop({ output: [], error: 'This browser could not open the isolated runner. Try a current browser.', checks: [] });
      }
    });
    parent.postMessage({ type: 'ready', token: sessionToken }, '*');
  `;
  const srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp(nonce, true)}"></head><body><script nonce="${nonce}">${boot}</script></body></html>`;
  return runInSandbox(srcdoc, sandboxToken, { code, checks: chosen }, chosen);
}

/** Removes active content and navigation before learner HTML enters an iframe. */
export function sanitizeHtml(code: string): string {
  if (typeof DOMParser === 'undefined') return '';
  const parsed = new DOMParser().parseFromString(code.slice(0, MAX_CODE), 'text/html');
  parsed
    .querySelectorAll('script, iframe, frame, frameset, object, embed, base, meta, link')
    .forEach((element) => element.remove());
  for (const element of parsed.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith('on') ||
        ['srcdoc', 'nonce', 'target', 'download', 'action', 'formaction', 'ping'].includes(name)
      ) {
        element.removeAttribute(attribute.name);
      } else if (['href', 'xlink:href'].includes(name) && !/^#[\w-]*$/.test(value)) {
        if (
          name === 'href' &&
          element.tagName.toLowerCase() === 'a' &&
          /^https?:\/\//i.test(value)
        ) {
          // Preserve the real attribute for link lessons, while making the
          // preview link unfocusable and unclickable so it cannot navigate.
          element.setAttribute('inert', '');
        } else {
          element.removeAttribute(attribute.name);
        }
      } else if (
        ['src', 'poster', 'background', 'srcset'].includes(name) &&
        !/^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return parsed.head.innerHTML + parsed.body.innerHTML;
}

/** Render this document in an iframe with sandbox="" and a descriptive title. */
export function htmlPreviewDocument(code: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp()}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:system-ui,sans-serif;padding:18px;margin:0;color:#233b32;background:#fff}*{box-sizing:border-box}</style></head><body>${sanitizeHtml(code)}</body></html>`;
}

export async function runHtml(code: string, checks: HtmlCheck[] = []): Promise<RunResult> {
  const chosen = checks.slice(0, MAX_CHECKS);
  if (code.length > MAX_CODE)
    return {
      output: [],
      error: 'Your page is too long for this practice. Keep it under 50,000 characters.',
      checks: failures(chosen),
    };
  const sandboxToken = token();
  const nonce = token();
  const boot = `
    const sessionToken = ${scriptJson(sandboxToken)};
    let started = false;
    addEventListener('message', event => {
      if (event.source !== parent || event.data?.token !== sessionToken || event.data?.type !== 'run' || started) return;
      started = true;
      const checks = event.data.payload.checks.map(check => {
        let passed = false;
        try {
          const element = document.querySelector(check.selector);
          passed = !!element;
          if (element && check.text !== undefined) passed = passed && (element.textContent || '').toLowerCase().includes(check.text.toLowerCase());
          if (element && check.style) {
            const property = check.style.property;
            const actual = getComputedStyle(element).getPropertyValue(property).trim();
            const probe = document.createElement('span');
            probe.style.setProperty('all', 'initial', 'important');
            probe.style.setProperty('position', 'fixed', 'important');
            probe.style.setProperty('visibility', 'hidden', 'important');
            probe.style.setProperty(property, check.style.value, 'important');
            document.body.append(probe);
            const accepted = probe.style.getPropertyValue(property);
            const expected = getComputedStyle(probe).getPropertyValue(property).trim();
            probe.remove();
            passed = passed && !!accepted && (actual.toLowerCase() === expected.toLowerCase() || actual.toLowerCase() === check.style.value.toLowerCase());
          }
        } catch { passed = false; }
        return { label: check.label, passed };
      });
      parent.postMessage({ type: 'result', token: sessionToken, result: { output: ['Your page is ready.'], checks } }, '*');
    });
    parent.postMessage({ type: 'ready', token: sessionToken }, '*');
  `;
  const srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp(nonce)}"><style>body{font-family:system-ui,sans-serif;padding:18px;margin:0;color:#233b32;background:#fff}*{box-sizing:border-box}</style></head><body>${sanitizeHtml(code)}<script nonce="${nonce}">${boot}</script></body></html>`;
  return runInSandbox(srcdoc, sandboxToken, { checks: chosen }, chosen);
}

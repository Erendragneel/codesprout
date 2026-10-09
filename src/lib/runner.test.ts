import { afterEach, describe, expect, it, vi } from 'vitest';
import { runHtml, runJavaScript } from './runner';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockBrowser() {
  let receive: (event: MessageEvent) => void = () => {};
  const frame = {
    setAttribute: vi.fn(),
    style: { display: '' },
    title: '',
    referrerPolicy: '',
    srcdoc: '',
    contentWindow: { postMessage: vi.fn() },
    remove: vi.fn(),
  };
  const removeEventListener = vi.fn();
  vi.stubGlobal('document', {
    createElement: () => frame,
    body: { append: vi.fn() },
  });
  vi.stubGlobal('window', {
    addEventListener: (_: string, listener: typeof receive) => {
      receive = listener;
    },
    removeEventListener,
  });
  return {
    frame,
    removeEventListener,
    send(data: unknown, source: unknown = frame.contentWindow) {
      receive({ data, source } as MessageEvent);
    },
    get token() {
      return frame.srcdoc.match(/const sessionToken = "([a-f\d]+)"/)?.[1];
    },
  };
}

describe('isolated runner boundary', () => {
  it('refuses oversized code before creating a sandbox', async () => {
    const oversized = 'x'.repeat(50_001);
    const javascript = await runJavaScript(oversized, [{ label: 'Check', expression: 'true' }]);
    const html = await runHtml(oversized, [{ label: 'Heading', selector: 'h1' }]);
    expect(javascript.error).toContain('too long');
    expect(javascript.checks).toEqual([{ label: 'Check', passed: false }]);
    expect(html.error).toContain('too long');
  });

  it('requires both the correct frame source and a per-run random token', async () => {
    const browser = mockBrowser();
    const result = runJavaScript('console.log("hello")', [
      { label: 'Actual label', expression: 'true' },
    ]);
    expect(browser.frame.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts');
    expect(browser.frame.srcdoc).toContain("connect-src 'none'");
    browser.send({ type: 'ready', token: browser.token }, {});
    browser.send({ type: 'ready', token: 'wrong-token' });
    expect(browser.frame.contentWindow.postMessage).not.toHaveBeenCalled();
    browser.send({ type: 'ready', token: browser.token });
    browser.send({ type: 'ready', token: browser.token });
    expect(browser.frame.contentWindow.postMessage).toHaveBeenCalledTimes(1);
    browser.send({
      type: 'result',
      token: browser.token,
      result: { output: ['hello'], checks: [{ label: 'Forged label', passed: true }] },
    });
    expect(await result).toEqual({
      output: ['hello'],
      checks: [{ label: 'Actual label', passed: true }],
    });
    expect(browser.frame.remove).toHaveBeenCalledTimes(1);
    expect(browser.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('caps output and cleans up even if a sandbox stops responding', async () => {
    vi.useFakeTimers();
    const browser = mockBrowser();
    const timeout = runJavaScript('while (true) {}', [{ label: 'Finish', expression: 'true' }]);
    await vi.advanceTimersByTimeAsync(3_000);
    const timedOut = await timeout;
    expect(timedOut.error).toContain('too long');
    expect(timedOut.checks).toEqual([{ label: 'Finish', passed: false }]);
    expect(browser.frame.remove).toHaveBeenCalledTimes(1);

    const next = mockBrowser();
    const noisy = runJavaScript('console.log("hello")');
    next.send({
      type: 'result',
      token: next.token,
      result: { output: Array(200).fill('x'.repeat(9_000)), checks: [] },
    });
    const bounded = await noisy;
    expect(bounded.output).toHaveLength(80);
    expect(bounded.output[0]).toHaveLength(2_000);
    expect(next.frame.remove).toHaveBeenCalledTimes(1);
  });
});

import { useEffect, useRef, useState } from 'react';
import { createGameDocument, runGameChecks, type GameCheck } from '../lib/gameRuntime';
import type { RunResult } from '../lib/runner';
import { Icon } from './Icon';
import GameInspector, { type InspectorSnapshot } from './GameInspector';
import './game.css';

export function downloadCode(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportGame(
  code: string,
  title: string,
  controls?: 'pointer' | 'arrows' | 'platformer'
) {
  const document = createGameDocument(code, crypto.randomUUID(), controls);
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  downloadCode(
    `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'my-game'}.html`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{margin:0;background:#eef4e8;font-family:system-ui;padding:16px}main{max-width:600px;margin:auto}iframe{width:100%;height:540px;border:0;border-radius:16px}h1{font-size:24px;color:#244a36}p{color:#36503d}</style></head><body><main><h1>${escape(title)}</h1><p>Tap the game or use the arrow keys and Space. Reload to restart.</p><iframe title="${escape(title)}" sandbox="allow-scripts" srcdoc="${escape(document)}"></iframe><p>Made with CodeSprout. This game works offline.</p></main></body></html>`,
    'text/html'
  );
}

export default function GameStudio({
  code,
  onChange,
  tests,
  snippets = [],
  onResult,
  title = 'My game',
  allowExport = true,
  controls,
}: {
  code: string;
  onChange: (code: string) => void;
  tests?: GameCheck[];
  snippets?: { label: string; code: string }[];
  onResult?: (result: RunResult) => void;
  title?: string;
  allowExport?: boolean;
  controls?: 'pointer' | 'arrows' | 'platformer';
}) {
  const [session, setSession] = useState<{ token: string; document: string } | null>(null);
  const [status, setStatus] = useState('Press Play to see your code turn into a game.');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [ready, setReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [controlPending, setControlPending] = useState(false);
  const [snapshot, setSnapshot] = useState<InspectorSnapshot | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(400);
  const editor = useRef<HTMLTextAreaElement>(null);
  const lineNumbers = useRef<HTMLPreElement>(null);
  const active = useRef(true);
  const generation = useRef(0);
  const latestCode = useRef(code);
  latestCode.current = code;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setFrameHeight(Math.ceil((Math.max(0, entry.contentRect.width - 20) * 2) / 3 + 145))
    );
    if (screen.current) observer.observe(screen.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setResult(null);
    setSession(null);
    setReady(false);
    setPaused(false);
    setControlPending(false);
    setSnapshot(null);
    setStatus('Press Play to see your latest code turn into a game.');
    generation.current++;
  }, [code]);
  useEffect(() => {
    if (!session) return;
    let started = false;
    const timer = setTimeout(() => {
      if (!started) {
        setStatus('The game could not start. Try Chrome or check your code.');
        setSession(null);
      }
    }, 4500);
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.token !== session.token)
        return;
      if (event.data.type === 'ready') {
        started = true;
        clearTimeout(timer);
        setStatus('Playing. Tap the game, or use the buttons below it.');
        setReady(true);
      }
      const debug = event.data.debug;
      if (
        debug &&
        typeof debug === 'object' &&
        Number.isSafeInteger(debug.frame) &&
        debug.frame >= 0 &&
        Number.isFinite(debug.time) &&
        debug.time >= 0 &&
        debug.watches &&
        typeof debug.watches === 'object' &&
        !Array.isArray(debug.watches)
      )
        setSnapshot({
          frame: debug.frame,
          time: debug.time,
          watches: Object.fromEntries(Object.entries(debug.watches).slice(0, 12)),
        });
      if (
        ['paused', 'resumed'].includes(event.data.type) ||
        (event.data.type === 'frame' && event.data.paused === true)
      ) {
        setPaused(event.data.paused === true);
        setControlPending(false);
        setStatus(
          event.data.paused
            ? 'Paused. Look at the values or try one frame.'
            : 'Playing. Tap the game, or use the buttons below it.'
        );
      }
      if (event.data.type === 'error') {
        clearTimeout(timer);
        setStatus(
          String(event.data.error || event.data.message || 'The game stopped. Check your code.')
        );
        setReady(false);
        setControlPending(false);
      }
    };
    window.addEventListener('message', receive);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
    };
  }, [session]);
  useEffect(() => {
    if (ready && session)
      frame.current?.contentWindow?.postMessage(
        { type: 'debug', token: session.token, enabled: debugOpen },
        '*'
      );
  }, [ready, session, debugOpen]);
  function control(type: 'pause' | 'resume' | 'step') {
    if (!ready || !session || controlPending) return;
    setControlPending(true);
    frame.current?.contentWindow?.postMessage({ type, token: session.token }, '*');
  }
  function play() {
    const token = crypto.randomUUID();
    setStatus('Starting your game…');
    setReady(false);
    setPaused(false);
    setControlPending(false);
    setSnapshot(null);
    setSession({ token, document: createGameDocument(code, token, controls) });
  }
  async function check() {
    if (!tests || checking) return;
    const revision = generation.current;
    const checkedCode = code;
    setChecking(true);
    setResult(null);
    const next = await runGameChecks(code, tests);
    if (!active.current) return;
    setChecking(false);
    if (revision !== generation.current || checkedCode !== latestCode.current) return;
    setResult(next);
    onResult?.(next);
  }
  function insert(text: string) {
    const el = editor.current;
    const start = el?.selectionStart ?? code.length;
    const end = el?.selectionEnd ?? start;
    onChange(code.slice(0, start) + text + code.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }
  const passed =
    !!result &&
    !result.error &&
    result.checks.length === tests?.length &&
    result.checks.every((c) => c.passed);
  return (
    <div className="game-studio">
      <div className="game-workspace">
        <div className="game-code">
          <label className="game-editor-label" htmlFor="game-code-editor">
            <Icon name="code" size={17} /> Your JavaScript{' '}
            <span>{code.split('\n').length} lines</span>
          </label>
          <div className="game-editor-shell">
            <div className="game-line-gutter" aria-hidden="true">
              <pre ref={lineNumbers}>
                {Array.from(
                  { length: Math.min(2000, code.split('\n').length) },
                  (_, i) => i + 1
                ).join('\n')}
              </pre>
            </div>
            <textarea
              ref={editor}
              id="game-code-editor"
              className="game-editor"
              aria-label="Game code"
              value={code}
              maxLength={50000}
              disabled={checking}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(e) => onChange(e.target.value)}
              onScroll={(e) => {
                if (lineNumbers.current)
                  lineNumbers.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
              }}
            />
          </div>
          {!!snippets.length && (
            <div>
              <p className="small-note">
                Select the part you want to replace, then tap a code idea below.
              </p>
              <div className="game-snippets" aria-label="Tap to insert code">
                {snippets.map((s) => (
                  <button
                    type="button"
                    className="button subtle"
                    key={s.label}
                    disabled={checking}
                    onClick={() => insert(s.code)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="game-screen" ref={screen}>
          {session ? (
            <iframe
              key={session.token}
              ref={frame}
              title="Playable game"
              style={{ height: frameHeight }}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={session.document}
            />
          ) : (
            <div className="game-placeholder">
              <Icon name="game" size={50} />
              <strong>Your ideas go here.</strong>
              <p>Play, change one thing, and play again.</p>
            </div>
          )}
          <p className="game-live-status" role="status">
            {status}
          </p>
          <div className="game-actions">
            <button className="button primary" onClick={play} disabled={checking}>
              <Icon name={session ? 'reset' : 'play'} />
              {session ? 'Restart game' : 'Play my game'}
            </button>
            {session && (
              <button
                className="button secondary"
                onClick={() => {
                  setSession(null);
                  setReady(false);
                  setControlPending(false);
                  setStatus('Stopped. Press Play whenever you’re ready.');
                }}
              >
                Stop
              </button>
            )}
          </div>
          <GameInspector
            ready={ready}
            paused={paused}
            pending={controlPending}
            snapshot={snapshot}
            onOpen={setDebugOpen}
            onControl={control}
          />
        </div>
      </div>
      {tests && (
        <>
          <button
            className="button primary game-check"
            onClick={() => void check()}
            disabled={checking}
          >
            <Icon name="checks" />
            {checking ? 'Trying the game’s behavior…' : 'Check my game'}
          </button>
          <p className="small-note">
            Play lets you try it. Check tests the goal with fresh game states and inputs.
          </p>
        </>
      )}
      {result && (
        <div className={`game-result ${passed ? 'passed' : ''}`} role="status">
          <strong>
            {passed
              ? 'Your code passed these behavior checks.'
              : result.error
                ? 'Let’s fix one small thing.'
                : 'Some behavior still needs a change.'}
          </strong>
          {result.error && <pre>{result.error}</pre>}
          <ul>
            {result.checks.map((c) => (
              <li key={c.label}>
                <Icon name={c.passed ? 'check' : 'circle'} size={16} />
                {c.label}
                {c.passed ? ' — works' : ' — try again'}
              </li>
            ))}
          </ul>
          {!!result.output.length && <pre>{result.output.join('\n')}</pre>}
        </div>
      )}
      {allowExport && (
        <div className="game-export">
          <button className="button subtle" onClick={() => exportGame(code, title, controls)}>
            <Icon name="download" size={17} />
            Download playable game
          </button>
          <button
            className="button subtle"
            onClick={() => downloadCode('my-game.js', code, 'text/javascript')}
          >
            Download JavaScript
          </button>
          <span className="small-note">Your HTML file opens in Chrome and works offline.</span>
        </div>
      )}
    </div>
  );
}

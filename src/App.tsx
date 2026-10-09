import { useEffect, useRef, useState } from 'react';
import { tracks, lessons, glossary, type Lesson, type TrackId } from './data/curriculum';
import {
  completeLesson,
  defaultProgress,
  exportProgress,
  getLevel,
  getStreak,
  importProgress,
  loadProgress,
  localDate,
  recordReview,
  saveProgress,
  type Progress,
} from './lib/progress';
import { htmlPreviewDocument, runJavaScript } from './lib/runner';
import { Icon, type IconName } from './components/Icon';
import { Garden } from './components/Garden';
import LessonView, { speak } from './components/LessonView';

type Nav = 'learn' | 'practice' | 'playground' | 'growth';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const navItems: { id: Nav; label: string; icon: IconName }[] = [
  { id: 'learn', label: 'My learning path', icon: 'home' },
  { id: 'practice', label: 'A little practice', icon: 'flower' },
  { id: 'playground', label: 'Playground', icon: 'terminal' },
  { id: 'growth', label: 'My growth', icon: 'sprout' },
];
const navTitles = {
  learn: 'Let’s grow something.',
  practice: 'Small practice. Strong roots.',
  playground: 'Make something your own.',
  growth: 'Every small step counts.',
};
const jsExamples = [
  {
    title: 'Say hello',
    code: 'const name = "you";\nconsole.log("Hello, " + name + "!");\nconsole.log("You can make things with code.");',
  },
  {
    title: 'A tiny calculator',
    code: 'const price = 8;\nconst quantity = 3;\nconst total = price * quantity;\nconsole.log("Total: " + total);',
  },
  {
    title: 'A friendly function',
    code: 'function cheer(name) {\n  return "You can do this, " + name + "!";\n}\nconsole.log(cheer("Sam"));\nconsole.log(cheer("Alex"));',
  },
];
const htmlExample =
  '<style>\n  body { font-family: sans-serif; padding: 24px; background: #eef4e8; }\n  .card { background: white; padding: 28px; border-radius: 20px; max-width: 280px; }\n  h1 { color: #386349; }\n  button { background: #386349; color: white; border: 0; padding: 12px 20px; border-radius: 12px; }\n</style>\n<div class="card">\n  <h1>Hello, world!</h1>\n  <p>This is a page I made.</p>\n  <button>I’m learning</button>\n</div>';
function initialNav(): Nav {
  const candidate = window.location.hash.slice(1);
  return navItems.some((n) => n.id === candidate) ? (candidate as Nav) : 'learn';
}

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      old?.focus();
    };
  }, []);
  return (
    <div
      className="panel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const all = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input,a[href],textarea'
              ) ?? []
            ).filter((el) => el.offsetParent !== null);
            if (e.shiftKey && document.activeElement === all[0]) {
              e.preventDefault();
              all.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
              e.preventDefault();
              all[0]?.focus();
            }
          }
        }}
      >
        <div className="panel-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [nav, setNav] = useState<Nav>(initialNav);
  const [track, setTrack] = useState<TrackId>('first-steps');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [panel, setPanel] = useState<'install' | 'settings' | 'glossary' | null>(null);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [storageOk, setStorageOk] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [glossarySearch, setGlossarySearch] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const today = localDate();
  const knownCompleted = progress.completed.filter((id) => lessons.some((l) => l.id === id));
  const completedSet = new Set(knownCompleted);
  const total = knownCompleted.length;
  const due = lessons.filter(
    (l) => completedSet.has(l.id) && (progress.review[l.id]?.due ?? today) <= today
  );
  const currentTrack = tracks.find((t) => t.id === track)!;
  const trackLessons = lessons.filter((l) => l.track === track);
  const trackCompleted = trackLessons.filter((l) => completedSet.has(l.id)).length;
  const nextInTrack = trackLessons.find((l) => !completedSet.has(l.id));
  const resume = progress.lastLesson
    ? lessons.find((l) => l.id === progress.lastLesson && !completedSet.has(l.id))
    : undefined;
  const nextLesson = resume ?? lessons.find((l) => !completedSet.has(l.id)) ?? lessons[0];
  const streak = getStreak(progress);
  const level = getLevel(progress.xp);

  useEffect(() => {
    setStorageOk(saveProgress(progress));
  }, [progress]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    const hash = () => {
      setNav(initialNav());
    };
    const install = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const installed = () => {
      setInstallEvent(null);
      setToast('CodeSprout is installed. Your next tiny step is ready.');
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('hashchange', hash);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          if (reg.waiting) setUpdate(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller)
                setUpdate(worker);
            });
          });
        })
        .catch(() => setToast('Offline setup could not finish. You can keep learning online.'));
    }
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', progress.settings.reducedMotion);
  }, [progress.settings.reducedMotion]);
  function navigate(id: Nav) {
    setNav(id);
    window.location.hash = id;
    window.scrollTo({ top: 0 });
    mainRef.current?.focus();
  }
  function unlocked(l: Lesson) {
    const siblings = lessons.filter((a) => a.track === l.track);
    const index = siblings.findIndex((a) => a.id === l.id);
    return index === 0 || siblings.slice(0, index).every((a) => completedSet.has(a.id));
  }
  function openLesson(l: Lesson) {
    if (!unlocked(l)) {
      setToast(
        'Finish the earlier tiny lessons in this path first. They will help this one make sense.'
      );
      return;
    }
    setProgress((p) => ({ ...p, lastLesson: l.id }));
    setLesson(l);
  }
  function complete(id: string) {
    setProgress((p) => (p.completed.includes(id) ? recordReview(p, id) : completeLesson(p, id)));
  }
  function nextAfter(l: Lesson) {
    const siblings = lessons.filter((a) => a.track === l.track);
    const index = siblings.findIndex((a) => a.id === l.id);
    return siblings[index + 1];
  }
  function exportSave() {
    const url = URL.createObjectURL(
      new Blob([exportProgress(progress)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `codesprout-progress-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('Your progress backup was downloaded. Keep it to move to another device.');
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw Error('This backup is too large. Choose a CodeSprout progress file.');
      const next = importProgress(
        await file.text(),
        lessons.map((l) => l.id)
      );
      setProgress(next);
      setToast('Your saved progress is restored. Welcome back.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'That is not a valid CodeSprout backup.');
    }
    if (fileInput.current) fileInput.current.value = '';
  }
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') setPanel(null);
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return {
      date: localDate(date),
      label: date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1),
      count: progress.activity[localDate(date)] ?? 0,
    };
  });
  const units = [...new Set(trackLessons.map((l) => l.unit))];

  return (
    <>
      <div className="app-shell" inert={Boolean(lesson || panel)}>
        <a className="skip-link" href="#main">
          Skip to learning
        </a>
        <aside className="sidebar">
          <a className="brand" href="#learn" onClick={() => navigate('learn')}>
            <span className="brand-icon">
              <Icon name="sprout" size={27} />
            </span>
            <span>
              CodeSprout<span className="brand-tagline">SMALL STEPS. REAL SKILLS.</span>
            </span>
          </a>
          <div className="nav-label">YOUR LITTLE CORNER</div>
          <nav aria-label="Main navigation">
            {navItems.map((n) => (
              <button
                key={n.id}
                className={`nav-item ${nav === n.id ? 'active' : ''}`}
                aria-current={nav === n.id ? 'page' : undefined}
                onClick={() => navigate(n.id)}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {n.id === 'practice' && due.length > 0 && (
                  <span className="nav-count">{due.length}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <Icon name="leaf" size={27} />
              <p>
                You don’t have to be good
                <br />
                to begin. Just curious.
              </p>
            </div>
            <button className="nav-item" onClick={() => setPanel('glossary')}>
              <Icon name="book" />
              <span>Words made simple</span>
            </button>
            <button className="nav-item" onClick={() => setPanel('settings')}>
              <Icon name="settings" />
              <span>Make it comfortable</span>
            </button>
            <button className="install-side" onClick={() => setPanel('install')}>
              <Icon name="download" />
              <span>
                Take your learning along<small>Install on your phone</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
            <div className="sidebar-foot">
              <span className={`status-dot ${online ? '' : 'offline'}`} />
              {online ? 'Ready to grow' : 'Learning offline'}
              <span>v1.0</span>
            </div>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <a className="mobile-brand" href="#learn" onClick={() => navigate('learn')}>
              <Icon name="sprout" size={25} /> CodeSprout
            </a>
            <div className="breadcrumb">
              <span>My space</span>
              <Icon name="chevron" size={14} />
              <strong>{navItems.find((n) => n.id === nav)?.label}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="mobile-install"
                aria-label="Install on my phone"
                onClick={() => setPanel('install')}
              >
                <Icon name="download" size={16} />
                <span>Install</span>
              </button>
              <span className="streak-chip" title="Days with a completed lesson or review">
                <Icon name="flame" size={18} />
                <strong>{streak}</strong>
                <span>day{streak === 1 ? '' : 's'}</span>
              </span>
              <span className="xp-chip">
                <Icon name="zap" size={17} />
                {progress.xp}
                <span>points</span>
              </span>
              <button
                className="avatar"
                aria-label="Open preferences"
                onClick={() => setPanel('settings')}
              >
                <Icon name="sprout" size={21} />
              </button>
            </div>
          </header>
          <main id="main" ref={mainRef} tabIndex={-1}>
            {!storageOk && (
              <div className="notice" role="alert">
                This browser could not save progress. Download a backup from My growth before
                closing.
              </div>
            )}
            {update && (
              <div className="notice">
                A fresh version is ready. Your lesson drafts are saved.
                <button
                  className="text-button"
                  onClick={() => {
                    navigator.serviceWorker.addEventListener(
                      'controllerchange',
                      () => window.location.reload(),
                      { once: true }
                    );
                    update.postMessage({ type: 'SKIP_WAITING' });
                  }}
                >
                  Update app <Icon name="reset" size={15} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {nav === 'learn' ? 'A FRESH LITTLE START' : 'YOUR LEARNING SPACE'}
                </span>
                <h1>{navTitles[nav]}</h1>
                <p>
                  {nav === 'learn'
                    ? 'No experience needed. Just a few minutes and a little curiosity.'
                    : nav === 'practice'
                      ? 'Bring back what you learned. No timers. No pressure.'
                      : nav === 'playground'
                        ? 'Change a piece of code and see what happens.'
                        : 'A seed grows slowly. So do skills. You’re on your way.'}
                </p>
              </div>
              <button
                className="button subtle glossary-shortcut"
                onClick={() => setPanel('glossary')}
              >
                <Icon name="book" size={17} /> Simple words
              </button>
            </div>
            {nav === 'learn' && (
              <>
                <div className="dashboard-top">
                  <section className="continue-card">
                    <div className="continue-copy">
                      <span className="pill light">
                        <span className="tiny-dot" />{' '}
                        {total ? 'YOUR NEXT SMALL STEP' : 'START RIGHT HERE'}
                      </span>
                      <h2>{total ? nextLesson.title : 'Little steps.\nBig possibilities.'}</h2>
                      <p>
                        {total
                          ? nextLesson.subtitle
                          : 'Meet a little robot. Give it one instruction. You’re already thinking like a coder.'}
                      </p>
                      <button className="button cream" onClick={() => openLesson(nextLesson)}>
                        {total ? 'Continue learning' : 'Try my first tiny lesson'}{' '}
                        <Icon name="arrow" size={19} />
                      </button>
                      <div className="continue-meta">
                        <span>
                          <Icon name="leaf" size={15} /> {nextLesson.minutes} easy minutes
                        </span>
                        <span>
                          {nextLesson.kind === 'robot'
                            ? 'Just tap the arrows'
                            : 'Real code, friendly hints'}
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="floating-code code-a">&lt;hello /&gt;</div>
                      <div className="floating-code code-b">one step at a time</div>
                      <Garden growth={total} large />
                    </div>
                  </section>
                  <section className="garden-card">
                    <div className="card-top">
                      <h2>Your little garden</h2>
                      <Icon name="sprout" size={18} />
                    </div>
                    <div className="garden-small">
                      <Garden growth={total} />
                    </div>
                    <p>
                      {total
                        ? `${total} small steps. Look what’s growing.`
                        : 'Your first lesson plants the seed.'}
                    </p>
                    <div className="week-days">
                      {week.map((day, i) => (
                        <div key={day.date} className={i === 6 ? 'today' : ''}>
                          <span className={day.count ? 'active' : ''}>
                            {day.count ? (
                              <Icon name="check" size={13} />
                            ) : (
                              <span className="day-dot" />
                            )}
                          </span>
                          <small>{day.label}</small>
                        </div>
                      ))}
                    </div>
                    <div className="garden-foot">
                      <span>This week</span>
                      <strong>{week.filter((d) => d.count > 0).length} / 7 days</strong>
                    </div>
                  </section>
                </div>
                <div className="path-heading">
                  <div>
                    <h2>Find your learning path</h2>
                    <p>Start simple. Grow at your own pace.</p>
                  </div>
                  <span className="small-note">
                    {total} of {lessons.length} lessons grown
                  </span>
                </div>
                <div className="track-tabs" role="tablist" aria-label="Learning paths">
                  {tracks.map((t) => {
                    const count = lessons.filter(
                      (l) => l.track === t.id && completedSet.has(l.id)
                    ).length;
                    return (
                      <button
                        key={t.id}
                        className={`track-tab ${track === t.id ? 'selected' : ''}`}
                        role="tab"
                        aria-selected={track === t.id}
                        id={`tab-${t.id}`}
                        aria-controls="learning-path"
                        onClick={() => setTrack(t.id as TrackId)}
                      >
                        <span className={`track-icon ${t.id}`}>
                          <Icon name={t.icon as IconName} />
                        </span>
                        <span>
                          <strong>
                            {t.id === 'first-steps'
                              ? 'First steps'
                              : t.id === 'javascript'
                                ? 'JavaScript'
                                : 'Web pages'}
                          </strong>
                          <small>
                            {t.id === 'first-steps'
                              ? 'Begin with simple moves'
                              : t.id === 'javascript'
                                ? 'Tell the computer what to do'
                                : 'Make a page you can see'}
                          </small>
                        </span>
                        <span className="track-count">
                          {count}/{lessons.filter((l) => l.track === t.id).length}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="path-content"
                  id="learning-path"
                  role="tabpanel"
                  aria-labelledby={`tab-${track}`}
                >
                  <section className="lesson-path">
                    <div className="path-intro">
                      <span className="pill sage">
                        {track === 'first-steps'
                          ? 'THE PERFECT FIRST STEP'
                          : track === 'javascript'
                            ? 'REAL CODE, GENTLE STEPS'
                            : 'BRING YOUR IDEAS TO LIFE'}
                      </span>
                      <div className="path-progress">
                        <span>
                          {trackCompleted} of {trackLessons.length} complete
                        </span>
                        <div className="progress-bar">
                          <i
                            style={{ width: `${(trackCompleted / trackLessons.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    {units.map((unit, index) => (
                      <div className="unit" key={unit}>
                        <div className="unit-heading">
                          <span className="unit-number">{String(index + 1).padStart(2, '0')}</span>
                          <div>
                            <span className="eyebrow">A LITTLE CHAPTER</span>
                            <h3>{unit}</h3>
                          </div>
                        </div>
                        <div className="lesson-list">
                          {trackLessons
                            .filter((l) => l.unit === unit)
                            .map((l, i) => {
                              const done = completedSet.has(l.id),
                                available = unlocked(l);
                              return (
                                <button
                                  key={l.id}
                                  className={`lesson-row ${done ? 'done' : ''} ${l.id === nextInTrack?.id ? 'next' : ''} ${available ? '' : 'locked'}`}
                                  aria-disabled={!available}
                                  onClick={() => openLesson(l)}
                                >
                                  <span className="lesson-node">
                                    {done ? (
                                      <Icon name="check" size={19} />
                                    ) : !available ? (
                                      <Icon name="lock" size={16} />
                                    ) : (
                                      <Icon name="play" size={16} />
                                    )}
                                  </span>
                                  <span className="lesson-row-copy">
                                    <strong>{l.title}</strong>
                                    <small>{l.subtitle}</small>
                                  </span>
                                  <span className="lesson-meta">
                                    <span>{l.minutes} min</span>
                                    {done ? (
                                      <span className="complete-label">Grown</span>
                                    ) : available ? (
                                      <Icon name="chevron" size={17} />
                                    ) : (
                                      <span className="locked-label">
                                        Step {trackLessons.indexOf(l) + 1}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </section>
                  <aside className="path-aside">
                    <div className="soft-card">
                      <div className="soft-icon">
                        <Icon name="hint" size={24} />
                      </div>
                      <h3>How a tiny lesson works</h3>
                      <ol className="how-list">
                        <li>
                          <span>1</span>Meet one small idea
                        </li>
                        <li>
                          <span>2</span>Make a little guess
                        </li>
                        <li>
                          <span>3</span>Try it for yourself
                        </li>
                        <li>
                          <span>4</span>See your skills grow
                        </li>
                      </ol>
                      <p>Got stuck? That’s part of learning. There’s always a hint.</p>
                    </div>
                    <div className="review-card">
                      <span className="eyebrow">
                        <Icon name="flower" size={16} /> KEEP YOUR ROOTS STRONG
                      </span>
                      <h3>
                        {due.length
                          ? `${due.length} little reminders`
                          : 'A little practice goes far.'}
                      </h3>
                      <p>
                        {due.length
                          ? 'Some ideas are ready for a quick revisit.'
                          : 'After a lesson, come back tomorrow for a gentle reminder.'}
                      </p>
                      <button className="text-button" onClick={() => navigate('practice')}>
                        Visit practice <Icon name="arrow" size={16} />
                      </button>
                    </div>
                    <div className="quiet-note">
                      <Icon name="shield" size={17} />
                      <span>
                        Free to learn. No account.
                        <br />
                        Your progress stays on this device.
                      </span>
                    </div>
                  </aside>
                </div>
              </>
            )}
            {nav === 'practice' && (
              <ReviewPractice
                progress={progress}
                due={due}
                completed={lessons.filter((l) => completedSet.has(l.id))}
                onReview={(id) => setProgress((p) => recordReview(p, id))}
                onLesson={openLesson}
              />
            )}
            {nav === 'playground' && <Playground />}
            {nav === 'growth' && (
              <>
                <div className="growth-grid">
                  <section className="growth-garden">
                    <span className="pill sage">YOUR SKILLS ARE GROWING</span>
                    <Garden growth={total} large />
                    <h2>
                      {total === 0
                        ? 'Everything starts with a seed.'
                        : total < 8
                          ? 'Strong roots start small.'
                          : total < 16
                            ? 'You’re finding your rhythm.'
                            : 'Look at everything you’ve learned.'}
                    </h2>
                    <p>
                      {total} lessons completed · {Math.round((total / lessons.length) * 100)}% of
                      your garden grown
                    </p>
                    <button className="button primary" onClick={() => openLesson(nextLesson)}>
                      Take my next small step <Icon name="arrow" />
                    </button>
                  </section>
                  <section className="growth-stats">
                    <div className="stat-box">
                      <Icon name="sprout" size={28} />
                      <strong>{total}</strong>
                      <span>Tiny lessons grown</span>
                    </div>
                    <div className="stat-box">
                      <Icon name="zap" size={28} />
                      <strong>{progress.xp}</strong>
                      <span>Growth points earned</span>
                    </div>
                    <div className="stat-box">
                      <Icon name="flame" size={28} />
                      <strong>{streak}</strong>
                      <span>Day{streak === 1 ? '' : 's'} of steady learning</span>
                    </div>
                    <div className="stat-box">
                      <Icon name="trophy" size={28} />
                      <strong>{level.level}</strong>
                      <span>Garden level</span>
                    </div>
                    <div className="level-card">
                      <strong>Level {level.level}</strong>
                      <span>
                        {level.current} / {level.needed} points to the next level
                      </span>
                      <div className="progress-bar">
                        <i
                          style={{
                            width: `${Math.min(100, (level.current / level.needed) * 100)}%`,
                          }}
                        />
                      </div>
                      <p>
                        Points mark practice, not a grade. Helping yourself with a hint still
                        counts.
                      </p>
                    </div>
                  </section>
                </div>
                <div className="achievements">
                  <h2>Little milestones</h2>
                  <div className="milestone-grid">
                    {[
                      {
                        title: 'The first seed',
                        description: 'Complete your first lesson',
                        icon: 'sprout',
                        earned: total >= 1,
                      },
                      {
                        title: 'Growing roots',
                        description: 'Complete the first steps path',
                        icon: 'leaf',
                        earned: lessons
                          .filter((l) => l.track === 'first-steps')
                          .every((l) => completedSet.has(l.id)),
                      },
                      {
                        title: 'Making things',
                        description: 'Complete 10 lessons',
                        icon: 'code',
                        earned: total >= 10,
                      },
                      {
                        title: 'A blooming garden',
                        description: 'Complete every lesson',
                        icon: 'flower',
                        earned: total === lessons.length,
                      },
                    ].map((m) => (
                      <div
                        className={`milestone ${m.earned ? 'earned-milestone' : ''}`}
                        key={m.title}
                      >
                        <div>
                          <Icon name={m.icon as IconName} size={25} />
                        </div>
                        <strong>{m.title}</strong>
                        <span>{m.description}</span>
                        <small>
                          {m.earned ? 'You grew this!' : 'A little goal to grow toward'}
                        </small>
                      </div>
                    ))}
                  </div>
                </div>
                <section className="backup-card">
                  <div>
                    <Icon name="download" size={24} />
                    <div>
                      <h3>Keep your little garden safe.</h3>
                      <p>
                        Download your progress to move it to another phone or browser. Restoring
                        replaces this device’s saved progress.
                      </p>
                    </div>
                  </div>
                  <div className="backup-actions">
                    <button className="button secondary" onClick={exportSave}>
                      Save a backup
                    </button>
                    <button className="button subtle" onClick={() => fileInput.current?.click()}>
                      Restore a backup
                    </button>
                  </div>
                </section>
              </>
            )}
            <footer className="main-footer">
              <span>
                <Icon name="sprout" size={15} /> Made for curious beginnings.
              </span>
              <span>One tiny step is enough for today.</span>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((n) => (
            <button
              key={n.id}
              aria-current={nav === n.id ? 'page' : undefined}
              className={nav === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
            >
              <Icon name={n.icon} size={22} />
              <span>
                {n.id === 'learn'
                  ? 'Learn'
                  : n.id === 'practice'
                    ? 'Practice'
                    : n.id === 'playground'
                      ? 'Play'
                      : 'Growth'}
              </span>
            </button>
          ))}
        </nav>
      </div>
      <input
        ref={fileInput}
        className="visually-hidden"
        tabIndex={-1}
        type="file"
        accept="application/json,.json"
        aria-label="Restore CodeSprout progress backup"
        onChange={(e) => void importSave(e.target.files?.[0])}
      />
      {lesson && (
        <LessonView
          key={lesson.id}
          lesson={lesson}
          draft={progress.drafts[lesson.id]}
          completed={completedSet.has(lesson.id)}
          totalCompleted={total}
          readAloud={progress.settings.readAloud}
          onClose={() => setLesson(null)}
          onDraft={(id, value) =>
            setProgress((p) => ({ ...p, drafts: { ...p.drafts, [id]: value } }))
          }
          onComplete={complete}
          hasNext={Boolean(nextAfter(lesson))}
          onNext={() => {
            const next = nextAfter(lesson);
            if (next) openLesson(next);
            else setLesson(null);
          }}
        />
      )}
      {panel === 'install' && (
        <Panel title="Take your learning along" onClose={() => setPanel(null)}>
          <div className="install-intro">
            <span className="brand-icon">
              <Icon name="sprout" size={30} />
            </span>
            <div>
              <h3>CodeSprout on your home screen</h3>
              <p>One tap to learn. Works offline after your first online visit.</p>
            </div>
          </div>
          {installEvent && (
            <button className="button primary full" onClick={() => void install()}>
              <Icon name="download" /> Install CodeSprout
            </button>
          )}
          <div className="install-steps">
            <h3>On Android</h3>
            <p>
              Open this app in Chrome. Tap the browser’s <strong>⋮ menu</strong>, then{' '}
              <strong>Add to Home screen</strong> or <strong>Install app</strong>.
            </p>
            <h3>On iPhone or iPad</h3>
            <p>
              Open in Safari. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
              If needed, turn on <strong>Open as Web App</strong>.
            </p>
            <h3>On a computer</h3>
            <p>
              In Chrome or Edge, look for the install icon in the address bar or choose the browser
              menu’s app installation option.
            </p>
          </div>
          <p className="small-note">
            Progress belongs to this browser. Use My growth → Save a backup to carry it to another
            device.
          </p>
          <a
            className="text-button"
            href="https://github.com/Erendragneel/codesprout"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub <Icon name="external" size={15} />
          </a>
        </Panel>
      )}
      {panel === 'settings' && (
        <Panel title="Make it comfortable" onClose={() => setPanel(null)}>
          <p className="muted">A gentle space, your way.</p>
          {[
            {
              key: 'readAloud' as const,
              title: 'Read lessons aloud',
              description: 'Hear each tiny idea when you open it. You can also tap the speaker.',
            },
            {
              key: 'reducedMotion' as const,
              title: 'Less movement',
              description: 'Keep transitions and celebrations calm.',
            },
          ].map((setting) => (
            <label className="setting-row" key={setting.key}>
              <span>
                <strong>{setting.title}</strong>
                <small>{setting.description}</small>
              </span>
              <input
                type="checkbox"
                checked={progress.settings[setting.key]}
                onChange={(e) =>
                  setProgress((p) => ({
                    ...p,
                    settings: { ...p.settings, [setting.key]: e.target.checked },
                  }))
                }
              />
              <span className="switch" />
            </label>
          ))}
          <button className="button secondary full" onClick={() => setPanel('glossary')}>
            <Icon name="book" /> Explain a coding word
          </button>
          <button className="button subtle full" onClick={() => setPanel('install')}>
            <Icon name="download" /> Install on my phone
          </button>
          <div className="privacy-note">
            <Icon name="shield" />
            <p>
              Your code and learning progress stay in this browser. There are no ads, subscriptions,
              trackers, or account signups. GitHub hosts the app files.
            </p>
          </div>
          <p className="small-note">CodeSprout 1.0 · Built for first-time learners</p>
        </Panel>
      )}
      {panel === 'glossary' && (
        <Panel title="Words made simple" onClose={() => setPanel(null)}>
          <p className="muted">New words, small explanations. Nothing to memorize.</p>
          <label className="search-field">
            <Icon name="search" />
            <input
              placeholder="Find a word…"
              aria-label="Search simple coding words"
              value={glossarySearch}
              onChange={(e) => setGlossarySearch(e.target.value)}
            />
          </label>
          <div className="glossary-list">
            {glossary
              .filter((g) =>
                `${g.term} ${g.meaning}`.toLowerCase().includes(glossarySearch.toLowerCase())
              )
              .map((g) => (
                <article key={g.term}>
                  <h3>
                    {g.term}
                    <button
                      className="icon-button"
                      aria-label={`Read definition of ${g.term}`}
                      onClick={() => speak(`${g.term}. ${g.meaning}`)}
                    >
                      <Icon name="volume" size={17} />
                    </button>
                  </h3>
                  <p>{g.meaning}</p>
                  <code>{g.example}</code>
                </article>
              ))}
            {!glossary.some((g) =>
              `${g.term} ${g.meaning}`.toLowerCase().includes(glossarySearch.toLowerCase())
            ) && <p>No matching word yet. Try “variable”, “loop”, or “HTML”.</p>}
          </div>
        </Panel>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="leaf" size={19} />
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast('')}>
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
    </>
  );
}

function ReviewPractice({
  progress,
  due,
  completed,
  onReview,
  onLesson,
}: {
  progress: Progress;
  due: Lesson[];
  completed: Lesson[];
  onReview: (id: string) => void;
  onLesson: (l: Lesson) => void;
}) {
  const [initialQueue] = useState(() => (due.length ? due : completed));
  const queue = initialQueue.length ? initialQueue : due.length ? due : completed;
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const current = queue[index];
  if (!completed.length)
    return (
      <section className="empty-state">
        <Garden />
        <h2>Your first little idea is waiting.</h2>
        <p>Try a tiny lesson first. Then we’ll help you remember it here.</p>
        <button className="button primary" onClick={() => onLesson(lessons[0])}>
          Meet my little robot <Icon name="arrow" />
        </button>
      </section>
    );
  if (!current || done)
    return (
      <section className="empty-state">
        <div className="celebration-icon">
          <Icon name="flower" size={38} />
        </div>
        <h2>Your roots are a little stronger.</h2>
        <p>
          You revisited {queue.length} idea{queue.length === 1 ? '' : 's'}. A few minutes can make a
          difference.
        </p>
        <button
          className="button primary"
          onClick={() => {
            setIndex(0);
            setChoice(null);
            setChecked(false);
            setDone(false);
          }}
        >
          Practice these again <Icon name="reset" />
        </button>
        <p className="small-note">Come back tomorrow for another gentle reminder.</p>
      </section>
    );
  return (
    <div className="review-layout">
      <section className="review-question">
        <div className="card-top">
          <span className="pill sage">
            <Icon name="flower" size={14} /> A LITTLE REMINDER
          </span>
          <span className="small-note">
            {index + 1} / {queue.length}
          </span>
        </div>
        <h2>{current.title}</h2>
        <p className="lesson-lead">{current.prediction.question}</p>
        {current.kind !== 'robot' && (
          <pre className="prediction-code">
            <code>{current.example}</code>
          </pre>
        )}
        <div className="choices">
          {current.prediction.choices.map((answer, i) => (
            <button
              className={`choice ${choice === i ? 'selected' : ''}`}
              key={i}
              onClick={() => {
                setChoice(i);
                setChecked(false);
              }}
            >
              <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
              {answer}
            </button>
          ))}
        </div>
        {checked && (
          <div
            className={`feedback ${choice === current.prediction.correct ? 'success' : 'gentle'}`}
            role="status"
          >
            <Icon name={choice === current.prediction.correct ? 'check' : 'hint'} />
            <p>
              {choice === current.prediction.correct
                ? current.prediction.explanation
                : `A little reminder: ${current.explanation} Try another answer.`}
            </p>
          </div>
        )}
        <button
          className="button primary full"
          disabled={choice === null}
          onClick={() => {
            if (checked && choice === current.prediction.correct) {
              onReview(current.id);
              if (index + 1 === queue.length) setDone(true);
              else {
                setIndex((i) => i + 1);
                setChoice(null);
                setChecked(false);
              }
            } else setChecked(true);
          }}
        >
          {checked && choice === current.prediction.correct
            ? index + 1 === queue.length
              ? 'Finish my practice'
              : 'Next little reminder'
            : 'Check my guess'}{' '}
          <Icon name="arrow" />
        </button>
      </section>
      <aside className="soft-card">
        <Icon name="flower" size={30} />
        <h3>Why revisit an idea?</h3>
        <p>Remembering gets easier when you come back after a little break.</p>
        <p>Lessons return after 1 day, then 3, 7, 14, 30, and 60 days.</p>
        <button className="text-button" onClick={() => onLesson(current)}>
          Try the whole lesson again <Icon name="arrow" size={16} />
        </button>
        <div className="quiet-note">
          <Icon name="sprout" size={18} />
          <span>
            {due.length
              ? `${due.length} lessons ready for review`
              : 'You’re caught up. This is extra practice.'}
          </span>
        </div>
      </aside>
    </div>
  );
}

function Playground() {
  const [mode, setMode] = useState<'javascript' | 'html'>('javascript');
  const [js, setJs] = useState(() => {
    try {
      return localStorage.getItem('codesprout-play-js') ?? jsExamples[0].code;
    } catch {
      return jsExamples[0].code;
    }
  });
  const [html, setHtml] = useState(() => {
    try {
      return localStorage.getItem('codesprout-play-html') ?? htmlExample;
    } catch {
      return htmlExample;
    }
  });
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState('');
  const [saved, setSaved] = useState(true);
  const code = mode === 'javascript' ? js : html;
  function edit(value: string) {
    if (mode === 'javascript') setJs(value);
    else setHtml(value);
    setError('');
    try {
      localStorage.setItem(`codesprout-play-${mode === 'html' ? 'html' : 'js'}`, value);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  async function run() {
    if (running) return;
    setRunning(true);
    setError('');
    try {
      if (mode === 'html') {
        setPreview(htmlPreviewDocument(code));
      } else {
        const result = await runJavaScript(code);
        setOutput(result.output);
        setError(result.error ?? '');
      }
    } catch {
      setError('The practice space could not start. Try again.');
    } finally {
      setRunning(false);
    }
  }
  return (
    <>
      <div className="playground-top">
        <div className="segmented">
          <button
            className={mode === 'javascript' ? 'active' : ''}
            disabled={running}
            onClick={() => {
              setMode('javascript');
              setError('');
            }}
          >
            <Icon name="code" size={18} />
            JavaScript
          </button>
          <button
            className={mode === 'html' ? 'active' : ''}
            disabled={running}
            onClick={() => {
              setMode('html');
              setError('');
            }}
          >
            <Icon name="globe" size={18} />
            HTML & CSS
          </button>
        </div>
        <span className="small-note">
          <Icon name="leaf" size={15} /> Nothing to break. Lots to discover.
        </span>
      </div>
      <div className="playground-layout">
        <section>
          <div className="editor playground-editor">
            <div className="editor-bar">
              <span>
                <i /> {mode === 'html' ? 'my-creation.html' : 'my-creation.js'}
              </span>
              <span>{saved ? 'Saved here' : 'Saving unavailable'}</span>
            </div>
            <div className="editor-body">
              <pre className="line-numbers" aria-hidden="true">
                {code
                  .split('\n')
                  .map((_, i) => i + 1)
                  .join('\n')}
              </pre>
              <textarea
                value={code}
                disabled={running}
                aria-label="Playground code editor"
                onChange={(e) => edit(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void run();
                  }
                }}
              />
            </div>
            <div className="editor-footer">
              <span>Ctrl / ⌘ + Enter to run</span>
              <button
                className="text-button"
                disabled={running}
                onClick={() => edit(mode === 'javascript' ? jsExamples[0].code : htmlExample)}
              >
                <Icon name="reset" size={16} />
                Reset
              </button>
            </div>
          </div>
          <button
            className="button primary run-button"
            disabled={running}
            onClick={() => void run()}
          >
            <Icon name="play" size={17} />
            {running ? 'Trying it…' : mode === 'html' ? 'Show my page' : 'Run my code'}
          </button>
        </section>
        <section className="playground-output">
          <div className="card-top">
            <span>
              <Icon name={mode === 'html' ? 'globe' : 'terminal'} size={18} />{' '}
              {mode === 'html' ? 'Your page' : 'What your code says'}
            </span>
            <span className="pill sage">LIVE RESULTS</span>
          </div>
          {mode === 'html' && preview ? (
            <iframe title="Playground page preview" sandbox="" srcDoc={preview} />
          ) : mode === 'javascript' && output.length ? (
            <pre className="console-output">{output.join('\n')}</pre>
          ) : (
            <div className="output-placeholder">
              <Icon name={mode === 'html' ? 'globe' : 'terminal'} size={34} />
              <h3>Your ideas appear here.</h3>
              <p>Tap {mode === 'html' ? 'Show my page' : 'Run my code'} and watch what happens.</p>
            </div>
          )}
          {error && (
            <div className="feedback gentle" role="status">
              <Icon name="hint" />
              <div>
                <strong>A small piece needs a look.</strong>
                <p>{error}</p>
                <p>Check your spelling and brackets. Trying again is how we learn.</p>
              </div>
            </div>
          )}
        </section>
      </div>
      <section className="playground-ideas">
        <h2>A few little things to try</h2>
        <div className="ideas-grid">
          {mode === 'javascript'
            ? jsExamples.map((example, i) => (
                <button
                  className="idea-card"
                  disabled={running}
                  key={example.title}
                  onClick={() => {
                    edit(example.code);
                    setOutput([]);
                  }}
                >
                  <span className="idea-number">0{i + 1}</span>
                  <strong>{example.title}</strong>
                  <span>
                    {
                      [
                        'Change the name. Make it yours.',
                        'Try a new price or quantity.',
                        'Give someone a little encouragement.',
                      ][i]
                    }
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              ))
            : [
                { title: 'Make it yours', text: 'Change the heading and paragraph.' },
                { title: 'Try a new color', text: 'Change #386349 to purple or blue.' },
                { title: 'Grow your page', text: 'Add another paragraph or a list.' },
              ].map((idea, i) => (
                <div className="idea-card" key={idea.title}>
                  <span className="idea-number">0{i + 1}</span>
                  <strong>{idea.title}</strong>
                  <span>{idea.text}</span>
                </div>
              ))}
        </div>
        <p className="small-note">
          JavaScript runs in an isolated practice space. Web previews support HTML and CSS; scripts
          and online assets are disabled.
        </p>
      </section>
    </>
  );
}

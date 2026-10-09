import { useEffect, useRef, useState } from 'react';
import type { Lesson } from '../data/curriculum';
import type { RunResult } from '../lib/runner';
import { Icon } from './Icon';
import GameStudio from './GameStudio';
import { speak } from './LessonView';
import GameGuide from './GameGuide';

export default function GameLessonView({
  lesson,
  draft,
  challengeDraft,
  readAloud,
  reviewMode = false,
  guidedHelp = false,
  remixHelp = false,
  onHelp,
  onClose,
  onDraft,
  onComplete,
  onIndependent,
  onNext,
  hasNext,
}: {
  lesson: Lesson;
  draft?: string;
  challengeDraft?: string;
  readAloud: boolean;
  reviewMode?: boolean;
  guidedHelp?: boolean;
  remixHelp?: boolean;
  onHelp: (challenge: boolean, used: boolean) => void;
  onClose: () => void;
  onDraft: (id: string, value: string) => void;
  onComplete: (id: string, assisted: boolean) => void;
  onIndependent: (id: string, attempts: number, assisted: boolean) => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const game = lesson.game!;
  const [step, setStep] = useState(reviewMode ? 4 : 0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [code, setCode] = useState(draft ?? lesson.starter);
  const [remix, setRemix] = useState(challengeDraft ?? game.challenge?.starter ?? '');
  const [ok, setOk] = useState(false);
  const [remixOk, setRemixOk] = useState(false);
  const [hints, setHints] = useState(0);
  const [assisted, setAssisted] = useState(guidedHelp);
  const [challengeHelp, setChallengeHelp] = useState(remixHelp);
  const [attempts, setAttempts] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    heading.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      window.speechSynthesis?.cancel();
      old?.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
    dialog.current?.scrollTo({ top: 0 });
    if (readAloud && step === 0) speak(`${lesson.title}. ${lesson.explanation}. ${lesson.analogy}`);
  }, [step, lesson, readAloud]);
  function result(r: RunResult, challenge = false) {
    const valid = !r.error && r.checks.length > 0 && r.checks.every((c) => c.passed);
    if (challenge) {
      setAttempts((n) => n + 1);
      setRemixOk(valid);
    } else setOk(valid);
  }
  function beginChallenge() {
    setStep(4);
    setHints(0);
    setOk(false);
  }
  return (
    <div className="lesson-backdrop">
      <div
        className="lesson-modal game-lesson"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-lesson-title"
        ref={dialog}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const all = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),textarea:not(:disabled),input,a[href],summary,iframe'
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
        <div className="lesson-top">
          <span className="pill sage">
            <Icon name="game" size={16} />
            {step === 4 ? 'YOUR OWN REMIX' : game.project}
          </span>
          <button className="icon-button" aria-label="Save and close lesson" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="game-step-progress" aria-label={`Step ${Math.min(step + 1, 4)} of 4`}>
          {['Meet the idea', 'Make a guess', 'Build and play', 'Make it yours'].map((s, i) => (
            <span key={s} className={Math.min(step, 3) >= i ? 'active' : ''}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
        <h2 id="game-lesson-title" ref={heading} tabIndex={-1}>
          {step === 4 ? 'Try a fresh challenge.' : lesson.title}
        </h2>
        {step === 0 && (
          <div className="game-idea">
            <p className="game-concept">{lesson.concept}</p>
            <p>{lesson.explanation}</p>
            <div className="game-analogy">
              <Icon name="hint" />
              {lesson.analogy}
            </div>
            <pre>{lesson.example}</pre>
            <button
              className="button subtle"
              onClick={() => speak(`${lesson.explanation}. ${lesson.analogy}`)}
            >
              <Icon name="volume" />
              Read this aloud
            </button>
            <div className="game-step-actions">
              <button className="button primary" onClick={() => setStep(1)}>
                I’m ready for a tiny guess <Icon name="arrow" />
              </button>
            </div>
          </div>
        )}
        {step === 1 && (
          <>
            <p className="game-concept">{lesson.prediction.question}</p>
            <div className="game-choices">
              {lesson.prediction.choices.map((c, i) => (
                <button
                  key={c}
                  className={`game-choice ${choice === i ? 'selected' : ''}`}
                  aria-pressed={choice === i}
                  onClick={() => {
                    setChoice(i);
                    setChecked(false);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              className="button primary"
              disabled={choice === null}
              onClick={() => setChecked(true)}
            >
              Check my guess
            </button>
            {checked && (
              <div className="game-result" role="status">
                <strong>
                  {choice === lesson.prediction.correct
                    ? 'You’ve got the idea.'
                    : 'A useful guess. Let’s try again.'}
                </strong>
                <p>{lesson.prediction.explanation}</p>
                {choice === lesson.prediction.correct && (
                  <button className="button primary" onClick={() => setStep(2)}>
                    Let’s build it <Icon name="arrow" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <p className="game-task">
              <strong>Your small goal</strong>
              {lesson.task}
            </p>
            {game.patch && (
              <div className="game-small-change">
                <p>Want to see this one change first? This counts as learning with help.</p>
                <code>
                  {game.patch.before} → {game.patch.after}
                </code>
                <button
                  className="button secondary"
                  disabled={!code.includes(game.patch.before)}
                  onClick={() => {
                    const next = code.replace(game.patch!.before, game.patch!.after);
                    setCode(next);
                    setOk(false);
                    setAssisted(true);
                    onHelp(false, true);
                    onDraft(lesson.id, next);
                  }}
                >
                  Try this small change
                </button>
              </div>
            )}
            <GameStudio
              code={code}
              onChange={(v) => {
                setCode(v);
                setOk(false);
                onDraft(lesson.id, v);
              }}
              tests={game.tests}
              controls={game.controls}
              snippets={game.snippets}
              onResult={(r) => result(r)}
              title={lesson.title}
              allowExport={false}
            />
            <div className="game-hints">
              <button
                className="button secondary"
                onClick={() => {
                  setHints((n) => Math.min(n + 1, lesson.hints.length));
                  setAssisted(true);
                  onHelp(false, true);
                }}
              >
                Give me one hint
              </button>
              <button
                className="button subtle"
                onClick={() => {
                  setCode(lesson.solution);
                  setOk(false);
                  setAssisted(true);
                  onHelp(false, true);
                  onDraft(lesson.id, lesson.solution);
                }}
              >
                Show a worked example
              </button>
              <button
                className="button subtle"
                onClick={() => {
                  setCode(lesson.starter);
                  setOk(false);
                  onDraft(lesson.id, lesson.starter);
                }}
              >
                Reset code
              </button>
              {lesson.hints.slice(0, hints).map((h) => (
                <p key={h}>
                  <Icon name="hint" size={16} />
                  {h}
                </p>
              ))}
            </div>
            <GameGuide />
            <button
              className="button primary"
              disabled={!ok}
              onClick={() => {
                onComplete(lesson.id, assisted);
                setStep(3);
              }}
            >
              Grow this game skill <Icon name="sprout" />
            </button>
          </>
        )}
        {step === 3 && (
          <div className="game-finished">
            <Icon name="trophy" size={46} />
            <p className="game-concept">You made a game do something new.</p>
            <p>{lesson.takeaway}</p>
            <p className="small-note">
              {assisted
                ? 'Completed with help. That is a useful step.'
                : 'Guided lesson completed.'}{' '}
              Independent challenges are recorded separately.
            </p>
            {game.challenge && (
              <>
                <p>
                  Now change a different behavior with less help. The checker will try several
                  situations.
                </p>
                <button className="button primary" onClick={beginChallenge}>
                  Try my own remix <Icon name="arrow" />
                </button>
              </>
            )}
            <div className="game-step-actions">
              <button className="button secondary" onClick={hasNext ? onNext : onClose}>
                {hasNext ? 'Next tiny game lesson' : 'Back to my learning path'}
              </button>
            </div>
          </div>
        )}
        {step === 4 && game.challenge && (
          <>
            <p className="game-task">
              <strong>{reviewMode ? 'Bring back this skill' : 'Make it work your way'}</strong>
              {game.challenge.task}
            </p>
            <p className="small-note">
              There is no worked answer here. Several inputs are tested. A hint keeps this as
              practice; restart with a fresh draft to try independently.
            </p>
            <GameStudio
              key="remix"
              code={remix}
              onChange={(v) => {
                setRemix(v);
                setRemixOk(false);
                onDraft(`${lesson.id}-remix`, v);
              }}
              tests={game.challenge.tests}
              controls={game.controls}
              onResult={(r) => result(r, true)}
              title={`${game.project} remix`}
            />
            <div className="game-hints">
              <button
                className="button secondary"
                onClick={() => {
                  setChallengeHelp(true);
                  onHelp(true, true);
                  setHints((n) => Math.min(n + 1, game.challenge!.hints.length));
                }}
              >
                A concept hint
              </button>
              <button
                className="button subtle"
                onClick={() => {
                  setRemix(game.challenge!.starter);
                  setRemixOk(false);
                  setHints(0);
                  setChallengeHelp(false);
                  onHelp(true, false);
                  setAttempts(0);
                  onDraft(`${lesson.id}-remix`, game.challenge!.starter);
                }}
              >
                Start a fresh challenge
              </button>
              {game.challenge.hints.slice(0, hints).map((h) => (
                <p key={h}>{h}</p>
              ))}
            </div>
            <button
              className="button primary"
              disabled={!remixOk}
              onClick={() => {
                onIndependent(lesson.id, attempts, challengeHelp);
                setStep(5);
              }}
            >
              {challengeHelp
                ? 'Save this practice'
                : reviewMode
                  ? 'Save my code review'
                  : 'Save my independent result'}
            </button>
          </>
        )}
        {step === 5 && (
          <div className="game-finished">
            <Icon name="checks" size={46} />
            <h3>
              {challengeHelp ? 'Useful practice completed.' : 'You passed a fresh code challenge.'}
            </h3>
            <p>
              {challengeHelp
                ? 'Try a fresh challenge without hints when you’re ready.'
                : 'Your code handled the tested situations. Keep building and explaining why it works.'}
            </p>
            <button className="button primary" onClick={hasNext && !reviewMode ? onNext : onClose}>
              {hasNext && !reviewMode ? 'Next tiny game lesson' : 'Back to my learning path'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

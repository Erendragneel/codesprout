import { useState } from 'react';
import { buildChallenges, type BuildChallenge } from '../data/buildChallenges';
import type { MasteryState } from '../lib/mastery';
import { dueGameReviews } from '../lib/mastery';
import GameStudio from './GameStudio';
import { Icon } from './Icon';

type Props = {
  mastery: MasteryState;
  drafts: Record<string, string>;
  onDraft: (id: string, value: string) => void;
  onFinish: (id: string, code: string, attempts: number, assisted: boolean) => boolean;
};
function BuildSession({
  challenge,
  mastery,
  drafts,
  onDraft,
  onFinish,
}: Props & { challenge: BuildChallenge }) {
  const fresh = Boolean(mastery.independent[challenge.id]);
  const [code, setCode] = useState(
    fresh ? challenge.starter : (drafts[challenge.id] ?? challenge.starter)
  );
  const [assisted, setAssisted] = useState(
    fresh ? false : drafts[`${challenge.id}-help`] === 'used'
  );
  const [hintCount, setHintCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [passed, setPassed] = useState(false);
  const [saved, setSaved] = useState(false);
  function edit(value: string) {
    setCode(value);
    setPassed(false);
    setSaved(false);
    onDraft(challenge.id, value);
  }
  function reset() {
    edit(challenge.starter);
    setAssisted(false);
    setHintCount(0);
    setAttempts(0);
    onDraft(`${challenge.id}-help`, '');
  }
  return (
    <div className="build-session">
      <h3>{challenge.title}</h3>
      <p>{challenge.brief}</p>
      <details className="build-plan">
        <summary>Help me plan the small jobs</summary>
        <ol>
          {challenge.plan.map((job) => (
            <li key={job}>{job}</li>
          ))}
        </ol>
        <p className="small-note">
          A plan is useful for every coder. The rules and functions are yours to write.
        </p>
      </details>
      <p className="small-note">
        Start with the named pieces below. There is no worked answer here. Your game must handle
        several inputs, win and loss, and a complete restart.
      </p>
      {fresh && (
        <p className="game-task">
          Your earlier game is saved in the workshop. This round starts with a fresh skeleton.
        </p>
      )}
      <GameStudio
        code={code}
        onChange={edit}
        tests={challenge.tests}
        controls={challenge.controls}
        title={challenge.projectTitle}
        onResult={(result) => {
          setAttempts((n) => n + 1);
          setPassed(
            !result.error &&
              result.checks.length === challenge.tests.length &&
              result.checks.every((c) => c.passed)
          );
        }}
      />
      <div className="game-hints">
        <button
          className="button secondary"
          onClick={() => {
            setAssisted(true);
            setHintCount((n) => Math.min(n + 1, challenge.conceptHints.length));
            onDraft(`${challenge.id}-help`, 'used');
          }}
        >
          A concept hint for this build
        </button>
        <button className="button subtle" onClick={reset}>
          Start a fresh build
        </button>
        {challenge.conceptHints.slice(0, hintCount).map((hint) => (
          <p key={hint}>{hint}</p>
        ))}
      </div>
      <button
        className="button primary"
        disabled={!passed || saved}
        onClick={() => {
          setSaved(onFinish(challenge.id, code, attempts, assisted));
        }}
      >
        <Icon name="checks" />
        {saved
          ? 'Your build is saved'
          : assisted
            ? 'Save my helped build'
            : dueGameReviews(mastery).includes(challenge.id)
              ? 'Save my independent build review'
              : 'Save my independent build'}
      </button>
      {saved && (
        <p role="status" className="game-result">
          {assisted
            ? 'Your game is saved as practice. Try a fresh build without hints when you’re ready.'
            : 'Your game passed the tested situations. Your independent result and game source are saved.'}
        </p>
      )}
    </div>
  );
}
export default function BuildArena(props: Props) {
  const [selected, setSelected] = useState(buildChallenges[0].id);
  const [open, setOpen] = useState(false);
  const challenge = buildChallenges.find((c) => c.id === selected)!;
  return (
    <section className="build-arena">
      <div className="build-arena-heading">
        <Icon name="game" size={32} />
        <div>
          <span className="eyebrow">BUILD WITHOUT A RECIPE</span>
          <h2>Turn your ideas into a whole game.</h2>
          <p>
            Try this after the game lessons. Work in small steps, test each part, and use the
            debugger to see what your code does.
          </p>
        </div>
      </div>
      <div className="build-arena-picks">
        {buildChallenges.map((c) => (
          <button
            className={`build-pick ${selected === c.id ? 'selected' : ''}`}
            key={c.id}
            aria-pressed={selected === c.id}
            onClick={() => {
              setSelected(c.id);
              setOpen(false);
            }}
          >
            <strong>{c.title}</strong>
            <span>{c.subtitle}</span>
            <small>
              {dueGameReviews(props.mastery).includes(c.id)
                ? 'A fresh code review is due'
                : props.mastery.independent[c.id]
                  ? 'Independent result saved'
                  : 'A full game to build yourself'}
            </small>
          </button>
        ))}
      </div>
      {open ? (
        <>
          <BuildSession key={selected} {...props} challenge={challenge} />
          <button className="button subtle" onClick={() => setOpen(false)}>
            Save draft and close build
          </button>
        </>
      ) : (
        <button className="button primary" onClick={() => setOpen(true)}>
          Open my {challenge.title.toLowerCase()} build <Icon name="arrow" />
        </button>
      )}
    </section>
  );
}

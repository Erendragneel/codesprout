import { useState } from 'react';
import { gameLessons } from '../data/gameLessons';
import type { MasteryState } from '../lib/mastery';
import GameStudio from './GameStudio';
import GameGuide from './GameGuide';
import { Icon } from './Icon';

const projects = [...new Set(gameLessons.map((l) => l.game!.project))];
const templates = projects
  .filter((p) => !/debug|capstone|scratch/i.test(p))
  .map((project) => ({
    title: project,
    code: gameLessons.filter((l) => l.game!.project === project).at(-1)!.solution,
    controls: gameLessons.filter((l) => l.game!.project === project).at(-1)!.game!.controls,
  }));
const blank =
  'let x = 160;\nlet y = 100;\n\nfunction update(dt) {\n  // Your rules go here.\n}\n\nfunction draw() {\n  game.circle(x, y, 16, "#f3bd57");\n  game.text("My first game", 20, 20);\n}';
export default function GameLab({
  mastery,
  onSave,
  notify,
}: {
  mastery: MasteryState;
  onSave: (id: string, title: string, code: string) => boolean;
  notify: (message: string) => void;
}) {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem('codesprout-game-lab') ?? templates[0]?.code ?? blank;
    } catch {
      return blank;
    }
  });
  const [title, setTitle] = useState('My little game');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [controls, setControls] = useState<'pointer' | 'arrows' | 'platformer' | undefined>();
  function edit(value: string) {
    setCode(value);
    try {
      localStorage.setItem('codesprout-game-lab', value);
    } catch {
      notify('This browser could not save your draft. Download the game to keep it.');
    }
  }
  function load(title: string, code: string, id: string | null = null) {
    setTitle(title);
    setProjectId(id);
    setControls(templates.find((t) => t.title === title)?.controls);
    edit(code);
  }
  return (
    <section className="game-lab">
      <h2>
        <Icon name="game" /> Your game workshop
      </h2>
      <p className="muted">
        Start with a playable example, change it, or build from a blank canvas. Everything runs here
        for free.
      </p>
      <div className="game-lab-header">
        <label>
          A place to start
          <select
            aria-label="Game starting point"
            value=""
            onChange={(e) => {
              if (e.target.value === 'blank') load('My new game', blank);
              else {
                const t = templates[Number(e.target.value)];
                if (t) load(t.title, t.code);
              }
            }}
          >
            <option value="" disabled>
              Choose a game or blank canvas
            </option>
            {templates.map((t, i) => (
              <option value={i} key={t.title}>
                {t.title}
              </option>
            ))}
            <option value="blank">Blank canvas</option>
          </select>
        </label>
        <label>
          My game’s name
          <input
            aria-label="My game’s name"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button
          className="button secondary"
          disabled={!title.trim()}
          onClick={() => {
            const id = projectId ?? `project-${crypto.randomUUID()}`;
            setProjectId(id);
            const saved = onSave(id, title, code);
            notify(
              saved
                ? 'Your game is saved on this device. My growth backups include your saved games.'
                : 'Your game could not be saved. Download the JavaScript or playable game to keep it.'
            );
          }}
        >
          <Icon name="check" />
          Save my project
        </button>
      </div>
      <GameStudio code={code} onChange={edit} title={title} controls={controls} />
      <section className="game-projects">
        <h3>My saved games</h3>
        {Object.keys(mastery.projects).length ? (
          <div className="game-projects-list">
            {Object.entries(mastery.projects).map(([id, p]) => (
              <button
                className="button secondary"
                key={id}
                onClick={() => load(p.title, p.code, id)}
              >
                {p.title}
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="small-note">
            Save a project above to keep your own version. Examples do not count as independent
            challenges.
          </p>
        )}
      </section>
      <GameGuide />
    </section>
  );
}

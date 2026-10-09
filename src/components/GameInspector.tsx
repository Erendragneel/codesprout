import { Icon } from './Icon';
export type InspectorSnapshot = { frame: number; time: number; watches: Record<string, unknown> };
function valueText(value: unknown) {
  try {
    return (
      typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? String(value))
    ).slice(0, 2048);
  } catch {
    return '[value unavailable]';
  }
}
export default function GameInspector({
  ready,
  paused,
  pending,
  snapshot,
  onOpen,
  onControl,
}: {
  ready: boolean;
  paused: boolean;
  pending: boolean;
  snapshot: InspectorSnapshot | null;
  onOpen: (open: boolean) => void;
  onControl: (type: 'pause' | 'resume' | 'step') => void;
}) {
  return (
    <details className="game-inspector" onToggle={(e) => onOpen(e.currentTarget.open)}>
      <summary>
        <Icon name="search" size={17} />
        See inside the game
      </summary>
      <div className="game-inspector-body">
        <p>
          Pause to look. One frame runs the rules for <strong>1/60 of a second</strong>, then draws
          the result. Notice which values changed and explain why.
        </p>
        <div className="game-actions">
          <button
            className="button secondary"
            disabled={!ready || paused || pending}
            onClick={() => onControl('pause')}
          >
            Pause game
          </button>
          <button
            className="button secondary"
            disabled={!ready || !paused || pending}
            onClick={() => onControl('step')}
          >
            One frame
          </button>
          <button
            className="button secondary"
            disabled={!ready || !paused || pending}
            onClick={() => onControl('resume')}
          >
            Resume game
          </button>
        </div>
        <p className="small-note" role="status">
          {!ready
            ? 'Play your game to inspect it.'
            : pending
              ? 'Waiting for the current frame…'
              : paused
                ? 'Paused. Your game is waiting for you.'
                : 'Running. Pause whenever you want to look closely.'}
        </p>
        {snapshot && (
          <>
            <strong className="game-inspector-time">
              Frame {snapshot.frame} · {snapshot.time.toFixed(2)} seconds of game time
            </strong>
            {Object.keys(snapshot.watches).length ? (
              <div className="game-watch-scroll">
                <table className="game-watch-table">
                  <caption>Values from your game</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Value right now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(snapshot.watches)
                      .slice(0, 12)
                      .map(([name, value]) => (
                        <tr key={name}>
                          <th scope="row">
                            <code>{name}</code>
                          </th>
                          <td>
                            <pre>{valueText(value)}</pre>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="small-note">
                No watched values yet. You can add a watch in update or draw.
              </p>
            )}
          </>
        )}
        <details className="game-watch-help">
          <summary>How do I watch my own value?</summary>
          <p>
            Common names such as score, player, ball, and timeLeft appear automatically. For another
            value, put a watch inside your update or draw function:
          </p>
          <pre>game.watch("my speed", speed);</pre>
          <p className="small-note">
            A watch only shows a value. It does not change your game. Up to 12 names are shown;
            large values are shortened.
          </p>
        </details>
      </div>
    </details>
  );
}

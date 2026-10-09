import { Icon } from './Icon';
export function RobotBoard({
  size,
  start,
  goal,
  walls,
  position,
}: {
  size: number;
  start: [number, number];
  goal: [number, number];
  walls: [number, number][];
  position?: [number, number];
}) {
  const current = position ?? start;
  return (
    <div
      className="robot-board"
      role="img"
      aria-label={`Robot at column ${current[0] + 1}, row ${current[1] + 1}. Star at column ${goal[0] + 1}, row ${goal[1] + 1}.`}
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size * size }, (_, i) => {
        const x = i % size,
          y = Math.floor(i / size);
        const robot = current[0] === x && current[1] === y,
          star = goal[0] === x && goal[1] === y,
          wall = walls.some((w) => w[0] === x && w[1] === y);
        return (
          <div
            key={i}
            className={`robot-cell ${wall ? 'wall' : ''} ${star ? 'goal' : ''} ${robot ? 'occupied' : ''}`}
          >
            {robot ? (
              <span className="little-robot">
                <span className="robot-antenna" />
                <span className="robot-eyes">••</span>
                <span className="robot-mouth" />
              </span>
            ) : star ? (
              <Icon name="sparkle" size={27} />
            ) : wall ? (
              <span className="rock">●</span>
            ) : (
              <span className="grid-dot" />
            )}
          </div>
        );
      })}
    </div>
  );
}

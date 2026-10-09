import { describe, expect, it } from 'vitest';
import {
  codeWalkthroughs,
  getCodeWalkthrough,
  getWalkthroughSource,
  type WalkthroughDrawing,
} from './codeWalkthroughs';

function executeDisplayed(id: string) {
  const { code, resultExpression } = getWalkthroughSource(id);
  let drawings: WalkthroughDrawing[] = [];
  const game = {
    clear: () => {
      drawings = [];
    },
    rect: (x: number, y: number, width: number, height: number, color = '#77a965') =>
      drawings.push({ kind: 'rect', x, y, width, height, color }),
    text: (message: unknown, x: number, y: number) => {
      drawings.push({ kind: 'text', message: String(message), x, y });
    },
    overlap: (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number }
    ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  };
  const memory = new Function('game', `"use strict";\n${code}\nreturn ${resultExpression};`)(game);
  return { memory, drawings };
}

describe('guided code walkthroughs', () => {
  it.each(codeWalkthroughs)('traces the same result as the displayed $title program', (example) => {
    const direct = executeDisplayed(example.id);
    const traced = getCodeWalkthrough(example.id);
    expect(traced.finalMemory).toEqual(direct.memory);
    expect(traced.finalScreen).toEqual(direct.drawings);
    expect(example.lines.length).toBeLessThanOrEqual(14);
    expect(
      traced.steps.every(
        (step) => step.line >= 1 && step.line <= example.lines.length && !!step.why
      )
    ).toBe(true);
    const first = getCodeWalkthrough(example.id);
    first.steps[0].after.unrelated = 'changed';
    expect(getCodeWalkthrough(example.id)).toEqual(traced);
  });

  it('separates a stored score change from a later drawing change and skips the no-tap addition', () => {
    const traced = getCodeWalkthrough('tap-counter');
    const additions = traced.steps.filter((step) => step.line === 4);
    expect(additions).toHaveLength(1);
    expect(additions[0].after.score).toBe(1);
    expect(additions[0].screenAfter).toEqual(additions[0].screenBefore);
    const drawn = traced.steps.find((step) => step.line === 8)!;
    expect(
      drawn.screenAfter.some((item) => item.kind === 'text' && item.message === 'Stars: 1')
    ).toBe(true);
    expect(traced.finalMemory.score).toBe(1);
  });

  it('moves by speed times elapsed seconds only while the input is true', () => {
    const movement = getCodeWalkthrough('movement-time').steps.filter((step) => step.line === 4);
    expect(Number(movement[0].after.x) - Number(movement[0].before.x)).toBe(10);
    expect(movement[1].after.x).toBe(movement[1].before.x);
    expect(movement[1].screenAfter).toEqual(movement[1].screenBefore);
  });

  it('follows return out of the function and resumes drawing without executing the skipped movement', () => {
    const { steps, finalMemory } = getCodeWalkthrough('collision-return');
    expect(steps.some((step) => step.line === 7)).toBe(true);
    expect(steps.some((step) => step.line === 9)).toBe(false);
    expect(steps.at(-1)?.line).toBe(14);
    expect(finalMemory.state).toBe('lost');
    expect(finalMemory['player.x']).toBe(30);
  });

  it('awards one pickup, hides it at draw, then restores both facts and the picture on reset', () => {
    const { steps, finalMemory, finalScreen } = getCodeWalkthrough('pickup-reset');
    expect(steps.filter((step) => step.line === 6)).toHaveLength(1);
    expect(
      steps.some(
        (step) =>
          step.after['star.collected'] === true &&
          step.after.score === 1 &&
          step.screenAfter.length === 0
      )
    ).toBe(true);
    expect(finalMemory).toEqual({ score: 0, 'star.collected': false });
    expect(finalScreen.some((item) => item.kind === 'rect' && item.color === 'gold')).toBe(true);
  });

  it('accepts only the built-in example IDs, never a program supplied by the learner', () => {
    expect(() => getCodeWalkthrough('while(true){}')).toThrow('guided code examples');
  });
});

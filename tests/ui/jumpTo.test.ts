import { afterEach, describe, expect, it, vi } from 'vitest';
import { BATCH_TARGETS, jumpTo } from '../../src/ui/presentation';

afterEach(() => vi.unstubAllGlobals());

describe('batch navigation without a DOM', () => {
  it('keeps the four section IDs stable', () => {
    expect(BATCH_TARGETS).toEqual({ steps: 'batch-steps', recipe: 'batch-recipe', rating: 'batch-rating', result: 'batch-result' });
  });
  it.each(Object.values(BATCH_TARGETS))('focuses and aligns %s without route navigation', id => {
    const sequence: string[] = [];
    const focus = vi.fn(() => { sequence.push('focus'); });
    const scrollIntoView = vi.fn(() => { sequence.push('scroll'); });
    const getElementById = vi.fn(() => ({ focus, scrollIntoView }));
    vi.stubGlobal('document', { getElementById });
    jumpTo(id);
    expect(getElementById).toHaveBeenCalledWith(id);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
    expect(sequence).toEqual(['focus', 'scroll']);
  });
  it('does nothing for a section that is not mounted', () => {
    vi.stubGlobal('document', { getElementById: vi.fn(() => null) });
    expect(() => jumpTo(BATCH_TARGETS.result)).not.toThrow();
  });
  it('re-aligns after legacy focus rejects the options object', () => {
    const focus = vi.fn().mockImplementationOnce(() => { throw new TypeError('Unsupported focus options'); });
    const scrollIntoView = vi.fn();
    vi.stubGlobal('document', { getElementById: () => ({ focus, scrollIntoView }) });
    jumpTo(BATCH_TARGETS.recipe);
    expect(focus).toHaveBeenCalledTimes(2);
    expect(focus).toHaveBeenLastCalledWith();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });
});

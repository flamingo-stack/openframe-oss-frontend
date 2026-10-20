import { beforeEach, describe, expect, it } from 'vitest';
import { useMingoSheetStore } from './mingo-sheet-store';

const store = () => useMingoSheetStore.getState();

describe('mingo sheet store', () => {
  beforeEach(() => {
    useMingoSheetStore.setState({ open: false, openAfterNavigation: false, height: null, node: null });
  });

  it('closes on a navigation', () => {
    store().show();
    store().navigated();
    expect(store().open).toBe(false);
  });

  it('opens on the page the next navigation lands on, once', () => {
    store().showAfterNavigation();
    expect(store().open).toBe(false);
    store().navigated();
    expect(store().open).toBe(true);
    store().navigated();
    expect(store().open).toBe(false);
  });

  it('drops a pending open when it is shown or hidden first', () => {
    store().showAfterNavigation();
    store().hide();
    store().navigated();
    expect(store().open).toBe(false);
  });

  it('keeps the dragged height for this viewer', () => {
    store().setHeight(512.4);
    expect(store().height).toBe(512.4);
    expect(window.localStorage.getItem('of.mingo-sheet-height')).toBe('512');
  });
});

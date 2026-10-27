import { beforeEach, describe, expect, it } from 'vitest';
import { isSheetUp, useMingoSheetStore } from './mingo-sheet-store';

const store = () => useMingoSheetStore.getState();

describe('mingo sheet store', () => {
  beforeEach(() => {
    useMingoSheetStore.setState({
      open: false,
      openAfterNavigation: false,
      askedFrom: null,
      height: null,
      node: null,
      lastPage: null,
    });
    window.sessionStorage.clear();
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

  it('is up on the first frame of another page, not on the one it was asked on', () => {
    window.history.replaceState(null, '', '/mingo/chat/?id=a');
    store().showAfterNavigation();
    expect(isSheetUp(store(), '/mingo/chat')).toBe(false);
    expect(isSheetUp(store(), '/devices/')).toBe(true);
    store().navigated();
    expect(isSheetUp(store(), '/devices/')).toBe(true);
    window.history.replaceState(null, '', '/');
  });

  it('stays up while a chat opened in full goes to its page', () => {
    store().show();
    store().openFull();
    expect(store().open).toBe(true);
    store().navigated();
    expect(store().open).toBe(false);
  });

  it('keeps the page a chat page collapses back to for this tab', () => {
    store().rememberPage('/devices/?statuses=ONLINE');
    expect(store().lastPage).toBe('/devices/?statuses=ONLINE');
    expect(window.sessionStorage.getItem('of.mingo-last-page')).toBe('/devices/?statuses=ONLINE');
    store().rememberPage('/mingo/');
    expect(store().lastPage).toBe('/mingo/');
  });

  it('keeps the dragged height for this viewer', () => {
    store().setHeight(512.4);
    expect(store().height).toBe(512.4);
    expect(window.localStorage.getItem('of.mingo-sheet-height')).toBe('512');
  });

  it('forgets the dragged height on a reset', () => {
    store().setHeight(640);
    store().resetHeight();
    expect(store().height).toBeNull();
    expect(window.localStorage.getItem('of.mingo-sheet-height')).toBeNull();
  });
});

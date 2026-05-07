import { describe, expect, it } from 'vitest';
import { APP_NAME } from './App';

describe('App shell contract', () => {
  it('exports TEAM as app name', () => {
    expect(APP_NAME).toBe('TEAM');
  });
});

import { expect, it } from 'bun:test';

it('has a working test environment', () => {
  expect(true).toBe(true);
});

it('loads the test preload', () => {
  expect((globalThis as Record<string, unknown>).__BUN_TEST_SETUP_LOADED__).toBe(true);
});

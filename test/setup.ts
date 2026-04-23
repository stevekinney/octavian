import { afterEach, mock, setSystemTime } from 'bun:test';

// Sentinel so tests can assert the preload actually ran.
(globalThis as Record<string, unknown>).__BUN_TEST_SETUP_LOADED__ = true;

afterEach(() => {
  mock.restore();
  setSystemTime();
});

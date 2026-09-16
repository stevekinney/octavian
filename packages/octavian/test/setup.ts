import { afterEach, mock, setSystemTime } from 'bun:test';

afterEach(() => {
  mock.restore();
  setSystemTime();
});

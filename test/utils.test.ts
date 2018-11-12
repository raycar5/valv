jest.useFakeTimers();
import { Future, just, sleep } from '../src/lib/utils';

describe('Futures', () => {
  it('resolves correctly', async () => {
    const future = new Future<boolean>();

    future.resolve(true);

    expect(await future.promise).toBeTruthy();
  });

  it('rejects correctly', async () => {
    const future = new Future<boolean>();

    const error = 'foo';

    future.reject(error);

    try {
      await future.promise;
    } catch (err) {
      expect(err).toBe(error);
    }
  });
});

describe('sleep', () => {
  it('continues after n milliseconds', async () => {
    const cb = jest.fn();

    sleep(10).then(cb);
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(10);
    await Promise.resolve(); // let Promise scheduler run

    expect(cb).toHaveBeenCalled();
  });
});

describe('just', () => {
  it('emits one item in the next event loop cycle', async () => {
    jest.useRealTimers();
    const cb = jest.fn();
    const p = just('foo')
      .toPromise()
      .then(cb);

    expect(cb).not.toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 0)); //go to next loop of the event loop

    expect(cb).toHaveBeenCalled();
  });
});

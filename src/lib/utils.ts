import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

export type Mapper<T, E> = (e: T, index?: number) => E;

/* istanbul ignore next */
export function noop() {}

export class Future<T> {
  public promise: Promise<T>;
  public resolve: (x: T) => void = noop;
  public reject: (e: any) => void = noop;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export function just<T>(v: T) {
  return of(v).pipe(delay(0));
}

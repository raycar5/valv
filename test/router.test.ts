import { take } from 'rxjs/operators';
import {
  BlocRepo,
  Widget,
  just,
  sleep,
  RouterBloc,
  PaginatedRouteMatcher,
  PaginatedRouteProps,
  makeRedirecter,
  RouterWidget,
  Context
} from '../src/valv';
import { html, render } from 'lit-html';
import { widgetRenderedSpy } from '../src/lib/test-utils';

describe('RouterBloc', () => {
  it('captures the current route', async () => {
    const expectedRoute = '/foo/bar';
    const newWindow = {
      location: {
        pathname: expectedRoute
      }
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });
    const router = new RouterBloc();
    const route = await router.routeObservable.pipe(take(1)).toPromise();
    expect(route).toBe(expectedRoute);
  });

  it('goes forwards and backwards', async () => {
    const origin = 'www.foobar.baz';
    const initial = '/';
    const pushStateSpy = jest.fn();
    const backSpy = jest.fn();
    const observerSpy = jest.fn();

    const newWindow = {
      history: {
        pushState(_: any, __: any, path: string) {
          pushStateSpy(path);
        },
        back: backSpy
      },
      location: {
        origin,
        pathname: initial
      }
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });

    const router = new RouterBloc();
    router.routeObservable.subscribe({
      next: observerSpy
    });

    const after = '/foo';
    router.nextObserver.next(after);
    expect(pushStateSpy).toHaveBeenCalledWith(origin + after);
    expect(observerSpy.mock.calls).toEqual([[initial], [after]]);
    router.backObserver.next(null);
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(observerSpy.mock.calls).toEqual([[initial], [after], [initial]]);
  });

  it('replaces state', async () => {
    const origin = 'www.foobar.baz';
    const initial = '/';
    const intermediate = '/bar';
    const after = '/foo';

    const history = [initial];
    const location = {
      origin,
      pathname: initial
    };
    const newWindow = {
      history: {
        pushState(_: any, __: any, path: string) {
          path = path.replace(origin, '');
          history.push(path);
          location.pathname = path;
        },
        replaceState(_: any, __: any, path: string) {
          path = path.replace(origin, '');
          history.pop();
          history.push(path);
          location.pathname = path;
        },
        back() {
          if (history.length > 1) {
            history.pop();
            location.pathname = history[history.length - 1]!;
          } else {
            expect(true).toBeFalsy(); // Something weird happened
          }
        }
      },
      location
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });

    const router = new RouterBloc();

    router.nextObserver.next(intermediate);
    expect(window.location.pathname).toBe(intermediate);
    router.replaceObserver.next(after);
    expect(window.location.pathname).toBe(after);
    router.backObserver.next(null);
    expect(window.location.pathname).toBe(initial);
  });

  it('detects onpopstate', () => {
    const initial = '/';
    const observerSpy = jest.fn();

    const newWindow = {
      location: {
        pathname: initial
      }
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });

    const router = new RouterBloc();
    router.routeObservable.subscribe({ next: observerSpy });

    const after = '/bar';

    window.location.pathname = after;
    if (window.onpopstate) {
      window.onpopstate(new PopStateEvent(''));
    }
    expect(observerSpy.mock.calls).toEqual([[initial], [after]]);
  });

  it('does pagination', () => {
    const path = '/baz/';
    const origin = 'foo.bar.baz';
    const initial = path + 2;
    const observerSpy = jest.fn();
    const pushStateSpy = jest.fn();

    const newWindow = {
      location: {
        origin,
        pathname: initial
      },
      history: {
        pushState(_: any, __: any, path: string) {
          pushStateSpy(path);
          window.location.pathname = path;
        }
      }
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });
    const router = new RouterBloc();
    router.routeObservable.subscribe({ next: observerSpy });

    const after = path + 5;

    router.paginationDeltaObserver.next(3);

    const after2 = path + 3;

    router.paginationDeltaObserver.next(-2);
    expect(pushStateSpy.mock.calls).toEqual([[origin + after], [origin + after2]]);
    expect(observerSpy.mock.calls).toEqual([[initial], [after], [after2]]);
  });

  it("doesn't do anything if the current route is not paginated and paginationDeltaObserver is used", () => {
    const initial = '/baz';
    const origin = 'foo.bar.baz';
    const observerSpy = jest.fn();
    const pushStateSpy = jest.fn();

    const newWindow = {
      location: {
        origin,
        pathname: initial
      },
      history: {
        pushState(_: any, __: any, path: string) {
          pushStateSpy(path);
          window.location.pathname = path;
        }
      }
    };
    Object.defineProperty(global, 'window', { value: newWindow, writable: true });
    const router = new RouterBloc();
    router.routeObservable.subscribe({ next: observerSpy });

    const oldError = console.error;
    console.error = () => {};
    router.paginationDeltaObserver.next(3);
    console.error = oldError;

    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(observerSpy.mock.calls).toEqual([[initial]]);
  });
});

describe('RouterWidget', () => {
  it('matches using routes map', async () => {
    const path = '/bar/foo';
    const renderedSpy = jest.fn();
    const context = new Context();
    render(
      RouterWidget(context, {
        routes: { [path]: widgetRenderedSpy(renderedSpy)(context) },
        routeObservable: just(path)
      }),
      document.querySelector('body') as Element
    );
    await sleep(0);
    expect(renderedSpy).toHaveBeenCalled();
  });
  it('matches using matcher', async () => {
    const path = '/bar/foo';
    const renderedSpy = jest.fn();
    const context = new Context();
    render(
      RouterWidget(context, {
        matchers: [matched => widgetRenderedSpy(renderedSpy)(context)],
        routeObservable: just(path)
      }),
      document.querySelector('body') as Element
    );
    await sleep(0);
    expect(renderedSpy).toHaveBeenCalled();
  });
  it('displays the 404 page when nothing matches', async () => {
    const path = '/bar/foo';
    const body = document.querySelector('body') as Element;
    render(
      RouterWidget(new Context(), {
        matchers: [matched => undefined],
        routeObservable: just(path),
        notFoundRoute: html`
          404
        `
      }),
      body
    );
    await sleep(0);
    expect(body.textContent).toContain('404');
  });
  it('throws if no props are provided', () => {
    expect(() => RouterWidget(new Context())).toThrow();
  });
});

describe('PaginatedRouteMatcher', () => {
  it('should return the correct route', () => {
    const page = '/foobar/2';
    const matcher = PaginatedRouteMatcher(new Context(), {
      '/foobar': Widget<PaginatedRouteProps<any>>((context, props) => {
        if (props) {
          expect(props.page).toBe(2);
        } else {
          expect(true).toBeFalsy();
        }
        return html``;
      })
    });
    matcher(page);
  });
  it('should return undefined if the route is not matched', () => {
    const page = '/foobar/2';
    const matcher = PaginatedRouteMatcher(new Context(), {
      '/baz': Widget<PaginatedRouteProps<any>>((context, props) => {
        return html``;
      })
    });
    expect(matcher(page)).toBeUndefined();
  });
  it('should return undefined if the route is not paginated', () => {
    const page = '/baz';
    const matcher = PaginatedRouteMatcher(new Context(), {
      '/baz': Widget<PaginatedRouteProps<any>>((context, props) => {
        return html``;
      })
    });
    expect(matcher(page)).toBeUndefined();
  });
});

describe('makeRedirecter', () => {
  it('should redirect to the page on render', done => {
    const redirectPath = '/baz';
    const context = new Context();
    context.blocs.register(RouterBloc, {
      replaceObserver: {
        next(path: string) {
          expect(path).toEqual(redirectPath);
          done();
        }
      }
    });
    render(makeRedirecter(redirectPath)(context), document.querySelector('body') as Element);
  });
});

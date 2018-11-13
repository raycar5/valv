import { NextObserver, Observable, PartialObserver, BehaviorSubject, defer } from 'rxjs';
import { TemplateResult, html } from 'lit-html';
import { Widget, awaito, BlocRepo, ValvContext } from './core';

export class RouterBloc {
  public readonly nextObserver: NextObserver<string>;
  public readonly backObserver: NextObserver<any>;
  public readonly routeObservable: Observable<string>;
  public readonly paginationDeltaObserver: NextObserver<number>;
  constructor() {
    // Setup
    const routeSubject = new BehaviorSubject(window.location.pathname);
    this.routeObservable = routeSubject;

    this.nextObserver = {
      next(path) {
        window.history.pushState({}, '', window.location.origin + path);
        routeSubject.next(path);
      }
    };

    this.backObserver = {
      next() {
        window.history.back();
        routeSubject.next(window.location.pathname);
      }
    };

    window.onpopstate = function(e) {
      routeSubject.next(window.location.pathname);
    };

    /**
     * pageDelta = -3;
     * /foo/bar/23 => /foo/bar/(23 + pageDelta) => /foo/bar/20
     */
    this.paginationDeltaObserver = {
      next(pageDelta) {
        const r = /((?:\/\w+)+\/)(?:(\d+))/; // matches path and number (/foo/bar/)(21)
        const match = r.exec(window.location.pathname);
        if (!match || match[1] === undefined || match[2] === undefined) {
          console.error('called paginationDeltaObserver in a non paginated route');
          return;
        }
        const path = match[1] + (parseInt(match[2]) + pageDelta);
        window.history.pushState({}, path, window.location.origin + path);
        routeSubject.next(path);
      }
    };
  }
}

type PathMatcher = (path: string) => TemplateResult | undefined;
export interface RouterProps {
  routeObservable: Observable<string>;
  matchers?: Array<PathMatcher>;
  routes?: { [path: string]: TemplateResult };
  notFoundRoute?: TemplateResult;
}
export const RouterWidget = Widget((context, props?: RouterProps) => {
  if (!props) {
    throw new Error('Invalid router props');
  }
  const {
    routeObservable,
    matchers = [],
    routes = {},
    notFoundRoute = html`
      404 not found <br />
      you should probably pass the notFoundRoute argument to the RouterWidget
    `
  } = props;
  return html`
    ${
      awaito(routeObservable, path => {
        for (const matcher of matchers) {
          const template = matcher(path);
          if (template) return template;
        }
        const template = routes[path];
        if (template) return template;
        return notFoundRoute;
      })
    }
  `;
});

export interface PaginatedRouteProps<T> {
  page: number;
  metadata?: T;
}
export interface PageFactoryMap<T> {
  [path: string]: Widget<PaginatedRouteProps<T>>;
}
export function PaginatedRouteMatcher<T>(context: ValvContext, routes: PageFactoryMap<T>) {
  return function(path: string) {
    const r = /((?:\/\w+)+)\/(.*)/;
    const results = r.exec(path);
    if (!results || !results[0]) return undefined;
    const route = routes[results[1]];
    if (!route) return undefined;
    return route(context, { page: parseInt(results[2]) });
  };
}
export function makeRedirecter(path: string) {
  return Widget(context => {
    const o = defer(() => {
      context.blocs.of(RouterBloc).nextObserver.next(path);
    });
    return html`
      ${awaito(o)}
    `;
  });
}

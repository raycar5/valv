import { NextObserver, Observable, BehaviorSubject, defer, from } from 'rxjs';
import { TemplateResult, html, noChange } from 'lit-html';
import { Widget, awaito, BlocRepo, ValvContext, isWidget } from './core';
import { switchMap } from 'rxjs/operators';

export class RouterBloc {
  public readonly $next: NextObserver<string>;
  public readonly $replace: NextObserver<string>;
  public readonly $back: NextObserver<any>;
  public readonly route$: Observable<string>;
  public readonly $paginationDelta: NextObserver<number>;
  constructor() {
    // Setup
    const $route$ = new BehaviorSubject(window.location.pathname);
    this.route$ = $route$;

    this.$next = {
      next(path) {
        window.history.pushState({}, '', path);
        $route$.next(path);
      }
    };

    this.$replace = {
      next(path) {
        window.history.replaceState({}, '', path);
        $route$.next(path);
      }
    };

    this.$back = {
      next() {
        window.history.back();
        $route$.next(window.location.pathname);
      }
    };

    window.onpopstate = function(e) {
      $route$.next(window.location.pathname);
    };

    /**
     * pageDelta = -3;
     * /foo/bar/23 => /foo/bar/(23 + pageDelta) => /foo/bar/20
     */
    this.$paginationDelta = {
      next(pageDelta) {
        const r = /((?:\/\w+)+\/)(?:(\d+))/; // matches path and number (/foo/bar/)(21)
        const match = r.exec(window.location.pathname);
        if (!match || match[1] === undefined || match[2] === undefined) {
          console.error('called $paginationDelta in a non paginated route');
          return;
        }
        const path = match[1] + (parseInt(match[2]) + pageDelta);
        window.history.pushState({}, '', path);
        $route$.next(path);
      }
    };
  }
}

type TemplateFactory = () => Promise<TemplateResult> | TemplateResult;
type PathMatcher = (
  path: string,
  previousPath: string
) => TemplateResult | undefined | Promise<TemplateResult | undefined>;
export interface RouterProps {
  route$: Observable<string>;
  matchers?: Array<PathMatcher>;
  routes?: { [path: string]: TemplateResult | TemplateFactory };
  notFoundRoute?: TemplateResult;
}
export const RouterWidget = Widget((context, props?: RouterProps) => {
  if (!props) {
    throw new Error('Invalid router props');
  }
  const {
    route$,
    matchers = [],
    routes = {},
    notFoundRoute = html`
      404 not found <br />
      you should probably pass the notFoundRoute argument to the RouterWidget
    `
  } = props;
  let previousPath = '';
  return html`
    ${
      awaito(
        route$.pipe(
          switchMap(path =>
            from(
              (async function() {
                for (const matcher of matchers) {
                  const template = await matcher(path, previousPath);
                  if (template) {
                    previousPath = path;
                    return template;
                  }
                }
                previousPath = path;
                const template = routes[path];
                if (template) {
                  if (typeof template === 'function') {
                    return await template();
                  } else {
                    return template;
                  }
                }
                return notFoundRoute;
              })()
            )
          )
        )
      )
    }
  `;
});

export type WidgetFactory<T> = () => Widget<T> | Promise<Widget<T>>;
export interface PaginatedRouteProps<T> {
  page: number;
  metadata?: T;
}
export interface PaginationPageFactoryMap<T> {
  [path: string]: Widget<PaginatedRouteProps<T>> | WidgetFactory<PaginatedRouteProps<T>>;
}

export const paginationRegex = /((?:\/\w+)+)\/(.+)/;

export function PaginatedRouteMatcher<T>(
  context: ValvContext,
  routes: PaginationPageFactoryMap<T>
) {
  return async function(path: string) {
    const results = paginationRegex.exec(path);
    if (!results || !results[0]) return undefined;
    let route = routes[results[1]];
    if (!route) return undefined;
    if (!isWidget(route)) {
      route = await (route as WidgetFactory<PaginatedRouteProps<T>>)();
    }
    return (route as Widget<PaginatedRouteProps<T>>)(context, { page: parseInt(results[2]) });
  };
}
export function makeRedirecter(path: string) {
  return Widget(context => {
    const o = defer(() => {
      context.blocs.of(RouterBloc).$replace.next(path);
    });
    return html`
      ${awaito(o)}
    `;
  });
}

export interface InWidgetProps<T> {
  page$: Observable<T>;
}

export type InWidgetPaginationProps = InWidgetProps<{ path: string; page: number }>;
export function InWidgetPaginationMatcherHelper(s: string | Set<string>) {
  const isString = typeof s == 'string';
  return (path: string) => {
    const match = paginationRegex.exec(path);
    if (
      match &&
      ((isString && match[1] === s) || (!isString && (s as Set<string>).has(match[1])))
    ) {
      return { path: match[1], page: parseInt(match[2]) };
    } else {
      return undefined;
    }
  };
}

export function InWidgetMatcher<T>(
  context: ValvContext,
  matcher: (path: string) => T | undefined,
  widget: Widget<InWidgetProps<T>> | WidgetFactory<InWidgetProps<T>>
): PathMatcher {
  let s: BehaviorSubject<T>;
  return async (path, previousPath) => {
    const match = matcher(path);
    if (match === undefined) {
      if (matcher(previousPath) !== undefined) {
        s.complete();
      }
      return undefined;
    } else if (matcher(previousPath) === undefined) {
      s = new BehaviorSubject(match);
      if (!isWidget(widget)) {
        widget = await (widget as WidgetFactory<InWidgetProps<T>>)();
      }
      return (widget as Widget<InWidgetProps<T>>)(context, { page$: s });
    } else {
      s.next(match);
      return noChange as TemplateResult;
    }
  };
}

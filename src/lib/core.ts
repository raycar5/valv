import { TemplateResult, NodePart, directive } from 'lit-html';
import { NextObserver, Observable, of } from 'rxjs';
import { Mapper, Future } from './utils';
import { map } from 'rxjs/operators';

export interface ValvContext {
  blocs: BlocRepo;
}

export class Context implements ValvContext {
  public readonly blocs = new BlocRepo();
}

export type Widget<T> = (context: ValvContext, props?: T) => TemplateResult;
// Widget is just syntactic sugar so you get types automatically
export function Widget<T>(widget: Widget<T>) {
  return widget;
}

export function eventToObserver<T, E>(
  subject: NextObserver<E | T>,
  mapper?: Mapper<T, E>
): (e: T) => void {
  if (mapper) {
    return (e: T) => {
      subject.next(mapper(e));
    };
  }
  return (e: T) => {
    subject.next(e);
  };
}

export const awaito = directive(
  <T>(value: Observable<T>, mapper?: Mapper<T, any>) => async (part: NodePart) => {
    // If we've already set up this particular observable, we don't need
    // to do anything.

    /* istanbul ignore next */
    if (value === part.value) {
      return;
    }

    // We nest a new part to keep track of previous item values separately
    // of the iterable as a value itself.
    const itemPart = new NodePart(part.options);
    part.value = value;

    let next = new Future<T>();
    let done = false;
    const subscription = value.subscribe(
      v => {
        next.resolve(v);
      },
      e => {
        next.reject(e);
      },
      () => {
        done = true;
      }
    );
    try {
      part.clear();
      itemPart.appendIntoPart(part);
      let i = 0;
      while (!done) {
        let v = await next.promise;
        //if (part.value != value) break;
        next = new Future<T>();
        if (mapper !== undefined) {
          v = mapper(v, i);
        }
        itemPart.setValue(v);
        itemPart.commit();
        i++;
      }
    } catch (e) {
      console.error(e);
    } finally {
      subscription.unsubscribe();
    }
  }
);
//If no observable is provided, the observer will be called once on element creation
export const interact = directive(
  <ElementType extends Element, T, E>(
    value: T,
    observer: NextObserver<{
      element: ElementType;
      index: number;
      value?: E;
    }>,
    observable?: Observable<E>
  ) => async (part: NodePart) => {
    const itemPart = new NodePart(part.options);
    part.value = value;
    part.clear();
    itemPart.appendIntoPart(part);
    itemPart.setValue(value);
    itemPart.commit();

    const rawelement = ((itemPart.startNode as unknown) as NonDocumentTypeChildNode)
      .nextElementSibling;

    if (!rawelement) {
      console.error(
        "Don't pass raw text to interact, wrap it in an html element: interact(html`<span>text</span>)`"
      );
      return;
    }

    const element = rawelement as ElementType; // We assume the user doesn't lie to us about the type of the element
    if (!observable) {
      observer.next({ element, index: 0 });
      if (observer.complete) observer.complete();
      return;
    }
    observable.pipe(map((value, index) => ({ element, index, value }))).subscribe(observer);
  }
);

export type IClassConstructor<T> = new (...params: any[]) => T;

export class BlocRepo {
  private readonly classes = new WeakMap<IClassConstructor<any>, any>();
  public of<T>(blocClass: IClassConstructor<T>): T {
    const ret = this.classes.get(blocClass);
    if (!ret) {
      throw new Error('Class was not registered in the bloc repo');
    }
    return ret;
  }
  public register<T extends I, I>(blocClass: IClassConstructor<T>, bloc?: I) {
    if (!bloc) {
      bloc = new blocClass();
    }
    this.classes.set(blocClass, bloc);
  }
}

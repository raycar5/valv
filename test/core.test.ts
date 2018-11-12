import { eventToObserver, BlocRepo, Widget, awaito, interact } from '../src/lib/core';
import { html, render } from 'lit-html';
import { Subject, BehaviorSubject } from 'rxjs';
import { sleep } from '../src/lib/utils';

describe('eventToObserver', () => {
  it('passes events through', () => {
    const event = 'foobar';
    const cb = jest.fn();
    const handler = eventToObserver<string, string>({ next: cb });
    expect(cb).not.toHaveBeenCalled();
    handler(event);
    expect(cb).toHaveBeenCalledWith(event);
  });
  it('maps events', () => {
    const cb = jest.fn();
    const handler = eventToObserver<number, string>({ next: cb }, n => `${n + 1}`);

    expect(cb).not.toHaveBeenCalled();

    handler(2);
    expect(cb).toHaveBeenCalledWith('3');
  });
});

describe('asynco', () => {
  it("updates it's content when a new value arrives", async () => {
    const text1 = 'foo';
    const text2 = 'bar';
    const subject = new BehaviorSubject<string>(text1);
    const body = document.querySelector('body') as Element;
    render(
      html`
        ${awaito(subject)}
      `,
      body
    );
    await sleep(0);
    expect(body.textContent).toContain(text1);
    subject.next(text2);
    await sleep(0);
    expect(body.textContent).not.toContain(text1);
    expect(body.textContent).toContain(text2);
  });
  it('logs when an error is produced in the observable', async () => {
    const errorSpy = jest.fn();
    const error = "I'm an error :D";
    const oldError = console.error;
    console.error = errorSpy;
    const s = new Subject();
    render(
      html`
        ${awaito(s)}
      `,
      document.querySelector('body') as Element
    );
    s.error(error);
    await sleep(0);
    expect(errorSpy).toHaveBeenCalledWith(error);
    console.error = oldError;
  });
});

describe('interact', () => {
  it('calls the observer once if no observable is provided', done => {
    const text = 'foo';
    render(
      html`
        ${
          interact(
            html`
              <span>${text}</span>
            `,
            {
              next(e) {
                expect(e.element.innerHTML).toContain('foo');
                done();
              }
            }
          )
        }
      `,
      document.querySelector('body') as Element
    );
  });
  it('calls the complete function if no observable is provided', done => {
    render(
      html`
        ${
          interact(
            html`
              <span></span>
            `,
            {
              next(e) {},
              complete() {
                expect(true).toBeTruthy();
                done();
              }
            }
          )
        }
      `,
      document.querySelector('body') as Element
    );
  });
  it('calls the observer whenever new values come through the observable', async () => {
    const observerSpy = jest.fn();
    const subject = new Subject<string>();
    render(
      html`
        ${
          interact(
            html`
              <span></span>
            `,
            {
              next({ element, value, index }) {
                expect(element).toBeInstanceOf(Element);
                observerSpy(value, index);
              }
            },
            subject
          )
        }
      `,
      document.querySelector('body') as Element
    );

    const text1 = 'foo';
    const text2 = 'bar';
    subject.next(text1);
    subject.next(text2);

    await sleep(0);

    expect(observerSpy.mock.calls).toEqual([[text1, 0], [text2, 1]]);
  });
  it('yells if you pass in raw text', async () => {
    const errorSpy = jest.fn();
    const oldError = console.error;
    console.error = errorSpy;

    render(
      html`
        ${
          interact(
            html`
              Some raw text
            `,
            {
              next(e) {}
            }
          )
        }
      `,
      document.querySelector('body') as Element
    );
    await sleep(0);
    expect(errorSpy).toHaveBeenCalled();
    console.error = oldError;
  });
});

describe('Widget', () => {
  it('is a noop', () => {
    function widget(blocs: BlocRepo, props?: number) {
      return html`
        ${props}
      `;
    }
    expect(Widget(widget)).toBe(widget);
  });
});

describe('BlocRepo', () => {
  it('constructs an object one is not provided', () => {
    const blocs = new BlocRepo();
    blocs.register(Date);

    expect(blocs.of(Date)).toBeInstanceOf(Date);
  });
  it('stores only one instance from a class', () => {
    const blocs = new BlocRepo();
    class TestClass {
      constructor(public n: number) {}
    }
    blocs.register(TestClass, new TestClass(1));
    expect(blocs.of(TestClass).n).toBe(1);

    blocs.register(TestClass, new TestClass(2));
    expect(blocs.of(TestClass).n).toBe(2);
  });
  it('throws if you try to get an instance of a non registered class', () => {
    const blocs = new BlocRepo();
    expect(() => blocs.of(BlocRepo)).toThrow();
  });
});

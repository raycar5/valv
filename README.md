# | Valv |

A tiny but powerful web framework built on top of [lit-html](https://github.com/Polymer/lit-html) and [rxjs](https://github.com/ReactiveX/rxjs)

## Features

- Easy ui design and composition thanks to lit-html
- Powerful state management thanks to rxjs
- Fast! (no traversing trees to see what changed)
- SPA router in the box
- 100% Web component compatible
- Nice api for web animations
- Tiny (10KB gzipped)

## Guide

Valv is all about controlling the flow of streams, whenever an event happens, it gets put into an observable and the job of the application is to build a pipeline with rxjs that turns that event into a UI update.

**It is an absolute requirement that you understand rxjs in order to use this framework, so please read the documentation at [ReactiveX](http://reactivex.io/intro.html) if you haven't done so.**

Valv has 2 main parts, Widgets and Blocs:

### Widgets

A widget is a function that takes context, some props and returns a lit-html TemplateResult, it is wrapped in the `Widget` function for convinience.

```typescript
interface MyWidgetProps {
  text: string;
}
const MyWidgetDefaultProps = { text: 'HelloWorld' };
const MyWidget = Widget((context, { text }: MyWidgetProps = MyWidgetDefaultProps) => 
  html`
    <div>${text}</div>
  `;
);
```

Rendering a widget is easy!

```typescript
render(MyWidget(context), document.getElementById('body'));
```

Widgets are composable.

```typescript
// Props can have any type you want
const BoldWidget = Widget(
  (context, widget: Widget) =>
    html`
      <b>${widget(context)}</b>
    `
);
```

### Blocs

A Bloc is any class that uses observers as input and observables as output, the framework does not enforce this, you can put any class you like into a BlocRepo but hopefully after this guide you'll see it's a good way to structure your code.

```typescript
class MyBloc {
  public readonly input: Observer<any>; // We don't care about input values, just that the event happened
  public readonly output: Observable<number>;

  // All the pipes are plugged together in the constructor
  constructor() {
    const subject = new Subject<number>();
    const input = subject; // We only expose the Observer side of the subject
    const output = subject.pipe(map((x, index) => index)); // Number will increase as events come through the input
  }
}
```

Widgets access blocs through the bloc repository or BlocRepo.
The code below displays a button and a number that increases every time you press the button.

```typescript
const context = new Context(); // Context right now only contains the BlocRepo but might include more information in the future
context.blocs.register(MyBloc);
context.blocs.register(MyParameterizedBloc, new MyParameterizedBloc(32)); // You can also provide an instance

const MyWidget = Widget(context => {
  const myBloc = context.blocs.of(MyBloc);
  return html`
    <button @click="${eventToObserver(Mybloc.input)}"></button> ${awaito(myBloc.output)}
  `;
});
```

## awaito

But wait what is that function `awaito`?

It stands for await observable and it's the main tool that Valv provides, it takes an observable of anything that can be rendered in lit-html (text,numbers,TemplateResults) and whenever the observable emits a new value, the previous dom gets replaced with the new one.

It also provides a convinient map function as a second parameter if you want to construct the UI at the call site.

```typescript
asynco(
  numberObservable,
  number =>
    html`
      <i><b>${number}</b></i>
    `
);
```

## Todo

- Documentation
- Attribute and Property awaito directives
- SSR
- PWA facilities

### Made with [typescript-library-starter](https://github.com/alexjoverm/typescript-library-starter)

 

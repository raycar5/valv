import { Widget, awaito } from './core';
import { html } from 'lit-html';
import { defer } from 'rxjs';

export function widgetRenderedSpy(callback: () => void) {
  return Widget(blocs => {
    return html`
      ${awaito(defer(callback))}
    `;
  });
}

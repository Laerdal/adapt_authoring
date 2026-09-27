import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InfoIcon } from './InfoIcon';

describe('InfoIcon', () => {
  it('creates a tab stop when a hint is present', () => {
    const markup = renderToStaticMarkup(
      React.createElement(InfoIcon, {
        label: 'Theme section',
        hint: 'Helpful guidance',
      })
    );

    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('aria-label="More information about Theme section"');
  });
});

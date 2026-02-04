/**
 * axe options for jsdom (e.g. disable color-contrast which requires canvas)
 */
export const axeJsdomOptions = {
  rules: { "color-contrast": { enabled: false } },
} as const;

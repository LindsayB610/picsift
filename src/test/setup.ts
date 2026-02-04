/**
 * Vitest test setup
 * - Extends expect with vitest-axe (toHaveNoViolations); @testing-library/jest-dom uses global expect
 * - Ensures document has lang for accessibility tests
 */

import "vitest-axe/extend-expect";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);
// @testing-library/jest-dom extends global expect when imported (requires globals: true)
import "@testing-library/jest-dom/vitest";

// Ensure document has lang for axe and screen readers (jsdom default may not set it)
beforeEach(() => {
  document.documentElement.lang = "en";
});

# TypeScript Standards Alignment Plan

This document outlines the plan to bring the PicSift codebase in line with production TypeScript standards.

## Current State Assessment

### TSConfig Files

**Current Structure:**
- `tsconfig.json` - Root with project references
- `tsconfig.app.json` - App code configuration
- `tsconfig.node.json` - Node tooling configuration
- `tsconfig.functions.json` - Netlify functions configuration

**Missing:**
- `tsconfig.base.json` - Shared base configuration
- `tsconfig.eslint.json` - ESLint type-checking configuration

**Current Issues:**
1. No shared base config - settings duplicated across files
2. Missing critical compiler options:
   - `noUncheckedIndexedAccess` - Not enabled
   - `exactOptionalPropertyTypes` - Not enabled
   - `useUnknownInCatchVariables` - Not enabled
   - `verbatimModuleSyntax` - Not enabled
   - `moduleDetection` - Not set to "force"
   - `noUncheckedSideEffectImports` - Not enabled
3. `moduleResolution: "Bundler"` used - acceptable but needs documentation
4. No ESLint-specific tsconfig for type-checking

### ESLint Configuration

**Current State:**
- Uses `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`
- Has `consistent-type-imports` rule enabled ✅
- Uses `project` option (not `projectService`)
- Missing typed linting rules:
  - `no-floating-promises` - Not enabled
  - `no-misused-promises` - Not enabled
  - `switch-exhaustiveness-check` - Not enabled
- Not using `recommendedTypeChecked` config

**Issues:**
1. Not using `projectService: true` (better performance)
2. Missing critical type-checked rules
3. Test files have `no-explicit-any` disabled (acceptable for tests)

### Code Patterns Assessment

**Areas Needing Attention:**

1. **`any` Usage:**
   - Found in test files (acceptable)
   - Need to audit app code for any `any` usage

2. **Catch Blocks:**
   - Some catch blocks may not be handling `unknown` properly
   - Need to audit all catch blocks

3. **Index Access:**
   - With `noUncheckedIndexedAccess`, many index accesses will need undefined checks
   - This is expected and will catch real bugs

4. **Import Types:**
   - Some imports may need `import type` conversion
   - ESLint rule `consistent-type-imports` will help catch these

5. **Floating Promises:**
   - Need to audit for unhandled promises
   - ESLint rule will catch these

6. **Discriminated Unions:**
   - Some state management could benefit from discriminated unions
   - Current state uses optional properties which is less type-safe

## Implementation Plan

### Phase 1: TSConfig Restructuring (High Priority)

**Goal:** Create proper TSConfig structure with all required compiler options.

**Tasks:**
1. ✅ Create `tsconfig.base.json` with all required compiler options
2. ✅ Update `tsconfig.app.json` to extend base and add app-specific settings
3. ✅ Update `tsconfig.node.json` to extend base
4. ✅ Update `tsconfig.functions.json` to extend base (if possible, or document why not)
5. ✅ Create `tsconfig.eslint.json` for ESLint type-checking
6. ✅ Update root `tsconfig.json` if needed

**Expected Impact:**
- Type checking will become stricter
- Many existing code patterns will need fixes
- This is intentional - we want to catch bugs

**Breaking Changes:**
- `noUncheckedIndexedAccess` will require undefined checks for all index access
- `exactOptionalPropertyTypes` will prevent `prop = undefined` patterns
- `verbatimModuleSyntax` will require `import type` for type-only imports

### Phase 2: ESLint Configuration (High Priority)

**Goal:** Enable typed linting with all required rules.

**Tasks:**
1. ✅ Update ESLint config to use `projectService: true`
2. ✅ Add `recommendedTypeChecked` config
3. ✅ Enable `@typescript-eslint/no-floating-promises`
4. ✅ Enable `@typescript-eslint/no-misused-promises`
5. ✅ Enable `@typescript-eslint/switch-exhaustiveness-check`
6. ✅ Update `tsconfig.eslint.json` to include all files ESLint touches

**Expected Impact:**
- ESLint will catch more type-related bugs
- Initial lint run will show many violations
- These need to be fixed incrementally

### Phase 3: Code Fixes - Critical Patterns (High Priority)

**Goal:** Fix code patterns that violate the new standards.

**Tasks:**
1. **Index Access Fixes:**
   - Audit all index access patterns (`obj[key]`, `array[i]`)
   - Add undefined checks where needed
   - Document any cases where we're certain undefined can't occur

2. **Catch Block Fixes:**
   - Convert all catch blocks to use `unknown`
   - Add proper error normalization
   - Create consistent error handling utilities

3. **Import Type Fixes:**
   - Run ESLint auto-fix for `consistent-type-imports`
   - Manually review and fix any remaining issues

4. **Floating Promise Fixes:**
   - Find all unhandled promises
   - Add `await`, `return`, `.catch`, or `void` as appropriate
   - Document intentional fire-and-forget cases

**Expected Impact:**
- Many files will need changes
- This is the bulk of the migration work
- Should be done incrementally by module/component

### Phase 4: Type Safety Improvements (Medium Priority)

**Goal:** Improve type safety in domain logic.

**Tasks:**
1. **Boundary Validation:**
   - Audit all external inputs (fetch, localStorage, user input)
   - Add validation/narrowing at boundaries
   - Use `unknown` for all untrusted input

2. **Discriminated Unions:**
   - Identify state machines that could use discriminated unions
   - Refactor loading/error states to use discriminated unions
   - Add exhaustive switch checks

3. **Satisfies Usage:**
   - Find config objects, route maps, event handler maps
   - Convert to use `satisfies` where appropriate

4. **Remove `any` Usage:**
   - Audit app code for `any` usage
   - Replace with proper types or `unknown` + validation

**Expected Impact:**
- Better type safety throughout the codebase
- Fewer runtime bugs
- More maintainable code

### Phase 5: Testing & Validation (Medium Priority)

**Goal:** Ensure all tests pass and type checking works.

**Tasks:**
1. ✅ Run `npm run typecheck` and fix all errors
2. ✅ Run `npm run lint` and fix all errors
3. ✅ Run `npm run test` and fix any test failures
4. ✅ Run `npm run test:e2e` and fix any e2e failures
5. ✅ Update test utilities if needed for new type requirements

**Expected Impact:**
- All type checks pass
- All linting passes
- All tests pass

### Phase 6: Documentation & Training (Low Priority)

**Goal:** Document the standards and ensure team understanding.

**Tasks:**
1. ✅ Update `agents.md` with TypeScript standards (already done)
2. ✅ Create this alignment plan document (already done)
3. ✅ Document any project-specific patterns or exceptions
4. ✅ Add inline comments for complex type patterns

## Migration Strategy

### Incremental Approach

**Recommended:** Enable standards incrementally to avoid massive breaking changes.

**Option 1: Big Bang (Not Recommended)**
- Enable all options at once
- Fix all issues in one PR
- High risk, hard to review

**Option 2: Incremental by Option (Recommended)**
1. Enable `verbatimModuleSyntax` first (easiest, mostly auto-fixable)
2. Enable `useUnknownInCatchVariables` (small impact, clear fixes)
3. Enable `exactOptionalPropertyTypes` (medium impact)
4. Enable `noUncheckedIndexedAccess` (large impact, but catches most bugs)
5. Enable ESLint typed rules one at a time

**Option 3: Incremental by Module (Alternative)**
- Enable all options
- Fix one module/component at a time
- Use `// @ts-expect-error` temporarily with TODO comments
- Remove suppressions as modules are fixed

### Recommended: Hybrid Approach

1. **Phase 1-2:** Enable all TSConfig and ESLint options
2. **Phase 3:** Fix critical patterns (index access, catch blocks, imports) across entire codebase
3. **Phase 4:** Improve type safety incrementally by module
4. **Phase 5:** Final validation

## Risk Assessment

### High Risk Areas

1. **Index Access (`noUncheckedIndexedAccess`):**
   - **Risk:** Many index accesses will need fixes
   - **Mitigation:** Fix incrementally, add tests for undefined cases
   - **Benefit:** Catches real "cannot read property X of undefined" bugs

2. **Optional Properties (`exactOptionalPropertyTypes`):**
   - **Risk:** Patterns like `obj.prop = undefined` will break
   - **Mitigation:** Use `delete obj.prop` or refactor to `prop: T | undefined`
   - **Benefit:** Prevents "optional but explicitly undefined" confusion

3. **Import Types (`verbatimModuleSyntax`):**
   - **Risk:** Some imports may need `import type`
   - **Mitigation:** ESLint auto-fix can handle most cases
   - **Benefit:** Prevents accidental runtime imports of types

### Medium Risk Areas

1. **Floating Promises:**
   - **Risk:** Many promises may need handling
   - **Mitigation:** Add `void` for intentional fire-and-forget, `await` for others
   - **Benefit:** Prevents ignored rejections and out-of-order async behavior

2. **Catch Variables:**
   - **Risk:** All catch blocks need `unknown` handling
   - **Mitigation:** Create error normalization utilities
   - **Benefit:** Forces proper error handling

## Success Criteria

1. ✅ All TSConfig files extend `tsconfig.base.json`
2. ✅ All required compiler options enabled
3. ✅ ESLint typed linting enabled with all required rules
4. ✅ `npm run typecheck` passes with zero errors
5. ✅ `npm run lint` passes with zero errors
6. ✅ All tests pass
7. ✅ No `any` usage in app code (except documented exceptions)
8. ✅ All catch blocks use `unknown`
9. ✅ All index access handles `undefined`
10. ✅ All type-only imports use `import type`

## Timeline Estimate

- **Phase 1 (TSConfig):** 1-2 days
- **Phase 2 (ESLint):** 1 day
- **Phase 3 (Critical Fixes):** 3-5 days (depending on codebase size)
- **Phase 4 (Type Improvements):** 2-3 days
- **Phase 5 (Testing):** 1-2 days
- **Phase 6 (Documentation):** 1 day

**Total:** ~10-15 days of focused work, or 2-3 weeks with other work

## Next Steps

1. Review this plan
2. Create `tsconfig.base.json` with all required options
3. Update existing TSConfig files to extend base
4. Update ESLint configuration
5. Run typecheck and lint to see initial error count
6. Prioritize fixes based on impact
7. Fix incrementally, testing as we go

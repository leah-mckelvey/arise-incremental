# Testing and CI/CD Setup

This document describes the testing infrastructure and CI/CD setup for the Arise Incremental project.

## Testing Infrastructure

### Test Framework
- **Vitest** - Fast unit test framework with Vite integration
- **@testing-library/react** - React component testing utilities
- **happy-dom** - Lightweight DOM implementation for tests

### Test Scripts
```bash
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:ui       # Run tests with UI
```

### Test Files
- `src/store/gameStore.test.ts` - Unit tests for the game store (20 tests)
- `src/components/GatheringActions.test.tsx` - Component tests for gathering actions (5 tests)

### Test Coverage
All tests currently passing (25/25):
- ✅ Store initialization
- ✅ Resource management (addResource)
- ✅ Building purchases
- ✅ Game tick/production
- ✅ State reset
- ✅ LocalStorage persistence
- ✅ Component rendering
- ✅ Button click handlers

## Code Quality Checks

### TypeScript
```bash
npm run typecheck     # Run TypeScript compiler without emitting files
```

### Linting
```bash
npm run lint          # Run ESLint on all source files
```

### Full Validation
```bash
npm run validate      # Run typecheck + lint + tests
```

## Pre-commit Hooks

### Setup
Pre-commit hooks are managed by **Husky** and automatically installed when you run `npm install`.

### Pre-commit Hook
Located at `.husky/pre-commit`, runs before each commit:
1. TypeScript type checking
2. ESLint linting
3. Unit tests

### Pre-push Hook
Located at `.husky/pre-push`, runs before each push:
- Full validation suite (typecheck + lint + tests)

## GitHub Actions CI/CD

### Workflow File
`.github/workflows/ci.yml`

### Triggers
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

### Jobs

#### Test & Lint Job
Runs on multiple Node.js versions (20.x, 22.x):
1. Checkout code
2. Setup Node.js
3. Install dependencies
4. Type check
5. Lint
6. Run tests
7. Build

#### Merge Readiness Check
Runs only on pull requests:
1. Full validation
2. Build verification

### Note on ts-query Dependencies
The CI workflow includes a placeholder for linking ts-query packages. You may need to:
- Publish ts-query packages to npm, or
- Use a private npm registry, or
- Adjust the CI workflow to clone and link the ts-query monorepo

## Configuration Files

### vitest.config.ts
- Configures Vitest with happy-dom environment
- Sets up test coverage reporting
- Configures path aliases for ts-query packages
- Forces single React instance to avoid hook errors

### tsconfig.app.json
- Includes path mappings for ts-query packages
- Enables strict type checking
- Configured for Vite bundler mode

## Known Issues and Solutions

### Issue: Multiple React Instances
**Problem**: ts-query packages have their own node_modules with React, causing "Invalid hook call" errors.

**Solution**: Added path aliases in both `vite.config.ts` and `vitest.config.ts` to force all packages to use the same React instance:
```typescript
alias: {
  'react': path.resolve(__dirname, './node_modules/react'),
  'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
}
```

### Issue: Functions Not Working in Components
**Problem**: Using `useStore(gameStore, (state) => state.addResource)` returned undefined functions.

**Solution**: Get functions directly from the store instead of through useStore:
```typescript
const addResource = gameStore.getState().addResource;
```

## Best Practices

1. **Always run tests before committing** - Pre-commit hooks enforce this
2. **Write tests for new features** - Maintain test coverage
3. **Run full validation before pushing** - Pre-push hooks enforce this
4. **Keep tests fast** - Current test suite runs in <500ms
5. **Test both unit and integration** - Store tests + component tests

## Future Improvements

- [ ] Add test coverage reporting to CI
- [ ] Add visual regression testing
- [ ] Add E2E tests with Playwright
- [ ] Publish ts-query packages to npm for easier CI
- [ ] Add performance benchmarks


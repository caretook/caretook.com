// @ts-check
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/node_modules/",
    "**/build/",
    "**/coverage/",
    "**/.react-router/",
    "**/db/migrations/",
    ".postgres/",
    ".loops/",
    ".claude/worktrees/",
  ]),

  js.configs.recommended,

  // Type-aware rules: they catch floating promises and unsafe `any`, which
  // matter here because errors are returned values, not exceptions.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ["vitest.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      // React Router's templates write `meta({}: Route.MetaArgs)`.
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    // jsx-a11y 6.10 declares ESLint ≤9 as its peer; it runs on 10 (checked by `pnpm lint`).
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      // React Router's idiom: `throw redirect(...)` (a Response) from loaders and actions.
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allow: [
            { from: "lib", name: "Response" },
            { from: "package", package: "react-router", name: "DataWithResponseInit" },
          ],
        },
      ],
    },
  },

  // Plain JS config files aren't in any tsconfig.
  { files: ["**/*.{js,mjs,cjs}"], extends: [tseslint.configs.disableTypeChecked] },

  // Browser-check specs hand functions to the page (page.evaluate): Node's and the browser's globals.
  {
    files: ["scripts/browser-checks/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Last: turns off every rule that would fight Prettier's formatting.
  prettier,
);

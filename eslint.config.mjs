import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals.map((config) => {
    if (config.settings?.react) {
      return {
        ...config,
        settings: {
          ...config.settings,
          react: { version: "19" },
        },
      };
    }
    return config;
  }),
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // React Compiler ESLint rules — downgraded to warnings (not yet enforced)
    // These rules enforce React Compiler (Forget) compatibility patterns.
    // Tracked as warnings until the codebase is ready for full React Compiler adoption.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // Variables and parameters prefixed with _ are intentionally unused.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;

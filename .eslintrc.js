module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "globals": {
    "Atomics": "readonly",
    "SharedArrayBuffer": "readonly"
  },
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "prettier",
    "unused-imports",
    "simple-import-sort"
  ],
  "rules": {
    "linebreak-style": ["error", "unix"],
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ],
    "simple-import-sort/imports": [
      "error",
      {
        "groups": [
          // Node.js builtins
          [`^(${require("module").builtinModules.join("|")})(/|$)`],
          // Packages
          ["^@?\\w"],
          // Side effect imports
          ["^\\u0000"],
          // Parent imports. Put `..` last
          ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
          // Other relative imports. Put same-folder imports and `.` last
          ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"]
        ]
      }
    ],
    "simple-import-sort/exports": "error"
  }
}

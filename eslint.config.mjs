// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-require-imports": "off",
      "import/no-named-as-default-member": "off",
    },
  },
  {
    files: ["scripts/lr-homepage-sections/assets/*.js"],
    languageOptions: {
      globals: {
        jQuery: "readonly",
      },
    },
  },
]);

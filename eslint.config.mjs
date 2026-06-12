import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // 安全相关规则
  {
    rules: {
      // 禁止 eval()，防止代码注入
      "no-eval": "error",
      // 禁止隐式 eval（如 setTimeout("string")、new Function("string")）
      "no-implied-eval": "error",
      // 禁止 new Function()，防止动态代码执行
      "no-new-func": "error",
      // 禁止 javascript: URL
      "no-script-url": "error",
    },
  },
]);

export default eslintConfig;

import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
export default defineConfig([{
    // Build output, test artifacts and generated files
    ignores: [".next/**", ".next-*/**", "test-results/**", "playwright-report/**", ".local-demo/**", "drizzle/**", "next-env.d.ts"],
}, {
    extends: [...nextCoreWebVitals, ...nextTypescript],

    rules: {
        // Derive during render, reset with a key or in the handler instead; an effect that syncs an
        // outside system says so with a disable comment (see use-push.ts)
        "react-hooks/set-state-in-effect": "error",
        "no-restricted-syntax": ["error", {
            selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
            message: "HTML from strings runs injected script. Use React or textContent; if unavoidable, escape every value and disable this rule on that line.",
        }, {
            selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
            message: "HTML from strings runs injected script. Use React or textContent.",
        }, {
            selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
            message: "HTML from strings runs injected script. Use React children instead.",
        }],
    },
}]);
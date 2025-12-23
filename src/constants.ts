import * as vscode from "vscode";

// Shared constants for CSS Controls

// Regex for CSS numbers (e.g., 12px, 1.5rem, 50%)
export const CSS_NUMBER_REGEX = /-?\d*\.?\d+(px|rem|em|vh|vw|%|ch|fr)?/g;

// Regex for Tailwind utility classes with numbers (e.g., w-12, h-64, p-4, gap-4, rounded-tl-3.9xl)
// Matches: prefix-number-suffix (e.g., rounded-tl-3.9xl)
// Captures: [1] prefix, [2] number, [3] optional suffix (like "xl")
export const TAILWIND_NUMBER_REGEX = /\b([a-z]+(?:-[a-z]+)*)-(\d+\.?\d*)([a-z]*)/g;

// Map of CSS properties to their valid values (ordered logically)
export const PROPERTY_VALUES: Record<string, string[]> = {
  "justify-content": [
    "flex-start",
    "flex-end",
    "center",
    "space-between",
    "space-around",
    "space-evenly",
    "stretch",
  ],
  "align-items": ["flex-start", "flex-end", "center", "baseline", "stretch"],
  "align-self": ["auto", "flex-start", "flex-end", "center", "baseline", "stretch"],
};

export const CONTEXT_KEY_NUMBER = "css-controls.hasActiveNumber";
export const CONTEXT_KEY_PROPERTY = "css-controls.hasActivePropertyValue";

// CodeLens selector for CSS-like languages and HTML/JSX with Tailwind
export const SELECTOR: vscode.DocumentSelector = [
  { language: "css", scheme: "file" },
  { language: "scss", scheme: "file" },
  { language: "less", scheme: "file" },
  { language: "html", scheme: "file" },
  { language: "javascriptreact", scheme: "file" },
  { language: "typescriptreact", scheme: "file" },
];

// Language helpers
export const isCssLikeLanguage = (languageId: string): boolean =>
  languageId === "css" || languageId === "scss" || languageId === "less";

export const isHtmlOrJsxLanguage = (languageId: string): boolean =>
  languageId === "html" || languageId === "javascriptreact" || languageId === "typescriptreact";

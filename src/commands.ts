import * as vscode from "vscode";
import { PROPERTY_VALUES, isCssLikeLanguage, isHtmlOrJsxLanguage } from "./constants";
import { findClosestPropertyValueRangeOnLine, getNumberRangesOnLine } from "./detection";
import { CssControlsState } from "./state";

type Step = "tenth" | "one" | "ten";

/**
 * Create a command that toggles the extension's enabled state.
 *
 * @param state - The CssControlsState instance used to read and update the enabled flag.
 * @returns A command function that toggles the enabled state and displays a short status bar message.
 */
export function createToggleEnabledCommand(state: CssControlsState): () => void {
  return () => {
    const newValue = !state.isEnabled;
    state.setEnabled(newValue);
    const status = newValue ? "enabled" : "disabled";
    vscode.window.setStatusBarMessage(`CSS Controls: ${status}`, 2000);
  };
}

/**
 * Create a command that toggles the visibility of inline CSS control buttons.
 *
 * @param state - The CssControlsState instance used to read and update inline button visibility.
 * @returns A function which, when invoked, toggles the inline buttons setting and shows a short status message.
 */
export function createToggleInlineButtonsCommand(state: CssControlsState): () => void {
  return () => {
    const newValue = !state.enableInlineButtons;
    state.setInlineButtonsEnabled(newValue);
    const status = newValue ? "shown" : "hidden";
    vscode.window.setStatusBarMessage(`CSS Controls: inline buttons ${status}`, 2000);
  };
}

/**
 * Creates a command that moves the editor cursor to the next or previous numeric literal on the current line.
 *
 * This command is a no-op when there is no active editor, the feature is disabled, the document language is not CSS-like or HTML/JSX, or when the current line contains no numbers. When executed it selects the start of the target number, reveals it in the center of the viewport if necessary, and refreshes decorations and context via the provided state.
 *
 * @param direction - "next" to advance to the following number on the line, "previous" to move to the preceding number (wraps around).
 * @returns A command function that moves the cursor to the target numeric literal on the current line and updates decorations/context.
 */
export function createJumpToNumberCommand(
  state: CssControlsState,
  direction: "next" | "previous"
): () => void {
  return () => {
    const activeEditor = state.activeEditor;
    if (!activeEditor || !state.isEnabled) {
      return;
    }

    const document = activeEditor.document;
    const languageId = document.languageId;
    const isCssLike = isCssLikeLanguage(languageId);
    const isHtmlOrJsx = isHtmlOrJsxLanguage(languageId);

    if (!isCssLike && !isHtmlOrJsx) {
      return;
    }

    const cursorPos = activeEditor.selection.active;
    const currentLine = cursorPos.line;
    const currentCol = cursorPos.character;

    // Find all numbers on the current line
    const ranges = getNumberRangesOnLine(document, currentLine);

    if (ranges.length === 0) {
      return;
    }

    // Find current number index (if cursor is inside a number)
    let currentIndex = -1;
    for (let i = 0; i < ranges.length; i++) {
      if (currentCol >= ranges[i].start.character && currentCol <= ranges[i].end.character) {
        currentIndex = i;
        break;
      }
    }

    // If not inside a number, find the closest one
    if (currentIndex === -1) {
      let closestIndex = 0;
      let closestDist = Math.abs(
        (ranges[0].start.character + ranges[0].end.character) / 2 - currentCol
      );
      for (let i = 1; i < ranges.length; i++) {
        const center = (ranges[i].start.character + ranges[i].end.character) / 2;
        const dist = Math.abs(center - currentCol);
        if (dist < closestDist) {
          closestIndex = i;
          closestDist = dist;
        }
      }
      currentIndex = closestIndex;
    }

    // Calculate next/previous index
    let targetIndex: number;
    if (direction === "next") {
      targetIndex = (currentIndex + 1) % ranges.length;
    } else {
      targetIndex = (currentIndex - 1 + ranges.length) % ranges.length;
    }

    // Move cursor to the target number
    const targetRange = ranges[targetIndex];
    activeEditor.selection = new vscode.Selection(targetRange.start, targetRange.start);
    activeEditor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

    // Update decoration/context via state
    state.updateContextAndDecorations();
  };
}

/**
 * Creates a command that cycles the CSS property value at the cursor through its allowed values.
 *
 * @param state - Extension state used to access the active editor, configuration, and to refresh decorations/context
 * @param direction - "forward" to advance to the next value, "backward" to move to the previous value
 * @param currentStep - Function that returns the current step size (provided by caller for consistency with other commands)
 * @returns A command function that locates the nearest property value on the current line, replaces it with the next or previous value from the predefined list (preserving trailing modifiers such as `!important`), repositions the cursor to the new value, recenters the view if necessary, and updates decorations/context.
export function createCyclePropertyValueCommand(
  state: CssControlsState,
  direction: "forward" | "backward",
  currentStep: () => Step
): () => Promise<void> {
  return async () => {
    const activeEditor = state.activeEditor;
    if (!activeEditor || !state.isEnabled) {
      return;
    }

    const document = activeEditor.document;
    const languageId = document.languageId;
    const isCssLike = isCssLikeLanguage(languageId);

    if (!isCssLike) {
      return;
    }

    const cursorPos = activeEditor.selection.active;
    const targetLine = cursorPos.line;
    const referenceColumn = cursorPos.character;

    // For now we reuse the existing detection from state/detection:
    // state.hasActivePropertyValue() is based on findClosestPropertyValueRangeOnLine internally,
    // but we still need the actual range/value here, so we keep this logic local.
    const propertyInfo = findClosestPropertyValueRangeOnLine(document, targetLine, referenceColumn);

    if (!propertyInfo) {
      return;
    }

    const { property, value, range } = propertyInfo;
    const validValues = PROPERTY_VALUES[property];

    if (!validValues || validValues.length === 0) {
      return;
    }

    // Find current value index
    const currentIndex = validValues.findIndex((v) => v.toLowerCase() === value.toLowerCase());

    if (currentIndex === -1) {
      return;
    }

    // Calculate next/previous index (wrapping)
    let newIndex: number;
    if (direction === "forward") {
      newIndex = (currentIndex + 1) % validValues.length;
    } else {
      newIndex = (currentIndex - 1 + validValues.length) % validValues.length;
    }

    const newValue = validValues[newIndex];

    // Replace the value in the document
    // We need to preserve any modifiers like !important
    const lineText = document.lineAt(targetLine).text;
    const valueAfterCurrent = lineText.substring(range.end.character);

    // Check if there's !important or other modifiers after the value
    const importantMatch = valueAfterCurrent.match(/^\s*!\s*important/i);
    const hasImportant = importantMatch !== null;

    // Replace the value, preserving !important if present
    const replacement = hasImportant ? `${newValue} !important` : newValue;

    await activeEditor.edit((editBuilder) => {
      // Replace the entire value range, including any trailing whitespace before !important
      if (hasImportant && importantMatch && importantMatch.index !== undefined) {
        const fullRange = new vscode.Range(
          range.start,
          new vscode.Position(
            targetLine,
            range.end.character + importantMatch.index + importantMatch[0].length
          )
        );
        editBuilder.replace(fullRange, replacement);
      } else {
        editBuilder.replace(range, newValue);
      }
    });

    // Update cursor position and decoration
    const newRange = new vscode.Range(
      range.start,
      new vscode.Position(range.start.line, range.start.character + newValue.length)
    );
    activeEditor.selection = new vscode.Selection(newRange.start, newRange.start);
    activeEditor.revealRange(newRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

    // Update decoration/context via state
    state.updateContextAndDecorations();
  };
}
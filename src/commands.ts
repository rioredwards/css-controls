import * as vscode from "vscode";
import { isCssLikeLanguage, isHtmlOrJsxLanguage } from "./constants";
import { getNumberRangesOnLine } from "./detection";
import { CssControlsState } from "./state";

export function createToggleEnabledCommand(state: CssControlsState): () => void {
  return () => {
    const newValue = !state.isEnabled;
    state.setEnabled(newValue);
    const status = newValue ? "enabled" : "disabled";
    vscode.window.setStatusBarMessage(`CSS Controls: ${status}`, 2000);
  };
}

export function createToggleInlineButtonsCommand(state: CssControlsState): () => void {
  return () => {
    const newValue = !state.enableInlineButtons;
    state.setInlineButtonsEnabled(newValue);
    const status = newValue ? "shown" : "hidden";
    vscode.window.setStatusBarMessage(`CSS Controls: inline buttons ${status}`, 2000);
  };
}

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

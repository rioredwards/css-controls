import * as vscode from "vscode";
import { findClosestPropertyValueRangeOnLine } from "./detection";
import { CssControlsState } from "./state";

/**
 * Create a CodeLens provider that displays inline CSS Controls buttons for the active editor line.
 *
 * @param state - The shared CssControlsState used to determine the active editor/line, enabled flags, and whether a property value or number is active.
 * @param getCurrentStepLabel - Function that returns the current step configuration: `{ label, incCommand, decCommand }` used for numeric controls.
 * @returns A vscode.CodeLensProvider that exposes onDidChangeCodeLenses and provides CodeLenses which include a help button, property-value cycling buttons when the cursor is on a property value, or a step indicator plus decrement/increment buttons when the cursor is on a numeric value.
 */
export function createCodeLensProvider(
  state: CssControlsState,
  getCurrentStepLabel: () => { label: string; incCommand: string; decCommand: string }
): vscode.CodeLensProvider {
  return new (class CssControlsCodeLensProvider implements vscode.CodeLensProvider {
    // Recompute CodeLens when the active line/editor changes
    readonly onDidChangeCodeLenses = state.onDidChangeCodeLenses;

    provideCodeLenses(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
      const lenses: vscode.CodeLens[] = [];

      const activeEditor = state.activeEditor;
      const activeLine = state.activeLine;

      // Only show CodeLens if this is the active editor and conditions are met
      if (!activeEditor || document.uri.toString() !== activeEditor.document.uri.toString()) {
        return lenses;
      }

      if (!state.isEnabled) {
        return lenses;
      }

      if (!state.enableInlineButtons) {
        return lenses;
      }

      if (
        (!state.hasActiveNumber() && !state.hasActivePropertyValue()) ||
        typeof activeLine !== "number"
      ) {
        return lenses;
      }

      const range = new vscode.Range(activeLine, 0, activeLine, 0);

      // Check if we're on a property value or a number
      const cursorPos = activeEditor.selection.active;
      const propertyInfo = findClosestPropertyValueRangeOnLine(
        document,
        activeLine,
        cursorPos.character
      );
      const hasProperty = propertyInfo !== null;
      const hasNumber = state.hasActiveNumber();

      // Always show help button
      lenses.push(
        new vscode.CodeLens(range, {
          title: "?",
          command: "css-controls.openDocs",
          tooltip: "Open CSS Controls docs and settings (css-controls)",
        })
      );

      if (hasProperty) {
        // Show property cycling buttons
        lenses.push(
          new vscode.CodeLens(range, {
            title: `◀`,
            command: "css-controls.cyclePropertyValueBackward",
            tooltip: "Cycle property value backward (css-controls)",
          }),
          new vscode.CodeLens(range, {
            title: `▶`,
            command: "css-controls.cyclePropertyValueForward",
            tooltip: "Cycle property value forward (css-controls)",
          })
        );
      } else if (hasNumber) {
        // Show number controls
        const stepConfig = getCurrentStepLabel();

        lenses.push(
          // Step indicator / cycle control
          new vscode.CodeLens(range, {
            title: `x${stepConfig.label}`,
            command: "css-controls.cycleStep",
            tooltip: "Cycle CSS Controls step (0.1, 1, 10) (css-controls)",
          }),
          // Decrement / increment for the current step
          new vscode.CodeLens(range, {
            title: `▼`,
            command: stepConfig.decCommand,
            arguments: [activeLine],
            tooltip: `Decrement number by ${stepConfig.label} (css-controls)`,
          }),
          new vscode.CodeLens(range, {
            title: `▲`,
            command: stepConfig.incCommand,
            arguments: [activeLine],
            tooltip: `Increment number by ${stepConfig.label} (css-controls)`,
          })
        );
      }

      return lenses;
    }
  })();
}
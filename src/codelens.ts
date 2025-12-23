import * as vscode from "vscode";
import { CssControlsState } from "./state";

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

      const hasNumber = state.hasActiveNumber();
      const hasProperty = state.hasActivePropertyValue();

      // Always show help button
      lenses.push(
        new vscode.CodeLens(range, {
          title: "?",
          command: "css-controls.openDocs",
          tooltip: "Open CSS Controls docs and settings (css-controls)",
        })
      );

      // For numbers, show step indicator + controls; for properties, just show ▲▼
      if (hasNumber && !hasProperty) {
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
            tooltip: `Decrement value by ${stepConfig.label} (css-controls)`,
          }),
          new vscode.CodeLens(range, {
            title: `▲`,
            command: stepConfig.incCommand,
            arguments: [activeLine],
            tooltip: `Increment value by ${stepConfig.label} (css-controls)`,
          })
        );
      } else {
        // Property (or ambiguous) case: just show ▲▼ using the current step commands
        const stepConfig = getCurrentStepLabel();

        lenses.push(
          new vscode.CodeLens(range, {
            title: `▼`,
            command: stepConfig.decCommand,
            arguments: [activeLine],
            tooltip: "Decrement value (css-controls)",
          }),
          new vscode.CodeLens(range, {
            title: `▲`,
            command: stepConfig.incCommand,
            arguments: [activeLine],
            tooltip: "Increment value (css-controls)",
          })
        );
      }

      return lenses;
    }
  })();
}

import * as assert from "assert";
import * as vscode from "vscode";

import {
  createCyclePropertyValueCommand,
  createJumpToNumberCommand,
  createToggleEnabledCommand,
  createToggleInlineButtonsCommand,
} from "../commands";
import { CssControlsState } from "../state";

suite("Commands Test Suite", () => {
  function createMockState(): CssControlsState {
    let isEnabled = true;
    let enableInlineButtons = true;
    let activeEditor: vscode.TextEditor | undefined;

    return {
      get activeEditor() {
        return activeEditor;
      },
      get activeLine() {
        return activeEditor?.selection.active.line;
      },
      get isEnabled() {
        return isEnabled;
      },
      get enableInlineButtons() {
        return enableInlineButtons;
      },
      decorationType: vscode.window.createTextEditorDecorationType({}),
      onDidChangeCodeLenses: new vscode.EventEmitter<void>().event,
      updateFromActiveEditor(editor: vscode.TextEditor | undefined) {
        activeEditor = editor;
      },
      updateFromSelection() {
        // Not needed for these tests
      },
      updateFromDocumentChange() {
        // Not needed for these tests
      },
      updateFromConfigChange() {
        // Not needed for these tests
      },
      updateContextAndDecorations() {
        // No-op for tests
      },
      hasActiveNumber() {
        return true;
      },
      hasActivePropertyValue() {
        return true;
      },
      setEnabled(newValue: boolean) {
        isEnabled = newValue;
      },
      setInlineButtonsEnabled(newValue: boolean) {
        enableInlineButtons = newValue;
      },
      notifyCodeLensChange() {
        // No-op for tests
      },
    };
  }

  test("toggle commands flip state flags", () => {
    const state = createMockState();

    const toggleEnabled = createToggleEnabledCommand(state);
    const toggleInline = createToggleInlineButtonsCommand(state);

    const initialEnabled = state.isEnabled;
    const initialInline = state.enableInlineButtons;

    toggleEnabled();
    assert.strictEqual(state.isEnabled, !initialEnabled);

    toggleInline();
    assert.strictEqual(state.enableInlineButtons, !initialInline);
  });

  test("jumpToNumber is no-op without active editor or when disabled", () => {
    const state = createMockState();
    const jumpNext = createJumpToNumberCommand(state, "next");

    // No active editor: should not throw
    jumpNext();

    // With editor but disabled
    (state as any).setEnabled(false);
    jumpNext();
  });

  test("cyclePropertyValueCommand cycles known property values", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".row { justify-content: flex-start; }",
    });
    const editor = await vscode.window.showTextDocument(doc);

    const state = createMockState();
    state.updateFromActiveEditor(editor);

    const command = createCyclePropertyValueCommand(
      state,
      "forward",
      () => "one" // step does not affect property cycling
    );

    // Place cursor on the value
    editor.selection = new vscode.Selection(0, 30, 0, 30);

    await command();

    const updatedText = doc.getText();
    assert.ok(
      updatedText.includes("justify-content: flex-end"),
      "Expected justify-content to cycle to next value"
    );
  });
});

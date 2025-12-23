import * as assert from "assert";
import * as vscode from "vscode";

import { createCssControlsState } from "../state";

suite("State Test Suite", () => {
  test("createCssControlsState initializes without throwing", () => {
    const state = createCssControlsState("css-controls");
    assert.ok(state, "Expected state to be created");
  });

  test("state tracks active editor and line updates", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".box { margin: 10px 20px; }",
    });
    const editor = await vscode.window.showTextDocument(doc);

    const state = createCssControlsState("css-controls");

    // Initial update from active editor
    state.updateFromActiveEditor(editor);
    assert.strictEqual(state.activeEditor, editor);
    assert.strictEqual(state.activeLine, editor.selection.active.line);

    // Move selection and notify state
    const newSelection = new vscode.Selection(0, 5, 0, 5);
    editor.selection = newSelection;
    state.updateFromSelection([newSelection]);

    assert.strictEqual(state.activeLine, 0);
  });

  test("state setEnabled and setInlineButtonsEnabled do not throw", async () => {
    const state = createCssControlsState("css-controls");

    // Toggling flags should not throw; we don't assert VS Code config in tests
    state.setEnabled(!state.isEnabled);
    state.setInlineButtonsEnabled(!state.enableInlineButtons);
  });
});

import * as assert from "assert";
import * as vscode from "vscode";

import { createCodeLensProvider } from "../codelens";
import { CssControlsState } from "../state";

suite("CodeLens Provider Test Suite", () => {
  function createMockState(options: {
    hasNumber: boolean;
    hasProperty: boolean;
  }): CssControlsState {
    const emitter = new vscode.EventEmitter<void>();
    let activeEditor: vscode.TextEditor | undefined;
    let activeLine: number | undefined;

    return {
      get activeEditor() {
        return activeEditor;
      },
      get activeLine() {
        return activeLine;
      },
      get isEnabled() {
        return true;
      },
      get enableInlineButtons() {
        return true;
      },
      decorationType: vscode.window.createTextEditorDecorationType({}),
      onDidChangeCodeLenses: emitter.event,
      updateFromActiveEditor(editor: vscode.TextEditor | undefined) {
        activeEditor = editor;
        activeLine = editor?.selection.active.line;
      },
      updateFromSelection(selections: readonly vscode.Selection[]) {
        if (selections[0]) {
          activeLine = selections[0].active.line;
        }
      },
      updateFromDocumentChange() {},
      updateFromConfigChange() {},
      updateContextAndDecorations() {},
      hasActiveNumber() {
        return options.hasNumber;
      },
      hasActivePropertyValue() {
        return options.hasProperty;
      },
      setEnabled() {},
      setInlineButtonsEnabled() {},
      notifyCodeLensChange() {
        emitter.fire();
      },
    };
  }

  function createStepLabelStub() {
    return {
      label: "1",
      incCommand: "css-controls.incrementValue",
      decCommand: "css-controls.decrementValue",
    };
  }

  test("returns no lenses when no active editor", async () => {
    const state = createMockState({ hasNumber: true, hasProperty: false });
    const provider = createCodeLensProvider(state, createStepLabelStub);

    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".box { margin: 10px; }",
    });

    const result = provider.provideCodeLenses(doc, {} as vscode.CancellationToken);
    const lenses = (await Promise.resolve(result)) || [];
    assert.strictEqual(lenses.length, 0);
  });

  test("provides property lenses without step when hasActivePropertyValue is true", async () => {
    const state = createMockState({ hasNumber: false, hasProperty: true });
    const provider = createCodeLensProvider(state, createStepLabelStub);

    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".row { justify-content: center; }",
    });
    const editor = await vscode.window.showTextDocument(doc);
    state.updateFromActiveEditor(editor);

    const result = provider.provideCodeLenses(doc, {} as vscode.CancellationToken);
    const lenses = (await Promise.resolve(result)) || [];
    const titles = lenses.map((lens: vscode.CodeLens) => lens.command?.title);

    assert.ok(titles.includes("?"), "Expected help lens");
    assert.ok(titles.includes("▼"), "Expected decrement lens");
    assert.ok(titles.includes("▲"), "Expected increment lens");
    assert.ok(!titles.includes("x1"), "Did not expect step lens for property");
  });

  test("provides number lenses when hasActiveNumber is true", async () => {
    const state = createMockState({ hasNumber: true, hasProperty: false });
    const provider = createCodeLensProvider(state, createStepLabelStub);

    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".box { margin: 10px; }",
    });
    const editor = await vscode.window.showTextDocument(doc);
    state.updateFromActiveEditor(editor);

    const result = provider.provideCodeLenses(doc, {} as vscode.CancellationToken);
    const lenses = (await Promise.resolve(result)) || [];
    const titles = lenses.map((lens: vscode.CodeLens) => lens.command?.title);

    assert.ok(titles.includes("?"), "Expected help lens");
    assert.ok(titles.includes("x1"), "Expected step lens");
    assert.ok(titles.includes("▼"), "Expected decrement lens");
    assert.ok(titles.includes("▲"), "Expected increment lens");
  });
});

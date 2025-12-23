import * as vscode from "vscode";
import { CONTEXT_KEY_NUMBER, CONTEXT_KEY_PROPERTY } from "./constants";
import { findClosestNumberRangeOnLine, findClosestPropertyValueRangeOnLine } from "./detection";

export interface CssControlsState {
  activeEditor: vscode.TextEditor | undefined;
  activeLine: number | undefined;
  isEnabled: boolean;
  enableInlineButtons: boolean;
  readonly decorationType: vscode.TextEditorDecorationType;
  readonly onDidChangeCodeLenses: vscode.Event<void>;

  updateFromActiveEditor(editor: vscode.TextEditor | undefined): void;
  updateFromSelection(selections: readonly vscode.Selection[]): void;
  updateFromDocumentChange(document: vscode.TextDocument): void;
  updateFromConfigChange(e: vscode.ConfigurationChangeEvent): void;

  updateContextAndDecorations(): void;

  hasActiveNumber(): boolean;
  hasActivePropertyValue(): boolean;

  setEnabled(newValue: boolean): void;
  setInlineButtonsEnabled(newValue: boolean): void;

  notifyCodeLensChange(): void;
}

export function createCssControlsState(configSection = "css-controls"): CssControlsState {
  let activeEditor = vscode.window.activeTextEditor;
  let activeLine: number | undefined = activeEditor?.selection.active.line;

  const config = vscode.workspace.getConfiguration(configSection);
  let isEnabled = config.get<boolean>("enabled", true);
  let enableInlineButtons = config.get<boolean>("enableInlineButtons", true);

  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.selectionBackground"),
    borderColor: new vscode.ThemeColor("editor.selectionBackground"),
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: "2px",
  });

  const onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

  const updateContextAndDecorations = () => {
    if (!isEnabled) {
      void vscode.commands.executeCommand("setContext", CONTEXT_KEY_NUMBER, false);
      void vscode.commands.executeCommand("setContext", CONTEXT_KEY_PROPERTY, false);
      if (activeEditor) {
        activeEditor.setDecorations(decorationType, []);
      }
      return;
    }

    const hasNumber = hasActiveNumber();
    const hasProperty = hasActivePropertyValue();
    void vscode.commands.executeCommand("setContext", CONTEXT_KEY_NUMBER, hasNumber);
    void vscode.commands.executeCommand("setContext", CONTEXT_KEY_PROPERTY, hasProperty);

    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const cursorPos = activeEditor.selection.active;
    const cursorLine = cursorPos.line;

    if (cursorLine < 0 || cursorLine >= document.lineCount) {
      activeEditor.setDecorations(decorationType, []);
      return;
    }

    const propertyRange = findClosestPropertyValueRangeOnLine(
      document,
      cursorLine,
      cursorPos.character
    );
    const numberRange = findClosestNumberRangeOnLine(document, cursorLine, cursorPos.character);

    if (propertyRange) {
      activeEditor.setDecorations(decorationType, [propertyRange.range]);
    } else if (numberRange) {
      activeEditor.setDecorations(decorationType, [numberRange]);
    } else {
      activeEditor.setDecorations(decorationType, []);
    }
  };

  const hasActiveNumber = (): boolean => {
    if (!isEnabled || !activeEditor) {
      return false;
    }

    const document = activeEditor.document;

    if (typeof activeLine !== "number") {
      return false;
    }

    if (activeLine < 0 || activeLine >= document.lineCount) {
      return false;
    }

    const cursorPos = activeEditor.selection.active;
    const numberRange = findClosestNumberRangeOnLine(document, activeLine, cursorPos.character);
    return numberRange !== null;
  };

  const hasActivePropertyValue = (): boolean => {
    if (!isEnabled || !activeEditor) {
      return false;
    }

    const document = activeEditor.document;
    const languageId = document.languageId;
    const isCssLike = languageId === "css" || languageId === "scss" || languageId === "less";

    if (!isCssLike) {
      return false;
    }

    if (typeof activeLine !== "number") {
      return false;
    }

    if (activeLine < 0 || activeLine >= document.lineCount) {
      return false;
    }

    const cursorPos = activeEditor.selection.active;
    const propertyRange = findClosestPropertyValueRangeOnLine(
      document,
      activeLine,
      cursorPos.character
    );
    return propertyRange !== null;
  };

  const updateFromActiveEditor = (editor: vscode.TextEditor | undefined) => {
    activeEditor = editor;
    activeLine = editor?.selection.active.line;
    updateContextAndDecorations();
    onDidChangeCodeLensesEmitter.fire();
  };

  const updateFromSelection = (selections: readonly vscode.Selection[]) => {
    if (activeEditor && selections[0]) {
      activeLine = selections[0].active.line;
      updateContextAndDecorations();
      onDidChangeCodeLensesEmitter.fire();
    }
  };

  const updateFromDocumentChange = (document: vscode.TextDocument) => {
    if (activeEditor && document === activeEditor.document) {
      updateContextAndDecorations();
      onDidChangeCodeLensesEmitter.fire();
    }
  };

  const updateFromConfigChange = (event: vscode.ConfigurationChangeEvent) => {
    if (event.affectsConfiguration(`${configSection}.enabled`)) {
      isEnabled = vscode.workspace.getConfiguration(configSection).get<boolean>("enabled", true);
      updateContextAndDecorations();
      onDidChangeCodeLensesEmitter.fire();
    }
    if (event.affectsConfiguration(`${configSection}.enableInlineButtons`)) {
      enableInlineButtons = vscode.workspace
        .getConfiguration(configSection)
        .get<boolean>("enableInlineButtons", true);
      onDidChangeCodeLensesEmitter.fire();
    }
  };

  const setEnabled = (newValue: boolean) => {
    config.update("enabled", newValue, vscode.ConfigurationTarget.Global);
    isEnabled = newValue;
    updateContextAndDecorations();
    onDidChangeCodeLensesEmitter.fire();
  };

  const setInlineButtonsEnabled = (newValue: boolean) => {
    config.update("enableInlineButtons", newValue, vscode.ConfigurationTarget.Global);
    enableInlineButtons = newValue;
    onDidChangeCodeLensesEmitter.fire();
  };

  // Initial context/decorations on activation
  updateContextAndDecorations();

  return {
    get activeEditor() {
      return activeEditor;
    },
    get activeLine() {
      return activeLine;
    },
    get isEnabled() {
      return isEnabled;
    },
    get enableInlineButtons() {
      return enableInlineButtons;
    },
    decorationType,
    onDidChangeCodeLenses: onDidChangeCodeLensesEmitter.event,

    updateFromActiveEditor,
    updateFromSelection,
    updateFromDocumentChange,
    updateFromConfigChange,

    updateContextAndDecorations,

    hasActiveNumber,
    hasActivePropertyValue,

    setEnabled,
    setInlineButtonsEnabled,

    notifyCodeLensChange: () => {
      onDidChangeCodeLensesEmitter.fire();
    },
  };
}

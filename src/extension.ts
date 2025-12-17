import * as vscode from "vscode";

const CSS_NUMBER_REGEX = /-?\d*\.?\d+(px|rem|em|vh|vw|%|ch|fr)?/g;

let arrowDecorationType: vscode.TextEditorDecorationType | undefined;

export function activate(context: vscode.ExtensionContext): void {
  console.log("CSS Controls extension activated");

  arrowDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: " ▲▼",
      margin: "0 0 0 10rem",
      color: new vscode.ThemeColor("editorCodeLens.foreground"),
      borderColor: new vscode.ThemeColor("editorCodeLens.foreground"),
    },
  });

  // Initial decorations
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }

  // React to editor/document changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDecorations(editor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        updateDecorations(activeEditor);
      }
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      updateDecorations(event.textEditor);
    })
  );

  // CodeLens provider for CSS-like languages
  const selector: vscode.DocumentSelector = [
    { language: "css", scheme: "file" },
    { language: "scss", scheme: "file" },
    { language: "less", scheme: "file" },
  ];

  class CssNumberCodeLensProvider implements vscode.CodeLensProvider {
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    provideCodeLenses(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
      const lenses: vscode.CodeLens[] = [];

      for (let line = 0; line < document.lineCount; line += 1) {
        const text = document.lineAt(line).text;
        CSS_NUMBER_REGEX.lastIndex = 0;
        if (!CSS_NUMBER_REGEX.test(text)) {
          continue;
        }

        const range = new vscode.Range(line, 0, line, 0);

        // Separate CodeLens for ▲ (increment) and ▼ (decrement)
        lenses.push(
          new vscode.CodeLens(range, {
            title: "▲",
            command: "css-controls.incrementNumber",
            arguments: [line],
            tooltip: "Increment number",
          }),
          new vscode.CodeLens(range, {
            title: "▼",
            command: "css-controls.decrementNumber",
            arguments: [line],
            tooltip: "Decrement number",
          })
        );
      }

      return lenses;
    }
  }

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(selector, new CssNumberCodeLensProvider())
  );

  // Keep sample Hello World command (optional)
  context.subscriptions.push(
    vscode.commands.registerCommand("css-controls.helloWorld", () => {
      vscode.window.showInformationMessage("Hello World from CSS Controls!");
    })
  );

  // Commands that wrap Emmet increment/decrement
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "css-controls.incrementNumber",
      async (lineFromLens?: number) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const cursorPos = editor.selection.active;

        const targetLine = typeof lineFromLens === "number" ? lineFromLens : cursorPos.line;
        const referenceColumn = cursorPos.line === targetLine ? cursorPos.character : undefined;

        const targetRange = findClosestNumberRangeOnLine(document, targetLine, referenceColumn);

        if (targetRange) {
          editor.selection = new vscode.Selection(targetRange.start, targetRange.start);
          editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }

        await vscode.commands.executeCommand("editor.emmet.action.incrementNumberByOne");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementNumber",
      async (lineFromLens?: number) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const cursorPos = editor.selection.active;

        const targetLine = typeof lineFromLens === "number" ? lineFromLens : cursorPos.line;
        const referenceColumn = cursorPos.line === targetLine ? cursorPos.character : undefined;

        const targetRange = findClosestNumberRangeOnLine(document, targetLine, referenceColumn);

        if (targetRange) {
          editor.selection = new vscode.Selection(targetRange.start, targetRange.start);
          editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }

        await vscode.commands.executeCommand("editor.emmet.action.decrementNumberByOne");
      }
    )
  );
}

export function deactivate(): void {
  if (arrowDecorationType) {
    arrowDecorationType.dispose();
  }
}

function updateDecorations(editor: vscode.TextEditor): void {
  if (!arrowDecorationType) return;

  const { document, visibleRanges } = editor;
  if (!["css", "scss", "less"].includes(document.languageId)) {
    editor.setDecorations(arrowDecorationType, []);
    return;
  }

  const decorations: vscode.DecorationOptions[] = [];

  for (const visibleRange of visibleRanges) {
    for (let line = visibleRange.start.line; line <= visibleRange.end.line; line += 1) {
      if (line < 0 || line >= document.lineCount) continue;

      const lineText = document.lineAt(line).text;
      let match: RegExpExecArray | null;

      CSS_NUMBER_REGEX.lastIndex = 0;
      // eslint-disable-next-line no-cond-assign
      while ((match = CSS_NUMBER_REGEX.exec(lineText)) !== null) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;

        const range = new vscode.Range(
          new vscode.Position(line, startCol),
          new vscode.Position(line, endCol)
        );

        decorations.push({ range });
      }
    }
  }

  editor.setDecorations(arrowDecorationType, decorations);
}

function findClosestNumberRangeOnLine(
  document: vscode.TextDocument,
  lineNumber: number,
  referenceColumn?: number
): vscode.Range | null {
  if (lineNumber < 0 || lineNumber >= document.lineCount) {
    return null;
  }

  const lineText = document.lineAt(lineNumber).text;
  let match: RegExpExecArray | null;
  const ranges: vscode.Range[] = [];

  CSS_NUMBER_REGEX.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((match = CSS_NUMBER_REGEX.exec(lineText)) !== null) {
    const startCol = match.index;
    const endCol = match.index + match[0].length;

    ranges.push(
      new vscode.Range(
        new vscode.Position(lineNumber, startCol),
        new vscode.Position(lineNumber, endCol)
      )
    );
  }

  if (ranges.length === 0) {
    return null;
  }

  const refCol = referenceColumn ?? 0;

  let best = ranges[0];
  let bestDist = Math.abs((best.start.character + best.end.character) / 2 - refCol);

  for (const range of ranges.slice(1)) {
    const center = (range.start.character + range.end.character) / 2;
    const dist = Math.abs(center - refCol);
    if (dist < bestDist) {
      best = range;
      bestDist = dist;
    }
  }

  return best;
}

import * as vscode from "vscode";

const CSS_NUMBER_REGEX = /-?\d*\.?\d+(px|rem|em|vh|vw|%|ch|fr)?/g;

export function activate(context: vscode.ExtensionContext): void {
  console.log("CSS Controls extension activated");

  // CodeLens provider for CSS-like languages
  const selector: vscode.DocumentSelector = [
    { language: "css", scheme: "file" },
    { language: "scss", scheme: "file" },
    { language: "less", scheme: "file" },
  ];

  class CssNumberCodeLensProvider implements vscode.CodeLensProvider {
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
        if (!editor) {
          return;
        }

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
        // save the file so that the changes are reflected in the file (don't format to minimize intrusion)
        await vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementNumber",
      async (lineFromLens?: number) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

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
        // save the file so that the changes are reflected in the file (don't format to minimize intrusion)
        await vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting");
      }
    )
  );
}

export function deactivate(): void {}

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

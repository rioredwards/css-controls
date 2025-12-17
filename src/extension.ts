import * as vscode from "vscode";

const CSS_NUMBER_REGEX = /-?\d*\.?\d+(px|rem|em|vh|vw|%|ch|fr)?/g;

type Step = "tenth" | "one" | "ten";
let currentStep: Step = "one";

export function activate(context: vscode.ExtensionContext): void {
  console.log("CSS Controls extension activated");

  // CodeLens provider for CSS-like languages
  const selector: vscode.DocumentSelector = [
    { language: "css", scheme: "file" },
    { language: "scss", scheme: "file" },
    { language: "less", scheme: "file" },
  ];

  let activeEditor = vscode.window.activeTextEditor;
  let activeLine: number | undefined = activeEditor?.selection.active.line;
  const onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      activeEditor = editor;
      activeLine = editor?.selection.active.line;
      onDidChangeCodeLensesEmitter.fire();
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === activeEditor) {
        activeLine = event.selections[0]?.active.line;
        onDidChangeCodeLensesEmitter.fire();
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("css-controls.cycleStep", () => {
      currentStep = currentStep === "tenth" ? "one" : currentStep === "one" ? "ten" : "tenth";

      const label = currentStep === "tenth" ? "±0.1" : currentStep === "one" ? "±1" : "±10";
      vscode.window.setStatusBarMessage(`CSS Controls: step ${label}`, 2000);

      onDidChangeCodeLensesEmitter.fire();
    })
  );

  class CssNumberCodeLensProvider implements vscode.CodeLensProvider {
    // Recompute CodeLens when the active line/editor changes
    readonly onDidChangeCodeLenses = onDidChangeCodeLensesEmitter.event;

    provideCodeLenses(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
      const lenses: vscode.CodeLens[] = [];

      if (!activeEditor || document.uri.toString() !== activeEditor.document.uri.toString()) {
        return lenses;
      }

      if (typeof activeLine !== "number") {
        return lenses;
      }

      if (activeLine < 0 || activeLine >= document.lineCount) {
        return lenses;
      }

      const text = document.lineAt(activeLine).text;
      CSS_NUMBER_REGEX.lastIndex = 0;
      if (!CSS_NUMBER_REGEX.test(text)) {
        return lenses;
      }

      const range = new vscode.Range(activeLine, 0, activeLine, 0);

      // Single pair of increment/decrement lenses whose behavior depends on the current step.
      const stepConfig =
        currentStep === "tenth"
          ? {
              label: "0.1",
              incCommand: "css-controls.incrementNumberByTenth",
              decCommand: "css-controls.decrementNumberByTenth",
            }
          : currentStep === "one"
          ? {
              label: "1",
              incCommand: "css-controls.incrementNumber",
              decCommand: "css-controls.decrementNumber",
            }
          : {
              label: "10",
              incCommand: "css-controls.incrementNumberByTen",
              decCommand: "css-controls.decrementNumberByTen",
            };

      lenses.push(
        // Step indicator / cycle control
        new vscode.CodeLens(range, {
          title: `x${stepConfig.label}`,
          command: "css-controls.cycleStep",
          tooltip: "Cycle CSS Controls step (0.1, 1, 10)",
        }),
        // Decrement / increment for the current step
        new vscode.CodeLens(range, {
          title: `▼`,
          command: stepConfig.decCommand,
          arguments: [activeLine],
          tooltip: `Decrement number by ${stepConfig.label}`,
        }),
        new vscode.CodeLens(range, {
          title: `▲`,
          command: stepConfig.incCommand,
          arguments: [activeLine],
          tooltip: `Increment number by ${stepConfig.label}`,
        })
      );

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
        const emmetCommand =
          currentStep === "tenth"
            ? "editor.emmet.action.incrementNumberByOneTenth"
            : currentStep === "one"
            ? "editor.emmet.action.incrementNumberByOne"
            : "editor.emmet.action.incrementNumberByTen";
        await runNumberAdjustment(lineFromLens, emmetCommand);
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementNumber",
      async (lineFromLens?: number) => {
        const emmetCommand =
          currentStep === "tenth"
            ? "editor.emmet.action.decrementNumberByOneTenth"
            : currentStep === "one"
            ? "editor.emmet.action.decrementNumberByOne"
            : "editor.emmet.action.decrementNumberByTen";
        await runNumberAdjustment(lineFromLens, emmetCommand);
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.incrementNumberByTenth",
      async (lineFromLens?: number) => {
        await runNumberAdjustment(lineFromLens, "editor.emmet.action.incrementNumberByOneTenth");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementNumberByTenth",
      async (lineFromLens?: number) => {
        await runNumberAdjustment(lineFromLens, "editor.emmet.action.decrementNumberByOneTenth");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.incrementNumberByTen",
      async (lineFromLens?: number) => {
        await runNumberAdjustment(lineFromLens, "editor.emmet.action.incrementNumberByTen");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementNumberByTen",
      async (lineFromLens?: number) => {
        await runNumberAdjustment(lineFromLens, "editor.emmet.action.decrementNumberByTen");
      }
    )
  );
}

export function deactivate(): void {}

async function runNumberAdjustment(
  lineFromLens: number | undefined,
  emmetCommand: string
): Promise<void> {
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

  await vscode.commands.executeCommand(emmetCommand);
  // Save the file so that the changes are reflected in the file (don't format to minimize intrusion)
  await vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting");
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

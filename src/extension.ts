import * as vscode from "vscode";

// Regex for CSS numbers (e.g., 12px, 1.5rem, 50%)
const CSS_NUMBER_REGEX = /-?\d*\.?\d+(px|rem|em|vh|vw|%|ch|fr)?/g;

// Regex for Tailwind utility classes with numbers (e.g., w-12, h-64, p-4, gap-4, rounded-tl-3.9xl)
// Matches: prefix-number-suffix (e.g., rounded-tl-3.9xl)
// Captures: [1] prefix, [2] number, [3] optional suffix (like 'xl')
const TAILWIND_NUMBER_REGEX = /\b([a-z]+(?:-[a-z]+)*)-(\d+\.?\d*)([a-z]*)/g;

type Step = "tenth" | "one" | "ten";
let currentStep: Step = "one";

export function activate(context: vscode.ExtensionContext): void {
  console.log("CSS Controls extension activated");

  // CodeLens provider for CSS-like languages and HTML/JSX with Tailwind
  const selector: vscode.DocumentSelector = [
    { language: "css", scheme: "file" },
    { language: "scss", scheme: "file" },
    { language: "less", scheme: "file" },
    { language: "html", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
    { language: "typescriptreact", scheme: "file" },
  ];

  let activeEditor = vscode.window.activeTextEditor;
  let activeLine: number | undefined = activeEditor?.selection.active.line;
  const onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

  const CONTEXT_KEY = "css-controls.hasActiveNumber";

  const updateContext = () => {
    const hasActiveNumber = checkIfCodeLensShouldShow();
    vscode.commands.executeCommand("setContext", CONTEXT_KEY, hasActiveNumber);
  };

  const checkIfCodeLensShouldShow = (): boolean => {
    if (!activeEditor) {
      return false;
    }

    const document = activeEditor.document;
    const languageId = document.languageId;
    const isCssLike = languageId === "css" || languageId === "scss" || languageId === "less";
    const isHtmlOrJsx =
      languageId === "html" || languageId === "javascriptreact" || languageId === "typescriptreact";

    if (!isCssLike && !isHtmlOrJsx) {
      return false;
    }

    if (typeof activeLine !== "number") {
      return false;
    }

    if (activeLine < 0 || activeLine >= document.lineCount) {
      return false;
    }

    const text = document.lineAt(activeLine).text;

    // For CSS files, check for CSS numbers
    if (isCssLike) {
      CSS_NUMBER_REGEX.lastIndex = 0;
      return CSS_NUMBER_REGEX.test(text);
    }

    // For HTML/JSX files, check for Tailwind classes with numbers
    if (isHtmlOrJsx) {
      TAILWIND_NUMBER_REGEX.lastIndex = 0;
      return TAILWIND_NUMBER_REGEX.test(text);
    }

    return false;
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      activeEditor = editor;
      activeLine = editor?.selection.active.line;
      updateContext();
      onDidChangeCodeLensesEmitter.fire();
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === activeEditor) {
        activeLine = event.selections[0]?.active.line;
        updateContext();
        onDidChangeCodeLensesEmitter.fire();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (activeEditor && event.document === activeEditor.document) {
        updateContext();
        onDidChangeCodeLensesEmitter.fire();
      }
    })
  );

  // Initialize context on activation
  updateContext();

  const updateStepAndNotify = (newStep: Step) => {
    currentStep = newStep;
    const label = currentStep === "tenth" ? "±0.1" : currentStep === "one" ? "±1" : "±10";
    vscode.window.setStatusBarMessage(`CSS Controls: step ${label}`, 2000);
    onDidChangeCodeLensesEmitter.fire();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("css-controls.cycleStep", () => {
      const newStep: Step =
        currentStep === "tenth" ? "one" : currentStep === "one" ? "ten" : "tenth";
      updateStepAndNotify(newStep);
    }),
    vscode.commands.registerCommand("css-controls.increaseStep", () => {
      const newStep: Step =
        currentStep === "tenth" ? "one" : currentStep === "one" ? "ten" : "tenth";
      updateStepAndNotify(newStep);
    }),
    vscode.commands.registerCommand("css-controls.decreaseStep", () => {
      const newStep: Step =
        currentStep === "tenth" ? "ten" : currentStep === "one" ? "tenth" : "one";
      updateStepAndNotify(newStep);
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

      // Only show CodeLens if this is the active editor and conditions are met
      if (!activeEditor || document.uri.toString() !== activeEditor.document.uri.toString()) {
        return lenses;
      }

      if (!checkIfCodeLensShouldShow() || typeof activeLine !== "number") {
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
  const languageId = document.languageId;
  const isHtmlOrJsx =
    languageId === "html" || languageId === "javascriptreact" || languageId === "typescriptreact";

  const cursorPos = editor.selection.active;
  const targetLine = typeof lineFromLens === "number" ? lineFromLens : cursorPos.line;
  const referenceColumn = cursorPos.line === targetLine ? cursorPos.character : undefined;

  const targetRange = findClosestNumberRangeOnLine(document, targetLine, referenceColumn);

  if (!targetRange) {
    return;
  }

  editor.selection = new vscode.Selection(targetRange.start, targetRange.start);
  editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

  // For Tailwind classes, we need custom logic since Emmet doesn't work on class names
  if (isHtmlOrJsx) {
    const lineText = document.lineAt(targetLine).text;
    const numberText = document.getText(targetRange);
    const number = parseFloat(numberText);

    if (isNaN(number)) {
      return;
    }

    // Determine the step amount based on currentStep
    const stepAmount = currentStep === "tenth" ? 0.1 : currentStep === "one" ? 1 : 10;

    // Determine if incrementing or decrementing
    const isIncrement = emmetCommand.includes("increment");

    // Calculate new number
    const newNumber = isIncrement ? number + stepAmount : number - stepAmount;

    // For Tailwind, we typically want integers, but handle decimals for step 0.1
    const newNumberText =
      stepAmount === 0.1
        ? newNumber.toFixed(1).replace(/\.0$/, "")
        : Math.round(newNumber).toString();

    // Find the full class name to replace (e.g., "w-12" -> "w-13" or "rounded-tl-3.9xl" -> "rounded-tl-3.8xl")
    TAILWIND_NUMBER_REGEX.lastIndex = 0;
    let classMatch: RegExpExecArray | null;
    let classRange: vscode.Range | null = null;
    let prefix = "";
    let suffix = "";

    while ((classMatch = TAILWIND_NUMBER_REGEX.exec(lineText)) !== null) {
      // match[1] is prefix, match[2] is number, match[3] is optional suffix (like 'xl')
      const numberStart = classMatch.index + classMatch[0].indexOf(classMatch[2]);
      const numberEnd = numberStart + classMatch[2].length;

      if (numberStart === targetRange.start.character && numberEnd === targetRange.end.character) {
        // Found the matching class
        prefix = classMatch[1];
        suffix = classMatch[3] || "";
        const classStart = classMatch.index;
        const classEnd = classMatch.index + classMatch[0].length;
        classRange = new vscode.Range(
          new vscode.Position(targetLine, classStart),
          new vscode.Position(targetLine, classEnd)
        );
        break;
      }
    }

    if (classRange) {
      // Reconstruct the class with the new number: prefix-newNumber-suffix
      const newClass = `${prefix}-${newNumberText}${suffix}`;

      await editor.edit((editBuilder) => {
        editBuilder.replace(classRange!, newClass);
      });
    } else {
      // Fallback: just replace the number
      await editor.edit((editBuilder) => {
        editBuilder.replace(targetRange, newNumberText);
      });
    }
  } else {
    // For CSS files, use Emmet commands
    await vscode.commands.executeCommand(emmetCommand);
  }

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
  const languageId = document.languageId;
  const isCssLike = languageId === "css" || languageId === "scss" || languageId === "less";
  const isHtmlOrJsx =
    languageId === "html" || languageId === "javascriptreact" || languageId === "typescriptreact";

  let match: RegExpExecArray | null;
  const ranges: vscode.Range[] = [];

  if (isCssLike) {
    // Find CSS numbers
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
  } else if (isHtmlOrJsx) {
    // Find Tailwind classes with numbers
    // Match patterns like w-12, h-64, p-4, rounded-tl-3.9xl, etc. and extract just the number part
    TAILWIND_NUMBER_REGEX.lastIndex = 0;
    while ((match = TAILWIND_NUMBER_REGEX.exec(lineText)) !== null) {
      // match[1] is prefix, match[2] is number, match[3] is optional suffix
      const numberStart = match.index + match[0].indexOf(match[2]);
      const numberEnd = numberStart + match[2].length;

      ranges.push(
        new vscode.Range(
          new vscode.Position(lineNumber, numberStart),
          new vscode.Position(lineNumber, numberEnd)
        )
      );
    }
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

import * as vscode from "vscode";
import { createCodeLensProvider } from "./codelens";
import {
  createJumpToNumberCommand,
  createToggleEnabledCommand,
  createToggleInlineButtonsCommand,
} from "./commands";
import { PROPERTY_VALUES, SELECTOR, TAILWIND_NUMBER_REGEX, isHtmlOrJsxLanguage } from "./constants";
import {
  PropertyValueInfo,
  findClosestNumberRangeOnLine,
  findClosestPropertyValueRangeOnLine,
} from "./detection";
import { createCssControlsState } from "./state";

type Step = "tenth" | "one" | "ten";
let currentStep: Step = "one";

/**
 * Activates the extension by initializing state, wiring editor/document/config listeners, registering commands, and registering the CodeLens provider used for CSS/Tailwind number controls.
 *
 * @param context - VS Code extension context used to register subscriptions and disposables
 */

export function activate(context: vscode.ExtensionContext): void {
  console.log("CSS Controls extension activated");

  // CodeLens provider for CSS-like languages and HTML/JSX with Tailwind
  const selector: vscode.DocumentSelector = SELECTOR;

  // --- State & configuration ------------------------------------------------

  const state = createCssControlsState("css-controls");

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      state.updateFromActiveEditor(editor);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor === state.activeEditor) {
        state.updateFromSelection(event.selections);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      state.updateFromDocumentChange(event.document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      state.updateFromConfigChange(event);
    })
  );

  // Clean up decoration on deactivation
  context.subscriptions.push(state.decorationType);

  // --- Commands -------------------------------------------------------------

  const updateStepAndNotify = (newStep: Step) => {
    currentStep = newStep;
    const label = currentStep === "tenth" ? "±0.1" : currentStep === "one" ? "±1" : "±10";
    vscode.window.setStatusBarMessage(`CSS Controls: step ${label}`, 2000);
    state.updateContextAndDecorations();
    state.notifyCodeLensChange();
  };

  const toggleEnabled = createToggleEnabledCommand(state);
  const toggleInlineButtons = createToggleInlineButtonsCommand(state);

  const openExtensionDocs = async () => {
    // Open this extension's details page in the Extensions view
    await vscode.commands.executeCommand("extension.open", "RioEdwards.css-controls");
  };

  const jumpToNextNumber = createJumpToNumberCommand(state, "next");
  const jumpToPreviousNumber = createJumpToNumberCommand(state, "previous");

  context.subscriptions.push(
    vscode.commands.registerCommand("css-controls.cycleStep", () => {
      const newStep: Step =
        currentStep === "tenth" ? "one" : currentStep === "one" ? "ten" : "tenth";
      updateStepAndNotify(newStep);
    }),
    vscode.commands.registerCommand("css-controls.toggleEnabled", toggleEnabled),
    vscode.commands.registerCommand("css-controls.toggleInlineButtons", toggleInlineButtons),
    vscode.commands.registerCommand("css-controls.openDocs", () => {
      openExtensionDocs();
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
    }),
    vscode.commands.registerCommand("css-controls.jumpToNextNumber", jumpToNextNumber),
    vscode.commands.registerCommand("css-controls.jumpToPreviousNumber", jumpToPreviousNumber)
  );

  // --- CodeLens provider ----------------------------------------------------

  const provider = createCodeLensProvider(state, () => {
    if (currentStep === "tenth") {
      return {
        label: "0.1",
        incCommand: "css-controls.incrementValueByTenth",
        decCommand: "css-controls.decrementValueByTenth",
      };
    }
    if (currentStep === "one") {
      return {
        label: "1",
        incCommand: "css-controls.incrementValue",
        decCommand: "css-controls.decrementValue",
      };
    }
    return {
      label: "10",
      incCommand: "css-controls.incrementValueByTen",
      decCommand: "css-controls.decrementValueByTen",
    };
  });

  context.subscriptions.push(vscode.languages.registerCodeLensProvider(selector, provider));

  // Commands that wrap Emmet increment/decrement
  // These commands now adjust either numbers or supported property values,
  // depending on which is closest to the cursor.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "css-controls.incrementValue",
      async (lineFromLens?: number) => {
        const emmetCommand =
          currentStep === "tenth"
            ? "editor.emmet.action.incrementNumberByOneTenth"
            : currentStep === "one"
            ? "editor.emmet.action.incrementNumberByOne"
            : "editor.emmet.action.incrementNumberByTen";
        await runValueAdjustment(lineFromLens, emmetCommand);
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementValue",
      async (lineFromLens?: number) => {
        const emmetCommand =
          currentStep === "tenth"
            ? "editor.emmet.action.decrementNumberByOneTenth"
            : currentStep === "one"
            ? "editor.emmet.action.decrementNumberByOne"
            : "editor.emmet.action.decrementNumberByTen";
        await runValueAdjustment(lineFromLens, emmetCommand);
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.incrementValueByTenth",
      async (lineFromLens?: number) => {
        await runValueAdjustment(lineFromLens, "editor.emmet.action.incrementNumberByOneTenth");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementValueByTenth",
      async (lineFromLens?: number) => {
        await runValueAdjustment(lineFromLens, "editor.emmet.action.decrementNumberByOneTenth");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.incrementValueByTen",
      async (lineFromLens?: number) => {
        await runValueAdjustment(lineFromLens, "editor.emmet.action.incrementNumberByTen");
      }
    ),
    vscode.commands.registerCommand(
      "css-controls.decrementValueByTen",
      async (lineFromLens?: number) => {
        await runValueAdjustment(lineFromLens, "editor.emmet.action.decrementNumberByTen");
      }
    )
  );
}

export function deactivate(): void {}

// Core adjustment routine used by all increment/decrement commands.
// It decides whether to adjust a numeric value or a supported property value
// based on which is closest to the cursor on the target line.
async function runValueAdjustment(
  lineFromLens: number | undefined,
  emmetCommand: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const languageId = document.languageId;
  const isHtmlOrJsx = isHtmlOrJsxLanguage(languageId);

  const cursorPos = editor.selection.active;
  const targetLine = typeof lineFromLens === "number" ? lineFromLens : cursorPos.line;
  const referenceColumn = cursorPos.line === targetLine ? cursorPos.character : undefined;

  // Decide whether to adjust a flexbox property value or a number,
  // based on which is closest to the cursor.
  const numberRange = findClosestNumberRangeOnLine(document, targetLine, referenceColumn);
  const propertyInfo = findClosestPropertyValueRangeOnLine(document, targetLine, referenceColumn);

  if (!numberRange && !propertyInfo) {
    return;
  }

  const refCol = referenceColumn ?? 0;

  let useProperty = false;
  if (numberRange && propertyInfo) {
    const numberCenter = (numberRange.start.character + numberRange.end.character) / 2;
    const propertyCenter =
      (propertyInfo.range.start.character + propertyInfo.range.end.character) / 2;
    useProperty = Math.abs(propertyCenter - refCol) <= Math.abs(numberCenter - refCol);
  } else if (propertyInfo) {
    useProperty = true;
  }

  if (useProperty && propertyInfo) {
    await applyPropertyValueAdjustment(document, targetLine, propertyInfo, emmetCommand);
    return;
  }

  const targetRange = numberRange!;

  editor.selection = new vscode.Selection(targetRange.start, targetRange.start);
  editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

  // For Tailwind classes, we need custom logic since Emmet doesn't work on class names
  if (isHtmlOrJsx) {
    await applyTailwindNumberAdjustment(document, targetLine, targetRange, emmetCommand);
  } else {
    // For CSS files, use Emmet commands
    await vscode.commands.executeCommand(emmetCommand);
  }

  // Save the file so that the changes are reflected in the file (don't format to minimize intrusion)
  // await vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting");
}

/**
 * Apply an increment or decrement to the numeric token at `targetRange` on `targetLine`, updating the active editor.
 *
 * The function determines the step from the module-level `currentStep`, computes a new formatted numeric value,
 * and attempts to map that value into a matching Tailwind-style class on the same line using `TAILWIND_NUMBER_REGEX`.
 * If a matching class is found, the entire class token is replaced preserving its prefix and suffix; otherwise only
 * the numeric range is replaced. If there is no active editor or the target text is not a number, no changes are made.
 *
 * @param document - The document containing the target line.
 * @param targetLine - Zero-based line index that contains the target number.
 * @param targetRange - Range of the numeric token to adjust.
 * @param emmetCommand - Emmet command string whose name indicates increment vs. decrement.
 */
async function applyTailwindNumberAdjustment(
  document: vscode.TextDocument,
  targetLine: number,
  targetRange: vscode.Range,
  emmetCommand: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const lineText = document.lineAt(targetLine).text;
  const numberText = document.getText(targetRange);
  const number = parseFloat(numberText);

  if (isNaN(number)) {
    return;
  }

  const stepAmount = currentStep === "tenth" ? 0.1 : currentStep === "one" ? 1 : 10;
  const isIncrement = emmetCommand.includes("increment");
  const newNumber = isIncrement ? number + stepAmount : number - stepAmount;

  const newNumberText =
    stepAmount === 0.1
      ? newNumber.toFixed(1).replace(/\.0$/, "")
      : Math.round(newNumber).toString();

  TAILWIND_NUMBER_REGEX.lastIndex = 0;
  let classMatch: RegExpExecArray | null;
  let classRange: vscode.Range | null = null;
  let prefix = "";
  let suffix = "";

  while ((classMatch = TAILWIND_NUMBER_REGEX.exec(lineText)) !== null) {
    const numberStart = classMatch.index + classMatch[1].length + 1;
    const numberEnd = numberStart + classMatch[2].length;

    if (numberStart === targetRange.start.character && numberEnd === targetRange.end.character) {
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
    const newClass = `${prefix}-${newNumberText}${suffix}`;

    await editor.edit((editBuilder) => {
      editBuilder.replace(classRange!, newClass);
    });
  } else {
    await editor.edit((editBuilder) => {
      editBuilder.replace(targetRange, newNumberText);
    });
  }
}

async function applyPropertyValueAdjustment(
  document: vscode.TextDocument,
  targetLine: number,
  propertyInfo: PropertyValueInfo,
  emmetCommand: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { property, value, range } = propertyInfo;
  const validValues = PROPERTY_VALUES[property];

  if (!validValues || validValues.length === 0) {
    return;
  }

  const currentIndex = validValues.findIndex((v) => v.toLowerCase() === value.toLowerCase());

  if (currentIndex === -1) {
    return;
  }

  const isIncrement = emmetCommand.includes("increment");
  const direction = isIncrement ? 1 : -1;

  const newIndex = (currentIndex + direction + validValues.length) % validValues.length;
  const newValue = validValues[newIndex];

  const lineText = document.lineAt(targetLine).text;
  const valueAfterCurrent = lineText.substring(range.end.character);

  const importantMatch = valueAfterCurrent.match(/^\s*!\s*important/i);
  const hasImportant = importantMatch !== null;

  const replacement = hasImportant ? `${newValue} !important` : newValue;

  await editor.edit((editBuilder) => {
    if (hasImportant && importantMatch && importantMatch.index !== undefined) {
      const fullRange = new vscode.Range(
        range.start,
        new vscode.Position(
          targetLine,
          range.end.character + importantMatch.index + importantMatch[0].length
        )
      );
      editBuilder.replace(fullRange, replacement);
    } else {
      editBuilder.replace(range, newValue);
    }
  });

  const newRange = new vscode.Range(
    range.start,
    new vscode.Position(range.start.line, range.start.character + newValue.length)
  );
  editor.selection = new vscode.Selection(newRange.start, newRange.start);
  editor.revealRange(newRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

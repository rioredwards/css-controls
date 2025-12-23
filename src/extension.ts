import * as vscode from "vscode";
import { createCodeLensProvider } from "./codelens";
import {
  createCyclePropertyValueCommand,
  createJumpToNumberCommand,
  createToggleEnabledCommand,
  createToggleInlineButtonsCommand,
} from "./commands";
import { SELECTOR, TAILWIND_NUMBER_REGEX } from "./constants";
import { findClosestNumberRangeOnLine } from "./detection";
import { createCssControlsState } from "./state";

type Step = "tenth" | "one" | "ten";
let currentStep: Step = "one";

// --- Extension entrypoint ---------------------------------------------------

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

  const cyclePropertyValueForward = createCyclePropertyValueCommand(
    state,
    "forward",
    () => currentStep
  );
  const cyclePropertyValueBackward = createCyclePropertyValueCommand(
    state,
    "backward",
    () => currentStep
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "css-controls.cyclePropertyValueForward",
      cyclePropertyValueForward
    ),
    vscode.commands.registerCommand(
      "css-controls.cyclePropertyValueBackward",
      cyclePropertyValueBackward
    )
  );

  // --- CodeLens provider ----------------------------------------------------

  const provider = createCodeLensProvider(state, () => {
    if (currentStep === "tenth") {
      return {
        label: "0.1",
        incCommand: "css-controls.incrementNumberByTenth",
        decCommand: "css-controls.decrementNumberByTenth",
      };
    }
    if (currentStep === "one") {
      return {
        label: "1",
        incCommand: "css-controls.incrementNumber",
        decCommand: "css-controls.decrementNumber",
      };
    }
    return {
      label: "10",
      incCommand: "css-controls.incrementNumberByTen",
      decCommand: "css-controls.decrementNumberByTen",
    };
  });

  context.subscriptions.push(vscode.languages.registerCodeLensProvider(selector, provider));

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
      // Number starts after: classMatch.index (start of match) + prefix length + 1 (for the dash)
      const numberStart = classMatch.index + classMatch[1].length + 1;
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
  // await vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting");
}

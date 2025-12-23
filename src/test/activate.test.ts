import * as assert from "assert";
import * as vscode from "vscode";

suite("Activate Wiring Test Suite", () => {
  test("core commands are registered", async () => {
    // The extension host already activates this extension during the test run.
    // Just verify that our commands are registered.
    const commands = await vscode.commands.getCommands(true);

    const expected = [
      "css-controls.cycleStep",
      "css-controls.toggleEnabled",
      "css-controls.toggleInlineButtons",
      "css-controls.openDocs",
      "css-controls.incrementValue",
      "css-controls.decrementValue",
      "css-controls.jumpToNextNumber",
      "css-controls.jumpToPreviousNumber",
    ];

    for (const cmd of expected) {
      assert.ok(commands.includes(cmd), `Expected command to be registered: ${cmd}`);
    }
  });
});

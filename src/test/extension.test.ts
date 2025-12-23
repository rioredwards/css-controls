import * as assert from "assert";
import * as vscode from "vscode";

import { findClosestNumberRangeOnLine, findClosestPropertyValueRangeOnLine } from "../detection";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("findClosestNumberRangeOnLine finds CSS numbers near cursor", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: " .box { margin: 10px 20px; }",
    });

    // Cursor near the first number (10px)
    const range1 = findClosestNumberRangeOnLine(doc, 0, 18);
    assert.ok(range1, "Expected a range for first number");
    const num1 = doc.getText(range1!);
    assert.strictEqual(num1, "10px");

    // Cursor near the second number (20px)
    const range2 = findClosestNumberRangeOnLine(doc, 0, 23);
    assert.ok(range2, "Expected a range for second number");
    const num2 = doc.getText(range2!);
    assert.strictEqual(num2, "20px");
  });

  test("findClosestPropertyValueRangeOnLine detects justify-content values", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: " .row { justify-content: center; }",
    });

    // Cursor on the value "center"
    const info = findClosestPropertyValueRangeOnLine(doc, 0, 30);
    assert.ok(info, "Expected a property value match");
    assert.strictEqual(info!.property, "justify-content");
    const valueText = doc.getText(info!.range);
    assert.strictEqual(valueText, "center");
  });

  test("findClosestPropertyValueRangeOnLine preserves !important in range", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: " .row { justify-content: center !important; }",
    });

    // Cursor somewhere on "center"
    const info = findClosestPropertyValueRangeOnLine(doc, 0, 32);
    assert.ok(info, "Expected a property value match with !important");
    assert.strictEqual(info!.property, "justify-content");
    const valueText = doc.getText(info!.range);
    // Range should cover just the core value we cycle, not the !important
    assert.strictEqual(valueText, "center");
  });

  test("findClosestPropertyValueRangeOnLine handles extra spaces and no semicolon", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".row {   justify-content  :   flex-end  }",
    });

    // Cursor roughly over "flex-end"
    const info = findClosestPropertyValueRangeOnLine(doc, 0, 30);
    assert.ok(info, "Expected a property value match with irregular spacing");
    assert.strictEqual(info!.property, "justify-content");
    const valueText = doc.getText(info!.range);
    assert.strictEqual(valueText, "flex-end");
  });

  test("findClosestPropertyValueRangeOnLine chooses closest property when multiple on same line", async () => {
    const doc = await vscode.workspace.openTextDocument({
      language: "css",
      content: ".row { justify-content: center; align-items: flex-start; align-self: flex-end; }",
    });

    // Cursor near align-items value
    const infoAlignItems = findClosestPropertyValueRangeOnLine(doc, 0, 50);
    assert.ok(infoAlignItems, "Expected a property value match near align-items");
    assert.strictEqual(infoAlignItems!.property, "align-items");
    const valueAlignItems = doc.getText(infoAlignItems!.range);
    assert.strictEqual(valueAlignItems, "flex-start");

    // Cursor near align-self value
    const infoAlignSelf = findClosestPropertyValueRangeOnLine(doc, 0, 75);
    assert.ok(infoAlignSelf, "Expected a property value match near align-self");
    assert.strictEqual(infoAlignSelf!.property, "align-self");
    const valueAlignSelf = doc.getText(infoAlignSelf!.range);
    assert.strictEqual(valueAlignSelf, "flex-end");
  });
});

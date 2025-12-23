import * as vscode from "vscode";
import { CSS_NUMBER_REGEX, PROPERTY_VALUES, TAILWIND_NUMBER_REGEX } from "./constants";

export function findClosestNumberRangeOnLine(
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
      // Number starts after: match.index (start of match) + prefix length + 1 (for the dash)
      const numberStart = match.index + match[1].length + 1;
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

  // First, check if cursor is inside any number range (prefer that)
  for (const range of ranges) {
    if (refCol >= range.start.character && refCol <= range.end.character) {
      return range;
    }
  }

  // Otherwise, find the closest by center distance
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

export interface PropertyValueInfo {
  range: vscode.Range;
  property: string;
  value: string;
}

export function findClosestPropertyValueRangeOnLine(
  document: vscode.TextDocument,
  lineNumber: number,
  referenceColumn?: number
): PropertyValueInfo | null {
  if (lineNumber < 0 || lineNumber >= document.lineCount) {
    return null;
  }

  const languageId = document.languageId;
  const isCssLike = languageId === "css" || languageId === "scss" || languageId === "less";

  // Only work with CSS-like files for now
  if (!isCssLike) {
    return null;
  }

  const lineText = document.lineAt(lineNumber).text;
  const refCol = referenceColumn ?? 0;

  // Regex to match CSS property-value pairs: property-name: value;
  // Handles: property: value; or property: value (without semicolon)
  // Captures: [1] property name, [2] full value string
  const propertyValueRegex = /([a-z-]+)\s*:\s*([^;]+?)(?:\s*;|\s*$)/gi;

  const matches: Array<{
    property: string;
    value: string;
    valueStart: number;
    valueEnd: number;
  }> = [];

  propertyValueRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = propertyValueRegex.exec(lineText)) !== null) {
    const property = match[1].trim().toLowerCase();
    const fullValue = match[2].trim();

    // Check if this property is in our PROPERTY_VALUES map
    if (property in PROPERTY_VALUES) {
      const validValues = PROPERTY_VALUES[property];
      const fullValueLower = fullValue.toLowerCase();

      // Find which valid value matches
      for (const validValue of validValues) {
        const validValueLower = validValue.toLowerCase();

        // Check for exact match or if the value starts with the valid value (for cases like "center !important")
        if (
          fullValueLower === validValueLower ||
          fullValueLower.startsWith(validValueLower + " ") ||
          fullValueLower.startsWith(validValueLower + "!")
        ) {
          // Calculate the value range
          const colonIndex = match.index + match[1].length;
          const afterColon = lineText.substring(colonIndex);
          const colonMatch = afterColon.match(/:\s*/);

          if (colonMatch && colonMatch.index !== undefined) {
            const valueStart = colonIndex + colonMatch.index + colonMatch[0].length;
            // Find the position of the matched value in the value string
            const valueText = lineText.substring(valueStart);
            const valueIndex = valueText.toLowerCase().indexOf(validValueLower);

            if (valueIndex >= 0) {
              // Find the end of the value word (might have !important or other modifiers)
              const valueWordEnd = valueIndex + validValue.length;
              // Look for word boundary (space, semicolon, or end)
              let actualEnd = valueStart + valueWordEnd;
              const remaining = valueText.substring(valueWordEnd);
              const boundaryMatch = remaining.match(/^(\s|;|!)/);
              if (boundaryMatch) {
                // Include the boundary if it's part of the value (like !important)
                if (boundaryMatch[0] === "!") {
                  // Check if it's !important
                  const importantMatch = remaining.match(/^!\s*important/i);
                  if (importantMatch && importantMatch.index !== undefined) {
                    actualEnd =
                      valueStart + valueIndex + importantMatch.index + importantMatch[0].length;
                  } else {
                    actualEnd = valueStart + valueIndex + validValue.length;
                  }
                } else {
                  actualEnd = valueStart + valueIndex + validValue.length;
                }
              } else {
                actualEnd = valueStart + valueIndex + validValue.length;
              }

              matches.push({
                property,
                value: validValue,
                valueStart: valueStart + valueIndex,
                valueEnd: actualEnd,
              });
              break;
            }
          }
        }
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Find the match that the cursor is on or closest to
  let bestMatch: (typeof matches)[0] | null = null;
  let bestDist = Infinity;

  for (const m of matches) {
    // Check if cursor is inside this value range
    if (refCol >= m.valueStart && refCol <= m.valueEnd) {
      bestMatch = m;
      break;
    }

    // Otherwise, calculate distance to center
    const center = (m.valueStart + m.valueEnd) / 2;
    const dist = Math.abs(center - refCol);
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = m;
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    range: new vscode.Range(
      new vscode.Position(lineNumber, bestMatch.valueStart),
      new vscode.Position(lineNumber, bestMatch.valueEnd)
    ),
    property: bestMatch.property,
    value: bestMatch.value,
  };
}

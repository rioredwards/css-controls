# Change Log

## [1.2.0] - 2025-12-23

- Extended support to move beyond just numbers! CSS-Controls now supports controlling the common flexbox alignment properties (`justify-content`, `align-items`, `align-self`). These can be cycled through with the same inline buttons and keyboard shortcuts as numeric values.
- The new model is based on **supported values** (working title). Any supported CSS property value will trigger the CodeLens and enable keyboard shortcuts. We plan to expand support to many more CSS properties in the future.
- Refactored the extension into smaller modules (`constants`, `detection`, `state`, `commands`, `codelens`) for better "-ilities" (readability, maintainability, scalability, and testability).
- Added some much needed unit tests.

### Migration notes from 1.1.x

- The core increment/decrement command IDs were renamed to reflect the new "value" model:
  - `css-controls.incrementNumber` → `css-controls.incrementValue`
  - `css-controls.decrementNumber` → `css-controls.decrementValue`
- If you have **custom keybindings**, settings, or automation that reference the old IDs, update them to the new ones. For example, a custom keybinding that previously used:

  ```json
  {
    "key": "ctrl+up",
    "command": "css-controls.incrementNumber"
  }
  ```

  should now use:

  ```json
  {
    "key": "ctrl+up",
    "command": "css-controls.incrementValue"
  }
  ```

  The default keybindings shipped by the extension have already been updated.

## [1.1.1] - 2025-12-22

- Sorted changelog in descending order.
- Compressed images to reduce bundle size by 1000000x.

## [1.1.0] - 2025-12-22

- Changed default keyboard shortcuts to use ctrl instead of cmd
 - Added settings/commands to turn the entire extension on/off and to hide just the inline buttons while keeping keyboard shortcuts active.
- Added a more precise "when" clause to the keybindings to make the extension less disruptive.
- Added an inline help `?` control that opens the CSS Controls extension page in the editor for docs and settings.
- Updated CodeLens tooltips to include `(css-controls)`.

## [1.0.3] - 2025-12-17

- Small README.md update and removed save without formatting command.

## [1.0.2] - 2025-12-17

- Fixed link to img in README.md.

## [1.0.1] - 2025-12-17

- Fixed a bug.


## [Unreleased]

- Initial release





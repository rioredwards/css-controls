# CSS Controls

Speed up your CSS workflow with buttons & shortcuts for speedy CSS/Tailwind adjustments.


![Yum Banner](https://raw.githubusercontent.com/rioredwards/css-controls/0ca7417660745d3c4f83d3c533b3618745145dde/images/CSS_Controls_Screenshot.jpg)

## Buttons

- Buttons appear above the current line when a CSS or Tailwind number value is detected.
- ▲▼ - Increment/decrement the targetted number.
- x1 - Cycle between 0.1x, 1x, and 10x step sizes.
- ? - Opens the CSS Controls extension page in your editor so you can view docs, tweak settings, or disable it.

## Keyboard Shortcuts

The buttons are just a marketing ploy... the shortcuts are where the real magic happens ♡

| Shortcut | Command |
|----------|---------|
| `Ctrl+Up` | Increment number |
| `Ctrl+Down` | Decrement number |
| `Ctrl+Shift+Up` | Increase step size |
| `Ctrl+Shift+Down` | Decrease step size |
| `Ctrl+Shift+Right` | Jump to next value within current line |
| `Ctrl+Shift+Left` | Jump to previous value within current line |

**Note about conflicts:**
You can always reassign the shortcuts to your liking or disable them altogether.
The shortcuts only activate when the extension activates. i.e. you are editing a CSS, SCSS, Less, HTML, JSX, or TSX file and your cursor is positioned on a line that contains a valid CSS or Tailwind number value. This way they minimize conflicts with existing shortcuts..

## Configuration

To quickly toggle the extension on/off, you can either:
- Run `CSS Controls: Toggle Enabled` from the Command Palette.
- Open Settings and turn **CSS Controls › Enabled** off (`css-controls.enabled`).

If you just want the keyboard shortcuts and not the inline buttons:
- Run `CSS Controls: Toggle Inline Buttons` from the Command Palette.
- Open Settings and turn **CSS Controls › Enable Inline Buttons** off (`css-controls.enableInlineButtons`).

## Supported File Types

- CSS
- SCSS
- Less
- HTML (with Tailwind classes)
- JSX/TSX (with Tailwind classes)


## Requirements

VS Code or Cursor.

## Feedback

Feel free to reach out with any questions, feedback, or suggestions.

## Authors

Made with ❤️ by [Rio Edwards](https://www.linkedin.com/in/rio-edwards/)

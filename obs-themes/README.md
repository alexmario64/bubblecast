# Bubblecast styles for OBS Studio

Three extra native OBS styles matching the Bubblecast interface:

1. **Bubblecast 1 - Rose & Peach**: warm pearl panels, rose/peach window gradient, teal highlights.
2. **Bubblecast 2 - Red & White**: white panels, pale red background, red selection and control accents.
3. **Bubblecast 3 - Console Glass**: cool blue/mint glass panels, a vivid red navigation strip, white text, turquoise selection rings, generous round controls, and pearl-white circular toolbar buttons with original colored vector icons. This is the closer match to the supplied console reference.

Built for the installed OBS Studio **32.2.2**. The first two `.ovt` variants extend the built-in `com.obsproject.Yami.Light` style, which extends Yami. Console Glass extends `com.obsproject.Yami.Original` and uses the built-in dark-style white icons. OBS supplies the light icons and native widget rules; no built-in theme is copied or replaced.

## Install and select

Run **Install OBS Themes.cmd** in the Bubblecast folder. It copies the `Bubblecast_*.ovt` files and the `BubblecastConsole` icon folder into `%APPDATA%\obs-studio\themes`. Administrator rights are not required.

After the next OBS restart, open **Settings → Appearance**, choose **Theme: Yami**, and select a Bubblecast entry in **Style**. Apply it to preview the result. Choose your previous style again at any time. Installation does not change the active style, scenes, sources, accounts, shortcuts, or stream settings. The theme uses Segoe UI, a minimum 10-point UI size, and a spacing floor to stay legible even when OBS is configured with a very small font or negative density; the stored OBS preferences are not edited.

OBS Qt themes can color and round native controls, docks, lists, menus, and settings, but cannot reproduce browser backdrop blur or CSS animations. Embedded web pages and third-party plugin windows may draw their own interface. Windows controls the outer native title bar. Bubblecast browser docks use their own Color scheme selector; it is not automatically synchronized with the OBS style choice.

## Validation

`node obs-themes/validate.mjs` checks the inheritance chain, variable references and cycles, rule braces, and Light icon availability against the installed OBS theme files. The revision is also rendered with real offscreen Qt widgets using preview.py. This exercises composed stylesheets, selected rows, native controls, and a dock layout, but is not a running OBS session. Actual OBS layouts and third-party plugin docks still need visual review. The local preview renderer uses PySide6-Essentials from PyPI, stored under the excluded .local/theme-preview directory.

Source generator: `build.mjs`. Theme structure follows the [official OBS theme documentation](https://github.com/obsproject/obs-studio/wiki/OBS-Studio-Theme-System).

To uninstall, select another style first, close OBS, then remove the `BubblecastConsole` icon folder and only `Bubblecast_Rose_Peach.ovt` `Bubblecast_Red_White.ovt`, and `Bubblecast_Console_Glass.ovt` from the user themes folder.

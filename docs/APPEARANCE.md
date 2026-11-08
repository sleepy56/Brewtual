# Brewtual’s seven atmospheres

Daily Ritual is the default for new visitors. Existing Solaris and Cozy preferences keep their original IDs and storage key, so saved choices continue to work. An unavailable saved theme falls back to Daily Ritual.

| Theme | Foundation | Contrasting action color | Typography |
| --- | --- | --- | --- |
| Daily Ritual | Oat paper, espresso navigation, toasted-coffee details | Deep teal | DM Sans + Fraunces |
| Secret Garden | Parchment, forest navigation, botanical flourishes | Berry | Nunito Sans + Cormorant Garamond |
| Little Things | Peach, lilac, rounded frosted cards | Deep blue-green | DM Sans + Plus Jakarta Sans |
| After Hours | Charcoal, burgundy, espresso glass | Bright copper | Manrope + Playfair Display |
| Social Club | Butter cream, burnt orange, playful forms | Cobalt | Space Grotesk + Fredoka |
| Solaris | Violet nights, cyan details, dark glass | Peach/coral | DM Sans |
| Cozy | Warm cream, coffee, rose details | Forest green | DM Sans + Georgia |

The five new directions follow the descriptions in the “Theme Idea Websites” chat. Themes change atmosphere, typography, surfaces, and decorative motifs. Tasks, ownership, sharing, balances, and approvals keep the same behavior across all choices.

## Color and glass

`app/themes.css` separates the structural `--accent` from `--action`, `--action-text`, and `--action-gradient`. Primary buttons, the mobile add button, and completed checkboxes use the action color. Navigation, token icons, and quieter details use the foundation palette. The main buttons’ gradient stops are checked against their text color in browser QA, with a minimum 4.5:1 contrast target.

Cards, popups, and dialogs share translucent surfaces, backdrop blur, fine borders, and a restrained inner highlight. Background tints show through without placing important text over strong imagery. The logo keeps its existing form and follows the theme’s brand colors, with the contrasting color on its small dot. Installed-app icons use the espresso, oat, and mint brand palette.

## Landing page and controls

The landing page introduces Personal, Partner, and Group use, offers an interactive local preview with separate progress for each section, shows an example reward menu, and lets visitors try every atmosphere. Preview tasks do not create account data. Every account-entry button opens the existing sign-in/signup screen.

Settings and the landing page show all seven choices with palette swatches. The compact sidebar and account-screen control opens a themed native popover, which supports Escape, outside-click dismissal, and keyboard access. The chooser scrolls within the viewport on small screens.

## Font assets

The font files in `public/fonts/` are self-hosted Latin WOFF2 subsets from [Google Fonts](https://fonts.google.com/). The browser loads the fonts used by the selected theme. No runtime Google Fonts request is needed. Each font’s SIL Open Font License is included alongside it. Georgia and system sans-serif fonts provide fallbacks for other characters and unavailable font files.

# PicSift Core Color Palette

This document defines the core color palette for PicSift, extracted from CSS gradient examples.

## Color Palette

The core color palette consists of five colors that form a linear gradient (135deg):

| Color | Hex Code | Stop Position | Description |
|-------|----------|---------------|-------------|
| Primary Blue-Purple | `#667eea` | 0% | Main blue-purple shade (also used as fallback color) |
| Muted Purple | `#764ba2` | 25% | Darker, muted blue-purple |
| Pink-Magenta | `#f093fb` | 50% | Bright pink/purple accent |
| Sky Blue | `#4facfe` | 75% | Vibrant light blue |
| Cyan | `#00f2fe` | 100% | Bright cyan/aqua blue |

## Gradient Definition

The complete linear gradient definition:

```css
linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #4facfe 75%, #00f2fe 100%)
```

## Reference Screenshots

The following screenshots contain CSS code examples showing different ways to implement this gradient:

1. `assets/color-palette/Screenshot_2026-01-27_at_5.46.35_PM-a6189d3a-170b-4f5e-b4f7-3048b73146c3.png`
2. `assets/color-palette/Screenshot_2026-01-27_at_5.46.41_PM-dec7f404-5723-4bf3-9129-716d611b08cd.png`
3. `assets/color-palette/Screenshot_2026-01-27_at_5.46.49_PM-12c54adc-057c-4b57-a287-a01d94216c17.png`

These screenshots demonstrate:
- Gradient with fallback color
- Browser-prefixed versions for legacy support
- SCSS variable implementation
- CSS custom properties
- Tailwind CSS arbitrary value usage

## Usage Notes

- The gradient direction is **135deg** (diagonal from top-left to bottom-right)
- `#667eea` serves as both the gradient start and fallback solid color
- All five colors can be used individually for UI components, text, or accent colors
- The gradient can be applied as a background using any of the methods shown in the reference screenshots

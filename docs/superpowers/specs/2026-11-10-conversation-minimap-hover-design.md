# Conversation Minimap Hover Design

## Intent

Make the chat conversation minimap easier to read by extending hover emphasis
from five markers to seven, using a bell-curve-like rightward offset, and
avoiding the minimap for short conversations.

## Requirements

- The hovered user-message marker affects itself and up to three neighboring
  user-message markers on each side, for a maximum of seven markers.
- Rightward marker offsets use a fixed, non-linear falloff that evokes a normal
  distribution: the center moves furthest and the third neighbor moves only a
  small amount.
- The conversation minimap is not rendered until there are at least five user
  messages; five messages is the first visible case.
- Existing marker navigation, active-marker behavior, tooltip behavior, and
  responsive placement remain unchanged.

## Approaches

1. **Distance-to-offset table (chosen):** map the distance from the hovered
   marker to explicit offsets for distances 0 through 3. This keeps the visual
   curve deterministic and easy to tune without introducing runtime math or
   CSS interpolation.
2. **Runtime Gaussian calculation:** calculate each offset from an exponential
   curve. This is more mathematically continuous but makes the visual tuning
   less transparent and still needs a cutoff at distance 3.

## Design

`ConversationMinimap` will derive the absolute distance from each marker to
the hovered marker. Distances 0, 1, 2, and 3 receive the selected emphasis,
scale, and rightward offset; distances greater than 3 retain the neutral marker
style and zero offset. The offset table will use a descending, non-linear
sequence (`14px`, `10px`, `5px`, `2px`) to approximate a normal-distribution
falloff.

When the number of user-message markers is below five, `ConversationMinimap`
will return `null`, so the chat activity content itself remains unaffected.

## Verification

Focused component tests will cover the five-message visibility boundary, the
seven-marker hover influence, and the non-linear offset classes. The full
frontend test suite, formatter, linter, and production build remain the final
verification gate.

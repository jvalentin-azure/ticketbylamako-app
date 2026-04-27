# Seating Chart Layout Analysis

## Key findings:
- **tc_seating_map**: position:fixed, inset:0, z-index:999999, 1280x1100px
- **tc-wrapper**: 1280x1100px, has background-image (the venue image), relative position
- **13 tc-group-wrap** children positioned absolutely within tc-wrapper

## Critical issue: The chart is designed for ~1838px wide viewport!
- Group at left: 0px (455px wide)
- Group at center: 547-583px (665-735px wide)
- Group at right: 1305-1383px (455px wide)
- Bottom groups: top 826-1295px

## On mobile (375px wide viewport):
- The tc_seating_map is position:fixed, inset:0 → fills the screen (375px wide)
- The tc-wrapper is 1100px tall but the content extends to ~1838px wide and ~1375px tall
- Groups positioned at left:1375px are COMPLETELY off-screen on mobile
- The wrapper does NOT have overflow:scroll, so the content is clipped
- The wrapper has `overflow: visible` but the parent (tc_seating_map) clips it

## Solution:
The seating chart needs to be scaled down to fit the mobile viewport OR made scrollable/pannable.

The Tickera seating chart has a built-in zoom feature (tc-v-zero-point-88 class = 88% zoom).
On desktop, the chart fills the full screen (1280px+) so everything fits.
On mobile, we need to:
1. Make the tc-wrapper scrollable (overflow: auto with touch support)
2. OR scale the entire chart to fit the mobile viewport width
3. OR use the Tickera built-in zoom controls to zoom out further

Best approach: Add CSS to make the chart container scrollable with touch, and set initial scale to fit width.

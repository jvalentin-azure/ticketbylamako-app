# Seating Chart Mobile Rendering Issue

## Problem
- On mobile (iOS via Expo Go WebView), after clicking "Pick your seat(s)":
  - The seating chart overlay opens (brown background, "Subtotal: Ar 0", close X button)
  - But the actual seat sections (divs with individual seats) are NOT visible
  - Only "GO TO CART" text is visible at the bottom left
  - The seats ARE in the DOM (we confirmed on desktop browser) but not rendering on mobile

## Root Cause Analysis
The Tickera seating chart uses jQuery UI Dialog to show the seat map.
The seat sections are positioned absolutely within the dialog.
On mobile WebView:
1. The jQuery UI dialog may not be sized correctly for the mobile viewport
2. The seat sections may overflow outside the visible area
3. The CSS `overflow: hidden` on the dialog may clip the seats
4. The seating chart uses fixed pixel dimensions designed for desktop

## Key observations from desktop test:
- The seating chart container has multiple div sections (sections 1-9) with seats
- Each section is positioned absolutely with pixel coordinates
- The overall chart area is much larger than a mobile screen
- On desktop, the chart is scrollable/pannable within the jQuery UI dialog

## Solution approaches:
1. Add CSS to make the seating chart scrollable and fit mobile viewport
2. Enable pinch-to-zoom on the WebView
3. Add viewport meta tag with proper scaling
4. Override jQuery UI dialog CSS for mobile
5. Make the chart container scrollable with touch support

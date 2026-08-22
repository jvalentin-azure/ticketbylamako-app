import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(
  resolve("components/maps/embedded-google-map.tsx"),
  "utf8",
);
const eventSource = readFileSync(resolve("app/event/[id].tsx"), "utf8");
const ticketSource = readFileSync(resolve("app/ticket/[id].tsx"), "utf8");

describe("embedded event map", () => {
  it("loads Google Maps inside the page and keeps directions secondary", () => {
    expect(mapSource).toContain("www.google.com/maps?q=");
    expect(mapSource).toContain("output=embed");
    expect(mapSource).toContain("Itinéraire vers le lieu");
  });

  it("restricts top-level WebView navigation to Google HTTPS domains", () => {
    expect(mapSource).toContain("isGoogleMapsNavigation");
    expect(mapSource).toContain('url.protocol === "https:"');
    expect(mapSource).toContain("onShouldStartLoadWithRequest");
  });

  it("is rendered on event and ticket detail screens", () => {
    expect(eventSource).toContain(
      "<EmbeddedGoogleMap location={eventLocation}",
    );
    expect(ticketSource).toContain("<EmbeddedGoogleMap");
    expect(ticketSource).toContain("showMap={i === activeIndex}");
  });
});

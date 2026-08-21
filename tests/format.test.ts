import { describe, expect, it } from "vitest";

import { decodeHtmlEntities, stripHtml } from "../lib/format";

describe("WordPress text formatting", () => {
  it("decodes named typographic entities used in event content", () => {
    expect(
      decodeHtmlEntities(
        "L&rsquo;artiste &ndash; &ldquo;en scène&rdquo;&hellip;",
      ),
    ).toBe("L’artiste – “en scène”…");
  });

  it("strips markup and decodes entities in rendered content", () => {
    expect(
      stripHtml("<p>L&amp;rsquo;événement &amp;amp; ses invités</p>"),
    ).toBe("L’événement & ses invités");
  });
});

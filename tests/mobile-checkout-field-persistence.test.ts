import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const commerce = fs.readFileSync(
  path.join(root, "scripts/lamako-mobile-api/includes/v2-commerce.php"),
  "utf8",
);

describe("native checkout custom field persistence", () => {
  it("validates one attendee payload per custom-form ticket", () => {
    expect(commerce).toContain(
      "function lamako_mobile_v2_validate_checkout_attendees",
    );
    expect(commerce).toContain("lamako_v2_attendee_count_invalid");
    expect(commerce).toContain("lamako_v2_checkout_field_required");
    expect(commerce).toContain("$attendee['fields']");
  });

  it("persists answers for WooCommerce, Tickera and issued tickets", () => {
    expect(commerce).toContain(
      "function lamako_mobile_v2_persist_checkout_field_answers",
    );
    expect(commerce).toContain("'_lamako_mobile_attendees'");
    expect(commerce).toContain("'_lamako_pos_attendees'");
    expect(commerce).toContain("$cart_info['owner_data'] = $owner_data");
    expect(commerce).toContain(
      "$order->update_meta_data( 'tc_cart_info', $cart_info, (int) $meta->id )",
    );
    expect(commerce).toContain("$order->save_meta_data()");
    expect(commerce).toContain(
      "$attendees = $item->get_meta( '_lamako_mobile_attendees' )",
    );
    expect(commerce).toContain(
      "update_post_meta( (int) $instance_id, $storage_key, $value )",
    );
  });
});

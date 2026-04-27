const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";

export interface TicketInfo {
  ticket_id: string;
  ticket_code: string;
  ticket_type: string;
  event_name: string;
  buyer_name: string;
  buyer_email: string;
  seat_label?: string;
  checked_in: boolean;
  check_in_date?: string;
}

export interface CheckInResult {
  success: boolean;
  message: string;
  ticket?: TicketInfo;
  status: "valid" | "already_checked" | "invalid" | "error";
}

/**
 * Check in a ticket via Tickera API
 * Uses the Tickera Check-in API endpoint
 */
export async function checkInTicket(ticketCode: string, apiKey: string): Promise<CheckInResult> {
  try {
    const res = await fetch(`${SITE_URL}/wp-json/tc/v1/checkin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TC-API-Key": apiKey,
      },
      body: JSON.stringify({ ticket_code: ticketCode }),
    });

    if (!res.ok) {
      // Try alternative Tickera check-in endpoint
      return checkInViaAlternate(ticketCode, apiKey);
    }

    const data = await res.json();
    return {
      success: data.pass || false,
      message: data.message || "Check-in effectué",
      status: data.pass ? "valid" : data.already_checked ? "already_checked" : "invalid",
      ticket: data.ticket_info,
    };
  } catch {
    return checkInViaAlternate(ticketCode, apiKey);
  }
}

/**
 * Alternative check-in via WP AJAX (Tickera's native method)
 */
async function checkInViaAlternate(ticketCode: string, apiKey: string): Promise<CheckInResult> {
  try {
    const formData = new FormData();
    formData.append("action", "tc_check_in");
    formData.append("api_key", apiKey);
    formData.append("ticket_code", ticketCode);

    const res = await fetch(`${SITE_URL}/wp-admin/admin-ajax.php`, {
      method: "POST",
      body: formData,
    });

    const text = await res.text();
    // Tickera returns "pass|ticket_id|..." or "fail|reason"
    const parts = text.split("|");

    if (parts[0] === "pass") {
      return {
        success: true,
        message: "Check-in réussi",
        status: "valid",
      };
    } else if (text.includes("already")) {
      return {
        success: false,
        message: "Billet déjà scanné",
        status: "already_checked",
      };
    } else {
      return {
        success: false,
        message: "Billet invalide",
        status: "invalid",
      };
    }
  } catch (err) {
    return {
      success: false,
      message: "Erreur de connexion",
      status: "error",
    };
  }
}

/**
 * Get ticket info without checking in
 */
export async function getTicketInfo(ticketCode: string, token: string): Promise<TicketInfo | null> {
  try {
    const formData = new FormData();
    formData.append("action", "tc_get_ticket_info");
    formData.append("ticket_code", ticketCode);

    const res = await fetch(`${SITE_URL}/wp-admin/admin-ajax.php`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * Get all tickets for an event (for participant list)
 */
export async function getEventTickets(eventId: number, token: string): Promise<any[]> {
  try {
    const res = await fetch(`${SITE_URL}/wp-json/wp/v2/tc_tickets?meta_key=event_id&meta_value=${eventId}&per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

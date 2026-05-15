const SITE = process.env.LAMAKO_SITE_URL || 'https://www.ticketbylamako.com';
const JWT = process.env.LAMAKO_MOBILE_JWT || '';

async function readJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

async function main() {
  console.log('=== Public Tickera tickets ===');
  const ticketUrl = `${SITE}/wp-json/wp/v2/tc_tickets?per_page=5`;
  const { res: ticketRes, data: ticketData } = await readJson(ticketUrl);
  console.log('Status:', ticketRes.status);

  if (ticketRes.ok && Array.isArray(ticketData)) {
    for (const ticket of ticketData) {
      console.log('Ticket #' + ticket.id, 'title:', ticket.title?.rendered, 'slug:', ticket.slug);
      if (ticket.meta) {
        for (const [key, value] of Object.entries(ticket.meta)) {
          console.log('  ' + key + ':', JSON.stringify(value).substring(0, 200));
        }
      }
      console.log('---');
    }
  } else {
    console.log('Response:', JSON.stringify(ticketData).substring(0, 500));
  }

  console.log('\n=== Mobile v2 orders/tickets ===');
  if (!JWT) {
    console.log('Skipped: set LAMAKO_MOBILE_JWT to inspect authenticated v2 order/ticket data.');
    return;
  }

  const orderUrl = `${SITE}/wp-json/lamako-mobile/v2/orders?limit=10`;
  const { res: orderRes, data: orderData } = await readJson(orderUrl, {
    headers: { Authorization: `Bearer ${JWT}`, Accept: 'application/json' },
  });
  console.log('Status:', orderRes.status);

  if (!orderRes.ok || !Array.isArray(orderData?.orders)) {
    console.log('Response:', JSON.stringify(orderData).substring(0, 500));
    return;
  }

  for (const order of orderData.orders) {
    console.log(`Order #${order.number || order.id}: ${order.status}, ticketsReady=${order.ticketsReady}`);
    const ticketsUrl = `${SITE}/wp-json/lamako-mobile/v2/orders/${order.id}/tickets`;
    const { res: ticketsRes, data: ticketsData } = await readJson(ticketsUrl, {
      headers: { Authorization: `Bearer ${JWT}`, Accept: 'application/json' },
    });
    if (ticketsRes.ok) {
      console.log('  tickets:', JSON.stringify(ticketsData?.tickets || []).substring(0, 800));
    } else {
      console.log('  tickets error:', ticketsRes.status, JSON.stringify(ticketsData).substring(0, 300));
    }
  }
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});

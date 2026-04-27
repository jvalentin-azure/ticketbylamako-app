const SITE = 'https://www.ticketbylamako.com';
const CK = process.env.EXPO_PUBLIC_WC_CONSUMER_KEY || '';
const CS = process.env.EXPO_PUBLIC_WC_CONSUMER_SECRET || '';

async function main() {
  // Get Tickera tickets via WP REST API
  const url = `${SITE}/wp-json/wp/v2/tc_tickets?per_page=5`;
  const res = await fetch(url);
  console.log('Status:', res.status);
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const t of data) {
        console.log('Ticket #' + t.id, 'title:', t.title?.rendered, 'slug:', t.slug);
        if (t.meta) {
          for (const [k, v] of Object.entries(t.meta)) {
            console.log('  ' + k + ':', JSON.stringify(v).substring(0, 200));
          }
        }
        console.log('---');
      }
    } else {
      console.log('Response:', JSON.stringify(data).substring(0, 500));
    }
  } else {
    const text = await res.text();
    console.log('Error:', text.substring(0, 300));
  }

  // Also try to get order with ticket meta
  console.log('\n=== Orders with ticket meta ===');
  const oUrl = `${SITE}/wp-json/wc/v3/orders?per_page=10&status=completed&consumer_key=${CK}&consumer_secret=${CS}`;
  const oRes = await fetch(oUrl);
  if (oRes.ok) {
    const orders = await oRes.json();
    for (const o of orders) {
      // Check order meta for ticket codes
      const tcMeta = (o.meta_data || []).filter(m => m.key.includes('tc_') || m.key.includes('ticket'));
      if (tcMeta.length > 0) {
        console.log('Order #' + o.id + ':');
        for (const m of tcMeta) {
          console.log('  ' + m.key + ' = ' + JSON.stringify(m.value).substring(0, 300));
        }
        console.log('---');
      }
      // Check line item meta
      for (const li of o.line_items) {
        const liMeta = (li.meta_data || []).filter(m => m.key.includes('tc_') || m.key.includes('ticket') || m.key.includes('Ticket'));
        if (liMeta.length > 0) {
          console.log('Order #' + o.id + ' item "' + li.name + '" qty=' + li.quantity + ':');
          for (const m of liMeta) {
            console.log('  ' + m.key + ' = ' + JSON.stringify(m.value).substring(0, 300));
          }
        }
      }
    }
  }
}

main().catch(e => console.error(e.message));

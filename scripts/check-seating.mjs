const SITE = 'https://www.ticketbylamako.com';

async function main() {
  const r = await fetch(SITE + '/tc_seat_charts/1302-radisson-blu-la-croisiere-symphonique/');
  const html = await r.text();
  
  const btnMatch = html.match(/<button[^>]*tc_seating_map_button[^>]*>[^<]*<\/button>/);
  console.log('Button:', btnMatch ? btnMatch[0] : 'NOT FOUND');
  
  const mapMatch = html.match(/<div[^>]*tc_seating_map[^>]*>/);
  console.log('Map div:', mapMatch ? mapMatch[0] : 'NOT FOUND');
  
  console.log('Has Firebase:', html.includes('firebase'));
  console.log('Has tc_seat_chart_ajax:', html.includes('tc_seat_chart_ajax'));
  console.log('Has jQuery:', html.includes('jquery'));
  
  // Now check: can we get the seat chart ID from the event?
  // We need to query WordPress for tc_seat_charts with event_name meta = event_id
  // But REST API is not available for tc_seat_charts
  // Alternative: scrape the event page for the data-seating-map-id attribute
  const r2 = await fetch(SITE + '/tc-events/test-seating-chart/');
  const html2 = await r2.text();
  const mapIdMatch = html2.match(/data-seating-map-id="(\d+)"/);
  console.log('Seating map ID from event page:', mapIdMatch ? mapIdMatch[1] : 'NOT FOUND');
  
  // Now try to get the permalink for that chart ID
  const r3 = await fetch(SITE + '/?post_type=tc_seat_charts&p=' + (mapIdMatch ? mapIdMatch[1] : '6946'), { redirect: 'follow' });
  console.log('Chart permalink resolved to:', r3.url);
}

main();

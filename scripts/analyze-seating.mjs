import axios from 'axios';

const res = await axios.get('https://www.ticketbylamako.com/?lamako_seat_embed=1&chart_id=12683', {
  headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
});

const html = res.data;

// Find the tc_seat_chart_front_ajax config
const ajaxMatch = html.match(/tc_seat_chart_front_ajax\s*=\s*(\{[\s\S]*?\});/);
console.log('Ajax config found:', !!ajaxMatch);
if (ajaxMatch) console.log('Config:', ajaxMatch[1].substring(0, 500));

// Check for var tc_seat_chart
const varMatch = html.match(/var\s+tc_seat_chart[^=]*=\s*(\{[\s\S]*?\});/);
console.log('\nVar tc_seat_chart found:', !!varMatch);

// Check all inline scripts for seat-related config
const inlineScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
console.log('\nTotal inline scripts:', inlineScripts.length);
inlineScripts.forEach((s, i) => {
  if (s.includes('seat') || s.includes('firebase') || s.includes('tc_') || s.includes('ajax')) {
    const content = s.replace(/<\/?script[^>]*>/g, '').trim();
    if (content.length > 10) {
      console.log(`\nScript ${i} (${content.length} chars):`);
      console.log(content.substring(0, 400));
    }
  }
});

// Check for the seating chart groups (the actual seat elements)
const groupCount = (html.match(/tc-group/g) || []).length;
console.log('\ntc-group elements:', groupCount);

// Check for seat elements
const seatCount = (html.match(/tc-seat/g) || []).length;
console.log('tc-seat elements:', seatCount);

// Check for the tc_seating_map display style
const mapStyleMatch = html.match(/tc_seating_map[^"]*"[^>]*style="([^"]*)"/);
console.log('\nMap initial style:', mapStyleMatch ? mapStyleMatch[1] : 'NOT FOUND');

// Check if seats are loaded via AJAX or are in the initial HTML
const hasFirebaseConfig = html.includes('firebaseConfig') || html.includes('firebase.initializeApp');
console.log('\nFirebase config in HTML:', hasFirebaseConfig);

// Check for the seat chart data
const dataMatch = html.match(/data-seating-map-id="(\d+)"/);
console.log('Seating map ID:', dataMatch ? dataMatch[1] : 'NOT FOUND');

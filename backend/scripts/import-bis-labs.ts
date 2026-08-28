import { load } from 'cheerio';
import https from 'https';
import { supabase } from '../src/config/supabase.js';
import { geocode } from '../src/services/locationService.js';

// Simple wait helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHTML(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

async function run() {
  console.log('Starting BIS Lab import...');
  let page = 1;
  let totalFound = 0;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalGeocoded = 0;
  let totalGeocodeFailed = 0;
  const skipReasons: Record<string, number> = {};

  const allLabs = new Map<string, any>();

  while (true) {
    console.log(`Fetching page ${page}...`);
    try {
      const html = await fetchHTML(`https://lims.bis.gov.in/home/labs/?page=${page}`);
      const $ = load(html);
      const rows = $('table.customTable tbody tr');
      
      if (rows.length === 0) {
        console.log('No more rows found, ending pagination.');
        break;
      }

      rows.each((i, el) => {
        const tds = $(el).find('td');
        if (tds.length < 8) return;

        const oslCode = $(tds[1]).text().trim();
        const labName = $(tds[2]).text().trim();
        let address = $(tds[3]).text().trim();
        const validUntil = $(tds[7]).text().trim();
        
        // Clean address
        address = address.replace(/\s+/g, ' ');

        // Extract PIN code: 6 digits usually at the end of the address or near 'India - 110007'
        let pin = '';
        const pinMatch = address.match(/\b\d{6}\b/);
        if (pinMatch) {
          pin = pinMatch[0];
        }

        if (oslCode && labName) {
          allLabs.set(oslCode, { oslCode, labName, address, pin, validUntil });
          totalFound++;
        }
      });
      
      page++;
      // Since there's 20+ pages, let's not spam them
      await sleep(500); 
    } catch (err) {
      console.error(`Failed to fetch page ${page}:`, err);
      break;
    }
  }

  console.log(`Found ${totalFound} total labs on BIS, ${allLabs.size} unique by OSL Code.`);

  for (const lab of Array.from(allLabs.values())) {
    try {
      // Check existing in DB
      const { data: existing, error: errQuery } = await supabase
        .from('organizations')
        .select('*')
        .eq('type', 'Laboratory')
        .contains('metadata', { oslCode: lab.oslCode });
      
      if (errQuery) {
        console.error(`DB Error checking lab ${lab.oslCode}:`, errQuery.message);
        continue;
      }

      const existingRecord = existing && existing.length > 0 ? existing[0] : null;

      let latitude = existingRecord?.latitude || null;
      let longitude = existingRecord?.longitude || null;
      let city = existingRecord?.metadata?.city || '';
      let state = existingRecord?.metadata?.state || '';

      if (!latitude || !longitude) {
        const query = lab.pin || lab.address;
        if (query) {
          try {
            const geoResult = await geocode(query);
            if (geoResult) {
              latitude = geoResult.lat;
              longitude = geoResult.lon;
              city = geoResult.city;
              state = geoResult.state;
              totalGeocoded++;
            } else {
              totalGeocodeFailed++;
            }
          } catch (e: any) {
            console.error(`Geocode error for ${lab.oslCode}:`, e.message);
            totalGeocodeFailed++;
          }
          await sleep(1500); // LocationIQ rate limit (~ 1 requests/second usually on free tier)
        }
      }

      const metadata = {
        source: 'BIS',
        sourceUrl: 'https://lims.bis.gov.in/home/labs/',
        oslCode: lab.oslCode,
        recognitionStatus: 'Recognized',
        recognitionValidUntil: lab.validUntil,
        dataImportedAt: new Date().toISOString(),
        city,
        state
      };

      if (existingRecord) {
        // Update
        await supabase
          .from('organizations')
          .update({
            name: lab.labName,
            address: lab.address,
            postal_code: lab.pin,
            latitude,
            longitude,
            metadata: { ...existingRecord.metadata, ...metadata }
          })
          .eq('id', existingRecord.id);
      } else {
        // Insert
        await supabase
          .from('organizations')
          .insert({
            name: lab.labName,
            type: 'Laboratory',
            address: lab.address,
            postal_code: lab.pin,
            latitude,
            longitude,
            metadata
          });
      }
      totalImported++;
    } catch (e: any) {
      console.error(`Error processing lab ${lab.oslCode}:`, e);
      totalSkipped++;
      skipReasons[e.message] = (skipReasons[e.message] || 0) + 1;
    }
  }

  // Finally delete the fake demo labs
  console.log('Removing Demo Labs...');
  await supabase.from('organizations').delete().eq('name', 'Demo Labs');

  console.log('\n--- FINAL REPORT ---');
  console.log(`SOURCE RECORDS FOUND: ${totalFound}`);
  console.log(`REAL LABORATORIES IMPORTED: ${totalImported}`);
  console.log(`DUPLICATES REMOVED: ${totalFound - allLabs.size}`);
  console.log(`RECORDS SKIPPED: ${totalSkipped}`);
  console.log(`SKIP REASONS:`, skipReasons);
  console.log(`GEOCODED SUCCESS: ${totalGeocoded}`);
  console.log(`GEOCODED FAIL: ${totalGeocodeFailed}`);
}

run().catch(console.error);

export interface Landmark {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  wikiTitle: string;
  thumbnail: string | null;
  extract: string | null;
  wikiUrl: string | null;
  website: string | null;
  ticketInfo: string | null;
}

const BASE_LANDMARKS: Landmark[] = [
  { id: 1, name: 'Statue of Liberty', latitude: 40.6892, longitude: -74.0445, description: 'Iconic copper statue gifted by France, standing on Liberty Island in New York Harbor.', wikiTitle: 'Statue of Liberty', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/stli/', ticketInfo: 'Ferry + access: $24.50 (ages 13+), $12 (ages 4-12), free under 4. Ferry tickets required for all visitors.' },
  { id: 2, name: 'Grand Canyon', latitude: 36.1069, longitude: -112.1129, description: 'Steep-sided canyon carved by the Colorado River in Arizona.', wikiTitle: 'Grand Canyon', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/grca/', ticketInfo: '$35/vehicle (7 days), $30/motorcycle, $20/person (walk-in/bike). Annual passes accepted.' },
  { id: 3, name: 'White House', latitude: 38.8977, longitude: -77.0365, description: 'Official residence and workplace of the President of the United States.', wikiTitle: 'White House', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.whitehouse.gov/', ticketInfo: 'Free — tour requests must be submitted through your member of Congress up to 3 months in advance.' },
  { id: 4, name: 'Golden Gate Bridge', latitude: 37.8199, longitude: -122.4783, description: 'Suspension bridge spanning the Golden Gate strait in San Francisco.', wikiTitle: 'Golden Gate Bridge', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.goldengate.org/', ticketInfo: 'Free to walk/bike the bridge. Southbound toll: $9.25 (FasTrak), $9.75 (invoice), $10.25 (one-time payment).' },
  { id: 5, name: 'Las Vegas Strip', latitude: 36.1146, longitude: -115.1728, description: 'Famous stretch of Las Vegas Boulevard with resort casinos and entertainment.', wikiTitle: 'Las Vegas Strip', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.visitlasvegas.com/', ticketInfo: 'Free to walk. Show and attraction prices vary widely.' },
  { id: 6, name: 'Mount Rushmore', latitude: 43.8791, longitude: -103.4591, description: 'Sculpture carved into granite featuring four U.S. presidents in the Black Hills.', wikiTitle: 'Mount Rushmore', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/moru/', ticketInfo: 'Free to enter. Parking: $10/vehicle (seniors $5). Annual passes accepted.' },
  { id: 7, name: 'Yellowstone National Park', latitude: 44.4280, longitude: -110.5885, description: 'First national park in the world known for geothermal features and wildlife.', wikiTitle: 'Yellowstone National Park', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/yell/', ticketInfo: '$35/vehicle (7 days), $30/motorcycle, $20/person. Annual pass: $70.' },
  { id: 8, name: 'Walt Disney World Resort', latitude: 28.3852, longitude: -81.5639, description: 'Massive entertainment complex in Orlando with theme parks and resorts.', wikiTitle: 'Walt Disney World', thumbnail: null, extract: null, wikiUrl: null, website: 'https://disneyworld.disney.go.com/', ticketInfo: 'Starting at $109/day per park (ages 10+). Park hopper and multi-day discounts available.' },
  { id: 9, name: 'Niagara Falls', latitude: 43.0828, longitude: -79.0742, description: 'Three massive waterfalls on the Niagara River at the NY-Ontario border.', wikiTitle: 'Niagara Falls', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.niagarafallsstatepark.com/', ticketInfo: 'Free to view. Maid of the Mist boat tour: $28.25 (adults), $16.50 (children 6-12). Cave of the Winds: $19.' },
  { id: 10, name: 'Gateway Arch', latitude: 38.6247, longitude: -90.1848, description: '630-foot stainless steel arch in St. Louis commemorating westward expansion.', wikiTitle: 'Gateway Arch', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.gatewayarch.com/', ticketInfo: 'Tram ride to top: $15-19 (adults), $11-13 (children 3-15). Museum: free.' },
  { id: 11, name: 'Hollywood Sign', latitude: 34.1341, longitude: -118.3215, description: 'Famous landmark sign in the Hollywood Hills of Los Angeles.', wikiTitle: 'Hollywood Sign', thumbnail: null, extract: null, wikiUrl: null, website: 'https://hollywoodsign.org/', ticketInfo: 'Free to view from multiple vantage points. Best views from Griffith Observatory or Lake Hollywood Park.' },
  { id: 12, name: 'Space Needle', latitude: 47.6205, longitude: -122.3493, description: 'Observation tower in Seattle built for the 1962 World\'s Fair.', wikiTitle: 'Space Needle', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.spaceneedle.com/', ticketInfo: 'Day ticket: $37 (adults), $31 (seniors 65+), $28 (youth 5-12). Evening/night pricing higher.' },
  { id: 13, name: 'The Alamo', latitude: 29.4259, longitude: -98.4861, description: 'Historic Spanish mission and fortress where the 1836 battle for Texas independence took place.', wikiTitle: 'Alamo Mission in San Antonio', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.thealamo.org/', ticketInfo: 'Free to enter. Guided tours and special exhibits available for a fee.' },
  { id: 14, name: 'French Quarter', latitude: 29.9584, longitude: -90.0647, description: 'Historic New Orleans neighborhood known for nightlife, Creole cuisine, and Bourbon Street.', wikiTitle: 'French Quarter', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.neworleans.com/', ticketInfo: 'Free to walk. Street performers and bars operate on tips/covers.' },
  { id: 15, name: 'Times Square', latitude: 40.7580, longitude: -73.9855, description: 'Major commercial intersection in Midtown Manhattan known for its neon billboards.', wikiTitle: 'Times Square', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.timessquarenyc.org/', ticketInfo: 'Free to visit. TKTS booth offers discounted Broadway tickets.' },
  { id: 16, name: 'Empire State Building', latitude: 40.7484, longitude: -73.9857, description: '102-story Art Deco skyscraper in New York City.', wikiTitle: 'Empire State Building', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.esbnyc.com/', ticketInfo: '86th Floor Observatory: $44-54 (adults), $38-48 (seniors), $37-47 (children 6-12). 102nd Floor add-on: $22.' },
  { id: 17, name: 'Lincoln Memorial', latitude: 38.8893, longitude: -77.0501, description: 'Greek Revival monument honoring Abraham Lincoln on the National Mall.', wikiTitle: 'Lincoln Memorial', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/linc/', ticketInfo: 'Free to visit. Open 24 hours. Rangers on site 9:30am-10pm daily.' },
  { id: 18, name: 'Hoover Dam', latitude: 36.0156, longitude: -114.7383, description: 'Concrete arch-gravity dam on the Colorado River at the NV-AZ border.', wikiTitle: 'Hoover Dam', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.usbr.gov/lc/hooverdam/', ticketInfo: 'Visitor Center: $10. Powerplant tour: $15. Dam tour: $30. Parking: $10.' },
  { id: 19, name: 'Yosemite National Park', latitude: 37.8651, longitude: -119.5383, description: 'World-famous park in California\'s Sierra Nevada known for granite cliffs and waterfalls.', wikiTitle: 'Yosemite National Park', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/yose/', ticketInfo: '$35/vehicle (7 days), $30/motorcycle, $20/person. Reservations required in peak season.' },
  { id: 20, name: 'Alcatraz Island', latitude: 37.8267, longitude: -122.4230, description: 'Island in San Francisco Bay housing the infamous former federal prison.', wikiTitle: 'Alcatraz Island', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.nps.gov/alca/', ticketInfo: 'Ferry + tour: $41 (adults 18-61), $38.75 (seniors 62+), $25.90 (children 5-11). Book well in advance.' },
  { id: 21, name: 'Freedom Trail', latitude: 42.3591, longitude: -71.0557, description: '2.5-mile red-brick path through Boston connecting 16 historic sites.', wikiTitle: 'Freedom Trail', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.thefreedomtrail.org/', ticketInfo: 'Free to walk self-guided. Guided tours: $15 (adults), $13 (seniors/students), $8 (children 6-12).' },
  { id: 22, name: 'Grand Central Terminal', latitude: 40.7527, longitude: -73.9772, description: 'Beaux-Arts railroad terminal in Midtown Manhattan with its celestial ceiling.', wikiTitle: 'Grand Central Terminal', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.grandcentralterminal.com/', ticketInfo: 'Free to visit and explore. Guided tours available for a fee.' },
  { id: 23, name: 'Mall of America', latitude: 44.8549, longitude: -93.2422, description: 'Massive shopping mall in Bloomington, Minnesota with over 500 stores.', wikiTitle: 'Mall of America', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.mallofamerica.com/', ticketInfo: 'Free to enter. Nickelodeon Universe indoor theme park: ride pass $40+.' },
  { id: 24, name: 'Graceland', latitude: 35.0456, longitude: -90.0230, description: 'Mansion and estate of Elvis Presley in Memphis, one of the most visited private homes in America.', wikiTitle: 'Graceland', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.graceland.com/', ticketInfo: 'Mansion tour: $45-85 (adults) depending on package. VIP and combo tours available.' },
  { id: 25, name: 'Smithsonian Institution', latitude: 38.8882, longitude: -77.0264, description: 'World\'s largest museum complex in Washington, D.C. with free admission.', wikiTitle: 'Smithsonian Institution', thumbnail: null, extract: null, wikiUrl: null, website: 'https://www.si.edu/', ticketInfo: 'All Smithsonian museums are free to enter. Some special exhibits may require timed-entry passes.' },
];

let enrichedCache: Record<string, { data: Landmark[]; ts: number }> = {};
const ENRICH_TTL = 86400000; // 24 hours

async function fetchWikipediaEnrichment(wikiTitle: string): Promise<{ thumbnail: string | null; extract: string | null; wikiUrl: string | null }> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { thumbnail: null, extract: null, wikiUrl: null };
    const data = await res.json() as any;
    return {
      thumbnail: data?.thumbnail?.source || data?.originalimage?.source || null,
      extract: data?.extract || null,
      wikiUrl: data?.content_urls?.desktop?.page || null,
    };
  } catch {
    return { thumbnail: null, extract: null, wikiUrl: null };
  }
}

export async function getEnrichedLandmarks(): Promise<Landmark[]> {
  const cacheKey = 'all';
  const cached = enrichedCache[cacheKey];
  if (cached && Date.now() - cached.ts < ENRICH_TTL) return cached.data;

  const enriched = await Promise.all(
    BASE_LANDMARKS.map(async (lm) => {
      const { thumbnail, extract, wikiUrl } = await fetchWikipediaEnrichment(lm.wikiTitle);
      return { ...lm, thumbnail, extract, wikiUrl };
    })
  );

  enrichedCache[cacheKey] = { data: enriched, ts: Date.now() };
  return enriched;
}

export function filterLandmarksByBounds(landmarks: Landmark[], south: number, west: number, north: number, east: number): Landmark[] {
  return landmarks.filter(lm =>
    lm.latitude >= south && lm.latitude <= north &&
    lm.longitude >= west && lm.longitude <= east
  );
}

export async function getNearbyHotels(lat: number, lng: number, radiusKm = 20): Promise<{ name: string; distance: number; lat: number; lng: number }[]> {
  const terms = ['hotel', 'lodging', 'motel'];
  const results: Map<string, { name: string; distance: number; lat: number; lng: number }> = new Map();
  for (const term of terms) {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&lat=${lat}&lon=${lng}&limit=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = await res.json() as any;
      for (const f of (data?.features || [])) {
        const coords = f.geometry?.coordinates;
        if (!coords) continue;
        const plng = coords[0], plat = coords[1];
        const name = f.properties?.name;
        if (!name) continue;
        const key = `${plat.toFixed(4)}_${plng.toFixed(4)}`;
        if (results.has(key)) continue;
        const dlat = (plat - lat) * Math.PI / 180;
        const dlng = (plng - lng) * Math.PI / 180;
        const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(plat * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
        const dist = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
        if (dist > radiusKm) continue;
        results.set(key, { name, distance: dist, lat: plat, lng: plng });
      }
    } catch { /* skip */ }
  }
  return Array.from(results.values()).sort((a, b) => a.distance - b.distance).slice(0, 5);
}

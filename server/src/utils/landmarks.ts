export interface Landmark {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  wikiTitle: string;
  thumbnail: string | null;
}

const BASE_LANDMARKS: Landmark[] = [
  { id: 1, name: 'Statue of Liberty', latitude: 40.6892, longitude: -74.0445, description: 'Iconic copper statue gifted by France, standing on Liberty Island in New York Harbor.', wikiTitle: 'Statue of Liberty', thumbnail: null },
  { id: 2, name: 'Grand Canyon', latitude: 36.1069, longitude: -112.1129, description: 'Steep-sided canyon carved by the Colorado River in Arizona, one of the world\'s most famous natural wonders.', wikiTitle: 'Grand Canyon', thumbnail: null },
  { id: 3, name: 'White House', latitude: 38.8977, longitude: -77.0365, description: 'Official residence and workplace of the President of the United States in Washington, D.C.', wikiTitle: 'White House', thumbnail: null },
  { id: 4, name: 'Golden Gate Bridge', latitude: 37.8199, longitude: -122.4783, description: 'Suspension bridge spanning the Golden Gate strait in San Francisco, painted in its signature international orange.', wikiTitle: 'Golden Gate Bridge', thumbnail: null },
  { id: 5, name: 'Las Vegas Strip', latitude: 36.1146, longitude: -115.1728, description: 'Famous stretch of Las Vegas Boulevard lined with massive resort casinos, entertainment, and neon lights.', wikiTitle: 'Las Vegas Strip', thumbnail: null },
  { id: 6, name: 'Mount Rushmore', latitude: 43.8791, longitude: -103.4591, description: 'Sculpture carved into granite featuring the faces of four U.S. presidents in the Black Hills of South Dakota.', wikiTitle: 'Mount Rushmore', thumbnail: null },
  { id: 7, name: 'Yellowstone National Park', latitude: 44.4280, longitude: -110.5885, description: 'First national park in the world, known for geothermal features like Old Faithful and diverse wildlife.', wikiTitle: 'Yellowstone National Park', thumbnail: null },
  { id: 8, name: 'Walt Disney World Resort', latitude: 28.3852, longitude: -81.5639, description: 'Massive entertainment complex in Orlando featuring theme parks, water parks, and resorts.', wikiTitle: 'Walt Disney World', thumbnail: null },
  { id: 9, name: 'Niagara Falls', latitude: 43.0828, longitude: -79.0742, description: 'Three massive waterfalls on the Niagara River at the border between New York and Ontario.', wikiTitle: 'Niagara Falls', thumbnail: null },
  { id: 10, name: 'Gateway Arch', latitude: 38.6247, longitude: -90.1848, description: '630-foot stainless steel arch in St. Louis commemorating westward expansion of the United States.', wikiTitle: 'Gateway Arch', thumbnail: null },
  { id: 11, name: 'Hollywood Sign', latitude: 34.1341, longitude: -118.3215, description: 'Famous landmark sign in the Hollywood Hills of Los Angeles, originally reading "Hollywoodland".', wikiTitle: 'Hollywood Sign', thumbnail: null },
  { id: 12, name: 'Space Needle', latitude: 47.6205, longitude: -122.3493, description: 'Observation tower in Seattle built for the 1962 World\'s Fair, offering panoramic views of the city.', wikiTitle: 'Space Needle', thumbnail: null },
  { id: 13, name: 'The Alamo', latitude: 29.4259, longitude: -98.4861, description: 'Historic Spanish mission and fortress in San Antonio where the famous 1836 battle for Texas independence took place.', wikiTitle: 'Alamo Mission in San Antonio', thumbnail: null },
  { id: 14, name: 'French Quarter', latitude: 29.9584, longitude: -90.0647, description: 'Historic New Orleans neighborhood known for its vibrant nightlife, Creole cuisine, and Bourbon Street.', wikiTitle: 'French Quarter', thumbnail: null },
  { id: 15, name: 'Times Square', latitude: 40.7580, longitude: -73.9855, description: 'Major commercial intersection and tourist destination in Midtown Manhattan, known for its neon billboards.', wikiTitle: 'Times Square', thumbnail: null },
  { id: 16, name: 'Empire State Building', latitude: 40.7484, longitude: -73.9857, description: '102-story Art Deco skyscraper in New York City, one of the most famous buildings in the world.', wikiTitle: 'Empire State Building', thumbnail: null },
  { id: 17, name: 'Lincoln Memorial', latitude: 38.8893, longitude: -77.0501, description: 'Greek Revival monument honoring Abraham Lincoln on the National Mall in Washington, D.C.', wikiTitle: 'Lincoln Memorial', thumbnail: null },
  { id: 18, name: 'Hoover Dam', latitude: 36.0156, longitude: -114.7383, description: 'Concrete arch-gravity dam on the Colorado River at the Nevada-Arizona border, a marvel of modern engineering.', wikiTitle: 'Hoover Dam', thumbnail: null },
  { id: 19, name: 'Yosemite National Park', latitude: 37.8651, longitude: -119.5383, description: 'World-famous park in California\'s Sierra Nevada known for granite cliffs, waterfalls, and giant sequoias.', wikiTitle: 'Yosemite National Park', thumbnail: null },
  { id: 20, name: 'Alcatraz Island', latitude: 37.8267, longitude: -122.4230, description: 'Island in San Francisco Bay housing the infamous former federal prison, now a popular tourist attraction.', wikiTitle: 'Alcatraz Island', thumbnail: null },
  { id: 21, name: 'Freedom Trail', latitude: 42.3591, longitude: -71.0557, description: '2.5-mile red-brick path through Boston connecting 16 historically significant sites from the American Revolution.', wikiTitle: 'Freedom Trail', thumbnail: null },
  { id: 22, name: 'Grand Central Terminal', latitude: 40.7527, longitude: -73.9772, description: 'Beaux-Arts railroad terminal in Midtown Manhattan with its iconic celestial ceiling and grand architecture.', wikiTitle: 'Grand Central Terminal', thumbnail: null },
  { id: 23, name: 'Mall of America', latitude: 44.8549, longitude: -93.2422, description: 'Massive shopping mall in Bloomington, Minnesota featuring over 500 stores and an indoor amusement park.', wikiTitle: 'Mall of America', thumbnail: null },
  { id: 24, name: 'Graceland', latitude: 35.0456, longitude: -90.0230, description: 'Mansion and estate of Elvis Presley in Memphis, one of the most visited private homes in America.', wikiTitle: 'Graceland', thumbnail: null },
  { id: 25, name: 'Smithsonian Institution', latitude: 38.8882, longitude: -77.0264, description: 'World\'s largest museum complex in Washington, D.C. with free admission to its many galleries and exhibits.', wikiTitle: 'Smithsonian Institution', thumbnail: null },
];

let enrichedCache: Record<string, { data: Landmark[]; ts: number }> = {};
const ENRICH_TTL = 86400000; // 24 hours

async function fetchWikipediaThumbnail(wikiTitle: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.thumbnail?.source || data?.originalimage?.source || null;
  } catch {
    return null;
  }
}

export async function getEnrichedLandmarks(): Promise<Landmark[]> {
  const cacheKey = 'all';
  const cached = enrichedCache[cacheKey];
  if (cached && Date.now() - cached.ts < ENRICH_TTL) return cached.data;

  const enriched = await Promise.all(
    BASE_LANDMARKS.map(async (lm) => {
      const thumb = await fetchWikipediaThumbnail(lm.wikiTitle);
      return { ...lm, thumbnail: thumb };
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

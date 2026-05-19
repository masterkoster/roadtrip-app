import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.join(__dirname, '../data/roadtrip.db');
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log('🌱 Seeding Detroit → LA road trip...');
  const now = new Date().toISOString();

  // 1. Create demo user
  let userId: number;
  const existing = db.select().from(schema.users).where(
    sqlite.prepare('SELECT id FROM users WHERE email = ?').get('demo@roadtrip.app') ? undefined : undefined
  ).all();

  // Check if demo user exists
  const demoUser = sqlite.prepare('SELECT id FROM users WHERE email = ?').get('demo@roadtrip.app') as any;
  if (demoUser) {
    userId = demoUser.id;
    console.log('   Demo user exists, id:', userId);
  } else {
    const hash = await bcrypt.hash('demo123', 10);
    const r = sqlite.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)').run(
      'demo@roadtrip.app', hash, 'Demo Traveler', now
    );
    userId = Number(r.lastInsertRowid);
    console.log('   Created demo user, id:', userId);
  }

  // 2. Create trip
  const existingTrip = sqlite.prepare('SELECT id FROM trips WHERE title = ? AND user_id = ?').get('Motor City to LA: A Cross-Country Odyssey', userId) as any;
  let tripId: number;
  if (existingTrip) {
    tripId = existingTrip.id;
    console.log('   Trip exists, clearing old data...');
    sqlite.prepare('DELETE FROM track_points WHERE trip_id = ?').run(tripId);
    sqlite.prepare('DELETE FROM waypoints WHERE trip_id = ?').run(tripId);
    sqlite.prepare('DELETE FROM photos WHERE trip_id = ?').run(tripId);
    sqlite.prepare('DELETE FROM guide_segments WHERE guide_id IN (SELECT id FROM guides WHERE trip_id = ?)').run(tripId);
    sqlite.prepare('DELETE FROM guides WHERE trip_id = ?').run(tripId);
  }

  if (!existingTrip) {
    const r = sqlite.prepare(`INSERT INTO trips (user_id, title, description, vehicle, is_public, distance, duration, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      userId,
      'Motor City to LA: A Cross-Country Odyssey',
      'A cinematic road trip from the industrial heartland of Detroit to the sun-soaked shores of Santa Monica. Seven days, five states, and 3,600 kilometers of pure American highway.',
      'motorcycle',
      'public',
      0, 0,
      '2026-06-01T06:00:00.000Z',
      '2026-06-07T18:00:00.000Z',
      now, now
    );
    tripId = Number(r.lastInsertRowid);
    console.log('   Created trip, id:', tripId);
  } else {
    sqlite.prepare('UPDATE trips SET description = ?, vehicle = ?, updated_at = ? WHERE id = ?').run(
      'A cinematic road trip from the industrial heartland of Detroit to the sun-soaked shores of Santa Monica. Seven days, five states, and 3,600 kilometers of pure American highway.',
      'motorcycle', now, tripId
    );
    console.log('   Updated trip, id:', tripId);
  }

  // 3. Generate route control points (major cities + scenic detours)
  const routePoints: { lat: number; lng: number; elevation: number }[] = [
    // Detroit to Chicago (I-94)
    { lat: 42.3314, lng: -83.0458, elevation: 183 },
    { lat: 41.9400, lng: -83.4300, elevation: 190 },
    { lat: 41.7500, lng: -84.0500, elevation: 210 },
    { lat: 41.6600, lng: -84.8000, elevation: 230 },
    { lat: 41.6000, lng: -85.6000, elevation: 250 },
    { lat: 41.6500, lng: -86.2000, elevation: 240 },
    { lat: 41.7000, lng: -86.9000, elevation: 220 },
    { lat: 41.7500, lng: -87.3000, elevation: 190 },
    { lat: 41.8827, lng: -87.6233, elevation: 182 },  // Chicago

    // Chicago to Omaha (I-80)
    { lat: 41.8200, lng: -87.9000, elevation: 185 },
    { lat: 41.7000, lng: -88.5000, elevation: 200 },
    { lat: 41.6000, lng: -89.2000, elevation: 210 },
    { lat: 41.5500, lng: -89.8000, elevation: 215 },
    { lat: 41.5000, lng: -90.5000, elevation: 220 },
    { lat: 41.4600, lng: -90.9000, elevation: 195 },  // Quad Cities
    { lat: 41.4800, lng: -91.5000, elevation: 230 },
    { lat: 41.5000, lng: -92.0000, elevation: 245 },
    { lat: 41.5200, lng: -92.8000, elevation: 260 },
    { lat: 41.5500, lng: -93.5000, elevation: 275 },
    { lat: 41.5800, lng: -94.5000, elevation: 290 },
    { lat: 41.3000, lng: -95.2000, elevation: 310 },
    { lat: 41.2565, lng: -95.9345, elevation: 332 },  // Omaha

    // Omaha to Denver (I-76)
    { lat: 41.2000, lng: -96.3000, elevation: 340 },
    { lat: 41.1000, lng: -97.0000, elevation: 360 },
    { lat: 41.0000, lng: -97.6000, elevation: 380 },
    { lat: 40.9000, lng: -98.2000, elevation: 400 },
    { lat: 40.8000, lng: -98.8000, elevation: 430 },
    { lat: 40.7000, lng: -99.3000, elevation: 460 },
    { lat: 40.6500, lng: -100.0000, elevation: 500 },
    { lat: 40.6000, lng: -100.8000, elevation: 550 },
    { lat: 40.5500, lng: -101.6000, elevation: 620 },
    { lat: 40.5000, lng: -102.3000, elevation: 700 },
    { lat: 40.4000, lng: -103.0000, elevation: 800 },
    { lat: 40.3000, lng: -103.6000, elevation: 920 },
    { lat: 40.2000, lng: -104.2000, elevation: 1100 },
    { lat: 39.7392, lng: -104.9903, elevation: 1609 },  // Denver

    // Denver to Moab (I-70)
    { lat: 39.7000, lng: -105.2000, elevation: 1700 },
    { lat: 39.6000, lng: -105.6000, elevation: 2000 },
    { lat: 39.5500, lng: -106.0000, elevation: 2300 },
    { lat: 39.5000, lng: -106.4000, elevation: 2500 },
    { lat: 39.3500, lng: -107.0000, elevation: 2700 },
    { lat: 39.2000, lng: -107.5000, elevation: 2900 },  // Glenwood Canyon
    { lat: 39.1000, lng: -108.0000, elevation: 2800 },
    { lat: 39.0000, lng: -108.5000, elevation: 2600 },
    { lat: 38.9000, lng: -109.0000, elevation: 2400 },
    { lat: 38.8000, lng: -109.3000, elevation: 2200 },
    { lat: 38.7500, lng: -109.5000, elevation: 2000 },
    { lat: 38.6500, lng: -109.6000, elevation: 1800 },
    { lat: 38.5733, lng: -109.5498, elevation: 1500 },  // Moab

    // Moab to Las Vegas (I-15)
    { lat: 38.4500, lng: -109.7000, elevation: 1600 },
    { lat: 38.2000, lng: -110.0000, elevation: 1700 },
    { lat: 38.0000, lng: -110.4000, elevation: 1800 },
    { lat: 37.8000, lng: -110.8000, elevation: 1900 },
    { lat: 37.6000, lng: -111.2000, elevation: 2000 },
    { lat: 37.4000, lng: -111.6000, elevation: 1850 },
    { lat: 37.2000, lng: -112.0000, elevation: 1700 },
    { lat: 37.1000, lng: -112.5000, elevation: 1600 },
    { lat: 37.0000, lng: -113.0000, elevation: 1500 },
    { lat: 36.8000, lng: -113.5000, elevation: 1400 },
    { lat: 36.6000, lng: -114.0000, elevation: 1200 },
    { lat: 36.4000, lng: -114.5000, elevation: 1000 },
    { lat: 36.3000, lng: -115.0000, elevation: 800 },
    { lat: 36.1699, lng: -115.1398, elevation: 610 },  // Las Vegas

    // Vegas to LA (I-15)
    { lat: 36.0000, lng: -115.3000, elevation: 700 },
    { lat: 35.8000, lng: -115.5000, elevation: 850 },
    { lat: 35.6000, lng: -115.8000, elevation: 1000 },
    { lat: 35.4000, lng: -116.0000, elevation: 900 },
    { lat: 35.2000, lng: -116.2000, elevation: 800 },
    { lat: 35.0000, lng: -116.5000, elevation: 700 },
    { lat: 34.8000, lng: -116.8000, elevation: 600 },
    { lat: 34.6000, lng: -117.2000, elevation: 500 },
    { lat: 34.4000, lng: -117.5000, elevation: 400 },
    { lat: 34.2000, lng: -117.8000, elevation: 300 },
    { lat: 34.1000, lng: -118.0000, elevation: 200 },
    { lat: 34.0522, lng: -118.2437, elevation: 80 },   // LA
  ];

  // Interpolate track points between control points
  const trackPoints: { lat: number; lng: number; elevation: number }[] = [];
  const TOTAL_POINTS = 800;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const segments = Math.max(5, Math.floor(TOTAL_POINTS / (routePoints.length - 1)));

    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      const lat = a.lat + (b.lat - a.lat) * t + (Math.random() - 0.5) * 0.008;
      const lng = a.lng + (b.lng - a.lng) * t + (Math.random() - 0.5) * 0.008;
      const elevation = a.elevation + (b.elevation - a.elevation) * t + (Math.random() - 0.5) * 20;
      trackPoints.push({ lat, lng, elevation });
    }
  }
  // Add final point exactly
  const last = routePoints[routePoints.length - 1];
  trackPoints.push({ lat: last.lat, lng: last.lng, elevation: last.elevation });

  // Insert track points in batches
  const BATCH = 200;
  for (let i = 0; i < trackPoints.length; i += BATCH) {
    const batch = trackPoints.slice(i, i + BATCH);
    const insert = sqlite.prepare('INSERT INTO track_points (trip_id, latitude, longitude, elevation, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const tx = sqlite.transaction((points: typeof batch) => {
      for (const p of points) {
        insert.run(tripId, p.lat, p.lng, Math.round(p.elevation), new Date(Date.now() - (trackPoints.length - i) * 60000).toISOString(), now);
      }
    });
    tx(batch);
  }
  console.log(`   Inserted ${trackPoints.length} track points`);

  // Calculate approximate distance
  let totalDist = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    const dlat = (trackPoints[i].lat - trackPoints[i - 1].lat) * Math.PI / 180;
    const dlon = (trackPoints[i].lng - trackPoints[i - 1].lng) * Math.PI / 180;
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(trackPoints[i - 1].lat * Math.PI / 180) * Math.cos(trackPoints[i].lat * Math.PI / 180) * Math.sin(dlon / 2) ** 2;
    totalDist += 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  totalDist = Math.round(totalDist * 10) / 10;
  console.log(`   Route distance: ~${totalDist} km`);

  // 4. Create waypoints with descriptions
  const waypoints: { name: string; desc: string; lat: number; lng: number; order: number }[] = [
    {
      name: 'Detroit, MI',
      desc: 'The Motor City. Start at the Renaissance Center, grab a pasty at Lafayette Coney Island, and say goodbye to the Great Lakes.',
      lat: 42.3314, lng: -83.0458, order: 0,
    },
    {
      name: 'Chicago, IL',
      desc: 'The Windy City. Lake Shore Drive, deep dish at Pequod\'s, and the Bean in Millennium Park. A quick photo stop before heading west.',
      lat: 41.8827, lng: -87.6233, order: 1,
    },
    {
      name: 'Omaha, NE',
      desc: 'Heartland crossroads. The Old Market district, the Bob Kerrey Pedestrian Bridge, and the best steak you\'ll have on this trip.',
      lat: 41.2565, lng: -95.9345, order: 2,
    },
    {
      name: 'Denver, CO',
      desc: 'Mile High City. Red Rocks Amphitheatre at golden hour, a craft beer on Larimer Square, the Rockies rising behind the skyline.',
      lat: 39.7392, lng: -104.9903, order: 3,
    },
    {
      name: 'Moab, UT',
      desc: 'Red rock country. Arches National Park at sunset — Delicate Arch glowing like fire. Canyonlands, Dead Horse Point, stars like you\'ve never seen.',
      lat: 38.5733, lng: -109.5498, order: 4,
    },
    {
      name: 'Las Vegas, NV',
      desc: 'Neon oasis. The Strip at midnight, Fremont Street, a brief encounter with the surreal. Rest up — the desert crossing awaits.',
      lat: 36.1699, lng: -115.1398, order: 5,
    },
    {
      name: 'Los Angeles, CA',
      desc: 'End of the road. Santa Monica Pier, the Pacific Ocean, sunset over the water. The journey is complete.',
      lat: 34.0522, lng: -118.2437, order: 6,
    },
  ];

  const waypointIds: number[] = [];
  for (const wp of waypoints) {
    const r = sqlite.prepare('INSERT INTO waypoints (trip_id, name, description, latitude, longitude, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      tripId, wp.name, wp.desc, wp.lat, wp.lng, wp.order, now
    );
    waypointIds.push(Number(r.lastInsertRowid));
  }
  console.log(`   Inserted ${waypoints.length} waypoints`);

  // 5. Create photos for each waypoint (placeholder URLs)
  const photoUrls = [
    // Detroit
    { url: 'https://picsum.photos/seed/detroit1/800/600', thumb: 'https://picsum.photos/seed/detroit1/200/150', lat: 42.3314, lng: -83.0458, caption: 'Detroit skyline from Windsor' },
    { url: 'https://picsum.photos/seed/detroit2/800/600', thumb: 'https://picsum.photos/seed/detroit2/200/150', lat: 42.3350, lng: -83.0500, caption: 'Renaissance Center' },
    { url: 'https://picsum.photos/seed/detroit3/800/600', thumb: 'https://picsum.photos/seed/detroit3/200/150', lat: 42.3330, lng: -83.0480, caption: 'Packed and ready to go' },
    // Chicago
    { url: 'https://picsum.photos/seed/chicago1/800/600', thumb: 'https://picsum.photos/seed/chicago1/200/150', lat: 41.8827, lng: -87.6233, caption: 'The Bean at Millennium Park' },
    { url: 'https://picsum.photos/seed/chicago2/800/600', thumb: 'https://picsum.photos/seed/chicago2/200/150', lat: 41.8800, lng: -87.6240, caption: 'Chicago skyline from Lake Michigan' },
    { url: 'https://picsum.photos/seed/chicago3/800/600', thumb: 'https://picsum.photos/seed/chicago3/200/150', lat: 41.8850, lng: -87.6250, caption: 'Deep dish pizza' },
    // Omaha
    { url: 'https://picsum.photos/seed/omaha1/800/600', thumb: 'https://picsum.photos/seed/omaha1/200/150', lat: 41.2565, lng: -95.9345, caption: 'Bob Kerrey Pedestrian Bridge' },
    { url: 'https://picsum.photos/seed/omaha2/800/600', thumb: 'https://picsum.photos/seed/omaha2/200/150', lat: 41.2580, lng: -95.9300, caption: 'Old Market district' },
    // Denver
    { url: 'https://picsum.photos/seed/denver1/800/600', thumb: 'https://picsum.photos/seed/denver1/200/150', lat: 39.7392, lng: -104.9903, caption: 'Denver skyline with Rockies backdrop' },
    { url: 'https://picsum.photos/seed/denver2/800/600', thumb: 'https://picsum.photos/seed/denver2/200/150', lat: 39.6650, lng: -105.2050, caption: 'Red Rocks Amphitheatre' },
    { url: 'https://picsum.photos/seed/denver3/800/600', thumb: 'https://picsum.photos/seed/denver3/200/150', lat: 39.7500, lng: -104.9900, caption: 'Craft beer on Larimer Square' },
    // Moab
    { url: 'https://picsum.photos/seed/moab1/800/600', thumb: 'https://picsum.photos/seed/moab1/200/150', lat: 38.5733, lng: -109.5498, caption: 'Delicate Arch at sunset' },
    { url: 'https://picsum.photos/seed/moab2/800/600', thumb: 'https://picsum.photos/seed/moab2/200/150', lat: 38.6100, lng: -109.6000, caption: 'Canyonlands National Park' },
    { url: 'https://picsum.photos/seed/moab3/800/600', thumb: 'https://picsum.photos/seed/moab3/200/150', lat: 38.5700, lng: -109.5500, caption: 'Milky Way over the desert' },
    { url: 'https://picsum.photos/seed/moab4/800/600', thumb: 'https://picsum.photos/seed/moab4/200/150', lat: 38.5800, lng: -109.5400, caption: 'Motorcycle on the open road' },
    // Las Vegas
    { url: 'https://picsum.photos/seed/vegas1/800/600', thumb: 'https://picsum.photos/seed/vegas1/200/150', lat: 36.1699, lng: -115.1398, caption: 'The Strip at night' },
    { url: 'https://picsum.photos/seed/vegas2/800/600', thumb: 'https://picsum.photos/seed/vegas2/200/150', lat: 36.1700, lng: -115.1400, caption: 'Fremont Street Experience' },
    // Los Angeles
    { url: 'https://picsum.photos/seed/la1/800/600', thumb: 'https://picsum.photos/seed/la1/200/150', lat: 34.0522, lng: -118.2437, caption: 'Santa Monica Pier at sunset' },
    { url: 'https://picsum.photos/seed/la2/800/600', thumb: 'https://picsum.photos/seed/la2/200/150', lat: 34.0100, lng: -118.4900, caption: 'Pacific Coast Highway' },
    { url: 'https://picsum.photos/seed/la3/800/600', thumb: 'https://picsum.photos/seed/la3/200/150', lat: 34.0500, lng: -118.2500, caption: 'Journey complete — ocean at last' },
  ];

  for (const p of photoUrls) {
    sqlite.prepare('INSERT INTO photos (trip_id, user_id, url, thumbnail_url, latitude, longitude, caption, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      tripId, userId, p.url, p.thumb, p.lat, p.lng, p.caption, now
    );
  }
  console.log(`   Inserted ${photoUrls.length} photos`);

  // 6. Create guide with story segments
  const storySegments = [
    {
      title: 'Detroit — The Beginning',
      content: `I roll out of Detroit at dawn, the RenCen shrinking in my mirrors. The saddlebags are packed tight — three weeks of clothes, a tent, and a camera I barely know how to use.

Lafayette Coney Island was my last meal in the city. A coney dog and a coffee at 5 AM, the counterman asking where I'm headed. \"LA,\" I say. He laughs. \"That's a hell of a right turn.\"

He's not wrong.

The bike feels heavy at first, then lightens as I hit I-94 west. The sun is behind me now, the road ahead empty. This is the part they don't tell you about a cross-country trip — not the destinations, but the space between them. The hum of the engine. The way the sky opens up.`,
    },
    {
      title: 'Chicago — Deep Dish and the Bean',
      content: `Chicago hits you from miles away — a blue-glass wall rising from the prairie. I take the Lake Shore Drive exit, the water glittering on my left.

Millennium Park is packed with tourists, but I squeeze in for a photo with the Bean. A kid asks if I'm famous. \"No,\" I say, \"just hungry.\"

Pequod's on North Clybourn. Deep dish, pepperoni, extra cheese. The waitress sees my helmet and knows exactly why I'm here. \"How far you going?\" \"All the way.\" She brings me a second slice on the house.

I roll out as the streetlights flicker on. The skyline in the mirror looks like Oz.`,
    },
    {
      title: 'Omaha — Steak and the Big Sky',
      content: `The heartland is a lesson in scale. Illinois turns into Iowa turns into Nebraska, and the horizon never gets closer. Miles of corn, then soybeans, then corn again. Grain silos like cathedral spires.

Omaha appears as a cluster of low buildings on the Missouri River. The Old Market is brick and cobblestone, a remnant of the 19th century. I stop at a steakhouse that's been here since 1894. The waiter asks if I want it grilled or flame-broiled. I want it both ways.

The Bob Kerrey Bridge is a footbridge across the Missouri, curving like a ribbon. I walk it at sunset, the river gold below. Nebraska feels like a deep breath.`,
    },
    {
      title: 'Denver — Mile High',
      content: `The approach to Denver is slow — the land tilts upward, the air thins. By the time I reach the outskirts, the Rockies are a jagged line on the horizon, closer than they've been all week.

Red Rocks Amphitheatre is a geological cathedral, two massive monoliths framing a natural stage. I climb to the top row and sit. No concert tonight — just the wind through the rocks, which is music enough.

Downtown Denver is young and loud. A brewery on Larimer Square pours me a hazy IPA that tastes like grapefruit and pine. \"Where you headed?\" the bartender asks. \"Los Angeles.\" She whistles. \"Take I-70 through the mountains. You won't regret it.\"

I take her advice.`,
    },
    {
      title: 'Moab — Red Rock Cathedral',
      content: `I-70 through Colorado is the most beautiful road I've ever ridden. Glenwood Canyon, the Colorado River below, the road clinging to the cliffside. The bike carves through the curves like it was born here.

Then Utah. The earth turns red. The rocks become sculptures — arches, fins, balanced boulders. Arches National Park at sunset is a religious experience. Delicate Arch glows orange, then crimson, then fades to silhouette. I sit on a sandstone ledge and watch the stars come out, one by one.

The sky in Moab is so dark you can see the Milky Way's structure — dust lanes and all. I lay on the hood of a borrowed Jeep and just look up. Somewhere in those stars, I stop thinking about where I'm going. I'm just here.`,
    },
    {
      title: 'Las Vegas — Neon Mirage',
      content: `The road from Moab to Vegas is a descent into unreality. The red rocks fade to brown, then grey, then beige. The temperature climbs. By the time I hit the Virgin River Gorge, it's 105°F.

Then Vegas appears — a shimmering laceration on the desert floor. Fifteen miles away and already the heat shimmers with neon.

The Strip is everything you've heard and nothing you'd write home about. I park the bike at the Mirage, grab a $20 margarita, and watch the volcano erupt on schedule. It's absurd and magnificent.

Fremont Street is better — old Vegas, the neon canopy overhead, a cover band playing Journey badly. I win $40 on a slot machine and immediately spend it on a T-shirt that says \"I survived the desert.\"

One more day. The Pacific is waiting.`,
    },
    {
      title: 'Los Angeles — End of the Road',
      content: `The last leg is a pilgrimage. I-15 south through the Mojave, past the Zzyzx Road exit (I look it up later — it's the last word in the English dictionary), past the solar fields and the Joshua trees.

The smog appears before the city does — a brown haze on the horizon. But then the signs multiply: San Bernardino, Ontario, Pomona. The freeway widens to six lanes, then eight. The traffic slows to a crawl.

And then — Santa Monica. The pier. The ocean. The end of the line.

I park the bike at the end of the pier, take off my helmet, and just breathe. Salt air. Sea lions barking below. The sun is setting over the water, and I've crossed a continent.

The bike has 3,600 new kilometers on the odometer. I have a thousand new photographs, a dozen gas-station receipts, and a heart full of road.

I call my mom. \"I made it.\"

\"To where?\" she asks.

Good question. I'm still figuring out the answer.`,
    },
  ];

  let guideId: number;
  const existingGuide = sqlite.prepare('SELECT id FROM guides WHERE trip_id = ? AND title = ?').get(tripId, 'Motor City to LA: The Full Story') as any;
  if (existingGuide) {
    guideId = existingGuide.id;
    sqlite.prepare('DELETE FROM guide_segments WHERE guide_id = ?').run(guideId);
    sqlite.prepare('UPDATE guides SET description = ?, updated_at = ? WHERE id = ?').run(
      'A seven-day, seven-stop story of riding from Detroit to Los Angeles. Each chapter is a place, a meal, a memory.',
      now, guideId
    );
    console.log('   Updated existing guide');
  } else {
    const r = sqlite.prepare('INSERT INTO guides (trip_id, user_id, title, description, difficulty, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      tripId, userId, 'Motor City to LA: The Full Story',
      'A seven-day, seven-stop story of riding from Detroit to Los Angeles. Each chapter is a place, a meal, a memory.',
      'easy', 'public', now, now
    );
    guideId = Number(r.lastInsertRowid);
    console.log('   Created guide');
  }

  // Remove duplicate console.log

  for (let i = 0; i < storySegments.length; i++) {
    const seg = storySegments[i];
    sqlite.prepare('INSERT INTO guide_segments (guide_id, title, content, order_index, waypoint_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      guideId, seg.title, seg.content, i, waypointIds[i], now
    );
  }
  console.log(`   Inserted ${storySegments.length} guide segments`);

  // 7. Update trip with distance and duration
  const totalDuration = 7 * 24 * 3600; // 7 days in seconds
  sqlite.prepare('UPDATE trips SET distance = ?, duration = ?, updated_at = ? WHERE id = ?').run(
    totalDist, totalDuration, now, tripId
  );

  console.log('\n✅ Seed complete!');
  console.log(`   Trip ID: ${tripId}`);
  console.log(`   Login: demo@roadtrip.app / demo123`);
  console.log(`   ${trackPoints.length} track points, ${waypoints.length} waypoints, ${photoUrls.length} photos`);
  console.log(`   Guide with ${storySegments.length} story segments`);
}

seed().catch(console.error);

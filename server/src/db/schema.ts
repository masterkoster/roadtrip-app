import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  googleId: text('google_id').unique(),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
});

export const trips = sqliteTable('trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  distance: real('distance'),
  duration: integer('duration'),
  vehicle: text('vehicle').notNull().default('car'),
  isPublic: text('is_public').notNull().default('private'),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  userIdIdx: index('trips_user_id_idx').on(table.userId),
}));

export const trackPoints = sqliteTable('track_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  elevation: real('elevation'),
  timestamp: text('timestamp'),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  tripIdIdx: index('track_points_trip_id_idx').on(table.tripId),
}));

export const waypoints = sqliteTable('waypoints', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  tripIdIdx: index('waypoints_trip_id_idx').on(table.tripId),
}));

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  takenAt: text('taken_at'),
  caption: text('caption'),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  tripIdIdx: index('photos_trip_id_idx').on(table.tripId),
}));

export const guides = sqliteTable('guides', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  difficulty: text('difficulty').notNull().default('medium'),
  recommendedSeason: text('recommended_season'),
  estimatedDuration: integer('estimated_duration'),
  isPublic: text('is_public').notNull().default('private'),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  tripIdIdx: index('guides_trip_id_idx').on(table.tripId),
}));

export const guideSegments = sqliteTable('guide_segments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guideId: integer('guide_id').notNull().references(() => guides.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  waypointId: integer('waypoint_id').references(() => waypoints.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  guideIdIdx: index('guide_segments_guide_id_idx').on(table.guideId),
}));

export const savedTrips = sqliteTable('saved_trips', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripId: integer('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$default(() => new Date().toISOString()),
}, (table) => ({
  userIdTripIdUnique: uniqueIndex('saved_trips_user_id_trip_id_unique').on(table.userId, table.tripId),
}));

import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("fixora_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("fixora_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categoriesTable = pgTable("fixora_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull(),
  description: text("description").notNull(),
});

export const professionalProfilesTable = pgTable("fixora_professional_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  categories: text("categories").array().notNull().default([]),
  skills: text("skills").array().notNull().default([]),
  experienceYears: integer("experience_years").notNull().default(0),
  price: integer("price").notNull().default(500),
  priceType: text("price_type").notNull().default("visit"),
  serviceRadius: real("service_radius").notNull().default(10),
  bio: text("bio").notNull().default(""),
  photoUrl: text("photo_url"),
  available: boolean("available").notNull().default(false),
  verification: text("verification").notNull().default("pending"),
  rating: real("rating").notNull().default(0),
  reviewsCount: integer("reviews_count").notNull().default(0),
  completedJobs: integer("completed_jobs").notNull().default(0),
  latitude: real("latitude").notNull().default(11.0168),
  longitude: real("longitude").notNull().default(76.9558),
  area: text("area").notNull().default("Coimbatore"),
});

export const bookingsTable = pgTable("fixora_bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  professionalId: text("professional_id").notNull(),
  categoryId: text("category_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  preferredAt: timestamp("preferred_at", { withTimezone: true }).notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  status: text("status").notNull().default("requested"),
  photos: text("photos").array().notNull().default([]),
  price: integer("price"),
  toolsNote: text("tools_note"),           // professional's "tools I'll bring" note
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingPhotosTable = pgTable("fixora_booking_photos", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  photoUrl: text("photo_url").notNull(),   // kept for compatibility
  photoData: text("photo_data"),           // base64 data URL — survives free hosting
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bookingStatusEventsTable = pgTable("fixora_booking_status_events", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull(),
  status: text("status").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewsTable = pgTable("fixora_reviews", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().unique(),
  professionalId: text("professional_id").notNull(),
  customerId: text("customer_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("fixora_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  bookingId: text("booking_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

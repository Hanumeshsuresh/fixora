import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import multer from "multer";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AuthResponse,
  CreateBookingBody,
  CreateBookingResponse,
  CreateReviewBody,
  CreateReviewParams,
  CreateReviewResponse,
  GetAdminSummaryResponse,
  GetBookingParams,
  GetBookingResponse,
  GetCurrentUserResponse,
  GetDashboardResponse,
  GetProfessionalParams,
  GetProfessionalResponse,
  GetOwnProfessionalProfileResponse,
  ListAdminBookingsResponse,
  ListAdminUsersResponse,
  ListAdminProfessionalsResponse,
  ListBookingsResponse,
  ListCategoriesResponse,
  ListNotificationsResponse,
  ListProfessionalsQueryParams,
  ListProfessionalsResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  ListNotificationsResponseItem,
  SaveProfessionalProfileBody,
  SaveProfessionalProfileResponse,
  SignupBody,
  SignupResponse,
  UpdateAvailabilityBody,
  UpdateAvailabilityResponse,
  UpdateBookingStatusBody,
  UpdateBookingStatusParams,
  UpdateBookingStatusResponse,
  UpdateUserStatusBody,
  UpdateUserStatusParams,
  UpdateUserStatusResponse,
  UpdateVerificationBody,
  UpdateVerificationParams,
  UpdateVerificationResponse,
} from "@workspace/api-zod";
import {
  bookingsTable,
  bookingPhotosTable,
  bookingStatusEventsTable,
  categoriesTable,
  db,
  notificationsTable,
  professionalProfilesTable,
  reviewsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { publishNotification, subscribeToNotifications } from "../lib/fixora-events";

const router: IRouter = Router();
const uploadDir = path.resolve(process.cwd(), "uploads");
mkdirSync(uploadDir, { recursive: true });
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(new Error("Only JPG, PNG, WebP, and GIF images are supported."));
      return;
    }
    callback(null, true);
  },
});

type UserRecord = typeof usersTable.$inferSelect;
type ProfileRecord = typeof professionalProfilesTable.$inferSelect;
type BookingRecord = typeof bookingsTable.$inferSelect;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requestCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const prefix = `${name}=`;
  for (const item of raw.split(";")) {
    const part = item.trim();
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

function setSessionCookie(res: Response, token: string, maxAgeSeconds?: number): void {
  const attributes = [
    `fixora_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (maxAgeSeconds) attributes.push(`Max-Age=${maxAgeSeconds}`);
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", "fixora_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

async function getRequestUser(req: Request): Promise<UserRecord | null> {
  const token = requestCookie(req, "fixora_session");
  if (!token) return null;
  const [session] = await db.select().from(sessionsTable).where(
    and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date())),
  ).limit(1);
  if (!session) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  return user?.active ? user : null;
}

async function requireUser(
  req: Request,
  res: Response,
  roles?: string[],
): Promise<UserRecord | null> {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Please sign in to continue." });
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    res.status(403).json({ error: "You do not have permission to do that." });
    return null;
  }
  return user;
}

async function startSession(user: UserRecord, res: Response, rememberMe: boolean): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const maxAgeSeconds = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  await db.insert(sessionsTable).values({
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
  });
  setSessionCookie(res, token, rememberMe ? maxAgeSeconds : undefined);
}

function toUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as "customer" | "professional" | "admin",
    active: user.active,
    photoUrl: user.photoUrl,
  };
}

function toProfessional(profile: ProfileRecord, user: UserRecord, distance: number | null = null) {
  return {
    id: user.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    categories: profile.categories ?? [],
    skills: profile.skills ?? [],
    experienceYears: profile.experienceYears,
    price: profile.price,
    priceType: profile.priceType as "visit" | "hour",
    serviceRadius: profile.serviceRadius,
    bio: profile.bio,
    photoUrl: profile.photoUrl ?? user.photoUrl,
    available: profile.available,
    verification: profile.verification as "pending" | "verified" | "rejected",
    rating: profile.rating,
    reviewsCount: profile.reviewsCount,
    completedJobs: profile.completedJobs,
    latitude: profile.latitude,
    longitude: profile.longitude,
    area: profile.area,
    distance,
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function professionalPair(userId: string): Promise<{ profile: ProfileRecord; user: UserRecord } | null> {
  const [profile] = await db.select().from(professionalProfilesTable)
    .where(eq(professionalProfilesTable.userId, userId)).limit(1);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return profile && user ? { profile, user } : null;
}

async function bookingResponse(booking: BookingRecord) {
  const [[customer], [professional], [category], photoRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, booking.professionalId)).limit(1),
    db.select().from(categoriesTable).where(eq(categoriesTable.id, booking.categoryId)).limit(1),
    db.select().from(bookingPhotosTable).where(eq(bookingPhotosTable.bookingId, booking.id))
      .orderBy(bookingPhotosTable.createdAt),
  ]);
  return {
    id: booking.id,
    customerId: booking.customerId,
    professionalId: booking.professionalId,
    customerName: customer?.name ?? "Customer",
    professionalName: professional?.name ?? "Professional",
    categoryId: booking.categoryId,
    categoryName: category?.name ?? "Service",
    title: booking.title,
    description: booking.description,
    preferredAt: booking.preferredAt.toISOString(),
    address: booking.address,
    latitude: booking.latitude,
    longitude: booking.longitude,
    status: booking.status as "requested" | "accepted" | "on_the_way" | "in_progress" | "completed" | "declined" | "cancelled",
    photos: photoRows.length ? photoRows.map((photo) => photo.photoUrl) : booking.photos ?? [],
    price: booking.price,
    createdAt: booking.createdAt.toISOString(),
  };
}

async function notifyUser(userId: string, type: string, title: string, message: string, bookingId: string | null) {
  const [created] = await db.insert(notificationsTable).values({
    id: randomUUID(),
    userId,
    type,
    title,
    message,
    bookingId,
    read: false,
  }).returning();
  const notification = ListNotificationsResponseItem.parse({
    id: created.id,
    type: created.type,
    title: created.title,
    message: created.message,
    bookingId: created.bookingId,
    read: created.read,
    createdAt: created.createdAt.toISOString(),
  });
  publishNotification(userId, notification);
  return notification;
}

async function userBookings(user: UserRecord): Promise<BookingRecord[]> {
  const rows = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
  if (user.role === "admin") return rows;
  if (user.role === "professional") return rows.filter((item) => item.professionalId === user.id);
  return rows.filter((item) => item.customerId === user.id);
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  const id = randomUUID();
  const [created] = await db.insert(usersTable).values({
    id,
    name: parsed.data.name.trim(),
    email,
    phone: parsed.data.phone.trim(),
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
    role: parsed.data.role,
    active: true,
    photoUrl: null,
  }).returning();
  if (created.role === "professional") {
    await db.insert(professionalProfilesTable).values({
      id: randomUUID(),
      userId: id,
      categories: [],
      skills: [],
      experienceYears: 0,
      price: 500,
      priceType: "visit",
      serviceRadius: 10,
      bio: "",
      available: false,
      verification: "pending",
      rating: 0,
      reviewsCount: 0,
      completedJobs: 0,
      latitude: 11.0168,
      longitude: 76.9558,
      area: "Coimbatore",
    });
  }
  await startSession(created, res, true);
  res.status(201).json(SignupResponse.parse({ user: toUser(created) }));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.trim().toLowerCase())).limit(1);
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  await startSession(user, res, parsed.data.rememberMe ?? false);
  res.json(LoginResponse.parse({ user: toUser(user) }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(GetCurrentUserResponse.parse(toUser(user)));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = requestCookie(req, "fixora_session");
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  }
  clearSessionCookie(res);
  res.json(LogoutResponse.parse({ ok: true }));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(rows));
});

router.get("/professionals", async (req, res): Promise<void> => {
  const parsed = ListProfessionalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const query = parsed.data;
  const pairs = await db.select({ profile: professionalProfilesTable, user: usersTable })
    .from(professionalProfilesTable)
    .innerJoin(usersTable, eq(professionalProfilesTable.userId, usersTable.id));
  let results = pairs
    .filter(({ profile, user }) => user.active && profile.verification === "verified")
    .map(({ profile, user }) => {
      const distance = query.latitude !== undefined && query.longitude !== undefined
        ? haversineKm(query.latitude, query.longitude, profile.latitude, profile.longitude)
        : null;
      return { profile, user, professional: toProfessional(profile, user, distance) };
    })
    .filter(({ profile, professional }) => {
      if (query.categoryId && !profile.categories.includes(query.categoryId)) return false;
      if (query.minRating !== undefined && professional.rating < query.minRating) return false;
      if (query.maxDistance !== undefined && professional.distance !== null && professional.distance > query.maxDistance) return false;
      if (query.query) {
        const needle = query.query.toLowerCase();
        const text = [professional.name, professional.area, professional.bio, ...professional.skills].join(" ").toLowerCase();
        if (!text.includes(needle)) return false;
      }
      return true;
    });
  const sort = query.sort ?? "distance";
  results.sort((a, b) => {
    if (sort === "rating") return b.professional.rating - a.professional.rating;
    if (sort === "price") return a.professional.price - b.professional.price;
    if (sort === "availability") return Number(b.professional.available) - Number(a.professional.available);
    return (a.professional.distance ?? Number.MAX_SAFE_INTEGER) - (b.professional.distance ?? Number.MAX_SAFE_INTEGER);
  });
  res.json(ListProfessionalsResponse.parse(results.map(({ professional }) => professional)));
});

router.get("/professionals/:id", async (req, res): Promise<void> => {
  const parsed = GetProfessionalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const pair = await professionalPair(parsed.data.id);
  if (!pair || !pair.user.active) {
    res.status(404).json({ error: "Professional not found." });
    return;
  }
  const reviewRows = await db.select().from(reviewsTable)
    .where(eq(reviewsTable.professionalId, pair.user.id)).orderBy(desc(reviewsTable.createdAt));
  const reviews = await Promise.all(reviewRows.map(async (review) => {
    const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, review.customerId)).limit(1);
    return {
      id: review.id,
      bookingId: review.bookingId,
      customerName: customer?.name ?? "Customer",
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }));
  res.json(GetProfessionalResponse.parse({ ...toProfessional(pair.profile, pair.user), reviews }));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const bookings = await userBookings(user);
  const [unread] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)));
  const ownBookings = user.role === "customer" ? bookings.filter((item) => item.customerId === user.id) : [];
  const professionalBookings = user.role === "professional" ? bookings : [];
  const completed = professionalBookings.filter((item) => item.status === "completed");
  const [[profile], reviewStats] = await Promise.all([
    db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, user.id)).limit(1),
    db.select({ average: sql<number>`coalesce(avg(${reviewsTable.rating}), 0)::float` }).from(reviewsTable)
      .where(eq(reviewsTable.professionalId, user.id)),
  ]);
  const result = {
    user: toUser(user),
    bookings: await Promise.all(ownBookings.map(bookingResponse)),
    incomingBookings: await Promise.all(professionalBookings.map(bookingResponse)),
    unreadNotifications: unread?.count ?? 0,
    totalEarnings: completed.reduce((sum, item) => sum + (item.price ?? 0), 0),
    completedJobs: profile?.completedJobs ?? completed.length,
    averageRating: Number(reviewStats[0]?.average ?? profile?.rating ?? 0),
  };
  res.json(GetDashboardResponse.parse(result));
});

router.get("/bookings", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await userBookings(user);
  res.json(ListBookingsResponse.parse(await Promise.all(rows.map(bookingResponse))));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["customer"]);
  if (!user) return;
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profilePair = await professionalPair(parsed.data.professionalId);
  const [category] = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.id, parsed.data.categoryId)).limit(1);
  if (!profilePair || !profilePair.user.active || profilePair.profile.verification !== "verified" || !category) {
    res.status(400).json({ error: "Choose an active verified professional and a valid category." });
    return;
  }
  const [booking] = await db.insert(bookingsTable).values({
    id: randomUUID(),
    customerId: user.id,
    professionalId: profilePair.user.id,
    categoryId: parsed.data.categoryId,
    title: parsed.data.title.trim(),
    description: parsed.data.description.trim(),
    preferredAt: new Date(parsed.data.preferredAt),
    address: parsed.data.address.trim(),
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    status: "requested",
    photos: [],
    price: profilePair.profile.price,
  }).returning();
  if (parsed.data.photos.length) {
    await db.insert(bookingPhotosTable).values(parsed.data.photos.slice(0, 5).map((photoUrl) => ({
      id: randomUUID(),
      bookingId: booking.id,
      photoUrl,
    })));
  }
  await db.insert(bookingStatusEventsTable).values({
    id: randomUUID(),
    bookingId: booking.id,
    status: "requested",
    label: "Request sent",
  });
  await notifyUser(
    profilePair.user.id,
    "booking_request",
    "New service request",
    `${user.name} requested ${category.name.toLowerCase()} service: ${booking.title}`,
    booking.id,
  );
  res.status(201).json(CreateBookingResponse.parse(await bookingResponse(booking)));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = GetBookingParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, parsed.data.id)).limit(1);
  if (!booking || (user.role !== "admin" && booking.customerId !== user.id && booking.professionalId !== user.id)) {
    res.status(404).json({ error: "Booking not found." });
    return;
  }
  const events = await db.select().from(bookingStatusEventsTable)
    .where(eq(bookingStatusEventsTable.bookingId, booking.id)).orderBy(bookingStatusEventsTable.createdAt);
  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.bookingId, booking.id)).limit(1);
  const [customer] = review
    ? await db.select().from(usersTable).where(eq(usersTable.id, review.customerId)).limit(1)
    : [undefined];
  const response = {
    ...(await bookingResponse(booking)),
    statusHistory: events.map((event) => ({
      status: event.status,
      label: event.label,
      createdAt: event.createdAt.toISOString(),
    })),
    ...(review ? {
      review: {
        id: review.id,
        bookingId: review.bookingId,
        customerName: customer?.name ?? "Customer",
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      },
    } : {}),
  };
  res.json(GetBookingResponse.parse(response));
});

router.patch("/bookings/:id/status", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = UpdateBookingStatusParams.safeParse(req.params);
  const body = UpdateBookingStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request." });
    return;
  }
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id)).limit(1);
  if (!booking) {
    res.status(404).json({ error: "Booking not found." });
    return;
  }
  const nextStatus = body.data.status;
  const professionalTransitions: Record<string, string[]> = {
    requested: ["accepted", "declined"],
    accepted: ["on_the_way"],
    on_the_way: ["in_progress"],
    in_progress: ["completed"],
  };
  const customerTransitions: Record<string, string[]> = {
    requested: ["cancelled"],
    accepted: ["cancelled"],
  };
  const allowed = user.role === "professional" && booking.professionalId === user.id
    ? professionalTransitions[booking.status] ?? []
    : user.role === "customer" && booking.customerId === user.id
      ? customerTransitions[booking.status] ?? []
      : [];
  if (!allowed.includes(nextStatus)) {
    res.status(403).json({ error: "This status update is not allowed for your account." });
    return;
  }
  const [updated] = await db.update(bookingsTable).set({ status: nextStatus })
    .where(eq(bookingsTable.id, booking.id)).returning();
  const labels: Record<string, string> = {
    accepted: "Professional accepted",
    declined: "Request declined",
    on_the_way: "Professional is on the way",
    in_progress: "Work started",
    completed: "Job completed",
    cancelled: "Booking cancelled",
  };
  await db.insert(bookingStatusEventsTable).values({
    id: randomUUID(),
    bookingId: booking.id,
    status: nextStatus,
    label: labels[nextStatus],
  });
  const [professional] = await db.select().from(usersTable).where(eq(usersTable.id, booking.professionalId)).limit(1);
  const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, booking.customerId)).limit(1);
  const target = user.role === "professional" ? booking.customerId : booking.professionalId;
  const targetName = user.role === "professional" ? professional?.name : customer?.name;
  await notifyUser(target, `booking_${nextStatus}`, labels[nextStatus], `${targetName ?? "Your service partner"} updated “${booking.title}”.`, booking.id);
  res.json(UpdateBookingStatusResponse.parse(await bookingResponse(updated)));
});

router.post("/bookings/:id/review", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["customer"]);
  if (!user) return;
  const params = CreateReviewParams.safeParse(req.params);
  const body = CreateReviewBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request." });
    return;
  }
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id)).limit(1);
  if (!booking || booking.customerId !== user.id || booking.status !== "completed") {
    res.status(400).json({ error: "Only the customer can review a completed booking." });
    return;
  }
  const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.bookingId, booking.id)).limit(1);
  if (existing) {
    res.status(409).json({ error: "A review has already been added for this booking." });
    return;
  }
  const [review] = await db.insert(reviewsTable).values({
    id: randomUUID(),
    bookingId: booking.id,
    professionalId: booking.professionalId,
    customerId: user.id,
    rating: body.data.rating,
    comment: body.data.comment.trim(),
  }).returning();
  const [average] = await db.select({
    rating: sql<number>`coalesce(avg(${reviewsTable.rating}), 0)::float`,
    count: sql<number>`count(*)::int`,
  }).from(reviewsTable).where(eq(reviewsTable.professionalId, booking.professionalId));
  await db.update(professionalProfilesTable).set({
    rating: Number(average.rating),
    reviewsCount: Number(average.count),
  }).where(eq(professionalProfilesTable.userId, booking.professionalId));
  await notifyUser(
    booking.professionalId,
    "new_review",
    "You received a review",
    `${user.name} left a ${body.data.rating}-star review.`,
    booking.id,
  );
  res.status(201).json(CreateReviewResponse.parse({
    id: review.id,
    bookingId: review.bookingId,
    customerName: user.name,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  }));
});

router.post("/uploads", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  upload.array("photos", 5)(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : "Unable to upload these images.";
      res.status(400).json({ error: message });
      return;
    }
    const files = (req.files ?? []) as Express.Multer.File[];
    if (!files.length) {
      res.status(400).json({ error: "Choose at least one photo." });
      return;
    }
    res.status(201).json({
      photos: files.map((file) => `/api/uploads/${encodeURIComponent(file.filename)}`),
    });
  });
});

router.get("/notifications", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt)).limit(100);
  const result = rows.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    bookingId: notification.bookingId,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  }));
  res.json(ListNotificationsResponse.parse(result));
});

router.get("/notifications/stream", async (req, res): Promise<void> => {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).end();
    return;
  }
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 3000\n\n");
  const unsubscribe = subscribeToNotifications(user.id, res);
  const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [notification] = await db.update(notificationsTable).set({ read: true })
    .where(and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, user.id)))
    .returning();
  if (!notification) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }
  res.json(MarkNotificationReadResponse.parse({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    bookingId: notification.bookingId,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  }));
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const changed = await db.update(notificationsTable).set({ read: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.read, false)))
    .returning({ id: notificationsTable.id });
  res.json(MarkAllNotificationsReadResponse.parse({ count: changed.length }));
});

router.get("/professional/profile", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["professional"]);
  if (!user) return;
  const pair = await professionalPair(user.id);
  if (!pair) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  res.json(GetOwnProfessionalProfileResponse.parse(toProfessional(pair.profile, pair.user)));
});

router.put("/professional/profile", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["professional"]);
  if (!user) return;
  const parsed = SaveProfessionalProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [saved] = await db.update(professionalProfilesTable).set({
    categories: parsed.data.categories,
    skills: parsed.data.skills,
    experienceYears: parsed.data.experienceYears,
    price: parsed.data.price,
    priceType: parsed.data.priceType,
    serviceRadius: parsed.data.serviceRadius,
    bio: parsed.data.bio,
    photoUrl: parsed.data.photoUrl ?? null,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    area: parsed.data.area,
  }).where(eq(professionalProfilesTable.userId, user.id)).returning();
  res.json(SaveProfessionalProfileResponse.parse(toProfessional(saved, user)));
});

router.patch("/professional/availability", async (req, res): Promise<void> => {
  const user = await requireUser(req, res, ["professional"]);
  if (!user) return;
  const parsed = UpdateAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [saved] = await db.update(professionalProfilesTable).set({ available: parsed.data.available })
    .where(eq(professionalProfilesTable.userId, user.id)).returning();
  if (!saved) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  res.json(UpdateAvailabilityResponse.parse(toProfessional(saved, user)));
});

router.get("/admin/summary", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [professionalCount] = await db.select({ count: sql<number>`count(*)::int` }).from(professionalProfilesTable);
  const [bookingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(bookingsTable);
  const [pendingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(professionalProfilesTable)
    .where(eq(professionalProfilesTable.verification, "pending"));
  const groups = await db.select({
    name: categoriesTable.name,
    count: sql<number>`count(${bookingsTable.id})::int`,
  }).from(categoriesTable).leftJoin(bookingsTable, eq(categoriesTable.id, bookingsTable.categoryId))
    .groupBy(categoriesTable.id, categoriesTable.name);
  res.json(GetAdminSummaryResponse.parse({
    users: userCount.count,
    professionals: professionalCount.count,
    bookings: bookingCount.count,
    pendingVerification: pendingCount.count,
    categories: groups,
  }));
});

router.get("/admin/professionals", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const pairs = await db.select({ profile: professionalProfilesTable, user: usersTable })
    .from(professionalProfilesTable)
    .innerJoin(usersTable, eq(professionalProfilesTable.userId, usersTable.id));
  res.json(ListAdminProfessionalsResponse.parse(
    pairs.filter(({ user }) => user.active).map(({ profile, user }) => toProfessional(profile, user)),
  ));
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(ListAdminUsersResponse.parse(users.map(toUser)));
});

router.patch("/admin/professionals/:id/verification", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const params = UpdateVerificationParams.safeParse(req.params);
  const body = UpdateVerificationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request." });
    return;
  }
  const [profile] = await db.update(professionalProfilesTable).set({
    verification: body.data.verification,
  }).where(eq(professionalProfilesTable.userId, params.data.id)).returning();
  const [professional] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id)).limit(1);
  if (!profile || !professional) {
    res.status(404).json({ error: "Professional profile not found." });
    return;
  }
  if (body.data.verification === "verified") {
    await notifyUser(
      professional.id,
      "verification_approved",
      "Your profile is verified",
      "Your Fixora professional profile is now verified and ready to receive requests.",
      null,
    );
  }
  res.json(UpdateVerificationResponse.parse(toProfessional(profile, professional)));
});

router.get("/admin/bookings", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const rows = await db.select().from(bookingsTable).orderBy(desc(bookingsTable.createdAt));
  res.json(ListAdminBookingsResponse.parse(await Promise.all(rows.map(bookingResponse))));
});

router.patch("/admin/users/:id/status", async (req, res): Promise<void> => {
  const admin = await requireUser(req, res, ["admin"]);
  if (!admin) return;
  const params = UpdateUserStatusParams.safeParse(req.params);
  const body = UpdateUserStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : !body.success ? body.error.message : "Invalid request." });
    return;
  }
  const [updated] = await db.update(usersTable).set({ active: body.data.active })
    .where(eq(usersTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json(UpdateUserStatusResponse.parse(toUser(updated)));
});

export default router;

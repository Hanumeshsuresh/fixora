import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  bookingsTable,
  bookingStatusEventsTable,
  categoriesTable,
  notificationsTable,
  professionalProfilesTable,
  reviewsTable,
  usersTable,
} from "@workspace/db";

const categorySeed = [
  { id: "electrical", name: "Electrician", icon: "zap", description: "Wiring, lights, fans and power repairs" },
  { id: "plumbing", name: "Plumber", icon: "droplets", description: "Leaks, taps, pipes and bathroom fixes" },
  { id: "carpentry", name: "Carpenter", icon: "hammer", description: "Furniture repair, fitting and woodwork" },
  { id: "mechanic", name: "Mechanic", icon: "wrench", description: "Two-wheeler and car repair at your doorstep" },
  { id: "ac", name: "AC technician", icon: "wind", description: "AC service, installation and repairs" },
];

const professionalSeed = [
  ["Arun Kumar", "electrical", "RS Puram", 11.0058, 76.9665, 780, 4.9, 86, 9],
  ["Prakash S", "plumbing", "Gandhipuram", 11.0182, 76.9674, 600, 4.8, 64, 7],
  ["Vignesh Raj", "carpentry", "Peelamedu", 11.0291, 77.0123, 850, 4.9, 51, 8],
  ["Ramesh Babu", "mechanic", "Saibaba Colony", 11.0243, 76.9498, 550, 4.7, 73, 6],
  ["Karthik M", "ac", "Singanallur", 11.0052, 77.0314, 900, 4.9, 92, 10],
  ["Suresh Kumar", "electrical", "Gandhipuram", 11.0191, 76.9712, 650, 4.8, 45, 6],
  ["Senthil Nathan", "plumbing", "Peelamedu", 11.031, 77.008, 700, 4.9, 58, 7],
  ["Mohammed Iqbal", "carpentry", "RS Puram", 11.009, 76.963, 1000, 5, 39, 11],
  ["Dinesh G", "mechanic", "Singanallur", 11.008, 77.028, 500, 4.6, 61, 5],
  ["Balaji R", "ac", "Saibaba Colony", 11.026, 76.951, 800, 4.8, 77, 9],
  ["Gokul Anand", "electrical", "Peelamedu", 11.027, 77.015, 720, 4.7, 42, 6],
  ["Naveen Kumar", "plumbing", "Singanallur", 11.003, 77.034, 580, 4.8, 53, 6],
  ["Manikandan P", "carpentry", "Gandhipuram", 11.016, 76.974, 900, 4.9, 68, 10],
  ["Rajesh V", "mechanic", "RS Puram", 11.003, 76.969, 650, 4.8, 84, 8],
  ["Sathish Kumar", "ac", "Peelamedu", 11.033, 77.011, 950, 5, 47, 7],
];

const profileCopy: Record<string, string> = {
  electrical: "Reliable home electrical repairs, installations and safety checks. I arrive on time and explain every fix.",
  plumbing: "Local plumbing specialist for leaks, fittings and urgent repairs. Clean work and clear estimates.",
  carpentry: "Careful furniture repairs, custom fittings and woodwork for homes across Coimbatore.",
  mechanic: "Doorstep two-wheeler and car service with transparent pricing and genuine parts.",
  ac: "AC installation, deep cleaning and repair for split and window units. Quick service across the city.",
};

export async function seedFixora(): Promise<void> {
  const [existingCategory] = await db.select({ id: categoriesTable.id }).from(categoriesTable).limit(1);
  if (existingCategory) return;

  await db.insert(categoriesTable).values(categorySeed);

  const demoAccounts = [
    { id: "demo-customer-1", name: "Ananya Iyer", email: "customer@fixora.demo", phone: "+91 98430 12001", role: "customer" },
    { id: "demo-customer-2", name: "Rohit Menon", email: "customer2@fixora.demo", phone: "+91 98430 12002", role: "customer" },
    { id: "demo-customer-3", name: "Meera Krishnan", email: "customer3@fixora.demo", phone: "+91 98430 12003", role: "customer" },
    { id: "demo-admin-1", name: "Fixora Admin", email: "admin@fixora.demo", phone: "+91 90000 00000", role: "admin" },
  ];
  const customerHash = await bcrypt.hash("demo1234", 10);
  const proHash = await bcrypt.hash("pro1234", 10);
  const adminHash = await bcrypt.hash("admin1234", 10);
  await db.insert(usersTable).values([
    ...demoAccounts.map((account) => ({
      ...account,
      passwordHash: account.role === "admin" ? adminHash : customerHash,
      active: true,
      photoUrl: null,
    })),
  ]);

  const proUsers: Array<{ id: string; name: string; email: string; phone: string }> = [];
  for (const [index, record] of professionalSeed.entries()) {
    const [name, categoryId, area, latitude, longitude, price, rating, completedJobs, experienceYears] = record;
    const id = `demo-professional-${index + 1}`;
    proUsers.push({
      id,
      name: String(name),
      email: `pro${String(index + 1).padStart(2, "0")}@fixora.demo`,
      phone: `+91 98430 ${String(21001 + index).slice(-5)}`,
    });
    await db.insert(usersTable).values({
      ...proUsers[index],
      passwordHash: proHash,
      role: "professional",
      active: true,
      photoUrl: null,
    });
    await db.insert(professionalProfilesTable).values({
      id: `demo-profile-${index + 1}`,
      userId: id,
      categories: [String(categoryId)],
      skills: [String(categoryId), "Same-day service", "Home visits"],
      experienceYears: Number(experienceYears),
      price: Number(price),
      priceType: "visit",
      serviceRadius: 12,
      bio: profileCopy[String(categoryId)],
      available: index % 5 !== 3,
      verification: "verified",
      rating: Number(rating),
      reviewsCount: Number(completedJobs) + 4,
      completedJobs: Number(completedJobs),
      latitude: Number(latitude),
      longitude: Number(longitude),
      area: String(area),
    });
  }

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const bookingIds = ["demo-booking-1", "demo-booking-2", "demo-booking-3"];
  const sampleBookings = [
    {
      id: bookingIds[0],
      customerId: "demo-customer-1",
      professionalId: proUsers[0].id,
      categoryId: "electrical",
      title: "Ceiling fan making a noise",
      description: "The fan in the bedroom started wobbling and making a clicking sound.",
      preferredAt: tomorrow,
      address: "RS Puram, Coimbatore",
      latitude: 11.007,
      longitude: 76.964,
      status: "requested",
      photos: [],
      price: 780,
    },
    {
      id: bookingIds[1],
      customerId: "demo-customer-2",
      professionalId: proUsers[1].id,
      categoryId: "plumbing",
      title: "Kitchen sink tap leak",
      description: "Water is dripping from the tap base even when fully closed.",
      preferredAt: nextWeek,
      address: "Gandhipuram, Coimbatore",
      latitude: 11.017,
      longitude: 76.969,
      status: "accepted",
      photos: [],
      price: 600,
    },
    {
      id: bookingIds[2],
      customerId: "demo-customer-3",
      professionalId: proUsers[4].id,
      categoryId: "ac",
      title: "AC service before summer",
      description: "The room takes a long time to cool; looking for a full service.",
      preferredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      address: "Singanallur, Coimbatore",
      latitude: 11.004,
      longitude: 77.03,
      status: "completed",
      photos: [],
      price: 900,
    },
  ];
  await db.insert(bookingsTable).values(sampleBookings);
  for (const booking of sampleBookings) {
    const now = Date.now();
    const timeline = [
      { status: "requested", label: "Request sent", createdAt: new Date(now - 4 * 86400000) },
      ...(booking.status === "accepted" ? [{ status: "accepted", label: "Professional accepted", createdAt: new Date(now - 3 * 86400000) }] : []),
      ...(booking.status === "completed" ? [
        { status: "accepted", label: "Professional accepted", createdAt: new Date(now - 3 * 86400000) },
        { status: "in_progress", label: "Work started", createdAt: new Date(now - 2 * 86400000) },
        { status: "completed", label: "Job completed", createdAt: new Date(now - 2 * 86400000 + 3600000) },
      ] : []),
    ];
    await db.insert(bookingStatusEventsTable).values(
      timeline.map((event) => ({ id: randomUUID(), bookingId: booking.id, ...event })),
    );
  }
  await db.insert(reviewsTable).values({
    id: "demo-review-1",
    bookingId: bookingIds[2],
    professionalId: proUsers[4].id,
    customerId: "demo-customer-3",
    rating: 5,
    comment: "Very professional, arrived on time and explained the service clearly.",
  });
  await db.insert(notificationsTable).values([
    {
      id: "demo-notification-pro-1",
      userId: proUsers[0].id,
      type: "booking_request",
      title: "New service request",
      message: "Ananya Iyer requested electrician service: Ceiling fan making a noise",
      bookingId: bookingIds[0],
      read: false,
    },
    {
      id: "demo-notification-customer-2",
      userId: "demo-customer-2",
      type: "booking_accepted",
      title: "Your request was accepted",
      message: "Prakash S accepted your Kitchen sink tap leak request.",
      bookingId: bookingIds[1],
      read: false,
    },
  ]);
}

/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require("bcryptjs");
const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

loadEnvConfig(process.cwd());

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();
  const storageBucket = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin configuration. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    ...(storageBucket ? { storageBucket } : {}),
  });
}

async function createAdmin() {
  try {
    const db = getFirestore(getAdminApp());
    const adminsCollection = db.collection("admins");

    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const fullName = process.env.ADMIN_FULL_NAME || "Administrator";

    const existing = await adminsCollection.get();
    const batch = db.batch();
    existing.docs.forEach((doc) => batch.delete(doc.ref));

    const hashedPassword = await bcrypt.hash(password, 10);
    const ref = adminsCollection.doc();

    batch.set(ref, {
      username,
      password: hashedPassword,
      fullName,
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await batch.commit();

    console.log("Admin created successfully!");
    console.log("ID:", ref.id);
    console.log("Username:", username);
    console.log("Password:", password);
    console.log("Role: admin");
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exitCode = 1;
  }
}

createAdmin();

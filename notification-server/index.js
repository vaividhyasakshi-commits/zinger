
import admin from "firebase-admin";

const HOST_UID = "J7Q21mlsF5NcPUJrA9llqasbt0y1";
const PARTNER_UID = "yvc9aqXcYUYTh9LcLcyAVgn3xLj1";

function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable."
    );
  }

  return JSON.parse(raw);
}

admin.initializeApp({
  credential: admin.credential.cert(loadCredentials()),
});

const db = admin.firestore();
const messaging = admin.messaging();

console.log("ZINGER notification server starting...");

const startedAt = admin.firestore.Timestamp.now();

async function countUnreadForPartner() {
  const readSnapshot = await db
    .collection("readStatus")
    .doc(PARTNER_UID)
    .get();

  const lastSeenAt = readSnapshot.data()?.lastSeenAt;

  let query = db
    .collection("messages")
    .where("role", "==", "host");

  if (lastSeenAt) {
    query = query.where("createdAt", ">", lastSeenAt);
  }

  const countSnapshot = await query.count().get();

  return countSnapshot.data().count;
}

async function sendPartnerNotification() {
  const tokenSnapshot = await db
    .collection("pushTokens")
    .doc(PARTNER_UID)
    .get();

  if (!tokenSnapshot.exists) return;

  const tokenData = tokenSnapshot.data();

  if (!tokenData?.enabled || !tokenData?.token) {
    return;
  }

  const unreadCount = await countUnreadForPartner();

  if (unreadCount <= 0) return;

  try {
    const result = await messaging.send({
      token: tokenData.token,

      data: {
        type: "beauty-offer",
        unreadCount: String(unreadCount),
      },

      webpush: {
        headers: {
          Urgency: "high",
          TTL: "3600",
        },
      },
    });

    console.log(
      "Push sent:",
      result,
      "Unread:",
      unreadCount
    );
  } catch (error) {
    console.error("FCM sending error:", error.code || error.message);

    if (
      error.code === "messaging/registration-token-not-registered" ||
      error.code === "messaging/invalid-registration-token"
    ) {
      // Remove a token that Firebase has confirmed is invalid.
      await db
        .collection("pushTokens")
        .doc(PARTNER_UID)
        .delete();
    }
  }
}

// Watch new messages created after this worker starts.
// Uses server timestamps so previously stored messages
// are not pushed again when the backend restarts.
const query = db
  .collection("messages")
  .where("createdAt", ">", startedAt)
  .orderBy("createdAt", "asc");

const unsubscribe = query.onSnapshot(
  async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type !== "added") continue;

      const message = change.doc.data();

      if (
        message.role !== "host" ||
        message.authorUid !== HOST_UID
      ) {
        continue;
      }

      console.log("New host message:", change.doc.id);

      try {
        await sendPartnerNotification();
      } catch (error) {
        console.error("Notification processing failed:", error);
      }
    }
  },
  (error) => {
    console.error("Firestore listener failed:", error);
    process.exitCode = 1;
    unsubscribe();
  }
);

process.on("SIGTERM", () => {
  unsubscribe();
  process.exit(0);
});

process.on("SIGINT", () => {
  unsubscribe();
  process.exit(0);
});

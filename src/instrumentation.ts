export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  try {
    const { prisma } = await import("./server/db");
    const { seedBaseline } = await import("./server/seed");

    let userCount: number;
    try {
      userCount = await prisma.user.count();
    } catch (dbErr: unknown) {
      const errMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
      const isMissingTable =
        errMessage.includes("does not exist") ||
        errMessage.includes("relation") ||
        errMessage.includes("P2021") ||
        (typeof dbErr === "object" &&
          dbErr !== null &&
          "code" in dbErr &&
          (dbErr as { code: string }).code === "P2021");

      if (isMissingTable) {
        console.error(
          "⚠️ Database tables missing (migrations not applied). Please run migrations first (e.g. `prisma migrate deploy`). Skipping auto-seed."
        );
      } else {
        console.error("⚠️ Failed to check database user count:", errMessage);
      }
      return;
    }

    if (userCount === 0) {
      console.log("No users found, running initial seed...");
      try {
        await seedBaseline(prisma);
      } catch (seedErr: unknown) {
        if (
          seedErr instanceof Error &&
          seedErr.message === "OWNER_PASSWORD must be set in production"
        ) {
          console.error(
            "❌ Auto-seed failed: OWNER_PASSWORD must be set in production environment. No owner was created."
          );
        } else {
          console.error("❌ Auto-seed failed:", seedErr);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error during instrumentation registration:", err);
  }
}

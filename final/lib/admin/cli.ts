import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { generateHashedPassword } from "@/lib/db/utils";

async function createAdmin(name: string, email: string, password: string) {
  try {
    const passwd = generateHashedPassword(process.env.ADMIN_PASS as string);
    console.log(passwd);
    const [newUser] = await db
      .insert(user)
      .values({
        name,
        email,
        password: passwd,
        role: "admin",
        status: "active",
      })
      .returning();

    // console.log(`Successfully created admin user: ${newUser.name}`);
    process.exit(1);
  } catch (error) {
    console.error("Failed to create admin user:", error);
  }
}

// Parse command line arguments
const [cmd, ...args] = process.argv.slice(2);
const [n, e, p] = args;

switch (cmd) {
  case "create-admin":
    if (args.length !== 3) {
      console.error(
        "Usage: pnpm run admin create-admin <name> <email> <password>"
      );
      process.exit(1);
    }
    createAdmin(n, e, p);
    break;
  default:
    console.error("Unknown command. Available commands: create-admin");
    process.exit(1);
}

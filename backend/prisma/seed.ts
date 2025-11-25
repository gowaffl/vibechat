import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Create AI friend user
  const aiUser = await prisma.user.upsert({
    where: { id: "ai-assistant" },
    update: {
      image: "/uploads/ai-assistant-avatar.jpeg",
    },
    create: {
      id: "ai-assistant",
      name: "AI Friend",
      bio: "I'm an AI friend here to help answer questions and engage in conversations!",
      image: "/uploads/ai-assistant-avatar.jpeg",
      hasCompletedOnboarding: true,
    },
  });

  console.log("AI friend user created:", aiUser);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

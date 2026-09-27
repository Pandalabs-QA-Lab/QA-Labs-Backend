const prisma = require('../src/lib/prisma');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run admin:grant -- <existing-account-email>');
  const result = await prisma.user.updateMany({
    where: { email }, data: { isPlatformAdmin: true },
  });
  if (result.count !== 1) throw new Error('Exactly one existing account is required');
  console.log(`Platform admin granted to ${email}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

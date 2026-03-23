const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const grados = await prisma.alumnoClasificado.findMany({ select: { grado: true, grupo: true }, distinct: ['grado'] });
  console.log(grados);
}

main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count25 = await prisma.alumno25_26.count();
    const count26 = await prisma.alumno26_27.count();
    const countClasificado = await prisma.alumnoClasificado.count();

    console.log('Counts:');
    console.log('25-26:', count25);
    console.log('26-27:', count26);
    console.log('Clasificado:', countClasificado);

    const sample = await prisma.alumnoClasificado.findFirst();
    console.log('Sample Clasificado:', JSON.stringify(sample, null, 2));

    const sample25 = await prisma.alumno25_26.findFirst();
    console.log('Sample 25-26:', JSON.stringify(sample25, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

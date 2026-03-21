const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const all25 = await prisma.alumno25_26.findMany({ select: { unidad: true, matricula: true } });
    const allClas = await prisma.alumnoClasificado.findMany({ select: { unidad: true, matricula: true } });

    const stats = (arr) => {
        const counts = {};
        arr.forEach(x => { counts[x.unidad] = (counts[x.unidad] || 0) + 1; });
        return counts;
    };

    console.log('Stats 25-26:', stats(all25));
    console.log('Stats Clasificado:', stats(allClas));

    if (all25.length > 0) {
        console.log('Sample 25:', all25[0]);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

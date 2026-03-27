import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function createUsers() {
  console.log('👤 Creando usuarios en Turso...');

  try {
    // Crear usuario Director General
    await client.execute({
      sql: `INSERT OR IGNORE INTO Usuario (id, email, nombre, password, rol, unidad, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: ['admin-001', 'admin@cambridge.edu.mx', 'Director General', '123456', 'DIRECTOR_GENERAL', null]
    });

    // Crear usuarios por campus
    const campuses = ['DOMINIO', 'MITRAS', 'NORTE', 'CUMBRES', 'ANAHUAC'];
    
    for (const campus of campuses) {
      const email = `${campus.toLowerCase()}@cambridge.edu.mx`;
      const id = `campus-${campus.toLowerCase()}`;
      
      await client.execute({
        sql: `INSERT OR IGNORE INTO Usuario (id, email, nombre, password, rol, unidad, createdAt, updatedAt) 
              VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [id, email, `Director ${campus}`, '123456', 'ADMIN_CAMPUS', campus]
      });
    }

    console.log('✅ Usuarios creados exitosamente');
    console.log('\n📋 Credenciales de acceso:');
    console.log('Director General: admin@cambridge.edu.mx / 123456');
    console.log('Director DOMINIO: dominio@cambridge.edu.mx / 123456');
    console.log('Director MITRAS: mitras@cambridge.edu.mx / 123456');
    console.log('Director NORTE: norte@cambridge.edu.mx / 123456');
    console.log('Director CUMBRES: cumbres@cambridge.edu.mx / 123456');
    console.log('Director ANAHUAC: anahuac@cambridge.edu.mx / 123456');
    
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    throw error;
  } finally {
    client.close();
  }
}

createUsers().catch(console.error);

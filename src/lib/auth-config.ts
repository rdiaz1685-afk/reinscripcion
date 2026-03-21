
export const DOMAIN_RESTRICTION = "@cambridgemty.edu.mx";

export const USER_ROLES: Record<string, { rol: 'DIRECTOR_GENERAL' | 'ADMIN_CAMPUS', unidad?: string }> = {
    // Administradores Generales (Vista Global + Configuración)
    "rafael.diaz@cambridgemty.edu.mx": { rol: 'DIRECTOR_GENERAL' },
    "felix.escamilla@cambridgemty.edu.mx": { rol: 'DIRECTOR_GENERAL' },

    // Campus MITRAS
    "rocio.garcia@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'MITRAS' },
    "emma.herrera@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'MITRAS' },

    // Campus CUMBRES
    "agustin.soto@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'CUMBRES' },
    "elizabeth.garcia@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'CUMBRES' },

    // Campus NORTE
    "marina.charles@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'NORTE' },
    "rgarcia@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'NORTE' },

    // Campus DOMINIO
    "mauricio.villarreal@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'DOMINIO' },
    // evers.grimaldo ya está mapeado a Cumbres arriba. 
    // Nota: Si una persona maneja dos campus, el sistema actual solo permite uno por email.
    // Podríamos ajustar la lógica si evers.grimaldo necesita ver ambos.

    // Campus ANÁHUAC
    "mayra.garza@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'ANÁHUAC' },
    "ariadna.cortina@cambridgemty.edu.mx": { rol: 'ADMIN_CAMPUS', unidad: 'ANÁHUAC' },
};

export function getAuthorizedUser(email: string | null | undefined) {
    if (!email) return null;
    const normalizedEmail = email.toLowerCase();

    // 1. Verificar dominio
    if (!normalizedEmail.endsWith(DOMAIN_RESTRICTION)) {
        return null;
    }

    // 2. Obtener rol y unidad del mapeo
    const config = USER_ROLES[normalizedEmail];
    if (!config) return null;

    return {
        email: normalizedEmail,
        ...config
    };
}

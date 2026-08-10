import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
const connectionString = process.env.DATABASE_URL?.replace("file:", "") || "prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
    const demoEmail = process.env.DEMO_EMAIL || "demo@cogniflow.app";
    const demoPassword = process.env.DEMO_PASSWORD || "Demo1234!";
    const passwordHash = await bcrypt.hash(demoPassword, 10);

    const demoUser = await prisma.user.upsert({
        where: { email: demoEmail },
        update: {},
        create: {
            email: demoEmail,
            passwordHash,
            name: "Usuario Demo",
            role: "DEMO",
        },
    });

    const existingProject = await prisma.project.findFirst({
        where: { name: "Proyecto Demo CogniFlow" },
    });

    if (!existingProject) {
        await prisma.project.create({
            data: {
                name: "Proyecto Demo CogniFlow",
                client: "Cliente Demo",
                priority: "ALTA",
                status: "DRAFT",
                ownerId: demoUser.id,
                requirements: {
                    create: [
                        {
                            externalId: "REQ-001",
                            type: "RF",
                            name: "Alta de cliente",
                            description: "El sistema debe permitir registrar un cliente.",
                        },
                        {
                            externalId: "REQ-002",
                            type: "RF",
                            name: "Validación de CUIT",
                            description:
                                "El sistema debería validar el CUIT de manera apropiada y rápida.",
                        },
                        {
                            externalId: "REQ-003",
                            type: "RN",
                            name: "CUIT inválido",
                            description: "Validación de CUIT inválido.",
                            businessRule:
                                "Si el CUIT es inválido, el sistema debe mostrar error.",
                        },
                        {
                            externalId: "REQ-004",
                            type: "SUP",
                            name: "Cliente entrega datos fiscales",
                            description: "Se asume que el cliente entrega datos fiscales.",
                            assumptions: "PENDIENTE",
                        },
                    ],
                },
                memoryInsights: {
                    create: [
                        {
                            type: "GAP_RESUELTO",
                            content:
                                "En reglas de negocio, conviene validar escenario positivo y negativo.",
                            keywords: "rn, regla, negocio, negativo, error",
                        },
                    ],
                },
            },
        });
    }

    console.log("Seed completado.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
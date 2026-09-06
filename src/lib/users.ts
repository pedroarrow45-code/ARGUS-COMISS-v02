import type { PrismaClient, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

type UserDatabase = Pick<PrismaClient, "user" | "$transaction">;

export interface BootstrapInput {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export class SetupError extends Error {
  constructor(
    public readonly code: "SETUP_COMPLETE" | "INVALID_INPUT" | "CONCURRENT_SETUP",
    message: string,
  ) {
    super(message);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateBootstrapInput(input: BootstrapInput) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (name.length < 2 || name.length > 120) {
    throw new SetupError("INVALID_INPUT", "Informe um nome entre 2 e 120 caracteres.");
  }
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SetupError("INVALID_INPUT", "Informe um e-mail válido.");
  }
  if (input.password.length < 8) {
    throw new SetupError("INVALID_INPUT", "A senha deve ter pelo menos 8 caracteres.");
  }
  if (input.password !== input.passwordConfirmation) {
    throw new SetupError("INVALID_INPUT", "A senha e a confirmação não coincidem.");
  }

  return { name, email, password: input.password };
}

export async function isSetupAvailable(db: UserDatabase = prisma): Promise<boolean> {
  return (await db.user.count()) === 0;
}

export async function bootstrapFirstAdmin(
  input: BootstrapInput,
  db: UserDatabase = prisma,
): Promise<Pick<User, "id" | "name" | "email" | "role" | "isActive">> {
  const validInput = validateBootstrapInput(input);
  if (!(await isSetupAvailable(db))) {
    throw new SetupError("SETUP_COMPLETE", "A configuração inicial já foi concluída.");
  }
  const passwordHash = await hashPassword(validInput.password);

  try {
    return await db.$transaction(
      async (transaction) => {
        if ((await transaction.user.count()) !== 0) {
          throw new SetupError("SETUP_COMPLETE", "A configuração inicial já foi concluída.");
        }

        return transaction.user.create({
          data: {
            name: validInput.name,
            email: validInput.email,
            passwordHash,
            role: "ADMIN",
            isActive: true,
          },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof SetupError) throw error;
    if (typeof error === "object" && error && "code" in error && ["P2002", "P2034"].includes(String(error.code))) {
      throw new SetupError("CONCURRENT_SETUP", "A configuração inicial já foi concluída por outra solicitação.");
    }
    throw error;
  }
}

export async function authenticateUser(email: string, password: string, db: UserDatabase = prisma) {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

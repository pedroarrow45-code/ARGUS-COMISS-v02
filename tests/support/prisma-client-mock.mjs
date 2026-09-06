export class PrismaClientKnownRequestError extends Error {
  constructor(message, { code } = {}) { super(message); this.code = code; }
}
export const Prisma = { PrismaClientKnownRequestError };

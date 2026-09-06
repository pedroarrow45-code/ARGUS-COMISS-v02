import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hashPassword, verifyPassword } from "../../src/lib/password";
import { authenticateUser, bootstrapFirstAdmin, isSetupAvailable } from "../../src/lib/users";

const validInput = {
  name: "Admin Argus",
  email: "ADMIN@EXAMPLE.COM ",
  password: "segura-123",
  passwordConfirmation: "segura-123",
};

function database(initialUsers: any[] = []) {
  const users = [...initialUsers];
  const user = {
    count: async () => users.length,
    create: async ({ data, select }: any) => {
      const created = { id: `user-${users.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
      users.push(created);
      return Object.fromEntries(Object.keys(select).map((key) => [key, created[key]]));
    },
    findUnique: async ({ where }: any) => users.find((candidate) => candidate.email === where.email) ?? null,
  };
  return {
    users,
    db: {
      user,
      $transaction: async (callback: any, options: any) => {
        assert.equal(options.isolationLevel, "Serializable");
        return callback({ user });
      },
    } as any,
  };
}

describe("bootstrap do primeiro administrador", () => {
  test("cenário 1: disponibiliza setup em banco vazio e cria o primeiro usuário", async () => {
    const { db, users } = database();
    assert.equal(await isSetupAvailable(db), true);
    const result = await bootstrapFirstAdmin(validInput, db);
    assert.equal(result.email, "admin@example.com");
    assert.equal(users.length, 1);
    assert.equal("passwordHash" in result, false);
  });

  test("cenário 2: cria ADMIN ativo com hash e permite autenticar com a senha criada", async () => {
    const { db, users } = database();
    const result = await bootstrapFirstAdmin(validInput, db);
    assert.equal(result.role, "ADMIN");
    assert.equal(result.isActive, true);
    assert.notEqual(users[0].passwordHash, validInput.password);
    assert.match(users[0].passwordHash, /^scrypt\$/);
    assert.equal(await verifyPassword(validInput.password, users[0].passwordHash), true);
    assert.equal((await authenticateUser(" ADMIN@example.com ", validInput.password, db))?.email, "admin@example.com");
    assert.equal(await authenticateUser("admin@example.com", "senha-errada", db), null);
  });

  test("cenário 3: rejeita uma segunda execução quando já existe usuário", async () => {
    const existing = { id: "existing", name: "Existing", email: "existing@example.com", passwordHash: await hashPassword("password-123"), role: "MANAGER", isActive: true };
    const { db } = database([existing]);
    await assert.rejects(() => bootstrapFirstAdmin(validInput, db), /configuração inicial já foi concluída/i);
  });

  test("cenário 4: informa ao acesso direto que setup não está mais disponível", async () => {
    const { db } = database([{ email: "existing@example.com" }]);
    assert.equal(await isSetupAvailable(db), false);
  });

  test("cenário 5: rejeita senha e confirmação diferentes", async () => {
    const { db } = database();
    await assert.rejects(() => bootstrapFirstAdmin({ ...validInput, passwordConfirmation: "outra-senha" }, db), /não coincidem/i);
  });

  test("cenário 6: rejeita e-mail inválido", async () => {
    const { db } = database();
    await assert.rejects(() => bootstrapFirstAdmin({ ...validInput, email: "email-invalido" }, db), /e-mail válido/i);
  });
});

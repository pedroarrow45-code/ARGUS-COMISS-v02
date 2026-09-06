import { NextResponse } from "next/server";

import { bootstrapFirstAdmin, SetupError } from "@/lib/users";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dados de configuração inválidos." }, { status: 400 });
  }

  try {
    const user = await bootstrapFirstAdmin({
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      passwordConfirmation: String(body.passwordConfirmation ?? ""),
    });
    return NextResponse.json({ user, message: "Administrador criado com sucesso." }, { status: 201 });
  } catch (error) {
    if (error instanceof SetupError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "INVALID_INPUT" ? 400 : 409 },
      );
    }
    console.error("Falha ao criar o administrador inicial", error);
    return NextResponse.json({ error: "Não foi possível concluir a configuração." }, { status: 500 });
  }
}

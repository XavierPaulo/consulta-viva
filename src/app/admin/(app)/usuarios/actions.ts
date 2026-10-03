"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, hashPassword, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { ACTIONS, MODULES } from "@/lib/permissions";
import type { ActionState } from "@/components/action-form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function readOverrides(form: FormData) {
  const o: Record<string, string[]> = {};
  for (const m of Object.keys(MODULES)) {
    const acts = Object.keys(ACTIONS).filter((a) => form.get(`perm_${m}_${a}`));
    if (acts.length) o[m] = acts;
  }
  return JSON.stringify(o);
}

export async function saveUser(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser("usuarios", id ? "edit" : "create");
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const role = str(form, "role");
  const password = str(form, "password");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe nome e e-mail válidos." };
  if (!(role in ROLES)) return { error: "Escolha o perfil de acesso." };
  if (!id && password.length < 8) return { error: "A senha inicial precisa ter ao menos 8 caracteres." };
  if (password && (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password))) return { error: "Senha: mínimo 8 caracteres, com letras e números." };
  const professionalId = role === "MEDICO" ? str(form, "professionalId") || null : null;
  if (role === "MEDICO" && !professionalId) return { error: "Vincule o usuário médico ao cadastro de profissional." };
  if (id === me.id && (role !== "ADMIN" || !form.get("active"))) return { error: "Você não pode remover seu próprio acesso de administrador." };
  const data = {
    email,
    name,
    role,
    active: !!form.get("active"),
    professionalId,
    permissionOverrides: readOverrides(form),
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };
  try {
    if (id) {
      await prisma.user.update({ where: { id }, data });
      if (!data.active || password) await prisma.session.deleteMany({ where: { userId: id } });
      if (form.get("unlock")) await prisma.user.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } });
    } else {
      await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
    }
  } catch {
    return { error: "E-mail já usado por outro usuário, ou profissional já vinculado a outro login." };
  }
  await audit(me, id ? "UPDATE" : "CREATE", "Usuário", id ?? "", `${email} – perfil ${role}${password ? " (senha definida)" : ""}`);
  revalidatePath("/admin/usuarios");
  return { ok: true, message: id ? "Usuário atualizado." : "Usuário criado. Envie a senha inicial por um canal seguro." };
}

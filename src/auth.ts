import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext, AppRole } from "./types.js";

const AUTH_CONTEXT = new WeakMap<FastifyRequest, AuthContext>();

export function getAuthContext(request: FastifyRequest) {
  return AUTH_CONTEXT.get(request) || null;
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return reply.status(401).send({ error: "Не авторизован" });
  }

  const { data, error } = await request.server.auth.auth.getUser(token);
  const user = data?.user;
  if (error || !user) {
    return reply.status(401).send({ error: "Не авторизован" });
  }

  const { data: roleRow, error: roleError } = await request.server.db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    return reply.status(500).send({ error: roleError.message });
  }

  const role = roleRow?.role as AppRole | undefined;
  if (role !== "super_admin") {
    return reply.status(403).send({ error: "Доступ только для super_admin" });
  }

  AUTH_CONTEXT.set(request, {
    userId: user.id,
    email: user.email || null,
    role,
  });
}

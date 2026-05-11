import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthContext, AppRole } from "./types.js";

const AUTH_CONTEXT = new WeakMap<FastifyRequest, AuthContext>();

export function getAuthContext(request: FastifyRequest) {
  return AUTH_CONTEXT.get(request) || null;
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  AUTH_CONTEXT.set(request, {
    userId: "local_broker_mode",
    email: "local@broker",
    role: "super_admin" as AppRole,
  });
}

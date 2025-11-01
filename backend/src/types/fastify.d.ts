import "fastify";
import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: import("fastify").RouteHandlerMethod;
    authorize: (
      roles: Array<"admin" | "operator" | "viewer">
    ) => import("fastify").RouteHandlerMethod;
  }

  interface FastifyRequest {
    user: {
      id: string;
      role: "admin" | "operator" | "viewer";
      email: string;
      name: string;
    };
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      role: "admin" | "operator" | "viewer";
      email: string;
      name: string;
    };
    user: {
      id: string;
      role: "admin" | "operator" | "viewer";
      email: string;
      name: string;
    };
  }
}


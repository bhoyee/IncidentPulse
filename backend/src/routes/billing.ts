import type { FastifyPluginAsync } from "fastify";
import { env } from "../env";
import { prisma } from "../lib/db";
import { getRequestOrgId } from "../lib/org";

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  let stripe: any = null;
  if (env.STRIPE_SECRET_KEY) {
    try {
      // Lazy require to avoid hard dependency when Stripe is not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require("stripe");
      stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
    } catch (err) {
      fastify.log.warn({ err }, "Stripe not available; using stub billing links");
    }
  }

  async function getStripeCustomerIdForOrg(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, stripeCustomerId: true }
    });
    if (!org) {
      throw new Error("Organization not found");
    }
    if (org.stripeCustomerId) {
      return org.stripeCustomerId;
    }
    if (!stripe) {
      return process.env.STRIPE_TEST_CUSTOMER_ID || null;
    }
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { orgId: org.id, orgSlug: org.slug || undefined }
    });
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id }
    });
    return customer.id as string;
  }

  fastify.get(
    "/portal",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      if (!stripe || !env.STRIPE_PORTAL_RETURN_URL) {
        return reply
          .status(400)
          .send({ error: true, message: "Configure STRIPE_SECRET_KEY and STRIPE_PORTAL_RETURN_URL to enable portal." });
      }

      const orgId = getRequestOrgId(request);
      const customerId = await getStripeCustomerIdForOrg(orgId);
      if (!customerId) {
        return reply.status(400).send({ error: true, message: "No Stripe customer available for this org." });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: env.STRIPE_PORTAL_RETURN_URL
      });

      return reply.send({
        error: false,
        data: {
          url: session.url
        }
      });
    }
  );

  fastify.get(
    "/checkout",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      const price = (request.query as { price?: string }).price ?? "pro";
      const proUrl = process.env.STRIPE_CHECKOUT_PRO_URL;
      const entUrl = process.env.STRIPE_CHECKOUT_ENTERPRISE_URL;
      const url = price === "enterprise" ? entUrl : proUrl;

      if (stripe && env.STRIPE_PORTAL_RETURN_URL) {
        const priceId =
          price === "enterprise"
            ? env.STRIPE_PRICE_ENTERPRISE || env.STRIPE_PRICE_PRO
            : env.STRIPE_PRICE_PRO;
        if (!priceId) {
          return reply.status(400).send({ error: true, message: "No Stripe price configured." });
        }

        const orgId = getRequestOrgId(request);
        const customerId = await getStripeCustomerIdForOrg(orgId);
        if (!customerId) {
          return reply.status(400).send({ error: true, message: "No Stripe customer available for this org." });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: env.STRIPE_PORTAL_RETURN_URL,
          cancel_url: env.STRIPE_PORTAL_RETURN_URL,
          customer: customerId
        });

        // Optimistically set plan based on selected price.
        await prisma.organization.update({
          where: { id: orgId },
          data: { plan: price === "enterprise" ? "enterprise" : "pro" }
        });

        return reply.send({
          error: false,
          data: { url: session.url }
        });
      }

      if (url) {
        return reply.send({
          error: false,
          data: { url }
        });
      }

      return reply.status(400).send({
        error: true,
        message: "Configure Stripe keys and price IDs to enable checkout."
      });
    }
  );

  fastify.get(
    "/invoices",
    { preHandler: [fastify.authenticate, fastify.authorize(["admin"])] },
    async (request, reply) => {
      if (!stripe || !env.STRIPE_PORTAL_RETURN_URL) {
        return reply.status(400).send({ error: true, message: "Configure Stripe keys to list invoices." });
      }
      const orgId = getRequestOrgId(request);
      const customerId = await getStripeCustomerIdForOrg(orgId);
      if (!customerId) {
        return reply.status(400).send({ error: true, message: "No Stripe customer available for this org." });
      }
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 10 });
      const data = invoices.data.map((inv: any) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        total: inv.total,
        currency: inv.currency,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        createdAt: inv.created,
        invoicePdf: inv.invoice_pdf
      }));
      return reply.send({ error: false, data });
    }
  );
};

export default billingRoutes;

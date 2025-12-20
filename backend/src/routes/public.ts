import type { FastifyPluginAsync } from "fastify";
import { fetchFreshStatus } from "../lib/status";
import { onStatusSnapshot } from "../lib/realtime";
import { DEFAULT_ORG_ID, findOrgIdBySlug } from "../lib/org";
import { getIntegrationSettings } from "../lib/integration-settings";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async (_request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (_request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) {
      orgId = await findOrgIdBySlug(orgSlug);
    }
    if (!orgId) {
      orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;
    }

    const snapshot = await fetchFreshStatus(undefined, orgId);

    return reply.send({
      error: false,
      data: snapshot.payload,
      meta: {
        state: snapshot.state,
        uptime24h: snapshot.uptime24h
      }
    });
  });

  fastify.get("/status/stream", async (_request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (_request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) {
      orgId = await findOrgIdBySlug(orgSlug);
    }
    if (!orgId) {
      orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (typeof reply.raw.flushHeaders === "function") {
      reply.raw.flushHeaders();
    }
    reply.hijack();

    const initial = await fetchFreshStatus(undefined, orgId);
    reply.raw.write(
      `event: status\n` +
        `data: ${JSON.stringify({
          error: false,
          data: initial.payload,
          meta: {
            state: initial.state,
            uptime24h: initial.uptime24h
          }
        })}\n\n`
    );

    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15000);

    const detach = onStatusSnapshot((snapshot) => {
      if (snapshot.organizationId && snapshot.organizationId !== orgId) {
        return;
      }
      reply.raw.write(
        `event: status\n` +
          `data: ${JSON.stringify({
            error: false,
            data: snapshot.payload,
            meta: {
              state: snapshot.state,
              uptime24h: snapshot.uptime24h
            }
          })}\n\n`
      );
    });

    const closeStream = () => {
      clearInterval(heartbeat);
      detach();
      reply.raw.end();
    };

    reply.raw.on("close", closeStream);
    reply.raw.on("aborted", closeStream);
  });

  // Lightweight JSON for embeddable widgets (branding + status)
  fastify.get("/status/embed", async (_request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (_request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) {
      orgId = await findOrgIdBySlug(orgSlug);
    }
    if (!orgId) {
      orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;
    }

    const snapshot = await fetchFreshStatus(undefined, orgId);
    const settings = await getIntegrationSettings(orgId, true);

    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");

    return reply.send({
      error: false,
      data: {
        status: snapshot.payload,
        meta: {
          state: snapshot.state,
          uptime24h: snapshot.uptime24h
        },
        branding: {
          embedEnabled: (settings as any)?.statusEmbedEnabled ?? false,
          logoUrl: (settings as any)?.statusLogoUrl ?? null,
          primaryColor: (settings as any)?.statusPrimaryColor ?? null,
          textColor: (settings as any)?.statusTextColor ?? null,
          backgroundColor: (settings as any)?.statusBackgroundColor ?? null
        }
      }
    });
  });

  // Lightweight embeddable widget script (no iframe)
  fastify.get("/status/embed.js", async (request, reply) => {
    const apiBase = `${request.protocol}://${request.headers.host}`;
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    const js = `
(function(){
  const script = document.currentScript;
  const org = script.getAttribute('data-org');
  if(!org){ console.warn('IncidentPulse: data-org missing on embed script'); return; }
  const targetId = script.getAttribute('data-target') || 'incidentpulse-status';
  const container = document.getElementById(targetId) || script.parentElement;
  if(!container){ console.warn('IncidentPulse: target container not found'); return; }

  const styles = document.createElement('style');
  styles.textContent = \`
    .ip-card { border-radius:12px; padding:16px; border:1px solid rgba(255,255,255,0.08); background:rgba(15,23,42,0.9); color:#e2e8f0; font-family:Inter,system-ui,-apple-system,sans-serif; }
    .ip-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
    .ip-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }
    .ip-section { margin-top:14px; }
    .ip-pill { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; }
    .ip-service { display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:10px; margin-top:6px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); }
    .ip-incident { padding:10px 12px; border-radius:10px; margin-top:6px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); }
    .ip-muted { color: rgba(226,232,240,0.7); font-size:12px; margin-top:2px; }
    .ip-title { font-weight:700; font-size:14px; margin:0; }
  \`;
  document.head.appendChild(styles);

  fetch('${apiBase}/public/status/embed?orgSlug=' + encodeURIComponent(org))
    .then(r => r.json())
    .then(payload => {
      if(payload.error){ container.innerHTML = '<div class="ip-card">Status unavailable</div>'; return; }
      const data = payload.data;
      if(!data.branding.embedEnabled){ container.innerHTML = '<div class="ip-card">Status embed disabled</div>'; return; }
      const bg = data.branding.backgroundColor || '#0f172a';
      const fg = data.branding.textColor || '#e2e8f0';
      const accent = data.branding.primaryColor || '#22c55e';
      const logo = data.branding.logoUrl;
      const state = data.status.overall_state || 'unknown';
      const incidents = data.status.active_incidents || [];
      const services = data.status.services || [];

      const svcHtml = services.map(s => '<div class="ip-service" style="color:'+fg+';border-color:'+fg+'22;background:'+fg+'05;">'
        + '<span style="font-weight:600;">'+(s.name || 'Service')+'</span>'
        + '<span class="ip-pill" style="background:'+accent+'22;color:'+accent+';">'+(s.state || 'unknown')+'</span>'
        + '</div>').join('');

      const incHtml = incidents.length === 0
        ? '<p class="ip-muted">No active incidents.</p>'
        : incidents.map(i => '<div class="ip-incident" style="color:'+fg+';border-color:'+fg+'22;background:'+fg+'05;">'
          + '<p class="ip-title" style="color:'+fg+';">'+(i.title || 'Incident')+'</p>'
          + '<p class="ip-muted">'+[i.severity, i.status, i.startedAt ? new Date(i.startedAt).toLocaleString() : ''].filter(Boolean).join(' · ')+'</p>'
          + '</div>').join('');

      container.innerHTML = '<div class="ip-card" style="background:'+bg+';color:'+fg+';">'
        + '<div class="ip-header">'
        + (logo ? '<img src="'+logo+'" alt="logo" style="height:36px;width:auto;border-radius:8px;" />' : '')
        + '<div><p class="ip-muted" style="margin:0;">Status</p><h2 style="margin:0;color:'+fg+';">'+state.replace('_',' ').toUpperCase()+'</h2></div>'
        + '<span class="ip-badge" style="background:'+accent+'22;color:'+accent+';"><span style="width:8px;height:8px;border-radius:999px;background:'+accent+';"></span>'+state+'</span>'
        + '</div>'
        + '<div class="ip-section"><h3 style="margin:0 0 6px;font-size:13px;color:'+fg+';">Active incidents</h3>'+incHtml+'</div>'
        + '<div class="ip-section"><h3 style="margin:0 0 6px;font-size:13px;color:'+fg+';">Services</h3>'+svcHtml+'</div>'
        + '</div>';
    })
    .catch(() => {
      container.innerHTML = '<div class="ip-card">Status unavailable</div>';
    });
})();
    `;
    reply.type("application/javascript").send(js);
  });
};

export default publicRoutes;

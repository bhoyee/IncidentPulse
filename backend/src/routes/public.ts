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
    .ip-wrap { width:100%; font-family:Inter,system-ui,-apple-system,sans-serif; }
    .ip-header { display:flex; align-items:center; gap:12px; padding:16px; border-radius:14px; }
    .ip-header-logo { height:42px; width:auto; border-radius:10px; object-fit:contain; }
    .ip-header-title { font-size:18px; font-weight:800; margin:0; }
    .ip-subscribe-btn { margin-left:auto; background:#0b1727; color:#fff; border:1px solid rgba(255,255,255,0.1); padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer; transition:all .2s ease; }
    .ip-subscribe-btn:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(0,0,0,0.25); }
    .ip-banner { margin-top:14px; padding:14px 16px; border-radius:12px; font-weight:700; display:flex; align-items:center; justify-content:space-between; }
    .ip-stats { margin-top:16px; display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
    .ip-stat-card { padding:14px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04); }
    .ip-stat-value { font-size:28px; font-weight:800; margin:0; }
    .ip-stat-label { margin:4px 0 0; font-size:12px; opacity:0.75; }
    .ip-section { margin-top:18px; border-radius:12px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); padding:14px 16px; }
    .ip-section h3 { margin:0 0 8px; font-size:14px; }
    .ip-services { display:flex; flex-direction:column; gap:8px; }
    .ip-service { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); }
    .ip-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:700; }
    .ip-uptime-bars { display:grid; grid-template-columns:repeat(30, 1fr); gap:2px; margin-top:8px; }
    .ip-uptime-bar { height:26px; border-radius:4px; }
    .ip-footer { margin-top:18px; text-align:center; font-size:12px; opacity:0.7; }
    .ip-modal { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:999999; }
    .ip-modal-inner { background:#0f172a; color:#e2e8f0; padding:20px; border-radius:12px; width:90%; max-width:480px; box-shadow:0 16px 40px rgba(0,0,0,0.35); }
    .ip-modal h4 { margin:0 0 10px; }
    .ip-field { margin-top:10px; }
    .ip-field label { display:block; font-size:12px; margin-bottom:4px; opacity:0.8; }
    .ip-field input[type="email"] { width:100%; padding:10px; border-radius:8px; border:1px solid rgba(226,232,240,0.15); background:#0b1220; color:#e2e8f0; }
    .ip-services-choose { max-height:180px; overflow:auto; margin-top:8px; border:1px solid rgba(226,232,240,0.15); border-radius:8px; padding:8px; background:#0b1220; }
    .ip-modal-actions { display:flex; gap:10px; margin-top:14px; }
    .ip-btn { flex:1; padding:10px 12px; border-radius:10px; font-weight:700; border:1px solid rgba(255,255,255,0.1); cursor:pointer; }
    .ip-btn.primary { background:#2563eb; color:#fff; }
    .ip-btn.ghost { background:transparent; color:#e2e8f0; }
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
      const maint = data.status.maintenance || [];
      const lastIncidentDate = incidents.length ? Math.min(...incidents.map(i => new Date(i.startedAt || Date.now()).getTime())) : null;
      const daysSince = lastIncidentDate ? Math.max(0, Math.floor((Date.now() - lastIncidentDate) / 86400000)) : '—';

      const uptimeBars = Array.from({length:30}).map(() => '<div class="ip-uptime-bar" style="background:'+accent+';"></div>').join('');

      const svcHtml = services.map(s => '<div class="ip-service" style="color:'+fg+';border-color:'+fg+'22;background:'+fg+'05;">'
        + '<div><div style="font-weight:700;">'+(s.name || 'Service')+'</div>'
        + '<div class="ip-uptime-bars">'+uptimeBars+'</div></div>'
        + '<span class="ip-badge" style="background:'+accent+'22;color:'+accent+';">'+(s.state || 'unknown')+'</span>'
        + '</div>').join('');

      const incHtml = incidents.length === 0
        ? '<p class="ip-muted">No active incidents.</p>'
        : incidents.map(i => '<div class="ip-incident" style="color:'+fg+';border-color:'+fg+'22;background:'+fg+'05;">'
          + '<p class="ip-title" style="color:'+fg+';">'+(i.title || 'Incident')+'</p>'
          + '<p class="ip-muted">'+[i.severity, i.status, i.startedAt ? new Date(i.startedAt).toLocaleString() : ''].filter(Boolean).join(' · ')+'</p>'
          + '</div>').join('');

      container.innerHTML = '<div class="ip-wrap" style="color:'+fg+';">'
        + '<div class="ip-header" style="background:'+bg+';border:1px solid '+fg+'22;">'
        + (logo ? '<img src="'+logo+'" alt="logo" class="ip-header-logo" />' : '')
        + '<div><p class="ip-muted" style="margin:0;opacity:.7;">Status</p><h2 class="ip-header-title" style="color:'+fg+';">Status</h2></div>'
        + '<button class="ip-subscribe-btn" aria-label="Subscribe to status updates">Subscribe to updates</button>'
        + '</div>'
        + '<div class="ip-banner" style="background:'+(state==='operational'?accent:'#f59e0b')+';color:'+(state==='operational'?'#0b1727':'#0b1727')+';">'
        + '<span style="font-weight:800;">'+(state==='operational'?'All Systems Operational':state.replace('_',' '))+'</span>'
        + '<span style="font-size:12px;font-weight:600;">Updated just now</span>'
        + '</div>'
        + '<div class="ip-stats">'
        + '<div class="ip-stat-card" style="border-color:'+fg+'22;background:'+fg+'05;"><p class="ip-stat-value" style="color:'+fg+';">'+incidents.length+'</p><p class="ip-stat-label">Active incidents</p></div>'
        + '<div class="ip-stat-card" style="border-color:'+fg+'22;background:'+fg+'05;"><p class="ip-stat-value" style="color:'+fg+';">'+(maint?.length || 0)+'</p><p class="ip-stat-label">Active maintenance</p></div>'
        + '<div class="ip-stat-card" style="border-color:'+fg+'22;background:'+fg+'05;"><p class="ip-stat-value" style="color:'+fg+';">'+daysSince+'</p><p class="ip-stat-label">Days since last incident</p></div>'
        + '</div>'
        + '<div class="ip-section"><h3 style="color:'+fg+';">Active incidents</h3>'+incHtml+'</div>'
        + '<div class="ip-section"><h3 style="color:'+fg+';">Services & uptime</h3><div class="ip-services">'+svcHtml+'</div></div>'
        + '<div class="ip-footer">Powered by IncidentPulse</div>'
        + '</div>';

      // Subscribe modal (placeholder)
      const btn = container.querySelector('.ip-subscribe-btn');
      if(btn){
        btn.addEventListener('click', () => {
          const modal = document.createElement('div');
          modal.className = 'ip-modal';
          modal.innerHTML = '<div class="ip-modal-inner">'
            + '<h4>Subscribe to updates</h4>'
            + '<div class="ip-field"><label>Email</label><input type="email" id="ip-sub-email" placeholder="you@example.com" /></div>'
            + '<div class="ip-field"><label>Services</label>'
            + '<div class="ip-services-choose">'
            + '<label style="display:block;margin-bottom:6px;"><input type="radio" name="ip-sub-scope" value="all" checked /> All services</label>'
            + '<label style="display:block;margin-bottom:6px;"><input type="radio" name="ip-sub-scope" value="custom" /> Choose services</label>'
            + services.map(s => '<label style="display:block;font-size:12px;opacity:.9;"><input type="checkbox" class="ip-sub-service" value="'+(s.id||'')+'" style="margin-right:6px;" /> '+(s.name||'Service')+'</label>').join('')
            + '</div></div>'
            + '<p style="font-size:12px;opacity:.7;margin-top:8px;">(Coming soon) Subscriptions will email you when incidents change state.</p>'
            + '<div class="ip-modal-actions">'
            + '<button class="ip-btn ghost ip-sub-cancel">Close</button>'
            + '<button class="ip-btn primary ip-sub-save" disabled>Subscribe</button>'
            + '</div>'
            + '</div>';
          document.body.appendChild(modal);
          modal.querySelector('.ip-sub-cancel').addEventListener('click', () => modal.remove());
          modal.addEventListener('click', (e) => { if(e.target === modal) modal.remove(); });
        });
      }
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

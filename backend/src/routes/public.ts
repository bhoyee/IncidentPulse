import type { FastifyPluginAsync } from "fastify";
import { fetchFreshStatus } from "../lib/status";
import { onStatusSnapshot } from "../lib/realtime";
import { DEFAULT_ORG_ID, findOrgIdBySlug } from "../lib/org";
import { getIntegrationSettings } from "../lib/integration-settings";

const publicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async (request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) orgId = await findOrgIdBySlug(orgSlug);
    if (!orgId) orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;

    const snapshot = await fetchFreshStatus(undefined, orgId);
    return reply.send({
      error: false,
      data: snapshot.payload,
      meta: { state: snapshot.state, uptime24h: snapshot.uptime24h },
    });
  });

  fastify.get("/status/stream", async (request, reply) => {
    const { orgId: queryOrgId, orgSlug } =
      (request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) orgId = await findOrgIdBySlug(orgSlug);
    if (!orgId) orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    if (typeof reply.raw.flushHeaders === "function") reply.raw.flushHeaders();
    reply.hijack();

    const initial = await fetchFreshStatus(undefined, orgId);
    reply.raw.write(
      `event: status\n` +
        `data: ${JSON.stringify({
          error: false,
          data: initial.payload,
          meta: { state: initial.state, uptime24h: initial.uptime24h },
        })}\n\n`
    );

    const heartbeat = setInterval(() => reply.raw.write(": heartbeat\n\n"), 15000);
    const detach = onStatusSnapshot((snapshot) => {
      if (snapshot.organizationId && snapshot.organizationId !== orgId) return;
      reply.raw.write(
        `event: status\n` +
          `data: ${JSON.stringify({
            error: false,
            data: snapshot.payload,
            meta: { state: snapshot.state, uptime24h: snapshot.uptime24h },
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

  fastify.get("/status/embed", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Vary", "Origin");

    const { orgId: queryOrgId, orgSlug } =
      (request.query as { orgId?: string; orgSlug?: string } | undefined) ?? {};

    let orgId: string | null = null;
    if (orgSlug) orgId = await findOrgIdBySlug(orgSlug);
    if (!orgId) orgId = queryOrgId && queryOrgId.length > 0 ? queryOrgId : DEFAULT_ORG_ID;

    const snapshot = await fetchFreshStatus(undefined, orgId);
    const settings = await getIntegrationSettings(orgId ?? DEFAULT_ORG_ID);

    return reply.send({
      error: false,
      data: {
        status: snapshot.payload,
        meta: { state: snapshot.state, uptime24h: snapshot.uptime24h },
        branding: {
          embedEnabled: settings?.statusEmbedEnabled ?? true,
          logoUrl: settings?.statusLogoUrl ?? null,
          primaryColor: settings?.statusPrimaryColor ?? "#16a34a",
          textColor: settings?.statusTextColor ?? "#0f172a",
          backgroundColor: settings?.statusBackgroundColor ?? "#f8fafc",
        },
      },
    });
  });

  fastify.get("/status/embed.js", async (request, reply) => {
    const apiBase = `${request.protocol}://${request.headers.host}`;
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Vary", "Origin");

    const js = `(function(){
  var script = document.currentScript;
  var org = script.getAttribute('data-org');
  if (!org) return;
  var targetId = script.getAttribute('data-target') || 'incidentpulse-status';
  var container = document.getElementById(targetId) || script.parentElement;
  if (!container) return;

    var styles = document.createElement('style');
  styles.textContent = [    '.ip-wrap{width:100%;font-family:Inter,system-ui,-apple-system,sans-serif;}',    '.ip-header{display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;background:#fff;border:1px solid rgba(0,0,0,0.06);}',    '.ip-header-logo{height:42px;width:auto;border-radius:10px;object-fit:contain;}',    '.ip-header-title{font-size:18px;font-weight:800;margin:0;}',    '.ip-subscribe-btn{margin-left:auto;background:#0b1727;color:#fff;border:1px solid rgba(255,255,255,0.1);padding:10px 14px;border-radius:10px;font-weight:700;cursor:pointer;}',    '.ip-banner{margin-top:14px;padding:14px 16px;border-radius:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;color:#0b1727;}',    '.ip-stats{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}',    '.ip-stat-card{padding:14px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.06);background:#fff;}',    '.ip-stat-value{font-size:28px;font-weight:800;margin:0;}',    '.ip-stat-label{margin:4px 0 0;font-size:12px;opacity:0.75;}',    '.ip-section{margin-top:18px;border-radius:12px;border:1px solid rgba(0,0,0,0.06);background:#fff;padding:14px 16px;}',    '.ip-section h3{margin:0 0 8px;font-size:14px;}',    '.ip-services{display:flex;flex-direction:column;gap:10px;}',    '.ip-service{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:#fff;}',    '.ip-service-content{flex:1;display:flex;flex-direction:column;gap:6px;}',    '.ip-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;}',    '.ip-uptime-bars{display:grid;grid-template-columns:repeat(30,1fr);gap:2px;margin-top:8px;width:100%;}',    '.ip-uptime-bar{height:26px;border-radius:4px;}',    '.ip-uptime-footer{display:flex;justify-content:space-between;font-size:11px;opacity:0.75;margin-top:6px;padding:0 2px;}',    '.ip-maint-list{display:flex;flex-direction:column;gap:10px;}',    '.ip-maint-card{border:1px solid rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;background:#fff;}',    '.ip-maint-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-weight:700;}',    '.ip-maint-body{padding:12px 14px;display:grid;grid-template-columns:120px 1fr;row-gap:6px;column-gap:10px;font-size:14px;}',    '.ip-maint-label{opacity:0.8;font-weight:600;}',    '.ip-maint-value{opacity:0.9;}',    '.ip-footer{margin-top:18px;text-align:center;font-size:12px;opacity:0.7;}',    '.ip-modal{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999999;}',    '.ip-modal-inner{background:#0f172a;color:#e2e8f0;padding:20px;border-radius:12px;width:90%;max-width:480px;box-shadow:0 16px 40px rgba(0,0,0,0.35);}',    '.ip-modal h4{margin:0 0 10px;}',    '.ip-field{margin-top:10px;}',    '.ip-field label{display:block;font-size:12px;margin-bottom:4px;opacity:0.8;}',    '.ip-field input[type=email]{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(226,232,240,0.15);background:#0b1220;color:#e2e8f0;}',    '.ip-services-choose{max-height:180px;overflow:auto;margin-top:8px;border:1px solid rgba(226,232,240,0.15);border-radius:8px;padding:8px;background:#0b1220;}',    '.ip-modal-actions{display:flex;gap:10px;margin-top:14px;}',    '.ip-btn{flex:1;padding:10px 12px;border-radius:10px;font-weight:700;border:1px solid rgba(255,255,255,0.1);cursor:pointer;}',    '.ip-btn.primary{background:#2563eb;color:#fff;}',    '.ip-btn.ghost{background:transparent;color:#e2e8f0;}'  ].join('');\n  document.head.appendChild(styles);

  function buildBars(svc, accent, warn, danger) {
    var hist = Array.isArray(svc.uptimeHistory) && svc.uptimeHistory.length
      ? svc.uptimeHistory.slice(-30)
      : Array.from({length:30}).map(function(){ return { state: svc.state || 'operational', incidents: [], date: '' }; });
    return hist.map(function(item, idx){
      var st = (item.state || 'operational').toLowerCase();
      var barColor = st === 'operational' ? accent : (st.indexOf('degrad') >= 0 || st.indexOf('partial') >= 0 ? warn : danger);
      var hasInc = item.incidents && item.incidents.length > 0;
      var title = (item.date || 'Day') + ' | ' + (hasInc ? 'Incident' : 'Operational');
      return '<div class="ip-uptime-bar ip-uptime-bar-data" data-idx="'+idx+'" style="background:'+barColor+';" title="'+title+'"></div>';
    }).join('');
  }

  function render(data){
    if (!data || !data.branding || !data.status) { container.innerHTML = '<div class="ip-card">Status unavailable</div>'; return; }
    if (!data.branding.embedEnabled) { container.innerHTML = '<div class="ip-card">Status embed disabled</div>'; return; }

    var accent = '#16a34a';
    var warn = '#f59e0b';
    var danger = '#dc2626';

    var bg = data.branding.backgroundColor || '#f8fafc';
    var fg = data.branding.textColor || '#0f172a';
    var logo = data.branding.logoUrl || '';
    var state = (data.status.overall_state || 'unknown').toLowerCase();
    var incidents = data.status.active_incidents || [];
    var services = data.status.services || [];
    var maint = (data.status.scheduled_maintenance && data.status.scheduled_maintenance.active) || [];

    var lastTs = null;
    incidents.forEach(function(i){ if (i.startedAt) { var t = new Date(i.startedAt).getTime(); if (!lastTs || t > lastTs) lastTs = t; } });
    services.forEach(function(svc){
      (svc.uptimeHistory || []).forEach(function(item){
        (item.incidents || []).forEach(function(ii){
          if (ii.startedAt) { var t = new Date(ii.startedAt).getTime(); if (!lastTs || t > lastTs) lastTs = t; }
        });
      });
    });
    var daysSince = incidents.length > 0 ? 0 : (lastTs ? Math.max(0, Math.floor((Date.now() - lastTs) / 86400000)) : '-');

    var svcHtml = services.map(function(s, svcIdx){
      var hist = Array.isArray(s.uptimeHistory) && s.uptimeHistory.length ? s.uptimeHistory.slice(-30) : Array.from({length:30}).map(function(){ return { state: s.state || 'operational' }; });
      var total = hist.length || 1;
      var ops = hist.filter(function(h){ return (h.state || 'operational').toLowerCase() === 'operational'; }).length;
      var uptimePct = ((ops / total) * 100).toFixed(2);
      var bars = buildBars(s, accent, warn, danger);
      var st = (s.state || 'unknown').toLowerCase();
      var badgeColor = st === 'operational' ? accent : (st.indexOf('degrad') >= 0 || st.indexOf('partial') >= 0 ? warn : danger);
      return '<div class="ip-service" data-svc="'+svcIdx+'" style="color:'+fg+';">'
        + '<div class="ip-service-content">'
        + '<div style="font-weight:700;">'+(s.name || 'Service')+'</div>'
        + '<div class="ip-uptime-bars">'+bars+'</div>'
        + '<div class="ip-uptime-footer"><span>'+total+' days ago</span><span>'+uptimePct+'% uptime</span><span>Today</span></div>'
        + '</div>'
        + '<span class="ip-badge" style="background:'+badgeColor+'22;color:'+badgeColor+';">'+(s.state || 'unknown')+'</span>'
        + '</div>';
    }).join('');

    var incHtml = incidents.length === 0
      ? '<p class="ip-muted">No active incidents.</p>'
      : incidents.map(function(i){
          var meta = [i.severity, i.status, i.startedAt ? new Date(i.startedAt).toLocaleString() : ''].filter(Boolean).join(' · ');
          return '<div class="ip-incident" style="color:'+fg+';border:1px solid rgba(0,0,0,0.06);padding:10px 12px;border-radius:10px;background:#fff;">'
            + '<p class="ip-title" style="margin:0 0 4px 0;font-weight:700;">'+(i.title || 'Incident')+'</p>'
            + '<p class="ip-muted" style="margin:0;font-size:12px;opacity:.8;">'+meta+'</p>'
            + '</div>';
        }).join('');

    var serviceMap = new Map((services || []).map(function(s){ return [s.id, s.name || s.slug || 'Service']; }));
    var maintHtml = maint.length === 0
      ? '<p class="ip-muted">No active maintenance.</p>'
      : maint.map(function(m){
          var window = [m.startsAt ? new Date(m.startsAt).toLocaleString() : null, m.endsAt ? new Date(m.endsAt).toLocaleString() : null].filter(Boolean).join(' ? ');
          var components = 'All services';
          if (m.appliesToAll) {
            components = 'All services';
          } else if (m.service && (m.service.name || m.service.slug)) {
            components = m.service.name || m.service.slug;
          } else if (Array.isArray(m.services) && m.services.length) {
            components = m.services.map(function(s){ return s && (s.name || s.slug); }).filter(Boolean).join(', ');
          } else if (Array.isArray(m.serviceIds)) {
            components = m.serviceIds.map(function(id){ return serviceMap.get(id) || id; }).join(', ');
          }
          var badge = (m.status || 'scheduled').replace('_',' ');
          return '<div class="ip-maint-card" style="color:'+fg+';">'
            + '<div class="ip-maint-head" style="background:#38bdf8;color:#0b1727;">'
            + '<span>'+(m.title || 'Maintenance')+'</span>'
            + '<span class="ip-badge" style="background:#0b1727;color:#fff;">'+badge+'</span>'
            + '</div>'
            + '<div class="ip-maint-body">'
            + '<div class="ip-maint-label">Schedule</div><div class="ip-maint-value">'+(window || 'Not set')+'</div>'
            + '<div class="ip-maint-label">Services</div><div class="ip-maint-value">'+components+'</div>'
            + '<div class="ip-maint-label">Description</div><div class="ip-maint-value">'+(m.description || 'No description')+'</div>'
            + '</div>'
            + '</div>';
        }).join('');

    container.innerHTML = ''
      + '<div class="ip-wrap" style="color:'+fg+';">'
      + '<div class="ip-header">'
      + (logo ? '<img src="'+logo+'" alt="logo" class="ip-header-logo" />' : '')
      + '<div><p style="margin:0;opacity:.7;font-size:12px;">Status</p><h2 class="ip-header-title" style="color:'+fg+';">Status</h2></div>'
      + '<button class="ip-subscribe-btn">Subscribe to updates</button>'
      + '</div>'
      + '<div class="ip-banner" style="background:'+(state === 'operational' ? accent : (state.indexOf('degrad') >= 0 || state.indexOf('partial') >= 0 ? warn : danger))+';">'
      + '<span>'+(state === 'operational' ? 'All Systems Operational' : state.replace('_',' '))+'</span>'
      + '<span style="font-size:12px;font-weight:600;">Updated just now</span>'
      + '</div>'
      + '<div class="ip-stats">'
      + '<div class="ip-stat-card"><p class="ip-stat-value">'+incidents.length+'</p><p class="ip-stat-label">Active incidents</p></div>'
      + '<div class="ip-stat-card"><p class="ip-stat-value">'+(maint.length || 0)+'</p><p class="ip-stat-label">Active maintenance</p></div>'
      + '<div class="ip-stat-card"><p class="ip-stat-value">'+daysSince+'</p><p class="ip-stat-label">Days since last incident</p></div>'
      + '</div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Active incidents</h3>'+incHtml+'</div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Services & uptime</h3><div class="ip-services">'+svcHtml+'</div></div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Scheduled maintenance</h3><div class="ip-maint-list">'+maintHtml+'</div></div>'
      + '<div class="ip-footer">Powered by IncidentPulse</div>'
      + '</div>';

    var overlay = document.getElementById('ip-overlay-root');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'ip-overlay-root';
    overlay.className = 'ip-modal';
    overlay.style.display = 'none';
    overlay.innerHTML = '<div class="ip-modal-inner" id="ip-overlay-inner"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.style.display = 'none'; });

    if (services && services.length) {
      services.forEach(function(svc, idx){
        var bars = container.querySelectorAll('.ip-service[data-svc="'+idx+'"] .ip-uptime-bar-data');
        bars.forEach(function(bar){
          bar.addEventListener('click', function(){
            var barIdx = parseInt(bar.getAttribute('data-idx') || '0', 10);
            var hist = Array.isArray(svc.uptimeHistory) ? svc.uptimeHistory.slice(-30) : [];
            var item = hist[barIdx];
            var date = (item && item.date) || '';
            var incList = (item && item.incidents) || [];
            var header = '<h4 style="margin:0 0 8px 0;">'+(svc.name || 'Service')+' · '+(date || '')+'</h4>';
            if (!incList.length) {
              overlay.querySelector('#ip-overlay-inner').innerHTML = header + '<p style="margin:0;">Operational</p>';
            } else {
              var list = incList.map(function(ii){
                var meta = [ii.severity, ii.status, ii.startedAt ? new Date(ii.startedAt).toLocaleString() : ''].filter(Boolean).join(' · ');
                var rc = ii.rootCause ? '<div style="font-size:12px;opacity:.8;margin-top:2px;"><strong>Root cause:</strong> '+ii.rootCause+'</div>' : '';
                var rs = ii.resolutionSummary ? '<div style="font-size:12px;opacity:.8;margin-top:2px;"><strong>Resolution:</strong> '+ii.resolutionSummary+'</div>' : '';
                return '<li style="margin-bottom:8px;"><strong>'+(ii.title || 'Incident')+'</strong><br/><small>'+meta+'</small>'+rc+rs+'</li>';
              }).join('');
              overlay.querySelector('#ip-overlay-inner').innerHTML = header + '<ul style="margin:0 0 6px 16px; padding:0;">'+list+'</ul>';
            }
            overlay.style.display = 'flex';
          });
        });
      });
    }

    var subBtn = container.querySelector('.ip-subscribe-btn');
    if (subBtn) {
      var modal = document.getElementById('ip-sub-modal');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'ip-sub-modal';
      modal.className = 'ip-modal';
      modal.style.display = 'none';
      modal.innerHTML = '<div class="ip-modal-inner" style="background:#0b1220;color:#e2e8f0;">'
        + '<h4 style="margin:0 0 8px 0;">Subscribe to updates</h4>'
        + '<div class="ip-field"><label>Email</label><input type="email" id="ip-sub-email" placeholder="you@example.com" /></div>'
        + '<div class="ip-field"><label>Scope</label>'
        + '<div class="ip-services-choose">'
        + '<label style="display:block;margin-bottom:6px;"><input type="radio" name="ip-sub-scope" value="all" checked /> All services</label>'
        + '<label style="display:block;margin-bottom:6px;"><input type="radio" name="ip-sub-scope" value="custom" /> Choose services</label>'
        + services.map(function(s){ return '<label style="display:block;font-size:12px;opacity:.9;"><input type="checkbox" class="ip-sub-service" value="'+(s.id || '')+'" style="margin-right:6px;" /> '+(s.name || 'Service')+'</label>'; }).join('')
        + '</div></div>'
        + '<div class="ip-modal-actions">'
        + '<button class="ip-btn ghost ip-sub-cancel">Cancel</button>'
        + '<button class="ip-btn primary ip-sub-save">Subscribe</button>'
        + '</div>'
        + '<p class="ip-muted" id="ip-sub-msg" style="margin-top:6px;font-size:12px;opacity:.7;"></p>'
        + '</div>';
      document.body.appendChild(modal);

      function showToast(msg, ok){
        var el = document.getElementById('ip-sub-msg');
        if (!el) return;
        el.textContent = msg;
        el.style.color = ok ? '#34d399' : '#f87171';
      }

      subBtn.addEventListener('click', function(){ modal.style.display = 'flex'; });
      modal.addEventListener('click', function(e){ if (e.target === modal) modal.style.display = 'none'; });
      var cancel = modal.querySelector('.ip-sub-cancel');
      if (cancel) cancel.addEventListener('click', function(){ modal.style.display = 'none'; });
      var save = modal.querySelector('.ip-sub-save');
      if (save) {
        save.addEventListener('click', function(){
          var emailEl = modal.querySelector('#ip-sub-email');
          var scopeEl = modal.querySelector('input[name="ip-sub-scope"]:checked');
          var emailVal = emailEl && emailEl.value ? emailEl.value.trim() : '';
          var scope = scopeEl && scopeEl.value ? scopeEl.value : 'all';
          if (!emailVal) { showToast('Email is required', false); return; }
          var serviceIds = undefined;
          if (scope === 'custom') {
            var selected = [];
            var checks = modal.querySelectorAll('.ip-sub-service');
            checks.forEach(function(c){ if (c && c.checked && c.value) selected.push(c.value); });
            if (!selected.length) { showToast('Select at least one service or choose All', false); return; }
            serviceIds = selected;
          }
          fetch('${apiBase}/status/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, orgSlug: org, serviceIds: serviceIds })
          })
            .then(function(res){ return res.json().then(function(j){ return { ok: res.ok, body: j }; }); })
            .then(function(result){
              if (!result.ok || result.body.error) { showToast(result.body.message || 'Subscription failed', false); return; }
              showToast(result.body.message || 'Check your email to verify.', true);
            })
            .catch(function(){ showToast('Subscription failed', false); });
        });
      }
    }
  }

  function load(){
    fetch('${apiBase}/public/status/embed?orgSlug='+encodeURIComponent(org))
      .then(function(r){ return r.json(); })
      .then(function(payload){
        if (payload.error) { container.innerHTML = '<div class="ip-card">Status unavailable</div>'; return; }
        render(payload.data);
      })
      .catch(function(){ container.innerHTML = '<div class="ip-card">Status unavailable</div>'; });
  }

  load();
  setInterval(load, 15000);
})();`;

    reply.type("application/javascript").send(js);
  });
};

export default publicRoutes;



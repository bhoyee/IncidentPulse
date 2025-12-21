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
  const script=document.currentScript;
  const org=script.getAttribute('data-org');
  if(!org){console.warn('IncidentPulse: data-org missing on embed script');return;}
  const targetId=script.getAttribute('data-target')||'incidentpulse-status';
  const container=document.getElementById(targetId)||script.parentElement;
  if(!container){console.warn('IncidentPulse: target container not found');return;}

  const styles=document.createElement('style');
  styles.textContent='\\
    .ip-wrap{width:100%;font-family:Inter,system-ui,-apple-system,sans-serif;}\\
    .ip-header{display:flex;align-items:center;gap:12px;padding:16px;border-radius:14px;}\\
    .ip-header-logo{height:42px;width:auto;border-radius:10px;object-fit:contain;}\\
    .ip-header-title{font-size:18px;font-weight:800;margin:0;}\\
    .ip-subscribe-btn{margin-left:auto;background:#0b1727;color:#fff;border:1px solid rgba(255,255,255,0.1);padding:10px 14px;border-radius:10px;font-weight:700;cursor:pointer;transition:all .2s ease;}\\
    .ip-subscribe-btn:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,0.25);}\\
    .ip-banner{margin-top:14px;padding:14px 16px;border-radius:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;}\\
    .ip-stats{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;}\\
    .ip-stat-card{padding:14px 16px;border-radius:12px;border:1px solid rgba(0,0,0,0.05);background:#fff;}\\
    .ip-stat-value{font-size:28px;font-weight:800;margin:0;}\\
    .ip-stat-label{margin:4px 0 0;font-size:12px;opacity:0.75;}\\
    .ip-section{margin-top:18px;border-radius:12px;border:1px solid rgba(0,0,0,0.05);background:#fff;padding:14px 16px;}\\
    .ip-section h3{margin:0 0 8px;font-size:14px;}\\
    .ip-services{display:flex;flex-direction:column;gap:8px;}\\
    .ip-service{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:#fff;}\\
    .ip-service-content{flex:1;display:flex;flex-direction:column;gap:6px;}\\
    .ip-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:700;}\\
    .ip-uptime-bars{display:grid;grid-template-columns:repeat(30,1fr);gap:2px;margin-top:8px;width:100%;}\\
    .ip-uptime-bar{height:26px;border-radius:4px;}\\
    .ip-uptime-footer{display:flex;justify-content:space-between;font-size:11px;opacity:0.75;margin-top:6px;padding:0 2px;}\\
    .ip-maint-list{display:flex;flex-direction:column;gap:10px;}\\
    .ip-maint-card{border:1px solid rgba(0,0,0,0.06);border-radius:12px;overflow:hidden;background:#fff;}\\
    .ip-maint-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-weight:700;}\\
    .ip-maint-body{padding:12px 14px;display:grid;grid-template-columns:140px 1fr;row-gap:6px;column-gap:10px;font-size:14px;}\\
    .ip-maint-label{opacity:0.8;font-weight:600;}\\
    .ip-maint-value{opacity:0.9;}\\
    .ip-footer{margin-top:18px;text-align:center;font-size:12px;opacity:0.7;}\\
    .ip-modal{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999999;}\\
    .ip-modal-inner{background:#0f172a;color:#e2e8f0;padding:20px;border-radius:12px;width:90%;max-width:480px;box-shadow:0 16px 40px rgba(0,0,0,0.35);}\\
    .ip-modal h4{margin:0 0 10px;}\\
    .ip-field{margin-top:10px;}\\
    .ip-field label{display:block;font-size:12px;margin-bottom:4px;opacity:0.8;}\\
    .ip-field input[type=email]{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(226,232,240,0.15);background:#0b1220;color:#e2e8f0;}\\
    .ip-services-choose{max-height:180px;overflow:auto;margin-top:8px;border:1px solid rgba(226,232,240,0.15);border-radius:8px;padding:8px;background:#0b1220;}\\
    .ip-modal-actions{display:flex;gap:10px;margin-top:14px;}\\
    .ip-btn{flex:1;padding:10px 12px;border-radius:10px;font-weight:700;border:1px solid rgba(255,255,255,0.1);cursor:pointer;}\\
    .ip-btn.primary{background:#2563eb;color:#fff;}\\
    .ip-btn.ghost{background:transparent;color:#e2e8f0;}';
  document.head.appendChild(styles);

  const render=(data)=>{
    if(!data.branding.embedEnabled){container.innerHTML='<div class="ip-card">Status embed disabled</div>';return;}
    const bg=data.branding.backgroundColor||'#f8fafc';
    const fg=data.branding.textColor||'#0f172a';
    const accent='#16a34a';
    const warn='#f59e0b';
    const danger='#dc2626';
    const logo=data.branding.logoUrl;
    const state=(data.status.overall_state||'unknown').toLowerCase();
    const incidents=data.status.active_incidents||[];
    const services=data.status.services||[];
    const maint=(data.status.scheduled_maintenance&&data.status.scheduled_maintenance.active)||[];

    let mostRecentTs=null;
    if(incidents.length){
      mostRecentTs=Math.max(...incidents.map(i=>i.startedAt?new Date(i.startedAt).getTime():Date.now()));
    }
    services.forEach(svc=>{
      const hist=Array.isArray(svc.uptimeHistory)?svc.uptimeHistory:[];
      hist.forEach(item=>{
        (item.incidents||[]).forEach(ii=>{
          const ts=ii.startedAt?new Date(ii.startedAt).getTime():null;
          if(ts && (!mostRecentTs || ts>mostRecentTs)){mostRecentTs=ts;}
        });
      });
    });
    const daysSince=incidents.length>0?0:(mostRecentTs?Math.max(0,Math.floor((Date.now()-mostRecentTs)/86400000)):'-');

    const buildBars=(svc)=>{
      const hist=Array.isArray(svc.uptimeHistory)&&svc.uptimeHistory.length?svc.uptimeHistory.slice(-30):Array.from({length:30}).map(()=>({date:'',state:svc.state||'operational',incidents:[]}));
      return hist.map((item,idx)=>{
        const st=(item.state||'operational').toLowerCase();
        const barColor=st==='operational'?accent:(st.includes('degrad')||st.includes('partial'))?warn:danger;
        const hasInc=item.incidents&&item.incidents.length>0;
        const title=(item.date||'Day')+' — '+(hasInc?'Incident':'Operational');
        const incidentsJson=JSON.stringify(item.incidents||[]);
        return '<div class="ip-uptime-bar ip-uptime-bar-data" data-idx="'+idx+'" data-inc="'+encodeURIComponent(incidentsJson)+'" data-date="'+(item.date||'')+'" style="background:'+barColor+';" title="'+title+'" aria-label="'+title+'"></div>';
      }).join('');
    };

    const svcHtml=services.map((s,svcIdx)=>{
      const hist=Array.isArray(s.uptimeHistory)&&s.uptimeHistory.length?s.uptimeHistory.slice(-30):Array.from({length:30}).map(()=>({state:s.state||'operational'}));
      const total=hist.length||1;
      const ops=hist.filter(h=>((h.state||'operational').toLowerCase()==='operational')).length;
      const uptimePct=((ops/total)*100).toFixed(2);
      const bars=buildBars(s);
      const st=(s.state||'unknown').toLowerCase();
      const badgeColor=st==='operational'?accent:(st.includes('degrad')||st.includes('partial'))?warn:danger;
      return '<div class="ip-service" data-svc-idx="'+svcIdx+'" style="color:'+fg+';border-color:'+fg+'22;background:#fff;">'
        + '<div class="ip-service-content"><div style="font-weight:700;">'+(s.name||'Service')+'</div><div class="ip-uptime-bars">'+bars+'</div><div class="ip-uptime-footer"><span>'+total+' days ago</span><span>'+uptimePct+'% uptime</span><span>Today</span></div></div>'
        + '<span class="ip-badge" style="background:'+badgeColor+'22;color:'+badgeColor+';">'+(s.state||'unknown')+'</span>'
        + '</div>';
    }).join('');

    const incHtml=incidents.length===0
      ? '<p class="ip-muted">No active incidents.</p>'
      : incidents.map(i=>{
          const meta=[i.severity,i.status,i.startedAt?new Date(i.startedAt).toLocaleString():''].filter(Boolean).join(' · ');
          return '<div class="ip-incident" style="color:'+fg+';border-color:'+fg+'22;background:#fff;"><p class="ip-title" style="color:'+fg+';">'+(i.title||'Incident')+'</p><p class="ip-muted">'+meta+'</p></div>';
        }).join('');

    const serviceMap=new Map((services||[]).map(s=>[s.id,s.name||s.slug||'Service']));
    const maintHtml=maint.length===0
      ? '<p class="ip-muted">No active maintenance.</p>'
      : maint.map(m=>{
          const window=[m.startsAt?new Date(m.startsAt).toLocaleString():null,m.endsAt?new Date(m.endsAt).toLocaleString():null].filter(Boolean).join(' — ');
          let components='—';
          if(m.appliesToAll){
            components='All services';
          } else if(m.service && (m.service.name || m.service.slug)){
            components=m.service.name || m.service.slug;
          } else if(Array.isArray(m.services) && m.services.length){
            components=m.services.map(s=>s?.name || (s?.id && serviceMap.get(s.id)) || s?.slug).filter(Boolean).join(', ');
          } else if(Array.isArray(m.serviceIds)){
            components=m.serviceIds.map(id=>serviceMap.get(id)||id).filter(Boolean).join(', ');
          }
          const badge=(m.status||'scheduled').replace('_',' ');
          const maintHeaderColor='#0ea5e9';
          return '<div class="ip-maint-card" style="color:'+fg+';background:#fff;">'
            + '<div class="ip-maint-head" style="background:'+maintHeaderColor+';color:#0b1727;">'
            + '<span>'+(m.title||'Maintenance')+'</span>'
            + '<span class="ip-badge" style="background:#0b1727;color:#fff;">'+badge+'</span>'
            + '</div>'
            + '<div class="ip-maint-body">'
            + '<div class="ip-maint-label">Schedule</div><div class="ip-maint-value">'+(window||'Not set')+'</div>'
            + '<div class="ip-maint-label">Services</div><div class="ip-maint-value">'+components+'</div>'
            + '<div class="ip-maint-label">Description</div><div class="ip-maint-value">'+(m.description||'No description')+'</div>'
            + '</div>'
            + '</div>';
        }).join('');

    container.innerHTML='<div class="ip-wrap" style="color:'+fg+';">'
      + '<div class="ip-header" style="background:'+bg+';border:1px solid '+fg+'22;">'
      + (logo?'<img src="'+logo+'" alt="logo" class="ip-header-logo" />':'')
      + '<div><p class="ip-muted" style="margin:0;opacity:.7;">Status</p><h2 class="ip-header-title" style="color:'+fg+';">Status</h2></div>'
      + '<button class="ip-subscribe-btn" aria-label="Subscribe to status updates">Subscribe to updates</button>'
      + '</div>'
      + '<div class="ip-banner" style="background:'+(state==='operational'?accent:(state.includes('degrad')||state.includes('partial')?warn:danger))+';color:#0b1727;">'
      + '<span style="font-weight:800;">'+(state==='operational'?'All Systems Operational':state.replace('_',' '))+'</span>'
      + '<span style="font-size:12px;font-weight:600;">Updated just now</span>'
      + '</div>'
      + '<div class="ip-stats">'
      + '<div class="ip-stat-card" style="border-color:'+fg+'22;"><p class="ip-stat-value" style="color:'+fg+';">'+incidents.length+'</p><p class="ip-stat-label">Active incidents</p></div>'
      + '<div class="ip-stat-card" style="border-color:'+fg+'22;"><p class="ip-stat-value" style="color:'+fg+';">'+(maint.length||0)+'</p><p class="ip-stat-label">Active maintenance</p></div>'
      + '<div class="ip-stat-card" style="border-color:'+fg+'22;"><p class="ip-stat-value" style="color:'+fg+';">'+daysSince+'</p><p class="ip-stat-label">Days since last incident</p></div>'
      + '</div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Active incidents</h3>'+incHtml+'</div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Services & uptime</h3><div class="ip-services">'+svcHtml+'</div></div>'
      + '<div class="ip-section"><h3 style="color:'+fg+';">Scheduled maintenance</h3><div class="ip-maint-list">'+maintHtml+'</div></div>'
      + '<div class="ip-footer">Powered by IncidentPulse</div>'
      + '</div>';

    const existing=document.getElementById('ip-overlay-root');
    if(existing){ existing.remove(); }
    const overlay=document.createElement('div');
    overlay.id='ip-overlay-root';
    overlay.className='ip-modal';
    overlay.style.display='none';
    overlay.innerHTML='<div class="ip-modal-inner" id="ip-overlay-inner"></div>';
    document.body.appendChild(overlay);

    if(services && services.length){
      services.forEach((svc,svcIdx)=>{
        const bars=container.querySelectorAll('.ip-service[data-svc-idx="'+svcIdx+'"] .ip-uptime-bar-data');
        bars.forEach((bar)=>{
          bar.addEventListener('click',()=>{
            const idx=parseInt(bar.getAttribute('data-idx')||'0',10);
            const hist=Array.isArray(svc.uptimeHistory)?svc.uptimeHistory.slice(-30):[];
            const item=hist[idx];
            const date=bar.getAttribute('data-date')||'';
            if(!item){overlay.style.display='none';return;}
            const incList=item.incidents||[];
            const header='<h4 style="margin:0 0 8px 0;">'+(svc.name||'Service')+' · '+(date||'')+'</h4>';
            if(!incList.length){
              overlay.querySelector('#ip-overlay-inner').innerHTML=header+'<p style="margin:0;">Operational</p>';
            } else {
              const list=incList.map(ii=>{
                const meta=[ii.severity,ii.status,ii.startedAt?new Date(ii.startedAt).toLocaleString():''].filter(Boolean).join(' · ');
                const rc=ii.rootCause?'<div style="font-size:12px;opacity:.8;margin-top:2px;"><strong>Root cause:</strong> '+ii.rootCause+'</div>':'';
                const rs=ii.resolutionSummary?'<div style="font-size:12px;opacity:.8;margin-top:2px;"><strong>Resolution:</strong> '+ii.resolutionSummary+'</div>':'';
                return '<li style="margin-bottom:8px;"><strong>'+(ii.title||'Incident')+'</strong><br/><small>'+meta+'</small>'+rc+rs+'</li>';
              }).join('');
              overlay.querySelector('#ip-overlay-inner').innerHTML=header+'<ul style="margin:0 0 6px 16px; padding:0;">'+list+'</ul>';
            }
            overlay.style.display='flex';
          });
        });
      });
      overlay.addEventListener('click',(e)=>{ if(e.target===overlay) overlay.style.display='none'; });
    }
  };

  const load=()=>{
    fetch('${apiBase}/public/status/embed?orgSlug='+encodeURIComponent(org))
      .then(r=>r.json())
      .then(payload=>{
        if(payload.error){container.innerHTML='<div class="ip-card">Status unavailable</div>';return;}
        render(payload.data);
      })
      .catch(()=>{ container.innerHTML='<div class="ip-card">Status unavailable</div>'; });
  };

  load();
  setInterval(load,15000);
})();`;

    reply.type("application/javascript").send(js);
  });
};

export default publicRoutes;

import type { GraphDefinition } from '@agentflow/schema'
import { hostRunStatus, type HostRun } from '@agentflow/core/host-run'

/** Offline viewer/editor: all user-authored content enters the DOM as text. */
export function createHostPanel(graph: GraphDefinition, run?: HostRun): string {
  const payload = JSON.stringify({ graph, run: run ? { createdAt: run.createdAt, ...hostRunStatus(run), artifacts: run.artifacts } : null })
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>AgentFlow</title><style>
:root{color-scheme:light;--canvas:#fbfbfa;--surface:#fff;--ink:#20201e;--muted:#62625c;--line:#d5d5cf;--blue:#2563eb;--soft:#edf3ff;--green:#39775a;--red:#b7473d}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}button,input,textarea,select{font:inherit;color:inherit}button{cursor:pointer;border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 14px;min-height:40px}button:hover{background:#f2f2ef}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--blue);outline-offset:3px}button:disabled{cursor:default;opacity:.55}::selection{background:#d8e6ff}input,textarea{caret-color:var(--blue)}*{scrollbar-color:#aaa9a3 #f2f2ef;scrollbar-width:thin}a{text-underline-offset:3px}header{display:flex;align-items:center;gap:24px;padding:20px 28px;border-bottom:1px solid var(--line);background:var(--surface)}.brand{font-weight:650;font-size:18px;white-space:nowrap}.identity{min-width:0;flex:1}.identity input{font-size:20px;font-weight:600;border:0;padding:2px 0;background:transparent;width:100%;letter-spacing:-.02em}.meta{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}.primary{background:var(--ink);color:white;border-color:var(--ink);white-space:nowrap}.primary:hover{background:#41413c}main{display:grid;grid-template-columns:minmax(0,1fr) 360px;min-height:calc(100vh - 96px)}.work{min-width:0}.goal{padding:24px 28px 16px}.goal label{display:block;font-weight:600;margin-bottom:8px}.goal textarea{width:100%;min-height:82px;background:transparent;border:1px solid var(--line);border-radius:9px;padding:10px 12px;resize:vertical;line-height:1.6}.canvas{overflow:auto;min-height:440px;padding:12px 28px 32px}.stage{position:relative;min-height:380px}.wires{position:absolute;inset:0;overflow:visible;pointer-events:none}.node{position:absolute;width:220px;min-height:108px;text-align:left;padding:16px;border-radius:15px;background:var(--surface)}.node[aria-pressed="true"]{border:2px solid var(--blue);padding:15px;background:var(--soft)}.node strong{display:block;font-size:15px;white-space:normal;overflow-wrap:anywhere;line-height:1.45;margin:4px 0}.node .meta{display:block}.node .state{font-size:12px;color:var(--muted)}.node[data-status="completed"] .state{color:var(--green)}.node[data-status="failed"] .state{color:var(--red)}.node[data-status="running"] .state{color:var(--blue)}aside{border-left:1px solid var(--line);background:var(--surface);padding:24px;min-width:0}h1{font-size:18px;margin:0 0 6px;letter-spacing:-.02em;overflow-wrap:anywhere}h2{font-size:14px;margin:28px 0 12px}.field{display:block;margin-top:20px}.field span{display:block;font-size:12px;font-weight:600;margin-bottom:6px}.field input,.field textarea,.field select{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}.field textarea{min-height:112px;resize:vertical;line-height:1.65}.field textarea[readonly],.field input[readonly]{background:#f7f7f4}.edge{padding:12px 0;border-bottom:1px solid #e5e5e0}.edge .field{margin:6px 0 0}.edge p{margin:0;font-size:12px;color:var(--muted);overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 system-ui,sans-serif;margin:0;max-height:480px;overflow:auto}footer{padding:16px 28px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}#notice{color:var(--green);min-height:20px;margin-top:8px}.error{color:var(--red)!important}.empty{padding:20px 0;color:var(--muted)}
@media(max-width:860px){header{padding:16px;gap:14px;flex-wrap:wrap}.identity{order:3;flex-basis:100%}.identity input{font-size:18px}main{grid-template-columns:1fr}aside{border-left:0;border-top:1px solid var(--line);padding:24px 20px}.canvas{min-height:340px;padding:12px 20px 24px}.stage{min-height:300px}.goal{padding:20px}.primary{margin-left:auto}footer{padding:16px 20px}}@media(prefers-reduced-motion:no-preference){button{transition:background-color .15s ease-out,border-color .15s ease-out}}
</style></head><body>
<header><div class="brand">AgentFlow</div><div class="identity"><input id="name" aria-label="Flow name"><div class="meta" id="summary"></div></div><button class="primary" id="export"></button></header>
<main><section class="work"><div class="goal"><label for="goal" id="goal-label"></label><textarea id="goal"></textarea><div id="notice" role="status" aria-live="polite"></div></div><div class="canvas" aria-label="Flow"><div class="stage" id="stage"></div></div></section><aside id="inspector" aria-label="Node details"></aside></main>
<footer id="footnote"></footer>
<script type="application/json" id="data">` + payload + String.raw`</script>
<script>
'use strict';
const data=JSON.parse(document.getElementById('data').textContent),graph=data.graph,run=data.run;
const zh=/[\u3400-\u9fff]/u.test(graph.name+graph.goal);
const labels=zh?{goal:'任务目标',export:'导出 Flow',snapshot:'运行快照',edit:'编辑流程',nodes:'个节点',links:'条连接',name:'名称',system:'职责与判断标准',input:'如何使用输入',output:'交付要求',locked:'已锁定',incoming:'接收材料',result:'执行结果',ready:'就绪',waiting:'等待上游',running:'执行中',completed:'已完成',failed:'失败',agent:'Agent · 当前会话模型',source:'Input · 原始材料',empty:'此节点从任务目标开始。',saved:'已导出。将 Flow 文件交给 agent，即可校验并运行。',draftFoot:'修改后导出 Flow，交给 agent 运行。',runFoot:'此面板展示生成时的运行快照。最新进度可由 agent 重新生成。',relation:'关系'}:{goal:'Task goal',export:'Export Flow',snapshot:'Run snapshot',edit:'Edit flow',nodes:'nodes',links:'links',name:'Name',system:'Role and criteria',input:'Use of supplied material',output:'Required deliverable',locked:'Locked',incoming:'Incoming material',result:'Result',ready:'Ready',waiting:'Waiting for upstream',running:'Running',completed:'Completed',failed:'Failed',agent:'Agent · Current session model',source:'Input · Source material',empty:'This node starts from the task goal.',saved:'Exported. Give the Flow file to your agent to validate and run.',draftFoot:'Export your changes and give the Flow to your agent to run.',runFoot:'This panel shows progress when it was generated. Ask your agent to refresh the snapshot.',relation:'Relation'};
document.documentElement.lang=zh?'zh-CN':'en';document.title=graph.name+' · AgentFlow';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const notice=document.getElementById('notice'),inspector=document.getElementById('inspector');
const nameField=document.getElementById('name'),goalField=document.getElementById('goal');
nameField.value=graph.name;goalField.value=graph.goal;nameField.readOnly=goalField.readOnly=!!run;
document.getElementById('goal-label').textContent=labels.goal;
document.getElementById('summary').textContent=(run?labels.snapshot:labels.edit)+' · '+Object.keys(graph.nodes).length+' '+labels.nodes+' · '+graph.links.length+' '+labels.links+(run?' · '+run.createdAt:'');
document.getElementById('footnote').textContent=run?labels.runFoot:labels.draftFoot;
document.getElementById('export').textContent=labels.export;
nameField.oninput=()=>{graph.name=nameField.value};goalField.oninput=()=>{graph.goal=goalField.value};
let selected=Object.keys(graph.nodes).find(id=>graph.nodes[id].type==='agent')||Object.keys(graph.nodes)[0];
const sources=link=>link.type==='merge'?link.sourceIds:[link.sourceId];
const stateFor=id=>run?.nodes.find(node=>node.nodeId===id)?.status||'ready';
function field(title,value,oninput,locked=false,single=false){const label=el('label',undefined,'field');label.append(el('span',title+(locked?' · '+labels.locked:'')));const control=el(single?'input':'textarea');control.value=value;control.readOnly=!!run||locked;control.oninput=()=>oninput(control.value);label.append(control);return label}
function draw(){
 const focusedId=document.activeElement?.classList.contains('node')?document.activeElement.dataset.nodeId:null;
 const stage=document.getElementById('stage');stage.replaceChildren();
 const ids=Object.keys(graph.nodes),depth=new Map(ids.map(id=>[id,0]));
 for(let i=0;i<ids.length;i++)for(const link of graph.links)for(const source of sources(link))depth.set(link.targetId,Math.max(depth.get(link.targetId),depth.get(source)+1));
 const routes=graph.links.flatMap(link=>sources(link).map(source=>({link,source,long:depth.get(link.targetId)-depth.get(source)>1})));
 const laneCount=routes.filter(route=>route.long).length;
 const rows=new Map(),positions=new Map();for(const id of ids){const d=depth.get(id),row=rows.get(d)||0;rows.set(d,row+1);positions.set(id,{x:d*310,y:50+laneCount*26+row*170})}
 const width=Math.max(280,...[...positions.values()].map(p=>p.x+240)),height=Math.max(300,...[...positions.values()].map(p=>p.y+150));
 const available=stage.parentElement.clientWidth-(innerWidth>860?56:40),scale=innerWidth>860?Math.max(.72,Math.min(1,available/width)):1;
 stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';
 const scene=el('div');scene.style.cssText='position:absolute;left:0;top:0;transform-origin:top left;width:'+width+'px;height:'+height+'px;transform:scale('+scale+')';stage.append(scene);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.classList.add('wires');
 const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');for(const [k,v]of Object.entries({id:'arrow',viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'6',markerHeight:'6',orient:'auto-start-reverse'}))marker.setAttribute(k,v);const tip=document.createElementNS(ns,'path');tip.setAttribute('d','M 0 0 L 10 5 L 0 10 z');tip.setAttribute('fill','#8a8983');marker.append(tip);defs.append(marker);svg.append(defs);
 let lane=0;
 for(const {link,source,long} of routes){const a=positions.get(source),b=positions.get(link.targetId),path=document.createElementNS(ns,'path'),laneY=20+lane*26;if(long)lane++;
 path.setAttribute('d',long?'M '+(a.x+220)+' '+(a.y+36)+' H '+(a.x+246)+' V '+laneY+' H '+(b.x-26)+' V '+(b.y+36)+' H '+b.x:'M '+(a.x+220)+' '+(a.y+64)+' C '+(a.x+265)+' '+(a.y+64)+', '+(b.x-45)+' '+(b.y+64)+', '+b.x+' '+(b.y+64));path.setAttribute('stroke','#8a8983');path.setAttribute('fill','none');path.setAttribute('stroke-width','1.5');path.setAttribute('stroke-linejoin','round');path.setAttribute('marker-end','url(#arrow)');svg.append(path);
 const text=document.createElementNS(ns,'text');text.setAttribute('x',long?(a.x+220+b.x)/2:a.x+245);text.setAttribute('y',long?laneY-6:a.y+53);text.setAttribute('fill','#62625c');text.setAttribute('font-size','12');text.textContent=link.type;svg.append(text)}scene.append(svg);
 for(const id of ids){const node=graph.nodes[id],p=positions.get(id),button=el('button',undefined,'node');button.style.left=p.x+'px';button.style.top=p.y+'px';button.dataset.nodeId=id;button.dataset.status=stateFor(id);button.setAttribute('aria-pressed',String(selected===id));button.append(el('span',node.type==='agent'?labels.agent:labels.source,'meta'),el('strong',node.name),el('span',run?labels[stateFor(id)]:id,'state'));button.onclick=()=>{selected=id;draw();inspect()};scene.append(button);if(focusedId===id)button.focus({preventScroll:true})}
}
function inspect(){
 inspector.replaceChildren();const node=graph.nodes[selected];if(!node)return;
 inspector.append(el('h1',node.name),el('div',selected,'meta'));
 inspector.append(field(labels.name,node.name,value=>{node.name=value;draw()},false,true));
 if(node.type==='agent')for(const key of ['system','input','output'])inspector.append(field(labels[key],node.prompts[key].content,value=>{node.prompts[key].content=value;node.prompts[key].customized=true},node.prompts[key].locked));
 if(node.type==='input')for(const item of node.items)inspector.append(field(item.name+(item.hidden?' (hidden)':''),item.content,value=>item.content=value,item.hidden));
 inspector.append(el('h2',labels.incoming));const incoming=graph.links.filter(link=>link.targetId===selected);
 if(!incoming.length)inspector.append(el('p',labels.empty,'empty'));
 for(const link of incoming){const row=el('div',undefined,'edge');row.append(el('p',sources(link).map(id=>graph.nodes[id].name).join(' + ')));if(link.type==='input'||link.type==='merge'||run)row.append(el('div',link.type));else{const label=el('label',undefined,'field');label.append(el('span',labels.relation));const select=el('select');for(const relation of ['pass','review','revise']){const option=el('option',relation);option.value=relation;select.append(option)}select.value=link.type;select.onchange=()=>{link.type=select.value;draw()};label.append(select);row.append(label)}inspector.append(row)}
 const artifact=run?.artifacts.find(a=>a.nodeId===selected);if(artifact){inspector.append(el('h2',labels.result),el('pre',artifact.content))}
 const error=run?.nodes.find(n=>n.nodeId===selected)?.error;if(error)inspector.append(el('p',error,'error'));
}
document.getElementById('export').onclick=()=>{
 if(!graph.name.trim()||Object.values(graph.nodes).some(n=>!n.name.trim())){notice.className='error';notice.textContent=zh?'请填写 Flow 和节点名称。':'Fill in the Flow and node names.';return}
 const blob=new Blob([JSON.stringify(graph,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='flow.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.className='';notice.textContent=labels.saved;
};
addEventListener('resize',draw);draw();inspect();
</script></body></html>`
}

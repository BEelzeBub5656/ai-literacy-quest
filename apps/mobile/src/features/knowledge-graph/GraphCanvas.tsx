// 图谱画布：WebView + HTML5 Canvas 渲染。
// 性能策略：所有绘制和手势都在 WebView 内完成，RN 侧只有一个 WebView 组件，
// 内存恒定（~60MB），不随节点数线性增长（SVG 方案 234 个原生 View 占 1GB）。
// RN → WebView: injectJavaScript 传数据/命令
// WebView → RN: postMessage 传交互事件（tap/drag）

import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { GraphMode, KnowledgeEdge, KnowledgeNode } from './contracts';
import {
  categoryMeta,
  masteryMeta,
  nodeRadius,
  relationLabel,
  EDGE_COLOR,
  EDGE_HIGHLIGHT,
} from './visualEncoding';
import {
  type Positions,
} from './layouts';

export type FocusRequest = { nodeId: string; token: number };

type Props = {
  positions: Positions;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  nodeById: Map<string, KnowledgeNode>;
  neighbors: Set<string>;
  focusedNodeId: string | null;
  selectedNodeId: string | null;
  mode: GraphMode;
  resetToken: number;
  focusRequest: FocusRequest | null;
  onNodeTap: (id: string) => void;
  onEdgeTap: (id: string) => void;
  onBackgroundTap: () => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
};

// 把分类/掌握度/关系标签序列化为 WebView 可用的 JS 对象
const categoryData = JSON.stringify(
  Object.fromEntries(Object.entries(categoryMeta).map(([k, v]) => [k, { label: v.label, color: v.color }]))
);
const masteryData = JSON.stringify(
  Object.fromEntries(Object.entries(masteryMeta).map(([k, v]) => [k, { ring: v.ring, dashed: v.dashed }]))
);
const relationData = JSON.stringify(relationLabel);

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#F5F6FB;touch-action:none}
#c{display:block;width:100%;height:100%}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const CAT=${categoryData};
const MAS=${masteryData};
const REL=${relationData};
const EDGE_COLOR="${EDGE_COLOR}";
const EDGE_HL="${EDGE_HIGHLIGHT}";
const INK="#182033",MUTED="#6D758A",FOCUS="#4E57C8",REVIEW="#D84C62",BG="#F5F6FB";

function nodeRadius(imp){return 10+Math.max(1,Math.min(3,imp))*4}

const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
let DPR=window.devicePixelRatio||1;
let W=0,H=0;

// 图数据
let G={nodes:[],edges:[],positions:{},neighbors:new Set(),focusedId:null,selectedId:null,mode:'network'};
// 变换
let T={scale:1,tx:0,ty:0};
// 拖拽状态
let drag={id:null,startX:0,startY:0,active:false};
let pan={active:false,startTx:0,startTy:0};
let pinch={active:false,startScale:1,startDist:0};
let touchCount=0;

function resize(){
  W=canvas.clientWidth;H=canvas.clientHeight;
  canvas.width=W*DPR;canvas.height=H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  draw();
}

function fit(){
  const pts=Object.values(G.positions);
  if(!pts.length||!W)return;
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for(const p of pts){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  const gw=maxX-minX||1,gh=maxY-minY||1;
  const pad=64;
  const sc=Math.max(0.2,Math.min((W-2*pad)/gw,(H-2*pad)/gh,1.4));
  T={scale:sc,tx:(W-gw*sc)/2-minX*sc,ty:(H-gh*sc)/2-minY*sc};
  draw();
}

function centerOn(nodeId){
  const p=G.positions[nodeId];if(!p||!W)return;
  const sc=Math.max(T.scale,1.15);
  T={scale:sc,tx:W/2-p.x*sc,ty:H/2-p.y*sc};
  draw();
}

function draw(){
  ctx.fillStyle=BG;
  ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.translate(T.tx,T.ty);
  ctx.scale(T.scale,T.scale);

  const fid=G.focusedId;
  const showLabel=(e)=>G.mode==='path'||(fid!==null&&(e.source===fid||e.target===fid));

  // 边
  for(const e of G.edges){
    const a=G.positions[e.source],b=G.positions[e.target];
    if(!a||!b)continue;
    const src=G.nodes.find(n=>n.id===e.source),tgt=G.nodes.find(n=>n.id===e.target);
    if(!src||!tgt)continue;
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,gap=3;
    const r1=nodeRadius(src.importance),r2=nodeRadius(tgt.importance);
    const x1=a.x+ux*(r1+gap),y1=a.y+uy*(r1+gap),x2=b.x-ux*(r2+gap),y2=b.y-uy*(r2+gap);
    const connected=fid!==null&&(e.source===fid||e.target===fid);
    const dim=fid!==null&&!connected;
    const color=connected?EDGE_HL:EDGE_COLOR;
    ctx.globalAlpha=dim?0.18:0.9;
    ctx.strokeStyle=color;
    ctx.lineWidth=0.8+e.weight*0.35;
    if(e.confidence<0.6){ctx.setLineDash([6,5])}else{ctx.setLineDash([])}
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.setLineDash([]);
    if(e.directed){
      const a1=Math.atan2(uy,ux);
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.moveTo(x2,y2);
      ctx.lineTo(x2-7*Math.cos(a1)-5*Math.cos(a1+Math.PI/2),y2-7*Math.sin(a1)-5*Math.sin(a1+Math.PI/2));
      ctx.lineTo(x2-7*Math.cos(a1)+5*Math.cos(a1+Math.PI/2),y2-7*Math.sin(a1)+5*Math.sin(a1+Math.PI/2));
      ctx.closePath();ctx.fill();
    }
    if(showLabel(e)){
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      ctx.fillStyle=connected?FOCUS:MUTED;
      ctx.font='700 10px sans-serif';
      ctx.textAlign='center';
      ctx.fillText(REL[e.relation]||'',mx,my-6);
    }
  }
  ctx.globalAlpha=1;

  // 节点
  for(const n of G.nodes){
    const p=G.positions[n.id];if(!p)continue;
    const r=nodeRadius(n.importance);
    const cat=CAT[n.category]||{color:'#94A3B8'};
    const mas=MAS[n.mastery]||{ring:'#B8BDD3',dashed:false};
    const isFocused=fid===n.id;
    const isNeighbor=G.neighbors.has(n.id);
    const dim=fid!==null&&!isNeighbor;
    const isSelected=G.selectedId===n.id;
    const isDragging=drag.id===n.id;
    ctx.globalAlpha=dim?0.25:1;

    if(isSelected){ctx.strokeStyle=FOCUS;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,r+6,0,Math.PI*2);ctx.stroke()}
    if(isDragging){ctx.strokeStyle=FOCUS;ctx.lineWidth=2.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(p.x,p.y,r+5,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}

    // 掌握度外圈
    ctx.strokeStyle=mas.ring;ctx.lineWidth=3;
    if(mas.dashed){ctx.setLineDash([5,4])}else{ctx.setLineDash([])}
    ctx.beginPath();ctx.arc(p.x,p.y,r+3,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);

    // 分类填充
    ctx.fillStyle=cat.color;
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
    if(isFocused){ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill()}

    // 复习标记
    if(n.review||n.mastery==='review'){
      const bx=p.x+r*0.72,by=p.y-r*0.72;
      ctx.fillStyle=REVIEW;ctx.beginPath();ctx.arc(bx,by,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#FFF';ctx.font='800 9px sans-serif';ctx.textAlign='center';ctx.fillText('!',bx,by+3);
    }

    // 标题
    ctx.fillStyle=INK;ctx.font='700 10px sans-serif';ctx.textAlign='center';
    ctx.fillText(n.title,p.x,p.y+r+11);
  }
  ctx.globalAlpha=1;
  ctx.restore();
}

// 命中检测
function findNodeAt(gx,gy){
  const tol=9/T.scale;
  let best=null,bestD=1e9;
  for(const n of G.nodes){
    const p=G.positions[n.id];if(!p)continue;
    const d=Math.hypot(gx-p.x,gy-p.y);
    const r=nodeRadius(n.importance)+tol;
    if(d<=r&&d<bestD){bestD=d;best=n.id}
  }
  return best;
}
function pointToSegDist(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,lsq=dx*dx+dy*dy;
  if(lsq===0)return Math.hypot(px-ax,py-ay);
  let t=((px-ax)*dx+(py-ay)*dy)/lsq;t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
function findEdgeAt(gx,gy){
  const tol=9/T.scale;
  let best=null,bestD=1e9;
  for(const e of G.edges){
    const a=G.positions[e.source],b=G.positions[e.target];
    if(!a||!b)continue;
    const d=pointToSegDist(gx,gy,a.x,a.y,b.x,b.y);
    if(d<=tol&&d<bestD){bestD=d;best=e.id}
  }
  return best;
}

// 手势
function getGraphPos(touch){
  return {gx:(touch.clientX-T.tx)/T.scale,gy:(touch.clientY-T.ty)/T.scale};
}

let touchStartT=0,moved=false,lastX=0,lastY=0;

canvas.addEventListener('touchstart',function(e){
  e.preventDefault();
  touchCount=e.touches.length;
  moved=false;
  touchStartT=Date.now();
  if(e.touches.length===1){
    const t=e.touches[0];
    lastX=t.clientX;lastY=t.clientY;
    const {gx,gy}=getGraphPos(t);
    const hit=findNodeAt(gx,gy);
    if(hit){drag={id:hit,startX:G.positions[hit].x,startY:G.positions[hit].y,active:true}}
    else{pan={active:true}}
  }else if(e.touches.length===2){
    const t1=e.touches[0],t2=e.touches[1];
    pinch={active:true,startScale:T.scale,startDist:Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY)};
    drag.active=false;pan.active=false;
  }
},{passive:false});

canvas.addEventListener('touchmove',function(e){
  e.preventDefault();
  moved=true;
  if(e.touches.length===1){
    const t=e.touches[0];
    const dx=t.clientX-lastX,dy=t.clientY-lastY;
    if(drag.active){
      const s=T.scale;
      const p=G.positions[drag.id];
      if(p){G.positions[drag.id]={x:p.x+dx/s,y:p.y+dy/s};draw()}
    }
    if(pan.active){
      T.tx+=dx;T.ty+=dy;draw();
    }
    lastX=t.clientX;lastY=t.clientY;
  }
  if(e.touches.length===2&&pinch.active&&pinch.startDist>0){
    const t1=e.touches[0],t2=e.touches[1];
    const dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
    const ratio=dist/pinch.startDist;
    const ns=Math.max(0.25,Math.min(3,pinch.startScale*ratio));
    const cx=W/2,cy=H/2;
    const gx=(cx-T.tx)/T.scale,gy=(cy-T.ty)/T.scale;
    T={scale:ns,tx:cx-gx*ns,ty:cy-gy*ns};
    draw();
  }
},{passive:false});

canvas.addEventListener('touchend',function(e){
  e.preventDefault();
  if(e.touches.length===0){
    const dur=Date.now()-touchStartT;
    if(!moved&&dur<300){
      // Tap
      const t=e.changedTouches[0];
      if(t){
        const {gx,gy}=getGraphPos(t);
        const hit=findNodeAt(gx,gy);
        if(hit){send({type:'nodeTap',id:hit})}
        else{
          const eHit=findEdgeAt(gx,gy);
          if(eHit){send({type:'edgeTap',id:eHit})}
          else{send({type:'backgroundTap'})}
        }
      }
    }
    if(drag.active){
      const p=G.positions[drag.id];
      if(p){send({type:'nodeDrag',id:drag.id,x:p.x,y:p.y})}
    }
    drag={id:null,startX:0,startY:0,active:false};
    pan={active:false};pinch={active:false};
    touchCount=0;
  }
},{passive:false});

function send(msg){window.ReactNativeWebView.postMessage(JSON.stringify(msg))}

// 接收 RN 数据
window.updateGraph=function(data){
  if(data.type==='data'){
    G={nodes:data.nodes,edges:data.edges,positions:data.positions,neighbors:new Set(data.neighbors),focusedId:data.focusedId,selectedId:data.selectedId,mode:data.mode};
    draw();
  }else if(data.type==='reset'){fit()}
  else if(data.type==='focus'){centerOn(data.nodeId)}
  else if(data.type==='size'){resize();fit()}
};

window.addEventListener('resize',resize);
// 初始 resize
setTimeout(function(){resize();fit()},100);
</script>
</body>
</html>`;

export function GraphCanvas(props: Props) {
  const {
    positions,
    nodes,
    edges,
    nodeById,
    neighbors,
    focusedNodeId,
    selectedNodeId,
    mode,
    resetToken,
    focusRequest,
    onNodeTap,
    onEdgeTap,
    onBackgroundTap,
    onNodeDrag,
  } = props;

  const webViewRef = useRef<WebView>(null);
  const isFirstRender = useRef(true);

  // 序列化图数据发给 WebView
  const serializeData = () => ({
    type: 'data' as const,
    nodes: nodes.map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      mastery: n.mastery,
      importance: n.importance,
      confidence: n.confidence,
      review: n.review,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      relation: e.relation,
      directed: e.directed,
      weight: e.weight,
      confidence: e.confidence,
    })),
    positions,
    neighbors: Array.from(neighbors),
    focusedId: focusedNodeId,
    selectedId: selectedNodeId,
    mode,
  });

  // 首次加载后发送数据
  const sendInitialData = () => {
    const data = serializeData();
    const js = `window.updateGraph(${JSON.stringify(data)});true;`;
    webViewRef.current?.injectJavaScript(js);
  };

  // 数据变化时更新 WebView
  useEffect(() => {
    if (!webViewRef.current) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const data = serializeData();
    const js = `window.updateGraph(${JSON.stringify(data)});true;`;
    webViewRef.current?.injectJavaScript(js);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, nodes, edges, neighbors, focusedNodeId, selectedNodeId, mode]);

  // resetToken 变化时重新 fit
  useEffect(() => {
    if (!webViewRef.current || isFirstRender.current) return;
    webViewRef.current.injectJavaScript(`window.updateGraph({type:'reset'});true;`);
  }, [resetToken]);

  // focusRequest 变化时居中节点
  useEffect(() => {
    if (!webViewRef.current || !focusRequest) return;
    webViewRef.current.injectJavaScript(
      `window.updateGraph({type:'focus',nodeId:'${focusRequest.nodeId}'});true;`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token]);

  const handleMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      switch (msg.type) {
        case 'nodeTap': onNodeTap(msg.id); break;
        case 'edgeTap': onEdgeTap(msg.id); break;
        case 'backgroundTap': onBackgroundTap(); break;
        case 'nodeDrag': onNodeDrag(msg.id, msg.x, msg.y); break;
      }
    } catch {
      // ignore
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ html: HTML }}
      style={styles.webview}
      onMessage={handleMessage}
      onLoad={sendInitialData}
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#F5F6FB',
  },
});

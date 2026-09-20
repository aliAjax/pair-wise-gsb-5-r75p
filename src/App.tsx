import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CalendarDays,Check,ClipboardList,Download,FileCode2,History,Info,Layers3,Lock,Plus,Search,ShieldCheck,ShieldX,Sparkles,User,X} from 'lucide-react';

type Status='ok'|'warn'|'risk';
type Distribution='闭源商用'|'开源分发'|'内部使用'|'SaaS 服务';
type Dep={id:number;name:string;version:string;license:string;source:string;status:Status;note:string;batchId:number};
type Batch={id:number;name:string;distribution:Distribution;releaseDate:string;released:boolean;releasedAt:string|null};
type Snapshot={license:string;distribution:Distribution;at:string;by:string};
type Remediation={id:number;depId:number;action:'replace'|'retain';replacement:string;targetVersion:string;replacementLicense:string;owner:string;due:string;status:'pending'|'doing'|'done';legalBasis:string;review:'none'|'pending'|'approved'|'rejected';reviewer:string;snapshot:Snapshot|null};
type Log={id:number;at:string;actor:string;action:string;dep:string;batch:string;detail:string};
type State={deps:Dep[];batches:Batch[];rems:Remediation[];logs:Log[]};
type Conflict={dep:string;batch:string;rule:string;reason:string};
type View='overview'|'remediation'|'gate'|'logs';

const DISTRIBUTIONS:Distribution[]=['闭源商用','开源分发','内部使用','SaaS 服务'];
const LICENSES=['MIT','BSD-3-Clause','Apache-2.0','LGPL-3.0','GPL-3.0','AGPL-3.0'];
const COMPAT:Record<string,Distribution[]>={
  'MIT':DISTRIBUTIONS,
  'BSD-3-Clause':DISTRIBUTIONS,
  'Apache-2.0':DISTRIBUTIONS,
  'LGPL-3.0':DISTRIBUTIONS,
  'GPL-3.0':['开源分发','内部使用','SaaS 服务'],
  'AGPL-3.0':['开源分发','内部使用'],
};
const compatible=(license:string,d:Distribution)=>(COMPAT[license]||['内部使用']).includes(d);
const colors:Record<string,string>={MIT:'#35b995','BSD-3-Clause':'#6d9ee8','Apache-2.0':'#b18ee4','LGPL-3.0':'#7fb8a4','GPL-3.0':'#ec8c75','AGPL-3.0':'#d95f4b'};
const RULES=[{id:'R1',name:'高风险整改完成'},{id:'R2',name:'替代包许可兼容'},{id:'R3',name:'保留法律依据与复核'},{id:'R4',name:'复核快照一致'}];
const ACTOR='Zen Li';
const KEY='license-lens-gate-v1';

const now=()=>{const d=new Date();const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;};
const today=()=>now().slice(0,10);
const remStatusLabel=(s:Remediation['status'])=>s==='done'?'已完成':s==='doing'?'整改中':'待整改';
const reviewLabel=(r:Remediation['review'])=>r==='approved'?'复核通过':r==='pending'?'复核中':r==='rejected'?'已驳回':'未提交';

const seedBatches:Batch[]=[
  {id:1,name:'AURORA-WEB v2.4',distribution:'闭源商用',releaseDate:'2026-09-30',released:false,releasedAt:null},
  {id:2,name:'AURORA-CLI v1.8',distribution:'SaaS 服务',releaseDate:'2026-10-15',released:false,releasedAt:null},
];
const seedDeps:Dep[]=[
  {id:1,name:'react',version:'18.3.1',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用',batchId:1},
  {id:2,name:'lodash',version:'4.17.21',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用',batchId:1},
  {id:3,name:'chart.js',version:'4.4.4',license:'MIT',source:'npm',status:'ok',note:'宽松许可，可商用',batchId:1},
  {id:4,name:'highlight.js',version:'11.10.0',license:'BSD-3-Clause',source:'npm',status:'warn',note:'再发布需保留版权声明',batchId:1},
  {id:5,name:'legacy-parser',version:'2.1.0',license:'GPL-3.0',source:'手动',status:'risk',note:'Copyleft 与闭源商用分发冲突',batchId:1},
  {id:6,name:'pdf-render-kit',version:'1.2.0',license:'AGPL-3.0',source:'npm',status:'risk',note:'网络提供服务需开放源码',batchId:2},
];
const seedRems:Remediation[]=[
  {id:11,depId:5,action:'replace',replacement:'fast-xml-parser',targetVersion:'4.5.0',replacementLicense:'MIT',owner:'张岚',due:'2026-09-26',status:'doing',legalBasis:'',review:'none',reviewer:'法务 · 陈默',snapshot:null},
  {id:12,depId:6,action:'retain',replacement:'',targetVersion:'',replacementLicense:'Apache-2.0',owner:'陈默',due:'2026-09-28',status:'pending',legalBasis:'',review:'none',reviewer:'法务 · 陈默',snapshot:null},
];
const seedLogs:Log[]=[
  {id:103,at:'2026-09-19 15:20',actor:'陈默',action:'创建整改项',dep:'pdf-render-kit',batch:'AURORA-CLI v1.8',detail:'申请保留原依赖，待补法律依据'},
  {id:102,at:'2026-09-19 14:05',actor:'Zen Li',action:'创建整改项',dep:'legacy-parser',batch:'AURORA-WEB v2.4',detail:'计划替换为 fast-xml-parser@4.5.0'},
  {id:101,at:'2026-09-19 14:02',actor:'系统',action:'扫描完成',dep:'',batch:'',detail:'发现 2 个高风险依赖，已生成整改建议'},
];
const seed:State={deps:seedDeps,batches:seedBatches,rems:seedRems,logs:seedLogs};

const load=():State=>{try{const s=JSON.parse(localStorage.getItem(KEY)||'');if(s&&Array.isArray(s.deps)&&Array.isArray(s.batches)&&Array.isArray(s.rems)&&Array.isArray(s.logs))return s;}catch{/* 忽略损坏缓存 */}return seed;};

const missingFields=(r:Remediation)=>{const m:string[]=[];if(!r.owner.trim())m.push('责任人');if(!r.due)m.push('计划完成日');if(r.action==='replace'){if(!r.replacement.trim())m.push('替代包');if(!r.targetVersion.trim())m.push('目标版本');}return m;};
const canComplete=(r:Remediation)=>missingFields(r).length===0&&(r.action==='replace'||r.review==='approved');

function evaluateBatch(batch:Batch,deps:Dep[],rems:Remediation[]):Conflict[]{
  const out:Conflict[]=[];
  const push=(dep:Dep,rule:string,reason:string)=>out.push({dep:dep.name,batch:batch.name,rule,reason});
  for(const dep of deps.filter(d=>d.batchId===batch.id&&d.status==='risk')){
    const rem=rems.find(r=>r.depId===dep.id);
    if(!rem){push(dep,'R1 高风险整改完成','尚未建立整改项，需关联替代方案或保留决议');continue;}
    if(rem.status!=='done')push(dep,'R1 高风险整改完成',`整改未完成（当前：${remStatusLabel(rem.status)}）`);
    const miss=missingFields(rem);
    if(miss.length)push(dep,'R1 高风险整改完成',`整改项缺少：${miss.join('、')}`);
    if(rem.action==='replace'){
      if(rem.replacementLicense&&!compatible(rem.replacementLicense,batch.distribution))
        push(dep,'R2 替代包许可兼容',`替代包 ${rem.replacement||'（未填写）'} 的 ${rem.replacementLicense} 不满足「${batch.distribution}」分发方式`);
    }else{
      if(!rem.legalBasis.trim())push(dep,'R3 保留法律依据与复核','选择保留原依赖必须填写法律依据');
      if(rem.review!=='approved')push(dep,'R3 保留法律依据与复核',rem.review==='pending'?'法律依据已提交，等待复核结论':'保留决议尚未通过复核');
    }
    if(rem.status==='done'){
      if(!rem.snapshot)push(dep,'R4 复核快照一致','整改已完成但缺少复核快照，请重新复核固化');
      else{
        if(rem.snapshot.distribution!==batch.distribution)push(dep,'R4 复核快照一致',`快照分发方式为「${rem.snapshot.distribution}」，与当前「${batch.distribution}」不一致，需重新复核`);
        const cur=rem.action==='replace'?rem.replacementLicense:dep.license;
        if(rem.snapshot.license!==cur)push(dep,'R4 复核快照一致',`许可证已由快照「${rem.snapshot.license}」变为「${cur}」，需重新复核`);
      }
    }
  }
  return out;
}

export default function App(){
  const [state,setState]=useState<State>(load);
  const [view,setView]=useState<View>('overview');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('全部');
  const [selected,setSelected]=useState(1);
  const [showAdd,setShowAdd]=useState(false);
  const [name,setName]=useState('');
  const [license,setLicense]=useState('MIT');
  const [addBatch,setAddBatch]=useState(1);
  const {deps,batches,rems,logs}=state;
  useEffect(()=>localStorage.setItem(KEY,JSON.stringify(state)),[state]);

  const conflictsByBatch=useMemo(()=>{const m=new Map<number,Conflict[]>();for(const b of batches)m.set(b.id,evaluateBatch(b,deps,rems));return m;},[batches,deps,rems]);
  const allConflicts=useMemo(()=>[...conflictsByBatch.values()].flat(),[conflictsByBatch]);
  const openRisk=deps.filter(d=>d.status==='risk'&&!rems.some(r=>r.depId===d.id&&r.status==='done')).length;

  const mkLog=(actor:string,action:string,detail:string,dep='',batch=''):Log=>({id:Date.now()+Math.random(),at:now(),actor,action,detail,dep,batch});
  const batchOf=(dep:Dep|undefined)=>batches.find(b=>b.id===dep?.batchId);

  const patchRem=(id:number,patch:Partial<Remediation>)=>setState(s=>{
    const r=s.rems.find(x=>x.id===id);if(!r)return s;
    const dep=s.deps.find(d=>d.id===r.depId);const batch=batchOf(dep);
    const touchesKey=['action','replacement','targetVersion','replacementLicense','legalBasis'].some(k=>k in patch);
    const reopen=r.status==='done'&&touchesKey;
    const invalidateRetain=r.action==='retain'&&('legalBasis' in patch)&&(r.review==='approved'||r.review==='pending');
    const next:Remediation={...r,...patch,...(reopen||invalidateRetain?{status:reopen?'doing':r.status,snapshot:null,review:'none'}:{})} as Remediation;
    const newLogs=[...s.logs];
    if(reopen)newLogs.unshift(mkLog(ACTOR,'整改重新打开','关键字段变更，已完成的整改与复核快照失效',dep?.name,batch?.name));
    if(invalidateRetain)newLogs.unshift(mkLog(ACTOR,'复核失效','法律依据已修改，需重新提交复核',dep?.name,batch?.name));
    return {...s,rems:s.rems.map(x=>x.id===id?next:x),logs:newLogs};
  });

  const createRem=(depId:number)=>setState(s=>{
    if(s.rems.some(r=>r.depId===depId))return s;
    const dep=s.deps.find(d=>d.id===depId);if(!dep)return s;
    const batch=batchOf(dep);
    const rem:Remediation={id:Date.now(),depId,action:'replace',replacement:'',targetVersion:'',replacementLicense:'MIT',owner:'',due:'',status:'pending',legalBasis:'',review:'none',reviewer:'法务 · 陈默',snapshot:null};
    return {...s,rems:[...s.rems,rem],logs:[mkLog(ACTOR,'创建整改项','高风险依赖进入整改流程',dep.name,batch?.name),...s.logs]};
  });

  const setRemStatus=(id:number,status:Remediation['status'])=>setState(s=>{
    const r=s.rems.find(x=>x.id===id);if(!r)return s;
    const dep=s.deps.find(d=>d.id===r.depId);const batch=batchOf(dep);
    if(status==='done'){
      if(!canComplete(r)||!dep||!batch)return s;
      const snapshot:Snapshot=r.snapshot??{license:r.action==='replace'?r.replacementLicense:dep.license,distribution:batch.distribution,at:now(),by:r.action==='retain'?r.reviewer:ACTOR};
      const detail=r.action==='replace'?`替换为 ${r.replacement}@${r.targetVersion}（${r.replacementLicense}），已固化快照`:'保留原依赖，复核已通过，快照已固化';
      return {...s,rems:s.rems.map(x=>x.id===id?{...r,status:'done',snapshot}:x),logs:[mkLog(ACTOR,'整改完成',detail,dep.name,batch.name),...s.logs]};
    }
    return {...s,rems:s.rems.map(x=>x.id===id?{...r,status}:x),logs:[mkLog(ACTOR,status==='doing'?'开始整改':'整改重新打开','',dep?.name,batch?.name),...s.logs]};
  });

  const submitReview=(id:number)=>setState(s=>{
    const r=s.rems.find(x=>x.id===id);if(!r||!r.legalBasis.trim())return s;
    const dep=s.deps.find(d=>d.id===r.depId);const batch=batchOf(dep);
    return {...s,rems:s.rems.map(x=>x.id===id?{...r,review:'pending'}:x),logs:[mkLog(ACTOR,'提交复核','保留原依赖的法律依据已提交法务复核',dep?.name,batch?.name),...s.logs]};
  });

  const resolveReview=(id:number,approved:boolean)=>setState(s=>{
    const r=s.rems.find(x=>x.id===id);if(!r||r.review!=='pending')return s;
    const dep=s.deps.find(d=>d.id===r.depId);const batch=batchOf(dep);if(!dep||!batch)return s;
    const snapshot:Snapshot|null=approved?{license:dep.license,distribution:batch.distribution,at:now(),by:r.reviewer||'法务'}:null;
    const detail=approved?`复核通过，固化快照：${dep.license} / ${batch.distribution}`:'复核驳回，保留决议不成立';
    return {...s,rems:s.rems.map(x=>x.id===id?{...r,review:approved?'approved':'rejected',snapshot}:x),logs:[mkLog(r.reviewer||'法务',approved?'复核通过':'复核驳回',detail,dep.name,batch.name),...s.logs]};
  });

  const setDistribution=(batchId:number,d:Distribution)=>setState(s=>{
    const b=s.batches.find(x=>x.id===batchId);if(!b||b.distribution===d)return s;
    const newLogs=[mkLog(ACTOR,'分发方式变更',`由「${b.distribution}」调整为「${d}」，相关复核快照需重新核对`,'',b.name),...s.logs];
    if(b.released)newLogs.unshift(mkLog(ACTOR,'发布标记撤销','分发方式变更，原发布标记失效','',b.name));
    return {...s,batches:s.batches.map(x=>x.id===batchId?{...x,distribution:d,released:false,releasedAt:null}:x),logs:newLogs};
  });

  const toggleRelease=(batchId:number)=>setState(s=>{
    const b=s.batches.find(x=>x.id===batchId);if(!b)return s;
    const conflicts=evaluateBatch(b,s.deps,s.rems);
    if(!b.released&&conflicts.length)return s; // 门禁拦截：存在冲突不得标记可发布
    const next=!b.released;
    const detail=next?`门禁通过，${RULES.length} 条规则全部满足`:'发布标记已撤销';
    return {...s,batches:s.batches.map(x=>x.id===batchId?{...x,released:next,releasedAt:next?now():null}:x),logs:[mkLog(ACTOR,next?'标记可发布':'撤销发布标记',detail,'',b.name),...s.logs]};
  });

  const addDep=()=>{
    if(!name.trim())return;
    const lic=license;
    const status:Status=lic.startsWith('GPL')||lic.startsWith('AGPL')?'risk':lic==='MIT'||lic==='BSD-3-Clause'||lic==='Apache-2.0'?'ok':'warn';
    const dep:Dep={id:Date.now(),name:name.trim(),version:'1.0.0',license:lic,source:'手动',status,note:status==='risk'?'与当前分发方式可能冲突，需整改':'请核对分发义务',batchId:addBatch};
    const batch=batches.find(b=>b.id===addBatch);
    setState(s=>({...s,deps:[...s.deps,dep],logs:status==='risk'?[mkLog(ACTOR,'新增高风险依赖',`${dep.name}（${lic}）加入「${batch?.name}」，门禁已拦截`,dep.name,batch?.name),...s.logs]:s.logs}));
    setSelected(dep.id);setName('');setShowAdd(false);
  };

  const exportMd=()=>{
    const lines:string[]=['# License Lens 发布前整改报告','',`生成时间：${now()}`,'','## 依赖清单','','| 依赖 | 版本 | 许可证 | 批次 | 状态 |','|---|---|---|---|---|'];
    for(const d of deps)lines.push(`| ${d.name} | ${d.version} | ${d.license} | ${batchOf(d)?.name||'-'} | ${d.status} |`);
    lines.push('','## 整改项','','| 依赖 | 方式 | 替代方案 | 责任人 | 计划完成 | 状态 | 复核 |','|---|---|---|---|---|---|---|');
    for(const r of rems){const d=deps.find(x=>x.id===r.depId);lines.push(`| ${d?.name} | ${r.action==='replace'?'替换':'保留'} | ${r.action==='replace'?`${r.replacement}@${r.targetVersion}（${r.replacementLicense}）`:'保留原依赖'} | ${r.owner||'-'} | ${r.due||'-'} | ${remStatusLabel(r.status)} | ${r.action==='retain'?reviewLabel(r.review):'—'} |`);}
    lines.push('','## 发布门禁','');
    for(const b of batches){const cs=conflictsByBatch.get(b.id)||[];lines.push(`### ${b.name}（${b.distribution}）— ${cs.length===0?'✅ 通过':'⛔ 阻塞'}`,'');if(cs.length){lines.push('| 依赖 | 规则 | 阻塞原因 |','|---|---|---|');for(const c of cs)lines.push(`| ${c.dep} | ${c.rule} | ${c.reason} |`);}else lines.push('全部规则通过。');lines.push('');}
    lines.push('## 处理记录（最近 20 条）','','| 时间 | 操作人 | 动作 | 依赖 | 批次 | 详情 |','|---|---|---|---|---|---|');
    for(const l of logs.slice(0,20))lines.push(`| ${l.at} | ${l.actor} | ${l.action} | ${l.dep||'-'} | ${l.batch||'-'} | ${l.detail} |`);
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown'}));a.download='license-remediation-report.md';a.click();URL.revokeObjectURL(a.href);
  };

  const filtered=deps.filter(d=>(filter==='全部'||d.status===filter)&&`${d.name}${d.license}`.toLowerCase().includes(query.toLowerCase()));
  const current=deps.find(d=>d.id===selected);

  const licChip=(lic:string)=><i className="license" style={{color:colors[lic]||'#888',background:(colors[lic]||'#888')+'18'}}>{lic}</i>;

  const remPill=(r:Remediation)=>{
    const overdue=r.status!=='done'&&r.due&&r.due<today();
    const cls=r.status==='done'?'done':overdue?'over':r.status;
    const text=r.status==='done'?'已完成':overdue?'已逾期':remStatusLabel(r.status);
    return <span className={'pill '+cls}>{text}</span>;
  };

  const renderRemCard=(dep:Dep)=>{
    const rem=rems.find(r=>r.depId===dep.id);
    const batch=batchOf(dep);
    if(!rem)return <div className="rem-card" key={dep.id}>
      <div className="rem-head"><div className="rem-title"><b>{dep.name}</b>{licChip(dep.license)}<span className="batch-chip">{batch?.name}</span></div><span className="pill pending">待整改</span></div>
      <div className="rem-empty"><p>尚未建立整改项。高风险依赖必须关联替代方案（替代包、目标版本、责任人、计划完成日）或经复核的保留决议。</p><button className="primary sm" onClick={()=>createRem(dep.id)}><Plus size={14}/>创建整改项</button></div>
    </div>;
    const miss=missingFields(rem);
    const compatOk=rem.action==='replace'&&compatible(rem.replacementLicense,batch?.distribution||'内部使用');
    return <div className="rem-card" key={dep.id}>
      <div className="rem-head">
        <div className="rem-title"><b>{dep.name}</b>{licChip(dep.license)}<span className="batch-chip">{batch?.name} · {batch?.distribution}</span></div>
        {remPill(rem)}
      </div>
      <div className="seg">
        <button className={rem.action==='replace'?'active':''} onClick={()=>patchRem(rem.id,{action:'replace'})}>替换依赖</button>
        <button className={rem.action==='retain'?'active':''} onClick={()=>patchRem(rem.id,{action:'retain'})}>保留原依赖</button>
      </div>
      {rem.action==='replace'?<>
        <div className="rem-grid">
          <label>替代包<input value={rem.replacement} onChange={e=>patchRem(rem.id,{replacement:e.target.value})} placeholder="例如 fast-xml-parser"/></label>
          <label>目标版本<input value={rem.targetVersion} onChange={e=>patchRem(rem.id,{targetVersion:e.target.value})} placeholder="例如 4.5.0"/></label>
          <label>替代许可证<select value={rem.replacementLicense} onChange={e=>patchRem(rem.id,{replacementLicense:e.target.value})}>{LICENSES.map(l=><option key={l}>{l}</option>)}</select></label>
        </div>
        <div className={compatOk?'compat ok':'compat bad'}>{compatOk?<Check size={13}/>:<AlertTriangle size={13}/>} {rem.replacementLicense} {compatOk?'满足':'不满足'}「{batch?.distribution}」分发方式{!compatOk&&'，门禁将拦截（R2）'}</div>
      </>:<>
        <label className="legal-label">法律依据（保留原依赖必填，修改后需重新复核）
          <textarea value={rem.legalBasis} onChange={e=>patchRem(rem.id,{legalBasis:e.target.value})} placeholder="例如：该组件仅以独立进程方式调用，未与闭源代码链接，依据 GPL 第 X 条不构成衍生作品……" rows={3}/>
        </label>
        <div className="review-row">
          <span className={'pill review-'+rem.review}>{reviewLabel(rem.review)}</span>
          {(rem.review==='none'||rem.review==='rejected')&&<button className="outline sm" disabled={!rem.legalBasis.trim()} onClick={()=>submitReview(rem.id)}>提交复核</button>}
          {rem.review==='pending'&&<>
            <input className="reviewer" value={rem.reviewer} onChange={e=>patchRem(rem.id,{reviewer:e.target.value})} placeholder="复核人"/>
            <button className="primary sm" onClick={()=>resolveReview(rem.id,true)}><Check size={13}/>复核通过</button>
            <button className="outline sm" onClick={()=>resolveReview(rem.id,false)}>驳回</button>
          </>}
        </div>
      </>}
      <div className="rem-grid meta">
        <label><User size={11}/> 责任人<input value={rem.owner} onChange={e=>patchRem(rem.id,{owner:e.target.value})} placeholder="负责人"/></label>
        <label><CalendarDays size={11}/> 计划完成日<input type="date" value={rem.due} onChange={e=>patchRem(rem.id,{due:e.target.value})}/></label>
        <div className="rem-actions">
          {rem.status==='pending'&&<button className="outline sm" onClick={()=>setRemStatus(rem.id,'doing')}>开始整改</button>}
          {rem.status==='doing'&&<button className="primary sm" disabled={!canComplete(rem)} title={canComplete(rem)?'':'需补全必填项，保留类还需复核通过'} onClick={()=>setRemStatus(rem.id,'done')}><Check size={13}/>标记完成</button>}
          {rem.status==='done'&&<button className="outline sm" onClick={()=>setRemStatus(rem.id,'doing')}>重新打开</button>}
        </div>
      </div>
      {miss.length>0&&<div className="miss"><Info size={12}/>缺少：{miss.join('、')}</div>}
      {rem.action==='retain'&&rem.status!=='done'&&rem.review!=='approved'&&<div className="miss"><Info size={12}/>保留原依赖须复核通过后方可标记完成</div>}
      {rem.snapshot&&<div className="snapshot"><Lock size={12}/><span>复核快照 · {rem.snapshot.license} / {rem.snapshot.distribution} · {rem.snapshot.at} · {rem.snapshot.by}</span></div>}
    </div>;
  };

  const renderOverview=()=><>
    <section className="hero"><div><span className="tag">PROJECT · AURORA</span><h2>发布前，再确认一次。</h2><p>扫描了 <b>{deps.length} 个依赖</b>，<b className="warning">{deps.filter(d=>d.status==='risk').length} 个高风险</b>，{allConflicts.length>0?<>当前 <b className="warning">{allConflicts.length} 条门禁冲突</b> 待处理。</>:'门禁全部通过。'}</p></div><div className="scan-score"><div className="score-ring"><strong>{Math.round(deps.filter(d=>d.status==='ok').length/Math.max(deps.length,1)*100)}<small>%</small></strong></div><div><span>兼容评分</span><b>{allConflicts.length===0?'良好':'受阻'}</b><small>上次扫描 2 分钟前</small></div></div></section>
    <section className="summary">
      <div><span>全部依赖</span><b>{deps.length}</b><small>{batches.length} 个发布批次</small></div>
      <div><span>安全许可</span><b className="teal">{deps.filter(d=>d.status==='ok').length}</b><small>可直接分发</small></div>
      <div><span>整改中</span><b className="orange">{openRisk}</b><small>高风险未完成</small></div>
      <div><span>门禁冲突</span><b className="red">{allConflicts.length}</b><small>{allConflicts.length===0?'可标记发布':'阻塞发布'}</small></div>
    </section>
    <section className="workspace">
      <div className="table-pane"><div className="pane-head"><div><h2>依赖清单</h2><p>逐项查看许可证义务</p></div><div className="tools"><div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索依赖"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="全部">全部状态</option><option value="ok">安全</option><option value="warn">复核</option><option value="risk">高风险</option></select></div></div>
        <div className="table"><div className="tr th"><span>依赖名称</span><span>版本</span><span>许可证</span><span>状态</span></div>{filtered.map(d=><button className={d.id===selected?'tr selected':'tr'} key={d.id} onClick={()=>setSelected(d.id)}><span className="dep-name"><span className="pkg-dot"/> {d.name}</span><span className="muted">{d.version}</span><span>{licChip(d.license)}</span><span className={'status '+d.status}>{d.status==='ok'?<Check size={13}/>:<AlertTriangle size={13}/>} {d.status==='ok'?'安全':d.status==='warn'?'复核':'高风险'}</span></button>)}</div></div>
      {current&&<div className="detail"><div className="detail-head"><div className="detail-icon" style={{background:(colors[current.license]||'#888')+'1c',color:colors[current.license]}}><FileCode2 size={20}/></div><div><span>SELECTED DEPENDENCY</span><h2>{current.name}</h2></div><button className="close" onClick={()=>setSelected(0)}><X size={16}/></button></div>
        <div className="detail-grid"><div><label>版本</label><b>{current.version}</b></div><div><label>来源</label><b>{current.source}</b></div><div><label>许可证</label><b>{current.license}</b></div><div><label>发布批次</label><b>{batchOf(current)?.name||'-'}</b></div><div><label>分发方式</label><b>{batchOf(current)?.distribution||'-'}</b></div><div><label>许可兼容</label><b style={{color:compatible(current.license,batchOf(current)?.distribution||'内部使用')?'#159e7e':'#d66c5e'}}>{compatible(current.license,batchOf(current)?.distribution||'内部使用')?'满足':'冲突'}</b></div></div>
        <div className={'finding '+current.status}><div className="finding-icon">{current.status==='ok'?<Check size={16}/>:<AlertTriangle size={16}/>}</div><div><b>{current.status==='ok'?'可以放心使用':current.status==='warn'?'需要保留声明':'存在分发限制'}</b><p>{current.note}。扫描结果基于 package 元数据，请在发布前查看完整许可证文本。</p></div></div>
        {current.status==='risk'&&(()=>{const rem=rems.find(r=>r.depId===current.id);return <div className="rem-link"><div><b>整改状态</b><p>{rem?`${rem.action==='replace'?`替换为 ${rem.replacement||'（待定）'}@${rem.targetVersion||'（待定）'}`:'保留原依赖'} · ${remStatusLabel(rem.status)}${rem.action==='retain'?` · ${reviewLabel(rem.review)}`:''}`:'尚未建立整改项，发布门禁已拦截该依赖所在批次。'}</p></div><button className="primary sm" onClick={()=>{if(!rem)createRem(current.id);setView('remediation');}}>{rem?'前往整改台':'发起整改'}</button></div>;})()}
        <div className="full-license"><div><Info size={15}/><span>许可证摘要</span></div><p>{current.license} 允许在满足其条款的前提下使用和分发代码。详细义务请参考项目仓库中的 LICENSE 文件。</p></div></div>}
    </section>
  </>;

  const renderRemediation=()=>{
    const riskDeps=deps.filter(d=>d.status==='risk');
    return <section className="rem-list">
      <div className="section-head"><h2>整改台</h2><p>每个高风险依赖需关联替代包、目标版本、责任人与计划完成日；选择保留须填写法律依据并通过复核。</p></div>
      {riskDeps.length===0&&<div className="empty">当前没有高风险依赖。</div>}
      {riskDeps.map(renderRemCard)}
    </section>;
  };

  const renderGate=()=><section className="gate-list">
    <div className="section-head"><h2>发布门禁</h2><p>同一发布批次中，高风险未完成整改或替代包许可不满足分发方式时，不得标记可发布。规则：{RULES.map(r=>r.id).join(' / ')}。</p></div>
    {batches.map(b=>{
      const cs=conflictsByBatch.get(b.id)||[];
      const pass=cs.length===0;
      const effective=b.released&&pass;
      const bDeps=deps.filter(d=>d.batchId===b.id);
      return <div className="gate-card" key={b.id}>
        <div className="gate-head">
          <div><h3>{b.name}</h3><small>计划发布 {b.releaseDate} · {bDeps.length} 个依赖 · {bDeps.filter(d=>d.status==='risk').length} 个高风险</small></div>
          <label className="dist-select">分发方式<select value={b.distribution} onChange={e=>setDistribution(b.id,e.target.value as Distribution)}>{DISTRIBUTIONS.map(d=><option key={d}>{d}</option>)}</select></label>
          <span className={'pill '+(effective?'done':pass?'doing':'over')}>{effective?'可发布':pass?'待标记':'阻塞'}</span>
        </div>
        {b.released&&!pass&&<div className="banner-warn"><AlertTriangle size={14}/>发布标记已失效：出现新的阻塞冲突，请处理后重新标记。</div>}
        {pass?<div className="gate-pass"><ShieldCheck size={15}/>通过 R1–R4 全部规则，{b.released?`已于 ${b.releasedAt} 标记可发布`:'可标记发布'}。</div>
          :<table className="conflict-table"><thead><tr><th>依赖</th><th>批次</th><th>规则</th><th>阻塞原因</th></tr></thead><tbody>{cs.map((c,i)=><tr key={i}><td className="dep-name">{c.dep}</td><td>{c.batch}</td><td><span className="rule-chip">{c.rule}</span></td><td className="reason">{c.reason}</td></tr>)}</tbody></table>}
        <div className="gate-actions">
          {!b.released?<button className="primary sm" disabled={!pass} title={pass?'':'存在阻塞冲突，不得标记可发布'} onClick={()=>toggleRelease(b.id)}><ShieldCheck size={14}/>标记可发布</button>
            :<button className="outline sm" onClick={()=>toggleRelease(b.id)}><ShieldX size={14}/>撤销发布标记</button>}
          {!pass&&<span className="gate-hint">{cs.length} 条冲突待处理</span>}
        </div>
      </div>;
    })}
  </section>;

  const renderLogs=()=><section>
    <div className="section-head"><h2>处理记录</h2><p>整改、复核、快照固化与发布标记的完整审计轨迹，刷新后仍与整改项和门禁对应。</p></div>
    <div className="log-pane"><table className="log-table"><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>依赖</th><th>批次</th><th>详情</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td className="muted">{l.at}</td><td>{l.actor}</td><td><span className="rule-chip">{l.action}</span></td><td>{l.dep||'—'}</td><td>{l.batch||'—'}</td><td className="reason">{l.detail||'—'}</td></tr>)}</tbody></table></div>
  </section>;

  return <div className="shell">
    <aside>
      <div className="brand"><div className="brand-icon"><ShieldCheck size={18}/></div><div><b>License Lens</b><small>release gate</small></div></div>
      <div className="nav-title">WORKSPACE</div>
      <button className={view==='overview'?'nav active':'nav'} onClick={()=>setView('overview')}><Layers3 size={16}/>依赖总览</button>
      <button className={view==='remediation'?'nav active':'nav'} onClick={()=>setView('remediation')}><ClipboardList size={16}/>整改台 {openRisk>0&&<span className="red">{openRisk}</span>}</button>
      <button className={view==='gate'?'nav active':'nav'} onClick={()=>setView('gate')}><ShieldCheck size={16}/>发布门禁 {allConflicts.length>0&&<span className="red">{allConflicts.length}</span>}</button>
      <button className={view==='logs'?'nav active':'nav'} onClick={()=>setView('logs')}><History size={16}/>处理记录 <span>{logs.length}</span></button>
      <div className="aside-bottom"><div className="mini-card"><Sparkles size={16}/><div><b>扫描已更新</b><small>刚刚完成 {deps.length} 个依赖的分析</small></div></div><div className="user"><div className="avatar">ZL</div><span>Zen Li</span></div></div>
    </aside>
    <main>
      <header><div><div className="crumb">WORKSPACE / <b>RELEASE GATE</b></div><h1>发布前依赖整改台</h1><p>整改高风险依赖，通过门禁后再标记发布。</p></div><div className="head-actions"><button className="outline" onClick={exportMd}><Download size={15}/>导出报告</button><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/>添加依赖</button></div></header>
      {view==='overview'&&renderOverview()}
      {view==='remediation'&&renderRemediation()}
      {view==='gate'&&renderGate()}
      {view==='logs'&&renderLogs()}
    </main>
    {showAdd&&<div className="backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>添加依赖</h2><button onClick={()=>setShowAdd(false)}>×</button></div>
      <label>依赖名称<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="例如 date-fns"/></label>
      <label>许可证<select value={license} onChange={e=>setLicense(e.target.value)}>{LICENSES.map(l=><option key={l}>{l}</option>)}</select></label>
      <label>发布批次<select value={addBatch} onChange={e=>setAddBatch(Number(e.target.value))}>{batches.map(b=><option key={b.id} value={b.id}>{b.name}（{b.distribution}）</option>)}</select></label>
      <button className="primary full" onClick={addDep}>加入扫描</button></div></div>}
  </div>;
}

import { useMemo, useState, type JSX } from 'react';
import {
  AlertTriangle, ClipboardList, FileWarning, Flag, GitPullRequest, Package,
  RotateCw, Scale, Search, ShieldCheck,
} from 'lucide-react';
import type { Store } from '../store';
import { Batch, LogRecord, RecordKind, fmt } from '../license/core';

const KIND_ICON: Record<RecordKind, JSX.Element> = {
  scan: <RotateCw size={14} />,
  batch: <Flag size={14} />,
  dep: <Package size={14} />,
  plan: <ClipboardList size={14} />,
  replace: <GitPullRequest size={14} />,
  review: <Scale size={14} />,
  snapshot: <ShieldCheck size={14} />,
  gate: <AlertTriangle size={14} />,
};

const KIND_LABEL: Record<RecordKind, string> = {
  scan: '扫描', batch: '批次', dep: '依赖', plan: '计划',
  replace: '替换', review: '复核', snapshot: '快照', gate: '门禁',
};

export default function Records({ store }: { store: Store }) {
  const [batchId, setBatchId] = useState<number>(0);
  const [query, setQuery] = useState('');

  const batchById = useMemo(() => {
    const m = new Map<number, Batch>();
    store.batches.forEach((b) => m.set(b.id, b));
    return m;
  }, [store.batches]);

  const filtered = useMemo(() => store.records.filter((r) => {
    if (batchId && r.batchId !== batchId) return false;
    if (query && !`${r.message}${r.detail ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [store.records, batchId, query]);

  const readyBatches = store.batches.filter((b) => b.markedReady);
  const totalBlocks = store.batches.reduce((n, b) => n + store.blocksOf(b).length, 0);

  return (
    <>
      <section className="records-hero">
        <div className="records-stat">
          <ClipboardList size={18} /><div><b>{store.records.length}</b><span>处理记录</span></div>
        </div>
        <div className="records-stat">
          <Flag size={18} /><div><b>{store.batches.length}</b><span>发布批次</span></div>
        </div>
        <div className="records-stat ok">
          <ShieldCheck size={18} /><div><b>{readyBatches.length}</b><span>已标记可发布</span></div>
        </div>
        <div className={'records-stat ' + (totalBlocks ? 'bad' : 'ok')}>
          <FileWarning size={18} /><div><b>{totalBlocks}</b><span>当前门禁阻塞</span></div>
        </div>
      </section>

      <section className="records-pane">
        <div className="pane-head">
          <div><h2>处理记录</h2><p>所有计划、替换、复核、快照与门禁动作均留痕，并与依赖 / 批次对应</p></div>
          <div className="tools">
            <div className="search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索记录" /></div>
            <select value={batchId} onChange={(e) => setBatchId(Number(e.target.value))}>
              <option value={0}>全部批次</option>
              {store.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value={-1}>全局（无批次）</option>
            </select>
          </div>
        </div>

        <div className="timeline">
          {filtered.map((r) => <TimelineRow key={r.id} r={r} batchName={r.batchId ? batchById.get(r.batchId)?.name : undefined} />)}
          {filtered.length === 0 && <p className="muted pad">没有匹配的处理记录。</p>}
        </div>
      </section>
    </>
  );
}

function TimelineRow({ r, batchName }: { r: LogRecord; batchName?: string }) {
  return (
    <div className={'tl-row kind-' + r.kind}>
      <div className="tl-icon">{KIND_ICON[r.kind]}</div>
      <div className="tl-body">
        <div className="tl-top">
          <span className={'tl-kind k-' + r.kind}>{KIND_LABEL[r.kind]}</span>
          {batchName && <span className="tl-batch">{batchName}</span>}
          <span className="tl-time">{fmt(r.at)}</span>
        </div>
        <b className="tl-msg">{r.message}</b>
        {r.detail && <p className="tl-detail">{r.detail}</p>}
        <small className="tl-actor">{r.actor}</small>
      </div>
    </div>
  );
}

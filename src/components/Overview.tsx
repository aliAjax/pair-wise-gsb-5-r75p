import { useMemo, useState, type JSX } from 'react';
import {
  AlertTriangle, Check, Info, Link2, Pencil, Search, ShieldCheck, X,
} from 'lucide-react';
import type { Store } from '../store';
import {
  Batch, Dep, Dist, DIST_HINTS, DIST_LABELS, Item, LICENSES, LICENSE_IDS,
  Verdict, licenseDef,
} from '../license/core';

const colors = Object.fromEntries(Object.values(LICENSES).map((l) => [l.id, l.color]));

function VerdictDot({ v }: { v: Verdict }) {
  return (
    <span className={'verdict-dot ' + v}>
      {v === 'allow' ? <Check size={11} /> : v === 'deny' ? <X size={11} /> : <AlertTriangle size={10} />}
    </span>
  );
}

function statusOf(d: Dep): { cls: string; text: string; icon: JSX.Element } {
  return d.status === 'ok'
    ? { cls: 'ok', text: '安全', icon: <Check size={13} /> }
    : d.status === 'warn'
      ? { cls: 'warn', text: '复核', icon: <AlertTriangle size={13} /> }
      : { cls: 'risk', text: '高风险', icon: <AlertTriangle size={13} /> };
}

function DistMatrix({ license, active }: { license: string; active?: Dist }) {
  const def = licenseDef(license);
  return (
    <div className="dist-matrix">
      {(Object.keys(DIST_LABELS) as Dist[]).map((k) => (
        <div key={k} className={'dist-cell ' + def.rules[k].v + (active === k ? ' active' : '')}>
          <VerdictDot v={def.rules[k].v} />
          <span>{DIST_LABELS[k]}</span>
        </div>
      ))}
    </div>
  );
}

function ItemChips({ store, dep }: { store: Store; dep: Dep }) {
  const linked = store.items.filter((i) => i.depId === dep.id);
  if (!linked.length) return null;
  return (
    <div className="item-chips">
      <Link2 size={12} />
      {linked.map((i) => {
        const b = store.batches.find((x) => x.id === i.batchId);
        const cls =
          i.decision === 'replace' ? (i.progress === 'done' ? 'ok' : 'warn')
            : i.review === 'approved' ? 'ok' : i.review === 'submitted' ? 'warn' : 'risk';
        return (
          <span key={i.id} className={'chip ' + cls} title={i.decision === 'replace' ? '替换整改' : '保留待复核'}>
            {b?.name ?? '批次 ' + i.batchId}
            {i.decision === 'replace'
              ? i.progress === 'done' ? ' · 替换完成' : ' · 替换中'
              : i.review === 'approved' ? ' · 保留已复核' : i.review === 'submitted' ? ' · 复核中' : ' · 保留'}
          </span>
        );
      })}
    </div>
  );
}

function EditFields({ dep, onSave, onCancel }: { dep: Dep; onSave: (p: { version: string; license: string; note: string }) => void; onCancel: () => void }) {
  const [version, setVersion] = useState(dep.version);
  const [license, setLicense] = useState(dep.license);
  const [note, setNote] = useState(dep.note);
  return (
    <div className="edit-form">
      <label>版本<input value={version} onChange={(e) => setVersion(e.target.value)} /></label>
      <label>许可证
        <select value={license} onChange={(e) => setLicense(e.target.value)}>
          {LICENSE_IDS.map((id) => <option key={id} value={id}>{licenseDef(id).label}</option>)}
        </select>
      </label>
      <label>备注<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="edit-actions">
        <button className="primary" onClick={() => onSave({ version: version.trim() || '1.0.0', license, note })}>保存</button>
        <button className="outline" onClick={onCancel}>取消</button>
      </div>
      <p className="edit-warn">变更已复核保留项的许可证或版本，将与固化快照冲突并阻塞对应批次发布。</p>
    </div>
  );
}

function DetailPane({ store, depId, onClose }: { store: Store; depId: number; onClose: () => void }) {
  const dep = store.deps.find((d) => d.id === depId);
  const [editing, setEditing] = useState(false);
  if (!dep) return null;
  const st = statusOf(dep);
  const def = licenseDef(dep.license);
  const linked: { item: Item; batch?: Batch }[] = store.items
    .filter((i) => i.depId === dep.id)
    .map((item) => ({ item, batch: store.batches.find((b) => b.id === item.batchId) }));

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: (colors[dep.license] || '#888') + '1c', color: colors[dep.license] }}>
          <ShieldCheck size={20} />
        </div>
        <div>
          <span>SELECTED DEPENDENCY</span>
          <h2>{dep.name}</h2>
        </div>
        <button className="icon-btn" title="编辑依赖" onClick={() => setEditing(true)}><Pencil size={14} /></button>
        <button className="close" onClick={onClose}><X size={16} /></button>
      </div>

      {editing ? (
        <EditFields
          dep={dep}
          onCancel={() => setEditing(false)}
          onSave={(p) => { store.updateDep(dep.id, p); setEditing(false); }}
        />
      ) : (
        <>
          <div className="detail-grid">
            <div><label>版本</label><b>{dep.version}</b></div>
            <div><label>来源</label><b>{dep.source}</b></div>
            <div><label>许可证</label><b>{def.label}</b></div>
          </div>
          <div className={'finding ' + dep.status}>
            <div className="finding-icon">
              {dep.status === 'ok' ? <Check size={16} /> : <AlertTriangle size={16} />}
            </div>
            <div>
              <b>{dep.status === 'ok' ? '可以放心使用' : dep.status === 'warn' ? '需要保留声明' : '存在分发限制，须纳入整改'}</b>
              <p>{dep.note}。扫描结果基于 package 元数据，请在发布前查看完整许可证文本。</p>
            </div>
          </div>

          <div className="block-title">
            <Info size={13} /> 许可证 × 分发方式判定
          </div>
          <DistMatrix license={dep.license} />
          <p className="rule-text">{def.rules.closed.text.split('（')[0]}；其余分发方式见上方矩阵。</p>

          {linked.length > 0 && (
            <>
              <div className="block-title"><Link2 size={13} /> 整改关联（{linked.length}）</div>
              <div className="linked-list">
                {linked.map(({ item, batch }) => (
                  <div key={item.id} className="linked-row">
                    <div>
                      <b>{batch?.name ?? '已删除批次'}</b>
                      <small>
                        {batch && <>分发方式：{DIST_LABELS[batch.distMethod]} · {DIST_HINTS[batch.distMethod]}<br /></>}
                        {item.decision === 'replace'
                          ? <>替换 {item.replacementName || '—'}{item.replacementVersion ? '@' + item.replacementVersion : ''}（{licenseDef(item.replacementLicense).label}） · {item.owner || '未指派'} · {item.dueDate || '未定日期'}</>
                          : item.decision === 'keep'
                            ? <>保留原依赖 · {item.owner || '未指派'} · {item.dueDate || '未定日期'} · {item.review === 'approved' ? '复核通过（快照已固化）' : item.review === 'submitted' ? '复核中' : item.review === 'rejected' ? '复核驳回' : '未提交复核'}</>
                            : '尚未选择处置决策'}
                      </small>
                    </div>
                    <span className={'status ' + st.cls}>
                      {item.decision === 'replace'
                        ? item.progress === 'done' ? <Check size={12} /> : <AlertTriangle size={12} />
                        : item.review === 'approved' ? <Check size={12} /> : <AlertTriangle size={12} />}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {dep.status === 'risk' && linked.length === 0 && (
            <div className="full-license" style={{ background: '#fff1ef', border: '1px solid #f6d6d1' }}>
              <div style={{ color: '#c7614f' }}><AlertTriangle size={14} /><span>该高风险依赖尚未关联任何发布批次</span></div>
              <p>请在“发布门禁”页为对应批次建立整改项，否则该批次无法标记可发布。</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Overview({ store }: { store: Store }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('全部');
  const [selected, setSelected] = useState(5);

  const filtered = useMemo(
    () => store.deps.filter(
      (d) => (filter === '全部' || d.status === filter) &&
        `${d.name}${d.license}`.toLowerCase().includes(query.toLowerCase()),
    ),
    [store.deps, filter, query],
  );
  const current = store.deps.find((d) => d.id === selected);

  return (
    <>
      <section className="hero">
        <div>
          <span className="tag">PROJECT · AURORA-WEB</span>
          <h2>发布前，先把许可证风险整改到位。</h2>
          <p>
            扫描 <b>{store.deps.length} 个依赖</b>，其中 <b className="warning">{store.deps.filter((d) => d.status === 'risk').length} 个高风险依赖</b>
            须关联替代包、目标版本、责任人与计划完成日；保留原依赖须填写法律依据并经复核。
          </p>
        </div>
        <div className="scan-score">
          <div className="score-ring"><strong>{Math.round(store.deps.filter((d) => d.status === 'ok').length / store.deps.length * 100)}<small>%</small></strong></div>
          <div><span>兼容评分</span><b>{store.deps.filter((d) => d.status === 'risk').length ? '待整改' : '良好'}</b><small>数据已持久化，刷新不丢失</small></div>
        </div>
      </section>
      <section className="summary">
        <div><span>全部依赖</span><b>{store.deps.length}</b><small>npm + 手动录入</small></div>
        <div><span>安全许可</span><b className="teal">{store.deps.filter((d) => d.status === 'ok').length}</b><small>可直接分发</small></div>
        <div><span>需要复核</span><b className="orange">{store.deps.filter((d) => d.status === 'warn').length}</b><small>保留声明即可</small></div>
        <div><span>高风险</span><b className="red">{store.deps.filter((d) => d.status === 'risk').length}</b><small>必须整改或复核保留</small></div>
      </section>
      <section className="workspace">
        <div className="table-pane">
          <div className="pane-head">
            <div>
              <h2>依赖清单</h2>
              <p>逐项查看许可证义务与分发方式判定</p>
            </div>
            <div className="tools">
              <div className="search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索依赖" /></div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="全部">全部状态</option>
                <option value="ok">安全</option>
                <option value="warn">复核</option>
                <option value="risk">高风险</option>
              </select>
            </div>
          </div>
          <div className="table">
            <div className="tr th"><span>依赖名称</span><span>版本</span><span>许可证</span><span>状态</span></div>
            {filtered.map((d) => {
              const s = statusOf(d);
              return (
                <button className={d.id === selected ? 'tr selected' : 'tr'} key={d.id} onClick={() => setSelected(d.id)}>
                  <span className="dep-name"><span className={'pkg-dot ' + d.status} /> {d.name}</span>
                  <span className="muted">{d.version}</span>
                  <span><i className="license" style={{ color: colors[d.license] || '#888', background: (colors[d.license] || '#888') + '18' }}>{licenseDef(d.license).label}</i></span>
                  <span className={'status ' + s.cls}>{s.icon} {s.text}</span>
                </button>
              );
            })}
          </div>
        </div>
        {current && <DetailPane store={store} depId={current.id} onClose={() => setSelected(0)} />}
      </section>
    </>
  );
}

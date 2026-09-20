import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Ban, Check, CheckCircle2, ClipboardList, FileWarning,
  Flag, GitPullRequest, Lock, Plus, Scale, Send, Trash2, X,
} from 'lucide-react';
import type { Store } from '../store';
import {
  Batch, Block, Decision, Dep, Dist, DIST_HINTS, DIST_LABELS, Item, Progress,
  GATE_RULES, KNOWN_PACKAGES, LICENSE_IDS, REPLACE_SUGGESTIONS,
  fmtDate, licenseDef, planMissing,
} from '../license/core';

const PROGRESS_LABEL: Record<Progress, string> = { pending: '待处理', doing: '进行中', done: '已完成' };

function useDraft(item: Item) {
  const [decision, setDecision] = useState<Decision>(item.decision);
  const [rpName, setRpNameRaw] = useState(item.replacementName);
  const [rpVersion, setRpVersion] = useState(item.replacementVersion);
  const [rpLicense, setRpLicense] = useState(item.replacementLicense);
  const [owner, setOwner] = useState(item.owner);
  const [due, setDue] = useState(item.dueDate);
  const [basis, setBasis] = useState(item.legalBasis);

  // store 侧（决策按钮、进度、复核）变化后同步本地草稿，避免旧草稿覆盖已保存值
  useEffect(() => {
    setDecision(item.decision);
    setRpNameRaw(item.replacementName);
    setRpVersion(item.replacementVersion);
    setRpLicense(item.replacementLicense);
    setOwner(item.owner);
    setDue(item.dueDate);
    setBasis(item.legalBasis);
    // 仅以持久化对象的更新时间作为同步信号，输入过程不打断
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.updatedAt, item.decision, item.progress, item.review]);

  const setRpName = (name: string) => {
    setRpNameRaw(name);
    const known = KNOWN_PACKAGES.find((p) => p.name === name);
    if (known) { setRpVersion(known.version); setRpLicense(known.license); }
  };

  const patchFromDraft = (): Partial<Item> => ({
    decision, owner: owner.trim(), dueDate: due, legalBasis: basis,
    replacementName: rpName.trim(), replacementVersion: rpVersion.trim(), replacementLicense: rpLicense,
  });

  return {
    decision, setDecision, rpName, setRpName, rpVersion, setRpVersion,
    rpLicense, setRpLicense, owner, setOwner, due, setDue, basis, setBasis, patchFromDraft,
  };
}

/** 单个高风险依赖的整改卡 */
function RemedyCard({
  store, batch, dep, item, blocks,
}: { store: Store; batch: Batch; dep: Dep; item?: Item; blocks: Block[] }) {
  const def = licenseDef(dep.license);

  if (!item) {
    return (
      <div className="remedy-card missing">
        <div className="remedy-head">
          <div className="remedy-dep">
            <span className="risk-badge"><AlertTriangle size={13} />高风险</span>
            <b>{dep.name}</b><span className="muted">{dep.version}</span>
            <i className="license" style={{ color: def.color, background: def.color + '18' }}>{def.label}</i>
          </div>
          <button className="primary sm" onClick={() => store.createItem(batch.id, dep.id)}>
            <Plus size={13} />建立整改关联
          </button>
        </div>
        <p className="remedy-missing-hint">
          {blocks.find((b) => b.code === 'NO_ITEM')?.reason ?? '该依赖尚未建立整改项'}
          <br />规则：{GATE_RULES.ITEM.code} — {GATE_RULES.ITEM.text}
        </p>
      </div>
    );
  }

  return <RemedyForm store={store} batch={batch} dep={dep} item={item} blocks={blocks} />;
}

function RemedyForm({ store, batch, dep, item, blocks }: { store: Store; batch: Batch; dep: Dep; item: Item; blocks: Block[] }) {
  const d = useDraft(item);
  const def = licenseDef(dep.license);
  const myBlocks = blocks.filter((b) => b.itemId === item.id || (b.depId === dep.id && !b.itemId));
  const locked = item.review === 'approved' && !!item.snapshot;

  const save = () => store.savePlan(item.id, d.patchFromDraft());

  const chooseReplace = () => {
    d.setDecision('replace');
    if (!d.rpName) {
      const sug = REPLACE_SUGGESTIONS[dep.name];
      if (sug) { d.setRpName(sug.name); d.setRpVersion(sug.version); d.setRpLicense(sug.license); }
    }
    store.savePlan(item.id, {
      decision: 'replace',
      replacementName: d.rpName || REPLACE_SUGGESTIONS[dep.name]?.name || '',
      replacementVersion: d.rpVersion || REPLACE_SUGGESTIONS[dep.name]?.version || '',
      replacementLicense: d.rpLicense !== 'UNKNOWN' ? d.rpLicense : REPLACE_SUGGESTIONS[dep.name]?.license || 'UNKNOWN',
      owner: d.owner, dueDate: d.due,
    });
  };

  const chooseKeep = () => {
    d.setDecision('keep');
    store.savePlan(item.id, { decision: 'keep', owner: d.owner, dueDate: d.due, legalBasis: d.basis });
  };

  const setProgress = (p: Progress) => {
    store.savePlan(item.id, d.patchFromDraft());
    store.setProgress(item.id, p);
  };

  const submit = () => {
    if (!d.basis.trim()) return;
    store.savePlan(item.id, { legalBasis: d.basis, owner: d.owner, dueDate: d.due });
    store.submitReview(item.id);
  };

  const rpDef = licenseDef(d.rpLicense);
  const rpVerdict = rpDef.rules[batch.distMethod];
  const dueOverdue = !!d.due && item.progress !== 'done' && d.due < fmtDate(new Date().toISOString());

  return (
    <div className={'remedy-card' + (myBlocks.length ? '' : ' clean')}>
      <div className="remedy-head">
        <div className="remedy-dep">
          <span className="risk-badge"><AlertTriangle size={13} />高风险</span>
          <b>{dep.name}</b><span className="muted">{dep.version}</span>
          <i className="license" style={{ color: def.color, background: def.color + '18' }}>{def.label}</i>
        </div>
        <div className="remedy-meta">
          {d.due && <span className={dueOverdue ? 'overdue' : ''}>计划完成 {d.due}{dueOverdue && ' · 已逾期'}</span>}
          {item.review === 'approved' && <span className="chip ok"><Lock size={11} />快照已固化</span>}
        </div>
      </div>

      {/* 决策 */}
      <div className="decision-row">
        <button className={'decision ' + (d.decision === 'replace' ? 'active replace' : '')} onClick={chooseReplace}>
          <GitPullRequest size={14} />替换为替代包
        </button>
        <button className={'decision ' + (d.decision === 'keep' ? 'active keep' : '')} onClick={chooseKeep}>
          <Scale size={14} />保留原依赖
        </button>
      </div>

      {/* 通用：责任人 + 计划完成日 */}
      <div className="plan-row">
        <label>责任人<input placeholder="指派负责人" value={d.owner} onChange={(e) => d.setOwner(e.target.value)} onBlur={save} /></label>
        <label>计划完成日<input type="date" value={d.due} onChange={(e) => d.setDue(e.target.value)} onBlur={save} /></label>
      </div>

      {d.decision === 'replace' && (
        <div className="branch replace-branch">
          <div className="plan-row">
            <label>替代包
              <input list="known-packages" placeholder="例如 fast-parse" value={d.rpName}
                onChange={(e) => d.setRpName(e.target.value)} onBlur={save} />
              <datalist id="known-packages">
                {KNOWN_PACKAGES.map((p) => <option key={p.name} value={p.name} />)}
              </datalist>
            </label>
            <label>目标版本<input placeholder="例如 3.2.0" value={d.rpVersion} onChange={(e) => d.setRpVersion(e.target.value)} onBlur={save} /></label>
            <label>替代包许可证
              <select value={d.rpLicense} onChange={(e) => d.setRpLicense(e.target.value)} onBlur={save}>
                {LICENSE_IDS.map((id) => <option key={id} value={id}>{licenseDef(id).label}</option>)}
              </select>
            </label>
          </div>
          <div className={'verdict-line ' + rpVerdict.v}>
            {rpVerdict.v === 'allow' ? <CheckCircle2 size={14} /> : rpVerdict.v === 'deny' ? <Ban size={14} /> : <AlertTriangle size={14} />}
            <div>
              <b>{rpDef.label} × {DIST_LABELS[batch.distMethod]}：
                {rpVerdict.v === 'allow' ? ' 满足当前分发方式' : rpVerdict.v === 'deny' ? ' 不满足，门禁将阻塞发布' : ' 需履行声明义务'}
              </b>
              <p>{rpVerdict.text}</p>
            </div>
          </div>
          <div className="progress-row">
            {(['pending', 'doing', 'done'] as Progress[]).map((p) => (
              <button key={p} className={'step ' + (item.progress === p ? 'on ' + p : '') + (p === 'done' && planMissing(item).length === 0 ? '' : '')}
                onClick={() => setProgress(p)}>{PROGRESS_LABEL[p]}</button>
            ))}
            <span className="progress-hint">
              <ArrowRight size={12} />
              {dep.name} → {d.rpName || '替代包'}{d.rpVersion ? '@' + d.rpVersion : ''}
            </span>
          </div>
        </div>
      )}

      {d.decision === 'keep' && (
        <div className="branch keep-branch">
          <label className="basis-label">法律依据（必填，提交后进入复核）
            <textarea rows={3} placeholder="说明不触发 copyleft 的事实与依据：如使用形态（独立进程/动态链接）、商业授权编号、SaaS 不传送副本等"
              value={d.basis} onChange={(e) => d.setBasis(e.target.value)} onBlur={save} />
          </label>
          <div className="review-row">
            <span className={'review-state ' + item.review}>
              {item.review === 'none' && <><AlertTriangle size={13} />未提交复核</>}
              {item.review === 'submitted' && <><Send size={13} />已提交，等待法务复核</>}
              {item.review === 'approved' && <><CheckCircle2 size={13} />复核通过 · {item.reviewer} · {item.reviewedAt && fmtDate(item.reviewedAt)}</>}
              {item.review === 'rejected' && <><Ban size={13} />复核驳回，请补充依据</>}
            </span>
            {item.review !== 'submitted' && (
              <button className="outline sm" disabled={!d.basis.trim() || locked} onClick={submit}>
                <Send size={13} />{item.review === 'rejected' ? '重新提交复核' : '提交复核'}
              </button>
            )}
          </div>

          {/* 复核操作台：当前用户兼演示复核人 */}
          {item.review === 'submitted' && (
            <div className="review-console">
              <span>复核台（{batch.name}）</span>
              <button className="primary sm" onClick={() => store.decideReview(item.id, true)}>
                <Check size={13} />复核通过并固化快照
              </button>
              <button className="danger-outline sm" onClick={() => {
                const c = window.prompt('驳回意见（可选）') ?? null;
                store.decideReview(item.id, false, c || undefined);
              }}><X size={13} />驳回</button>
            </div>
          )}

          {locked && item.snapshot && (
            <div className="snapshot-box">
              <div className="snap-head"><Lock size={13} /><b>固化快照</b><span>复核后锁定，刷新后保持对应</span></div>
              <div className="snap-grid">
                <div><label>依赖版本</label><b>{item.snapshot.depVersion}</b></div>
                <div><label>许可证</label><b>{licenseDef(item.snapshot.license).label}</b></div>
                <div><label>分发方式</label><b>{DIST_LABELS[item.snapshot.distMethod]}</b></div>
                <div><label>复核人</label><b>{item.snapshot.reviewer}</b></div>
              </div>
              <p className="snap-basis">{item.snapshot.basis}</p>
            </div>
          )}
        </div>
      )}

      {/* 阻塞提示 */}
      {myBlocks.length > 0 && (
        <ul className="card-blocks">
          {myBlocks.map((b, i) => (
            <li key={i}>
              <AlertTriangle size={12} />
              <span><code>{b.ruleCode}</code> {b.reason}</span>
            </li>
          ))}
        </ul>
      )}
      {myBlocks.length === 0 && d.decision && (
        <div className="card-ok"><Check size={12} />本项满足批次“{DIST_LABELS[batch.distMethod]}”门禁要求</div>
      )}
    </div>
  );
}

function AddBatchModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const [name, setName] = useState('');
  const [dist, setDist] = useState<Dist>('closed');
  const [date, setDate] = useState('2026-10-01');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>新建发布批次</h2><button onClick={onClose}>×</button></div>
        <label>批次名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 v2.5.0 Aurora" /></label>
        <label>分发方式
          <select value={dist} onChange={(e) => setDist(e.target.value as Dist)}>
            {(Object.keys(DIST_LABELS) as Dist[]).map((k) => <option key={k} value={k}>{DIST_LABELS[k]}</option>)}
          </select>
          <small className="field-hint">{DIST_HINTS[dist]}</small>
        </label>
        <label>计划发布日<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="primary full" disabled={!name.trim()} onClick={() => { store.addBatch(name, dist, date); onClose(); }}>
          <Plus size={14} />创建批次
        </button>
      </div>
    </div>
  );
}

export default function Gate({ store }: { store: Store }) {
  const [activeId, setActiveId] = useState(store.batches[0]?.id ?? 0);
  const [showAdd, setShowAdd] = useState(false);

  const batch = store.batches.find((b) => b.id === activeId) ?? store.batches[0];
  const blocks = useMemo(() => (batch ? store.blocksOf(batch) : []), [store, batch]);
  if (!batch) {
    return (
      <section className="empty-page">
        <Flag size={26} /><h2>还没有发布批次</h2>
        <p>创建发布批次后，可按分发方式对高风险依赖执行替换或保留复核门禁。</p>
        <button className="primary" onClick={() => setShowAdd(true)}><Plus size={15} />新建发布批次</button>
        {showAdd && <AddBatchModal store={store} onClose={() => setShowAdd(false)} />}
      </section>
    );
  }

  const riskDeps = store.deps.filter((d) => d.status === 'risk');
  const otherDeps = store.deps.filter((d) => d.status !== 'risk');
  const blocked = blocks.length > 0;

  return (
    <>
      <section className="batch-tabs">
        {store.batches.map((b) => {
          const bs = store.blocksOf(b);
          return (
            <button key={b.id} className={b.id === batch.id ? 'batch-tab active' : 'batch-tab'} onClick={() => setActiveId(b.id)}>
              <span className="batch-tab-name">{b.name}</span>
              <span className={'batch-tab-state ' + (b.markedReady ? 'ok' : bs.length ? 'block' : 'pass')}>
                {b.markedReady ? <Check size={11} /> : bs.length ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                {b.markedReady ? '可发布' : bs.length ? `${bs.length} 项阻塞` : '门禁通过'}
              </span>
            </button>
          );
        })}
        <button className="batch-tab add" onClick={() => setShowAdd(true)}><Plus size={14} />新批次</button>
      </section>

      <section className={'gate-banner ' + (blocked ? 'block' : 'pass')}>
        <div className="gate-icon">
          {blocked ? <FileWarning size={22} /> : <ShieldOk />}
        </div>
        <div className="gate-text">
          <h2>{blocked ? `发布门禁未通过：${blocks.length} 项阻塞` : '发布门禁全部通过'}</h2>
          <p>
            批次 <b>{batch.name}</b> · 分发方式
            <select className="dist-select" value={batch.distMethod} onChange={(e) => store.changeDist(batch.id, e.target.value as Dist)}>
              {(Object.keys(DIST_LABELS) as Dist[]).map((k) => <option key={k} value={k}>{DIST_LABELS[k]}</option>)}
            </select>
            · 计划发布 {batch.releaseDate}
            {blocked
              ? '。同一发布批次中高风险依赖未完成整改，或替代包许可证不满足当前分发方式时，不得标记可发布。'
              : '。高风险依赖已完成整改或经复核保留（快照已固化），可标记可发布。'}
          </p>
        </div>
        <div className="gate-actions">
          {batch.markedReady ? (
            <>
              <span className="ready-stamp"><Check size={14} />已标记可发布 · {batch.markedReady.by} · {fmtDate(batch.markedReady.at)}</span>
              <button className="outline sm" onClick={() => store.revokeReady(batch.id)}>撤销标记</button>
            </>
          ) : (
            <button className="primary" disabled={blocked} onClick={() => store.markReady(batch.id)}>
              <Flag size={15} />标记可发布
            </button>
          )}
          <button className="danger-ghost" title="删除批次" onClick={() => {
            if (window.confirm(`删除批次 ${batch.name}？整改关联将一并移除（处理记录保留）。`)) {
              store.deleteBatch(batch.id);
            }
          }}><Trash2 size={14} /></button>
        </div>
      </section>

      <section className="gate-body">
        <div className="remedy-list">
          <div className="list-head">
            <h3><ClipboardList size={15} /> 高风险依赖整改（{riskDeps.length}）</h3>
            <span>{DIST_HINTS[batch.distMethod]}</span>
          </div>
          {riskDeps.map((dep) => (
            <RemedyCard
              key={dep.id}
              store={store}
              batch={batch}
              dep={dep}
              item={store.itemOf(batch.id, dep.id)}
              blocks={blocks}
            />
          ))}
          {riskDeps.length === 0 && <p className="muted pad">当前没有高风险依赖。</p>}

          <div className="list-head second"><h3>其他依赖（{otherDeps.length}）</h3><span>无需整改，按许可证义务保留声明即可</span></div>
          <div className="safe-strip">
            {otherDeps.map((d) => {
              const l = licenseDef(d.license);
              const v = l.rules[batch.distMethod];
              return (
                <span key={d.id} className={'safe-pill ' + v.v} title={v.text}>
                  {v.v === 'allow' ? <Check size={11} /> : <AlertTriangle size={11} />}
                  {d.name} <i>{l.label}</i>
                </span>
              );
            })}
          </div>
        </div>

        <aside className="conflict-pane">
          <div className="list-head"><h3><FileWarning size={15} /> 冲突 / 阻塞清单</h3></div>
          {blocks.length === 0 ? (
            <div className="no-conflict">
              <CheckCircle2 size={26} /><b>无阻塞</b>
              <p>整改项、门禁与处理记录均按依赖与批次对应；刷新页面后状态保持一致。</p>
            </div>
          ) : (
            <div className="conflict-table">
              {blocks.map((b, i) => {
                const dep = store.deps.find((x) => x.id === b.depId);
                return (
                  <div className="conflict-row" key={i}>
                    <div className="conflict-top">
                      <span className="conflict-dep">{dep?.name ?? '—'}</span>
                      <span className="conflict-batch">{batch.name}</span>
                    </div>
                    <div className="conflict-rule"><code>{b.ruleCode}</code>{b.rule}</div>
                    <p className="conflict-reason">{b.reason}</p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="rule-legend">
            <b>门禁规则索引</b>
            {Object.values(GATE_RULES).map((r) => (
              <div key={r.code}><code>{r.code}</code><span>{r.text}</span></div>
            ))}
          </div>
        </aside>
      </section>

      {showAdd && <AddBatchModal store={store} onClose={() => setShowAdd(false)} />}
    </>
  );
}

function ShieldOk() {
  return <CheckCircle2 size={22} />;
}

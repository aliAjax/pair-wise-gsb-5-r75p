import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Batch, Block, Dep, Dist, Item, LogRecord, Progress, Review,
  DIST_LABELS, evaluate, licenseDef, now, riskOfLicense,
} from './license/core';
import { ACTOR, REVIEWER, seedBatches, seedDeps, seedItems, seedRecords } from './license/seed';

const KEY = 'license-remedy-v2';

interface PersistShape {
  deps: Dep[];
  batches: Batch[];
  items: Item[];
  records: LogRecord[];
  seq: number;
}

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as PersistShape;
      if (Array.isArray(p.deps) && Array.isArray(p.batches)) return p;
    }
  } catch { /* 忽略损坏数据 */ }
  return { deps: seedDeps, batches: seedBatches, items: seedItems, records: seedRecords, seq: 500 };
}

export interface Store {
  deps: Dep[];
  batches: Batch[];
  items: Item[];
  records: LogRecord[];
  itemsOfBatch: (batchId: number) => Item[];
  itemOf: (batchId: number, depId: number) => Item | undefined;
  blocksOf: (batch: Batch) => Block[];
  addDep: (name: string, license: string) => number;
  updateDep: (id: number, patch: Partial<Pick<Dep, 'version' | 'license' | 'note'>>) => void;
  addBatch: (name: string, distMethod: Dist, releaseDate: string) => number;
  deleteBatch: (id: number) => void;
  changeDist: (id: number, distMethod: Dist) => void;
  createItem: (batchId: number, depId: number) => number;
  savePlan: (id: number, patch: Partial<Item>) => void;
  setProgress: (id: number, progress: Progress) => void;
  submitReview: (id: number) => void;
  decideReview: (id: number, approve: boolean, comment?: string) => void;
  markReady: (batchId: number) => boolean;
  revokeReady: (batchId: number) => void;
  rescan: () => void;
}

export function useStore(): Store {
  const [state, setState] = useState<PersistShape>(load);
  const seqRef = useRef(state.seq);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ ...state, seq: seqRef.current }));
  }, [state]);

  const commit = useCallback(
    (
      fn: (s: PersistShape) => Partial<PersistShape>,
      rec?: (s: PersistShape) => Omit<LogRecord, 'id' | 'at' | 'actor'>,
    ) => {
      setState((s) => {
        const patch = fn(s);
        const next: PersistShape = { ...s, ...patch };
        if (rec) {
          const r = rec(s);
          seqRef.current += 1;
          next.records = [{ ...r, id: seqRef.current, at: now(), actor: ACTOR }, ...s.records];
        }
        return next;
      });
    },
    [],
  );

  const findItem = (s: PersistShape, id: number) => s.items.find((i) => i.id === id);
  const findBatch = (s: PersistShape, id: number) => s.batches.find((b) => b.id === id);
  const findDep = (s: PersistShape, id: number) => s.deps.find((d) => d.id === id);

  const addDep = useCallback((name: string, license: string) => {
    let depId = 0;
    commit(
      (s) => {
        seqRef.current += 1;
        depId = seqRef.current;
        return {
          deps: [
            ...s.deps,
            {
              id: depId, name: name.trim(), version: '1.0.0', license, source: '手动',
              status: riskOfLicense(license),
              note: license === 'MIT' ? '宽松许可，可商用' : '请核对分发义务',
            },
          ],
        };
      },
      () => ({ kind: 'dep', message: `添加依赖 ${name}（${licenseDef(license).label}）` }),
    );
    return depId;
  }, [commit]);

  const updateDep = useCallback((id: number, patch: Partial<Pick<Dep, 'version' | 'license' | 'note'>>) => {
    commit(
      (s) => {
        const dep = findDep(s, id);
        if (!dep) return {};
        const nextLicense = patch.license ?? dep.license;
        return {
          deps: s.deps.map((d) =>
            d.id === id
              ? { ...d, ...patch, license: nextLicense, status: riskOfLicense(nextLicense) }
              : d,
          ),
        };
      },
      (s) => {
        const dep = findDep(s, id);
        const changes: string[] = [];
        if (patch.license && patch.license !== dep?.license)
          changes.push(`许可证 ${licenseDef(dep!.license).label} → ${licenseDef(patch.license).label}`);
        if (patch.version && patch.version !== dep?.version)
          changes.push(`版本 ${dep!.version} → ${patch.version}`);
        return {
          kind: 'dep', depId: id,
          message: `更新依赖 ${dep?.name}：${changes.join('；') || '信息变更'}`,
          detail: changes.some((c) => c.includes('许可证'))
            ? '若该依赖存在已复核通过的保留项，可能与固化快照冲突并阻塞发布'
            : undefined,
        };
      },
    );
  }, [commit]);

  const addBatch = useCallback((name: string, distMethod: Dist, releaseDate: string) => {
    let batchId = 0;
    commit(
      (s) => {
        seqRef.current += 1;
        batchId = seqRef.current;
        return {
          batches: [
            ...s.batches,
            { id: batchId, name: name.trim(), distMethod, releaseDate, markedReady: null, createdAt: now() },
          ],
        };
      },
      () => ({
        kind: 'batch',
        message: `创建发布批次 ${name}`,
        detail: `分发方式：${DIST_LABELS[distMethod]}；计划发布 ${releaseDate}`,
        batchId,
      }),
    );
    return batchId;
  }, [commit]);

  const deleteBatch = useCallback((id: number) => {
    commit(
      (s) => {
        const b = findBatch(s, id);
        return {
          batches: s.batches.filter((x) => x.id !== id),
          items: s.items.filter((x) => x.batchId !== id),
          records: b ? s.records : s.records,
        };
      },
      (s) => {
        const b = findBatch(s, id);
        return { kind: 'batch', message: `删除发布批次 ${b?.name ?? id}，其整改关联一并移除` };
      },
    );
  }, [commit]);

  const changeDist = useCallback((id: number, distMethod: Dist) => {
    commit(
      (s) => {
        const b = findBatch(s, id);
        if (!b || b.distMethod === distMethod) return {};
        return {
          batches: s.batches.map((x) =>
            x.id === id ? { ...x, distMethod, markedReady: null } : x,
          ),
        };
      },
      (s) => {
        const b = findBatch(s, id);
        return {
          kind: 'batch', batchId: id,
          message: `批次 ${b?.name} 分发方式变更为${distMethod === 'closed' ? '闭源商业分发' : distMethod === 'opensource' ? '开源同许可分发' : distMethod === 'saas' ? 'SaaS 云交付' : '内部使用'}`,
          detail: '门禁将按新分发方式重新评估替代包许可证与保留快照；已标记的可发布状态自动撤销',
        };
      },
    );
  }, [commit]);

  const createItem = useCallback((batchId: number, depId: number) => {
    let itemId = 0;
    commit(
      (s) => {
        if (s.items.some((i) => i.batchId === batchId && i.depId === depId)) return {};
        seqRef.current += 1;
        itemId = seqRef.current;
        return {
          items: [...s.items, {
            id: itemId, batchId, depId, decision: '', replacementName: '', replacementVersion: '',
            replacementLicense: 'UNKNOWN', owner: '', dueDate: '', progress: 'pending',
            legalBasis: '', review: 'none', updatedAt: now(),
          }],
        };
      },
      (s) => {
        const dep = findDep(s, depId);
        return { kind: 'plan', batchId, depId, message: `为 ${dep?.name} 建立整改关联` };
      },
    );
    return itemId;
  }, [commit]);

  const savePlan = useCallback((id: number, patch: Partial<Item>) => {
    commit(
      (s) => {
        const item = findItem(s, id);
        if (!item) return {};
        return {
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: now() } : i)),
        };
      },
      (s) => {
        const item = findItem(s, id);
        const dep = item ? findDep(s, item.depId) : undefined;
        const bits: string[] = [];
        if (patch.decision) bits.push(patch.decision === 'replace' ? '决策：替换' : '决策：保留原依赖');
        if (patch.replacementName) bits.push(`替代包 ${patch.replacementName}${patch.replacementVersion ? '@' + patch.replacementVersion : ''}`);
        if (patch.owner) bits.push(`责任人 ${patch.owner}`);
        if (patch.dueDate) bits.push(`计划完成日 ${patch.dueDate}`);
        if (patch.legalBasis !== undefined && patch.legalBasis.trim()) bits.push('已填写法律依据');
        const detail: string[] = [];
        if (patch.decision === 'keep' && item?.review === 'rejected') detail.push('已补充材料，可重新提交复核');
        return {
          kind: 'plan', itemId: id, batchId: item?.batchId, depId: item?.depId,
          message: `更新整改计划：${dep?.name}${bits.length ? '（' + bits.join('，') + '）' : ''}`,
          detail: detail.length ? detail.join('；') : undefined,
        };
      },
    );
  }, [commit]);

  const setProgress = useCallback((id: number, progress: Progress) => {
    commit(
      (s) => {
        const item = findItem(s, id);
        if (!item) return {};
        return { items: s.items.map((i) => (i.id === id ? { ...i, progress, updatedAt: now() } : i)) };
      },
      (s) => {
        const item = findItem(s, id);
        const dep = item ? findDep(s, item.depId) : undefined;
        return {
          kind: 'replace', itemId: id, batchId: item?.batchId, depId: item?.depId,
          message: `替换整改进度更新：${dep?.name} → ${progress === 'doing' ? '进行中' : '已完成'}`,
          detail: progress === 'done' && item ? `已切换至 ${item.replacementName}@${item.replacementVersion}` : undefined,
        };
      },
    );
  }, [commit]);

  const submitReview = useCallback((id: number) => {
    commit(
      (s) => {
        const item = findItem(s, id);
        if (!item || !item.legalBasis.trim()) return {};
        return {
          items: s.items.map((i) =>
            i.id === id ? { ...i, review: 'submitted' as Review, updatedAt: now() } : i,
          ),
        };
      },
      (s) => {
        const item = findItem(s, id);
        const dep = item ? findDep(s, item.depId) : undefined;
        return {
          kind: 'review', itemId: id, batchId: item?.batchId, depId: item?.depId,
          message: `提交保留复核：${dep?.name}`,
          detail: '等待法务复核；复核通过后将固化许可证、版本与分发方式快照',
        };
      },
    );
  }, [commit]);

  const decideReview = useCallback((id: number, approve: boolean, comment?: string) => {
    setState((s) => {
      const item = findItem(s, id);
      if (!item || item.review !== 'submitted') return s;
      seqRef.current += 1;
      const dep = findDep(s, item.depId);
      const batch = findBatch(s, item.batchId);
      const rec: LogRecord = approve
        ? {
            id: seqRef.current, at: now(), actor: REVIEWER, kind: 'snapshot',
            itemId: id, batchId: item.batchId, depId: item.depId,
            message: `复核通过并固化快照：${dep?.name} @ ${batch?.name}`,
            detail: `${licenseDef(dep!.license).label} 许可证、版本 ${dep!.version} 与分发方式已锁定；后续变更须重新复核${comment ? '。复核意见：' + comment : ''}`,
          }
        : {
            id: seqRef.current, at: now(), actor: REVIEWER, kind: 'review',
            itemId: id, batchId: item.batchId, depId: item.depId,
            message: `复核驳回：${dep?.name} @ ${batch?.name}`,
            detail: comment || '法律依据不足，请补充授权或例外说明后重新提交',
          };
      const snapshot = approve && batch
        ? {
            depVersion: dep!.version,
            license: dep!.license,
            distMethod: batch.distMethod,
            basis: item.legalBasis,
            reviewer: REVIEWER,
            at: now(),
          }
        : undefined;
      return {
        ...s,
        items: s.items.map((i) =>
          i.id === id
            ? {
                ...i,
                review: (approve ? 'approved' : 'rejected') as Review,
                reviewer: approve ? REVIEWER : i.reviewer,
                reviewedAt: approve ? now() : i.reviewedAt,
                snapshot,
                updatedAt: now(),
              }
            : i,
        ),
        records: [rec, ...s.records],
      };
    });
  }, []);

  const markReady = useCallback((batchId: number) => {
    let ok = false;
    commit(
      (s) => {
        const batch = findBatch(s, batchId);
        if (!batch) return {};
        const blocks = evaluate(batch, s.deps, s.items);
        if (blocks.length) return {};
        ok = true;
        return {
          batches: s.batches.map((b) =>
            b.id === batchId ? { ...b, markedReady: { at: now(), by: ACTOR } } : b,
          ),
        };
      },
      (s) => {
        const batch = findBatch(s, batchId);
        return {
          kind: 'gate', batchId,
          message: `门禁通过，批次 ${batch?.name} 已标记为可发布`,
          detail: `发布日 ${batch?.releaseDate}；分发方式评估全部满足`,
        };
      },
    );
    return ok;
  }, [commit]);

  const revokeReady = useCallback((batchId: number) => {
    commit(
      (s) => ({
        batches: s.batches.map((b) => (b.id === batchId ? { ...b, markedReady: null } : b)),
      }),
      (s) => {
        const batch = findBatch(s, batchId);
        return { kind: 'gate', batchId, message: `撤销批次 ${batch?.name} 的可发布标记` };
      },
    );
  }, [commit]);

  const rescan = useCallback(() => {
    commit(
      (s) => ({ deps: s.deps.map((d) => ({ ...d, status: riskOfLicense(d.license) })) }),
      (s) => ({
        kind: 'scan',
        message: `重新扫描完成：${s.deps.length} 个依赖按当前许可证元数据重新定级`,
        detail: '整改项、发布门禁与处理记录仍按依赖/批次 ID 对应；复核快照以固化时状态为准',
      }),
    );
  }, [commit]);

  const itemsOfBatch = useCallback((batchId: number) => state.items.filter((i) => i.batchId === batchId), [state.items]);
  const itemOf = useCallback((batchId: number, depId: number) => state.items.find((i) => i.batchId === batchId && i.depId === depId), [state.items]);
  const blocksOf = useCallback(
    (batch: Batch) => evaluate(batch, state.deps, state.items),
    [state.deps, state.items],
  );

  return useMemo(() => ({
    deps: state.deps,
    batches: state.batches,
    items: state.items,
    records: state.records,
    itemsOfBatch, itemOf, blocksOf,
    addDep, updateDep, addBatch, deleteBatch, changeDist,
    createItem, savePlan, setProgress, submitReview, decideReview,
    markReady, revokeReady, rescan,
  }), [state, itemsOfBatch, itemOf, blocksOf, addDep, updateDep, addBatch, deleteBatch, changeDist,
    createItem, savePlan, setProgress, submitReview, decideReview, markReady, revokeReady, rescan]);
}

import type { Batch, Dep, Item, LogRecord } from './core';

export const ACTOR = 'Zen Li';
export const REVIEWER = '法务 · 林岚';

const D = (n: number) =>
  `2026-09-${String(15 + Math.floor(n / 3)).padStart(2, '0')}T${String(8 + (n % 3) * 4).padStart(2, '0')}:20:00.000Z`;

export const seedDeps: Dep[] = [
  { id: 1, name: 'react', version: '18.3.1', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 2, name: 'lodash', version: '4.17.21', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 3, name: 'chart.js', version: '4.4.4', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可，可商用' },
  { id: 4, name: 'highlight.js', version: '11.10.0', license: 'BSD-3-Clause', source: 'npm', status: 'warn', note: '再发布需保留版权声明' },
  { id: 5, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', source: '手动', status: 'risk', note: '可能与闭源分发冲突' },
  { id: 6, name: 'netkit-agpl', version: '0.9.4', license: 'AGPL-3.0', source: 'npm', status: 'risk', note: 'AGPL 网络条款，SaaS 亦受限' },
];

export const seedBatches: Batch[] = [
  {
    id: 1,
    name: 'v2.4.0 Aurora Web',
    distMethod: 'closed',
    releaseDate: '2026-09-25',
    markedReady: null,
    createdAt: D(1),
  },
  {
    id: 2,
    name: 'v2.4.1 Cloud Hotfix',
    distMethod: 'saas',
    releaseDate: '2026-09-22',
    markedReady: { at: D(12), by: ACTOR },
    createdAt: D(3),
  },
];

export const seedItems: Item[] = [
  {
    id: 1,
    batchId: 1,
    depId: 5,
    decision: 'replace',
    replacementName: 'fast-parse',
    replacementVersion: '3.2.0',
    replacementLicense: 'MIT',
    owner: '周恺',
    dueDate: '2026-09-23',
    progress: 'doing',
    legalBasis: '',
    review: 'none',
    updatedAt: D(4),
  },
  {
    id: 2,
    batchId: 1,
    depId: 6,
    decision: 'keep',
    replacementName: '',
    replacementVersion: '',
    replacementLicense: 'UNKNOWN',
    owner: 'Zen Li',
    dueDate: '2026-09-21',
    progress: 'pending',
    legalBasis:
      '经法务确认，netkit-agpl 仅以独立进程通过 IPC 调用，与主程序构成“聚合”而非衍生作品；已取得商业授权（OA-2026-0817），闭源分发不触发 AGPL 第 13 条。',
    review: 'submitted',
    updatedAt: D(6),
  },
  {
    id: 3,
    batchId: 2,
    depId: 5,
    decision: 'keep',
    replacementName: '',
    replacementVersion: '',
    replacementLicense: 'UNKNOWN',
    owner: '周恺',
    dueDate: '2026-09-21',
    progress: 'pending',
    legalBasis:
      'v2.4.1 为 SaaS 云交付，不向用户交付二进制副本。依 GPL-3.0 第 5/6 条，未发生“传送（convey）”行为，copyleft 义务不触发；已与法务林岚确认。',
    review: 'approved',
    reviewer: REVIEWER,
    reviewedAt: D(9),
    snapshot: {
      depVersion: '2.1.0',
      license: 'GPL-3.0',
      distMethod: 'saas',
      basis: 'v2.4.1 为 SaaS 云交付，不向用户交付二进制副本。依 GPL-3.0 第 5/6 条，未发生“传送（convey）”行为，copyleft 义务不触发；已与法务林岚确认。',
      reviewer: REVIEWER,
      at: D(9),
    },
    updatedAt: D(9),
  },
  {
    id: 4,
    batchId: 2,
    depId: 6,
    decision: 'replace',
    replacementName: 'socketkit',
    replacementVersion: '2.0.1',
    replacementLicense: 'MIT',
    owner: '何牧',
    dueDate: '2026-09-19',
    progress: 'done',
    legalBasis: '',
    review: 'none',
    updatedAt: D(11),
  },
];

export const seedRecords: LogRecord[] = [
  { id: 1, at: D(0), kind: 'scan', actor: '系统', message: '完成依赖扫描：共 6 个依赖，其中 2 个高风险', detail: 'legacy-parser(GPL-3.0)、netkit-agpl(AGPL-3.0)' },
  { id: 2, at: D(1), kind: 'batch', actor: ACTOR, message: '创建发布批次 v2.4.0 Aurora Web', detail: '分发方式：闭源商业分发；计划发布 2026-09-25', batchId: 1 },
  { id: 3, at: D(2), kind: 'plan', actor: ACTOR, message: '为 legacy-parser 建立整改项：替换为 fast-parse@3.2.0（MIT）', detail: '责任人：周恺；计划完成日 2026-09-23', depId: 5, batchId: 1, itemId: 1 },
  { id: 4, at: D(3), kind: 'replace', actor: '周恺', message: '替换整改进入进行中：legacy-parser → fast-parse', detail: '已创建适配分支，旧 API 封装层完成 60%', depId: 5, batchId: 1, itemId: 1 },
  { id: 5, at: D(4), kind: 'batch', actor: ACTOR, message: '创建发布批次 v2.4.1 Cloud Hotfix', detail: '分发方式：SaaS 云交付；计划发布 2026-09-22', batchId: 2 },
  { id: 6, at: D(5), kind: 'plan', actor: ACTOR, message: '为 netkit-agpl 建立整改项：选择保留原依赖', detail: '已填写法律依据，待法务复核', depId: 6, batchId: 1, itemId: 2 },
  { id: 7, at: D(6), kind: 'review', actor: ACTOR, message: '提交保留复核：netkit-agpl（批次 v2.4.0）', detail: '依据：独立进程聚合 + 商业授权 OA-2026-0817', depId: 6, batchId: 1, itemId: 2 },
  { id: 8, at: D(7), kind: 'plan', actor: ACTOR, message: '为 legacy-parser 建立整改项：选择保留原依赖（批次 v2.4.1）', detail: '依据：SaaS 不传送副本，GPL-3.0 copyleft 不触发', depId: 5, batchId: 2, itemId: 3 },
  { id: 9, at: D(8), kind: 'review', actor: ACTOR, message: '提交保留复核：legacy-parser（批次 v2.4.1）', detail: '等待法务复核', depId: 5, batchId: 2, itemId: 3 },
  { id: 10, at: D(9), kind: 'snapshot', actor: REVIEWER, message: '复核通过并固化快照：legacy-parser @ v2.4.1', detail: 'GPL-3.0 × SaaS 云交付；许可证、版本与分发方式已锁定', depId: 5, batchId: 2, itemId: 3 },
  { id: 11, at: D(11), kind: 'replace', actor: '何牧', message: '替换整改完成：netkit-agpl → socketkit@2.0.1', detail: '替代包 MIT 许可证满足 SaaS 云交付；已移除 AGPL 依赖', depId: 6, batchId: 2, itemId: 4 },
  { id: 12, at: D(12), kind: 'gate', actor: ACTOR, message: '门禁通过，批次 v2.4.1 Cloud Hotfix 已标记为可发布', detail: '2 个高风险依赖均已闭环（1 项替换完成、1 项复核保留并固化快照）', batchId: 2 },
];

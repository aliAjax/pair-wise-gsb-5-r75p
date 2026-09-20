// 发布前依赖整改台：领域模型、许可证规则表、发布门禁评估（纯函数）

export type Risk = 'ok' | 'warn' | 'risk';

export interface Dep {
  id: number;
  name: string;
  version: string;
  license: string;
  source: string;
  status: Risk;
  note: string;
}

/** 分发方式 */
export type Dist = 'closed' | 'opensource' | 'saas' | 'internal';

export const DIST_LABELS: Record<Dist, string> = {
  closed: '闭源商业分发',
  opensource: '开源同许可分发',
  saas: 'SaaS 云交付',
  internal: '内部使用',
};

export const DIST_HINTS: Record<Dist, string> = {
  closed: '交付二进制 / 源码闭源，按商业条款对外分发',
  opensource: '产物以开源许可对外发布',
  saas: '不交付副本，通过网络提供服务',
  internal: '仅限内部使用，不对外分发',
};

export type Verdict = 'allow' | 'notice' | 'deny';

export interface LicenseRule {
  v: Verdict;
  text: string;
}

export interface LicenseDef {
  id: string;
  label: string;
  risk: Risk;
  color: string;
  rules: Record<Dist, LicenseRule>;
}

const INTERNAL_RULE: LicenseRule = { v: 'allow', text: '未对外分发，copyleft 义务不触发，仅限内部使用（R-INTERNAL）' };

/** 许可证 × 分发方式 规则表——门禁冲突中引用的“规则”即来源于此 */
export const LICENSES: Record<string, LicenseDef> = {
  MIT: {
    id: 'MIT', label: 'MIT', risk: 'ok', color: '#35b995',
    rules: {
      closed: { v: 'allow', text: 'MIT 宽松许可，保留版权声明即可，兼容闭源商业分发（R-MIT）' },
      opensource: { v: 'allow', text: 'MIT 宽松许可，兼容开源分发（R-MIT）' },
      saas: { v: 'allow', text: 'MIT 不限制使用方式，兼容 SaaS 交付（R-MIT）' },
      internal: INTERNAL_RULE,
    },
  },
  'BSD-3-Clause': {
    id: 'BSD-3-Clause', label: 'BSD-3-Clause', risk: 'warn', color: '#6d9ee8',
    rules: {
      closed: { v: 'notice', text: 'BSD-3-Clause：分发须保留版权声明、许可条款与免责声明（R-BSD3-NOTICE）' },
      opensource: { v: 'notice', text: 'BSD-3-Clause：开源分发同样须保留版权与免责声明（R-BSD3-NOTICE）' },
      saas: { v: 'notice', text: 'BSD-3-Clause：SaaS 交付建议在声明页面保留版权信息（R-BSD3-NOTICE）' },
      internal: INTERNAL_RULE,
    },
  },
  'Apache-2.0': {
    id: 'Apache-2.0', label: 'Apache-2.0', risk: 'warn', color: '#b18ee4',
    rules: {
      closed: { v: 'notice', text: 'Apache-2.0：须保留 LICENSE / NOTICE，并对修改文件加注变更说明（R-APACHE2-NOTICE）' },
      opensource: { v: 'notice', text: 'Apache-2.0：开源分发须携带 NOTICE 与专利授权条款（R-APACHE2-NOTICE）' },
      saas: { v: 'notice', text: 'Apache-2.0：SaaS 交付建议在关于页面保留 NOTICE（R-APACHE2-NOTICE）' },
      internal: INTERNAL_RULE,
    },
  },
  'GPL-3.0': {
    id: 'GPL-3.0', label: 'GPL-3.0', risk: 'risk', color: '#ec8c75',
    rules: {
      closed: { v: 'deny', text: 'GPL-3.0 第 5/6 条：衍生作品须以同许可开源、不得追加分发限制，与闭源商业分发冲突（R-GPL3-COPYLEFT）' },
      opensource: { v: 'allow', text: 'GPL-3.0：以同许可开源发布整体作品即可满足 copyleft 义务（R-GPL3-OS）' },
      saas: { v: 'allow', text: 'GPL-3.0 以“分发副本”为触发条件，SaaS 不交付副本时通常不触发，须法务确认（R-GPL3-NO-DIST）' },
      internal: INTERNAL_RULE,
    },
  },
  'AGPL-3.0': {
    id: 'AGPL-3.0', label: 'AGPL-3.0', risk: 'risk', color: '#e06b57',
    rules: {
      closed: { v: 'deny', text: 'AGPL-3.0：强 copyleft，衍生作品禁止闭源商业分发（R-AGPL-COPYLEFT）' },
      opensource: { v: 'allow', text: 'AGPL-3.0：以同许可开源发布可满足义务（R-AGPL-OS）' },
      saas: { v: 'deny', text: 'AGPL-3.0 第 13 条：通过网络远程交互的修改版也须提供完整源码，与闭源 SaaS 交付冲突（R-AGPL13-NETWORK）' },
      internal: INTERNAL_RULE,
    },
  },
  'LGPL-2.1': {
    id: 'LGPL-2.1', label: 'LGPL-2.1', risk: 'warn', color: '#d9a14e',
    rules: {
      closed: { v: 'notice', text: 'LGPL-2.1：须以动态链接等可替换方式使用，并提供库源码获取途径（R-LGPL-LINK）' },
      opensource: { v: 'allow', text: 'LGPL-2.1：开源分发兼容（R-LGPL-OS）' },
      saas: { v: 'allow', text: 'LGPL-2.1：SaaS 不构成链接分发，兼容（R-LGPL-SAAS）' },
      internal: INTERNAL_RULE,
    },
  },
  UNKNOWN: {
    id: 'UNKNOWN', label: '未识别', risk: 'risk', color: '#9aa6ab',
    rules: {
      closed: { v: 'deny', text: '许可证未识别：分发义务不明，法务确认前不得放行（R-UNKNOWN-LICENSE）' },
      opensource: { v: 'deny', text: '许可证未识别：无法确认开源义务，禁止放行（R-UNKNOWN-LICENSE）' },
      saas: { v: 'deny', text: '许可证未识别：SaaS 分发义务不明，禁止放行（R-UNKNOWN-LICENSE）' },
      internal: { v: 'deny', text: '许可证未识别：即使内部使用也须先完成法务确认（R-UNKNOWN-LICENSE）' },
    },
  },
};

export const LICENSE_IDS = Object.keys(LICENSES);

export function licenseDef(id: string): LicenseDef {
  return LICENSES[id] ?? LICENSES.UNKNOWN;
}

export function riskOfLicense(id: string): Risk {
  return licenseDef(id).risk;
}

/** 处置决策：替换 / 保留 */
export type Decision = '' | 'replace' | 'keep';
export type Progress = 'pending' | 'doing' | 'done';
export type Review = 'none' | 'submitted' | 'approved' | 'rejected';

/** 复核通过后固化的快照 */
export interface Snapshot {
  depVersion: string;
  license: string;
  distMethod: Dist;
  basis: string;
  reviewer: string;
  at: string;
}

export interface Item {
  id: number;
  batchId: number;
  depId: number;
  decision: Decision;
  /** 替代包 */
  replacementName: string;
  /** 目标版本 */
  replacementVersion: string;
  replacementLicense: string;
  /** 责任人 */
  owner: string;
  /** 计划完成日 */
  dueDate: string;
  progress: Progress;
  /** 保留原依赖的法律依据 */
  legalBasis: string;
  review: Review;
  reviewer?: string;
  reviewedAt?: string;
  snapshot?: Snapshot;
  updatedAt: string;
}

export interface Batch {
  id: number;
  name: string;
  distMethod: Dist;
  releaseDate: string;
  markedReady: { at: string; by: string } | null;
  createdAt: string;
}

export type RecordKind = 'scan' | 'batch' | 'dep' | 'plan' | 'replace' | 'review' | 'snapshot' | 'gate';

export interface LogRecord {
  id: number;
  at: string;
  kind: RecordKind;
  actor: string;
  message: string;
  detail?: string;
  depId?: number;
  batchId?: number;
  itemId?: number;
}

/* ---------------- 发布门禁规则（非许可证类） ---------------- */

export const GATE_RULES = {
  ITEM: { code: 'R-GATE-ITEM', text: '每个高风险依赖必须在发布批次中建立整改关联（替代包/目标版本/责任人/计划完成日）' },
  PLAN: { code: 'R-GATE-PLAN', text: '整改计划信息须完整：责任人、计划完成日必填；选择替换时须明确替代包与目标版本' },
  PROGRESS: { code: 'R-GATE-PROGRESS', text: '同一发布批次内高风险依赖完成整改前，不得标记可发布' },
  REPLACEMENT: { code: 'R-GATE-REPLACEMENT', text: '替代包自身许可证须满足批次当前分发方式，否则不得放行' },
  BASIS: { code: 'R-GATE-BASIS', text: '选择保留原依赖必须填写法律依据' },
  REVIEW: { code: 'R-GATE-REVIEW', text: '保留原依赖必须经复核人复核通过' },
  SNAPSHOT: { code: 'R-GATE-SNAPSHOT', text: '复核通过后许可证与分发方式快照已固化，现状与快照不一致即阻塞发布' },
} as const;

export interface Block {
  code: 'NO_ITEM' | 'DECISION' | 'PLAN_INCOMPLETE' | 'REPLACE_OPEN' | 'REPLACEMENT_DENY' | 'BASIS_MISSING' | 'REVIEW_PENDING' | 'SNAPSHOT_DRIFT';
  depId?: number;
  itemId?: number;
  ruleCode: string;
  rule: string;
  reason: string;
}

/** 整改计划缺失字段 */
export function planMissing(item: Item): string[] {
  const m: string[] = [];
  if (!item.owner.trim()) m.push('责任人');
  if (!item.dueDate) m.push('计划完成日');
  if (item.decision === 'replace') {
    if (!item.replacementName.trim()) m.push('替代包');
    if (!item.replacementVersion.trim()) m.push('目标版本');
  }
  return m;
}

/**
 * 发布门禁评估：列出该批次全部阻塞项。
 * 阻塞条件：
 *  - 高风险依赖未建立整改项 / 未决策 / 计划要素不全
 *  - 决策为“替换”但整改未完成，或替代包许可证对当前分发方式判定为 deny
 *  - 决策为“保留”但缺少法律依据 / 未通过复核
 *  - 复核固化的许可证、版本或分发方式快照与现状不一致
 */
export function evaluate(batch: Batch, deps: Dep[], items: Item[]): Block[] {
  const blocks: Block[] = [];
  for (const dep of deps.filter((d) => d.status === 'risk')) {
    const item = items.find((i) => i.batchId === batch.id && i.depId === dep.id);
    if (!item) {
      blocks.push({
        code: 'NO_ITEM', depId: dep.id,
        ruleCode: GATE_RULES.ITEM.code, rule: GATE_RULES.ITEM.text,
        reason: `高风险依赖 ${dep.name}@${dep.version}（${licenseDef(dep.license).label}）尚未在本批次建立整改关联`,
      });
      continue;
    }
    if (!item.decision) {
      blocks.push({
        code: 'DECISION', depId: dep.id, itemId: item.id,
        ruleCode: GATE_RULES.PLAN.code, rule: GATE_RULES.PLAN.text,
        reason: `${dep.name} 的整改项尚未选择处置决策（替换或保留）`,
      });
      continue;
    }
    const missing = planMissing(item);
    if (missing.length) {
      blocks.push({
        code: 'PLAN_INCOMPLETE', depId: dep.id, itemId: item.id,
        ruleCode: GATE_RULES.PLAN.code, rule: GATE_RULES.PLAN.text,
        reason: `${dep.name} 的整改计划缺少：${missing.join('、')}`,
      });
    }
    if (item.decision === 'replace') {
      if (item.progress !== 'done') {
        const label = item.progress === 'doing' ? '进行中' : '待处理';
        blocks.push({
          code: 'REPLACE_OPEN', depId: dep.id, itemId: item.id,
          ruleCode: GATE_RULES.PROGRESS.code, rule: GATE_RULES.PROGRESS.text,
          reason: `${dep.name} 的替换整改仍为“${label}”，尚未完成（目标 ${item.replacementName || '替代包'}${item.replacementVersion ? '@' + item.replacementVersion : ''}）`,
        });
      } else {
        const def = licenseDef(item.replacementLicense);
        const r = def.rules[batch.distMethod];
        if (r.v === 'deny') {
          blocks.push({
            code: 'REPLACEMENT_DENY', depId: dep.id, itemId: item.id,
            ruleCode: r.text.split('（')[1]?.replace('）', '') || GATE_RULES.REPLACEMENT.code,
            rule: r.text,
            reason: `替代包 ${item.replacementName}@${item.replacementVersion} 的许可证 ${def.label} 不满足分发方式“${DIST_LABELS[batch.distMethod]}”`,
          });
        }
      }
    } else {
      if (!item.legalBasis.trim()) {
        blocks.push({
          code: 'BASIS_MISSING', depId: dep.id, itemId: item.id,
          ruleCode: GATE_RULES.BASIS.code, rule: GATE_RULES.BASIS.text,
          reason: `${dep.name} 选择保留原依赖，但未填写法律依据`,
        });
      } else if (item.review === 'submitted') {
        blocks.push({
          code: 'REVIEW_PENDING', depId: dep.id, itemId: item.id,
          ruleCode: GATE_RULES.REVIEW.code, rule: GATE_RULES.REVIEW.text,
          reason: `${dep.name} 的保留申请已提交，等待复核人复核通过`,
        });
      } else if (item.review === 'rejected') {
        blocks.push({
          code: 'REVIEW_PENDING', depId: dep.id, itemId: item.id,
          ruleCode: GATE_RULES.REVIEW.code, rule: GATE_RULES.REVIEW.text,
          reason: `${dep.name} 的保留申请已被复核驳回，须补充法律依据后重新提交`,
        });
      } else if (item.review === 'approved' && item.snapshot) {
        const drift: string[] = [];
        if (item.snapshot.license !== dep.license) drift.push(`许可证由 ${licenseDef(item.snapshot.license).label} 变更为 ${licenseDef(dep.license).label}`);
        if (item.snapshot.depVersion !== dep.version) drift.push(`依赖版本由 ${item.snapshot.depVersion} 变更为 ${dep.version}`);
        if (item.snapshot.distMethod !== batch.distMethod) drift.push(`分发方式由 ${DIST_LABELS[item.snapshot.distMethod]} 变更为 ${DIST_LABELS[batch.distMethod]}`);
        if (drift.length) {
          blocks.push({
            code: 'SNAPSHOT_DRIFT', depId: dep.id, itemId: item.id,
            ruleCode: GATE_RULES.SNAPSHOT.code, rule: GATE_RULES.SNAPSHOT.text,
            reason: `${dep.name} 固化快照与现状冲突：${drift.join('；')}，须重新复核`,
          });
        }
      }
    }
  }
  return blocks;
}

/* ---------------- 替代包目录（选择后自动带出许可证） ---------------- */

export const KNOWN_PACKAGES: { name: string; version: string; license: string }[] = [
  { name: 'fast-parse', version: '3.2.0', license: 'MIT' },
  { name: 'socketkit', version: '2.0.1', license: 'MIT' },
  { name: 'dayjs', version: '1.11.13', license: 'MIT' },
  { name: 'date-fns', version: '4.1.0', license: 'MIT' },
  { name: 'zustand', version: '5.0.0', license: 'MIT' },
  { name: 'esbuild', version: '0.24.0', license: 'MIT' },
  { name: 'ajv', version: '8.17.1', license: 'MIT' },
];

export const REPLACE_SUGGESTIONS: Record<string, { name: string; version: string; license: string }> = {
  'legacy-parser': { name: 'fast-parse', version: '3.2.0', license: 'MIT' },
  'netkit-agpl': { name: 'socketkit', version: '2.0.1', license: 'MIT' },
};

/* ---------------- 时间工具 ---------------- */

export const now = () => new Date().toISOString();

const p2 = (n: number) => String(n).padStart(2, '0');

export function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

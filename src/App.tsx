import {useState} from 'react';
import {
  AlertTriangle, ChevronDown, ClipboardList, Download, FileWarning, Layers3, Plus,
  RefreshCw, ShieldCheck, Sparkles,
} from 'lucide-react';
import {useStore} from './store';
import {DIST_LABELS, LICENSES, licenseDef} from './license/core';
import Overview from './components/Overview';
import Gate from './components/Gate';
import Records from './components/Records';

type Tab = 'overview' | 'gate' | 'records';

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [showAdd, setShowAdd] = useState(false);

  const riskCount = store.deps.filter((d) => d.status === 'risk').length;
  const totalBlocks = store.batches.reduce((n, b) => n + store.blocksOf(b).length, 0);
  const readyCount = store.batches.filter((b) => b.markedReady).length;

  const exportReport = () => {
    const lines: string[] = [];
    lines.push('# 发布前依赖整改报告');
    lines.push('');
    lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('## 依赖清单');
    lines.push('');
    lines.push('| 依赖 | 版本 | 许可证 | 风险等级 |');
    lines.push('|---|---|---|---|');
    store.deps.forEach((d) => lines.push(`| ${d.name} | ${d.version} | ${licenseDef(d.license).label} | ${d.status === 'risk' ? '高风险' : d.status === 'warn' ? '需复核' : '安全'} |`));
    lines.push('');
    lines.push('## 发布批次与门禁');
    store.batches.forEach((b) => {
      const blocks = store.blocksOf(b);
      lines.push('');
      lines.push(`### ${b.name}`);
      lines.push(`- 分发方式：${DIST_LABELS[b.distMethod]}`);
      lines.push(`- 计划发布：${b.releaseDate}`);
      lines.push(`- 门禁状态：${b.markedReady ? `已标记可发布（${b.markedReady.by}）` : blocks.length ? `阻塞 ${blocks.length} 项` : '评估通过，待标记'}`);
      const risk = store.deps.filter((d) => d.status === 'risk');
      risk.forEach((dep) => {
        const item = store.itemOf(b.id, dep.id);
        if (!item) {
          lines.push(`- ⛔ ${dep.name}：未建立整改关联（R-GATE-ITEM）`);
          return;
        }
        if (item.decision === 'replace') {
          lines.push(`- ${item.progress === 'done' ? '✅' : '⛔'} ${dep.name} → ${item.replacementName}@${item.replacementVersion}（${licenseDef(item.replacementLicense).label}）；责任人 ${item.owner || '—'}；计划 ${item.dueDate || '—'}；进度 ${item.progress}`);
        } else if (item.decision === 'keep') {
          lines.push(`- ${item.review === 'approved' ? '✅' : '⛔'} ${dep.name} 保留原依赖；责任人 ${item.owner || '—'}；复核 ${item.review}${item.snapshot ? `；快照=${item.snapshot.license}@${item.snapshot.depVersion}/${DIST_LABELS[item.snapshot.distMethod]}` : ''}`);
          lines.push(`  - 法律依据：${item.legalBasis || '（未填写）'}`);
        } else {
          lines.push(`- ⛔ ${dep.name}：已建整改项但未选择决策`);
        }
      });
      if (blocks.length) {
        lines.push('');
        lines.push('阻塞清单：');
        blocks.forEach((x) => lines.push(`- ⛔ [${x.ruleCode}] ${x.reason}`));
      }
    });
    lines.push('');
    lines.push('## 处理记录');
    lines.push('');
    store.records.forEach((r) => lines.push(`- ${r.at} ${r.actor}：${r.message}${r.detail ? '（' + r.detail + '）' : ''}`));
    const blob = new Blob([lines.join('\n')], {type: 'text/markdown'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'license-remedy-report.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18} /></div>
          <div><b>License Lens</b><small>release remediation</small></div>
        </div>
        <div className="nav-title">WORKSPACE</div>
        <button className={tab === 'overview' ? 'nav active' : 'nav'} onClick={() => setTab('overview')}>
          <Layers3 size={16} />依赖总览 <span>{store.deps.length}</span>
        </button>
        <button className={tab === 'gate' ? 'nav active' : 'nav'} onClick={() => setTab('gate')}>
          <AlertTriangle size={16} />发布门禁
          <span className={totalBlocks ? 'red' : ''}>{totalBlocks ? `${totalBlocks} 阻塞` : `${store.batches.length} 批次`}</span>
        </button>
        <button className={tab === 'records' ? 'nav active' : 'nav'} onClick={() => setTab('records')}>
          <ClipboardList size={16} />处理记录 <span>{store.records.length}</span>
        </button>
        <div className="aside-bottom">
          <div className="mini-card">
            <Sparkles size={16} />
            <div>
              <b>{readyCount ? `${readyCount} 个批次可发布` : '整改进行中'}</b>
              <small>{totalBlocks ? `全部门禁共 ${totalBlocks} 项阻塞待处理` : '所有批次门禁均已通过'}</small>
            </div>
          </div>
          <div className="user">
            <div className="avatar">ZL</div><span>Zen Li</span><ChevronDown size={14} />
          </div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">WORKSPACE / <b>RELEASE REMEDIATION</b></div>
            <h1>{tab === 'overview' ? '许可证兼容性分析' : tab === 'gate' ? '发布门禁与依赖整改' : '处理记录与审计追踪'}</h1>
            <p>
              {tab === 'overview'
                ? '检查依赖许可，高风险项须进入发布批次完成整改或复核保留。'
                : tab === 'gate'
                  ? '高风险未完成整改、替代包许可证不满足当前分发方式，或保留未复核时，批次不得标记可发布。'
                  : '计划、替换、复核、快照与门禁动作全部留痕，刷新后仍按依赖与批次对应。'}
            </p>
          </div>
          <div className="head-actions">
            <button className="outline" onClick={() => store.rescan()} title="按当前许可证元数据重新定级，整改关联不受影响"><RefreshCw size={15} />重新扫描</button>
            <button className="outline" onClick={exportReport}><Download size={15} />导出报告</button>
            <button className="primary" onClick={() => setShowAdd(true)}><Plus size={16} />添加依赖</button>
          </div>
        </header>

        {riskCount > 0 && tab !== 'gate' && (
          <button className="inline-gate-alert" onClick={() => setTab('gate')}>
            <FileWarning size={14} />
            {riskCount} 个高风险依赖 · {totalBlocks ? `${totalBlocks} 项门禁阻塞` : '门禁待确认'}，前往发布门禁处理 →
          </button>
        )}

        {tab === 'overview' && <Overview store={store} />}
        {tab === 'gate' && <Gate store={store} />}
        {tab === 'records' && <Records store={store} />}
      </main>

      {showAdd && <AddDepModal onClose={() => setShowAdd(false)} onAdd={(name, license) => { store.addDep(name, license); setShowAdd(false); setTab('overview'); }} />}
    </div>
  );
}

function AddDepModal({onClose, onAdd}: {onClose: () => void; onAdd: (name: string, license: string) => void}) {
  const [name, setName] = useState('');
  const [license, setLicense] = useState('MIT');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>添加依赖</h2><button onClick={onClose}>×</button></div>
        <label>依赖名称<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 date-fns" /></label>
        <label>许可证
          <select value={license} onChange={(e) => setLicense(e.target.value)}>
            {Object.keys(LICENSES).map((id) => <option key={id} value={id}>{licenseDef(id).label}{licenseDef(id).risk === 'risk' ? '（高风险）' : licenseDef(id).risk === 'warn' ? '（需声明）' : ''}</option>)}
          </select>
        </label>
        <p className="modal-hint">
          {licenseDef(license).rules.closed.v === 'deny'
            ? '该许可证在闭源商业分发下判为不兼容，添加后将列为高风险并要求整改。'
            : licenseDef(license).rules.closed.v === 'notice'
              ? '该许可证允许分发但需保留声明 / NOTICE。'
              : '宽松许可，可直接分发。'}
        </p>
        <button className="primary full" disabled={!name.trim()} onClick={() => onAdd(name, license)}>加入扫描</button>
      </div>
    </div>
  );
}

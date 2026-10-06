import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Skeleton, Typography } from 'antd';
import {
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  DollarOutlined,
  FundOutlined,
  IdcardOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchSuperAdminDashboard, type DashboardOverview } from '../../api/dashboard';
import { formatAmount } from '../reports/format';

const { Text } = Typography;

const C = {
  violet: '#17376B',
  indigo: '#3B82F6',
  sky: '#0EA5C6',
  teal: '#14B8A6',
  green: '#22C55E',
  amber: '#F59E0B',
  orange: '#F97316',
  rose: '#F43F5E',
  slate: '#94A3B8',
  ink: '#0F2547',
  muted: '#5B6F8F',
  line: 'rgba(23,55,107,0.08)',
};
const PIE = ['#17376B', '#0EA5C6', '#14B8A6', '#3B82F6', '#F59E0B', '#F43F5E', '#8B5CF6', '#22C55E'];

const CSS = `
@keyframes sad-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes sad-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes sad-shimmer { from { background-position: 0 0; } to { background-position: 200% 0; } }
.sad-root { display: grid; gap: 20px; }
.sad-in { opacity: 0; animation: sad-rise .6s cubic-bezier(.2,.7,.2,1) forwards; animation-delay: var(--d, 0ms); }
.sad-card { background: rgba(255,255,255,.72); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.9); border-radius: 22px; padding: 20px; position: relative;
  box-shadow: 0 14px 36px -20px rgba(23,55,107,.28);
  transition: transform .25s ease, box-shadow .25s ease; }
.sad-card:hover { transform: translateY(-3px); border-color: rgba(14,165,198,.45); box-shadow: 0 24px 46px -22px rgba(23,55,107,.4); }
.sad-hero { position: relative; overflow: hidden; border-radius: 22px; padding: 28px 30px; color: #fff;
  background: linear-gradient(125deg, #0F2A57 0%, #17376B 40%, #1D6FA8 80%, #14B8A6 135%); }
.sad-hero::before, .sad-hero::after { content: ''; position: absolute; border-radius: 50%; background: rgba(255,255,255,.12);
  animation: sad-float 7s ease-in-out infinite; }
.sad-hero::before { width: 220px; height: 220px; right: -50px; top: -80px; }
.sad-hero::after { width: 130px; height: 130px; right: 140px; bottom: -60px; animation-delay: -3s; }
.sad-hero-grid { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between; align-items: flex-end; }
.sad-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 14px;
  background: rgba(255,255,255,.16); backdrop-filter: blur(6px); font-size: 13px; }
.sad-pill b { font-size: 20px; font-weight: 700; }
.sad-grid-4 { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.sad-grid-3 { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.sad-split { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); }
.sad-bar-track { height: 8px; border-radius: 99px; background: rgba(23,55,107,.08); overflow: hidden; }
.sad-bar-fill { height: 100%; border-radius: 99px; width: 0; transition: width 1.1s cubic-bezier(.2,.7,.2,1); }
.sad-row-hover { padding: 8px 10px; margin: 0 -10px; border-radius: 10px; transition: background .2s; }
.sad-row-hover:hover { background: rgba(14,165,198,.1); }
.sad-ring circle.sad-ring-fg { transition: stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1); }
.sad-title { font-size: 15px; font-weight: 600; color: ${C.ink}; margin: 0 0 14px; display: flex; align-items: center; gap: 8px; }
.sad-title i { width: 8px; height: 8px; border-radius: 50%; background: ${C.violet}; display: inline-block; }
@media (max-width: 900px) { .sad-split { grid-template-columns: minmax(0, 1fr); } .sad-hero { padding: 22px 20px; } }
@media (prefers-reduced-motion: reduce) {
  .sad-in { animation: none; opacity: 1; }
  .sad-hero::before, .sad-hero::after { animation: none; }
  .sad-card, .sad-bar-fill, .sad-ring circle.sad-ring-fg { transition: none; }
}
`;

/** Rises on mount; stagger via `delay`. */
function Reveal({ delay = 0, className = '', children }: { delay?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`sad-in ${className}`} style={{ ['--d' as string]: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Flips true one frame after mount so CSS width/dash transitions animate from zero. */
function useMounted(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

function CountUp({ value, money = false }: { value: number; money?: boolean }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + (value - origin) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{money ? formatAmount(shown) : Math.round(shown).toLocaleString()}</>;
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h3 className="sad-title">
      <i />
      {children}
    </h3>
  );
}

function IconBadge({ icon, color }: { icon: ReactNode; color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 46, height: 46, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color, background: `${color}1F`, flex: 'none',
      }}
    >
      {icon}
    </span>
  );
}

function MetricCard({ icon, color, label, value, money, delay }: {
  icon: ReactNode; color: string; label: string; value: number; money?: boolean; delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <div className="sad-card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <IconBadge icon={icon} color={color} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
          <div style={{ color: C.ink, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
            <CountUp value={value} money={money} />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function RatioCard({ label, value, total, color, delay }: {
  label: string; value: number; total: number; color: string; delay: number;
}) {
  const on = useMounted();
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  const R = 26;
  const circ = 2 * Math.PI * R;
  return (
    <Reveal delay={delay}>
      <div className="sad-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg className="sad-ring" width="66" height="66" viewBox="0 0 66 66" aria-hidden style={{ flex: 'none' }}>
          <circle cx="33" cy="33" r={R} fill="none" stroke="rgba(23,55,107,0.08)" strokeWidth="7" />
          <circle
            className="sad-ring-fg" cx="33" cy="33" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={on ? circ * (1 - pct / 100) : circ}
            transform="rotate(-90 33 33)"
          />
          <text x="33" y="37" textAnchor="middle" fontSize="13" fontWeight="700" fill={C.ink}>{Math.round(pct)}%</text>
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
          <div style={{ color: C.ink, fontSize: 22, fontWeight: 700 }}>
            <CountUp value={value} />
            <span style={{ color: C.slate, fontSize: 15, fontWeight: 500 }}> / {total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function OverviewCard({ title, data, colors, delay }: {
  title: string; data: DashboardOverview; colors: string[]; delay: number;
}) {
  const on = useMounted();
  return (
    <Reveal delay={delay}>
      <div className="sad-card" style={{ height: '100%' }}>
        <Title>{title}</Title>
        {data.items.map((item, i) => {
          const pct = data.total > 0 ? Math.min(100, (item.count / data.total) * 100) : 0;
          const color = colors[i % colors.length];
          return (
            <div key={item.key} className="sad-row-hover">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: C.ink }}>
                  <b>{item.count.toLocaleString()}</b> <span style={{ color: C.muted }}>{item.label}</span>
                </span>
                <span style={{ color: C.muted }}>{pct.toFixed(pct % 1 === 0 ? 0 : 1)}%</span>
              </div>
              <div className="sad-bar-track">
                <div className="sad-bar-fill" style={{ width: on ? `${pct}%` : 0, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Reveal>
  );
}

function ChartTooltip({ active, payload, label, prefix }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number; prefix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px',
      boxShadow: '0 10px 24px -8px rgba(30,27,75,.25)', fontSize: 12 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{prefix}{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: C.ink }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: p.color, marginRight: 6 }} />
          {p.name}: <b>{formatAmount(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

const RATIO_COLORS: Record<string, string> = {
  'fees-awaiting': C.sky,
  'leave-approved': C.teal,
  'staff-on-leave': C.amber,
  leads: C.rose,
  'staff-present': C.green,
  'student-present': C.violet,
};

function LoadingSkeleton() {
  return (
    <div className="sad-root">
      <Skeleton.Button active block style={{ height: 150, borderRadius: 22 }} />
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  );
}

function SuperAdminDashboard({ greetingName, today }: { greetingName: string; today: string }) {
  const query = useQuery({ queryKey: ['dashboard', 'super-admin'], queryFn: fetchSuperAdminDashboard });

  if (query.isPending) return <LoadingSkeleton />;
  if (query.isError) return <Alert type="warning" showIcon message="Couldn't load the dashboard" />;

  const d = query.data;
  const expenseTotal = d.expenseByHead.reduce((s, e) => s + e.value, 0);
  const roleSlices = d.usersByRole.filter((r) => r.value > 0);

  return (
    <div className="sad-root">
      <style>{CSS}</style>

      <Reveal>
        <section className="sad-hero">
          <div className="sad-hero-grid">
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>{today}</div>
              <h2 style={{ color: '#fff', margin: '6px 0 4px', fontSize: 30, fontWeight: 700 }}>
                Welcome back, {greetingName}
              </h2>
              <div style={{ opacity: 0.9 }}>Here&rsquo;s how the school is doing &middot; Session {d.sessionLabel}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="sad-pill"><TeamOutlined /> <b><CountUp value={d.people.students} /></b> students</span>
              <span className="sad-pill"><IdcardOutlined /> <b><CountUp value={d.people.activeStaff} /></b> staff</span>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="sad-grid-4">
        <MetricCard delay={80} icon={<DollarOutlined />} color={C.green} label={`Fees collected · ${d.monthLabel}`}
          value={d.money.monthFees} money />
        <MetricCard delay={140} icon={<CreditCardOutlined />} color={C.rose} label={`Expenses · ${d.monthLabel}`}
          value={d.money.monthExpenses} money />
        <MetricCard delay={200} icon={<BankOutlined />} color={C.amber} label="Fees outstanding"
          value={d.money.totalOutstanding} money />
        <MetricCard delay={260} icon={<UserSwitchOutlined />} color={C.violet} label="Students present today"
          value={d.people.studentsPresentToday} />
      </div>

      <div className="sad-grid-3">
        {d.ratios.map((r, i) => (
          <RatioCard key={r.key} delay={320 + i * 60} label={r.label} value={r.value} total={r.total}
            color={RATIO_COLORS[r.key] ?? C.violet} />
        ))}
      </div>

      <div className="sad-split">
        <Reveal delay={400}>
          <div className="sad-card" style={{ height: '100%' }}>
            <Title>Fees collection &amp; expenses &middot; {d.monthLabel}</Title>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.monthDaily} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barGap={2}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip prefix="Day " />} cursor={{ fill: 'rgba(14,165,198,.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="fees" name="Fees" fill={C.violet} radius={[5, 5, 0, 0]} animationDuration={1000} />
                <Bar dataKey="expenses" name="Expenses" fill={C.rose} radius={[5, 5, 0, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal delay={460}>
          <div className="sad-card" style={{ height: '100%' }}>
            <Title>Expense by head &middot; {d.monthLabel}</Title>
            {expenseTotal === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No expenses this month" />
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={d.expenseByHead} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86}
                        paddingAngle={3} animationDuration={1100} stroke="none">
                        {d.expenseByHead.map((e, i) => <Cell key={e.name} fill={PIE[i % PIE.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>Total</span>
                    <b style={{ color: C.ink, fontSize: 16 }}>{formatAmount(expenseTotal)}</b>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                  {d.expenseByHead.map((e, i) => (
                    <div key={e.name} className="sad-row-hover" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 5, marginRight: 8,
                        background: PIE[i % PIE.length] }} />{e.name}</span>
                      <b style={{ color: C.ink }}>{formatAmount(e.value)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal delay={500}>
        <div className="sad-card">
          <Title>Fees collection &amp; expenses &middot; Session {d.sessionLabel}</Title>
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={d.sessionMonthly} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="sad-g-fees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.violet} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={C.violet} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sad-g-exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.rose} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.rose} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="fees" name="Fees" stroke={C.violet} strokeWidth={2.5} fill="url(#sad-g-fees)"
                animationDuration={1300} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.rose} strokeWidth={2.5} fill="url(#sad-g-exp)"
                animationDuration={1300} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Reveal>

      <div className="sad-grid-4">
        <OverviewCard delay={560} title="Fees overview" data={d.fees} colors={[C.rose, C.amber, C.green]} />
        <OverviewCard delay={620} title="Enquiry overview" data={d.enquiries} colors={[C.sky, C.green, C.amber, C.rose, C.slate]} />
        <OverviewCard delay={680} title="Library overview" data={d.library} colors={[C.violet, C.rose, C.green, C.teal]} />
        <OverviewCard delay={740} title="Student attendance today" data={d.studentAttendance}
          colors={[C.green, C.amber, C.rose, C.sky]} />
      </div>

      <Reveal delay={800}>
        <div className="sad-card">
          <Title>People by role</Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {roleSlices.map((r, i) => (
              <div key={r.name} className="sad-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', margin: 0, border: `1px solid ${C.line}`, borderRadius: 14, minWidth: 170 }}>
                <IconBadge color={PIE[i % PIE.length]} icon={i % 3 === 0 ? <FundOutlined /> : i % 3 === 1 ? <BookOutlined /> : <CalendarOutlined />} />
                <div>
                  <div style={{ color: C.muted, fontSize: 12, textTransform: 'capitalize' }}>
                    {r.name.toLowerCase().replace(/_/g, ' ')}
                  </div>
                  <b style={{ color: C.ink, fontSize: 20 }}><CountUp value={r.value} /></b>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      <Text type="secondary" style={{ fontSize: 12 }}>Figures update each time you open the dashboard.</Text>
    </div>
  );
}

export default SuperAdminDashboard;

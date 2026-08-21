import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

export type RegionStat = {
  label: string;
  value: number;
};

const REGION_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'];

const SHORT_LABELS: Record<string, string> = {
  'Kigali City': 'Kigali',
  'Northern Province': 'Northern',
  'Southern Province': 'Southern',
  'Eastern Province': 'Eastern',
  'Western Province': 'Western',
};

type Props = {
  regions: RegionStat[];
  total?: number;
  /** Admin dashboard is dark; field dashboard is light */
  variant?: 'dark' | 'light';
};

export function GeographicDistributionChart({ regions, total, variant = 'light' }: Props) {
  const dark = variant === 'dark';
  const chartData = regions.map((r, i) => ({
    name: SHORT_LABELS[r.label] || r.label,
    fullName: r.label,
    value: r.value,
    fill: REGION_COLORS[i % REGION_COLORS.length],
  }));

  const sum = total ?? chartData.reduce((acc, r) => acc + r.value, 0);
  const hasData = sum > 0;

  const axisColor = dark ? '#93C5FD' : '#64748B';
  const gridColor = dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';
  const tooltipBg = dark ? '#0F172A' : '#FFFFFF';
  const tooltipBorder = dark ? 'rgba(255,255,255,0.15)' : '#E2E8F0';
  const tooltipText = dark ? '#E2E8F0' : '#0F172A';

  if (!hasData) {
    return (
      <div
        className={`h-56 flex items-center justify-center rounded-2xl border border-dashed text-sm ${
          dark ? 'border-white/15 text-blue-200/60' : 'border-slate-200 text-slate-400'
        }`}
      >
        No regional data yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
      <div className="lg:col-span-3 h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }}
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: 12,
                color: tooltipText,
                fontSize: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
              formatter={(value: number | undefined) => [value ?? 0, 'Facilities']}
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName || ''
              }
            />
            <Bar dataKey="value" radius={[8, 8, 4, 4]} maxBarSize={48}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:col-span-2 h-64 sm:h-72 flex flex-col">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={2}
                stroke={dark ? '#0B3B8F' : '#FFFFFF'}
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                  fontSize: 12,
                }}
                formatter={(value: number | undefined, _name, item) => {
                  const v = value ?? 0;
                  const pct = sum > 0 ? Math.round((v / sum) * 100) : 0;
                  const full =
                    (item?.payload as { fullName?: string } | undefined)?.fullName || '';
                  return [`${v} (${pct}%)`, full];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 gap-1.5 mt-1">
          {chartData.map((r) => {
            const pct = sum > 0 ? Math.round((r.value / sum) * 100) : 0;
            return (
              <div key={r.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: r.fill }}
                  />
                  <span className={`truncate font-medium ${dark ? 'text-blue-100' : 'text-slate-700'}`}>
                    {r.name}
                  </span>
                </span>
                <span className={`font-bold tabular-nums ${dark ? 'text-white' : 'text-slate-900'}`}>
                  {r.value}
                  <span className={`font-medium ml-1 ${dark ? 'text-blue-200/70' : 'text-slate-400'}`}>
                    {pct}%
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

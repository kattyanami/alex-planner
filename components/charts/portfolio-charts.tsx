"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartSpec = {
  key: string;
  title: string;
  type: "pie" | "donut" | "bar" | "horizontalBar";
  description: string;
  data: Array<{ name: string; value: number; color: string }>;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name: string; value: number }; name?: string; value?: number }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const name = p.payload?.name ?? p.name ?? "";
  const value = p.payload?.value ?? p.value ?? 0;
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 shadow-lg text-xs">
      <div className="font-medium">{name}</div>
      <div className="text-zinc-500 dark:text-zinc-400 tabular-nums">{fmt(Number(value))}</div>
    </div>
  );
}

export function PortfolioChart({ spec }: { spec: ChartSpec }) {
  if (!spec.data || spec.data.length === 0) {
    return <div className="text-xs text-zinc-500 italic">No data</div>;
  }

  const total = spec.data.reduce((s, d) => s + d.value, 0);

  if (spec.type === "pie" || spec.type === "donut") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 items-center">
        <div className="h-[160px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={spec.data}
                dataKey="value"
                nameKey="name"
                innerRadius={spec.type === "donut" ? 38 : 0}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {spec.data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {spec.data.map((d) => {
            const pct = total ? (d.value / total) * 100 : 0;
            return (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="tabular-nums text-zinc-500">{pct.toFixed(0)}%</span>
                <span className="tabular-nums font-medium w-20 text-right">{fmt(d.value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (spec.type === "horizontalBar") {
    return (
      <div className="h-[200px] w-full">
        <ResponsiveContainer>
          <BarChart data={spec.data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "currentColor", fontSize: 11 }}
              width={80}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {spec.data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // bar (vertical)
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer>
        <BarChart data={spec.data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: "currentColor", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {spec.data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

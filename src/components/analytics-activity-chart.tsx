"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface ActivityChartProps {
  data: Array<{ date: string; opens: number; clicks: number }>;
}

export default function AnalyticsActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-64 w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" />
          <XAxis dataKey="date" stroke="#74796e" fontSize={11} />
          <YAxis stroke="#74796e" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#faf6f0",
              borderColor: "#c4c8bc",
              borderRadius: "12px",
              color: "#2e3230",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          />
          <Bar dataKey="opens" name="Opens" fill="#4a7c59" radius={[6, 6, 0, 0]} />
          <Bar dataKey="clicks" name="Clicks" fill="#705c30" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

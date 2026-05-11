import { dateKey, monthStartKey, weekStartKey } from "./date";
import type { CheckIn, Client } from "./types";

export function dashboardStats(clients: Client[], checkIns: CheckIn[]) {
  const today = dateKey();
  const weekStart = weekStartKey();
  const monthStart = monthStartKey();
  const activeClients = clients.filter((client) => client.status === "active").length;
  const totalToday = checkIns.filter((checkIn) => checkIn.date === today).length;
  const weekly = checkIns.filter((checkIn) => checkIn.date >= weekStart);
  const monthly = checkIns.filter((checkIn) => checkIn.date >= monthStart);
  const possible = Math.max(activeClients * 7, 1);

  return {
    totalToday,
    activeClients,
    weeklyTotal: weekly.length,
    monthlyTotal: monthly.length,
    weeklyAttendancePercent: Math.min(100, Math.round((weekly.length / possible) * 100))
  };
}

import { dateKey } from "./date";
import type { CheckIn, Client } from "./types";

export function dashboardStats(clients: Client[], checkIns: CheckIn[]) {
  const today = dateKey();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const activeClients = clients.filter((client) => client.status === "active").length;
  const totalToday = checkIns.filter((checkIn) => checkIn.date === today).length;
  const weekly = checkIns.filter((checkIn) => new Date(checkIn.timestamp) >= weekAgo);
  const possible = Math.max(activeClients * 7, 1);

  return {
    totalToday,
    activeClients,
    weeklyAttendancePercent: Math.min(100, Math.round((weekly.length / possible) * 100))
  };
}

export type ApiResponse<T = unknown> =
  | { success: true; message: string; data: T }
  | { success: false; error: string };

export type ClientStatus = "active" | "disabled" | "deleted";
export type CheckInType = "qr_checkin" | "manual_session" | "late_cancel" | "no_show";

export type Client = {
  clientId: string;
  name: string;
  qrUrl: string;
  status: ClientStatus;
  createdAt: string;
  totalSessions: number;
  remainingSessions: number;
};

export type CheckIn = {
  clientId: string;
  name: string;
  timestamp: string;
  date: string;
  manualOverride: boolean;
  type: CheckInType;
  sessionsRemaining: number;
};

export type DashboardData = {
  clients: Client[];
  checkIns: CheckIn[];
  stats: {
    totalToday: number;
    activeClients: number;
    weeklyTotal: number;
    monthlyTotal: number;
    weeklyAttendancePercent: number;
  };
};

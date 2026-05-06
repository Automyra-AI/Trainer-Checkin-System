export type ApiResponse<T = unknown> =
  | { success: true; message: string; data: T }
  | { success: false; error: string };

export type ClientStatus = "active" | "disabled" | "deleted";

export type Client = {
  clientId: string;
  name: string;
  qrUrl: string;
  status: ClientStatus;
  createdAt: string;
};

export type CheckIn = {
  clientId: string;
  name: string;
  timestamp: string;
  date: string;
  manualOverride: boolean;
};

export type DashboardData = {
  clients: Client[];
  checkIns: CheckIn[];
  stats: {
    totalToday: number;
    activeClients: number;
    weeklyAttendancePercent: number;
  };
};

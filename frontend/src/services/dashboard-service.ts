import { type ApiResponse } from '@/types/api'
import { apiClient } from '@/lib/api-client'

export const dashboardQueryKey = ['dashboard'] as const

export interface DashboardMetrics {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  adminCount: number
  managerCount: number
  staffCount: number

  totalLots: number
  activeLots: number
  closedLots: number
  totalCarat: number
  totalRoughCarats: number
  totalPieces: number

  totalPackets: number
  totalPacketCarat: number

  totalProcesses: number
  inProcessCount: number
  returnedProcessCount: number
  totalIssuedPieces: number
  totalIssuedCarat: number
  totalReturnedPieces: number
  totalReturnedCarat: number
  totalLossCarat: number
  overallYield: number
}

export interface OverviewChartPoint {
  name: string
  total: number
  pieces?: number
}

export interface RecentSaleItem {
  name: string
  detail: string
  amount: string
  initials: string
  avatar?: string
}

export interface AnalyticsChartPoint {
  name: string
  clicks: number
  uniques: number
}

export interface DashboardAnalytics {
  chart: AnalyticsChartPoint[]
  totalPieces?: string
  totalCarats?: string
  yieldRate?: string
  totalPackets?: string
  totalClicks?: string
  uniqueVisitors?: string
  bounceRate?: string
  avgSession?: string
  referrers: { name: string; value: number }[]
  devices: { name: string; value: number }[]
}

export interface AssortmentAnalytics {
  gradeDistribution: { name: string; value: number; count?: number }[]
  sizeBrackets: { range: string; count: number; carats: number }[]
  scatterData: {
    x: number
    y: number
    z: number
    name: string
    grade: string
  }[]
  lotAssortmentComparison: {
    kapan: string
    roughCarat: number
    packetCarat: number
    conversionPct: number
  }[]
}

interface DashboardData {
  metrics: DashboardMetrics
  overviewChart: OverviewChartPoint[]
  recentSales: RecentSaleItem[]
  recentLots?: RecentSaleItem[]
  analytics: DashboardAnalytics
  assortmentAnalytics?: AssortmentAnalytics
  recentUsers: unknown[]
  recentActivity: unknown[]
  serverInfo: {
    appName: string
    version: string
    port: number
    primaryLanIp: string
    apiUrl: string
  }
}

export async function fetchDashboardData(
  signal?: AbortSignal
): Promise<DashboardData> {
  const response = await apiClient.get<ApiResponse<DashboardData>>(
    '/dashboard',
    {
      signal,
    }
  )

  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to load dashboard data')
  }

  return response.data.data
}

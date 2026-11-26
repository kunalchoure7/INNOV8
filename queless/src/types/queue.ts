export interface PublicStats {
  activeOrganizations: number;
  openServices: number;
  totalTokensIssued: number;
  completedTokens: number;
  waitingTokens: number;
  servingTokens: number;
  priorityTokens: number;
  avgServiceMinutes: number;
}

export interface TokenRecord {
  id: number;
  tokenCode: string;
  organizationId: number;
  serviceId: number;
  counterId: number | null;
  userUid: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  isPriority: boolean;
  priorityReason: string;
  notes: string | null;
  status: 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
  sequenceNumber: number;
  estimatedWaitMinutes: number;
  bookedAt: string;
  calledAt: string | null;
  completedAt: string | null;
}

export interface EnrichedToken extends TokenRecord {
  organizationName: string;
  organizationSlug: string;
  organizationLocation: string;
  organizationCategory: string;
  serviceName: string;
  avgServiceMinutes: number;
  counterName: string | null;
  staffName: string | null;
  positionInQueue: number;
  peopleAhead: number;
  dynamicEtaMinutes: number;
  currentlyServingCode: string | null;
}

export interface ServiceSummary {
  id: number;
  organizationId: number;
  name: string;
  prefix: string;
  avgServiceMinutes: number;
  priorityEnabled: boolean;
  isOpen: boolean;
  currentCounter: number;
  waitingCount: number;
  priorityWaitingCount: number;
  servingTokens: TokenRecord[];
  estimatedWaitMinutes: number;
}

export interface CounterRecord {
  id: number;
  organizationId: number;
  serviceId: number | null;
  name: string;
  staffName: string;
  status: 'active' | 'paused';
  currentTokenId: number | null;
  serviceName?: string;
  currentToken?: TokenRecord | null;
}

export interface OrganizationSummary {
  id: number;
  slug: string;
  name: string;
  category: string;
  location: string;
  description: string;
  isActive: boolean;
  ownerUid: string | null;
  services: ServiceSummary[];
  counters: CounterRecord[];
  totalWaiting: number;
  currentlyServing: TokenRecord[];
  canManage?: boolean;
}

export interface LiveDisplayData {
  organization: {
    id: number;
    slug: string;
    name: string;
    category: string;
    location: string;
    description: string;
  };
  services: ServiceSummary[];
  counters: CounterRecord[];
  servingList: (TokenRecord & { serviceName: string; counterName: string })[];
  waitingQueue: (TokenRecord & { serviceName: string; position: number })[];
  recentlyCompleted: TokenRecord[];
}

export interface NotificationItem {
  id: number;
  userUid: string;
  tokenId: number | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminWorkspaceData {
  organization: {
    id: number;
    slug: string;
    name: string;
    category: string;
    location: string;
    description: string;
  };
  services: ServiceSummary[];
  counters: CounterRecord[];
  tokens: (TokenRecord & { serviceName: string })[];
  analytics: {
    totalTokens: number;
    waitingCount: number;
    servingCount: number;
    completedCount: number;
    priorityCount: number;
    avgActualWaitMinutes: number;
    hourlySeries: {
      hour: string;
      booked: number;
      completed: number;
      priority: number;
    }[];
    serviceBreakdown: {
      name: string;
      waiting: number;
      completed: number;
      total: number;
    }[];
  };
}

export interface QueueSocketMessage {
  type: 'connected' | 'queue:updated' | 'token:called' | 'token:booked' | 'token:cancelled';
  organizationId?: number;
  serviceId?: number;
  tokenCode?: string;
  counterName?: string;
  timestamp: string;
}

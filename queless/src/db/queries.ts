import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  counters,
  notifications,
  organizations,
  services,
  tokens,
  users,
} from './schema.ts';

const INITIAL_ADMIN_EMAIL = 'kunalchoure07@gmail.com';

export async function getOrCreateUser(uid: string, email: string, name: string) {
  try {
    const isInitialAdmin = email.toLowerCase() === INITIAL_ADMIN_EMAIL;
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const nextRole = isInitialAdmin ? 'admin' : current.role;
      if (current.email !== email || current.role !== nextRole) {
        const updated = await db
          .update(users)
          .set({ email, role: nextRole })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        name,
        role: isInitialAdmin ? 'admin' : 'customer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed (getOrCreateUser):', error);
    throw new Error('Unable to verify user profile.', { cause: error });
  }
}

export async function updateUserProfile(
  uid: string,
  data: { name?: string; phone?: string; defaultPriorityType?: string }
) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.defaultPriorityType !== undefined
          ? { defaultPriorityType: data.defaultPriorityType }
          : {}),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed (updateUserProfile):', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function getPublicStats() {
  try {
    const [orgRows, allTokens, openServices] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.isActive, true)),
      db.select().from(tokens),
      db.select().from(services).where(eq(services.isOpen, true)),
    ]);

    const completedCount = allTokens.filter((t) => t.status === 'completed').length;
    const waitingCount = allTokens.filter((t) => t.status === 'waiting').length;
    const servingCount = allTokens.filter((t) => t.status === 'serving').length;
    const priorityCount = allTokens.filter((t) => t.isPriority).length;

    const avgServiceMins =
      openServices.length > 0
        ? Math.round(
            openServices.reduce((acc, s) => acc + s.avgServiceMinutes, 0) /
              openServices.length
          )
        : 8;

    return {
      activeOrganizations: orgRows.length,
      openServices: openServices.length,
      totalTokensIssued: allTokens.length,
      completedTokens: completedCount,
      waitingTokens: waitingCount,
      servingTokens: servingCount,
      priorityTokens: priorityCount,
      avgServiceMinutes: avgServiceMins,
    };
  } catch (error) {
    console.error('Database query failed (getPublicStats):', error);
    throw new Error('Unable to load live platform statistics.', { cause: error });
  }
}

export async function getOrganizationsWithQueues() {
  try {
    const [orgList, serviceList, counterList, activeTokens] = await Promise.all([
      db
        .select()
        .from(organizations)
        .where(eq(organizations.isActive, true))
        .orderBy(asc(organizations.id)),
      db.select().from(services).orderBy(asc(services.id)),
      db.select().from(counters).orderBy(asc(counters.id)),
      db
        .select()
        .from(tokens)
        .where(inArray(tokens.status, ['waiting', 'serving']))
        .orderBy(desc(tokens.isPriority), asc(tokens.sequenceNumber)),
    ]);

    return orgList.map((org) => {
      const orgServices = serviceList
        .filter((s) => s.organizationId === org.id)
        .map((svc) => {
          const svcWaiting = activeTokens.filter(
            (t) => t.serviceId === svc.id && t.status === 'waiting'
          );
          const svcServing = activeTokens.filter(
            (t) => t.serviceId === svc.id && t.status === 'serving'
          );
          const activeCountersForSvc = counterList.filter(
            (c) =>
              c.organizationId === org.id &&
              c.status === 'active' &&
              (c.serviceId === svc.id || c.serviceId === null)
          );
          const divisor = Math.max(1, activeCountersForSvc.length);
          const estWait = Math.round((svcWaiting.length * svc.avgServiceMinutes) / divisor);

          return {
            ...svc,
            waitingCount: svcWaiting.length,
            priorityWaitingCount: svcWaiting.filter((t) => t.isPriority).length,
            servingTokens: svcServing,
            estimatedWaitMinutes: estWait,
          };
        });

      const orgCounters = counterList.filter((c) => c.organizationId === org.id);
      const totalWaiting = orgServices.reduce((acc, s) => acc + s.waitingCount, 0);
      const currentlyServing = activeTokens.filter(
        (t) => t.organizationId === org.id && t.status === 'serving'
      );

      return {
        ...org,
        services: orgServices,
        counters: orgCounters,
        totalWaiting,
        currentlyServing,
      };
    });
  } catch (error) {
    console.error('Database query failed (getOrganizationsWithQueues):', error);
    throw new Error('Unable to load organizations.', { cause: error });
  }
}

export async function getOrganizationLiveDisplay(slugOrId: string) {
  try {
    const isNumeric = /^\d+$/.test(slugOrId);
    const orgRows = await db
      .select()
      .from(organizations)
      .where(
        isNumeric
          ? eq(organizations.id, Number(slugOrId))
          : eq(organizations.slug, slugOrId)
      )
      .limit(1);

    if (orgRows.length === 0) {
      return null;
    }

    const org = orgRows[0];
    const [orgServices, orgCounters, orgTokens] = await Promise.all([
      db
        .select()
        .from(services)
        .where(eq(services.organizationId, org.id))
        .orderBy(asc(services.id)),
      db
        .select()
        .from(counters)
        .where(eq(counters.organizationId, org.id))
        .orderBy(asc(counters.id)),
      db
        .select()
        .from(tokens)
        .where(eq(tokens.organizationId, org.id))
        .orderBy(desc(tokens.isPriority), asc(tokens.sequenceNumber)),
    ]);

    const serviceMap = new Map(orgServices.map((s) => [s.id, s]));
    const tokenMap = new Map(orgTokens.map((t) => [t.id, t]));

    const enrichedCounters = orgCounters.map((c) => {
      const currentToken = c.currentTokenId
        ? tokenMap.get(c.currentTokenId) || null
        : orgTokens.find((t) => t.counterId === c.id && t.status === 'serving') || null;
      const service = c.serviceId ? serviceMap.get(c.serviceId) || null : null;
      return {
        ...c,
        serviceName: service?.name || 'All Services',
        currentToken,
      };
    });

    const waitingQueue = orgTokens
      .filter((t) => t.status === 'waiting')
      .map((t, idx) => ({
        ...t,
        serviceName: serviceMap.get(t.serviceId)?.name || 'Service',
        position: idx + 1,
      }));

    const servingList = orgTokens
      .filter((t) => t.status === 'serving')
      .map((t) => ({
        ...t,
        serviceName: serviceMap.get(t.serviceId)?.name || 'Service',
        counterName:
          orgCounters.find((c) => c.id === t.counterId)?.name || 'Counter',
      }));

    const recentlyCompleted = orgTokens
      .filter((t) => t.status === 'completed')
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      )
      .slice(0, 6);

    return {
      organization: org,
      services: orgServices,
      counters: enrichedCounters,
      servingList,
      waitingQueue,
      recentlyCompleted,
    };
  } catch (error) {
    console.error('Database query failed (getOrganizationLiveDisplay):', error);
    throw new Error('Unable to load live display data.', { cause: error });
  }
}

export async function createToken(input: {
  organizationId: number;
  serviceId: number;
  userUid?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  isPriority: boolean;
  priorityReason: string;
  notes?: string | null;
}) {
  try {
    return await db.transaction(async (tx) => {
      const svcRows = await tx
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (svcRows.length === 0) {
        throw new Error('Selected service does not exist.');
      }

      const svc = svcRows[0];
      if (!svc.isOpen) {
        throw new Error('This service queue is currently paused.');
      }

      const nextSeq = svc.currentCounter + 1;
      const tokenCode = `${svc.prefix}-${String(nextSeq).padStart(3, '0')}`;

      await tx
        .update(services)
        .set({ currentCounter: nextSeq })
        .where(eq(services.id, svc.id));

      const waitingInService = await tx
        .select()
        .from(tokens)
        .where(and(eq(tokens.serviceId, svc.id), eq(tokens.status, 'waiting')));

      const activeCounters = await tx
        .select()
        .from(counters)
        .where(
          and(
            eq(counters.organizationId, input.organizationId),
            eq(counters.status, 'active')
          )
        );
      const matchingCounters = activeCounters.filter(
        (c) => c.serviceId === svc.id || c.serviceId === null
      );
      const divisor = Math.max(1, matchingCounters.length);

      const effectivePriority = svc.priorityEnabled ? input.isPriority : false;
      const aheadCount = effectivePriority
        ? waitingInService.filter((t) => t.isPriority).length
        : waitingInService.length;

      const estimatedWaitMinutes = Math.max(
        2,
        Math.round(((aheadCount + 1) * svc.avgServiceMinutes) / divisor)
      );

      const inserted = await tx
        .insert(tokens)
        .values({
          tokenCode,
          organizationId: input.organizationId,
          serviceId: svc.id,
          userUid: input.userUid || null,
          customerName: input.customerName,
          customerPhone: input.customerPhone || null,
          customerEmail: input.customerEmail || null,
          isPriority: effectivePriority,
          priorityReason: effectivePriority ? input.priorityReason : 'standard',
          notes: input.notes || null,
          status: 'waiting',
          sequenceNumber: nextSeq,
          estimatedWaitMinutes,
        })
        .returning();

      const createdToken = inserted[0];

      if (input.userUid) {
        await tx.insert(notifications).values({
          userUid: input.userUid,
          tokenId: createdToken.id,
          title: `Token ${tokenCode} Booked`,
          message: `You are #${aheadCount + 1} in line for ${svc.name}. Estimated wait: ${estimatedWaitMinutes} mins.`,
          type: 'info',
        });
      }

      const orgRows = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1);

      return {
        token: createdToken,
        organizationName: orgRows[0]?.name || 'Organization',
        organizationSlug: orgRows[0]?.slug || '',
        serviceName: svc.name,
        positionInQueue: aheadCount + 1,
        estimatedWaitMinutes,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('service')) {
      throw error;
    }
    console.error('Database query failed (createToken):', error);
    throw new Error('Unable to book queue token.', { cause: error });
  }
}

async function enrichTokensWithLivePosition(tokenList: (typeof tokens.$inferSelect)[]) {
  if (tokenList.length === 0) return [];

  const orgIds = Array.from(new Set(tokenList.map((t) => t.organizationId)));
  const svcIds = Array.from(new Set(tokenList.map((t) => t.serviceId)));

  const [orgRows, svcRows, counterRows, allServiceTokens] = await Promise.all([
    db.select().from(organizations).where(inArray(organizations.id, orgIds)),
    db.select().from(services).where(inArray(services.id, svcIds)),
    db.select().from(counters).where(inArray(counters.organizationId, orgIds)),
    db
      .select()
      .from(tokens)
      .where(
        and(
          inArray(tokens.serviceId, svcIds),
          inArray(tokens.status, ['waiting', 'serving'])
        )
      )
      .orderBy(desc(tokens.isPriority), asc(tokens.sequenceNumber)),
  ]);

  const orgMap = new Map(orgRows.map((o) => [o.id, o]));
  const svcMap = new Map(svcRows.map((s) => [s.id, s]));
  const counterMap = new Map(counterRows.map((c) => [c.id, c]));

  return tokenList.map((token) => {
    const org = orgMap.get(token.organizationId);
    const svc = svcMap.get(token.serviceId);
    const counter = token.counterId ? counterMap.get(token.counterId) : undefined;

    const waitingQueue = allServiceTokens.filter(
      (t) => t.serviceId === token.serviceId && t.status === 'waiting'
    );
    const servingNow = allServiceTokens.filter(
      (t) => t.serviceId === token.serviceId && t.status === 'serving'
    );

    let positionInQueue = 0;
    let dynamicEtaMinutes = 0;

    if (token.status === 'waiting') {
      const idx = waitingQueue.findIndex((t) => t.id === token.id);
      positionInQueue = idx >= 0 ? idx + 1 : 1;
      const activeCounterCount = Math.max(
        1,
        counterRows.filter(
          (c) =>
            c.organizationId === token.organizationId &&
            c.status === 'active' &&
            (c.serviceId === token.serviceId || c.serviceId === null)
        ).length
      );
      dynamicEtaMinutes = Math.max(
        2,
        Math.round(
          (positionInQueue * (svc?.avgServiceMinutes || 8)) / activeCounterCount
        )
      );
    }

    return {
      ...token,
      organizationName: org?.name || 'Organization',
      organizationSlug: org?.slug || '',
      organizationLocation: org?.location || '',
      organizationCategory: org?.category || '',
      serviceName: svc?.name || 'Service',
      avgServiceMinutes: svc?.avgServiceMinutes || 8,
      counterName: counter?.name || null,
      staffName: counter?.staffName || null,
      positionInQueue,
      peopleAhead: Math.max(0, positionInQueue - 1),
      dynamicEtaMinutes,
      currentlyServingCode: servingNow[0]?.tokenCode || null,
    };
  });
}

export async function getUserTokens(uid: string) {
  try {
    const userTokens = await db
      .select()
      .from(tokens)
      .where(eq(tokens.userUid, uid))
      .orderBy(desc(tokens.bookedAt))
      .limit(50);

    return await enrichTokensWithLivePosition(userTokens);
  } catch (error) {
    console.error('Database query failed (getUserTokens):', error);
    throw new Error('Unable to load your tokens.', { cause: error });
  }
}

export async function lookupToken(query: string) {
  try {
    const clean = query.trim();
    if (!clean) return [];

    const matched = await db
      .select()
      .from(tokens)
      .where(
        or(
          ilike(tokens.tokenCode, clean),
          eq(tokens.customerPhone, clean)
        )
      )
      .orderBy(desc(tokens.bookedAt))
      .limit(10);

    return await enrichTokensWithLivePosition(matched);
  } catch (error) {
    console.error('Database query failed (lookupToken):', error);
    throw new Error('Unable to look up token.', { cause: error });
  }
}

export async function cancelToken(tokenId: number, actorUid: string, isGlobalAdmin: boolean) {
  try {
    const rows = await db
      .select()
      .from(tokens)
      .where(eq(tokens.id, tokenId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error('Token not found.');
    }

    const token = rows[0];
    const orgRows = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, token.organizationId))
      .limit(1);
    const isOrgOwner = orgRows[0]?.ownerUid === actorUid;

    if (token.userUid !== actorUid && !isGlobalAdmin && !isOrgOwner) {
      throw new Error('Unauthorized to cancel this token.');
    }

    if (token.status !== 'waiting') {
      throw new Error('Only waiting tokens can be cancelled.');
    }

    const updated = await db
      .update(tokens)
      .set({ status: 'cancelled' })
      .where(eq(tokens.id, tokenId))
      .returning();

    return updated[0];
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Only') || error.message.includes('not found'))) {
      throw error;
    }
    console.error('Database query failed (cancelToken):', error);
    throw new Error('Unable to cancel token.', { cause: error });
  }
}

export async function getAdminOrganizations(uid: string, role: string) {
  try {
    const allOrgs = await getOrganizationsWithQueues();
    const isGlobalAdmin = role === 'admin';
    return allOrgs.map((org) => ({
      ...org,
      canManage: isGlobalAdmin || org.ownerUid === uid,
    }));
  } catch (error) {
    console.error('Database query failed (getAdminOrganizations):', error);
    throw new Error('Unable to load admin organizations.', { cause: error });
  }
}

async function verifyOrgPermission(
  organizationId: number,
  actorUid: string,
  role: string
) {
  const orgRows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (orgRows.length === 0) {
    throw new Error('Organization not found.');
  }
  const org = orgRows[0];
  if (role !== 'admin' && org.ownerUid !== actorUid) {
    throw new Error('Forbidden: You do not have admin permissions for this organization.');
  }
  return org;
}

export async function callNextToken(
  organizationId: number,
  counterId: number,
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);

    return await db.transaction(async (tx) => {
      const counterRows = await tx
        .select()
        .from(counters)
        .where(
          and(
            eq(counters.id, counterId),
            eq(counters.organizationId, organizationId)
          )
        )
        .limit(1);

      if (counterRows.length === 0) {
        throw new Error('Counter not found.');
      }
      const counter = counterRows[0];

      let completedToken = null;
      if (counter.currentTokenId) {
        const prev = await tx
          .update(tokens)
          .set({ status: 'completed', completedAt: new Date() })
          .where(
            and(
              eq(tokens.id, counter.currentTokenId),
              eq(tokens.status, 'serving')
            )
          )
          .returning();
        completedToken = prev[0] || null;
        if (completedToken?.userUid) {
          await tx.insert(notifications).values({
            userUid: completedToken.userUid,
            tokenId: completedToken.id,
            title: `Service Completed — ${completedToken.tokenCode}`,
            message: `Thank you for visiting. Your visit at ${counter.name} is complete.`,
            type: 'completed',
          });
        }
      }

      const waitingCandidates = await tx
        .select()
        .from(tokens)
        .where(
          and(
            eq(tokens.organizationId, organizationId),
            eq(tokens.status, 'waiting'),
            ...(counter.serviceId ? [eq(tokens.serviceId, counter.serviceId)] : [])
          )
        )
        .orderBy(desc(tokens.isPriority), asc(tokens.sequenceNumber));

      if (waitingCandidates.length === 0) {
        await tx
          .update(counters)
          .set({ currentTokenId: null })
          .where(eq(counters.id, counter.id));

        return {
          completedToken,
          calledToken: null,
          counter: { ...counter, currentTokenId: null },
        };
      }

      const nextToken = waitingCandidates[0];
      const updatedCalled = await tx
        .update(tokens)
        .set({
          status: 'serving',
          counterId: counter.id,
          calledAt: new Date(),
        })
        .where(eq(tokens.id, nextToken.id))
        .returning();

      const calledToken = updatedCalled[0];

      await tx
        .update(counters)
        .set({ currentTokenId: calledToken.id })
        .where(eq(counters.id, counter.id));

      if (calledToken.userUid) {
        await tx.insert(notifications).values({
          userUid: calledToken.userUid,
          tokenId: calledToken.id,
          title: `It's Your Turn! ${calledToken.tokenCode}`,
          message: `Please proceed to ${counter.name} (${counter.staffName}) now.`,
          type: 'called',
        });
      }

      // Notify next 2 waiting users that their turn is coming up soon
      const upcoming = waitingCandidates.slice(1, 3);
      for (let i = 0; i < upcoming.length; i++) {
        const upToken = upcoming[i];
        if (upToken.userUid) {
          await tx.insert(notifications).values({
            userUid: upToken.userUid,
            tokenId: upToken.id,
            title: `Almost Your Turn — ${upToken.tokenCode}`,
            message: `You are #${i + 1} in line. Please head toward the service area.`,
            type: 'turn_soon',
          });
        }
      }

      return {
        completedToken,
        calledToken,
        counter: { ...counter, currentTokenId: calledToken.id },
      };
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('not found'))) {
      throw error;
    }
    console.error('Database query failed (callNextToken):', error);
    throw new Error('Unable to advance queue.', { cause: error });
  }
}

export async function finishCounterToken(
  organizationId: number,
  counterId: number,
  outcome: 'completed' | 'no_show',
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);

    return await db.transaction(async (tx) => {
      const counterRows = await tx
        .select()
        .from(counters)
        .where(
          and(
            eq(counters.id, counterId),
            eq(counters.organizationId, organizationId)
          )
        )
        .limit(1);

      if (counterRows.length === 0) {
        throw new Error('Counter not found.');
      }

      const counter = counterRows[0];
      let updatedToken = null;
      if (counter.currentTokenId) {
        const res = await tx
          .update(tokens)
          .set({
            status: outcome,
            completedAt: new Date(),
          })
          .where(eq(tokens.id, counter.currentTokenId))
          .returning();
        updatedToken = res[0] || null;
      }

      await tx
        .update(counters)
        .set({ currentTokenId: null })
        .where(eq(counters.id, counter.id));

      return { updatedToken, counterId: counter.id };
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('not found'))) {
      throw error;
    }
    console.error('Database query failed (finishCounterToken):', error);
    throw new Error('Unable to update token status.', { cause: error });
  }
}

export async function toggleCounterStatus(
  organizationId: number,
  counterId: number,
  status: 'active' | 'paused',
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);
    const updated = await db
      .update(counters)
      .set({ status })
      .where(
        and(
          eq(counters.id, counterId),
          eq(counters.organizationId, organizationId)
        )
      )
      .returning();
    return updated[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) throw error;
    console.error('Database query failed (toggleCounterStatus):', error);
    throw new Error('Unable to update counter status.', { cause: error });
  }
}

export async function createOrganization(input: {
  name: string;
  category: string;
  location: string;
  description: string;
  ownerUid: string;
  serviceName: string;
  servicePrefix: string;
  avgServiceMinutes: number;
  counterName: string;
  staffName: string;
}) {
  try {
    const baseSlug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    return await db.transaction(async (tx) => {
      const orgInserted = await tx
        .insert(organizations)
        .values({
          slug,
          name: input.name,
          category: input.category,
          location: input.location,
          description: input.description,
          ownerUid: input.ownerUid,
          isActive: true,
        })
        .returning();

      const org = orgInserted[0];

      const svcInserted = await tx
        .insert(services)
        .values({
          organizationId: org.id,
          name: input.serviceName,
          prefix: input.servicePrefix.toUpperCase(),
          avgServiceMinutes: input.avgServiceMinutes,
          priorityEnabled: true,
          isOpen: true,
          currentCounter: 0,
        })
        .returning();

      const svc = svcInserted[0];

      const counterInserted = await tx
        .insert(counters)
        .values({
          organizationId: org.id,
          serviceId: svc.id,
          name: input.counterName,
          staffName: input.staffName,
          status: 'active',
        })
        .returning();

      return { organization: org, service: svc, counter: counterInserted[0] };
    });
  } catch (error) {
    console.error('Database query failed (createOrganization):', error);
    throw new Error('Unable to create organization.', { cause: error });
  }
}

export async function createService(
  organizationId: number,
  input: { name: string; prefix: string; avgServiceMinutes: number; priorityEnabled: boolean },
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);
    const inserted = await db
      .insert(services)
      .values({
        organizationId,
        name: input.name,
        prefix: input.prefix.toUpperCase(),
        avgServiceMinutes: input.avgServiceMinutes,
        priorityEnabled: input.priorityEnabled,
        isOpen: true,
        currentCounter: 0,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) throw error;
    console.error('Database query failed (createService):', error);
    throw new Error('Unable to add service.', { cause: error });
  }
}

export async function toggleServiceOpen(
  organizationId: number,
  serviceId: number,
  isOpen: boolean,
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);
    const updated = await db
      .update(services)
      .set({ isOpen })
      .where(
        and(eq(services.id, serviceId), eq(services.organizationId, organizationId))
      )
      .returning();
    return updated[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) throw error;
    console.error('Database query failed (toggleServiceOpen):', error);
    throw new Error('Unable to update service status.', { cause: error });
  }
}

export async function createCounter(
  organizationId: number,
  input: { name: string; staffName: string; serviceId: number | null },
  actorUid: string,
  role: string
) {
  try {
    await verifyOrgPermission(organizationId, actorUid, role);
    const inserted = await db
      .insert(counters)
      .values({
        organizationId,
        serviceId: input.serviceId,
        name: input.name,
        staffName: input.staffName,
        status: 'active',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Forbidden')) throw error;
    console.error('Database query failed (createCounter):', error);
    throw new Error('Unable to add counter.', { cause: error });
  }
}

export async function getOrganizationAdminWorkspace(
  organizationId: number,
  actorUid: string,
  role: string
) {
  try {
    const org = await verifyOrgPermission(organizationId, actorUid, role);

    const [orgServices, orgCounters, orgTokens] = await Promise.all([
      db
        .select()
        .from(services)
        .where(eq(services.organizationId, organizationId))
        .orderBy(asc(services.id)),
      db
        .select()
        .from(counters)
        .where(eq(counters.organizationId, organizationId))
        .orderBy(asc(counters.id)),
      db
        .select()
        .from(tokens)
        .where(eq(tokens.organizationId, organizationId))
        .orderBy(desc(tokens.isPriority), asc(tokens.sequenceNumber)),
    ]);

    const serviceMap = new Map(orgServices.map((s) => [s.id, s]));
    const tokenMap = new Map(orgTokens.map((t) => [t.id, t]));

    const enrichedCounters = orgCounters.map((c) => ({
      ...c,
      serviceName: c.serviceId ? serviceMap.get(c.serviceId)?.name || 'General' : 'All Services',
      currentToken: c.currentTokenId ? tokenMap.get(c.currentTokenId) || null : null,
    }));

    const enrichedTokens = orgTokens.map((t) => ({
      ...t,
      serviceName: serviceMap.get(t.serviceId)?.name || 'Service',
    }));

    // Compute real analytics from tokens
    const completedTokens = orgTokens.filter((t) => t.status === 'completed');
    const waitingTokens = orgTokens.filter((t) => t.status === 'waiting');
    const servingTokens = orgTokens.filter((t) => t.status === 'serving');
    const priorityCount = orgTokens.filter((t) => t.isPriority).length;

    const waitDurations = completedTokens
      .filter((t) => t.calledAt && t.bookedAt)
      .map((t) =>
        Math.max(
          1,
          Math.round((t.calledAt!.getTime() - t.bookedAt.getTime()) / 60000)
        )
      );
    const avgActualWait =
      waitDurations.length > 0
        ? Math.round(
            waitDurations.reduce((a, b) => a + b, 0) / waitDurations.length
          )
        : 0;

    // Hourly distribution for Recharts
    const hourBuckets = new Map<string, { hour: string; booked: number; completed: number; priority: number }>();
    for (const tk of orgTokens) {
      const hr = new Date(tk.bookedAt).getHours();
      const label = `${String(hr).padStart(2, '0')}:00`;
      const existing = hourBuckets.get(label) || {
        hour: label,
        booked: 0,
        completed: 0,
        priority: 0,
      };
      existing.booked += 1;
      if (tk.status === 'completed') existing.completed += 1;
      if (tk.isPriority) existing.priority += 1;
      hourBuckets.set(label, existing);
    }

    const hourlySeries = Array.from(hourBuckets.values()).sort((a, b) =>
      a.hour.localeCompare(b.hour)
    );

    const serviceBreakdown = orgServices.map((svc) => {
      const svcTokens = orgTokens.filter((t) => t.serviceId === svc.id);
      return {
        name: svc.name,
        waiting: svcTokens.filter((t) => t.status === 'waiting').length,
        completed: svcTokens.filter((t) => t.status === 'completed').length,
        total: svcTokens.length,
      };
    });

    return {
      organization: org,
      services: orgServices,
      counters: enrichedCounters,
      tokens: enrichedTokens,
      analytics: {
        totalTokens: orgTokens.length,
        waitingCount: waitingTokens.length,
        servingCount: servingTokens.length,
        completedCount: completedTokens.length,
        priorityCount,
        avgActualWaitMinutes: avgActualWait,
        hourlySeries,
        serviceBreakdown,
      },
    };
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Forbidden') || error.message.includes('not found'))) {
      throw error;
    }
    console.error('Database query failed (getOrganizationAdminWorkspace):', error);
    throw new Error('Unable to load organization workspace.', { cause: error });
  }
}

export async function getUserNotifications(uid: string) {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userUid, uid))
      .orderBy(desc(notifications.createdAt))
      .limit(20);
  } catch (error) {
    console.error('Database query failed (getUserNotifications):', error);
    throw new Error('Unable to load notifications.', { cause: error });
  }
}

export async function markAllNotificationsRead(uid: string) {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userUid, uid));
    return { ok: true };
  } catch (error) {
    console.error('Database query failed (markAllNotificationsRead):', error);
    throw new Error('Unable to update notifications.', { cause: error });
  }
}

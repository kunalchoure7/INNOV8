import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('customer'), // 'customer' | 'admin'
  defaultPriorityType: text('default_priority_type').notNull().default('standard'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Hospital' | 'Bank' | 'Government' | 'College' | 'Service Centre'
  location: text('location').notNull(),
  description: text('description').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ownerUid: text('owner_uid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  avgServiceMinutes: integer('avg_service_minutes').notNull().default(8),
  priorityEnabled: boolean('priority_enabled').notNull().default(true),
  isOpen: boolean('is_open').notNull().default(true),
  currentCounter: integer('current_counter').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const counters = pgTable('counters', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer('service_id').references(() => services.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  staffName: text('staff_name').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'paused'
  currentTokenId: integer('current_token_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  tokenCode: text('token_code').notNull(),
  organizationId: integer('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer('service_id')
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  counterId: integer('counter_id').references(() => counters.id, {
    onDelete: 'set null',
  }),
  userUid: text('user_uid'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  isPriority: boolean('is_priority').notNull().default(false),
  priorityReason: text('priority_reason').notNull().default('standard'),
  notes: text('notes'),
  status: text('status').notNull().default('waiting'), // 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show'
  sequenceNumber: integer('sequence_number').notNull(),
  estimatedWaitMinutes: integer('estimated_wait_minutes').notNull().default(0),
  bookedAt: timestamp('booked_at').defaultNow().notNull(),
  calledAt: timestamp('called_at'),
  completedAt: timestamp('completed_at'),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  tokenId: integer('token_id').references(() => tokens.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // 'info' | 'turn_soon' | 'called' | 'completed'
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  services: many(services),
  counters: many(counters),
  tokens: many(tokens),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.organizationId],
    references: [organizations.id],
  }),
  counters: many(counters),
  tokens: many(tokens),
}));

export const countersRelations = relations(counters, ({ one }) => ({
  organization: one(organizations, {
    fields: [counters.organizationId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [counters.serviceId],
    references: [services.id],
  }),
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
  organization: one(organizations, {
    fields: [tokens.organizationId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [tokens.serviceId],
    references: [services.id],
  }),
  counter: one(counters, {
    fields: [tokens.counterId],
    references: [counters.id],
  }),
}));

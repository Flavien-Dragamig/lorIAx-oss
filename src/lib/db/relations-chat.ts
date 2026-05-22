/**
 * Relations inverses pour les entités chat.
 * Fichier séparé pour éviter une dépendance circulaire entre schema.ts et schema-chat.ts.
 * schema-chat.ts importe users/teams/spaces/documents depuis schema.ts,
 * donc schema.ts ne peut pas importer depuis schema-chat.ts.
 */
import { relations } from "drizzle-orm";
import { users, teams, spaces, documents } from "./schema";
import {
  chatChannels,
  chatChannelMembers,
  chatMessages,
} from "./schema-chat";

export const usersExtendedRelations = relations(users, ({ many }) => ({
  chatMemberships: many(chatChannelMembers),
  chatMessages: many(chatMessages),
}));

export const teamsExtendedRelations = relations(teams, ({ many }) => ({
  chatChannels: many(chatChannels),
}));

export const spacesExtendedRelations = relations(spaces, ({ many }) => ({
  chatChannels: many(chatChannels),
}));

export const documentsExtendedRelations = relations(documents, ({ many }) => ({
  chatMessages: many(chatMessages),
}));

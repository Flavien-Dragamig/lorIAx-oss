import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  users,
  teams,
  teamMembers,
  spaces,
  documents,
  documentLinks,
  spacePermissions,
  documentPermissions,
  templates,
  attachments,
  documentEmbeddings,
  aiProviders,
  activityLog,
  userDatabases,
  userDatabaseColumns,
  userDatabaseRows,
  publicShares,
  calendars,
  calendarEvents,
  calendarEventAttendees,
  calendarEventReminders,
  calendarSubscriptions,
  calendarExternalFeeds,
  eventDependencies,
  meetings,
  meetingParticipants,
  visioPermissions,
  favorites,
} from "@/lib/db/schema";

// Select types (lecture depuis la BDD)
export type User = InferSelectModel<typeof users>;
export type Team = InferSelectModel<typeof teams>;
export type TeamMember = InferSelectModel<typeof teamMembers>;
export type Space = InferSelectModel<typeof spaces>;
export type Document = InferSelectModel<typeof documents>;
export type DocumentLink = InferSelectModel<typeof documentLinks>;
export type SpacePermission = InferSelectModel<typeof spacePermissions>;
export type DocumentPermission = InferSelectModel<typeof documentPermissions>;
export type Template = InferSelectModel<typeof templates>;
export type Attachment = InferSelectModel<typeof attachments>;
export type DocumentEmbedding = InferSelectModel<typeof documentEmbeddings>;
export type AiProvider = InferSelectModel<typeof aiProviders>;
export type ActivityLogEntry = InferSelectModel<typeof activityLog>;
export type UserDatabase = InferSelectModel<typeof userDatabases>;
export type UserDatabaseColumn = InferSelectModel<typeof userDatabaseColumns>;
export type UserDatabaseRow = InferSelectModel<typeof userDatabaseRows>;
export type PublicShare = InferSelectModel<typeof publicShares>;

// Insert types (ecriture vers la BDD)
export type NewUser = InferInsertModel<typeof users>;
export type NewTeam = InferInsertModel<typeof teams>;
export type NewSpace = InferInsertModel<typeof spaces>;
export type NewDocument = InferInsertModel<typeof documents>;
export type NewTemplate = InferInsertModel<typeof templates>;
export type NewAttachment = InferInsertModel<typeof attachments>;
export type NewUserDatabase = InferInsertModel<typeof userDatabases>;
export type NewUserDatabaseColumn = InferInsertModel<typeof userDatabaseColumns>;
export type NewUserDatabaseRow = InferInsertModel<typeof userDatabaseRows>;
export type NewPublicShare = InferInsertModel<typeof publicShares>;

// Calendar types
export type Calendar = InferSelectModel<typeof calendars>;
export type CalendarEvent = InferSelectModel<typeof calendarEvents>;
export type CalendarEventAttendee = InferSelectModel<typeof calendarEventAttendees>;
export type CalendarEventReminder = InferSelectModel<typeof calendarEventReminders>;
export type CalendarSubscription = InferSelectModel<typeof calendarSubscriptions>;
export type NewCalendar = InferInsertModel<typeof calendars>;
export type NewCalendarEvent = InferInsertModel<typeof calendarEvents>;
export type NewCalendarEventAttendee = InferInsertModel<typeof calendarEventAttendees>;
export type NewCalendarEventReminder = InferInsertModel<typeof calendarEventReminders>;
export type NewCalendarSubscription = InferInsertModel<typeof calendarSubscriptions>;
export type CalendarExternalFeed = InferSelectModel<typeof calendarExternalFeeds>;
export type NewCalendarExternalFeed = InferInsertModel<typeof calendarExternalFeeds>;
export type EventDependency = InferSelectModel<typeof eventDependencies>;

// Meeting types
export type Meeting = InferSelectModel<typeof meetings>;
export type MeetingParticipant = InferSelectModel<typeof meetingParticipants>;
export type VisioPermission = InferSelectModel<typeof visioPermissions>;
export type NewVisioPermission = InferInsertModel<typeof visioPermissions>;

// Favorite types
export type Favorite = InferSelectModel<typeof favorites>;
export type NewFavorite = InferInsertModel<typeof favorites>;
export type EntityType = 'document' | 'space' | 'template' | 'calendar_event' | 'meeting';

export type MeetingRoomPrincipalType = "user" | "team" | "role";
export type MeetingRoomBookingStatus = "confirmed" | "cancelled";

export interface OpeningHoursSlot {
  from: string; // "HH:MM"
  to: string;   // "HH:MM"
}
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Record<DayOfWeek, OpeningHoursSlot[]>;

export interface BookingAttendee {
  userId?: string;
  email?: string;
  displayName?: string;
}

export interface ResolvedFavorite {
  id: string;
  entityType: EntityType;
  entityId: string;
  position: number;
  title: string;
  icon?: string | null;
  href: string;
  badge?: string;
  subtitle?: string;
}

// Types applicatifs
export type UserRole = "super_admin" | "admin" | "editor" | "viewer" | "facility_manager";
export type SpaceType = "personal" | "team" | "organization";
export type DocVisibility = "private" | "team" | "public";
export type ClassificationLevel = "public" | "internal" | "confidential" | "secret";
export type PermissionLevel = "viewer" | "editor" | "admin";
export type ColumnType = "text" | "number" | "date" | "select" | "checkbox" | "relation" | "image" | "formula" | "url" | "email" | "attachment" | "time";
export type CalendarType = "personal" | "team" | "organization";
export type EventStatus = "confirmed" | "tentative" | "cancelled";
export type EventVisibility = "public" | "private" | "confidential";
export type AttendeeRole = "organizer" | "required" | "optional";
export type AttendeeStatus = "accepted" | "declined" | "tentative" | "needs-action";
export type ReminderType = "notification" | "email";
export type CalendarPermission = "read" | "write" | "admin";
export type VisioAction =
  | "join_immediate"
  | "join_scheduled_invited"
  | "join_scheduled_uninvited"
  | "create_immediate"
  | "create_scheduled"
  | "modify_cancel";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  globalRole: UserRole;
  avatarUrl?: string | null;
}

export interface GraphNode {
  id: string;
  title: string;
  spaceId: string;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  linkText?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResult {
  id: string;
  title: string;
  spaceSlug: string;
  spaceName: string;
  excerpt: string;
  score: number;
  type: "fts" | "semantic";
}

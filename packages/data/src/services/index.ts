import * as baseService from "./baseService";
export { baseService };

import * as userService from "./userService";
export { userService };

import * as careGroupService from "./careGroupService";
export { careGroupService };

import * as careGroupMemberService from "./careGroupMemberService";
export { careGroupMemberService };

import * as careRecipientService from "./careRecipientService";
export { careRecipientService };

import * as careGroupInviteService from "./careGroupInviteService";
export { careGroupInviteService };
export type { InviteEmail, InviteMailer } from "./careGroupInviteService";

import * as timelineEntryService from "./timelineEntryService";
export { timelineEntryService };

import * as noteDocumentService from "./noteDocumentService";
export { noteDocumentService };

import * as providerService from "./providerService";
export { providerService };

import * as entryProviderService from "./entryProviderService";
export { entryProviderService };

import * as legalAcceptanceService from "./legalAcceptanceService";
export { legalAcceptanceService };

import * as careGroupConsentService from "./careGroupConsentService";
export { careGroupConsentService };

import * as joinRequestService from "./joinRequestService";
export { joinRequestService };
export type { JoinMailer, JoinNotice, JoinRecipient } from "./joinRequestService";
import * as accessCodeService from "./accessCodeService";
export { accessCodeService };

import * as staffGroupService from "./staffGroupService";
export { staffGroupService };
export type { StaffGroupInput } from "./staffGroupService";
import * as medicationService from "./medicationService";
export { medicationService };
export type { MedicationWriteOptions } from "./medicationService";

import * as waitlistService from "./waitlistService";
export { waitlistService };
export type { JoinResult } from "./waitlistService";

import * as contactMessageService from "./contactMessageService";
export { contactMessageService };
export type { ContactMailer, SendResult } from "./contactMessageService";

import * as careRecipientDetailsService from "./careRecipientDetailsService";
export { careRecipientDetailsService };

import * as emergencyContactService from "./emergencyContactService";
export { emergencyContactService };

import * as userContactService from "./userContactService";
export { userContactService };

import * as memberSharingService from "./memberSharingService";
export { memberSharingService };
import * as medicationPassService from "./medicationPassService";
export { medicationPassService };
export type { PassWriteOptions } from "./medicationPassService";

import * as recipientAllergyService from "./recipientAllergyService";
export { recipientAllergyService };

// Not in `services` below: it reads several tables and has no model of its own.
import * as searchService from "./searchService";
export { searchService };
export type { SearchHit, SearchOptions, SearchResult } from "./searchService";
import * as carePeriodService from "./carePeriodService";
export { carePeriodService };

import * as adminAuditService from "./adminAuditService";
export { adminAuditService };
export type { AuditEntryInput } from "./adminAuditService";
export { auditActorId, staffRefusal } from "./staffAccess";
import * as adminGrantService from "./adminGrantService";
export { adminGrantService };
// Not in `services` below: it reads several tables and has no model of its own.
import * as accountAdminService from "./accountAdminService";
export { accountAdminService };
export type { AccountMailer, AccountMailUser } from "./accountAdminService";

import * as groupAdminService from "./groupAdminService";
export { groupAdminService };
import * as appSettingService from "./appSettingService";
export { appSettingService };
// Not in `services` below: `pnpm db:access` only (database roles, not a table).
import * as dbAccessService from "./dbAccessService";
export { dbAccessService };
export type { GrantResult as DbAccessGrant, PersonalRole } from "./dbAccessService";
// Not in `services`: `pnpm auth:rotate-jwks` only (Better Auth's jwks table).
import * as authKeysService from "./authKeysService";
export { authKeysService };

// Not in `services`: no model behind it (shared rate limits, hosting PRD).
import * as rateLimitService from "./rateLimitService";
export { rateLimitService };
// Not in `services`: no model behind it (suppressed addresses, hosting PRD).
import * as emailSuppressionService from "./emailSuppressionService";
export { emailSuppressionService };

export type * from "./types";

import * as todoService from "./todoService";
export { todoService };

import * as connectorGrantService from "./connectorGrantService";
export { connectorGrantService };
export type {
  ConnectorConnectionView,
  ConnectorGrantView,
  ValidateToken,
  ValidatedToken,
  VerifiedConnector,
} from "./connectorGrantService";

import * as assistantRequestService from "./assistantRequestService";
export { assistantRequestService };
export type {
  AssistantRequestMailer,
  AssistantRequestNotice,
  AssistantRequestView,
} from "./assistantRequestService";

// Not in `services`: no model of its own (assistant actions through connectors).
import * as assistantActionService from "./assistantActionService";
export { assistantActionService };
export type {
  RunOptions as AssistantRunOptions,
  RunResult as AssistantRunResult,
} from "./assistantActionService";

import * as recipientConditionService from "./recipientConditionService";
export { recipientConditionService };

import * as medicationConditionService from "./medicationConditionService";
export { medicationConditionService };
export type { SetMedicationConditionsInput } from "./medicationConditionService";
export type { SetConditionManagersInput } from "./recipientConditionService";

import * as appointmentSeriesService from "./appointmentSeriesService";
export { appointmentSeriesService };
export type { SeriesWriteOptions } from "./appointmentSeriesService";

import * as calendarSettingService from "./calendarSettingService";
export { calendarSettingService };
export type { CalendarSettingsView } from "./calendarSettingService";

import * as calendarFeedService from "./calendarFeedService";
export { calendarFeedService };
export type { CalendarFeed } from "./calendarFeedService";
import * as reminderOverrideService from "./reminderOverrideService";
export { reminderOverrideService };
export type { ReminderChoice } from "./reminderOverrideService";
import * as calendarReminderService from "./calendarReminderService";
export { calendarReminderService };
export type { ReminderGroupInputs } from "./calendarReminderService";
// Google Calendar (appointments-2, slice 7): no model (system-only tables).
import * as googleConnectionService from "./googleConnectionService";
export { googleConnectionService };
import * as calendarSyncService from "./calendarSyncService";
export { calendarSyncService };
export type { PushResult, SyncRunSummary, SyncTarget } from "./calendarSyncService";
// Google Calendar pull (appointments-2, slice 9): applies members' changes through the services.
import * as calendarPullService from "./calendarPullService";
export { calendarPullService };
export type { PullResult, PullSweepSummary } from "./calendarPullService";
import * as symptomTypeService from "./symptomTypeService";
export { symptomTypeService };
export type { BackfillSummary as SymptomBackfillSummary } from "./symptomTypeService";

import * as entryTodoService from "./entryTodoService";
export { entryTodoService };

export const services = {
  user: userService,
  careGroup: careGroupService,
  careGroupMember: careGroupMemberService,
  careRecipient: careRecipientService,
  careGroupInvite: careGroupInviteService,
  timelineEntry: timelineEntryService,
  noteDocument: noteDocumentService,
  provider: providerService,
  entryProvider: entryProviderService,
  careGroupConsent: careGroupConsentService,
  legalAcceptance: legalAcceptanceService,
  joinRequest: joinRequestService,
  accessCode: accessCodeService,
  staffGroup: staffGroupService,
  medication: medicationService,
  waitlist: waitlistService,
  contactMessage: contactMessageService,
  careRecipientDetails: careRecipientDetailsService,
  emergencyContact: emergencyContactService,
  userContact: userContactService,
  memberSharing: memberSharingService,
  carePeriod: carePeriodService,
  medicationPass: medicationPassService,
  recipientAllergy: recipientAllergyService,
  adminAudit: adminAuditService,
  adminGrant: adminGrantService,
  groupAdmin: groupAdminService,
  appSetting: appSettingService,
  todo: todoService,
  connectorGrant: connectorGrantService,
  assistantRequest: assistantRequestService,
  recipientCondition: recipientConditionService,
  medicationCondition: medicationConditionService,
  appointmentSeries: appointmentSeriesService,
  calendarSetting: calendarSettingService,
  calendarFeed: calendarFeedService,
  reminderOverride: reminderOverrideService,
  symptomType: symptomTypeService,
  entryTodo: entryTodoService,
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

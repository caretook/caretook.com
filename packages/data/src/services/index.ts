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

export type * from "./types";

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
  adminAudit: adminAuditService,
  adminGrant: adminGrantService,
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

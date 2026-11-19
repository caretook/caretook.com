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

import * as carePeriodService from "./carePeriodService";
export { carePeriodService };

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
  carePeriod: carePeriodService,
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

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

import * as accessCodeService from "./accessCodeService";
export { accessCodeService };

import * as staffGroupService from "./staffGroupService";
export { staffGroupService };
export type { StaffGroupInput } from "./staffGroupService";

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
  accessCode: accessCodeService,
  staffGroup: staffGroupService,
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

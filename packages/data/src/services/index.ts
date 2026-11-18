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

import * as timelineEntryService from "./timelineEntryService";
export { timelineEntryService };

import * as noteDocumentService from "./noteDocumentService";
export { noteDocumentService };

import * as providerService from "./providerService";
export { providerService };

import * as entryProviderService from "./entryProviderService";
export { entryProviderService };

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
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

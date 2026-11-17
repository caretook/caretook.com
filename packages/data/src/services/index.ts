import * as baseService from "./baseService";
export { baseService };

import * as userService from "./userService";
export { userService };

export type * from "./types";

export const services = {
  user: userService,
};

export type ServiceTypeMap = typeof services;
export type ServiceName = keyof ServiceTypeMap;
export type ServiceType<T extends ServiceName> = ServiceTypeMap[T];
export type ServiceSchemaName<T extends ServiceName> = ServiceType<T>["schemaName"];

export const getService = <T extends ServiceName>(serviceName: T): ServiceType<T> => services[serviceName];

export const isServiceName = (name: unknown): name is ServiceName =>
  typeof name === "string" && Object.hasOwn(services, name);

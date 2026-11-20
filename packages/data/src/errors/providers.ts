export const PROVIDERS_ERRORS = {
  "providerService:invalid": {
    message: "The provider is invalid",
    statusCode: 400,
  },
  "providerService:notFound": {
    message: "Provider not found",
    statusCode: 404,
  },
  "providerService:immutable": {
    message: "A provider's group can't change",
    statusCode: 400,
  },
  "providerService:badPractice": {
    message: "The practice must be a practice or pharmacy in this care group",
    statusCode: 400,
  },
  "providerService:practiceInUse": {
    message: "Clinicians are linked to this practice. Move them to another practice first.",
    statusCode: 400,
  },
  "providerService:practiceHasProviders": {
    message: "Providers are linked to this practice. Move them to another practice, or delete them, first.",
    statusCode: 409,
  },
  "entryProviderService:invalid": {
    message: "The provider link is invalid",
    statusCode: 400,
  },
  "entryProviderService:entryNotFound": {
    message: "That entry is gone. It may have been deleted.",
    statusCode: 404,
  },
  "entryProviderService:providerNotFound": {
    message: "That provider is gone. They may have been deleted.",
    statusCode: 404,
  },
  "entryProviderService:wrongKind": {
    message: "Only notes and events can be linked to providers",
    statusCode: 400,
  },
  "entryProviderService:immutable": {
    message: "A link's entry and provider must be in its care group",
    statusCode: 400,
  },
} as const;

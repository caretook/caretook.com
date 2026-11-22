export const CARE_GROUPS_ERRORS = {
  "careGroupService:notFound": {
    message: "Care group not found",
    statusCode: 404,
  },
  "careGroupMemberService:notFound": {
    message: "Group member not found",
    statusCode: 404,
  },
  "careGroupMemberService:ownerOnly": {
    message: "Only an owner can add, change or remove owners",
    statusCode: 403,
  },
  "careGroupMemberService:lastOwner": {
    message: "A care group needs at least one owner. Make someone else an owner first.",
    statusCode: 409,
  },
  "careGroupInviteService:ownerOnly": {
    message: "Only an owner can invite someone as an owner",
    statusCode: 403,
  },
  "careGroupInviteService:notFound": {
    message: "Invitation not found, or no longer pending",
    statusCode: 404,
  },
  "careGroupInviteService:notAllowed": {
    message: "You can't invite someone with that role",
    statusCode: 403,
  },
  "careGroupInviteService:notAttested": {
    message: "Confirm the care recipient agreed to share with this person first",
    statusCode: 400,
  },
  "careGroupInviteService:alreadyMember": {
    message: "That person is already in this care group",
    statusCode: 409,
  },
  "careGroupInviteService:alreadyInvited": {
    message: "That address already has an invitation waiting. Send it again instead.",
    statusCode: 409,
  },
  "careGroupInviteService:unusable": {
    message: "This invitation can't be used any more",
    statusCode: 409,
  },
  "careGroupInviteService:wrongEmail": {
    message: "This invitation is for a different email address",
    statusCode: 403,
  },
  "careGroupInviteService:noConsent": {
    message: "Agree to what the care group shares before joining",
    statusCode: 400,
  },
  "careGroupInviteService:wrongKind": {
    message: "That isn't an email invitation",
    statusCode: 400,
  },
  "careGroupInviteService:linkRole": {
    message: "An invite link can make caretakers and viewers only",
    statusCode: 403,
  },
  "careGroupInviteService:notLink": {
    message: "That isn't an invite link",
    statusCode: 400,
  },
  "careGroupInviteService:linkInactive": {
    message: "That link has expired, been used up or been withdrawn, so it can't be copied",
    statusCode: 409,
  },
  "careGroupInviteService:linkKeyMissing": {
    message: "INVITE_LINK_KEY is not set, so invite links can't be made",
  },
  "joinRequestService:notFound": {
    message: "That request is no longer waiting",
    statusCode: 404,
  },
  "joinRequestService:notAllowed": {
    message: "Only the care group's owners and admins can answer requests to join",
    statusCode: 403,
  },
  "accessCodeService:notFound": {
    message: "That access code isn't valid",
    statusCode: 404,
  },
  "accessCodeService:unusable": {
    message: "This access code can't be used any more",
    statusCode: 409,
  },
  "accessCodeService:invalid": {
    message: "Check the form and try again",
    statusCode: 400,
  },
  "accessCodeService:noUniqueCode": {
    message: "Couldn't make a new access code. Try again.",
  },
  "careGroupInviteService:linkTooLong": {
    message: "That's longer than invite links may work",
    statusCode: 400,
  },
  "careGroupInviteService:tooManyUses": {
    message: "That's more uses than invite links may have",
    statusCode: 400,
  },
} as const;

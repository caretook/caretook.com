// Tags (tags PRD): the shared tag list and the links that put tags on records.
export const TAGS_ERRORS = {
  "tagService:invalid": {
    message: "The tag is invalid",
    statusCode: 400,
  },
  "tagService:nameTaken": {
    message: "The group already has a tag with that name",
    statusCode: 409,
  },
  "tagService:notFound": {
    message: "That tag is gone. It may have been deleted.",
    statusCode: 404,
  },
  "tagService:immutable": {
    message: "A tag's group can't change",
    statusCode: 400,
  },
  "recordTagService:invalid": {
    message: "The tag link is invalid",
    statusCode: 400,
  },
  "recordTagService:tagNotFound": {
    message: "That tag is gone. It may have been deleted.",
    statusCode: 404,
  },
  "recordTagService:recordNotFound": {
    message: "That record is gone. It may have been deleted.",
    statusCode: 404,
  },
  "recordTagService:immutable": {
    message: "A link's tag and record must be in its care group",
    statusCode: 400,
  },
} as const;

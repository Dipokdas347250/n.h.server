/**
 * Records that must outlive any suspension: merchants, orders, payment proofs,
 * support tickets and the audit log. Nothing in the API deletes them, and
 * these hooks make sure a future change cannot do so by accident either.
 */

const DELETE_OPERATIONS = ["deleteOne", "deleteMany", "findOneAndDelete"];
const UPDATE_OPERATIONS = ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"];

const refuse = (modelName, what) => {
  const error = new Error(`${modelName} records are kept permanently and cannot be ${what}`);
  error.statusCode = 403;
  return error;
};

/** Refuses every way Mongoose can delete a document of this schema. */
exports.preventDeletion = (schema, modelName) => {
  schema.pre(DELETE_OPERATIONS, { document: true, query: true }, function refuseDelete() {
    throw refuse(modelName, "deleted");
  });
};

/** Refuses deletes and any change after the first save: for the audit log. */
exports.makeAppendOnly = (schema, modelName) => {
  exports.preventDeletion(schema, modelName);
  schema.pre(UPDATE_OPERATIONS, function refuseUpdate() {
    throw refuse(modelName, "changed");
  });
  schema.pre("save", function refuseResave() {
    if (!this.isNew) throw refuse(modelName, "changed");
  });
};

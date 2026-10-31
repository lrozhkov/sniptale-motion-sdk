export function remapImportedEffectIdentity<
  Template extends {
    id: string;
    effectId: string;
    moduleId: string;
    effectV1?: unknown;
  },
  Document extends { id: string },
>(
  template: Template,
  document: Document,
  templateId: string,
  moduleId: string,
) {
  const { id: _oldDocumentId, ...documentFields } = document;
  const {
    id: _oldId,
    effectId: _oldEffectId,
    moduleId: _oldModuleId,
    effectV1: _oldDocument,
    ...templateFields
  } = template;
  const remappedDocument = { ...documentFields, id: templateId };
  return {
    document: remappedDocument,
    template: {
      ...templateFields,
      effectId: templateId,
      effectV1: remappedDocument,
      id: templateId,
      moduleId,
    },
  };
}

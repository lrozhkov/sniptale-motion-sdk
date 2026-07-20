export function remapImportedEffectIdentity(
  template: any,
  document: any,
  templateId: string,
  moduleId: string,
): { document: any; template: any } {
  const remappedDocument = { ...document, id: templateId };
  return {
    document: remappedDocument,
    template: {
      ...template,
      effectId: templateId,
      effectV1: remappedDocument,
      id: templateId,
      moduleId,
    },
  };
}

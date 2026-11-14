import type { PdfTemplate } from "@server/models";

/**
 * Presents a PDF template for the API.
 *
 * @param template the template to present.
 * @param options.includeContent whether to include the template source.
 * @returns the presented template.
 */
export default function presentPdfTemplate(
  template: PdfTemplate,
  options: { includeContent?: boolean } = {}
) {
  return {
    id: template.id,
    name: template.name,
    content: options.includeContent ? template.content : undefined,
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

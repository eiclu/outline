/** A PDF template as returned by the API. */
export interface PdfTemplate {
  id: string;
  name: string;
  /** The Handlebars HTML source, only returned by pdfTemplates.info. */
  content?: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

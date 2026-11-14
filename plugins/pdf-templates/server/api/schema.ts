import { z } from "zod";
import { PdfTemplateValidation } from "@shared/validations";
import { BaseSchema } from "@server/routes/api/schema";

const name = z
  .string()
  .trim()
  .min(1, { error: "Name is required" })
  .max(PdfTemplateValidation.maxNameLength, {
    error: `Name must be ${PdfTemplateValidation.maxNameLength} characters or less`,
  });

const content = z
  .string()
  .min(1, { error: "Template is empty" })
  .max(PdfTemplateValidation.maxContentLength, {
    error: "Template file is too large",
  });

export const PdfTemplatesListSchema = BaseSchema;

export type PdfTemplatesListReq = z.infer<typeof PdfTemplatesListSchema>;

export const PdfTemplatesInfoSchema = BaseSchema.extend({
  body: z.object({
    /** The id of the template */
    id: z.uuid(),
  }),
});

export type PdfTemplatesInfoReq = z.infer<typeof PdfTemplatesInfoSchema>;

export const PdfTemplatesCreateSchema = BaseSchema.extend({
  body: z.object({
    /** The display name of the template */
    name,

    /** The Handlebars HTML source of the template */
    content,
  }),
});

export type PdfTemplatesCreateReq = z.infer<typeof PdfTemplatesCreateSchema>;

export const PdfTemplatesUpdateSchema = BaseSchema.extend({
  body: z.object({
    /** The id of the template */
    id: z.uuid(),

    /** The display name of the template */
    name: name.optional(),

    /** The Handlebars HTML source of the template */
    content: content.optional(),
  }),
});

export type PdfTemplatesUpdateReq = z.infer<typeof PdfTemplatesUpdateSchema>;

export const PdfTemplatesDeleteSchema = BaseSchema.extend({
  body: z.object({
    /** The id of the template */
    id: z.uuid(),
  }),
});

export type PdfTemplatesDeleteReq = z.infer<typeof PdfTemplatesDeleteSchema>;

export const PdfTemplatesExportSchema = BaseSchema.extend({
  body: z.object({
    /** The id of the template */
    id: z.uuid(),

    /** The id or url id of the document to export */
    documentId: z.string().min(1),
  }),
});

export type PdfTemplatesExportReq = z.infer<typeof PdfTemplatesExportSchema>;

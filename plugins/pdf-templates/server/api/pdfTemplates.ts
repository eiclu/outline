import Router from "@koa/router";
import contentDisposition from "content-disposition";
import { UserRole } from "@shared/types";
import documentLoader from "@server/commands/documentLoader";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import { PdfTemplate } from "@server/models";
import { authorize } from "@server/policies";
import type { APIContext } from "@server/types";
import { AuthenticationType } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import slugify from "@server/utils/slugify";
import presentPdfTemplate from "../presenters/pdfTemplate";
import { DocumentContext } from "../utils/DocumentContext";
import { PdfRenderer } from "../utils/PdfRenderer";
import { TemplateEngine } from "../utils/TemplateEngine";
import * as T from "./schema";

const router = new Router();

router.post(
  "pdfTemplates.list",
  auth(),
  validate(T.PdfTemplatesListSchema),
  async (ctx: APIContext<T.PdfTemplatesListReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "listPdfTemplates", user.team);

    const templates = await PdfTemplate.findAll({
      attributes: ["id", "name", "createdById", "createdAt", "updatedAt"],
      where: { teamId: user.teamId },
      order: [["name", "ASC"]],
    });

    ctx.body = {
      data: templates.map((template) => presentPdfTemplate(template)),
    };
  }
);

router.post(
  "pdfTemplates.info",
  auth({ role: UserRole.Admin }),
  validate(T.PdfTemplatesInfoSchema),
  async (ctx: APIContext<T.PdfTemplatesInfoReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;

    const template = await PdfTemplate.findByPk(id, { rejectOnEmpty: true });
    authorize(user, "update", template);

    ctx.body = {
      data: presentPdfTemplate(template, { includeContent: true }),
    };
  }
);

router.post(
  "pdfTemplates.create",
  auth({
    role: UserRole.Admin,
    type: [AuthenticationType.API, AuthenticationType.APP],
  }),
  validate(T.PdfTemplatesCreateSchema),
  transaction(),
  async (ctx: APIContext<T.PdfTemplatesCreateReq>) => {
    const { name, content } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    authorize(user, "createPdfTemplate", user.team);
    TemplateEngine.validate(content);

    const template = await PdfTemplate.create(
      {
        name,
        content,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    ctx.body = {
      data: presentPdfTemplate(template),
    };
  }
);

router.post(
  "pdfTemplates.update",
  auth({
    role: UserRole.Admin,
    type: [AuthenticationType.API, AuthenticationType.APP],
  }),
  validate(T.PdfTemplatesUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.PdfTemplatesUpdateReq>) => {
    const { id, name, content } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const template = await PdfTemplate.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "update", template);

    if (content !== undefined) {
      TemplateEngine.validate(content);
      template.content = content;
    }
    if (name !== undefined) {
      template.name = name;
    }

    await template.save({ transaction });

    ctx.body = {
      data: presentPdfTemplate(template),
    };
  }
);

router.post(
  "pdfTemplates.delete",
  auth({
    role: UserRole.Admin,
    type: [AuthenticationType.API, AuthenticationType.APP],
  }),
  validate(T.PdfTemplatesDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.PdfTemplatesDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const template = await PdfTemplate.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "delete", template);

    await template.destroy({ transaction });

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "pdfTemplates.export",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  auth(),
  validate(T.PdfTemplatesExportSchema),
  async (ctx: APIContext<T.PdfTemplatesExportReq>) => {
    const { id, documentId } = ctx.input.body;
    const { user } = ctx.state.auth;

    const template = await PdfTemplate.findByPk(id, { rejectOnEmpty: true });
    authorize(user, "read", template);

    const document = await documentLoader({
      id: documentId,
      user,
      includeState: true,
    });
    authorize(user, "download", document);

    const team = user.team;
    const data = await DocumentContext.build(document, user, team);
    const rendered = TemplateEngine.render(
      template.content,
      data,
      user.language
    );
    const pdf = await PdfRenderer.render(rendered);

    ctx.set("Content-Type", "application/pdf");
    ctx.set(
      "Content-Disposition",
      contentDisposition(`${slugify(document.displayTitle)}.pdf`, {
        type: "attachment",
      })
    );
    ctx.body = pdf;
  }
);

export default router;

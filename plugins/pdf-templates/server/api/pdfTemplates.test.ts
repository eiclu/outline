import { PdfTemplate } from "@server/models";
import {
  buildAdmin,
  buildDocument,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import { PdfRenderer } from "../utils/PdfRenderer";

const server = getTestServer();

const templateContent = `<html><body>
<template id="pdf-footer"><span class="pageNumber"></span></template>
<h1 class="title">{{title}}</h1>
<p class="by">{{exportedBy.name}}</p>
<main>{{{content}}}</main>
</body></html>`;

async function buildPdfTemplate(overrides: Partial<PdfTemplate> = {}) {
  const teamId = overrides.teamId ?? (await buildTeam()).id;
  return PdfTemplate.create({
    name: "Letterhead",
    content: templateContent,
    teamId,
    ...overrides,
  });
}

describe("#pdfTemplates.create", () => {
  it("should require authentication", async () => {
    const res = await server.post("/api/pdfTemplates.create", {
      body: { name: "Test", content: "<p>{{title}}</p>" },
    });
    expect(res.status).toEqual(401);
  });

  it("should require an admin", async () => {
    const user = await buildUser();
    const res = await server.post("/api/pdfTemplates.create", user, {
      body: { name: "Test", content: "<p>{{title}}</p>" },
    });
    expect(res.status).toEqual(403);
  });

  it("should create a template", async () => {
    const admin = await buildAdmin();
    const res = await server.post("/api/pdfTemplates.create", admin, {
      body: { name: "Letterhead", content: templateContent },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.name).toEqual("Letterhead");
    expect(body.data.content).toBeUndefined();

    const template = await PdfTemplate.findByPk(body.data.id, {
      rejectOnEmpty: true,
    });
    expect(template.teamId).toEqual(admin.teamId);
    expect(template.createdById).toEqual(admin.id);
    expect(template.content).toEqual(templateContent);
  });

  it("should reject an invalid template", async () => {
    const admin = await buildAdmin();
    const res = await server.post("/api/pdfTemplates.create", admin, {
      body: { name: "Broken", content: "{{#if title}}" },
    });
    const body = await res.json();

    expect(res.status).toEqual(400);
    expect(body.message).toMatch(/Template could not be parsed/);
  });
});

describe("#pdfTemplates.list", () => {
  it("should list the templates of the user's team without content", async () => {
    const user = await buildUser();
    await buildPdfTemplate({ teamId: user.teamId, name: "B" });
    await buildPdfTemplate({ teamId: user.teamId, name: "A" });
    await buildPdfTemplate();

    const res = await server.post("/api/pdfTemplates.list", user);
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.map((t: PdfTemplate) => t.name)).toEqual(["A", "B"]);
    expect(body.data[0].content).toBeUndefined();
  });
});

describe("#pdfTemplates.info", () => {
  it("should return the content to admins", async () => {
    const admin = await buildAdmin();
    const template = await buildPdfTemplate({ teamId: admin.teamId });

    const res = await server.post("/api/pdfTemplates.info", admin, {
      body: { id: template.id },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.content).toEqual(templateContent);
  });

  it("should not return templates of another team", async () => {
    const admin = await buildAdmin();
    const template = await buildPdfTemplate();

    const res = await server.post("/api/pdfTemplates.info", admin, {
      body: { id: template.id },
    });

    expect(res.status).toEqual(403);
  });
});

describe("#pdfTemplates.update", () => {
  it("should rename and replace a template", async () => {
    const admin = await buildAdmin();
    const template = await buildPdfTemplate({ teamId: admin.teamId });

    const res = await server.post("/api/pdfTemplates.update", admin, {
      body: { id: template.id, name: "Renamed", content: "<p>{{title}}</p>" },
    });

    expect(res.status).toEqual(200);
    await template.reload();
    expect(template.name).toEqual("Renamed");
    expect(template.content).toEqual("<p>{{title}}</p>");
  });
});

describe("#pdfTemplates.delete", () => {
  it("should not allow members to delete", async () => {
    const user = await buildUser();
    const template = await buildPdfTemplate({ teamId: user.teamId });

    const res = await server.post("/api/pdfTemplates.delete", user, {
      body: { id: template.id },
    });

    expect(res.status).toEqual(403);
  });

  it("should delete a template", async () => {
    const admin = await buildAdmin();
    const template = await buildPdfTemplate({ teamId: admin.teamId });

    const res = await server.post("/api/pdfTemplates.delete", admin, {
      body: { id: template.id },
    });

    expect(res.status).toEqual(200);
    expect(await PdfTemplate.findByPk(template.id)).toBeNull();
  });
});

describe("#pdfTemplates.export", () => {
  const render = vi.spyOn(PdfRenderer, "render");

  beforeEach(() => {
    render.mockReset();
    render.mockResolvedValue(Buffer.from("%PDF-1.7 test"));
  });

  afterAll(() => {
    render.mockRestore();
  });

  it("should render the document into the template", async () => {
    const user = await buildUser({ name: "Ada Lovelace" });
    const template = await buildPdfTemplate({ teamId: user.teamId });
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
      title: "Quarterly report",
      text: "Revenue **grew** this quarter.",
    });

    const res = await server.post("/api/pdfTemplates.export", user, {
      body: { id: template.id, documentId: document.id },
    });

    expect(res.status).toEqual(200);
    expect(res.headers.get("content-type")).toEqual("application/pdf");
    expect(res.headers.get("content-disposition")).toContain(
      "quarterly-report.pdf"
    );
    expect(Buffer.from(await res.arrayBuffer()).toString()).toEqual(
      "%PDF-1.7 test"
    );

    expect(render).toHaveBeenCalledTimes(1);
    const rendered = render.mock.calls[0][0];
    expect(rendered.html).toContain('<h1 class="title">Quarterly report</h1>');
    expect(rendered.html).toContain('<p class="by">Ada Lovelace</p>');
    expect(rendered.html).toContain("<strong>grew</strong>");
    expect(rendered.footer).toEqual('<span class="pageNumber"></span>');
  });

  it("should not export documents the user cannot read", async () => {
    const user = await buildUser();
    const template = await buildPdfTemplate({ teamId: user.teamId });
    const document = await buildDocument();

    const res = await server.post("/api/pdfTemplates.export", user, {
      body: { id: template.id, documentId: document.id },
    });

    expect(res.status).toEqual(403);
    expect(render).not.toHaveBeenCalled();
  });

  it("should not use templates of another team", async () => {
    const user = await buildUser();
    const template = await buildPdfTemplate();
    const document = await buildDocument({
      userId: user.id,
      teamId: user.teamId,
    });

    const res = await server.post("/api/pdfTemplates.export", user, {
      body: { id: template.id, documentId: document.id },
    });

    expect(res.status).toEqual(403);
    expect(render).not.toHaveBeenCalled();
  });
});

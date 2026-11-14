import Handlebars from "handlebars";
import { exampleTemplate } from "../../shared/exampleTemplate";
import { TemplateEngine } from "./TemplateEngine";

describe("TemplateEngine", () => {
  describe("validate", () => {
    it("should accept a valid template", () => {
      expect(() =>
        TemplateEngine.validate("<h1>{{title}}</h1>{{{content}}}")
      ).not.toThrow();
    });

    it("should accept the example template", () => {
      expect(() => TemplateEngine.validate(exampleTemplate)).not.toThrow();
    });

    it("should reject a template with a syntax error", () => {
      expect(() => TemplateEngine.validate("{{#if title}}<h1>")).toThrow(
        /Template could not be parsed/
      );
    });
  });

  describe("render", () => {
    it("should escape values and output safe content as HTML", () => {
      const { html } = TemplateEngine.render(
        "<h1>{{title}}</h1><main>{{{content}}}</main>",
        {
          title: "<script>alert(1)</script>",
          content: new Handlebars.SafeString(
            "<p>Hello <strong>world</strong></p>"
          ),
        }
      );

      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain(
        "<main><p>Hello <strong>world</strong></p></main>"
      );
    });

    it("should extract the header and footer", () => {
      const { html, header, footer } = TemplateEngine.render(
        `<template id="pdf-header"><span>{{title}}</span></template>
        <p>Body</p>
        <div id="pdf-footer">Page <span class="pageNumber"></span></div>`,
        { title: "Report" }
      );

      expect(header).toEqual("<span>Report</span>");
      expect(footer).toEqual('Page <span class="pageNumber"></span>');
      expect(html).toContain("<p>Body</p>");
      expect(html).not.toContain("pdf-header");
      expect(html).not.toContain("pdf-footer");
    });

    it("should not return a header or footer when the template has none", () => {
      const { header, footer } = TemplateEngine.render("<p>{{title}}</p>", {
        title: "Report",
      });

      expect(header).toBeUndefined();
      expect(footer).toBeUndefined();
    });

    it("should format dates", () => {
      const { html } = TemplateEngine.render(
        `<p>{{formatDate date "dd.MM.yyyy"}}</p><p>{{formatDate missing}}</p>`,
        { date: new Date("2026-03-04T10:00:00Z") }
      );

      expect(html).toContain("<p>04.03.2026</p><p></p>");
    });

    it("should format dates with the given language", () => {
      const { html } = TemplateEngine.render(
        `<p>{{formatDate date "d. MMMM yyyy"}}</p>`,
        { date: new Date("2026-03-04T10:00:00Z") },
        "de_DE"
      );

      expect(html).toContain("<p>4. März 2026</p>");
    });

    it("should support the default, eq and case helpers", () => {
      const { html } = TemplateEngine.render(
        `<p>{{default icon "-"}}</p><p>{{#if (eq level 2)}}two{{/if}}</p><p>{{uppercase title}} {{lowercase title}}</p>`,
        { icon: null, level: 2, title: "Hi" }
      );

      expect(html).toContain("<p>-</p><p>two</p><p>HI hi</p>");
    });

    it("should not expose prototype properties", () => {
      const { html } = TemplateEngine.render(
        "<p>{{title.constructor.name}}</p>",
        { title: "Report" }
      );

      expect(html).toContain("<p></p>");
    });
  });
});

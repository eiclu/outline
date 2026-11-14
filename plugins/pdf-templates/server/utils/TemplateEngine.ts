import Handlebars from "handlebars";
import { format as formatDate, isValid } from "date-fns";
import { JSDOM } from "jsdom";
import { dateLocale } from "@shared/utils/date";
import type { locales } from "@shared/utils/date";
import { ValidationError } from "@server/errors";

/** The rendered output of a template, split into the parts Chromium needs. */
export interface RenderedTemplate {
  /** The full HTML page to print. */
  html: string;
  /** HTML repeated at the top of every page, if the template defines one. */
  header?: string;
  /** HTML repeated at the bottom of every page, if the template defines one. */
  footer?: string;
}

/** Element ids that mark the running header and footer in a template. */
const HeaderId = "pdf-header";
const FooterId = "pdf-footer";

/**
 * Renders uploaded Handlebars HTML templates with document data.
 *
 * Handlebars was chosen because it is logic-less: templates can only output
 * data and use the registered helpers, they cannot execute arbitrary code on
 * the server, and values are HTML-escaped unless triple braces are used.
 */
export class TemplateEngine {
  /**
   * Checks that a template can be parsed, so that broken uploads are rejected
   * with a helpful message instead of failing at export time.
   *
   * @param content the Handlebars HTML source of the template.
   * @throws {ValidationError} if the template has a syntax error.
   */
  public static validate(content: string) {
    try {
      Handlebars.parse(content);
    } catch (err) {
      throw ValidationError(
        `Template could not be parsed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Renders a template with the given data. Elements with the ids
   * "pdf-header" and "pdf-footer" are removed from the page and returned
   * separately so that they can be repeated on every printed page.
   *
   * @param content the Handlebars HTML source of the template.
   * @param data the values available to the template.
   * @param language the language used to format dates.
   * @returns the rendered page, header and footer.
   * @throws {ValidationError} if the template fails to render.
   */
  public static render(
    content: string,
    data: object,
    language?: keyof typeof locales | null
  ): RenderedTemplate {
    const instance = this.createInstance(language);

    let output: string;
    try {
      output = instance.compile(content)(data);
    } catch (err) {
      throw ValidationError(
        `Template could not be rendered: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const dom = new JSDOM(output);
    const doc = dom.window.document;
    const header = this.extractElement(doc, HeaderId);
    const footer = this.extractElement(doc, FooterId);

    return {
      html: dom.serialize(),
      header,
      footer,
    };
  }

  /**
   * Creates an isolated Handlebars environment, so helpers registered here do
   * not leak into other users of the library.
   *
   * @param language the language used to format dates.
   * @returns a Handlebars environment with the template helpers registered.
   */
  private static createInstance(language?: keyof typeof locales | null) {
    const instance = Handlebars.create();
    const locale = dateLocale(language);

    /**
     * Formats a date, e.g. {{formatDate updatedAt "dd.MM.yyyy"}}. The pattern
     * uses date-fns tokens and defaults to the localized long date.
     */
    instance.registerHelper(
      "formatDate",
      (value: unknown, pattern: unknown) => {
        const date =
          value instanceof Date
            ? value
            : typeof value === "string" || typeof value === "number"
              ? new Date(value)
              : undefined;

        if (!date || !isValid(date)) {
          return "";
        }

        return formatDate(date, typeof pattern === "string" ? pattern : "PPP", {
          locale,
        });
      }
    );

    /** Outputs a fallback when a value is empty, e.g. {{default icon "📄"}}. */
    instance.registerHelper("default", (value: unknown, fallback: unknown) =>
      value === undefined || value === null || value === "" ? fallback : value
    );

    /** Compares two values, e.g. {{#if (eq level 1)}}…{{/if}}. */
    instance.registerHelper("eq", (a: unknown, b: unknown) => a === b);

    /** Converts text to upper case, e.g. {{uppercase title}}. */
    instance.registerHelper("uppercase", (value: unknown) =>
      typeof value === "string" ? value.toUpperCase() : value
    );

    /** Converts text to lower case, e.g. {{lowercase title}}. */
    instance.registerHelper("lowercase", (value: unknown) =>
      typeof value === "string" ? value.toLowerCase() : value
    );

    return instance;
  }

  /**
   * Removes an element from the document and returns its markup. A
   * `<template>` element contributes its content rather than itself.
   *
   * @param doc the document to search.
   * @param id the id of the element.
   * @returns the inner markup of the element, if it exists.
   */
  private static extractElement(doc: Document, id: string) {
    const element = doc.getElementById(id);
    if (!element) {
      return undefined;
    }

    const markup = element.innerHTML;
    element.remove();
    return markup;
  }
}

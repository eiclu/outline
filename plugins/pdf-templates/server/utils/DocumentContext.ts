import { escapeRegExp } from "es-toolkit/compat";
import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { IconType } from "@shared/types";
import { determineIconType } from "@shared/utils/icon";
import { ProsemirrorHelper as SharedProsemirrorHelper } from "@shared/utils/ProsemirrorHelper";
import Logger from "@server/logging/Logger";
import type { Document, Team, User } from "@server/models";
import { Attachment } from "@server/models";
import AttachmentHelper from "@server/models/helpers/AttachmentHelper";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";

/** A person referenced in the template data. */
interface TemplatePerson {
  name: string;
  email: string | null;
}

/** The values a PDF template can reference. */
export interface DocumentTemplateData {
  /** The document title. */
  title: string;
  /** The document emoji, if it has one. */
  icon: string | null;
  /** The rendered document body, output with {{{content}}}. */
  content: Handlebars.SafeString;
  /** Outline's editor stylesheets, output with {{{styles}}}. */
  styles: Handlebars.SafeString;
  /** The headings of the document, for a table of contents. */
  headings: { title: string; level: number; id: string }[];
  /** The absolute URL of the document. */
  url: string;
  /** The collection the document belongs to. */
  collection: { name: string } | null;
  /** The workspace the document belongs to. */
  team: { name: string; url: string };
  /** The user that created the document. */
  createdBy: TemplatePerson | null;
  /** The user that last edited the document. */
  updatedBy: TemplatePerson | null;
  /** The user exporting the document. */
  exportedBy: TemplatePerson;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  exportedAt: Date;
}

/** The largest total size of images that are embedded in one export. */
const maxEmbeddedImagesSize = 50 * 1024 * 1024;

/**
 * Builds the data that is passed to a PDF template for a document.
 */
export class DocumentContext {
  /**
   * Collects the document content and metadata for rendering a template.
   *
   * @param document the document to export, loaded with its state.
   * @param user the user exporting the document.
   * @param team the workspace of the document.
   * @returns the template data.
   */
  public static async build(
    document: Document,
    user: User,
    team: Team
  ): Promise<DocumentTemplateData> {
    const { content, styles } = await this.renderContent(document);
    const collection = document.collectionId
      ? await document.$get("collection")
      : null;
    const [createdBy, updatedBy] = await Promise.all([
      document.$get("createdBy"),
      document.$get("updatedBy"),
    ]);
    const headings = SharedProsemirrorHelper.getHeadings(
      DocumentHelper.toProsemirror(document)
    ).map(({ title, level, id }) => ({ title, level, id }));

    return {
      title: document.title,
      icon:
        determineIconType(document.icon) === IconType.Emoji
          ? (document.icon ?? null)
          : null,
      content: new Handlebars.SafeString(content),
      styles: new Handlebars.SafeString(styles),
      headings,
      url: `${team.url}${document.path}`,
      collection: collection ? { name: collection.name } : null,
      team: { name: team.name, url: team.url },
      createdBy: this.presentPerson(createdBy),
      updatedBy: this.presentPerson(updatedBy),
      exportedBy: { name: user.name, email: user.email },
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      publishedAt: document.publishedAt,
      exportedAt: new Date(),
    };
  }

  /**
   * Renders the document body to HTML and separates it from the stylesheets
   * of the editor, so templates can choose whether to use Outline's styling.
   * Images are embedded as data URIs as the renderer has no network access.
   *
   * @param document the document to render.
   * @returns the body markup and the style tags.
   */
  private static async renderContent(document: Document) {
    let html = await DocumentHelper.toHTML(document, {
      includeTitle: false,
      includeStyles: true,
      includeMermaid: false,
      centered: false,
    });

    html = await this.embedImages(document, html);

    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const styles = Array.from(doc.querySelectorAll("style"))
      .map((element) => element.outerHTML)
      .join("\n");
    const article = doc.querySelector("body > article") ?? doc.body;

    return { content: article.innerHTML, styles };
  }

  /**
   * Replaces links to image attachments with data URIs.
   *
   * @param document the document the HTML belongs to.
   * @param html the rendered document HTML.
   * @returns the HTML with images embedded.
   */
  private static async embedImages(document: Document, html: string) {
    const attachmentIds = ProsemirrorHelper.parseAttachmentIds(
      DocumentHelper.toProsemirror(document)
    );
    if (!attachmentIds.length) {
      return html;
    }

    const attachments = await Attachment.findAll({
      where: { teamId: document.teamId, id: attachmentIds },
    });

    let output = html;
    let embeddedSize = 0;

    for (const attachment of attachments) {
      if (!attachment.contentType?.startsWith("image/")) {
        continue;
      }
      if (embeddedSize + attachment.size > maxEmbeddedImagesSize) {
        Logger.info("plugins", "Skipping image in templated PDF export", {
          attachmentId: attachment.id,
        });
        continue;
      }

      try {
        const buffer = await AttachmentHelper.readBuffer(attachment);
        embeddedSize += buffer.length;
        output = output.replace(
          new RegExp(escapeRegExp(attachment.redirectUrl), "g"),
          `data:${attachment.contentType};base64,${buffer.toString("base64")}`
        );
      } catch (err) {
        Logger.warn("Failed to embed image in templated PDF export", {
          attachmentId: attachment.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return output;
  }

  private static presentPerson(
    user: User | null | undefined
  ): TemplatePerson | null {
    return user ? { name: user.name, email: user.email } : null;
  }
}

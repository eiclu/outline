import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import { client } from "~/utils/ApiClient";
import type { PdfTemplate } from "../shared/types";

/**
 * Holds the PDF templates of the workspace for the settings screen and the
 * export dialog.
 */
export class PdfTemplatesStore {
  public data = observable.map<string, PdfTemplate>();

  @observable
  public isLoaded = false;

  public constructor() {
    makeObservable(this);
  }

  /** The templates sorted by name. */
  @computed
  public get orderedData(): PdfTemplate[] {
    return Array.from(this.data.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Loads all templates of the workspace.
   *
   * @returns the templates.
   */
  public fetchAll = async (): Promise<PdfTemplate[]> => {
    const res = await client.post<{ data: PdfTemplate[] }>(
      "/pdfTemplates.list"
    );
    runInAction(() => {
      this.data.clear();
      res.data.forEach((template) => this.data.set(template.id, template));
      this.isLoaded = true;
    });
    return res.data;
  };

  /**
   * Loads a single template including its source.
   *
   * @param id the id of the template.
   * @returns the template.
   */
  public fetchContent = async (id: string): Promise<PdfTemplate> => {
    const res = await client.post<{ data: PdfTemplate }>("/pdfTemplates.info", {
      id,
    });
    return res.data;
  };

  /**
   * Uploads a new template.
   *
   * @param name the display name of the template.
   * @param content the Handlebars HTML source.
   * @returns the created template.
   */
  public create = async (name: string, content: string) => {
    const res = await client.post<{ data: PdfTemplate }>(
      "/pdfTemplates.create",
      { name, content }
    );
    this.add(res.data);
    return res.data;
  };

  /**
   * Renames a template or replaces its source.
   *
   * @param id the id of the template.
   * @param changes the new name or source.
   * @returns the updated template.
   */
  public update = async (
    id: string,
    changes: { name?: string; content?: string }
  ) => {
    const res = await client.post<{ data: PdfTemplate }>(
      "/pdfTemplates.update",
      { id, ...changes }
    );
    this.add(res.data);
    return res.data;
  };

  /**
   * Deletes a template.
   *
   * @param id the id of the template.
   */
  public delete = async (id: string) => {
    await client.post("/pdfTemplates.delete", { id });
    runInAction(() => {
      this.data.delete(id);
    });
  };

  /**
   * Renders a document into a template and downloads the PDF.
   *
   * @param id the id of the template.
   * @param documentId the id of the document.
   */
  public export = async (id: string, documentId: string) => {
    await client.post(
      "/pdfTemplates.export",
      { id, documentId },
      { download: true }
    );
  };

  @action
  private add(template: PdfTemplate) {
    this.data.set(template.id, template);
  }
}

export const pdfTemplates = new PdfTemplatesStore();

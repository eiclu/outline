import type { Browser } from "puppeteer-core";
import { InternalError } from "@server/errors";
import Logger from "@server/logging/Logger";
import env from "../env";
import type { RenderedTemplate } from "./TemplateEngine";

/** How long a single page may take to render before it is abandoned. */
const renderTimeout = 60 * 1000;

/** The largest number of PDFs rendered at once by this process. */
const maxConcurrentRenders = 2;

/**
 * Prints rendered templates to PDF with headless Chromium.
 *
 * The page is rendered with JavaScript disabled and every network request is
 * blocked except for inline data URIs, so a template cannot reach internal
 * services from the server or run scripts.
 */
export class PdfRenderer {
  /**
   * Converts a rendered template to a PDF.
   *
   * @param template the rendered page, header and footer.
   * @returns the PDF file contents.
   * @throws {InternalError} if no browser is configured or rendering fails.
   */
  public static async render(template: RenderedTemplate): Promise<Buffer> {
    await this.acquire();

    try {
      const browser = await this.getBrowser();
      const context = await browser.createBrowserContext();

      try {
        const page = await context.newPage();
        page.setDefaultTimeout(renderTimeout);
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const url = request.url();
          if (url.startsWith("data:") || url === "about:blank") {
            void request.continue();
            return;
          }

          void request.abort("blockedbyclient");
        });

        await page.setContent(template.html, { waitUntil: "load" });
        await page.emulateMediaType("print");

        const hasHeaderOrFooter = !!(template.header || template.footer);
        const pdf = await page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
          displayHeaderFooter: hasHeaderOrFooter,
          headerTemplate: template.header ?? "<span></span>",
          footerTemplate: template.footer ?? "<span></span>",
          timeout: renderTimeout,
        });

        return Buffer.from(pdf);
      } finally {
        await context.close().catch(() => undefined);
      }
    } finally {
      this.release();
    }
  }

  private static browser: Promise<Browser> | undefined;

  private static activeRenders = 0;

  private static queue: (() => void)[] = [];

  /**
   * Returns a shared browser, launching or connecting to one when needed.
   *
   * @returns the browser.
   */
  private static getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const browser = this.launch();
      this.browser = browser;

      browser
        .then((instance) =>
          instance.once("disconnected", () => {
            if (this.browser === browser) {
              this.browser = undefined;
            }
          })
        )
        .catch(() => {
          if (this.browser === browser) {
            this.browser = undefined;
          }
        });
    }

    return this.browser;
  }

  private static async launch(): Promise<Browser> {
    const puppeteer = await import("puppeteer-core");

    try {
      if (env.PDF_TEMPLATES_BROWSER_WS_ENDPOINT) {
        return await puppeteer.connect({
          browserWSEndpoint: env.PDF_TEMPLATES_BROWSER_WS_ENDPOINT,
        });
      }

      if (env.PDF_TEMPLATES_CHROMIUM_PATH) {
        return await puppeteer.launch({
          executablePath: env.PDF_TEMPLATES_CHROMIUM_PATH,
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--font-render-hinting=none",
          ],
        });
      }
    } catch (err) {
      Logger.error(
        "Failed to start browser for templated PDF export",
        err instanceof Error ? err : new Error(String(err))
      );
      throw InternalError("The PDF renderer could not be started");
    }

    throw InternalError(
      "PDF templates require PDF_TEMPLATES_CHROMIUM_PATH or PDF_TEMPLATES_BROWSER_WS_ENDPOINT to be configured"
    );
  }

  private static async acquire() {
    if (this.activeRenders < maxConcurrentRenders) {
      this.activeRenders++;
      return;
    }

    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private static release() {
    const next = this.queue.shift();
    if (next) {
      // The slot passes directly to the next waiting render.
      next();
      return;
    }

    this.activeRenders--;
  }
}

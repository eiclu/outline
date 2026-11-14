import { IsOptional, IsUrl } from "class-validator";
import { Environment } from "@server/env";
import { Public } from "@server/utils/decorators/Public";
import environment from "@server/utils/environment";

class PdfTemplatesPluginEnvironment extends Environment {
  /**
   * Path to a local Chromium or Chrome executable that is launched to render
   * templated PDF exports, e.g. "/usr/bin/chromium".
   */
  @IsOptional()
  public PDF_TEMPLATES_CHROMIUM_PATH = this.toOptionalString(
    environment.PDF_TEMPLATES_CHROMIUM_PATH
  );

  /**
   * WebSocket endpoint of a remote Chromium instance, such as a browserless
   * container, used instead of launching a local browser.
   */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ["ws", "wss"] })
  public PDF_TEMPLATES_BROWSER_WS_ENDPOINT = this.toOptionalString(
    environment.PDF_TEMPLATES_BROWSER_WS_ENDPOINT
  );

  /**
   * Whether templated PDF export is available, which requires a browser to be
   * configured. Derived from the other settings and exposed to the client.
   */
  @Public
  public PDF_TEMPLATES_ENABLED = !!(
    this.PDF_TEMPLATES_CHROMIUM_PATH || this.PDF_TEMPLATES_BROWSER_WS_ENDPOINT
  );
}

export default new PdfTemplatesPluginEnvironment();

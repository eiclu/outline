import { Hook, PluginManager } from "@server/utils/PluginManager";
import config from "../plugin.json";
import pdfTemplates from "./api/pdfTemplates";

// The management API is always available so templates can be prepared before
// a browser is configured, exporting fails with a helpful error until then.
PluginManager.add({
  ...config,
  type: Hook.API,
  value: pdfTemplates,
});

import { UserRole } from "@shared/types";
import { createAction } from "~/actions";
import { ActiveDocumentSection } from "~/actions/sections";
import { createLazyComponent } from "~/components/LazyLoad";
import env from "~/env";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import ExportDialog from "./components/ExportDialog";
import Icon from "./Icon";

const downloadDocumentWithPdfTemplate = createAction({
  name: ({ t, isMenu }) =>
    isMenu ? t("PDF with template") : t("Download as PDF with template"),
  analyticsName: "Download document as PDF with template",
  section: ActiveDocumentSection,
  keywords: "pdf template export download branded",
  icon: <Icon />,
  iconInContextMenu: false,
  visible: ({ activeDocumentId, stores }) =>
    !!(
      env.PDF_TEMPLATES_ENABLED &&
      activeDocumentId &&
      stores.policies.abilities(activeDocumentId).download
    ),
  perform: ({ activeDocumentId, stores, t }) => {
    if (!activeDocumentId) {
      return;
    }

    stores.dialogs.openModal({
      title: t("Export as PDF"),
      content: (
        <ExportDialog
          documentId={activeDocumentId}
          onSubmit={stores.dialogs.closeAllModals}
        />
      ),
    });
  },
});

PluginManager.add([
  {
    ...config,
    type: Hook.Settings,
    value: {
      group: "Workspace",
      after: "Export",
      icon: Icon,
      description:
        "Upload HTML templates that documents can be exported into as PDF.",
      component: createLazyComponent(() => import("./Settings")),
      enabled: (_, user) => user.role === UserRole.Admin,
    },
  },
  {
    ...config,
    type: Hook.DocumentExport,
    value: downloadDocumentWithPdfTemplate,
  },
]);

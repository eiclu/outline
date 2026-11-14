import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import { InputSelect } from "~/components/InputSelect";
import type { Option } from "~/components/InputSelect";
import Text from "~/components/Text";
import { pdfTemplates } from "../PdfTemplatesStore";

interface Props {
  /** The id of the document to export. */
  documentId: string;
  /** Called once the export has been downloaded. */
  onSubmit: () => void;
}

/**
 * A dialog to choose a PDF template and download the document rendered into
 * it.
 */
function ExportDialog({ documentId, onSubmit }: Props) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = React.useState<string>();
  const [isExporting, setIsExporting] = React.useState(false);
  const templates = pdfTemplates.orderedData;
  const selectedId = templateId ?? templates[0]?.id;

  React.useEffect(() => {
    pdfTemplates.fetchAll().catch((err) => toast.error(errToString(err)));
  }, []);

  const options = React.useMemo<Option[]>(
    () =>
      templates.map((template) => ({
        type: "item",
        label: template.name,
        value: template.id,
      })),
    [templates]
  );

  const handleSubmit = React.useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (!selectedId) {
        return;
      }

      setIsExporting(true);
      try {
        await pdfTemplates.export(selectedId, documentId);
        onSubmit();
      } catch (err) {
        toast.error(errToString(err));
      } finally {
        setIsExporting(false);
      }
    },
    [selectedId, documentId, onSubmit]
  );

  if (!pdfTemplates.isLoaded) {
    return <Text type="secondary">{t("Loading")}…</Text>;
  }

  if (!templates.length) {
    return (
      <Text as="p" type="secondary">
        {t(
          "No PDF templates have been uploaded yet. An admin can add templates in the workspace settings."
        )}
      </Text>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Flex gap={12} column>
        <Text as="p" type="secondary">
          {t(
            "Choose a template. The document content will be inserted into it and downloaded as a PDF."
          )}
        </Text>
        <InputSelect
          label={t("Template")}
          options={options}
          value={selectedId}
          onChange={setTemplateId}
        />
        <Flex justify="flex-end">
          <Button type="submit" disabled={isExporting || !selectedId}>
            {isExporting ? `${t("Exporting")}…` : t("Download PDF")}
          </Button>
        </Flex>
      </Flex>
    </form>
  );
}

export default observer(ExportDialog);

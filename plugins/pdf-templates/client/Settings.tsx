import { observer } from "mobx-react";
import { DownloadIcon, TrashIcon } from "outline-icons";
import * as React from "react";
import { useTranslation, Trans } from "react-i18next";
import styled from "styled-components";
import { toast } from "sonner";
import { errToString } from "@shared/utils/error";
import { PdfTemplateValidation } from "@shared/validations";
import Button from "~/components/Button";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import ListItem from "~/components/List/Item";
import Notice from "~/components/Notice";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import Time from "~/components/Time";
import NudeButton from "~/components/NudeButton";
import Tooltip from "~/components/Tooltip";
import useStores from "~/hooks/useStores";
import env from "~/env";
import { download } from "~/utils/download";
import { exampleTemplate } from "../shared/exampleTemplate";
import type { PdfTemplate } from "../shared/types";
import Icon from "./Icon";
import { pdfTemplates } from "./PdfTemplatesStore";

const acceptedFileTypes = ".html,.htm,.hbs,.handlebars,text/html";

/**
 * Reads an uploaded template file, rejecting files that are too large.
 *
 * @param file the uploaded file.
 * @returns the name derived from the file name and the file contents.
 * @throws {Error} if the file is too large.
 */
async function readTemplateFile(file: File) {
  if (file.size > PdfTemplateValidation.maxContentLength) {
    throw new Error("The template file is too large");
  }

  return {
    name: file.name.replace(/\.(html?|hbs|handlebars)$/i, ""),
    content: await file.text(),
  };
}

/**
 * Settings screen to upload and manage the PDF templates of the workspace.
 */
function PdfTemplatesSettings() {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    pdfTemplates.fetchAll().catch((err) => toast.error(errToString(err)));
  }, []);

  const handleUploadClick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) {
        return;
      }

      setIsUploading(true);
      try {
        const { name, content } = await readTemplateFile(file);
        await pdfTemplates.create(name, content);
        toast.success(t("Template uploaded"));
      } catch (err) {
        toast.error(errToString(err));
      } finally {
        setIsUploading(false);
      }
    },
    [t]
  );

  const handleDownloadExample = React.useCallback(() => {
    download(exampleTemplate, "example-template.html", "text/html");
  }, []);

  return (
    <Scene title={t("PDF Templates")} icon={<Icon />}>
      <Heading>{t("PDF Templates")}</Heading>
      <Text as="p" type="secondary">
        <Trans>
          Upload HTML templates to export documents as branded PDFs. Members can
          choose a template from the export menu of a document. Its content is
          inserted wherever the template contains <code>{"{{{content}}}"}</code>
          .
        </Trans>
      </Text>
      <Text as="p" type="secondary">
        <Trans>
          Templates use Handlebars syntax and are styled with CSS, including{" "}
          <code>@page</code> rules for page size and margins. Download the
          example to see every available value.
        </Trans>
      </Text>

      {!env.PDF_TEMPLATES_ENABLED && (
        <Notice>
          <Trans>
            No PDF renderer is configured. Set PDF_TEMPLATES_CHROMIUM_PATH or
            PDF_TEMPLATES_BROWSER_WS_ENDPOINT on the server to enable exports.
          </Trans>
        </Notice>
      )}

      <Actions gap={8}>
        <Button onClick={handleUploadClick} disabled={isUploading}>
          {isUploading ? `${t("Uploading")}…` : `${t("Upload template")}…`}
        </Button>
        <Button onClick={handleDownloadExample} neutral>
          {t("Download example")}
        </Button>
        <HiddenInput
          ref={inputRef}
          type="file"
          accept={acceptedFileTypes}
          onChange={handleFileChange}
        />
      </Actions>

      <h2>{t("Templates")}</h2>
      {pdfTemplates.isLoaded && !pdfTemplates.orderedData.length && (
        <Text as="p" type="secondary">
          {t("No templates have been uploaded yet.")}
        </Text>
      )}
      {pdfTemplates.orderedData.map((template) => (
        <TemplateListItem key={template.id} template={template} />
      ))}
    </Scene>
  );
}

interface TemplateListItemProps {
  /** The template to display. */
  template: PdfTemplate;
}

const TemplateListItem = observer(function TemplateListItem_({
  template,
}: TemplateListItemProps) {
  const { t } = useTranslation();
  const { dialogs } = useStores();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleReplaceClick = React.useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) {
        return;
      }

      try {
        const { content } = await readTemplateFile(file);
        await pdfTemplates.update(template.id, { content });
        toast.success(t("Template replaced"));
      } catch (err) {
        toast.error(errToString(err));
      }
    },
    [t, template.id]
  );

  const handleDownload = React.useCallback(async () => {
    try {
      const { content } = await pdfTemplates.fetchContent(template.id);
      download(content ?? "", `${template.name}.html`, "text/html");
    } catch (err) {
      toast.error(errToString(err));
    }
  }, [template.id, template.name]);

  const handleDelete = React.useCallback(() => {
    dialogs.openModal({
      title: t("Delete template"),
      content: (
        <ConfirmationDialog
          onSubmit={() => pdfTemplates.delete(template.id)}
          submitText={t("Delete")}
          savingText={`${t("Deleting")}…`}
          danger
        >
          {t(
            "Are you sure you want to delete the template “{{ name }}”? Documents can no longer be exported with it.",
            { name: template.name }
          )}
        </ConfirmationDialog>
      ),
    });
  }, [dialogs, t, template.id, template.name]);

  return (
    <ListItem
      title={template.name}
      image={<Icon />}
      subtitle={
        <Trans>
          Updated <Time dateTime={template.updatedAt} addSuffix />
        </Trans>
      }
      actions={
        <Flex gap={4} align="center">
          <Button onClick={handleReplaceClick} neutral>
            {t("Replace")}…
          </Button>
          <Tooltip content={t("Download template")}>
            <NudeButton
              onClick={handleDownload}
              aria-label={t("Download template")}
            >
              <DownloadIcon />
            </NudeButton>
          </Tooltip>
          <Tooltip content={t("Delete template")}>
            <NudeButton
              onClick={handleDelete}
              aria-label={t("Delete template")}
            >
              <TrashIcon />
            </NudeButton>
          </Tooltip>
          <HiddenInput
            ref={inputRef}
            type="file"
            accept={acceptedFileTypes}
            onChange={handleFileChange}
          />
        </Flex>
      }
    />
  );
});

const Actions = styled(Flex)`
  margin: 16px 0 8px;
`;

const HiddenInput = styled.input`
  display: none;
`;

export default observer(PdfTemplatesSettings);

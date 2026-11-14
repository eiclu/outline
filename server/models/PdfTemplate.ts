import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  NotEmpty,
  Table,
} from "sequelize-typescript";
import { PdfTemplateValidation } from "@shared/validations";
import Team from "./Team";
import User from "./User";
import ParanoidModel from "./base/ParanoidModel";
import Length from "./validators/Length";

/**
 * An HTML template uploaded by a workspace admin that documents can be
 * rendered into when exporting them as PDF.
 */
@Table({ tableName: "pdf_templates", modelName: "pdf_template" })
class PdfTemplate extends ParanoidModel<
  InferAttributes<PdfTemplate>,
  Partial<InferCreationAttributes<PdfTemplate>>
> {
  /** The display name of the template. */
  @NotEmpty
  @Length({
    max: PdfTemplateValidation.maxNameLength,
    msg: `Template name must be ${PdfTemplateValidation.maxNameLength} characters or less`,
  })
  @Column(DataType.STRING)
  name: string;

  /** The Handlebars HTML source of the template. */
  @NotEmpty
  @Length({
    max: PdfTemplateValidation.maxContentLength,
    msg: "Template file is too large",
  })
  @Column(DataType.TEXT)
  content: string;

  // associations

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  createdById: string;

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;
}

export default PdfTemplate;

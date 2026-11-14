import { PdfTemplate, Team, User } from "@server/models";
import { allow } from "./cancan";
import { isTeamAdmin, isTeamModel } from "./utils";

allow(User, "createPdfTemplate", Team, isTeamAdmin);

allow(User, "listPdfTemplates", Team, isTeamModel);

allow(User, "read", PdfTemplate, isTeamModel);

allow(User, ["update", "delete"], PdfTemplate, isTeamAdmin);

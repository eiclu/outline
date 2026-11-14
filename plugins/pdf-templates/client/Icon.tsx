import { PDFIcon } from "outline-icons";

interface Props {
  /** The size of the icon, 24px is default to match standard icons. */
  size?: number;
  /** The color of the icon, defaults to the current text color. */
  fill?: string;
}

/**
 * The icon of the PDF templates plugin.
 *
 * @param props the icon props.
 * @returns the icon element.
 */
export default function Icon({ size = 24, fill = "currentColor" }: Props) {
  return <PDFIcon size={size} color={fill} />;
}

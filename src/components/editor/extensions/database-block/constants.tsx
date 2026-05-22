"use client";

import {
  Type,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  Link2,
  Table2,
  Kanban,
  LayoutGrid,
  ImageIcon,
  FunctionSquare,
  Globe,
  Mail,
  Paperclip,
  Clock,
} from "lucide-react";
import type { ColumnType, ViewMode } from "./types";

export const COLUMN_TYPE_ICONS: Record<ColumnType, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  date: <Calendar className="h-3.5 w-3.5" />,
  select: <ChevronDown className="h-3.5 w-3.5" />,
  checkbox: <CheckSquare className="h-3.5 w-3.5" />,
  relation: <Link2 className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  formula: <FunctionSquare className="h-3.5 w-3.5" />,
  url: <Globe className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  attachment: <Paperclip className="h-3.5 w-3.5" />,
  time: <Clock className="h-3.5 w-3.5" />,
};

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Texte",
  number: "Nombre",
  date: "Date",
  select: "Choix",
  checkbox: "Case à cocher",
  relation: "Relation",
  image: "Image",
  formula: "Formule",
  url: "URL",
  email: "E-mail",
  attachment: "Pièces jointes",
  time: "Heure",
};

export const VIEW_ICONS: Record<ViewMode, React.ReactNode> = {
  table: <Table2 className="h-3.5 w-3.5" />,
  kanban: <Kanban className="h-3.5 w-3.5" />,
  gallery: <LayoutGrid className="h-3.5 w-3.5" />,
};

export const VIEW_LABELS: Record<ViewMode, string> = {
  table: "Tableau",
  kanban: "Kanban",
  gallery: "Galerie",
};

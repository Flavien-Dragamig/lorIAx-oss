"use client";

import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code,
  Quote,
  Table,
  Image as ImageIcon,
  Minus,
  AlertCircle,
  ChevronRight,
  Link as LinkIcon,
  FileText,
  Link2,
  BarChart3,
  Smile,
  Database,
  MapPin,
  Calendar,
  CalendarDays,
  Clock,
  Video,
  Mic,
  PenLine,
  LayoutTemplate,
  Table2,
  Network,
} from "lucide-react";

import type { CommandItem } from "./types";
import { openTemplatePicker } from "./template-picker";

export const defaultAliases: Record<string, string[]> = {
  "Cases à cocher": ["todo", "task", "tache", "taches", "checklist", "cases", "coche"],
  "Titre 1": ["t1", "h1", "heading1"],
  "Titre 2": ["t2", "h2", "heading2"],
  "Titre 3": ["t3", "h3", "heading3"],
  "Liste a puces": ["ul", "bullet"],
  "Liste numerotee": ["ol", "numbered"],
  "Citation": ["quote", "blockquote", "guillemets"],
  "Separateur": ["hr", "divider", "ligne"],
  "Attention": ["callout", "info", "note", "astuce", "alerte", "warning"],
  "Lien": ["url", "href"],
  "Lien document": ["document", "wiki", "wikilink", "lien-doc", "[["],
  "Vidéo": ["video", "youtube", "vimeo", "dailymotion", "embed"],
  "Graphique": ["chart", "graphe", "diagramme", "barres", "camembert"],
  "Base de données": ["database", "db", "bdd", "donnees", "tableau-donnees"],
  "Tableur": ["sheet", "excel", "calc", "tableau", "formule", "spreadsheet"],
  "Tableau blanc": ["whiteboard", "dessin", "sketch", "draw", "miro", "tldraw"],
  "Mind map": ["mindmap", "carte", "mentale", "brainstorm", "arbre"],
  "Carte": ["map", "plan", "itineraire", "osm", "geo", "lieu"],
  "Calendrier": ["calendar", "agenda", "planning", "evenement"],
  "Événement": ["event", "rdv"],
  "Réunion": ["reunion", "visio", "livekit", "call", "appel"],
  "Réunion présentielle": ["meeting-room", "présentiel", "presentiel", "micro", "dictaphone"],
  "Date": ["today", "aujourd'hui", "maintenant", "jour"],
  "Date et heure": ["datetime", "heure", "timestamp", "now"],
  "Modèle": ["template", "modele", "gabarit", "patron"],
  "Émoji": ["emoji", "smiley", "emoticone", "icone"],
};

export const commands: CommandItem[] = [
  {
    title: "Titre 1",
    description: "Titre principal",
    aliases: ["t1", "h1", "heading1"],
    icon: <Heading1 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Titre 2",
    description: "Sous-titre",
    aliases: ["t2", "h2", "heading2"],
    icon: <Heading2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Titre 3",
    description: "Sous-section",
    aliases: ["t3", "h3", "heading3"],
    icon: <Heading3 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "Liste a puces",
    description: "Liste non ordonnee",
    aliases: ["ul", "bullet"],
    icon: <List className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Liste numerotee",
    description: "Liste ordonnee",
    aliases: ["ol", "numbered"],
    icon: <ListOrdered className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Cases à cocher",
    description: "Liste de cases à cocher",
    aliases: ["todo", "task", "tache", "taches", "checklist", "cases", "coche"],
    icon: <ListChecks className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Code",
    description: "Bloc de code",
    icon: <Code className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Citation",
    description: "Bloc de citation avec auteur",
    aliases: ["quote", "blockquote", "guillemets"],
    icon: <Quote className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Tableau",
    description: "Inserer un tableau",
    icon: <Table className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Image",
    description: "Insérer une image depuis une URL",
    icon: <ImageIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt("URL de l'image");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    title: "Separateur",
    description: "Ligne horizontale",
    aliases: ["hr", "divider", "ligne"],
    icon: <Minus className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Attention",
    description: "Bloc coloré avec émoji (info, attention, succès, erreur)",
    aliases: ["callout", "info", "note", "astuce", "alerte", "warning"],
    icon: <AlertCircle className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "calloutBlock",
          attrs: { calloutType: "info", emoji: "\u2139\ufe0f" },
          content: [{ type: "paragraph" }],
        })
        .run();
    },
  },
  {
    title: "Toggle",
    description: "Contenu depliable",
    icon: <ChevronRight className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "details",
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "Cliquer pour deplier" }] },
            { type: "detailsContent", content: [{ type: "paragraph" }] },
          ],
        })
        .run();
    },
  },
  {
    title: "Lien",
    description: "Inserer un lien externe",
    aliases: ["url", "href"],
    icon: <LinkIcon className="h-4 w-4" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const url = window.prompt("URL du lien");
      if (url) {
        editor.chain().focus().setLink({ href: url }).insertContent(url).run();
      }
    },
  },
  {
    title: "Lien document",
    description: "Lien vers un autre document",
    aliases: ["document", "wiki", "wikilink", "lien-doc", "[["],
    icon: <Link2 className="h-4 w-4" />,
    command: ({ editor, range }) => {
      // Delete the slash command range then insert [[ to trigger wiki-link suggestion
      editor.chain().focus().deleteRange(range).insertContent("[[").run();
    },
  },
  {
    title: "Google Docs",
    description: "Intégrer un document Google Docs",
    icon: <FileText className="h-4 w-4 text-blue-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "googleDocsEmbed", attrs: { url: "", height: 600 } })
        .run();
    },
  },
  {
    title: "Vidéo",
    description: "Intégrer une vidéo YouTube ou Vimeo",
    aliases: ["video", "youtube", "vimeo", "dailymotion", "embed"],
    icon: <Video className="h-4 w-4 text-red-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "videoEmbed", attrs: { src: "", provider: "", videoid: "" } })
        .run();
    },
  },
  {
    title: "Graphique",
    description: "Insérer un graphique (barres, courbe, camembert)",
    aliases: ["chart", "graphe", "diagramme", "barres", "camembert"],
    icon: <BarChart3 className="h-4 w-4 text-indigo-500" />,
    desktopOnly: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "chartBlock" })
        .run();
    },
  },
  {
    title: "Base de données",
    description: "Insérer une base de données relationnelle",
    aliases: ["database", "db", "bdd", "donnees", "tableau-donnees"],
    icon: <Database className="h-4 w-4 text-emerald-500" />,
    desktopOnly: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "databaseBlock" })
        .run();
    },
  },
  {
    title: "Tableur",
    description: "Feuille de calcul avec formules",
    aliases: ["sheet", "excel", "calc", "tableau", "formule", "spreadsheet"],
    icon: <Table2 className="h-4 w-4 text-emerald-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "spreadsheetBlock",
          attrs: {
            title: "Nouveau tableur",
          },
        })
        .run();
    },
  },
  {
    title: "Tableau blanc",
    description: "Canvas collaboratif Miro-like (tldraw)",
    aliases: ["whiteboard", "dessin", "sketch", "draw", "miro", "tldraw"],
    icon: <PenLine className="h-4 w-4 text-blue-500" />,
    desktopOnly: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: "whiteboardBlock",
        attrs: { canvasId: crypto.randomUUID(), title: "Nouveau tableau blanc" },
      }).run();
    },
  },
  {
    title: "Mind map",
    description: "Carte mentale interactive",
    aliases: ["mindmap", "carte", "mentale", "brainstorm", "arbre"],
    icon: <Network className="h-4 w-4 text-amber-500" />,
    desktopOnly: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: "mindmapBlock",
        attrs: { mindmapId: crypto.randomUUID(), title: "Nouvelle carte mentale" },
      }).run();
    },
  },
  {
    title: "Carte",
    description: "Insérer une carte OpenStreetMap interactive",
    aliases: ["map", "plan", "itineraire", "osm", "geo", "lieu"],
    icon: <MapPin className="h-4 w-4 text-blue-500" />,
    desktopOnly: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "mapBlock" })
        .run();
    },
  },
  {
    title: "Calendrier",
    description: "Insérer un mini-calendrier dans le document",
    aliases: ["calendar", "agenda", "planning", "rdv", "evenement"],
    icon: <CalendarDays className="h-4 w-4 text-orange-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "calendarBlock" })
        .run();
    },
  },
  {
    title: "Événement",
    description: "Insérer un lien vers un événement calendrier",
    aliases: ["event", "rdv", "reunion", "meeting"],
    icon: <Clock className="h-4 w-4 text-orange-500" />,
    command: ({ editor, range }) => {
      // Insert a placeholder event inline node
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "eventInline",
          attrs: {
            title: "Nouvel événement",
            startAt: new Date().toISOString(),
          },
        })
        .run();
    },
  },
  {
    title: "Réunion",
    description: "Démarrer une visioconférence",
    aliases: ["reunion", "meeting", "visio", "livekit", "call", "appel", "video"],
    icon: <Video className="h-4 w-4 text-indigo-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "meetingBlock",
          attrs: {
            meetingId: "",
            title: "Nouvelle réunion",
            status: "scheduled",
          },
        })
        .run();
    },
  },
  {
    title: "Réunion présentielle",
    description: "Retranscrire une réunion présentielle",
    aliases: ["reunion", "meeting-room", "présentiel", "presentiel", "micro", "dictaphone"],
    icon: <Mic className="h-4 w-4 text-violet-500" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "inPersonMeetingBlock",
          attrs: {
            meetingId: "",
            title: "Nouvelle réunion",
            status: "scheduled",
            participants: [],
          },
        })
        .run();
    },
  },
  {
    title: "Date",
    description: "Insérer la date du jour",
    aliases: ["today", "aujourd'hui", "maintenant", "jour"],
    icon: <Calendar className="h-4 w-4 text-teal-500" />,
    command: ({ editor, range }) => {
      const now = new Date();
      const date = now.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      editor.chain().focus().deleteRange(range).insertContent(date).run();
    },
  },
  {
    title: "Date et heure",
    description: "Insérer la date et l'heure actuelles",
    aliases: ["datetime", "heure", "timestamp", "now"],
    icon: <Calendar className="h-4 w-4 text-teal-500" />,
    command: ({ editor, range }) => {
      const now = new Date();
      const dateTime = now.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      editor.chain().focus().deleteRange(range).insertContent(dateTime).run();
    },
  },
  {
    title: "Modèle",
    description: "Insérer un modèle de document",
    aliases: ["template", "modele", "gabarit", "patron"],
    icon: <LayoutTemplate className="h-4 w-4 text-purple-500" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      openTemplatePicker(editor);
    },
  },
  {
    title: "Émoji",
    description: "Insérer un émoji",
    aliases: ["emoji", "smiley", "emoticone", "icone"],
    icon: <Smile className="h-4 w-4 text-amber-500" />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();

      // Créer un conteneur temporaire pour le picker
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.zIndex = "9999";

      // Position near cursor
      const { view } = editor;
      const coords = view.coordsAtPos(view.state.selection.from);
      container.style.left = `${coords.left}px`;
      container.style.top = `${coords.bottom + 4}px`;
      document.body.appendChild(container);

      // Import et render le picker dynamiquement
      Promise.all([
        import("emoji-picker-react"),
        import("react-dom/client"),
        import("react"),
      ]).then(([emojiMod, { createRoot }, React]) => {
        const EmojiPicker = emojiMod.default;
        const { Theme, EmojiStyle } = emojiMod;
        const isDark = document.documentElement.classList.contains("dark");

        const root = createRoot(container);

        function cleanup() {
          root.unmount();
          container.remove();
          document.removeEventListener("mousedown", handleOutsideClick);
        }

        function handleOutsideClick(e: MouseEvent) {
          if (!container.contains(e.target as Node)) {
            cleanup();
          }
        }

        // Délai pour ne pas capturer le clic initial
        setTimeout(() => {
          document.addEventListener("mousedown", handleOutsideClick);
        }, 100);

        root.render(
          React.createElement(EmojiPicker, {
            onEmojiClick: (emojiData: { emoji: string }) => {
              editor.chain().focus().insertContent(emojiData.emoji).run();
              cleanup();
            },
            theme: isDark ? Theme.DARK : Theme.LIGHT,
            emojiStyle: EmojiStyle.NATIVE,
            width: 320,
            height: 400,
            searchPlaceHolder: "Rechercher un emoji...",
            previewConfig: { showPreview: false },
            lazyLoadEmojis: true,
          })
        );
      });
    },
  },
];

export type Point = { x: number; y: number; p?: number; t?: number };

export type ToolId =
  | "select"
  | "lasso"
  | "pan"
  | "pen"
  | "fountain"
  | "neon"
  | "crayon"
  | "highlighter"
  | "rainbow"
  | "dashed"
  | "brush"
  | "marker"
  | "pencil"
  | "glitter"
  | "dotted"
  | "parallel"
  | "laser"
  | "shape"
  | "eraser-pixel"
  | "eraser-object"
  | "text"
  | "tape"
  | "frame";

export type StrokeBase = {
  id: string;
  color: string;
  size: number;
  points: Point[];
};

export type PenStroke = StrokeBase & { kind: "pen" };
export type FountainStroke = StrokeBase & { kind: "fountain" };
export type NeonStroke = StrokeBase & { kind: "neon" };
export type CrayonStroke = StrokeBase & { kind: "crayon" };
export type HighlighterStroke = StrokeBase & { kind: "highlighter" };
export type RainbowStroke = StrokeBase & { kind: "rainbow" };
export type DashedStroke = StrokeBase & { kind: "dashed" };
export type BrushStroke = StrokeBase & { kind: "brush" };
export type MarkerStroke = StrokeBase & { kind: "marker" };
export type PencilStroke = StrokeBase & { kind: "pencil" };
export type GlitterStroke = StrokeBase & { kind: "glitter" };
export type DottedStroke = StrokeBase & { kind: "dotted" };
export type ParallelStroke = StrokeBase & { kind: "parallel" };

export type ShapeType =
  // 2D Shapes
  | "rect"
  | "circle"
  | "triangle"
  | "right-triangle"
  | "diamond"
  | "star"
  | "hexagon"
  | "pentagon"
  | "octagon"
  | "heptagon"
  | "decagon"
  | "heart"
  | "cloud"
  | "speech-bubble"
  | "thought-bubble"
  | "parallelogram"
  | "trapezoid"
  | "cross"
  | "crescent"
  | "ring"
  | "ellipse"
  | "shield"
  | "banner"
  | "lightning"
  | "gear"
  | "bracket"
  | "line"
  | "arrow"
  | "double-arrow"
  | "curved-arrow"
  // 3D Solids & Diagrams
  | "cube"
  | "cuboid"
  | "cylinder"
  | "sphere"
  | "hemisphere"
  | "cone"
  | "frustum"
  | "pyramid"
  | "truncated-pyramid"
  | "tetrahedron"
  | "octahedron"
  | "dodecahedron"
  | "prism"
  | "hex-prism"
  | "pipe"
  | "wedge"
  | "gem"
  | "torus"
  | "capsule"
  | "helix"
  | "axes3d";

export type ShapeStroke = {
  id: string;
  kind: "shape";
  shape: ShapeType;
  color: string;
  size: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  vertices?: Point[];
};

export type TextObject = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  fontSize: number;
  bg?: string;
};

export type ImageObject = {
  id: string;
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
};

export type StickyNoteObject = {
  id: string;
  kind: "sticky";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
};

export type FlashcardObject = {
  id: string;
  kind: "flashcard";
  x: number;
  y: number;
  w: number;
  h: number;
  front: string;
  back: string;
  flipped?: boolean;
  color?: string;
};

export type QuizObject = {
  id: string;
  kind: "quiz";
  x: number;
  y: number;
  w: number;
  h: number;
  question: string;
  options: string[];
  answerIndex: number;
  revealed?: boolean;
  color?: string;
};

export type RoadmapObject = {
  id: string;
  kind: "roadmap";
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  step?: number;
  status: "todo" | "doing" | "done";
  color?: string;
};

export type FormulaObject = {
  id: string;
  kind: "formula";
  x: number;
  y: number;
  w: number;
  h: number;
  latex: string;
  label?: string;
  color?: string;
};

export type DiagramNodeObject = {
  id: string;
  kind: "diagram-node";
  x: number;
  y: number;
  w: number;
  h: number;
  nodeType: "start" | "process" | "decision" | "end";
  label: string;
  color?: string;
  connectedTo?: string[];
};

export type MindMapNodeObject = {
  id: string;
  kind: "mindmap-node";
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  level: number;
  color: string;
  parentId?: string;
};

export type TapeObject = {
  id: string;
  kind: "tape";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  revealed?: boolean;
  pattern?: "diagonal" | "dots" | "solid";
  label?: string;
};

export type GraphObject = {
  id: string;
  kind: "graph";
  x: number;
  y: number;
  w: number;
  h: number;
  fn: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  color: string;
  title?: string;
};

export type FrameObject = {
  id: string;
  kind: "frame";
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  order: number;
  color?: string;
};

export type TableObject = {
  id: string;
  kind: "table";
  x: number;
  y: number;
  w: number;
  h: number;
  rows: number;
  cols: number;
  data: string[][];
  headers?: string[];
  color?: string;
  title?: string;
};

export type PeriodicTableObject = {
  id: string;
  kind: "periodic-table";
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  selectedNumber?: number;
};

export type CanvasObject =
  | PenStroke
  | FountainStroke
  | NeonStroke
  | CrayonStroke
  | HighlighterStroke
  | RainbowStroke
  | DashedStroke
  | BrushStroke
  | MarkerStroke
  | PencilStroke
  | GlitterStroke
  | DottedStroke
  | ParallelStroke
  | ShapeStroke
  | TextObject
  | ImageObject
  | StickyNoteObject
  | FlashcardObject
  | QuizObject
  | RoadmapObject
  | FormulaObject
  | DiagramNodeObject
  | MindMapNodeObject
  | TapeObject
  | GraphObject
  | FrameObject
  | TableObject
  | PeriodicTableObject;

export type PageBackground =
  | "white"
  | "grid"
  | "dots"
  | "lined"
  | "dark"
  | "blackboard"
  | "oled"
  | "isometric";

export type Page = {
  id: string;
  objects: CanvasObject[];
  background: PageBackground;
};

export type WhiteboardState = {
  pages: Page[];
  activePageId: string;
  tool: ToolId;
  color: string;
  size: number;
  history: Page[][]; // snapshots of pages
  historyIndex: number;
  selectedId: string | null;
  selectedIds: string[];
  autoSnapEnabled: boolean;
  camera: { x: number; y: number; zoom: number };
};

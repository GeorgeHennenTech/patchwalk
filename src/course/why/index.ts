// "Why this matters": one line per lesson saying what its skill lets you do in a track, shown before the lesson
// starts (docs/LEARNING_RESEARCH.md: interest and seeing the point hold attention; prizes do not).
import a from "./why-a.json";
import b from "./why-b.json";
import c from "./why-c.json";
import d from "./why-d.json";
import e from "./why-e.json";
import f from "./why-f.json";
import g from "./why-g.json";
export const WHY: Record<string, string> = { ...a, ...b, ...c, ...d, ...e, ...f, ...g };

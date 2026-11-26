// Built-in drum kits: sound files that ship with the site (bought for it by the owner; see docs/THIRD_PARTY.md),
// one folder a kit under src/assets/kits/, each with a kit.json that says which file plays which drum.
// A sound file is only fetched when its kit is loaded.
import type { Voice } from "./drums";

export interface KitSlot { file: string; /** the sound's own file name where it was bought */ splice?: string; pack?: string; uuid?: string; seconds?: number }
export interface DrumKit { id: string; name: string; slots: Partial<Record<Voice, KitSlot>> }

const manifests = import.meta.glob<DrumKit>("../assets/kits/*/kit.json", { eager: true, import: "default" });
const files = import.meta.glob<string>("../assets/kits/*/*.wav", { query: "?url", import: "default" });

/** Every built-in kit, by name. */
export const KITS: DrumKit[] = Object.values(manifests).filter((k) => k && typeof k.id === "string" && k.slots).sort((a, b) => a.name.localeCompare(b.name));
/** The address of one of a kit's sound files, or nothing when the file is not there. */
export const kitFile = async (kit: DrumKit, slot: KitSlot): Promise<string | undefined> => files[`../assets/kits/${kit.id}/${slot.file}`]?.();
/** The slots of a kit in the order a rack keeps its pads. */
export const kitSlots = (kit: DrumKit): [Voice, KitSlot][] => (Object.entries(kit.slots) as [Voice, KitSlot][]).filter(([, s]) => s && typeof s.file === "string");

export type ElementCategory =
  | "nonmetal"
  | "noble"
  | "alkali"
  | "alkaline"
  | "metalloid"
  | "halogen"
  | "transition"
  | "post-transition"
  | "lanthanide"
  | "actinide";

export type ElementData = {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  category: ElementCategory;
  period: number;
  group: number;
  phase: "Gas" | "Solid" | "Liquid" | "Unknown";
  config?: string;
  electronegativity?: number;
  density?: number;
  melt?: number; // °C
  boil?: number; // °C
  discoveredBy?: string;
  summary?: string;
};

export const CATEGORY_COLORS: Record<
  ElementCategory,
  { bg: string; text: string; border: string; solidBg: string; name: string }
> = {
  alkali: {
    bg: "bg-red-500/15 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-800",
    solidBg: "#ef4444",
    name: "Alkali Metals",
  },
  alkaline: {
    bg: "bg-amber-500/15 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
    solidBg: "#f59e0b",
    name: "Alkaline Earth",
  },
  transition: {
    bg: "bg-blue-500/15 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-800",
    solidBg: "#3b82f6",
    name: "Transition Metals",
  },
  "post-transition": {
    bg: "bg-indigo-500/15 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-300 dark:border-indigo-800",
    solidBg: "#6366f1",
    name: "Post-Transition",
  },
  metalloid: {
    bg: "bg-teal-500/15 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-300 dark:border-teal-800",
    solidBg: "#14b8a6",
    name: "Metalloids",
  },
  nonmetal: {
    bg: "bg-emerald-500/15 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-800",
    solidBg: "#10b981",
    name: "Reactive Nonmetals",
  },
  halogen: {
    bg: "bg-cyan-500/15 dark:bg-cyan-950/40",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-300 dark:border-cyan-800",
    solidBg: "#06b6d4",
    name: "Halogens",
  },
  noble: {
    bg: "bg-purple-500/15 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-800",
    solidBg: "#a855f7",
    name: "Noble Gases",
  },
  lanthanide: {
    bg: "bg-rose-500/15 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-800",
    solidBg: "#f43f5e",
    name: "Lanthanides",
  },
  actinide: {
    bg: "bg-fuchsia-500/15 dark:bg-fuchsia-950/40",
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    border: "border-fuchsia-300 dark:border-fuchsia-800",
    solidBg: "#d946ef",
    name: "Actinides",
  },
};

// All 118 Elements with complete scientific properties
export const ALL_118_ELEMENTS: ElementData[] = [
  // Period 1
  { number: 1, symbol: "H", name: "Hydrogen", mass: 1.008, category: "nonmetal", period: 1, group: 1, phase: "Gas", config: "1s¹", electronegativity: 2.2, melt: -259.16, boil: -252.87, discoveredBy: "Henry Cavendish (1766)", summary: "Most abundant chemical substance in the universe; fuel of the stars and core building block of water." },
  { number: 2, symbol: "He", name: "Helium", mass: 4.0026, category: "noble", period: 1, group: 18, phase: "Gas", config: "1s²", electronegativity: undefined, melt: -272.2, boil: -268.93, discoveredBy: "Pierre Janssen & Norman Lockyer (1868)", summary: "Lightest noble gas; remains liquid down to absolute zero under standard pressure. Used in cryogenics and balloons." },

  // Period 2
  { number: 3, symbol: "Li", name: "Lithium", mass: 6.94, category: "alkali", period: 2, group: 1, phase: "Solid", config: "[He] 2s¹", electronegativity: 0.98, melt: 180.5, boil: 1342, discoveredBy: "Johan August Arfwedson (1817)", summary: "Least dense solid metal; powers modern rechargeable batteries and electronics." },
  { number: 4, symbol: "Be", name: "Beryllium", mass: 9.0122, category: "alkaline", period: 2, group: 2, phase: "Solid", config: "[He] 2s²", electronegativity: 1.57, melt: 1287, boil: 2469, discoveredBy: "Louis-Nicolas Vauquelin (1798)", summary: "Lightweight, stiff metal used in aerospace structures and X-ray tube windows." },
  { number: 5, symbol: "B", name: "Boron", mass: 10.81, category: "metalloid", period: 2, group: 13, phase: "Solid", config: "[He] 2s² 2p¹", electronegativity: 2.04, melt: 2076, boil: 3927, discoveredBy: "Joseph Louis Gay-Lussac & Louis Jacques Thénard (1808)", summary: "Semiconductor metalloid used in heat-resistant borosilicate glass and fiberglass." },
  { number: 6, symbol: "C", name: "Carbon", mass: 12.011, category: "nonmetal", period: 2, group: 14, phase: "Solid", config: "[He] 2s² 2p²", electronegativity: 2.55, melt: 3550, boil: 4027, discoveredBy: "Known since antiquity", summary: "Basis of all known organic chemistry and terrestrial life; forms diamond and graphene." },
  { number: 7, symbol: "N", name: "Nitrogen", mass: 14.007, category: "nonmetal", period: 2, group: 15, phase: "Gas", config: "[He] 2s² 2p³", electronegativity: 3.04, melt: -210.0, boil: -195.79, discoveredBy: "Daniel Rutherford (1772)", summary: "Makes up ~78% of Earth's atmosphere; vital component of amino acids and nucleic acids." },
  { number: 8, symbol: "O", name: "Oxygen", mass: 15.999, category: "nonmetal", period: 2, group: 16, phase: "Gas", config: "[He] 2s² 2p⁴", electronegativity: 3.44, melt: -218.79, boil: -182.96, discoveredBy: "Carl Wilhelm Scheele & Joseph Priestley (1774)", summary: "Most abundant element in Earth's crust; sustains aerobic respiration and combustion." },
  { number: 9, symbol: "F", name: "Fluorine", mass: 18.998, category: "halogen", period: 2, group: 17, phase: "Gas", config: "[He] 2s² 2p⁵", electronegativity: 3.98, melt: -219.67, boil: -188.11, discoveredBy: "Henri Moissan (1886)", summary: "Most electronegative and reactive chemical element; forms stable fluoropolymers like Teflon." },
  { number: 10, symbol: "Ne", name: "Neon", mass: 20.18, category: "noble", period: 2, group: 18, phase: "Gas", config: "[He] 2s² 2p⁶", electronegativity: undefined, melt: -248.59, boil: -246.05, discoveredBy: "William Ramsay & Morris Travers (1898)", summary: "Colorless noble gas that glows reddish-orange in high-voltage electrical discharge signs." },

  // Period 3
  { number: 11, symbol: "Na", name: "Sodium", mass: 22.99, category: "alkali", period: 3, group: 1, phase: "Solid", config: "[Ne] 3s¹", electronegativity: 0.93, melt: 97.79, boil: 882.85, discoveredBy: "Humphry Davy (1807)", summary: "Soft, highly reactive alkali metal; fundamental electrolyte regulating cellular fluid balance." },
  { number: 12, symbol: "Mg", name: "Magnesium", mass: 24.305, category: "alkaline", period: 3, group: 2, phase: "Solid", config: "[Ne] 3s²", electronegativity: 1.31, melt: 650, boil: 1090, discoveredBy: "Joseph Black (1755)", summary: "Structural lightweight metal and central ion in chlorophyll for plant photosynthesis." },
  { number: 13, symbol: "Al", name: "Aluminium", mass: 26.982, category: "post-transition", period: 3, group: 13, phase: "Solid", config: "[Ne] 3s² 3p¹", electronegativity: 1.61, melt: 660.32, boil: 2470, discoveredBy: "Hans Christian Ørsted (1825)", summary: "Lightweight, non-magnetic, corrosion-resistant metal used heavily in transport and construction." },
  { number: 14, symbol: "Si", name: "Silicon", mass: 28.085, category: "metalloid", period: 3, group: 14, phase: "Solid", config: "[Ne] 3s² 3p²", electronegativity: 1.9, melt: 1414, boil: 3265, discoveredBy: "Jöns Jacob Berzelius (1824)", summary: "Heart of modern semiconductors, microprocessors, solar cells, and computer chips." },
  { number: 15, symbol: "P", name: "Phosphorus", mass: 30.974, category: "nonmetal", period: 3, group: 15, phase: "Solid", config: "[Ne] 3s² 3p³", electronegativity: 2.19, melt: 44.15, boil: 280.5, discoveredBy: "Hennig Brand (1669)", summary: "Essential for cellular energy transfer (ATP), DNA backbone, and agricultural fertilizers." },
  { number: 16, symbol: "S", name: "Sulfur", mass: 32.06, category: "nonmetal", period: 3, group: 16, phase: "Solid", config: "[Ne] 3s² 3p⁴", electronegativity: 2.58, melt: 115.21, boil: 444.6, discoveredBy: "Known since antiquity", summary: "Bright yellow crystalline nonmetal; crucial for sulfuric acid production and vulcanized rubber." },
  { number: 17, symbol: "Cl", name: "Chlorine", mass: 35.45, category: "halogen", period: 3, group: 17, phase: "Gas", config: "[Ne] 3s² 3p⁵", electronegativity: 3.16, melt: -101.5, boil: -34.04, discoveredBy: "Carl Wilhelm Scheele (1774)", summary: "Yellow-green gas widely used for water purification, disinfectants, and PVC plastics." },
  { number: 18, symbol: "Ar", name: "Argon", mass: 39.95, category: "noble", period: 3, group: 18, phase: "Gas", config: "[Ne] 3s² 3p⁶", electronegativity: undefined, melt: -189.34, boil: -185.85, discoveredBy: "Lord Rayleigh & William Ramsay (1894)", summary: "Most abundant noble gas on Earth; provides an inert shielding atmosphere for welding." },

  // Period 4
  { number: 19, symbol: "K", name: "Potassium", mass: 39.098, category: "alkali", period: 4, group: 1, phase: "Solid", config: "[Ar] 4s¹", electronegativity: 0.82, melt: 63.5, boil: 759, discoveredBy: "Humphry Davy (1807)", summary: "Silvery alkali metal essential for cellular nerve transmission and agricultural fertilizers." },
  { number: 20, symbol: "Ca", name: "Calcium", mass: 40.078, category: "alkaline", period: 4, group: 2, phase: "Solid", config: "[Ar] 4s²", electronegativity: 1.0, melt: 842, boil: 1484, discoveredBy: "Humphry Davy (1808)", summary: "Fifth most abundant element in Earth's crust; key structural component of bones and teeth." },
  { number: 21, symbol: "Sc", name: "Scandium", mass: 44.956, category: "transition", period: 4, group: 3, phase: "Solid", config: "[Ar] 3d¹ 4s²", electronegativity: 1.36, melt: 1541, boil: 2836, discoveredBy: "Lars Fredrik Nilson (1879)", summary: "Transition metal used in high-strength aluminum alloys for aerospace frames and sports gear." },
  { number: 22, symbol: "Ti", name: "Titanium", mass: 47.867, category: "transition", period: 4, group: 4, phase: "Solid", config: "[Ar] 3d² 4s²", electronegativity: 1.54, melt: 1668, boil: 3287, discoveredBy: "William Gregor (1791)", summary: "Strong as steel but 45% lighter; highly resistant to corrosion in seawater and human tissue." },
  { number: 23, symbol: "V", name: "Vanadium", mass: 50.942, category: "transition", period: 4, group: 5, phase: "Solid", config: "[Ar] 3d³ 4s²", electronegativity: 1.63, melt: 1910, boil: 3407, discoveredBy: "Andrés Manuel del Río (1801)", summary: "Hard transition metal used to produce ultra-tough shock-resistant steel alloys and redox batteries." },
  { number: 24, symbol: "Cr", name: "Chromium", mass: 51.996, category: "transition", period: 4, group: 6, phase: "Solid", config: "[Ar] 3d⁵ 4s¹", electronegativity: 1.66, melt: 1907, boil: 2671, discoveredBy: "Louis-Nicolas Vauquelin (1797)", summary: "Steely-grey, lustrous metal that gives stainless steel its high corrosion resistance." },
  { number: 25, symbol: "Mn", name: "Manganese", mass: 54.938, category: "transition", period: 4, group: 7, phase: "Solid", config: "[Ar] 3d⁵ 4s²", electronegativity: 1.55, melt: 1246, boil: 2061, discoveredBy: "Johan Gottlieb Gahn (1774)", summary: "Essential alloying element that improves strength and workability in modern steel manufacturing." },
  { number: 26, symbol: "Fe", name: "Iron", mass: 55.845, category: "transition", period: 4, group: 8, phase: "Solid", config: "[Ar] 3d⁶ 4s²", electronegativity: 1.83, melt: 1538, boil: 2862, discoveredBy: "Known since antiquity", summary: "Most common element on Earth by mass; foundation of global civilization via steel production." },
  { number: 27, symbol: "Co", name: "Cobalt", mass: 58.933, category: "transition", period: 4, group: 9, phase: "Solid", config: "[Ar] 3d⁷ 4s²", electronegativity: 1.88, melt: 1495, boil: 2927, discoveredBy: "Georg Brandt (1735)", summary: "Magnetic metal indispensable for EV lithium-ion battery cathodes and jet engine superalloys." },
  { number: 28, symbol: "Ni", name: "Nickel", mass: 58.693, category: "transition", period: 4, group: 10, phase: "Solid", config: "[Ar] 3d⁸ 4s²", electronegativity: 1.91, melt: 1455, boil: 2730, discoveredBy: "Axel Fredrik Cronstedt (1751)", summary: "Corrosion-resistant metal used in coinage, stainless steels, and energy storage batteries." },
  { number: 29, symbol: "Cu", name: "Copper", mass: 63.546, category: "transition", period: 4, group: 11, phase: "Solid", config: "[Ar] 3d¹⁰ 4s¹", electronegativity: 1.9, melt: 1084.62, boil: 2562, discoveredBy: "Known since antiquity", summary: "Superb thermal and electrical conductor forming the backbone of the global electrical grid." },
  { number: 30, symbol: "Zn", name: "Zinc", mass: 65.38, category: "transition", period: 4, group: 12, phase: "Solid", config: "[Ar] 3d¹⁰ 4s²", electronegativity: 1.65, melt: 419.53, boil: 907, discoveredBy: "Indian metallurgists before 1000 BCE", summary: "Used to galvanize steel against corrosion, in brass alloys, and vital biological enzymes." },
  { number: 31, symbol: "Ga", name: "Gallium", mass: 69.723, category: "post-transition", period: 4, group: 13, phase: "Solid", config: "[Ar] 3d¹⁰ 4s² 4p¹", electronegativity: 1.81, melt: 29.76, boil: 2400, discoveredBy: "Lecoq de Boisbaudran (1875)", summary: "Melts in human hands at 29.8°C; essential for high-speed GaAs semiconductors and LEDs." },
  { number: 32, symbol: "Ge", name: "Germanium", mass: 72.63, category: "metalloid", period: 4, group: 14, phase: "Solid", config: "[Ar] 3d¹⁰ 4s² 4p²", electronegativity: 2.01, melt: 938.25, boil: 2833, discoveredBy: "Clemens Winkler (1886)", summary: "Semiconductor metalloid vital for fiber-optic communications, night vision optics, and solar cells." },
  { number: 33, symbol: "As", name: "Arsenic", mass: 74.922, category: "metalloid", period: 4, group: 15, phase: "Solid", config: "[Ar] 3d¹⁰ 4s² 4p³", electronegativity: 2.18, melt: 817, boil: 614, discoveredBy: "Albertus Magnus (1250)", summary: "Infamous toxic metalloid used in GaAs semiconductors and specialized metal hardening." },
  { number: 34, symbol: "Se", name: "Selenium", mass: 78.971, category: "nonmetal", period: 4, group: 16, phase: "Solid", config: "[Ar] 3d¹⁰ 4s² 4p⁴", electronegativity: 2.55, melt: 221, boil: 685, discoveredBy: "Jöns Jacob Berzelius (1817)", summary: "Photoconductive element used in photocopiers, anti-dandruff shampoo, and dietary trace nutrients." },
  { number: 35, symbol: "Br", name: "Bromine", mass: 79.904, category: "halogen", period: 4, group: 17, phase: "Liquid", config: "[Ar] 3d¹⁰ 4s² 4p⁵", electronegativity: 2.96, melt: -7.2, boil: 58.8, discoveredBy: "Antoine Jérôme Balard (1826)", summary: "Heavy, reddish-brown fuming liquid at room temperature; used in fire retardants and pharmaceuticals." },
  { number: 36, symbol: "Kr", name: "Krypton", mass: 83.798, category: "noble", period: 4, group: 18, phase: "Gas", config: "[Ar] 3d¹⁰ 4s² 4p⁶", electronegativity: 3.0, melt: -157.37, boil: -153.22, discoveredBy: "William Ramsay & Morris Travers (1898)", summary: "Noble gas used in high-efficiency airport runway flash lamps and insulated double-pane windows." },

  // Period 5
  { number: 37, symbol: "Rb", name: "Rubidium", mass: 85.468, category: "alkali", period: 5, group: 1, phase: "Solid", config: "[Kr] 5s¹", electronegativity: 0.82, melt: 39.3, boil: 688, discoveredBy: "Robert Bunsen & Gustav Kirchhoff (1861)", summary: "Highly reactive alkali metal that spontaneously ignites in air; used in atomic clocks and laser cooling." },
  { number: 38, symbol: "Sr", name: "Strontium", mass: 87.62, category: "alkaline", period: 5, group: 2, phase: "Solid", config: "[Kr] 5s²", electronegativity: 0.95, melt: 777, boil: 1382, discoveredBy: "Adair Crawford (1790)", summary: "Soft alkaline earth metal that produces brilliant crimson flame colors in fireworks and flares." },
  { number: 39, symbol: "Y", name: "Yttrium", mass: 88.906, category: "transition", period: 5, group: 3, phase: "Solid", config: "[Kr] 4d¹ 5s²", electronegativity: 1.22, melt: 1526, boil: 3345, discoveredBy: "Johan Gadolin (1794)", summary: "Used in red phosphors for displays, high-temperature superconductors (YBCO), and camera lenses." },
  { number: 40, symbol: "Zr", name: "Zirconium", mass: 91.224, category: "transition", period: 5, group: 4, phase: "Solid", config: "[Kr] 4d² 5s²", electronegativity: 1.33, melt: 1855, boil: 4409, discoveredBy: "Martin Heinrich Klaproth (1789)", summary: "Extremely resistant to corrosion and heat; cladding material for nuclear reactor fuel rods." },
  { number: 41, symbol: "Nb", name: "Niobium", mass: 92.906, category: "transition", period: 5, group: 5, phase: "Solid", config: "[Kr] 4d⁴ 5s¹", electronegativity: 1.6, melt: 2477, boil: 4744, discoveredBy: "Charles Hatchett (1801)", summary: "Used in superconducting magnets for MRI scanners and high-strength rocket nozzle alloys." },
  { number: 42, symbol: "Mo", name: "Molybdenum", mass: 95.95, category: "transition", period: 5, group: 6, phase: "Solid", config: "[Kr] 4d⁵ 5s¹", electronegativity: 2.16, melt: 2623, boil: 4639, discoveredBy: "Carl Wilhelm Scheele (1778)", summary: "High melting point metal used in heavy machinery steel alloys and petroleum catalysts." },
  { number: 43, symbol: "Tc", name: "Technetium", mass: 98, category: "transition", period: 5, group: 7, phase: "Solid", config: "[Kr] 4d⁵ 5s²", electronegativity: 1.9, melt: 2157, boil: 4265, discoveredBy: "Emilio Segrè & Carlo Perrier (1937)", summary: "First artificially created element; Tc-99m is the most widely used medical radioisotope in nuclear scans." },
  { number: 44, symbol: "Ru", name: "Ruthenium", mass: 101.07, category: "transition", period: 5, group: 8, phase: "Solid", config: "[Kr] 4d⁷ 5s¹", electronegativity: 2.2, melt: 2334, boil: 4150, discoveredBy: "Karl Ernst Claus (1844)", summary: "Rare platinum-group metal used for wear-resistant electrical contacts and advanced chemical catalysts." },
  { number: 45, symbol: "Rh", name: "Rhodium", mass: 102.91, category: "transition", period: 5, group: 9, phase: "Solid", config: "[Kr] 4d⁸ 5s¹", electronegativity: 2.28, melt: 1964, boil: 3695, discoveredBy: "William Hyde Wollaston (1804)", summary: "Precious catalyst metal critical for automotive three-way catalytic converters." },
  { number: 46, symbol: "Pd", name: "Palladium", mass: 106.42, category: "transition", period: 5, group: 10, phase: "Solid", config: "[Kr] 4d¹⁰", electronegativity: 2.2, melt: 1554.9, boil: 2963, discoveredBy: "William Hyde Wollaston (1802)", summary: "Capable of absorbing up to 900 times its own volume of hydrogen gas; used in auto catalysts." },
  { number: 47, symbol: "Ag", name: "Silver", mass: 107.87, category: "transition", period: 5, group: 11, phase: "Solid", config: "[Kr] 4d¹⁰ 5s¹", electronegativity: 1.93, melt: 961.78, boil: 2162, discoveredBy: "Known since antiquity", summary: "Highest electrical and thermal conductivity and highest optical reflectivity of all metals." },
  { number: 48, symbol: "Cd", name: "Cadmium", mass: 112.41, category: "transition", period: 5, group: 12, phase: "Solid", config: "[Kr] 4d¹⁰ 5s²", electronegativity: 1.69, melt: 321.07, boil: 767, discoveredBy: "Karl Samuel Leberecht Hermann (1817)", summary: "Soft, toxic metal historically used in Ni-Cd rechargeable batteries and solar panel thin films." },
  { number: 49, symbol: "In", name: "Indium", mass: 114.82, category: "post-transition", period: 5, group: 13, phase: "Solid", config: "[Kr] 4d¹⁰ 5s² 5p¹", electronegativity: 1.78, melt: 156.6, boil: 2072, discoveredBy: "Ferdinand Reich & Hieronymous Theodor Richter (1863)", summary: "Transparent conductive coating (ITO) essential for smartphone touchscreens and flat-panel displays." },
  { number: 50, symbol: "Sn", name: "Tin", mass: 118.71, category: "post-transition", period: 5, group: 14, phase: "Solid", config: "[Kr] 4d¹⁰ 5s² 5p²", electronegativity: 1.96, melt: 231.93, boil: 2602, discoveredBy: "Known since antiquity", summary: "Alloy component of bronze since the Bronze Age; primary metal in electronic solder circuits." },
  { number: 51, symbol: "Sb", name: "Antimony", mass: 121.76, category: "metalloid", period: 5, group: 15, phase: "Solid", config: "[Kr] 4d¹⁰ 5s² 5p³", electronegativity: 2.05, melt: 630.63, boil: 1587, discoveredBy: "Known since antiquity", summary: "Lustrous gray metalloid used in flame retardants, lead-acid battery plates, and infrared detectors." },
  { number: 52, symbol: "Te", name: "Tellurium", mass: 127.6, category: "metalloid", period: 5, group: 16, phase: "Solid", config: "[Kr] 4d¹⁰ 5s² 5p⁴", electronegativity: 2.1, melt: 449.51, boil: 988, discoveredBy: "Franz-Joseph Müller von Reichenstein (1782)", summary: "Brittle metalloid alloyed with cadmium (CdTe) for high-efficiency solar photovoltaic panels." },
  { number: 53, symbol: "I", name: "Iodine", mass: 126.9, category: "halogen", period: 5, group: 17, phase: "Solid", config: "[Kr] 4d¹⁰ 5s² 5p⁵", electronegativity: 2.66, melt: 113.7, boil: 184.3, discoveredBy: "Bernard Courtois (1811)", summary: "Lustrous violet-black solid that sublimes into purple vapor; essential nutrient for human thyroid function." },
  { number: 54, symbol: "Xe", name: "Xenon", mass: 131.29, category: "noble", period: 5, group: 18, phase: "Gas", config: "[Kr] 4d¹⁰ 5s² 5p⁶", electronegativity: 2.6, melt: -111.7, boil: -108.12, discoveredBy: "William Ramsay & Morris Travers (1898)", summary: "Dense noble gas used in camera flashes, medical anesthesia, and satellite ion thrusters." },

  // Period 6
  { number: 55, symbol: "Cs", name: "Caesium", mass: 132.91, category: "alkali", period: 6, group: 1, phase: "Solid", config: "[Xe] 6s¹", electronegativity: 0.79, melt: 28.5, boil: 671, discoveredBy: "Robert Bunsen & Gustav Kirchhoff (1860)", summary: "Most reactive metal; hyperfine vibrations of Cs-133 define the standard international second." },
  { number: 56, symbol: "Ba", name: "Barium", mass: 137.33, category: "alkaline", period: 6, group: 2, phase: "Solid", config: "[Xe] 6s²", electronegativity: 0.89, melt: 727, boil: 1897, discoveredBy: "Carl Wilhelm Scheele (1772)", summary: "High-density metal used in drilling fluids and as a contrast radiopaque agent in gastrointestinal X-rays." },

  // Lanthanides (57 - 71)
  { number: 57, symbol: "La", name: "Lanthanum", mass: 138.91, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 5d¹ 6s²", electronegativity: 1.1, melt: 920, boil: 3464, discoveredBy: "Carl Gustaf Mosander (1839)", summary: "Gives name to lanthanides; used in high-refractive-index camera lenses and hybrid battery anodes." },
  { number: 58, symbol: "Ce", name: "Cerium", mass: 140.12, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹ 5d¹ 6s²", electronegativity: 1.12, melt: 798, boil: 3443, discoveredBy: "Martin Heinrich Klaproth (1803)", summary: "Most abundant rare earth element; used in catalytic converters and glass polishing abrasives." },
  { number: 59, symbol: "Pr", name: "Praseodymium", mass: 140.91, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f³ 6s²", electronegativity: 1.13, melt: 931, boil: 3520, discoveredBy: "Carl Auer von Welsbach (1885)", summary: "Imparts intense yellow-green color to glass; alloyed for superstrong permanent neodymium magnets." },
  { number: 60, symbol: "Nd", name: "Neodymium", mass: 144.24, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁴ 6s²", electronegativity: 1.14, melt: 1021, boil: 3074, discoveredBy: "Carl Auer von Welsbach (1885)", summary: "Makes the world's most powerful permanent magnets (NdFeB), essential for wind turbines and EVs." },
  { number: 61, symbol: "Pm", name: "Promethium", mass: 145, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁵ 6s²", electronegativity: 1.13, melt: 1042, boil: 3000, discoveredBy: "Chien Shiung Wu & Jacob A. Marinsky (1945)", summary: "Radioactive rare-earth metal used in nuclear-powered micro-batteries for pacemakers and space probes." },
  { number: 62, symbol: "Sm", name: "Samarium", mass: 150.36, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁶ 6s²", electronegativity: 1.17, melt: 1072, boil: 1794, discoveredBy: "Lecoq de Boisbaudran (1879)", summary: "Used in heat-tolerant SmCo permanent magnets, nuclear reactor control rods, and cancer treatment." },
  { number: 63, symbol: "Eu", name: "Europium", mass: 151.96, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁷ 6s²", electronegativity: 1.2, melt: 822, boil: 1529, discoveredBy: "Eugène-Anatole Demarçay (1896)", summary: "Emits brilliant red fluorescence under UV light; used as anti-counterfeiting phosphor on Euro banknotes." },
  { number: 64, symbol: "Gd", name: "Gadolinium", mass: 157.25, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁷ 5d¹ 6s²", electronegativity: 1.2, melt: 1313, boil: 3273, discoveredBy: "Jean Charles Galissard de Marignac (1880)", summary: "Unique paramagnetic properties make it the standard contrast agent in hospital MRI diagnostic scans." },
  { number: 65, symbol: "Tb", name: "Terbium", mass: 158.93, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f⁹ 6s²", electronegativity: 1.2, melt: 1356, boil: 3230, discoveredBy: "Carl Gustaf Mosander (1843)", summary: "Produces brilliant green phosphors in TV screens and magnetostrictive sonar alloys (Terfenol-D)." },
  { number: 66, symbol: "Dy", name: "Dysprosium", mass: 162.5, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹⁰ 6s²", electronegativity: 1.22, melt: 1412, boil: 2567, discoveredBy: "Paul Émile Lecoq de Boisbaudran (1886)", summary: "Added to neodymium magnets to maintain magnetic strength at extreme operating temperatures in EV motors." },
  { number: 67, symbol: "Ho", name: "Holmium", mass: 164.93, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹¹ 6s²", electronegativity: 1.23, melt: 1474, boil: 2700, discoveredBy: "Per Teodor Cleve (1879)", summary: "Has highest magnetic moment of any natural element; used to concentrate high-power laser surgical tools." },
  { number: 68, symbol: "Er", name: "Erbium", mass: 167.26, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹² 6s²", electronegativity: 1.24, melt: 1529, boil: 2868, discoveredBy: "Carl Gustaf Mosander (1843)", summary: "Optical fiber laser amplifier (EDFA) doping element powering transoceanic internet signals." },
  { number: 69, symbol: "Tm", name: "Thulium", mass: 168.93, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹³ 6s²", electronegativity: 1.25, melt: 1545, boil: 1950, discoveredBy: "Per Teodor Cleve (1879)", summary: "Least abundant naturally occurring lanthanide; used as radiation source in portable medical X-ray units." },
  { number: 70, symbol: "Yb", name: "Ytterbium", mass: 173.05, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹⁴ 6s²", electronegativity: 1.1, melt: 824, boil: 1196, discoveredBy: "Jean Charles Galissard de Marignac (1878)", summary: "Used in atomic clocks with sub-second precision over billions of years, and fiber lasers for cutting steel." },
  { number: 71, symbol: "Lu", name: "Lutetium", mass: 174.97, category: "lanthanide", period: 6, group: 3, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹ 6s²", electronegativity: 1.27, melt: 1663, boil: 3402, discoveredBy: "Georges Urbain (1907)", summary: "Hardest, densest lanthanide; Lu-177 is a cutting-edge targeted radio-ligand therapy for cancer cells." },

  // Period 6 (Post-Lanthanides 72-86)
  { number: 72, symbol: "Hf", name: "Hafnium", mass: 178.49, category: "transition", period: 6, group: 4, phase: "Solid", config: "[Xe] 4f¹⁴ 5d² 6s²", electronegativity: 1.3, melt: 2233, boil: 4603, discoveredBy: "Dirk Coster & George de Hevesy (1923)", summary: "Nuclear control rod material and high-k dielectric in sub-14nm computer processor transistors." },
  { number: 73, symbol: "Ta", name: "Tantalum", mass: 180.95, category: "transition", period: 6, group: 5, phase: "Solid", config: "[Xe] 4f¹⁴ 5d³ 6s²", electronegativity: 1.5, melt: 3017, boil: 5458, discoveredBy: "Anders Gustaf Ekeberg (1802)", summary: "High capacitance metal vital for miniature tantalum capacitors found in all smartphones and laptops." },
  { number: 74, symbol: "W", name: "Tungsten", mass: 183.84, category: "transition", period: 6, group: 6, phase: "Solid", config: "[Xe] 4f¹⁴ 5d⁴ 6s²", electronegativity: 2.36, melt: 3422, boil: 5555, discoveredBy: "Carl Wilhelm Scheele (1781)", summary: "Highest melting point of all metals (3422°C); historically used in incandescent light bulb filaments." },
  { number: 75, symbol: "Re", name: "Rhenium", mass: 186.21, category: "transition", period: 6, group: 7, phase: "Solid", config: "[Xe] 4f¹⁴ 5d⁵ 6s²", electronegativity: 1.9, melt: 3186, boil: 5596, discoveredBy: "Masataka Ogawa & Walter Noddack (1925)", summary: "Extremely dense, heat-resistant metal used in nickel-based turbine blades of modern jet fighter engines." },
  { number: 76, symbol: "Os", name: "Osmium", mass: 190.23, category: "transition", period: 6, group: 8, phase: "Solid", config: "[Xe] 4f¹⁴ 5d⁶ 6s²", electronegativity: 2.2, melt: 3033, boil: 5012, discoveredBy: "Smithson Tennant (1803)", summary: "Densest naturally occurring element on Earth (22.59 g/cm³); twice as dense as lead." },
  { number: 77, symbol: "Ir", name: "Iridium", mass: 192.22, category: "transition", period: 6, group: 9, phase: "Solid", config: "[Xe] 4f¹⁴ 5d⁷ 6s²", electronegativity: 2.2, melt: 2446, boil: 4428, discoveredBy: "Smithson Tennant (1803)", summary: "Most corrosion-resistant metal known; enriched worldwide in the K-Pg boundary layer from the dinosaur asteroid." },
  { number: 78, symbol: "Pt", name: "Platinum", mass: 195.08, category: "transition", period: 6, group: 10, phase: "Solid", config: "[Xe] 4f¹⁴ 5d⁹ 6s¹", electronegativity: 2.28, melt: 1768.3, boil: 3825, discoveredBy: "Antonio de Ulloa (1735)", summary: "Precious, unreactive metal critical for automotive catalytic converters, fine jewelry, and chemotherapy drugs." },
  { number: 79, symbol: "Au", name: "Gold", mass: 196.97, category: "transition", period: 6, group: 11, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s¹", electronegativity: 2.54, melt: 1064.18, boil: 2856, discoveredBy: "Known since antiquity", summary: "Noble, non-tarnishing precious metal celebrated through human history; conductor in microchips." },
  { number: 80, symbol: "Hg", name: "Mercury", mass: 200.59, category: "transition", period: 6, group: 12, phase: "Liquid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s²", electronegativity: 2.0, melt: -38.83, boil: 356.73, discoveredBy: "Known since antiquity", summary: "Only elemental metal liquid at standard room temperature; used in barometers and amalgams." },
  { number: 81, symbol: "Tl", name: "Thallium", mass: 204.38, category: "post-transition", period: 6, group: 13, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹", electronegativity: 1.62, melt: 304, boil: 1473, discoveredBy: "William Crookes (1861)", summary: "Soft, malleable, highly toxic heavy metal historically utilized in rodenticides and infrared sensors." },
  { number: 82, symbol: "Pb", name: "Lead", mass: 207.2, category: "post-transition", period: 6, group: 14, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²", electronegativity: 1.87, melt: 327.46, boil: 1749, discoveredBy: "Known since antiquity", summary: "Dense, malleable heavy metal widely used for radiation shielding and car lead-acid starting batteries." },
  { number: 83, symbol: "Bi", name: "Bismuth", mass: 208.98, category: "post-transition", period: 6, group: 15, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³", electronegativity: 2.02, melt: 271.4, boil: 1564, discoveredBy: "Known since antiquity", summary: "Heaviest stable-like element (half-life 1.9x10¹⁹ yrs); forms rainbow iridescent crystal hopper spirals." },
  { number: 84, symbol: "Po", name: "Polonium", mass: 209, category: "post-transition", period: 6, group: 16, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴", electronegativity: 2.0, melt: 254, boil: 962, discoveredBy: "Marie & Pierre Curie (1898)", summary: "Intensely radioactive alpha emitter named in honor of Marie Curie's native Poland." },
  { number: 85, symbol: "At", name: "Astatine", mass: 210, category: "halogen", period: 6, group: 17, phase: "Solid", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵", electronegativity: 2.2, melt: 302, boil: 337, discoveredBy: "Dale R. Corson et al. (1940)", summary: "Rarest naturally occurring element in Earth's crust (less than 1 gram exists globally at any moment)." },
  { number: 86, symbol: "Rn", name: "Radon", mass: 222, category: "noble", period: 6, group: 18, phase: "Gas", config: "[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶", electronegativity: undefined, melt: -71, boil: -61.7, discoveredBy: "Friedrich Ernst Dorn (1900)", summary: "Radioactive noble gas from uranium decay in soil; second leading cause of lung cancer globally." },

  // Period 7
  { number: 87, symbol: "Fr", name: "Francium", mass: 223, category: "alkali", period: 7, group: 1, phase: "Solid", config: "[Rn] 7s¹", electronegativity: 0.7, melt: 27, boil: 677, discoveredBy: "Marguerite Perey (1939)", summary: "Second rarest natural element; extremely unstable alkali metal with longest half-life of only 22 minutes." },
  { number: 88, symbol: "Ra", name: "Radium", mass: 226, category: "alkaline", period: 7, group: 2, phase: "Solid", config: "[Rn] 7s²", electronegativity: 0.9, melt: 700, boil: 1737, discoveredBy: "Marie & Pierre Curie (1898)", summary: "Luminescent radioactive alkaline earth metal historically used on glow-in-the-dark watch dials." },

  // Actinides (89 - 103)
  { number: 89, symbol: "Ac", name: "Actinium", mass: 227, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 6d¹ 7s²", electronegativity: 1.1, melt: 1050, boil: 3198, discoveredBy: "Friedrich Oskar Giesel (1902)", summary: "Gives name to the actinide series; powerful alpha radiation source in targeted cancer therapeutics." },
  { number: 90, symbol: "Th", name: "Thorium", mass: 232.04, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 6d² 7s²", electronegativity: 1.3, melt: 1750, boil: 4788, discoveredBy: "Jöns Jacob Berzelius (1829)", summary: "Abundant primordial actinide studied worldwide as a safer, cleaner alternative fuel for nuclear reactors." },
  { number: 91, symbol: "Pa", name: "Protactinium", mass: 231.04, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f² 6d¹ 7s²", electronegativity: 1.5, melt: 1568, boil: 4027, discoveredBy: "Lise Meitner & Otto Hahn (1917)", summary: "Dense, radioactive actinide produced as intermediate during uranium-235 decay." },
  { number: 92, symbol: "U", name: "Uranium", mass: 238.03, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f³ 6d¹ 7s²", electronegativity: 1.38, melt: 1132.2, boil: 4131, discoveredBy: "Martin Heinrich Klaproth (1789)", summary: "Heaviest primordial element; fissile U-235 generates 10% of the world's electricity via nuclear power." },
  { number: 93, symbol: "Np", name: "Neptunium", mass: 237, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f⁴ 6d¹ 7s²", electronegativity: 1.36, melt: 644, boil: 3902, discoveredBy: "Edwin McMillan & Philip H. Abelson (1940)", summary: "First synthesized transuranic element; by-product of nuclear power reactor operation." },
  { number: 94, symbol: "Pu", name: "Plutonium", mass: 244, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f⁶ 7s²", electronegativity: 1.28, melt: 639.4, boil: 3228, discoveredBy: "Glenn T. Seaborg et al. (1940)", summary: "Fissile actinide synthesized in nuclear reactors; powers NASA Mars rovers and Voyager spacecraft via RTGs." },
  { number: 95, symbol: "Am", name: "Americium", mass: 243, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f⁷ 7s²", electronegativity: 1.3, melt: 1176, boil: 2011, discoveredBy: "Glenn T. Seaborg et al. (1944)", summary: "Synthetic alpha emitter used in millions of household smoke detectors worldwide." },
  { number: 96, symbol: "Cm", name: "Curium", mass: 247, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f⁷ 6d¹ 7s²", electronegativity: 1.3, melt: 1345, boil: 3110, discoveredBy: "Glenn T. Seaborg et al. (1944)", summary: "Hard radioactive metal named for Marie and Pierre Curie; used in X-ray alpha spectrometers on Mars." },
  { number: 97, symbol: "Bk", name: "Berkelium", mass: 247, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f⁹ 7s²", electronegativity: 1.3, melt: 986, boil: 2627, discoveredBy: "Glenn T. Seaborg et al. (1949)", summary: "Synthesized actinide named for UC Berkeley; target element used to discover Tennessine." },
  { number: 98, symbol: "Cf", name: "Californium", mass: 251, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹⁰ 7s²", electronegativity: 1.3, melt: 900, boil: 1470, discoveredBy: "Glenn T. Seaborg et al. (1950)", summary: "Extremely strong neutron emitter; used to detect gold ores and start up commercial nuclear reactors." },
  { number: 99, symbol: "Es", name: "Einsteinium", mass: 252, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹¹ 7s²", electronegativity: 1.3, melt: 860, boil: 996, discoveredBy: "Albert Ghiorso et al. (1952)", summary: "Named in honor of Albert Einstein; discovered in the fallout debris of the Ivy Mike thermonuclear test." },
  { number: 100, symbol: "Fm", name: "Fermium", mass: 257, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹² 7s²", electronegativity: 1.3, melt: 1527, boil: undefined, discoveredBy: "Albert Ghiorso et al. (1952)", summary: "Heaviest element that can be produced in macrogroups via neutron bombardment of lighter elements." },
  { number: 101, symbol: "Md", name: "Mendelevium", mass: 258, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹³ 7s²", electronegativity: 1.3, melt: 827, boil: undefined, discoveredBy: "Albert Ghiorso et al. (1955)", summary: "Named in honor of Dmitri Mendeleev, father of the Periodic Table; produced one atom at a time." },
  { number: 102, symbol: "No", name: "Nobelium", mass: 259, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹⁴ 7s²", electronegativity: 1.3, melt: 827, boil: undefined, discoveredBy: "Joint Institute for Nuclear Research (1966)", summary: "Named in honor of Alfred Nobel, inventor of dynamite and benefactor of the Nobel Prizes." },
  { number: 103, symbol: "Lr", name: "Lawrencium", mass: 266, category: "actinide", period: 7, group: 3, phase: "Solid", config: "[Rn] 5f¹⁴ 7s² 7p¹", electronegativity: 1.3, melt: 1627, boil: undefined, discoveredBy: "Albert Ghiorso et al. (1961)", summary: "Final actinide, named for Ernest O. Lawrence, inventor of the cyclotron particle accelerator." },

  // Transactinides (Superheavy Elements 104 - 118)
  { number: 104, symbol: "Rf", name: "Rutherfordium", mass: 267, category: "transition", period: 7, group: 4, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d² 7s²", summary: "First superheavy transactinide element; named in honor of physicist Ernest Rutherford." },
  { number: 105, symbol: "Db", name: "Dubnium", mass: 268, category: "transition", period: 7, group: 5, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d³ 7s²", summary: "Synthesized superheavy transition element named for Dubna, Russia, home of the JINR lab." },
  { number: 106, symbol: "Sg", name: "Seaborgium", mass: 269, category: "transition", period: 7, group: 6, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁴ 7s²", summary: "Named for Nobel laureate Glenn T. Seaborg while he was still alive." },
  { number: 107, symbol: "Bh", name: "Bohrium", mass: 270, category: "transition", period: 7, group: 7, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁵ 7s²", summary: "Synthetic superheavy element named in honor of Danish quantum physicist Niels Bohr." },
  { number: 108, symbol: "Hs", name: "Hassium", mass: 269, category: "transition", period: 7, group: 8, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁶ 7s²", summary: "Named for the German state of Hesse; forms volatile oxide molecules like osmium." },
  { number: 109, symbol: "Mt", name: "Meitnerium", mass: 278, category: "transition", period: 7, group: 9, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁷ 7s²", summary: "Named in honor of Austrian physicist Lise Meitner, discoverer of nuclear fission." },
  { number: 110, symbol: "Ds", name: "Darmstadtium", mass: 281, category: "transition", period: 7, group: 10, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁸ 7s²", summary: "Named after the German city of Darmstadt, where it was discovered at GSI Helmholtzzentrum." },
  { number: 111, symbol: "Rg", name: "Roentgenium", mass: 282, category: "transition", period: 7, group: 11, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d⁹ 7s²", summary: "Named in honor of Wilhelm Conrad Röntgen, the discoverer of X-rays." },
  { number: 112, symbol: "Cn", name: "Copernicium", mass: 285, category: "transition", period: 7, group: 12, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s²", summary: "Named in honor of astronomer Nicolaus Copernicus; relativistic effects make it behave like a noble gas." },
  { number: 113, symbol: "Nh", name: "Nihonium", mass: 286, category: "post-transition", period: 7, group: 13, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹", summary: "First chemical element discovered in Asia; named after Nihon, the Japanese name for Japan." },
  { number: 114, symbol: "Fl", name: "Flerovium", mass: 289, category: "post-transition", period: 7, group: 14, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²", summary: "Superheavy element named after the Flerov Laboratory of Nuclear Reactions." },
  { number: 115, symbol: "Mc", name: "Moscovium", mass: 290, category: "post-transition", period: 7, group: 15, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³", summary: "Synthetic element discovered by Dubna-Oak Ridge collaboration; named in honor of Moscow Oblast." },
  { number: 116, symbol: "Lv", name: "Livermorium", mass: 293, category: "post-transition", period: 7, group: 16, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴", summary: "Named in honor of Lawrence Livermore National Laboratory in California." },
  { number: 117, symbol: "Ts", name: "Tennessine", mass: 294, category: "halogen", period: 7, group: 17, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵", summary: "Superheavy halogen discovered with Berkelium targets; named for the state of Tennessee." },
  { number: 118, symbol: "Og", name: "Oganesson", mass: 294, category: "noble", period: 7, group: 18, phase: "Unknown", config: "[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶", summary: "Heaviest known element on the Periodic Table; named in honor of nuclear physicist Yuri Oganessian." },
];

export const ELEMENT_MAP = new Map<number, ElementData>(
  ALL_118_ELEMENTS.map((el) => [el.number, el])
);

export function getElement(num: number): ElementData | undefined {
  return ELEMENT_MAP.get(num);
}

// Coordinate mapping in the standard 18-column Periodic Table grid
// Columns: 1 to 18 (1-indexed)
// Rows: 1 to 7 for main table; 9 for Lanthanides; 10 for Actinides
export function getElementGridPosition(el: ElementData): { col: number; row: number } {
  // Lanthanides (57..71) placed in Row 9, cols 4..18
  if (el.number >= 57 && el.number <= 71) {
    return { row: 9, col: el.number - 57 + 4 };
  }
  // Actinides (89..103) placed in Row 10, cols 4..18
  if (el.number >= 89 && el.number <= 103) {
    return { row: 10, col: el.number - 89 + 4 };
  }
  // Period 1..7 main table
  return { row: el.period, col: el.group };
}

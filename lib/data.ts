import type {
  Agency,
  AgencyCode,
  Conservation,
  Cons,
  Method,
  Mode,
  Place,
  Status,
  Tarifs,
} from "./types";

/* ---------- Référentiels (exemples à valider avec la direction) ---------- */

export const AG: Record<AgencyCode, Agency> = {
  DKR: {
    name: "Dakar",
    site: "Colobane",
    lat: 14.692,
    lon: -17.447,
    hours: "06:00 – 22:00",
    cap: 420,
    staff: 14,
  },
  THS: {
    name: "Thiès",
    site: "Gare routière",
    lat: 14.791,
    lon: -16.926,
    hours: "06:00 – 21:00",
    cap: 180,
    staff: 7,
  },
  MBR: {
    name: "Mbour",
    site: "Centre",
    lat: 14.42,
    lon: -16.965,
    hours: "07:00 – 20:00",
    cap: 120,
    staff: 5,
  },
  TBA: {
    name: "Touba",
    site: "Darou Khoudoss",
    lat: 14.85,
    lon: -15.883,
    hours: "06:00 – 22:00",
    cap: 260,
    staff: 9,
  },
  KLK: {
    name: "Kaolack",
    site: "Médina Baye",
    lat: 14.151,
    lon: -16.073,
    hours: "06:30 – 21:00",
    cap: 200,
    staff: 7,
  },
  STL: {
    name: "Saint-Louis",
    site: "Sor",
    lat: 16.026,
    lon: -16.489,
    hours: "07:00 – 20:00",
    cap: 160,
    staff: 6,
  },
  TBC: {
    name: "Tambacounda",
    site: "Centre",
    lat: 13.77,
    lon: -13.668,
    hours: "07:00 – 19:00",
    cap: 140,
    staff: 5,
  },
  ZIG: {
    name: "Ziguinchor",
    site: "Boucotte",
    lat: 12.564,
    lon: -16.264,
    hours: "07:00 – 19:00",
    cap: 150,
    staff: 6,
  },
};
export const AG_CODES = Object.keys(AG) as AgencyCode[];

/** Réseau routier schématique entre agences */
export const NET: [AgencyCode, AgencyCode][] = [
  ["DKR", "THS"],
  ["DKR", "MBR"],
  ["THS", "TBA"],
  ["THS", "STL"],
  ["MBR", "KLK"],
  ["KLK", "TBC"],
  ["KLK", "ZIG"],
  ["DKR", "TBA"],
  ["DKR", "STL"],
  ["DKR", "KLK"],
];

/** Quartiers desservis par LIVREX à Dakar */
export const Q: Record<string, [number, number]> = {
  Plateau: [14.668, -17.432],
  Médina: [14.682, -17.452],
  "Point E": [14.694, -17.465],
  Mermoz: [14.707, -17.476],
  Ouakam: [14.723, -17.49],
  Almadies: [14.744, -17.515],
  Ngor: [14.75, -17.506],
  Yoff: [14.756, -17.468],
  "Sacré-Cœur": [14.717, -17.463],
  "Liberté 6": [14.727, -17.455],
  "Grand Yoff": [14.735, -17.445],
  "Parcelles Assainies": [14.763, -17.433],
  Hann: [14.705, -17.425],
  Pikine: [14.755, -17.39],
  Guédiawaye: [14.776, -17.395],
  "Keur Massar": [14.783, -17.317],
  Rufisque: [14.718, -17.273],
};
export const QUARTIERS = Object.keys(Q);
export const qp = (n: string): Place => ({
  lat: Q[n][0],
  lon: Q[n][1],
  label: n,
});

/** Contours simplifiés [lon, lat] */
export const SN: [number, number][] = [
  [-16.53, 16.06],
  [-16.28, 16.52],
  [-15.98, 16.5],
  [-15.5, 16.56],
  [-15.1, 16.64],
  [-14.58, 16.64],
  [-14.1, 16.3],
  [-13.7, 15.85],
  [-13.3, 15.5],
  [-12.8, 15.1],
  [-12.4, 14.8],
  [-12.18, 14.62],
  [-12.1, 14.3],
  [-12.0, 13.8],
  [-11.7, 13.4],
  [-11.5, 12.9],
  [-11.4, 12.42],
  [-11.8, 12.4],
  [-12.4, 12.36],
  [-12.9, 12.48],
  [-13.7, 12.62],
  [-14.4, 12.66],
  [-15.2, 12.68],
  [-15.8, 12.52],
  [-16.25, 12.4],
  [-16.72, 12.36],
  [-16.78, 12.62],
  [-16.72, 13.06],
  [-16.8, 13.38],
  [-16.7, 13.6],
  [-16.78, 13.9],
  [-17.0, 14.3],
  [-17.14, 14.62],
  [-17.4, 14.68],
  [-17.53, 14.74],
  [-17.4, 14.84],
  [-17.1, 14.96],
  [-16.85, 15.3],
  [-16.62, 15.7],
];
export const GM: [number, number][] = [
  [-16.72, 13.06],
  [-15.9, 13.14],
  [-15.2, 13.36],
  [-14.7, 13.32],
  [-13.8, 13.32],
  [-13.8, 13.55],
  [-14.4, 13.55],
  [-15.1, 13.6],
  [-15.6, 13.58],
  [-16.1, 13.6],
  [-16.7, 13.6],
  [-16.8, 13.38],
];
export const DK: [number, number][] = [
  [-17.535, 14.744],
  [-17.505, 14.72],
  [-17.48, 14.69],
  [-17.455, 14.672],
  [-17.43, 14.655],
  [-17.418, 14.668],
  [-17.43, 14.69],
  [-17.405, 14.71],
  [-17.35, 14.722],
  [-17.29, 14.712],
  [-17.23, 14.69],
  [-17.16, 14.67],
  [-17.16, 14.86],
  [-17.25, 14.83],
  [-17.33, 14.8],
  [-17.41, 14.775],
  [-17.46, 14.768],
  [-17.505, 14.758],
];

/* ---------- Catégories : deux critères combinables ---------- */

/** 1er critère : la conservation */
export const CONS: Record<Cons, Conservation> = {
  SEC: {
    label: "Sec",
    hint: "Température ambiante, sans condition particulière",
    zone: "Zone sèche",
    sur: 0,
    pack: "Carton fermé, sac doublé",
  },
  FRESH: {
    label: "Fresh",
    hint: "Produits frais, entre 2 et 8 °C",
    zone: "Zone fraîche",
    sur: 0.2,
    cold: true,
    pack: "Glacière ou carton isotherme, pains de glace",
  },
  FROZEN: {
    label: "Frozen",
    hint: "Produits congelés, à −18 °C",
    zone: "Zone froide",
    sur: 0.35,
    cold: true,
    pack: "Caisse isotherme scellée, carboglace si trajet long",
  },
};
export const CONS_CODES = Object.keys(CONS) as Cons[];

/** 2e critère : la manipulation */
export const FRAGILE = {
  label: "Fragile",
  sur: 0.15,
  zone: "Zone fragile",
  hint: "Étagère basse, pas d'empilement",
  pack: "papier bulle, calage, mention FRAGILE",
};

export const catLabel = (p: { cons: Cons; fragile: boolean }) =>
  `${CONS[p.cons].label} · ${p.fragile ? "Fragile" : "Non fragile"}`;
export const isCold = (cons: Cons) => !!CONS[cons].cold;
/** Le froid prime : un congelé fragile va en zone froide, sur étagère basse */
export const zoneOf = (cons: Cons, fragile: boolean) =>
  CONS[cons].cold ? CONS[cons].zone : fragile ? FRAGILE.zone : CONS.SEC.zone;
export const ZONES = [
  "Zone sèche",
  "Zone fragile",
  "Zone fraîche",
  "Zone froide",
];
export const packOf = (cons: Cons, fragile: boolean) =>
  CONS[cons].pack + (fragile ? " + " + FRAGILE.pack : "");

/* ---------- Les trois types de transport, selon le poids ---------- */
export const MODES: Record<
  Mode,
  { label: string; short: string; vehicles: string; area: string; desc: string }
> = {
  EXPRESS: {
    label: "Livraison express",
    short: "Express",
    vehicles: "Moto, scooter",
    area: "Dans Dakar, de porte à porte",
    desc: "Petits colis livrés dans la journée, ou en moins de 2 h",
  },
  FRET: {
    label: "Fret routier",
    short: "Fret",
    vehicles: "Fourgon, camionnette",
    area: "D'une agence à l'autre, entre villes",
    desc: "Colis moyens déposés en agence, retrait ou livraison à l’arrivée",
  },
  MASSE: {
    label: "Camion dédié",
    short: "Camion dédié",
    vehicles: "Camion, semi-remorque",
    area: "Enlèvement et livraison sur site",
    desc: "Gros volumes et chargements complets, camion dédié",
  },
};
export const MODE_CODES = Object.keys(MODES) as Mode[];
/** Bornes de poids d'un type de transport, d'après les seuils réglés dans l'admin */
export const modeRange = (t: Tarifs, m: Mode): [number, number] =>
  m === "EXPRESS"
    ? [0, t.expressMax]
    : m === "FRET"
      ? [t.expressMax, t.fretMax]
      : [t.fretMax, t.masseMax];
export const kgTxt = (kg: number) =>
  kg >= 1000
    ? (kg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " t"
    : kg.toLocaleString("fr-FR") + " kg";

export const ST = {
  CREATED: "Créé",
  PREP: "En préparation",
  STORED: "Stocké",
  READY: "Prêt au transfert",
  TRANSIT: "En transit",
  ARRIVED: "Arrivé",
  DEST: "En stockage destination",
  ASSIGNED: "Livreur affecté",
  DELIV: "En livraison",
  DONE: "Livré",
  PICKED: "Retiré",
  PLANNED: "Véhicule affecté",
} as const satisfies Record<string, Status>;
export const ALL_STATUSES = Object.values(ST) as Status[];

export const TONE: Record<Status, "n" | "b" | "w" | "g"> = {
  Créé: "n",
  "En préparation": "n",
  Stocké: "b",
  "Prêt au transfert": "b",
  "En transit": "w",
  Arrivé: "b",
  "En stockage destination": "b",
  "Livreur affecté": "w",
  "En livraison": "w",
  Livré: "g",
  Retiré: "g",
  "Véhicule affecté": "w",
};

export const METHODS: Record<Method, string> = {
  WAVE: "Wave",
  OM: "Orange Money",
  CARD: "Carte bancaire",
  CASH: "Espèces",
  COD: "Paiement à la livraison",
};

export const CHANNELS: Record<string, string> = {
  SMS: "SMS",
  EMAIL: "E-mail",
  CALL: "Appel",
  WA: "WhatsApp",
};

export const DRIVERS: Record<string, string> = {
  D1: "Mamadou Sow",
  D2: "Cheikh Guèye",
  D3: "Ousmane Ba",
  D4: "Abdou Faye",
  D5: "Pape Ndiaye",
  D6: "Saliou Mbaye",
  D7: "Babacar Diallo",
  D8: "Lamine Ndour",
};

/** Lignes régulières voyageurs : départ, arrivée, horaires, véhicule */
export const LINES: [AgencyCode, AgencyCode, string[], string][] = [
  ["DKR", "TBA", ["06:30", "09:00", "14:00"], "BUS-01"],
  ["DKR", "STL", ["07:00", "15:30"], "BUS-02"],
  ["DKR", "THS", ["06:00", "08:00", "12:00", "17:00"], "SPT-04"],
  ["THS", "TBA", ["08:30", "13:00"], "MIN-03"],
  ["DKR", "KLK", ["07:30", "13:30"], "BUS-02"],
  ["DKR", "ZIG", ["05:30"], "BUS-01"],
  ["DKR", "MBR", ["09:00", "16:00"], "SPT-04"],
  ["KLK", "TBC", ["08:00"], "MIN-03"],
];

export const BAG: Record<string, string> = {
  bus: "1 bagage en soute (20 kg) + 1 sac à main",
  mini: "1 bagage (15 kg) + 1 sac à main",
  sept: "1 bagage (10 kg)",
};
export const COMFORT: Record<string, string> = {
  bus: "Climatisation · sièges inclinables",
  mini: "Climatisation",
  sept: "Véhicule léger, trajet direct",
};

/** Points à trancher avec l'entrepreneur (hypothèses du prototype) */
export const DECISIONS: [string, string, string][] = [
  [
    "Cadrage",
    "Le transport de voyageurs fait-il partie du projet ?",
    "Hypothèse : « transport de masse » = marchandises lourdes. Le module voyageurs est conservé à part, en attente de confirmation.",
  ],
  [
    "Cadrage",
    "Seuils de poids des trois transports",
    "Hypothèse : express jusqu’à 30 kg, fret routier jusqu’à 1 t, transport de masse au-delà (jusqu’à 30 t). Réglables dans Admin › Tarifs.",
  ],
  [
    "Cadrage",
    "Choix du type de transport",
    "Proposé automatiquement selon le poids. Le client peut choisir un type plus grand, jamais un type dont le seuil est dépassé.",
  ],
  [
    "Cadrage",
    "Distance",
    "Hypothèse : express dans Dakar ; fret entre agences ; masse de ville à ville ou dans une même ville, enlèvement sur site.",
  ],
  [
    "Cadrage",
    "Catégories combinables",
    "Hypothèse : deux critères par colis, conservation (sec, fresh, frozen) et manipulation (fragile ou non). Majorations cumulées.",
  ],
  [
    "Voyageurs",
    "Le client choisit-il son siège ?",
    "Oui, plan de sièges à la réservation.",
  ],
  [
    "Voyageurs",
    "Ticket numérique et QR code ?",
    "Ticket numérique, un QR code par voyageur.",
  ],
  [
    "Voyageurs",
    "Annulation et modification",
    "Non gérées dans le prototype. Règle de remboursement à définir.",
  ],
  [
    "Voyageurs",
    "Fêtes religieuses",
    "Interrupteur « forte demande » : majoration paramétrable et sièges plus rares.",
  ],
  [
    "Fret",
    "Calcul du prix",
    "Forfait + poids + distance, majoration selon catégorie et service express 24 h.",
  ],
  [
    "Fret",
    "Emballage payant ?",
    "Payant s'il est fourni par l'agence (500 FCFA), gratuit si le client l'apporte.",
  ],
  [
    "Fret",
    "Colis perdu ou endommagé",
    "Non traité. Prévoir un statut « Litige » et une procédure d'indemnisation.",
  ],
  [
    "Fret",
    "Durée et frais de stockage",
    "Non facturés. À fixer (ex. gratuit 7 jours puis frais journaliers).",
  ],
  [
    "Fret",
    "Produits frais et congelés",
    "Transfert autorisé uniquement en véhicule réfrigéré.",
  ],
  [
    "Tracking",
    "Qui est géolocalisé ?",
    "Le véhicule et le livreur. Le colis hérite de leur position.",
  ],
  [
    "Tracking",
    "Fréquence de position",
    "Chaque seconde en démo. À arbitrer selon le coût data et batterie.",
  ],
  [
    "Livraison",
    "Retrait ou livraison : qui décide ?",
    "L'expéditeur, au dépôt du colis.",
  ],
  [
    "Livraison",
    "Affectation du livreur",
    "Suggestion du plus proche disponible, validation manuelle ou automatique.",
  ],
  [
    "Livraison",
    "Contrôle de distance",
    "Scan et validation seulement à moins de 150 m du point. Rayon à ajuster selon la précision GPS des téléphones.",
  ],
  [
    "Livraison",
    "Preuve de remise",
    "Code à 4 chiffres + signature. Photo obligatoire si destinataire absent.",
  ],
  [
    "Livraison",
    "Optimisation de tournée",
    "Regroupement des courses par zone proposé au dispatch (ordre du plus proche voisin). Outil type Routific à évaluer.",
  ],
  [
    "Paiement",
    "Moyens de paiement",
    "Wave, Orange Money, carte, espèces, paiement à la livraison (LIVREX). Agrégateur à choisir.",
  ],
  [
    "API",
    "Accès e-commerce",
    "Clé API par boutique, création d’envois et webhooks de statut. Démo dans l’onglet « API ».",
  ],
];

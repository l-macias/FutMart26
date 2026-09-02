export const ARGENTINA_COUNTRY = {
  code: "AR",
  displayName: "Argentina",
} as const;

export const ARGENTINA_PROVINCES = [
  { code: "AR-C", displayName: "Ciudad Autónoma de Buenos Aires" },
  { code: "AR-B", displayName: "Buenos Aires" },
  { code: "AR-K", displayName: "Catamarca" },
  { code: "AR-H", displayName: "Chaco" },
  { code: "AR-U", displayName: "Chubut" },
  { code: "AR-X", displayName: "Córdoba" },
  { code: "AR-W", displayName: "Corrientes" },
  { code: "AR-E", displayName: "Entre Ríos" },
  { code: "AR-P", displayName: "Formosa" },
  { code: "AR-Y", displayName: "Jujuy" },
  { code: "AR-L", displayName: "La Pampa" },
  { code: "AR-F", displayName: "La Rioja" },
  { code: "AR-M", displayName: "Mendoza" },
  { code: "AR-N", displayName: "Misiones" },
  { code: "AR-Q", displayName: "Neuquén" },
  { code: "AR-R", displayName: "Río Negro" },
  { code: "AR-A", displayName: "Salta" },
  { code: "AR-J", displayName: "San Juan" },
  { code: "AR-D", displayName: "San Luis" },
  { code: "AR-Z", displayName: "Santa Cruz" },
  { code: "AR-S", displayName: "Santa Fe" },
  { code: "AR-G", displayName: "Santiago del Estero" },
  { code: "AR-V", displayName: "Tierra del Fuego" },
  { code: "AR-T", displayName: "Tucumán" },
] as const;

export function countryDisplayName(code: string) {
  return code === ARGENTINA_COUNTRY.code ? ARGENTINA_COUNTRY.displayName : code;
}

export function provinceDisplayName(code: string) {
  return (
    ARGENTINA_PROVINCES.find((province) => province.code === code)
      ?.displayName ?? code
  );
}

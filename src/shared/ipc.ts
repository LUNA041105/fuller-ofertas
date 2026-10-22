// Contrato de canales IPC entre el renderer (React) y el main process (Electron).
// Centralizar los nombres evita errores de tipeo y documenta la API interna.

export const IPC = {
  // Campanas
  campaignList: 'campaign:list',
  campaignCreate: 'campaign:create',
  campaignCreateOrReuse: 'campaign:createOrReuse',
  campaignDelete: 'campaign:delete',

  // Originales
  originalImport: 'original:import',
  originalImportPaths: 'original:importPaths',
  originalList: 'original:list',
  originalPagePreview: 'original:pagePreview',
  originalDetectRegions: 'original:detectRegions',

  // Spreads
  spreadList: 'spread:list',
  spreadCreate: 'spread:create',
  spreadUpdate: 'spread:update',
  spreadDelete: 'spread:delete',

  // Piezas y versiones
  pieceList: 'piece:list',
  pieceCreate: 'piece:create',
  pieceGenerate: 'piece:generate',
  pieceRegenerate: 'piece:regenerate',
  versionList: 'version:list',
  versionSetFinal: 'version:setFinal',

  // Exportacion
  exportClipboard: 'export:clipboard',
  exportSingle: 'export:single',
  exportSelection: 'export:selection',
  exportZip: 'export:zip',
  exportVersionSingle: 'export:versionSingle',
  exportZipVersions: 'export:zipVersions',

  // Biblioteca ("Consultar ofertas")
  libraryTree: 'library:tree',
  librarySave: 'library:save',
  libraryRename: 'library:rename',
  libraryMove: 'library:move',
  libraryDelete: 'library:delete',
  libraryExport: 'library:export',
  libraryCheckName: 'library:checkName',
  libraryDeleteCampaign: 'library:deleteCampaign',
  libraryDeleteYear: 'library:deleteYear',

  // Ajustes
  settingsGet: 'settings:get',
  settingsSetApiKey: 'settings:setApiKey',
  settingsSetModel: 'settings:setModel',
  settingsSetImageModel: 'settings:setImageModel',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

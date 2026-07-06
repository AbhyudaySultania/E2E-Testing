import path from 'path';

/** Matches PERSISTANT_STORAGE_KEY_AUTH_TOKEN in Pm-Doctor-Portal */
export const AUTH_TOKEN_KEY = 'persistant.storage.key.auth-token';

export const AUTH_STORAGE_PATH = path.join(__dirname, '..', '.auth', 'user.json');

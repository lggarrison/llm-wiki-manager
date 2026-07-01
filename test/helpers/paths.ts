import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

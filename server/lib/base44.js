/** Reads the live Base44 app: entity records, users and media bytes. */

import { request, expectOk, HttpError } from './http.js';

// Media lives behind two hosts: files served by the app API and the public
// media CDN used for app/brand images.
const MEDIA_PATTERNS = [
  /\/files\/mp\/(public|private)\//,
  /^https?:\/\/media\.base44\.com\/(images|files)\//,
];

export class Base44Source {
  constructor({ appId, adminToken, sourceApiUrl }) {
    this.appId = appId;
    this.adminToken = adminToken;
    this.apiUrl = sourceApiUrl;
  }

  get configured() {
    return Boolean(this.appId && this.adminToken);
  }

  #headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.adminToken}`,
      'X-App-Id': this.appId,
      ...extra,
    };
  }

  async #get(path) {
    const response = await request(`${this.apiUrl}${path}`, { headers: this.#headers() });
    return expectOk(response, `Base44 request ${path.split('?')[0]}`);
  }

  /** Pages through every record of an entity (500 per request). */
  async listAll(entity, { pageSize = 500 } = {}) {
    const records = [];
    let skip = 0;
    for (;;) {
      const page = await this.#get(
        `/api/apps/${this.appId}/entities/${entity}?limit=${pageSize}&skip=${skip}`,
      );
      if (!Array.isArray(page) || page.length === 0) break;
      records.push(...page);
      if (page.length < pageSize) break;
      skip += page.length;
      if (records.length > 200_000) break;
    }
    return records;
  }

  async listUsers() {
    const users = await this.listAll('User');
    return users.filter((user) => !user.is_service);
  }

  /** Downloads the bytes behind a Base44 media URL. */
  async downloadMedia(url) {
    const sameOrigin = url.startsWith(this.apiUrl) || url.includes('/api/apps/');
    const headers = sameOrigin ? { 'X-App-Id': this.appId } : {};
    if (sameOrigin) headers.Authorization = `Bearer ${this.adminToken}`;

    const response = await request(url, {
      headers,
      redirect: 'follow',
      timeoutMs: 120_000,
      retries: 2,
    });
    if (!response.ok) {
      throw new HttpError(response.status, `Download failed (${response.status}) for ${hostOf(url)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) throw new HttpError(422, 'Downloaded media was empty');
    return {
      bytes: buffer,
      contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
    };
  }
}

export function isBase44MediaUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) return false;
  return MEDIA_PATTERNS.some((pattern) => pattern.test(value));
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'media';
  }
}

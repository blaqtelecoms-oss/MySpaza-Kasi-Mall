import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { installOfflineLayer } from '@/lib/offlineLayer';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Wrap the entity layer with offline caching + write queueing (app-wide, transparent).
installOfflineLayer(base44);
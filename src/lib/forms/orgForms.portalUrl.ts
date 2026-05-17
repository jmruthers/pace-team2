const PORTAL_UNSET_TITLE = 'Portal origin not configured. Contact your administrator.';

export interface PortalFormsUrlResult {
  ok: boolean;
  url?: string;
  errorTitle?: string;
}

/** BR-J — trim trailing slash from origin before joining `/forms/:slug`. */
export function composePortalFormsUrl(originRaw: string | undefined, slug: string): PortalFormsUrlResult {
  const trimmedOrigin = typeof originRaw === 'string' ? originRaw.trim().replace(/\/+$/, '') : '';
  if (trimmedOrigin.length === 0) {
    return { ok: false, errorTitle: PORTAL_UNSET_TITLE };
  }
  return {
    ok: true,
    url: `${trimmedOrigin}/forms/${slug}`,
  };
}

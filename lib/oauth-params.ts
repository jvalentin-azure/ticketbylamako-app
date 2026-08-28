export function getOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const fragment = parsed.hash.startsWith("#")
    ? parsed.hash.slice(1)
    : parsed.hash;

  // Facebook returns state in the query and access_token in the fragment.
  // Merge both locations instead of choosing one and losing the CSRF state.
  new URLSearchParams(fragment).forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}


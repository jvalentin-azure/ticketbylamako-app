export function getOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const rawFragment = parsed.hash.startsWith("#")
    ? parsed.hash.slice(1)
    : parsed.hash;
  const foldedQueryIndex = rawFragment.indexOf("?");
  const fragment =
    foldedQueryIndex >= 0
      ? rawFragment.slice(0, foldedQueryIndex)
      : rawFragment;
  const foldedQuery =
    foldedQueryIndex >= 0 ? rawFragment.slice(foldedQueryIndex + 1) : "";

  // Facebook returns state in the query and access_token in the fragment.
  // Expo Router can also fold the query behind the fragment on mobile Safari,
  // so merge that observed representation before validating the CSRF state.
  new URLSearchParams(foldedQuery).forEach((value, key) => {
    params.set(key, value);
  });
  new URLSearchParams(fragment).forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

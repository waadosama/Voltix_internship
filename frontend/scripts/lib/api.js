export function getApiBase() {
  const { hostname, port } = window.location;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000') {
    return 'http://localhost:3000';
  }
  return '';
}

export function apiUrl(path = '') {
  return `${getApiBase()}${path}`;
}

export async function parseJson(response) {
  return response.json().catch(() => ({}));
}

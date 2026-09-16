export function requireAdmin(request, response, next) {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const suppliedUsername = request.get('X-Admin-Username');
  const suppliedPassword = request.get('X-Admin-Password');

  if (!configuredUsername || !configuredPassword) {
    return response.status(503).json({ message: 'Admin credentials are not configured.' });
  }

  if (suppliedUsername !== configuredUsername || suppliedPassword !== configuredPassword) {
    return response.status(401).json({ message: 'Invalid admin username or password.' });
  }

  return next();
}
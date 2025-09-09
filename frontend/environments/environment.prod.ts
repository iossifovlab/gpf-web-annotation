import versionInfo from '../version.json';
const basePath = '';

export const environment = {
  production: true,
  basePath: basePath,
  apiPath: basePath,
  imgPathPrefix: '/static/assets',
  version: versionInfo?.version
};

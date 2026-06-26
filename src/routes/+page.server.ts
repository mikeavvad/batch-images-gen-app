import * as env from '$env/static/public';

export function load() {
  return {
    githubUrl: env.PUBLIC_GITHUB_URL || ''
  };
}

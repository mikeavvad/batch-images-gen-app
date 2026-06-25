import { env } from '$env/dynamic/public';

export function load() {
  return {
    githubUrl: env.PUBLIC_GITHUB_URL || ''
  };
}

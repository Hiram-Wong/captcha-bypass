import pkg from '../../package.json' with { type: 'json' };

// App information
export const APP_NAME: string = pkg.name;
export const APP_NAME_ALIAS: string = 'captcha';
export const APP_DESC: string = pkg.description;
export const APP_VERSION: string = pkg.version;
export const APP_AUTHOR: string = `${pkg.author.name}<${pkg.author.email}>`;
export const APP_COPYRIGHT: string = `Copyright © ${new Date().getFullYear()} ${pkg.author.name}. All rights reserved.`;

// App urls
export const WEBSITE_URL: string = pkg.homepage;

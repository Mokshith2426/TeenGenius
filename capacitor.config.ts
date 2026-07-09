import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.teengenius.app',
  appName: 'TeenGenius',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'teengenius.site',
      '*.teengenius.site',
      'www.teengenius.site'
    ]
  }
};

export default config;

const { description } = require('../../package')

module.exports = {
  title: ' ',
  description: description,
  head: [
    ['meta', { name: 'theme-color', content: '#D7A318' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
  ],
  locales: {
    '/': {
      lang: 'en-US', // this will be set as the lang attribute on <html>
      title: ' ',
    },
    '/pl/': {
      lang: 'pl-PL',
      title: ' ',
    }
  },
  themeConfig: {
    repo: 'https://github.com/latolukasz/orm',
    logo: 'logo-small.svg',
    editLinks: false,
    docsDir: '',
    editLinkText: '',
    lastUpdated: false,
    sidebar: {
      '/guide/': [
        {
          title: 'Guide',
          collapsable: false,
          children: [
            '',
            'using-vue',
          ]
        }
      ],
    },
    locales: {
      '/': {
        selectText: 'English',
        label: 'English',
        editLinkText: 'Edit this page on GitHub',
        nav: [
          {
            text: 'Guide',
            link: '/guide/',
          },
          {
            text: 'Config',
            link: '/config/'
          },
        ],
        sidebar: {
          '/': [/* ... */],
          '/nested/': [/* ... */]
        }
      },
      '/pl/': {
        selectText: 'Polski',
        label: 'Polski',
        nav: [
          {
            text: 'Podręcznik',
            link: '/guide/',
          },
          {
            text: 'Konfiguracja',
            link: '/config/'
          },
        ],
        sidebar: {
          '/zh/': [/* ... */],
          '/zh/nested/': [/* ... */]
        }
      }
    }
  },
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
  ]
}

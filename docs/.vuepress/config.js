module.exports = {
  title: 'BeeORM - golang ORM for MySQL and Redis',
  description: 'Golang ORM for high traffic applications. Designed for MySQL and Redis.',
  head: [
    ['meta', { name: 'theme-color', content: '#D7A318' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
  ],
  themeConfig: {
    repo: 'https://github.com/latolukasz/beeorm',
    docsRepo: 'https://github.com/latolukasz/beeorm-doc',
    logo: '/logo-small.svg',
    editLinks: true,
    docsDir: 'docs',
    editLinkText: '',
    lastUpdated: true,
    smoothScroll: true,
    nav: [
      {
        text: 'Guide',
        link: '/guide/',
      },
      {
        text: 'Benchmarks',
        link: '/benchmarks/'
      },
      {
        text: 'Roadmap',
        link: '/roadmap/'
      },
    ],
    sidebar: {
      '/guide/': [
        {
          title: 'Guide',
          collapsable: false,
          children: [
            '',
            'registry',
            'data_pools',
            'entities',
            'entity_fields',
            'mysql_indexes',
            'validated_registry',
            'engine',
            'schema_update',
            'crud',
            'search',
            'background_consumer',
            'lazy_crud',
            'uuid',
            'cached_queries',
            'mysql_queries',
            'local_cache',
            'redis_operations',
            'event_broker',
            'dirty_channel',
            'log_tables',
            'queries_log',
            'tools'
          ]
        }
      ],
    },
  },
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
    [
      'vuepress-plugin-sitemap',
      {hostname: 'https://beeorm.io'}
    ],
    [
      '@vuepress/google-analytics',
      {
        'ga': 'UA-195751907-1'
      }
    ]
  ]
}

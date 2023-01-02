module.exports = {
  title: 'BeeORM: A Golang ORM for MySQL and Redis',
  description: 'BeeORM is a Golang ORM designed for high-traffic applications that require optimal performance and scalability. Our ORM allows developers to easily build and maintain applications that can handle large amounts of data and traffic, using the power and simplicity of Golang, along with the reliability and speed of MySQL and Redis',
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
